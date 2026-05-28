
-- Add new Keswa (psychiatric status) columns without dropping legacy data
ALTER TABLE public.exam_psychology
  ADD COLUMN IF NOT EXISTS keswa_anamnesis_preschool text,
  ADD COLUMN IF NOT EXISTS keswa_anamnesis_school text,
  ADD COLUMN IF NOT EXISTS keswa_anamnesis_other text,
  ADD COLUMN IF NOT EXISTS keswa_appearance_neatness text,
  ADD COLUMN IF NOT EXISTS keswa_speech text,
  ADD COLUMN IF NOT EXISTS keswa_attitude text,
  ADD COLUMN IF NOT EXISTS keswa_behavior text,
  ADD COLUMN IF NOT EXISTS keswa_affect text,
  ADD COLUMN IF NOT EXISTS keswa_emotion_stability text,
  ADD COLUMN IF NOT EXISTS keswa_emotion_control text,
  ADD COLUMN IF NOT EXISTS keswa_memory text,
  ADD COLUMN IF NOT EXISTS keswa_orientation text,
  ADD COLUMN IF NOT EXISTS keswa_opinion_ability text,
  ADD COLUMN IF NOT EXISTS keswa_perception_disorder text,
  ADD COLUMN IF NOT EXISTS keswa_thought_process_quality text,
  ADD COLUMN IF NOT EXISTS keswa_thought_process_content text,
  ADD COLUMN IF NOT EXISTS keswa_other_symptoms text[],
  ADD COLUMN IF NOT EXISTS keswa_diagnosis text,
  ADD COLUMN IF NOT EXISTS keswa_stakes text,
  ADD COLUMN IF NOT EXISTS keswa_classification text,
  ADD COLUMN IF NOT EXISTS keswa_result_status text,
  ADD COLUMN IF NOT EXISTS keswa_conclusion text,
  ADD COLUMN IF NOT EXISTS keswa_legacy_notes text;

-- Drop existing constraints (if any) to allow safe re-run
ALTER TABLE public.exam_psychology DROP CONSTRAINT IF EXISTS exam_psychology_keswa_stakes_chk;
ALTER TABLE public.exam_psychology DROP CONSTRAINT IF EXISTS exam_psychology_keswa_classification_chk;
ALTER TABLE public.exam_psychology DROP CONSTRAINT IF EXISTS exam_psychology_keswa_result_status_chk;

ALTER TABLE public.exam_psychology
  ADD CONSTRAINT exam_psychology_keswa_stakes_chk
    CHECK (keswa_stakes IS NULL OR keswa_stakes IN ('J1','J2','J4'));
ALTER TABLE public.exam_psychology
  ADD CONSTRAINT exam_psychology_keswa_classification_chk
    CHECK (keswa_classification IS NULL OR keswa_classification IN ('B','C','K2'));
ALTER TABLE public.exam_psychology
  ADD CONSTRAINT exam_psychology_keswa_result_status_chk
    CHECK (keswa_result_status IS NULL OR keswa_result_status IN ('MS','TMS'));

-- Validation trigger: enforce STAKES coherence on submit/approve/lock
CREATE OR REPLACE FUNCTION public.validate_keswa_stakes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('Submitted','Approved','Locked') THEN
    IF NEW.keswa_stakes IS NULL THEN
      RAISE EXCEPTION 'STAKES Keswa wajib diisi saat submit.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.keswa_stakes NOT IN ('J1','J2','J4') THEN
      RAISE EXCEPTION 'STAKES Keswa tidak valid.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.keswa_stakes = 'J1' AND (NEW.keswa_classification <> 'B' OR NEW.keswa_result_status <> 'MS') THEN
      RAISE EXCEPTION 'STAKES J1 harus berklasifikasi B dengan status MS.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.keswa_stakes = 'J2' AND (NEW.keswa_classification <> 'C' OR NEW.keswa_result_status <> 'MS') THEN
      RAISE EXCEPTION 'STAKES J2 harus berklasifikasi C dengan status MS.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.keswa_stakes = 'J4' AND (NEW.keswa_classification <> 'K2' OR NEW.keswa_result_status <> 'TMS') THEN
      RAISE EXCEPTION 'STAKES J4 harus berklasifikasi K2 dengan status TMS.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.keswa_stakes = 'J4' AND (NEW.keswa_conclusion IS NULL OR position('TMS' in upper(NEW.keswa_conclusion)) = 0) THEN
      RAISE EXCEPTION 'Kesimpulan Keswa untuk STAKES J4 wajib mengandung TMS.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_keswa_stakes ON public.exam_psychology;
CREATE TRIGGER trg_validate_keswa_stakes
  BEFORE INSERT OR UPDATE ON public.exam_psychology
  FOR EACH ROW EXECUTE FUNCTION public.validate_keswa_stakes();

-- Audit trigger: log post-submit changes
CREATE OR REPLACE FUNCTION public.audit_keswa_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_changed jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.status,'Draft') IN ('Submitted','Approved','Locked') THEN
    IF NEW.keswa_stakes IS DISTINCT FROM OLD.keswa_stakes THEN
      v_changed := v_changed || jsonb_build_object('keswa_stakes', jsonb_build_object('old', OLD.keswa_stakes, 'new', NEW.keswa_stakes));
    END IF;
    IF NEW.keswa_classification IS DISTINCT FROM OLD.keswa_classification THEN
      v_changed := v_changed || jsonb_build_object('keswa_classification', jsonb_build_object('old', OLD.keswa_classification, 'new', NEW.keswa_classification));
    END IF;
    IF NEW.keswa_result_status IS DISTINCT FROM OLD.keswa_result_status THEN
      v_changed := v_changed || jsonb_build_object('keswa_result_status', jsonb_build_object('old', OLD.keswa_result_status, 'new', NEW.keswa_result_status));
    END IF;
    IF NEW.keswa_diagnosis IS DISTINCT FROM OLD.keswa_diagnosis THEN
      v_changed := v_changed || jsonb_build_object('keswa_diagnosis', jsonb_build_object('old', OLD.keswa_diagnosis, 'new', NEW.keswa_diagnosis));
    END IF;
    IF NEW.keswa_conclusion IS DISTINCT FROM OLD.keswa_conclusion THEN
      v_changed := v_changed || jsonb_build_object('keswa_conclusion', jsonb_build_object('old', OLD.keswa_conclusion, 'new', NEW.keswa_conclusion));
    END IF;
    IF v_changed <> '{}'::jsonb THEN
      INSERT INTO public.audit_logs (user_id, action, module, record_id, candidate_id, after_data)
      VALUES (v_uid, 'keswa_post_submit_change', 'KESWA', NEW.id, NEW.candidate_id, v_changed);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_keswa_change ON public.exam_psychology;
CREATE TRIGGER trg_audit_keswa_change
  AFTER UPDATE ON public.exam_psychology
  FOR EACH ROW EXECUTE FUNCTION public.audit_keswa_changes();
