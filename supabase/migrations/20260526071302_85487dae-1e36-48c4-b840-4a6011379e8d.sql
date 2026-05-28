ALTER TABLE public.exam_general
  ADD COLUMN IF NOT EXISTS screening_classification text;

ALTER TABLE public.exam_general
  DROP CONSTRAINT IF EXISTS exam_general_screening_classification_check;

ALTER TABLE public.exam_general
  ADD CONSTRAINT exam_general_screening_classification_check
  CHECK (screening_classification IS NULL OR screening_classification IN ('B','C','K1','K2'));

-- Backend enforcement: cannot submit without a valid classification
CREATE OR REPLACE FUNCTION public.enforce_screening_classification_on_submit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('Submitted','Approved','Locked') THEN
    IF NEW.screening_classification IS NULL THEN
      RAISE EXCEPTION 'Klasifikasi Screening wajib dipilih.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.screening_classification NOT IN ('B','C','K1','K2') THEN
      RAISE EXCEPTION 'Klasifikasi tidak valid. Pilihan yang diperbolehkan: B, C, K1, K2.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_screening_classification ON public.exam_general;
CREATE TRIGGER trg_enforce_screening_classification
BEFORE INSERT OR UPDATE ON public.exam_general
FOR EACH ROW EXECUTE FUNCTION public.enforce_screening_classification_on_submit();