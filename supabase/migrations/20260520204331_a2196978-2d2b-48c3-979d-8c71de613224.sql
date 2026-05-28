
-- 1. Hide soft-deleted candidates dari role non-admin
DROP POLICY IF EXISTS candidates_select_auth ON public.candidates;

CREATE POLICY candidates_select_active_or_admin
ON public.candidates
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  OR public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
);

-- 2. Trigger guard: cegah non-admin mengubah kolom soft-delete
CREATE OR REPLACE FUNCTION public.guard_candidate_soft_delete_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]) THEN
    IF (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at)
       OR (NEW.deleted_by IS DISTINCT FROM OLD.deleted_by)
       OR (NEW.delete_reason IS DISTINCT FROM OLD.delete_reason) THEN
      RAISE EXCEPTION 'Hanya admin/super_admin yang dapat mengubah kolom soft-delete (deleted_at, deleted_by, delete_reason)'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_candidate_soft_delete_cols ON public.candidates;
CREATE TRIGGER trg_guard_candidate_soft_delete_cols
BEFORE UPDATE ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.guard_candidate_soft_delete_cols();
