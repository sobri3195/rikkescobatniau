
-- 1) Extend medical_history_forms with workflow columns
ALTER TABLE public.medical_history_forms
  ADD COLUMN IF NOT EXISTS patient_filled_by uuid,
  ADD COLUMN IF NOT EXISTS patient_filled_at timestamptz,
  ADD COLUMN IF NOT EXISTS patient_submitted_by uuid,
  ADD COLUMN IF NOT EXISTS patient_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS patient_signature_url text,
  ADD COLUMN IF NOT EXISTS patient_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS doctor_review_status text DEFAULT 'Belum Direview',
  ADD COLUMN IF NOT EXISTS doctor_review_note text,
  ADD COLUMN IF NOT EXISTS doctor_recommendation text,
  ADD COLUMN IF NOT EXISTS doctor_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS doctor_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS clarification_note text,
  ADD COLUMN IF NOT EXISTS clarification_requested_by uuid,
  ADD COLUMN IF NOT EXISTS clarification_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS clarification_resolved_by uuid,
  ADD COLUMN IF NOT EXISTS clarification_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS anamnesis_workflow_status text NOT NULL DEFAULT 'Draft Peserta',
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

UPDATE public.medical_history_forms
   SET patient_signature_url = candidate_signature_url,
       patient_signed_at = candidate_signed_at
 WHERE patient_signature_url IS NULL AND candidate_signature_url IS NOT NULL;

-- 2) Helper for RLS (IMMUTABLE, search_path fixed)
CREATE OR REPLACE FUNCTION public.is_anamnesis_patient_writable(_workflow_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _workflow_status IN ('Draft Peserta', 'Perlu Klarifikasi');
$$;

-- 3) RLS policies
DROP POLICY IF EXISTS mhf_staff_write ON public.medical_history_forms;
DROP POLICY IF EXISTS mhf_patient_update ON public.medical_history_forms;
DROP POLICY IF EXISTS mhf_patient_write ON public.medical_history_forms;

CREATE POLICY mhf_staff_write ON public.medical_history_forms
  FOR ALL TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY[
      'super_admin'::app_role, 'admin'::app_role, 'tester'::app_role,
      'dokter'::app_role, 'dokter_umum'::app_role,
      'kepala_sub_tim'::app_role, 'registrasi'::app_role
    ])
  )
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY[
      'super_admin'::app_role, 'admin'::app_role, 'tester'::app_role,
      'dokter'::app_role, 'dokter_umum'::app_role,
      'kepala_sub_tim'::app_role, 'registrasi'::app_role
    ])
  );

CREATE POLICY mhf_patient_update ON public.medical_history_forms
  FOR UPDATE TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['peserta'::app_role, 'casis'::app_role])
    AND public.is_anamnesis_patient_writable(anamnesis_workflow_status)
  )
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['peserta'::app_role, 'casis'::app_role])
    AND public.is_anamnesis_patient_writable(anamnesis_workflow_status)
  );

-- 4) Seed role_permissions
INSERT INTO public.role_permissions (role, permission_key, allowed) VALUES
  ('peserta'::app_role, 'anamnesis.patient.view', true),
  ('peserta'::app_role, 'anamnesis.patient.create', true),
  ('peserta'::app_role, 'anamnesis.patient.update', true),
  ('peserta'::app_role, 'anamnesis.patient.submit', true),
  ('peserta'::app_role, 'anamnesis.patient.sign', true),
  ('casis'::app_role, 'anamnesis.patient.view', true),
  ('casis'::app_role, 'anamnesis.patient.create', true),
  ('casis'::app_role, 'anamnesis.patient.update', true),
  ('casis'::app_role, 'anamnesis.patient.submit', true),
  ('casis'::app_role, 'anamnesis.patient.sign', true),
  ('dokter'::app_role, 'anamnesis.doctor.view', true),
  ('dokter'::app_role, 'anamnesis.doctor.review', true),
  ('dokter'::app_role, 'anamnesis.doctor.set_clear', true),
  ('dokter'::app_role, 'anamnesis.doctor.add_note', true),
  ('dokter'::app_role, 'anamnesis.doctor.request_clarification', true),
  ('dokter'::app_role, 'anamnesis.doctor.sign', true),
  ('dokter'::app_role, 'anamnesis.doctor.submit_review', true),
  ('dokter_umum'::app_role, 'anamnesis.doctor.view', true),
  ('dokter_umum'::app_role, 'anamnesis.doctor.review', true),
  ('dokter_umum'::app_role, 'anamnesis.doctor.set_clear', true),
  ('dokter_umum'::app_role, 'anamnesis.doctor.add_note', true),
  ('dokter_umum'::app_role, 'anamnesis.doctor.request_clarification', true),
  ('dokter_umum'::app_role, 'anamnesis.doctor.sign', true),
  ('dokter_umum'::app_role, 'anamnesis.doctor.submit_review', true),
  ('registrasi'::app_role, 'anamnesis.registration.view', true),
  ('registrasi'::app_role, 'anamnesis.registration.update_identity', true),
  ('admin'::app_role, 'anamnesis.admin.view', true),
  ('admin'::app_role, 'anamnesis.admin.return_to_draft', true),
  ('admin'::app_role, 'anamnesis.registration.update_identity', true),
  ('admin'::app_role, 'anamnesis.doctor.view', true),
  ('kepala_sub_tim'::app_role, 'anamnesis.admin.view', true),
  ('kepala_sub_tim'::app_role, 'anamnesis.doctor.view', true),
  ('viewer'::app_role, 'anamnesis.readonly.view', true)
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;
