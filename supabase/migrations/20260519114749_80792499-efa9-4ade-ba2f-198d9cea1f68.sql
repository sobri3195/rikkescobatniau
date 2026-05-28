
-- saved_filters
CREATE TABLE IF NOT EXISTS public.saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  filter_name text NOT NULL,
  module text NOT NULL,
  filter_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sf_select_own" ON public.saved_filters FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "sf_write_own" ON public.saved_filters FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_sf_updated BEFORE UPDATE ON public.saved_filters FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- review_marks
CREATE TABLE IF NOT EXISTS public.review_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  exam_id uuid,
  marked_by uuid NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.review_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rm_select_auth" ON public.review_marks FOR SELECT TO authenticated USING (true);
CREATE POLICY "rm_staff_write" ON public.review_marks FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'kepala_sub_tim'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'kepala_sub_tim'::app_role]));
CREATE TRIGGER trg_rm_updated BEFORE UPDATE ON public.review_marks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_rm_candidate ON public.review_marks(candidate_id);
CREATE INDEX IF NOT EXISTS idx_sf_user_module ON public.saved_filters(user_id, module);
