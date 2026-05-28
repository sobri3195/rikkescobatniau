
-- 1. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  candidate_id uuid,
  exam_id uuid,
  link_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_select_own ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]));

CREATE POLICY notif_insert_staff ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'dokter'::app_role, 'kepala_sub_tim'::app_role, 'registrasi'::app_role])
  );

CREATE POLICY notif_update_own ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notif_delete_admin ON public.notifications FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]));

-- 2. IMPORT SESSIONS ROLLBACK COLUMNS
ALTER TABLE public.import_sessions
  ADD COLUMN IF NOT EXISTS rolled_back_at timestamptz,
  ADD COLUMN IF NOT EXISTS rolled_back_by uuid,
  ADD COLUMN IF NOT EXISTS rolled_back_reason text,
  ADD COLUMN IF NOT EXISTS candidates_deleted integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exams_deleted integer NOT NULL DEFAULT 0;

-- 3. ROLLBACK FUNCTION
CREATE OR REPLACE FUNCTION public.rollback_import_session(p_session_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_exams_deleted integer := 0;
  v_cands_deleted integer := 0;
  v_session record;
BEGIN
  IF NOT has_any_role(v_uid, ARRAY['super_admin'::app_role, 'admin'::app_role]) THEN
    RAISE EXCEPTION 'Tidak punya hak rollback import';
  END IF;

  SELECT * INTO v_session FROM import_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Import session tidak ditemukan'; END IF;
  IF v_session.rolled_back_at IS NOT NULL THEN RAISE EXCEPTION 'Sesi ini sudah pernah di-rollback'; END IF;

  -- Hard delete exams from this session OR exams of candidates from this session
  WITH del AS (
    DELETE FROM exams
    WHERE source_import_session_id = p_session_id
       OR candidate_id IN (SELECT id FROM candidates WHERE source_import_session_id = p_session_id)
    RETURNING 1
  )
  SELECT count(*) INTO v_exams_deleted FROM del;

  -- Soft delete candidates from this session (preserve audit trail)
  WITH del AS (
    UPDATE candidates
    SET deleted_at = now(),
        deleted_by = v_uid,
        delete_reason = COALESCE('Rollback import: ' || p_reason, 'Rollback import session'),
        status = 'Deleted'
    WHERE source_import_session_id = p_session_id
      AND deleted_at IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_cands_deleted FROM del;

  UPDATE import_sessions
  SET rolled_back_at = now(),
      rolled_back_by = v_uid,
      rolled_back_reason = p_reason,
      candidates_deleted = v_cands_deleted,
      exams_deleted = v_exams_deleted,
      status = 'Rolled Back',
      updated_at = now()
  WHERE id = p_session_id;

  INSERT INTO audit_logs(user_id, action, module, record_id, after_data, reason)
  VALUES (v_uid, 'rollback_import_session', 'Import History', p_session_id,
          jsonb_build_object('candidates_deleted', v_cands_deleted, 'exams_deleted', v_exams_deleted),
          p_reason);

  RETURN jsonb_build_object('candidates_deleted', v_cands_deleted, 'exams_deleted', v_exams_deleted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rollback_import_session(uuid, text) TO authenticated;

-- 4. CLARIFICATION NOTIFICATION TRIGGER
CREATE OR REPLACE FUNCTION public.notify_clarification_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate record;
  v_target_users uuid[];
BEGIN
  IF NEW.anamnesis_workflow_status = 'Perlu Klarifikasi'
     AND (OLD.anamnesis_workflow_status IS DISTINCT FROM NEW.anamnesis_workflow_status) THEN

    SELECT c.full_name, c.test_number, c.temporary_id, e.id AS exam_id, e.candidate_id
      INTO v_candidate
      FROM exams e
      JOIN candidates c ON c.id = e.candidate_id
     WHERE e.id = NEW.exam_id;

    -- Target: peserta itu sendiri (jika ada mapping user) + semua super_admin/admin (panitia)
    SELECT array_agg(DISTINCT ur.user_id) INTO v_target_users
      FROM user_roles ur
     WHERE ur.role IN ('super_admin', 'admin', 'registrasi');

    IF v_target_users IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, body, candidate_id, exam_id, link_url, metadata)
      SELECT unnest(v_target_users),
             'anamnesis_clarification',
             'Perlu Klarifikasi Anamnesis',
             COALESCE(v_candidate.full_name, 'Peserta') || ' (' || COALESCE(v_candidate.test_number, v_candidate.temporary_id, '—') || ') diminta klarifikasi anamnesis oleh dokter umum.',
             v_candidate.candidate_id,
             v_candidate.exam_id,
             '/rikkes/' || v_candidate.exam_id::text,
             jsonb_build_object('note', NEW.clarification_note);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_clarification ON public.medical_history_forms;
CREATE TRIGGER trg_notify_clarification
AFTER UPDATE ON public.medical_history_forms
FOR EACH ROW EXECUTE FUNCTION public.notify_clarification_request();

-- 5. REALTIME PUBLICATION
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.exams; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.exams REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
