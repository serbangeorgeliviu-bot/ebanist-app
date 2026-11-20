-- Scenariul cu 4 utilizatori simulați (A proprietar, B editor, C viewer, D străin) pe rolurile și politicile din migrația de partajare.
-- Fiecare rând din public.zz_res e un fapt; testul share-rls.test.mjs îl verifică. Același scenariu s-a pregătit pentru rulare în Supabase (în tranzacție anulată).
create table public.zz_res (n serial primary key, line text);
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  pid text := 'zz_share_test_' || substr(gen_random_uuid()::text, 1, 8);
  r text[] := '{}'; n int; v text; code_e text; code_v text; code_x text;
begin
  insert into auth.users (id, email) select u, 'zz_' || left(u::text, 8) || '@example.invalid' from unnest(array[a, b, c, d]) u;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true); set local role authenticated;
  insert into public.projects (id, name, data, created_by) values (pid, 'Proba partajare', '{"v":1}', a);
  r := r || ('A creează proiect: rol=' || coalesce(public.project_role_of(pid), 'null'));
  code_e := public.project_invite(pid, 'editor'); code_v := public.project_invite(pid, 'viewer'); code_x := public.project_invite(pid, 'commenter');
  r := r || ('A invită: 3 coduri, lungime ' || length(code_e));

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  v := public.project_accept(code_e); r := r || ('B acceptă (editor): ' || (v = pid)::text || ', rol=' || public.project_role_of(pid));
  begin perform public.project_accept(code_e); r := r || 'B reutilizează codul: PERMIS (GREȘIT)'::text; exception when others then r := r || ('B reutilizează codul: respins (' || sqlerrm || ')'); end;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  perform public.project_accept(code_v); r := r || ('C acceptă (viewer): rol=' || public.project_role_of(pid));
  begin perform public.project_accept(code_e); r := r || 'C folosește codul consumat de B: PERMIS (GREȘIT)'::text; exception when others then r := r || ('C cu cod consumat: respins (' || sqlerrm || ')'); end;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.projects where id = pid; r := r || ('B vede proiectul: ' || n);
  update public.projects set data = '{"v":2}' where id = pid; get diagnostics n = row_count; r := r || ('B modifică datele: ' || n || ' rând(uri)');
  update public.projects set created_by = b where id = pid; select (created_by = a)::text into v from public.projects where id = pid; r := r || ('B încearcă să-și treacă proprietatea: proprietarul rămâne A = ' || v);
  delete from public.projects where id = pid; get diagnostics n = row_count; r := r || ('B șterge proiectul: ' || n || ' rând(uri)');
  begin perform public.project_invite(pid, 'viewer'); r := r || 'B partajează mai departe: PERMIS (GREȘIT)'::text; exception when others then r := r || ('B partajează mai departe: respins (' || sqlerrm || ')'); end;
  begin insert into public.project_comments (project_id, body) values (pid, 'comentariu B'); r := r || 'B comentează: ok'::text; exception when others then r := r || ('B comentează: EROARE ' || sqlerrm); end;

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.projects where id = pid; r := r || ('C vede proiectul: ' || n);
  update public.projects set data = '{"v":3}' where id = pid; get diagnostics n = row_count; r := r || ('C modifică datele: ' || n || ' rând(uri)');
  begin insert into public.project_comments (project_id, body) values (pid, 'comentariu C'); r := r || 'C comentează: PERMIS (GREȘIT)'::text; exception when others then r := r || 'C comentează: respins (RLS)'::text; end;
  select count(*) into n from public.project_comments where project_id = pid; r := r || ('C citește comentariile: ' || n);
  select (data ->> 'v') into v from public.projects where id = pid; r := r || ('C vede v=' || v || ' (trebuie 2, de la B)');
  select count(*) into n from public.project_invites where project_id = pid; r := r || ('C (viewer) vede invitațiile proprietarului: ' || n);
  select count(*) into n from public.project_members where project_id = pid; r := r || ('C vede în project_members: ' || n || ' (doar rândul lui)');

  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  select count(*) into n from public.projects where id = pid; r := r || ('D (străin) vede proiectul: ' || n);
  select count(*) into n from public.project_comments where project_id = pid; r := r || ('D vede comentarii: ' || n);
  select count(*) into n from public.project_members where project_id = pid; r := r || ('D vede membri: ' || n);
  select count(*) into n from public.project_invites where project_id = pid; r := r || ('D vede invitații: ' || n);
  r := r || ('D rol: ' || coalesce(public.project_role_of(pid), 'null'));
  begin perform public.project_members_list(pid); r := r || 'D listează membrii: PERMIS (GREȘIT)'::text; exception when others then r := r || ('D listează membrii: respins (' || sqlerrm || ')'); end;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.project_members_list(pid); r := r || ('A listează membrii: ' || n);
  select count(*) into n from public.project_comments where project_id = pid; r := r || ('A vede comentarii: ' || n);
  perform public.project_set_role(pid, b, 'viewer');
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  update public.projects set data = '{"v":4}' where id = pid; get diagnostics n = row_count; r := r || ('B după retrogradare modifică: ' || n || ' rând(uri)');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.project_remove_member(pid, b);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.projects where id = pid; r := r || ('B scos: vede proiectul: ' || n);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  perform public.project_remove_member(pid, c); select count(*) into n from public.projects where id = pid; r := r || ('C iese singur: vede proiectul: ' || n);
  begin perform public.project_remove_member(pid, a); r := r || 'C scoate proprietarul: fără efect'::text; exception when others then r := r || 'C scoate pe altcineva: respins'::text; end;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  r := r || ('A după toate: rol=' || coalesce(public.project_role_of(pid), 'null'));

  reset role;
  insert into public.project_invites (code, project_id, role, created_by, expires_at) values ('ZZEXPIRED1', pid, 'viewer', a, now() - interval '1 day');
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform public.project_accept('zz-expired1'); r := r || 'D cu cod expirat: PERMIS (GREȘIT)'::text; exception when others then r := r || ('D cu cod expirat: respins (' || sqlerrm || ')'); end;
  begin perform public.project_accept('NUEXISTA00'); r := r || 'D cu cod inexistent: PERMIS (GREȘIT)'::text; exception when others then r := r || ('D cu cod inexistent: respins (' || sqlerrm || ')'); end;
  perform set_config('request.jwt.claims', '{}', true);
  begin perform public.project_accept('ZZEXPIRED1'); r := r || 'anonim acceptă: PERMIS (GREȘIT)'::text; exception when others then r := r || ('anonim acceptă: respins (' || sqlerrm || ')'); end;
  reset role;
  insert into public.zz_res (line) select unnest(r);
end $$;
select line from public.zz_res order by n;
