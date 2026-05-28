CREATE POLICY mhf_select_patient_own
ON public.medical_history_forms
FOR SELECT
TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['peserta'::app_role, 'casis'::app_role])
  AND patient_filled_by = auth.uid()
);