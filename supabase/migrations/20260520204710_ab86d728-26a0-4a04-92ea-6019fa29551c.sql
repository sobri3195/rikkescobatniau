
-- Tabel riwayat perubahan test_number / temporary_id
CREATE TABLE IF NOT EXISTS public.candidate_test_number_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  old_test_number text,
  new_test_number text,
  old_temporary_id text,
  new_temporary_id text,
  change_type text NOT NULL,
  reason text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ctnh_candidate ON public.candidate_test_number_history(candidate_id, changed_at DESC);

ALTER TABLE public.candidate_test_number_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ctnh_select ON public.candidate_test_number_history;
CREATE POLICY ctnh_select ON public.candidate_test_number_history
FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'viewer'::app_role, 'kepala_sub_tim'::app_role, 'registrasi'::app_role]));

-- Tidak ada policy INSERT/UPDATE/DELETE → hanya bisa diisi oleh SECURITY DEFINER trigger.

-- Trigger: log setiap kali test_number atau temporary_id berubah
CREATE OR REPLACE FUNCTION public.log_candidate_test_number_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_type text;
  v_old_tn text := COALESCE(OLD.test_number, '');
  v_new_tn text := COALESCE(NEW.test_number, '');
  v_old_tmp text := COALESCE(OLD.temporary_id, '');
  v_new_tmp text := COALESCE(NEW.temporary_id, '');
BEGIN
  IF v_old_tn = v_new_tn AND v_old_tmp = v_new_tmp THEN
    RETURN NEW;
  END IF;

  IF v_old_tn = '' AND v_new_tn <> '' THEN
    v_type := 'assigned';
  ELSIF v_old_tn <> '' AND v_new_tn = '' THEN
    v_type := 'cleared';
  ELSIF v_old_tn <> v_new_tn THEN
    v_type := 'changed';
  ELSE
    v_type := 'temporary_id_updated';
  END IF;

  INSERT INTO public.candidate_test_number_history (
    candidate_id, old_test_number, new_test_number,
    old_temporary_id, new_temporary_id, change_type,
    reason, changed_by
  ) VALUES (
    NEW.id, NULLIF(v_old_tn, ''), NULLIF(v_new_tn, ''),
    NULLIF(v_old_tmp, ''), NULLIF(v_new_tmp, ''), v_type,
    NEW.test_number_notes, v_uid
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_candidate_test_number_change ON public.candidates;
CREATE TRIGGER trg_log_candidate_test_number_change
AFTER UPDATE OF test_number, temporary_id ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.log_candidate_test_number_change();
