-- Helper: cek apakah user adalah staff umum (boleh tulis semua section)
CREATE OR REPLACE FUNCTION public.is_general_writer(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_any_role(_user_id, ARRAY[
    'super_admin'::app_role, 'admin'::app_role, 'tester'::app_role,
    'dokter'::app_role, 'kepala_sub_tim'::app_role, 'registrasi'::app_role
  ])
$$;

-- ============ EXAM_ENT (section: tht) ============
DROP POLICY IF EXISTS exam_ent_staff_write ON public.exam_ent;
CREATE POLICY exam_ent_staff_write ON public.exam_ent
  FOR ALL TO authenticated
  USING (public.is_general_writer(auth.uid()) OR public.user_has_section(auth.uid(), 'tht', 'update'))
  WITH CHECK (public.is_general_writer(auth.uid()) OR public.user_has_section(auth.uid(), 'tht', 'update'));

-- ============ EXAM_EYE & EXAM_EYE_VISION (section: mata) ============
DROP POLICY IF EXISTS exam_eye_staff_write ON public.exam_eye;
CREATE POLICY exam_eye_staff_write ON public.exam_eye
  FOR ALL TO authenticated
  USING (public.is_general_writer(auth.uid()) OR public.user_has_section(auth.uid(), 'mata', 'update'))
  WITH CHECK (public.is_general_writer(auth.uid()) OR public.user_has_section(auth.uid(), 'mata', 'update'));

DROP POLICY IF EXISTS exam_eye_vis_staff_write ON public.exam_eye_vision;
CREATE POLICY exam_eye_vis_staff_write ON public.exam_eye_vision
  FOR ALL TO authenticated
  USING (public.is_general_writer(auth.uid()) OR public.user_has_section(auth.uid(), 'mata', 'update'))
  WITH CHECK (public.is_general_writer(auth.uid()) OR public.user_has_section(auth.uid(), 'mata', 'update'));

-- ============ EXAM_NEUROLOGY (section: neurologi) ============
DROP POLICY IF EXISTS exam_neuro_staff_write ON public.exam_neurology;
CREATE POLICY exam_neuro_staff_write ON public.exam_neurology
  FOR ALL TO authenticated
  USING (public.is_general_writer(auth.uid()) OR public.user_has_section(auth.uid(), 'neurologi', 'update'))
  WITH CHECK (public.is_general_writer(auth.uid()) OR public.user_has_section(auth.uid(), 'neurologi', 'update'));

-- ============ EXAM_SURGERY (section: bedah) ============
DROP POLICY IF EXISTS exam_surgery_staff_write ON public.exam_surgery;
CREATE POLICY exam_surgery_staff_write ON public.exam_surgery
  FOR ALL TO authenticated
  USING (public.is_general_writer(auth.uid()) OR public.user_has_section(auth.uid(), 'bedah', 'update'))
  WITH CHECK (public.is_general_writer(auth.uid()) OR public.user_has_section(auth.uid(), 'bedah', 'update'));

-- ============ EXAM_CARDIOLOGY (section: ekg_ergo) ============
DROP POLICY IF EXISTS exam_cardiology_staff_write ON public.exam_cardiology;
CREATE POLICY exam_cardiology_staff_write ON public.exam_cardiology
  FOR ALL TO authenticated
  USING (public.is_general_writer(auth.uid()) OR public.user_has_section(auth.uid(), 'ekg_ergo', 'update'))
  WITH CHECK (public.is_general_writer(auth.uid()) OR public.user_has_section(auth.uid(), 'ekg_ergo', 'update'));

-- ============ EXAM_RADIOLOGY (section: radiologi_ro) — role radiologi juga boleh ============
DROP POLICY IF EXISTS exam_radiology_staff_write ON public.exam_radiology;
CREATE POLICY exam_radiology_staff_write ON public.exam_radiology
  FOR ALL TO authenticated
  USING (
    public.is_general_writer(auth.uid())
    OR public.has_role(auth.uid(), 'radiologi'::app_role)
    OR public.user_has_section(auth.uid(), 'radiologi_ro', 'update')
  )
  WITH CHECK (
    public.is_general_writer(auth.uid())
    OR public.has_role(auth.uid(), 'radiologi'::app_role)
    OR public.user_has_section(auth.uid(), 'radiologi_ro', 'update')
  );

-- ============ EXAM_USG (section: usg) — role radiologi juga boleh ============
DROP POLICY IF EXISTS exam_usg_staff_write ON public.exam_usg;
CREATE POLICY exam_usg_staff_write ON public.exam_usg
  FOR ALL TO authenticated
  USING (
    public.is_general_writer(auth.uid())
    OR public.has_role(auth.uid(), 'radiologi'::app_role)
    OR public.user_has_section(auth.uid(), 'usg', 'update')
  )
  WITH CHECK (
    public.is_general_writer(auth.uid())
    OR public.has_role(auth.uid(), 'radiologi'::app_role)
    OR public.user_has_section(auth.uid(), 'usg', 'update')
  );

-- ============ EXAM_LAB (section: laboratorium) — role lab juga boleh ============
DROP POLICY IF EXISTS exam_lab_staff_write ON public.exam_lab;
CREATE POLICY exam_lab_staff_write ON public.exam_lab
  FOR ALL TO authenticated
  USING (
    public.is_general_writer(auth.uid())
    OR public.has_role(auth.uid(), 'lab'::app_role)
    OR public.user_has_section(auth.uid(), 'laboratorium', 'update')
  )
  WITH CHECK (
    public.is_general_writer(auth.uid())
    OR public.has_role(auth.uid(), 'lab'::app_role)
    OR public.user_has_section(auth.uid(), 'laboratorium', 'update')
  );

-- ============ EXAM_DENTAL & DENTAL_TOOTH_RECORDS (section: gigi) — role dokter_gigi juga boleh ============
DROP POLICY IF EXISTS exam_dental_staff_write ON public.exam_dental;
CREATE POLICY exam_dental_staff_write ON public.exam_dental
  FOR ALL TO authenticated
  USING (
    public.is_general_writer(auth.uid())
    OR public.has_role(auth.uid(), 'dokter_gigi'::app_role)
    OR public.user_has_section(auth.uid(), 'gigi', 'update')
  )
  WITH CHECK (
    public.is_general_writer(auth.uid())
    OR public.has_role(auth.uid(), 'dokter_gigi'::app_role)
    OR public.user_has_section(auth.uid(), 'gigi', 'update')
  );

DROP POLICY IF EXISTS dental_tooth_records_staff_write ON public.dental_tooth_records;
CREATE POLICY dental_tooth_records_staff_write ON public.dental_tooth_records
  FOR ALL TO authenticated
  USING (
    public.is_general_writer(auth.uid())
    OR public.has_role(auth.uid(), 'dokter_gigi'::app_role)
    OR public.user_has_section(auth.uid(), 'gigi', 'update')
  )
  WITH CHECK (
    public.is_general_writer(auth.uid())
    OR public.has_role(auth.uid(), 'dokter_gigi'::app_role)
    OR public.user_has_section(auth.uid(), 'gigi', 'update')
  );

-- ============ EXAM_PSYCHOLOGY (section: jiwa_keswa) ============
DROP POLICY IF EXISTS exam_psy_staff_write ON public.exam_psychology;
CREATE POLICY exam_psy_staff_write ON public.exam_psychology
  FOR ALL TO authenticated
  USING (public.is_general_writer(auth.uid()) OR public.user_has_section(auth.uid(), 'jiwa_keswa', 'update'))
  WITH CHECK (public.is_general_writer(auth.uid()) OR public.user_has_section(auth.uid(), 'jiwa_keswa', 'update'));

-- ============ EXAM_SECTIONS: cek per-section assignment untuk spesialis ============
-- Sekarang sections_staff_write membatasi dokter umum bisa semua section,
-- tapi spesialis hanya bisa update section yang ditugaskan.
DROP POLICY IF EXISTS sections_staff_write ON public.exam_sections;
CREATE POLICY sections_staff_write ON public.exam_sections
  FOR ALL TO authenticated
  USING (
    public.is_general_writer(auth.uid())
    OR public.user_has_section(auth.uid(), section_key, 'update')
  )
  WITH CHECK (
    public.is_general_writer(auth.uid())
    OR public.user_has_section(auth.uid(), section_key, 'update')
  );
