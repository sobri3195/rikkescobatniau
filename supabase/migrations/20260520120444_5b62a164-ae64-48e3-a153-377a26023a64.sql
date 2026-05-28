
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS test_number_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS test_number_assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS test_number_notes text;

CREATE UNIQUE INDEX IF NOT EXISTS candidates_test_number_per_selection_uidx
  ON public.candidates (selection_id, test_number)
  WHERE test_number IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.candidate_merge_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  duplicate_candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  merged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  merge_reason text,
  before_data jsonb,
  after_data jsonb,
  merged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_merge_logs_primary ON public.candidate_merge_logs(primary_candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_merge_logs_duplicate ON public.candidate_merge_logs(duplicate_candidate_id);

ALTER TABLE public.candidate_merge_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view merge logs"
  ON public.candidate_merge_logs FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','viewer']::app_role[]));

CREATE POLICY "Admins can insert merge logs"
  ON public.candidate_merge_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]));
