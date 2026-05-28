-- Fix RLS and ownership checks for selections inserts/updates
ALTER TABLE public.selections ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.selections
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DROP POLICY IF EXISTS "Allow authenticated users to read selections" ON public.selections;
DROP POLICY IF EXISTS "Allow authenticated users to insert selections" ON public.selections;
DROP POLICY IF EXISTS "Allow authenticated users to update selections" ON public.selections;
DROP POLICY IF EXISTS "Allow users to insert own selections" ON public.selections;
DROP POLICY IF EXISTS "Authenticated users can read selections" ON public.selections;
DROP POLICY IF EXISTS "Only admin can insert selections" ON public.selections;
DROP POLICY IF EXISTS "Only admin can update selections" ON public.selections;

CREATE POLICY "Authenticated users can read selections"
ON public.selections
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid())
);

CREATE POLICY "Only admin can insert selections"
ON public.selections
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('super_admin', 'admin')
  )
);

CREATE POLICY "Only admin can update selections"
ON public.selections
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('super_admin', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('super_admin', 'admin')
  )
);
