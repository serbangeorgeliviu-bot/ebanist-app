-- 20.11.2026 — întărire (advisor Supabase 0028/0029): `project_comment_author()` e funcție de trigger, nu RPC; nu trebuie să poată fi chemată prin /rest/v1/rpc.
-- APLICATĂ în producție pe 20.11.2026 (apply_migration, verificat: anon și authenticated fără EXECUTE). Triggerul continuă să meargă: executarea unui trigger nu cere EXECUTE de la cel care scrie.
-- Verificat local în test/share-rls.test.mjs după aplicare (comentariile cu autor automat merg).
revoke all on function public.project_comment_author() from public, anon, authenticated;

-- ANULARE:
--   grant execute on function public.project_comment_author() to public;
