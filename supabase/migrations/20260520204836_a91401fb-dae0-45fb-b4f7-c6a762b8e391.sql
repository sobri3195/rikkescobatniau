
-- Enable realtime broadcasts for the candidates table so the
-- duplicate-detection watcher in the app fires immediately on INSERT.
ALTER TABLE public.candidates REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'candidates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.candidates;
  END IF;
END $$;
