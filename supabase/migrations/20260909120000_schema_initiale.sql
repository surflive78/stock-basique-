-- Schéma initial : suivi de stock multi-dépôts (inventaire, mouvements,
-- emplacements, commandes fournisseurs). Pas de suivi de flotte ni de
-- conducteurs.

-- ###### TYPES ######
create type public.mouvement_type as enum ('entree', 'sortie', 'retour', 'hs', 'perdu', 'inventaire', 'transfert');
create type public.user_role as enum ('admin', 'responsable', 'lecture', 'superviseur');

create schema if not exists private;

-- ###### TABLES ET CONTRAINTES ######
create table if not exists public.groupes (
  id text not null,
  nom text not null,
  agence text not null,
  actif boolean default true not null,
  created_at timestamp with time zone default now() not null
);
alter table public.groupes add constraint groupes_pkey primary key (id);

create table if not exists private.autorisations_comptes (
  email text not null,
  nom text not null,
  groupe_id text,
  role user_role not null,
  acces_global boolean default false not null,
  actif boolean default true not null,
  created_at timestamp with time zone default now() not null
);
alter table private.autorisations_comptes add constraint autorisations_comptes_pkey primary key (email);
alter table private.autorisations_comptes add constraint autorisations_comptes_groupe_id_fkey foreign key (groupe_id) references groupes(id) on delete restrict;
alter table private.autorisations_comptes add constraint autorisations_email_minuscule check ((email = lower(email)));
alter table private.autorisations_comptes add constraint autorisations_global_role check (((not acces_global) or ((role = any (array['lecture'::user_role, 'superviseur'::user_role])) and (groupe_id is null))));
alter table private.autorisations_comptes add constraint autorisations_groupe_requis check ((acces_global or (groupe_id is not null)));

create table if not exists public.profils (
  id uuid not null,
  nom text,
  email text,
  groupe_id text,
  role user_role default 'lecture'::user_role not null,
  actif boolean default true not null,
  created_at timestamp with time zone default now() not null,
  acces_global boolean default false not null
);
alter table public.profils add constraint profils_pkey primary key (id);
alter table public.profils add constraint profils_email_key unique (email);
alter table public.profils add constraint profils_groupe_id_fkey foreign key (groupe_id) references groupes(id) on delete set null;
alter table public.profils add constraint profils_id_fkey foreign key (id) references auth.users(id) on delete cascade;
alter table public.profils add constraint profils_acces_global_role_check check (((not acces_global) or ((role = any (array['lecture'::user_role, 'superviseur'::user_role])) and (groupe_id is null))));

create table if not exists public.materiels (
  id uuid default gen_random_uuid() not null,
  code text not null,
  nom text not null,
  categorie text not null,
  unite text default 'Pièce'::text not null,
  photo_url text,
  actif boolean default true not null,
  created_at timestamp with time zone default now() not null,
  code_barres text
);
alter table public.materiels add constraint materiels_pkey primary key (id);
alter table public.materiels add constraint materiels_code_key unique (code);

create table if not exists public.stocks (
  id uuid default gen_random_uuid() not null,
  groupe_id text not null,
  materiel_id uuid not null,
  quantite integer default 0 not null,
  seuil_alerte integer default 0 not null,
  emplacement text default 'Dépôt'::text not null,
  commentaire text,
  updated_at timestamp with time zone default now() not null,
  stock_cible integer default 1 not null
);
alter table public.stocks add constraint stocks_pkey primary key (id);
alter table public.stocks add constraint stocks_groupe_id_materiel_id_key unique (groupe_id, materiel_id);
alter table public.stocks add constraint stocks_groupe_id_fkey foreign key (groupe_id) references groupes(id) on delete restrict;
alter table public.stocks add constraint stocks_materiel_id_fkey foreign key (materiel_id) references materiels(id) on delete restrict;
alter table public.stocks add constraint stocks_quantite_check check ((quantite >= 0));
alter table public.stocks add constraint stocks_seuil_alerte_check check ((seuil_alerte >= 0));
alter table public.stocks add constraint stocks_stock_cible_check check ((stock_cible >= 0));
alter table public.stocks add constraint stocks_cible_superieure_seuil_check check ((stock_cible >= seuil_alerte));

create table if not exists public.emplacements_stock (
  id uuid default gen_random_uuid() not null,
  groupe_id text not null,
  nom text not null,
  type text not null,
  disponible boolean default true not null,
  actif boolean default true not null,
  created_at timestamp with time zone default now() not null
);
alter table public.emplacements_stock add constraint emplacements_stock_pkey primary key (id);
alter table public.emplacements_stock add constraint emplacements_stock_groupe_id_nom_key unique (groupe_id, nom);
alter table public.emplacements_stock add constraint emplacements_stock_groupe_id_fkey foreign key (groupe_id) references groupes(id) on delete cascade;
alter table public.emplacements_stock add constraint emplacements_stock_type_check check ((type = any (array['depot'::text, 'hs'::text, 'perdu'::text])));

create table if not exists public.stocks_emplacements (
  id uuid default gen_random_uuid() not null,
  groupe_id text not null,
  materiel_id uuid not null,
  emplacement_id uuid not null,
  quantite integer default 0 not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.stocks_emplacements add constraint stocks_emplacements_pkey primary key (id);
alter table public.stocks_emplacements add constraint stocks_emplacements_groupe_id_materiel_id_emplacement_id_key unique (groupe_id, materiel_id, emplacement_id);
alter table public.stocks_emplacements add constraint stocks_emplacements_groupe_id_fkey foreign key (groupe_id) references groupes(id) on delete cascade;
alter table public.stocks_emplacements add constraint stocks_emplacements_materiel_id_fkey foreign key (materiel_id) references materiels(id) on delete restrict;
alter table public.stocks_emplacements add constraint stocks_emplacements_emplacement_id_fkey foreign key (emplacement_id) references emplacements_stock(id) on delete restrict;
alter table public.stocks_emplacements add constraint stocks_emplacements_quantite_check check ((quantite >= 0));

create table if not exists private.inventaires_stock (
  id uuid default gen_random_uuid() not null,
  groupe_id text not null,
  materiel_id uuid not null,
  emplacement_id uuid not null,
  quantite_avant integer not null,
  quantite_comptee integer not null,
  stock_global_avant integer not null,
  stock_global_apres integer not null,
  commentaire text,
  saisi_par uuid not null,
  created_at timestamp with time zone default now() not null
);
alter table private.inventaires_stock add constraint inventaires_stock_pkey primary key (id);
alter table private.inventaires_stock add constraint inventaires_stock_groupe_id_fkey foreign key (groupe_id) references groupes(id);
alter table private.inventaires_stock add constraint inventaires_stock_materiel_id_fkey foreign key (materiel_id) references materiels(id);
alter table private.inventaires_stock add constraint inventaires_stock_emplacement_id_fkey foreign key (emplacement_id) references emplacements_stock(id);
alter table private.inventaires_stock add constraint inventaires_stock_saisi_par_fkey foreign key (saisi_par) references auth.users(id);
alter table private.inventaires_stock add constraint inventaires_stock_quantite_avant_check check ((quantite_avant >= 0));
alter table private.inventaires_stock add constraint inventaires_stock_quantite_comptee_check check ((quantite_comptee >= 0));
alter table private.inventaires_stock add constraint inventaires_stock_stock_global_avant_check check ((stock_global_avant >= 0));
alter table private.inventaires_stock add constraint inventaires_stock_stock_global_apres_check check ((stock_global_apres >= 0));

create table if not exists public.fournisseurs (
  id uuid default gen_random_uuid() not null,
  groupe_id text not null,
  nom text not null,
  email text,
  telephone text,
  commentaire text,
  actif boolean default true not null,
  created_at timestamp with time zone default now() not null
);
alter table public.fournisseurs add constraint fournisseurs_pkey primary key (id);
alter table public.fournisseurs add constraint fournisseurs_groupe_id_nom_key unique (groupe_id, nom);
alter table public.fournisseurs add constraint fournisseurs_groupe_id_fkey foreign key (groupe_id) references groupes(id) on delete cascade;

create table if not exists public.commandes_fournisseurs (
  id uuid default gen_random_uuid() not null,
  groupe_id text not null,
  fournisseur_id uuid,
  reference text default ((('CMD-'::text || to_char(now(), 'YYYYMMDD-HH24MISS'::text)) || '-'::text) || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 4))) not null,
  statut text default 'a_commander'::text not null,
  date_commande date,
  date_livraison_prevue date,
  commentaire text,
  cree_par uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.commandes_fournisseurs add constraint commandes_fournisseurs_pkey primary key (id);
alter table public.commandes_fournisseurs add constraint commandes_fournisseurs_groupe_id_reference_key unique (groupe_id, reference);
alter table public.commandes_fournisseurs add constraint commandes_fournisseurs_groupe_id_fkey foreign key (groupe_id) references groupes(id) on delete cascade;
alter table public.commandes_fournisseurs add constraint commandes_fournisseurs_fournisseur_id_fkey foreign key (fournisseur_id) references fournisseurs(id) on delete set null;
alter table public.commandes_fournisseurs add constraint commandes_fournisseurs_cree_par_fkey foreign key (cree_par) references auth.users(id) on delete set null;
alter table public.commandes_fournisseurs add constraint commandes_fournisseurs_statut_check check ((statut = any (array['a_commander'::text, 'commande'::text, 'en_livraison'::text, 'recu'::text])));

create table if not exists public.lignes_commande (
  id uuid default gen_random_uuid() not null,
  commande_id uuid not null,
  materiel_id uuid not null,
  quantite_commandee integer not null,
  quantite_recue integer default 0 not null,
  created_at timestamp with time zone default now() not null
);
alter table public.lignes_commande add constraint lignes_commande_pkey primary key (id);
alter table public.lignes_commande add constraint lignes_commande_commande_id_materiel_id_key unique (commande_id, materiel_id);
alter table public.lignes_commande add constraint lignes_commande_commande_id_fkey foreign key (commande_id) references commandes_fournisseurs(id) on delete cascade;
alter table public.lignes_commande add constraint lignes_commande_materiel_id_fkey foreign key (materiel_id) references materiels(id) on delete restrict;
alter table public.lignes_commande add constraint lignes_commande_quantite_commandee_check check ((quantite_commandee > 0));
alter table public.lignes_commande add constraint lignes_commande_quantite_recue_check check ((quantite_recue >= 0));

create table if not exists public.mouvements_stock (
  id uuid default gen_random_uuid() not null,
  groupe_id text not null,
  materiel_id uuid not null,
  type mouvement_type not null,
  quantite integer not null,
  emplacement text,
  commentaire text,
  saisi_par uuid,
  date_heure timestamp with time zone default now() not null,
  impact_stock boolean default true not null,
  emplacement_source_id uuid,
  emplacement_destination_id uuid
);
alter table public.mouvements_stock add constraint mouvements_stock_pkey primary key (id);
alter table public.mouvements_stock add constraint mouvements_stock_groupe_id_fkey foreign key (groupe_id) references groupes(id) on delete restrict;
alter table public.mouvements_stock add constraint mouvements_stock_materiel_id_fkey foreign key (materiel_id) references materiels(id) on delete restrict;
alter table public.mouvements_stock add constraint mouvements_stock_saisi_par_fkey foreign key (saisi_par) references auth.users(id) on delete set null;
alter table public.mouvements_stock add constraint mouvements_stock_emplacement_source_id_fkey foreign key (emplacement_source_id) references emplacements_stock(id) on delete restrict;
alter table public.mouvements_stock add constraint mouvements_stock_emplacement_destination_id_fkey foreign key (emplacement_destination_id) references emplacements_stock(id) on delete restrict;
alter table public.mouvements_stock add constraint mouvements_stock_quantite_check check (((((type)::text = 'inventaire'::text) and (quantite >= 0)) or (((type)::text <> 'inventaire'::text) and (quantite > 0))));

-- ###### INDEX ######
create index inventaires_stock_groupe_created_idx on private.inventaires_stock using btree (groupe_id, created_at desc);
create index inventaires_stock_materiel_created_idx on private.inventaires_stock using btree (materiel_id, created_at desc);
create index inventaires_stock_emplacement_idx on private.inventaires_stock using btree (emplacement_id);
create index inventaires_stock_saisi_par_idx on private.inventaires_stock using btree (saisi_par);
create index profils_groupe_idx on public.profils using btree (groupe_id);
create index stocks_groupe_idx on public.stocks using btree (groupe_id);
create index stocks_materiel_idx on public.stocks using btree (materiel_id);
create index emplacements_stock_groupe_idx on public.emplacements_stock using btree (groupe_id);
create index stocks_emplacements_groupe_idx on public.stocks_emplacements using btree (groupe_id);
create index stocks_emplacements_materiel_idx on public.stocks_emplacements using btree (materiel_id);
create index stocks_emplacements_emplacement_idx on public.stocks_emplacements using btree (emplacement_id);
create unique index materiels_code_barres_unique on public.materiels using btree (code_barres) where ((code_barres is not null) and (code_barres <> ''::text));
create index fournisseurs_groupe_idx on public.fournisseurs using btree (groupe_id);
create index commandes_fournisseurs_groupe_idx on public.commandes_fournisseurs using btree (groupe_id);
create index commandes_fournisseurs_statut_idx on public.commandes_fournisseurs using btree (groupe_id, statut);
create index commandes_fournisseurs_fournisseur_idx on public.commandes_fournisseurs using btree (fournisseur_id);
create index commandes_fournisseurs_cree_par_idx on public.commandes_fournisseurs using btree (cree_par);
create index lignes_commande_commande_idx on public.lignes_commande using btree (commande_id);
create index lignes_commande_materiel_idx on public.lignes_commande using btree (materiel_id);
create index mouvements_stock_groupe_idx on public.mouvements_stock using btree (groupe_id);
create index mouvements_stock_materiel_idx on public.mouvements_stock using btree (materiel_id);
create index mouvements_stock_date_idx on public.mouvements_stock using btree (date_heure desc);
create index mouvements_stock_saisi_par_idx on public.mouvements_stock using btree (saisi_par);
create index mouvements_stock_emplacement_source_idx on public.mouvements_stock using btree (emplacement_source_id) where (emplacement_source_id is not null);
create index mouvements_stock_emplacement_destination_idx on public.mouvements_stock using btree (emplacement_destination_id) where (emplacement_destination_id is not null);

-- ###### FONCTIONS ######
create or replace function private.authorized_any_group(allowed_roles user_role[])
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profils p
      where p.id = (select auth.uid())
        and p.actif
        and (
          p.role = any(allowed_roles)
          or (p.acces_global and p.role = 'superviseur'::public.user_role)
        )
    )
$function$;

create or replace function private.authorized_for_group(target_group text, allowed_roles user_role[])
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profils p
      where p.id = (select auth.uid())
        and p.actif
        and (
          (p.groupe_id = target_group and p.role = any(allowed_roles))
          or (p.acces_global and p.role = 'superviseur'::public.user_role)
        )
    )
$function$;

create or replace function private.can_read_group(target_group text)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profils p
      where p.id = (select auth.uid())
        and p.actif
        and (
          p.groupe_id = target_group
          or (
            p.acces_global
            and p.role in (
              'lecture'::public.user_role,
              'superviseur'::public.user_role
            )
          )
        )
    )
$function$;

create or replace function private.current_group_id()
 returns text
 language sql
 stable security definer
 set search_path to ''
as $function$
  select p.groupe_id
  from public.profils p
  where p.id = (select auth.uid()) and p.actif
  limit 1
$function$;

create or replace function private.ajuster_stock_emplacement(p_groupe_id text, p_materiel_id uuid, p_emplacement_id uuid, p_delta integer)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if p_emplacement_id is null then
    raise exception 'Un emplacement est obligatoire';
  end if;

  if not exists (
    select 1 from public.emplacements_stock e
    where e.id = p_emplacement_id
      and e.groupe_id = p_groupe_id
      and e.actif
  ) then
    raise exception 'Emplacement invalide pour ce groupe';
  end if;

  update public.stocks_emplacements
  set quantite = quantite + p_delta,
      updated_at = now()
  where groupe_id = p_groupe_id
    and materiel_id = p_materiel_id
    and emplacement_id = p_emplacement_id
    and quantite + p_delta >= 0;

  if not found then
    if p_delta < 0 then
      raise exception 'Stock insuffisant dans l''emplacement sélectionné';
    end if;

    insert into public.stocks_emplacements (
      groupe_id, materiel_id, emplacement_id, quantite
    )
    values (
      p_groupe_id, p_materiel_id, p_emplacement_id, p_delta
    )
    on conflict (groupe_id, materiel_id, emplacement_id)
    do update set
      quantite = public.stocks_emplacements.quantite + excluded.quantite,
      updated_at = now()
    where public.stocks_emplacements.quantite + excluded.quantite >= 0;

    if not found then
      raise exception 'Stock insuffisant dans l''emplacement sélectionné';
    end if;
  end if;
end;
$function$;

create or replace function private.appliquer_effet_mouvement(p_type mouvement_type, p_quantite integer, p_groupe_id text, p_materiel_id uuid, p_source_id uuid, p_destination_id uuid, p_sens integer)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_type text := p_type::text;
  v_delta_global integer := 0;
  v_source_disponible boolean;
  v_destination_disponible boolean;
  v_destination_type text;
  v_destination_id uuid := p_destination_id;
begin
  if p_sens not in (-1, 1) then
    raise exception 'Sens de mouvement invalide';
  end if;

  if v_type in ('sortie','hs','perdu','transfert') then
    select e.disponible into v_source_disponible
    from public.emplacements_stock e
    where e.id = p_source_id and e.groupe_id = p_groupe_id and e.actif;

    if coalesce(v_source_disponible, false) is false then
      raise exception 'Un emplacement source disponible est obligatoire';
    end if;
  end if;

  if v_type in ('entree','retour','transfert') then
    select e.disponible into v_destination_disponible
    from public.emplacements_stock e
    where e.id = v_destination_id and e.groupe_id = p_groupe_id and e.actif;

    if coalesce(v_destination_disponible, false) is false then
      raise exception 'Un emplacement de destination disponible est obligatoire';
    end if;
  end if;

  if v_type in ('hs','perdu') then
    if v_destination_id is null then
      select e.id into v_destination_id
      from public.emplacements_stock e
      where e.groupe_id = p_groupe_id
        and e.type = v_type
        and e.actif
      limit 1;
    end if;

    select e.type, e.disponible
    into v_destination_type, v_destination_disponible
    from public.emplacements_stock e
    where e.id = v_destination_id and e.groupe_id = p_groupe_id and e.actif;

    if v_destination_type is distinct from v_type
       or coalesce(v_destination_disponible, true) then
      raise exception 'Emplacement de destination invalide pour ce mouvement';
    end if;
  end if;

  if v_type in ('entree','retour') then
    v_delta_global := p_quantite * p_sens;
    perform private.ajuster_stock_emplacement(
      p_groupe_id, p_materiel_id, v_destination_id, p_quantite * p_sens
    );
  elsif v_type = 'sortie' then
    v_delta_global := -p_quantite * p_sens;
    perform private.ajuster_stock_emplacement(
      p_groupe_id, p_materiel_id, p_source_id, -p_quantite * p_sens
    );
  elsif v_type in ('hs','perdu') then
    v_delta_global := -p_quantite * p_sens;
    perform private.ajuster_stock_emplacement(
      p_groupe_id, p_materiel_id, p_source_id, -p_quantite * p_sens
    );
    perform private.ajuster_stock_emplacement(
      p_groupe_id, p_materiel_id, v_destination_id, p_quantite * p_sens
    );
  elsif v_type = 'transfert' then
    if p_source_id = v_destination_id then
      raise exception 'La source et la destination doivent être différentes';
    end if;
    perform private.ajuster_stock_emplacement(
      p_groupe_id, p_materiel_id, p_source_id, -p_quantite * p_sens
    );
    perform private.ajuster_stock_emplacement(
      p_groupe_id, p_materiel_id, v_destination_id, p_quantite * p_sens
    );
  else
    raise exception 'Type de mouvement non pris en charge';
  end if;

  if v_delta_global <> 0 then
    update public.stocks
    set quantite = quantite + v_delta_global,
        updated_at = now()
    where groupe_id = p_groupe_id
      and materiel_id = p_materiel_id
      and quantite + v_delta_global >= 0;

    if not found then
      raise exception 'Stock global insuffisant pour ce mouvement';
    end if;
  end if;
end;
$function$;

create or replace function public.appliquer_mouvement_stock()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_ancienne_quantite integer := 0;
  v_disponible boolean;
begin
  if not new.impact_stock then
    return new;
  end if;

  if new.type::text = 'inventaire' then
    if new.emplacement_destination_id is null then
      raise exception 'L''emplacement inventorié est obligatoire';
    end if;

    select e.disponible into v_disponible
    from public.emplacements_stock e
    where e.id = new.emplacement_destination_id
      and e.groupe_id = new.groupe_id
      and e.actif;

    if v_disponible is null then
      raise exception 'Emplacement d''inventaire invalide';
    end if;

    select se.quantite into v_ancienne_quantite
    from public.stocks_emplacements se
    where se.groupe_id = new.groupe_id
      and se.materiel_id = new.materiel_id
      and se.emplacement_id = new.emplacement_destination_id;

    v_ancienne_quantite := coalesce(v_ancienne_quantite, 0);

    insert into public.stocks_emplacements (
      groupe_id, materiel_id, emplacement_id, quantite
    )
    values (
      new.groupe_id, new.materiel_id,
      new.emplacement_destination_id, new.quantite
    )
    on conflict (groupe_id, materiel_id, emplacement_id)
    do update set quantite = excluded.quantite, updated_at = now();

    if v_disponible then
      update public.stocks
      set quantite = quantite + new.quantite - v_ancienne_quantite,
          updated_at = now()
      where groupe_id = new.groupe_id
        and materiel_id = new.materiel_id
        and quantite + new.quantite - v_ancienne_quantite >= 0;

      if not found then
        raise exception 'Inventaire incompatible avec le stock global';
      end if;
    end if;
  else
    perform private.appliquer_effet_mouvement(
      new.type, new.quantite, new.groupe_id, new.materiel_id,
      new.emplacement_source_id, new.emplacement_destination_id, 1
    );
  end if;

  return new;
end;
$function$;

create or replace function public.ajuster_inventaire_stock(p_materiel_id uuid, p_emplacement_id uuid, p_quantite_comptee integer, p_commentaire text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_groupe_id text;
  v_emplacement_nom text;
  v_quantite_avant integer := 0;
  v_stock_global_avant integer;
  v_stock_global_apres integer;
begin
  if v_user_id is null then
    raise exception 'Connexion requise';
  end if;

  if p_quantite_comptee is null or p_quantite_comptee < 0 then
    raise exception 'La quantité comptée doit être positive ou nulle';
  end if;

  select e.groupe_id, e.nom
    into v_groupe_id, v_emplacement_nom
  from public.emplacements_stock e
  where e.id = p_emplacement_id
    and e.actif
    and e.disponible;

  if not found then
    raise exception 'Emplacement d''inventaire invalide';
  end if;

  if not private.authorized_for_group(
    v_groupe_id,
    array['admin'::public.user_role, 'responsable'::public.user_role]
  ) then
    raise exception 'Vous n''êtes pas autorisé à ajuster un inventaire';
  end if;

  select s.quantite
    into v_stock_global_avant
  from public.stocks s
  where s.groupe_id = v_groupe_id
    and s.materiel_id = p_materiel_id
  for update;

  if not found then
    raise exception 'Article introuvable dans ce groupe';
  end if;

  select se.quantite
    into v_quantite_avant
  from public.stocks_emplacements se
  where se.groupe_id = v_groupe_id
    and se.materiel_id = p_materiel_id
    and se.emplacement_id = p_emplacement_id;

  v_quantite_avant := coalesce(v_quantite_avant, 0);
  v_stock_global_apres := v_stock_global_avant + p_quantite_comptee - v_quantite_avant;

  if v_stock_global_apres < 0 then
    raise exception 'Inventaire incompatible avec le stock global';
  end if;

  insert into public.stocks_emplacements (
    groupe_id, materiel_id, emplacement_id, quantite, updated_at
  )
  values (
    v_groupe_id, p_materiel_id, p_emplacement_id, p_quantite_comptee, now()
  )
  on conflict (groupe_id, materiel_id, emplacement_id)
  do update set quantite = excluded.quantite, updated_at = now();

  update public.stocks
  set quantite = v_stock_global_apres,
      updated_at = now()
  where groupe_id = v_groupe_id
    and materiel_id = p_materiel_id;

  insert into private.inventaires_stock (
    groupe_id, materiel_id, emplacement_id,
    quantite_avant, quantite_comptee,
    stock_global_avant, stock_global_apres,
    commentaire, saisi_par
  )
  values (
    v_groupe_id, p_materiel_id, p_emplacement_id,
    v_quantite_avant, p_quantite_comptee,
    v_stock_global_avant, v_stock_global_apres,
    nullif(btrim(p_commentaire), ''), v_user_id
  );

  return jsonb_build_object(
    'emplacement', v_emplacement_nom,
    'quantite_avant', v_quantite_avant,
    'quantite_comptee', p_quantite_comptee,
    'stock_global_avant', v_stock_global_avant,
    'stock_global_apres', v_stock_global_apres
  );
end;
$function$;

create or replace function public.creer_commande(p_fournisseur_nom text, p_lignes jsonb, p_commentaire text default null::text, p_groupe_id text default null::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_groupe_id text := coalesce(
    nullif(btrim(p_groupe_id), ''),
    private.current_group_id()
  );
  v_user uuid := (select auth.uid());
  v_fournisseur_id uuid;
  v_commande_id uuid;
  v_ligne jsonb;
  v_materiel_id uuid;
  v_quantite integer;
  v_nom text := nullif(btrim(p_fournisseur_nom), '');
begin
  if v_groupe_id is null or not private.authorized_for_group(
    v_groupe_id,
    array['admin'::public.user_role,'responsable'::public.user_role]
  ) then
    raise exception 'Action non autorisée';
  end if;

  if p_lignes is null
     or jsonb_typeof(p_lignes) <> 'array'
     or jsonb_array_length(p_lignes) = 0 then
    raise exception 'Sélectionnez au moins un article';
  end if;

  if v_nom is not null then
    insert into public.fournisseurs(groupe_id, nom)
    values (v_groupe_id, v_nom)
    on conflict (groupe_id, nom)
    do update set actif = true
    returning id into v_fournisseur_id;
  end if;

  insert into public.commandes_fournisseurs(
    groupe_id, fournisseur_id, commentaire, cree_par
  )
  values (
    v_groupe_id, v_fournisseur_id, nullif(btrim(p_commentaire), ''), v_user
  )
  returning id into v_commande_id;

  for v_ligne in select * from jsonb_array_elements(p_lignes)
  loop
    begin
      v_materiel_id := (v_ligne->>'materiel_id')::uuid;
      v_quantite := (v_ligne->>'quantite')::integer;
    exception when others then
      raise exception 'Ligne de commande invalide';
    end;

    if v_quantite <= 0 then
      raise exception 'La quantité commandée doit être positive';
    end if;

    if not exists (
      select 1 from public.stocks s
      where s.groupe_id = v_groupe_id
        and s.materiel_id = v_materiel_id
    ) then
      raise exception 'Article invalide pour ce groupe';
    end if;

    insert into public.lignes_commande(
      commande_id, materiel_id, quantite_commandee
    )
    values (v_commande_id, v_materiel_id, v_quantite)
    on conflict (commande_id, materiel_id)
    do update set quantite_commandee =
      public.lignes_commande.quantite_commandee + excluded.quantite_commandee;
  end loop;

  return v_commande_id;
end;
$function$;

create or replace function public.receptionner_commande(p_commande_id uuid, p_emplacement_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_commande public.commandes_fournisseurs%rowtype;
  v_ligne record;
  v_user uuid := auth.uid();
  v_nombre_lignes integer := 0;
begin
  select * into v_commande
  from public.commandes_fournisseurs
  where id = p_commande_id;

  if not found then
    raise exception 'Commande introuvable';
  end if;

  if not private.authorized_for_group(
    v_commande.groupe_id,
    array['admin'::public.user_role,'responsable'::public.user_role]
  ) then
    raise exception 'Action non autorisée';
  end if;

  if v_commande.statut = 'recu' then
    raise exception 'Cette commande est déjà réceptionnée';
  end if;

  if not exists (
    select 1 from public.emplacements_stock e
    where e.id = p_emplacement_id
      and e.groupe_id = v_commande.groupe_id
      and e.disponible
      and e.actif
  ) then
    raise exception 'Emplacement de réception invalide';
  end if;

  for v_ligne in
    select lc.*
    from public.lignes_commande lc
    where lc.commande_id = p_commande_id
  loop
    v_nombre_lignes := v_nombre_lignes + 1;

    insert into public.mouvements_stock (
      groupe_id, materiel_id, type, quantite,
      emplacement_destination_id, emplacement,
      commentaire, saisi_par
    )
    values (
      v_commande.groupe_id, v_ligne.materiel_id, 'entree',
      v_ligne.quantite_commandee, p_emplacement_id,
      'Réception fournisseur',
      'Réception de la commande ' || v_commande.reference,
      v_user
    );

    update public.lignes_commande
    set quantite_recue = quantite_commandee
    where id = v_ligne.id;
  end loop;

  if v_nombre_lignes = 0 then
    raise exception 'Cette commande ne contient aucun article';
  end if;

  update public.commandes_fournisseurs
  set statut = 'recu',
      date_commande = coalesce(date_commande, current_date),
      updated_at = now()
  where id = p_commande_id;
end;
$function$;

create or replace function public.proteger_correction_mouvement()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if new.saisi_par is distinct from old.saisi_par then
    raise exception 'L''auteur d''un mouvement ne peut pas être modifié';
  end if;

  if new.date_heure is distinct from old.date_heure then
    raise exception 'La date d''origine d''un mouvement ne peut pas être modifiée';
  end if;

  if new.impact_stock is distinct from old.impact_stock then
    raise exception 'L''impact stock d''un mouvement ne peut pas être modifié';
  end if;

  return new;
end;
$function$;

create or replace function public.recalculer_stock_apres_correction()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if old.type::text = 'inventaire' or new.type::text = 'inventaire' then
    raise exception 'Un inventaire se corrige avec un nouveau mouvement d''inventaire';
  end if;

  if not old.impact_stock then
    return new;
  end if;

  perform private.appliquer_effet_mouvement(
    old.type, old.quantite, old.groupe_id, old.materiel_id,
    old.emplacement_source_id, old.emplacement_destination_id, -1
  );

  perform private.appliquer_effet_mouvement(
    new.type, new.quantite, new.groupe_id, new.materiel_id,
    new.emplacement_source_id, new.emplacement_destination_id, 1
  );

  return new;
end;
$function$;

create or replace function public.handle_new_user_profile()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  autorisation private.autorisations_comptes%rowtype;
begin
  select *
  into autorisation
  from private.autorisations_comptes
  where email = lower(coalesce(new.email, ''))
    and actif = true;

  insert into public.profils (
    id, nom, email, groupe_id, role, acces_global, actif
  )
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      autorisation.nom,
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.email,
    autorisation.groupe_id,
    coalesce(autorisation.role, 'lecture'::public.user_role),
    coalesce(autorisation.acces_global, false),
    (autorisation.email is not null)
  )
  on conflict (id) do update
    set email = excluded.email,
        groupe_id = excluded.groupe_id,
        role = excluded.role,
        acces_global = excluded.acces_global,
        actif = excluded.actif;

  return new;
end;
$function$;

-- ###### DÉCLENCHEURS ######
create trigger trg_appliquer_mouvement_stock after insert on public.mouvements_stock for each row execute function appliquer_mouvement_stock();
create trigger trg_proteger_correction_mouvement before update on public.mouvements_stock for each row execute function proteger_correction_mouvement();
create trigger trg_recalculer_stock_apres_correction after update of groupe_id, materiel_id, type, quantite, emplacement_source_id, emplacement_destination_id on public.mouvements_stock for each row when (((old.groupe_id is distinct from new.groupe_id) or (old.materiel_id is distinct from new.materiel_id) or (old.type is distinct from new.type) or (old.quantite is distinct from new.quantite) or (old.emplacement_source_id is distinct from new.emplacement_source_id) or (old.emplacement_destination_id is distinct from new.emplacement_destination_id))) execute function recalculer_stock_apres_correction();

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function public.handle_new_user_profile();

-- ###### DROITS SUR LES FONCTIONS ######
-- Fonctions internes : jamais appelées directement par un client.
revoke execute on function public.appliquer_mouvement_stock() from public, anon, authenticated;
revoke execute on function public.proteger_correction_mouvement() from public, anon, authenticated;
revoke execute on function public.recalculer_stock_apres_correction() from public, anon, authenticated;
revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;
grant execute on function public.handle_new_user_profile() to postgres, service_role;
revoke execute on function private.ajuster_stock_emplacement(text, uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function private.appliquer_effet_mouvement(mouvement_type, integer, text, uuid, uuid, uuid, integer) from public, anon, authenticated;

-- Prédicats utilisés à l'intérieur des politiques RLS.
grant execute on function private.current_group_id() to authenticated;
grant execute on function private.authorized_for_group(text, user_role[]) to authenticated;
grant execute on function private.authorized_any_group(user_role[]) to authenticated;
grant execute on function private.can_read_group(text) to authenticated;

-- RPC appelées depuis le client. Supabase accorde EXECUTE à la fois à
-- PUBLIC et, indépendamment, à anon (privilèges par défaut de la
-- plateforme sur toute nouvelle fonction) : les deux révocations sont
-- nécessaires, l'une ne supplée pas l'autre.
revoke execute on function public.creer_commande(text, jsonb, text, text) from public, anon;
grant execute on function public.creer_commande(text, jsonb, text, text) to authenticated;
revoke execute on function public.receptionner_commande(uuid, uuid) from public, anon;
grant execute on function public.receptionner_commande(uuid, uuid) to authenticated;
revoke execute on function public.ajuster_inventaire_stock(uuid, uuid, integer, text) from public, anon;
grant execute on function public.ajuster_inventaire_stock(uuid, uuid, integer, text) to authenticated;

-- ###### ROW LEVEL SECURITY ######
alter table public.groupes enable row level security;
alter table public.profils enable row level security;
alter table public.materiels enable row level security;
alter table public.stocks enable row level security;
alter table public.stocks_emplacements enable row level security;
alter table public.emplacements_stock enable row level security;
alter table public.fournisseurs enable row level security;
alter table public.commandes_fournisseurs enable row level security;
alter table public.lignes_commande enable row level security;
alter table public.mouvements_stock enable row level security;

-- ###### POLITIQUES ######
create policy accessible_groups_read on public.groupes as permissive for select to authenticated
  using (( select private.can_read_group(groupes.id) as can_read_group));

create policy managers_manage_group on public.groupes as permissive for all to authenticated
  using (( select private.authorized_for_group(groupes.id, array['admin'::user_role]) as authorized_for_group))
  with check (( select private.authorized_for_group(groupes.id, array['admin'::user_role]) as authorized_for_group));

create policy own_profile_read on public.profils as permissive for select to authenticated
  using ((id = ( select auth.uid() as uid)));

create policy admins_read_group_profiles on public.profils as permissive for select to authenticated
  using (( select private.authorized_for_group(profils.groupe_id, array['admin'::user_role]) as authorized_for_group));

create policy active_materials_for_authorized_users_read on public.materiels as permissive for select to authenticated
  using ((actif and ( select private.authorized_any_group(array['admin'::user_role, 'responsable'::user_role, 'lecture'::user_role]) as authorized_any_group)));

create policy managers_manage_materials on public.materiels as permissive for all to authenticated
  using (( select private.authorized_any_group(array['admin'::user_role, 'responsable'::user_role]) as authorized_any_group))
  with check (( select private.authorized_any_group(array['admin'::user_role, 'responsable'::user_role]) as authorized_any_group));

create policy accessible_group_stocks_read on public.stocks as permissive for select to authenticated
  using (( select private.can_read_group(stocks.groupe_id) as can_read_group));

create policy managers_manage_stocks on public.stocks as permissive for all to authenticated
  using (( select private.authorized_for_group(stocks.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group))
  with check (( select private.authorized_for_group(stocks.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

create policy accessible_group_location_stocks_read on public.stocks_emplacements as permissive for select to authenticated
  using (( select private.can_read_group(stocks_emplacements.groupe_id) as can_read_group));

create policy accessible_group_locations_read on public.emplacements_stock as permissive for select to authenticated
  using (( select private.can_read_group(emplacements_stock.groupe_id) as can_read_group));

create policy managers_manage_locations on public.emplacements_stock as permissive for all to authenticated
  using (( select private.authorized_for_group(emplacements_stock.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group))
  with check (( select private.authorized_for_group(emplacements_stock.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

create policy accessible_group_suppliers_read on public.fournisseurs as permissive for select to authenticated
  using (( select private.can_read_group(fournisseurs.groupe_id) as can_read_group));

create policy managers_manage_suppliers on public.fournisseurs as permissive for all to authenticated
  using (( select private.authorized_for_group(fournisseurs.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group))
  with check (( select private.authorized_for_group(fournisseurs.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

create policy accessible_group_orders_read on public.commandes_fournisseurs as permissive for select to authenticated
  using (( select private.can_read_group(commandes_fournisseurs.groupe_id) as can_read_group));

create policy managers_manage_orders on public.commandes_fournisseurs as permissive for all to authenticated
  using (( select private.authorized_for_group(commandes_fournisseurs.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group))
  with check (( select private.authorized_for_group(commandes_fournisseurs.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

create policy accessible_group_order_lines_read on public.lignes_commande as permissive for select to authenticated
  using ((exists ( select 1
   from commandes_fournisseurs c
  where ((c.id = lignes_commande.commande_id) and ( select private.can_read_group(c.groupe_id) as can_read_group)))));

create policy managers_manage_order_lines on public.lignes_commande as permissive for all to authenticated
  using ((exists ( select 1
   from commandes_fournisseurs c
  where ((c.id = lignes_commande.commande_id) and ( select private.authorized_for_group(c.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group)))))
  with check ((exists ( select 1
   from commandes_fournisseurs c
  where ((c.id = lignes_commande.commande_id) and ( select private.authorized_for_group(c.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group)))));

create policy accessible_group_movements_read on public.mouvements_stock as permissive for select to authenticated
  using (( select private.can_read_group(mouvements_stock.groupe_id) as can_read_group));

create policy authorized_movement_insert on public.mouvements_stock as permissive for insert to authenticated
  with check (((saisi_par = ( select auth.uid() as uid)) and ( select private.authorized_for_group(mouvements_stock.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group)));

create policy authorized_movement_update on public.mouvements_stock as permissive for update to authenticated
  using (( select private.authorized_for_group(mouvements_stock.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group))
  with check (( select private.authorized_for_group(mouvements_stock.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));
