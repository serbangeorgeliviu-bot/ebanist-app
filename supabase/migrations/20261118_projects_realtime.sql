-- 5.81.0: Realtime pe `projects`, numai ca semnal către celelalte dispozitive ale aceluiași proprietar (RLS: created_by = auth.uid()).
-- Aplicată în producție pe 18.11.2026 (migrația `projects_realtime`).
-- Anulare: alter publication supabase_realtime drop table public.projects;
alter publication supabase_realtime add table public.projects;
