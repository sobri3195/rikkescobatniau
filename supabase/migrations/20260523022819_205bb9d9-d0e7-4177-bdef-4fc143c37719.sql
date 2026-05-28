
-- 1. Add linked_user_id to candidates
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_linked_user_id
  ON public.candidates (linked_user_id)
  WHERE linked_user_id IS NOT NULL;

-- 2. Backfill via NRP/NIP match (best-effort; safe no-op if no match)
UPDATE public.candidates c
   SET linked_user_id = p.auth_user_id
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.auth_user_id
 WHERE c.linked_user_id IS NULL
   AND c.nrp_nip IS NOT NULL
   AND c.nrp_nip <> ''
   AND p.nrp_nip = c.nrp_nip
   AND ur.role IN ('peserta'::app_role, 'casis'::app_role);

-- 3. Helper: check if exam_id belongs to current user's linked candidate
CREATE OR REPLACE FUNCTION public.is_my_exam(_exam_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.exams e
    JOIN public.candidates c ON c.id = e.candidate_id
   WHERE e.id = _exam_id
     AND c.linked_user_id = auth.uid()
     AND c.linked_user_id IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_my_candidate(_cand_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.candidates c
     WHERE c.id = _cand_id
       AND c.linked_user_id = auth.uid()
       AND c.linked_user_id IS NOT NULL
  );
$$;

-- 4. SELECT policies for peserta on candidates and exams (scoped to own row)
DROP POLICY IF EXISTS candidates_select_patient_own ON public.candidates;
CREATE POLICY candidates_select_patient_own
  ON public.candidates FOR SELECT
  TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['peserta'::app_role, 'casis'::app_role])
    AND linked_user_id = auth.uid()
  );

DROP POLICY IF EXISTS exams_select_patient_own ON public.exams;
CREATE POLICY exams_select_patient_own
  ON public.exams FOR SELECT
  TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['peserta'::app_role, 'casis'::app_role])
    AND public.is_my_candidate(candidate_id)
  );

-- 5. Tighten medical_history_forms peserta policies — must also be linked candidate
DROP POLICY IF EXISTS mhf_patient_insert ON public.medical_history_forms;
CREATE POLICY mhf_patient_insert
  ON public.medical_history_forms FOR INSERT
  TO authenticated
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['peserta'::app_role, 'casis'::app_role])
    AND patient_filled_by = auth.uid()
    AND anamnesis_workflow_status = 'Draft Peserta'
    AND public.is_my_candidate(candidate_id)
  );

DROP POLICY IF EXISTS mhf_patient_update ON public.medical_history_forms;
CREATE POLICY mhf_patient_update
  ON public.medical_history_forms FOR UPDATE
  TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['peserta'::app_role, 'casis'::app_role])
    AND is_anamnesis_patient_writable(anamnesis_workflow_status)
    AND public.is_my_candidate(candidate_id)
  )
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['peserta'::app_role, 'casis'::app_role])
    AND anamnesis_workflow_status = ANY (ARRAY['Draft Peserta'::text, 'Perlu Klarifikasi'::text, 'Submitted Peserta'::text])
    AND public.is_my_candidate(candidate_id)
  );

DROP POLICY IF EXISTS mhf_select_patient_own ON public.medical_history_forms;
CREATE POLICY mhf_select_patient_own
  ON public.medical_history_forms FOR SELECT
  TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['peserta'::app_role, 'casis'::app_role])
    AND public.is_my_candidate(candidate_id)
  );

-- 6. Update notify trigger to use linked_user_id (primary) + NRP/NIP (fallback)
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

    SELECT c.full_name, c.test_number, c.temporary_id, c.nrp_nip, c.linked_user_id,
           e.id AS exam_id, e.candidate_id
      INTO v_candidate
      FROM exams e
      JOIN candidates c ON c.id = e.candidate_id
     WHERE e.id = NEW.exam_id;

    SELECT array_agg(DISTINCT uid) INTO v_target_users
      FROM (
        SELECT ur.user_id AS uid
          FROM user_roles ur
         WHERE ur.role IN ('super_admin', 'admin', 'registrasi')
        UNION
        SELECT v_candidate.linked_user_id AS uid
         WHERE v_candidate.linked_user_id IS NOT NULL
        UNION
        SELECT p.auth_user_id AS uid
          FROM profiles p
          JOIN user_roles ur2 ON ur2.user_id = p.auth_user_id
         WHERE ur2.role IN ('peserta', 'casis')
           AND v_candidate.linked_user_id IS NULL
           AND v_candidate.nrp_nip IS NOT NULL
           AND v_candidate.nrp_nip <> ''
           AND p.nrp_nip = v_candidate.nrp_nip
      ) s
     WHERE uid IS NOT NULL;

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
