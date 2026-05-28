
-- Unique test_number globally (excluding null / temporary placeholders / deleted)
DROP INDEX IF EXISTS public.candidates_test_number_global_uidx;
CREATE UNIQUE INDEX candidates_test_number_global_uidx
  ON public.candidates (test_number)
  WHERE test_number IS NOT NULL
    AND test_number <> ''
    AND test_number NOT LIKE 'TMP-%'
    AND deleted_at IS NULL;

-- temporary_id format validation
CREATE OR REPLACE FUNCTION public.validate_temporary_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.temporary_id IS NOT NULL AND NEW.temporary_id <> '' THEN
    IF NEW.temporary_id !~ '^TMP-[0-9]{8}-[0-9]{3,6}$' THEN
      RAISE EXCEPTION 'temporary_id format invalid: %, expected TMP-YYYYMMDD-NNN', NEW.temporary_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_temporary_id ON public.candidates;
CREATE TRIGGER trg_validate_temporary_id
BEFORE INSERT OR UPDATE OF temporary_id ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.validate_temporary_id();

-- Auto-clear temporary_id when a final test_number is assigned
CREATE OR REPLACE FUNCTION public.auto_clear_temporary_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.test_number IS NOT NULL
     AND NEW.test_number <> ''
     AND NEW.test_number NOT LIKE 'TMP-%' THEN
    NEW.temporary_id := NULL;
    IF NEW.test_number_status IS NULL OR NEW.test_number_status IN ('Belum Ada','Sementara') THEN
      NEW.test_number_status := 'Final';
    END IF;
    IF NEW.test_number_assigned_at IS NULL THEN
      NEW.test_number_assigned_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_clear_temporary_id ON public.candidates;
CREATE TRIGGER trg_auto_clear_temporary_id
BEFORE INSERT OR UPDATE OF test_number ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.auto_clear_temporary_id();
