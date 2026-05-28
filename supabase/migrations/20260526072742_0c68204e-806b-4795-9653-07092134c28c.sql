DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'pimpinan_viewer'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'pimpinan_viewer';
  END IF;
END$$;
