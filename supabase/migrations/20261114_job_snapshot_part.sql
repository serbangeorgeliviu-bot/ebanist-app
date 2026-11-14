-- D-145: instantaneul comenzii poate purta fișa piesei (`part`: cote, contur, găuri) ca să se
-- redeschidă din codul QR pe un telefon fără proiect. Aditiv: comenzile vechi rămân valide.
-- Anulare: se reface funcția fără 'part' în `allowed` și fără blocul `part` (definiția veche: vezi jos, comentat).
create or replace function public.job_snapshot_ok(p jsonb)
 returns boolean
 language plpgsql
 immutable
 set search_path to 'public'
as $function$
declare
  e jsonb; k text; pk text; seen text[] := '{}';
  allowed text[] := array['pk','modulo','elemento','role','lung','larg','sp','pz',
                          'material','decor','bordo','grain','note','part'];
begin
  if p is null or jsonb_typeof(p) <> 'object' then return false; end if;
  if octet_length(p::text) > 2000000 then return false; end if;
  for k in select jsonb_object_keys(p) loop
    if k not in ('pieces', 'meta') then return false; end if;
  end loop;
  if jsonb_typeof(p -> 'pieces') <> 'array' then return false; end if;
  if jsonb_array_length(p -> 'pieces') not between 1 and 2000 then return false; end if;
  if p ? 'meta' then
    if jsonb_typeof(p -> 'meta') <> 'object' then return false; end if;
    for k in select jsonb_object_keys(p -> 'meta') loop
      if k not in ('app_ver', 'units', 'project_name') then return false; end if;
    end loop;
  end if;
  for e in select value from jsonb_array_elements(p -> 'pieces') loop
    if jsonb_typeof(e) <> 'object' then return false; end if;
    for k in select jsonb_object_keys(e) loop
      if not (k = any (allowed)) then return false; end if;
    end loop;
    if e ? 'part' then
      if jsonb_typeof(e -> 'part') is distinct from 'object'
         or jsonb_typeof(e -> 'part' -> 'operations') is distinct from 'array'
         or octet_length((e -> 'part')::text) > 40000 then return false; end if;
    end if;
    pk := e ->> 'pk';
    if pk is null or char_length(pk) not between 1 and 80 or pk = any (seen) then return false; end if;
    seen := seen || pk;
  end loop;
  return true;
end;
$function$;
