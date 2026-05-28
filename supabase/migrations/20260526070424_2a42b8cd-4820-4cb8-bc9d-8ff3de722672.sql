ALTER TABLE public.exam_ent
  ADD COLUMN IF NOT EXISTS whisper_ad text,
  ADD COLUMN IF NOT EXISTS whisper_as text;