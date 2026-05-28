
ALTER TABLE public.selections ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS selections_one_default_idx ON public.selections (is_default) WHERE is_default = true;
