DROP POLICY IF EXISTS hari_h_attachments_select ON storage.objects;
CREATE POLICY hari_h_attachments_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'hari-h-attachments' AND is_internal_staff(auth.uid()));