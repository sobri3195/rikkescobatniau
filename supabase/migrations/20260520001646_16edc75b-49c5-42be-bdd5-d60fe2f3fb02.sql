
-- Seed 15 akun tester RIKKES (idempotent)
DO $$
DECLARE
  v_user record;
  v_uid uuid;
  v_role public.app_role;
  v_accounts jsonb := '[
    {"email":"tester@rikkes.test","password":"Tester#2026!","name":"Tester RIKKES","roles":["tester","super_admin"]},
    {"email":"admin@rikkes.test","password":"Admin#2026!","name":"Admin RIKKES","roles":["admin"]},
    {"email":"kepala@rikkes.test","password":"Kepala#2026!","name":"Kepala Sub Tim","roles":["kepala_sub_tim"]},
    {"email":"registrasi@rikkes.test","password":"Registrasi#2026!","name":"Petugas Registrasi","roles":["registrasi"]},
    {"email":"dokter@rikkes.test","password":"Dokter#2026!","name":"Dokter Umum","roles":["dokter"]},
    {"email":"spesialis@rikkes.test","password":"Spesialis#2026!","name":"Dokter Spesialis","roles":["dokter_spesialis","dokter"]},
    {"email":"tht@rikkes.test","password":"Tht#2026!","name":"Subtim THT","roles":["dokter_spesialis","dokter"]},
    {"email":"mata@rikkes.test","password":"Mata#2026!","name":"Subtim Mata","roles":["dokter_spesialis","dokter"]},
    {"email":"bedah@rikkes.test","password":"Bedah#2026!","name":"Subtim Bedah","roles":["dokter_spesialis","dokter"]},
    {"email":"neuro@rikkes.test","password":"Neuro#2026!","name":"Subtim Neurologi","roles":["dokter_spesialis","dokter"]},
    {"email":"jantung@rikkes.test","password":"Jantung#2026!","name":"Subtim EKG/Ergo","roles":["dokter_spesialis","dokter"]},
    {"email":"gigi@rikkes.test","password":"Gigi#2026!","name":"Subtim Gigi","roles":["dokter_gigi","dokter"]},
    {"email":"radiologi@rikkes.test","password":"Radiologi#2026!","name":"Subtim Radiologi","roles":["radiologi","dokter"]},
    {"email":"lab@rikkes.test","password":"Lab#2026!","name":"Subtim Laboratorium","roles":["lab","dokter"]},
    {"email":"viewer@rikkes.test","password":"Viewer#2026!","name":"Viewer","roles":["viewer"]}
  ]'::jsonb;
BEGIN
  FOR v_user IN SELECT * FROM jsonb_array_elements(v_accounts) AS x(acc) LOOP
    DECLARE
      v_email text := v_user.acc->>'email';
      v_pw    text := v_user.acc->>'password';
      v_name  text := v_user.acc->>'name';
      v_roles jsonb := v_user.acc->'roles';
    BEGIN
      SELECT id INTO v_uid FROM auth.users WHERE email = v_email;

      IF v_uid IS NULL THEN
        v_uid := gen_random_uuid();
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at, confirmation_token, email_change,
          email_change_token_new, recovery_token
        ) VALUES (
          '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated','authenticated',
          v_email, crypt(v_pw, gen_salt('bf')),
          now(), '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('full_name', v_name),
          now(), now(), '', '', '', ''
        );

        INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
        VALUES (gen_random_uuid(), v_uid,
                jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
                'email', v_email, now(), now(), now());
      ELSE
        UPDATE auth.users
           SET encrypted_password = crypt(v_pw, gen_salt('bf')),
               email_confirmed_at = COALESCE(email_confirmed_at, now()),
               raw_user_meta_data = COALESCE(raw_user_meta_data,'{}'::jsonb) || jsonb_build_object('full_name', v_name),
               updated_at = now()
         WHERE id = v_uid;
      END IF;

      -- Ensure profile exists
      INSERT INTO public.profiles (auth_user_id, full_name, email)
      VALUES (v_uid, v_name, v_email)
      ON CONFLICT (auth_user_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

      -- Sync roles: hapus role lama, set sesuai daftar
      DELETE FROM public.user_roles WHERE user_id = v_uid;
      FOR v_role IN SELECT (jsonb_array_elements_text(v_roles))::public.app_role LOOP
        INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, v_role)
        ON CONFLICT (user_id, role) DO NOTHING;
      END LOOP;
    END;
  END LOOP;
END $$;
