-- private.autorisations_comptes ne se peuple aujourd'hui qu'à la main en SQL
-- pour chaque nouvel arrivant ou changement de groupe. Cette RPC donne à un
-- admin de groupe (ou à un superviseur à accès global, même contournement
-- que authorized_for_group) un moyen direct de pré-autoriser un compte : la
-- personne n'a plus qu'à s'inscrire elle-même avec cette adresse pour hériter
-- automatiquement du rôle et du groupe (déclencheur handle_new_user_profile,
-- inchangé).
--
-- Se limite volontairement aux invitations de groupe (acces_global toujours
-- false) : un accès global transverse à tous les groupes reste une action
-- manuelle, hors périmètre d'une invitation courante.
--
-- Met aussi à jour public.profils quand un compte existe déjà pour cette
-- adresse (mutation vers ce groupe, ou correction d'un profil resté aux
-- valeurs par défaut faute d'autorisation au moment de l'inscription — cas
-- déjà rencontré en pratique).

create or replace function public.inviter_utilisateur(p_email text, p_nom text, p_role user_role, p_groupe_id text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_email text := lower(btrim(p_email));
  v_nom text := nullif(btrim(p_nom), '');
begin
  if v_email is null or v_email = '' or position('@' in v_email) < 2 or position('.' in v_email) < 1 then
    raise exception 'Adresse e-mail invalide';
  end if;
  if v_nom is null then
    raise exception 'Le nom est obligatoire';
  end if;
  if p_groupe_id is null or btrim(p_groupe_id) = '' then
    raise exception 'Le groupe est obligatoire';
  end if;
  if p_role not in ('admin', 'responsable', 'lecture') then
    raise exception 'Rôle invalide pour une invitation de groupe';
  end if;
  if not private.authorized_for_group(p_groupe_id, array['admin'::public.user_role]) then
    raise exception 'Action non autorisée';
  end if;
  if not exists (select 1 from public.groupes g where g.id = p_groupe_id and g.actif) then
    raise exception 'Groupe invalide';
  end if;

  -- Une adresse déjà en attente pour un autre groupe ne peut pas être
  -- réaffectée par un admin qui n'administre pas ce groupe d'origine.
  if exists (
    select 1 from private.autorisations_comptes a
    where a.email = v_email and a.groupe_id is distinct from p_groupe_id
  ) then
    raise exception 'Cette adresse est déjà pré-autorisée pour un autre groupe';
  end if;

  insert into private.autorisations_comptes (email, nom, groupe_id, role, acces_global, actif)
  values (v_email, v_nom, p_groupe_id, p_role, false, true)
  on conflict (email) do update
    set nom = excluded.nom,
        role = excluded.role,
        acces_global = false,
        actif = true
    where private.autorisations_comptes.groupe_id = p_groupe_id;

  update public.profils p
  set nom = v_nom,
      groupe_id = p_groupe_id,
      role = p_role,
      acces_global = false,
      actif = true
  where p.email = v_email;
end;
$function$;

-- Supabase accorde EXECUTE à anon indépendamment de PUBLIC sur toute
-- nouvelle fonction (privilèges par défaut de la plateforme) : les deux
-- révocations sont nécessaires, l'une ne supplée pas l'autre.
revoke execute on function public.inviter_utilisateur(text, text, user_role, text) from public, anon;
grant execute on function public.inviter_utilisateur(text, text, user_role, text) to authenticated;
