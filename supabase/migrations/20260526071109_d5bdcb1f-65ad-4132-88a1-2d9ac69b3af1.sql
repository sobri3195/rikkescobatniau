ALTER TABLE public.exam_dental
  ADD COLUMN IF NOT EXISTS classification text;

ALTER TABLE public.exam_dental
  DROP CONSTRAINT IF EXISTS exam_dental_classification_check;

ALTER TABLE public.exam_dental
  ADD CONSTRAINT exam_dental_classification_check
  CHECK (classification IS NULL OR classification IN ('B','C','K1','K2'));

-- Migrate legacy values from qualification_g if they happen to already match
UPDATE public.exam_dental
   SET classification = qualification_g
 WHERE classification IS NULL
   AND qualification_g IN ('B','C','K1','K2');