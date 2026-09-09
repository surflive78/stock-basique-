-- Ajoute le suivi des camions et des contrôles VGP (véhicule uniquement,
-- sans conducteurs ni ÉPI — hors du périmètre de cette version basique).

create table if not exists public.camions (
  id uuid default gen_random_uuid() not null,
  groupe_id text not null,
  immatriculation text not null,
  agence text not null,
  statut text default 'Actif'::text not null,
  commentaire text,
  est_camion_grue boolean default false not null,
  racine_vehicule text,
  type_vehicule text,
  loueur text,
  created_at timestamp with time zone default now() not null
);
alter table public.camions add constraint camions_pkey primary key (id);
alter table public.camions add constraint camions_immatriculation_key unique (immatriculation);
alter table public.camions add constraint camions_groupe_id_fkey foreign key (groupe_id) references groupes(id) on delete restrict;

create table if not exists public.controles_vgp (
  id uuid default gen_random_uuid() not null,
  groupe_id text not null,
  camion_id uuid not null,
  controle_type text default 'VGP'::text not null,
  date_controle date,
  date_echeance date not null,
  organisme text,
  resultat text default 'Valide'::text not null,
  commentaire text,
  saisi_par uuid,
  created_at timestamp with time zone default now() not null
);
alter table public.controles_vgp add constraint controles_vgp_pkey primary key (id);
alter table public.controles_vgp add constraint controles_vgp_groupe_id_fkey foreign key (groupe_id) references groupes(id) on delete cascade;
alter table public.controles_vgp add constraint controles_vgp_camion_id_fkey foreign key (camion_id) references camions(id) on delete cascade;
alter table public.controles_vgp add constraint controles_vgp_saisi_par_fkey foreign key (saisi_par) references auth.users(id) on delete set null;
alter table public.controles_vgp add constraint controles_vgp_controle_type_check check ((controle_type = any (array['VGP'::text, 'Mines'::text, 'Chronotachygraphe'::text, 'Limiteur'::text, 'Treuil'::text])));
alter table public.controles_vgp add constraint controles_vgp_resultat_check check ((resultat = any (array['Valide'::text, 'Avec observation'::text, 'Non conforme'::text])));
alter table public.controles_vgp add constraint controles_vgp_dates_coherentes check (((date_controle is null) or (date_echeance >= date_controle)));

create index camions_groupe_idx on public.camions using btree (groupe_id);
create index controles_vgp_groupe_echeance_idx on public.controles_vgp using btree (groupe_id, date_echeance);
create index controles_vgp_camion_idx on public.controles_vgp using btree (camion_id);
create index controles_vgp_saisi_par_idx on public.controles_vgp using btree (saisi_par) where (saisi_par is not null);

create or replace function public.enregistrer_controle_vgp_camion(p_camion_id uuid, p_controle_type text, p_date_controle date, p_date_echeance date, p_organisme text, p_resultat text, p_commentaire text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_groupe_id text;
  v_controle_id uuid;
begin
  select c.groupe_id into v_groupe_id
  from public.camions c
  where c.id = p_camion_id and c.est_camion_grue and lower(c.statut) = 'actif';

  if v_groupe_id is null then
    raise exception 'Camion-grue introuvable';
  end if;
  if not private.authorized_for_group(
    v_groupe_id,
    array['admin'::public.user_role, 'responsable'::public.user_role]
  ) then
    raise exception 'Accès refusé';
  end if;
  if p_controle_type not in ('VGP', 'Mines', 'Chronotachygraphe', 'Limiteur', 'Treuil') then
    raise exception 'Type de contrôle invalide';
  end if;
  if p_date_echeance is null or (
    p_date_controle is not null and p_date_echeance < p_date_controle
  ) then
    raise exception 'Dates de contrôle invalides';
  end if;
  if p_resultat not in ('Valide', 'Avec observation', 'Non conforme') then
    raise exception 'Résultat de contrôle invalide';
  end if;

  insert into public.controles_vgp (
    groupe_id, camion_id, controle_type,
    date_controle, date_echeance, organisme, resultat, commentaire, saisi_par
  ) values (
    v_groupe_id, p_camion_id, p_controle_type,
    p_date_controle, p_date_echeance, nullif(btrim(p_organisme), ''),
    p_resultat, nullif(btrim(p_commentaire), ''), auth.uid()
  )
  returning id into v_controle_id;

  return v_controle_id;
end;
$function$;

-- Supabase accorde EXECUTE à anon indépendamment de PUBLIC sur toute
-- nouvelle fonction (privilèges par défaut de la plateforme) : les deux
-- révocations sont nécessaires, l'une ne supplée pas l'autre.
revoke execute on function public.enregistrer_controle_vgp_camion(uuid, text, date, date, text, text, text) from public, anon;
grant execute on function public.enregistrer_controle_vgp_camion(uuid, text, date, date, text, text, text) to authenticated;

alter table public.camions enable row level security;
alter table public.controles_vgp enable row level security;

create policy accessible_group_trucks_read on public.camions as permissive for select to authenticated
  using (( select private.can_read_group(camions.groupe_id) as can_read_group));

create policy managers_manage_trucks on public.camions as permissive for all to authenticated
  using (( select private.authorized_for_group(camions.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group))
  with check (( select private.authorized_for_group(camions.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

create policy accessible_group_vgp_read on public.controles_vgp as permissive for select to authenticated
  using (( select private.can_read_group(controles_vgp.groupe_id) as can_read_group));

create policy managers_update_vgp on public.controles_vgp as permissive for update to authenticated
  using (( select private.authorized_for_group(controles_vgp.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group))
  with check (( select private.authorized_for_group(controles_vgp.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

create policy managers_delete_vgp on public.controles_vgp as permissive for delete to authenticated
  using (( select private.authorized_for_group(controles_vgp.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));
