-- BUG 1: Allow peserta/casis to INSERT their own anamnesis form (first draft)
CREATE POLICY mhf_patient_insert
ON public.medical_history_forms
FOR INSERT
TO authenticated
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['peserta'::app_role, 'casis'::app_role])
  AND patient_filled_by = auth.uid()
  AND anamnesis_workflow_status = 'Draft Peserta'
);

-- BUG 2: Allow peserta UPDATE to transition into Submitted Peserta (was blocked by with_check)
DROP POLICY IF EXISTS mhf_patient_update ON public.medical_history_forms;
CREATE POLICY mhf_patient_update
ON public.medical_history_forms
FOR UPDATE
TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['peserta'::app_role, 'casis'::app_role])
  AND is_anamnesis_patient_writable(anamnesis_workflow_status)
)
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['peserta'::app_role, 'casis'::app_role])
  AND anamnesis_workflow_status IN ('Draft Peserta', 'Perlu Klarifikasi', 'Submitted Peserta')
);