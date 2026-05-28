CREATE OR REPLACE FUNCTION public.notify_clarification_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate record;
  v_target_users uuid[];
BEGIN
  IF NEW.anamnesis_workflow_status = 'Perlu Klarifikasi'
     AND (OLD.anamnesis_workflow_status IS DISTINCT FROM NEW.anamnesis_workflow_status) THEN

    SELECT c.full_name, c.test_number, c.temporary_id, c.nrp_nip,
           e.id AS exam_id, e.candidate_id
      INTO v_candidate
      FROM exams e
      JOIN candidates c ON c.id = e.candidate_id
     WHERE e.id = NEW.exam_id;

    -- Target: panitia (super_admin/admin/registrasi) + peserta/casis yang NRP/NIP-nya cocok
    SELECT array_agg(DISTINCT uid) INTO v_target_users
      FROM (
        SELECT ur.user_id AS uid
          FROM user_roles ur
         WHERE ur.role IN ('super_admin', 'admin', 'registrasi')
        UNION
        SELECT p.auth_user_id AS uid
          FROM profiles p
          JOIN user_roles ur2 ON ur2.user_id = p.auth_user_id
         WHERE ur2.role IN ('peserta', 'casis')
           AND v_candidate.nrp_nip IS NOT NULL
           AND v_candidate.nrp_nip <> ''
           AND p.nrp_nip = v_candidate.nrp_nip
      ) s;

    IF v_target_users IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, body, candidate_id, exam_id, link_url, metadata)
      SELECT unnest(v_target_users),
             'anamnesis_clarification',
             'Perlu Klarifikasi Anamnesis',
             COALESCE(v_candidate.full_name, 'Peserta') || ' (' || COALESCE(v_candidate.test_number, v_candidate.temporary_id, '—') || ') diminta klarifikasi anamnesis oleh dokter umum.',
             v_candidate.candidate_id,
             v_candidate.exam_id,
             '/rikkes/' || v_candidate.exam_id::text,
             jsonb_build_object('note', NEW.clarification_note);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;