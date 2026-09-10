-- Le linter Supabase (multiple_permissive_policies) signalait 9 tables où une
-- policy de lecture (can_read_group) et une policy de gestion "for all"
-- (authorized_for_group, admin/responsable) coexistent : pour un SELECT,
-- Postgres évalue et combine les deux à chaque requête au lieu d'une seule.
--
-- Pour ces 7 tables scopées par groupe, authorized_for_group(g, roles) implique
-- toujours can_read_group(g) : son premier cas (groupe_id = g et rôle autorisé)
-- entraîne groupe_id = g, et son second cas (acces_global et rôle superviseur)
-- entraîne l'un des rôles couverts par can_read_group. La policy de gestion
-- n'ajoute donc jamais de ligne visible en SELECT au-delà de la policy de
-- lecture : on la restreint à insert/update/delete, sans aucun changement
-- d'accès (même schéma déjà utilisé pour controles_vgp dans la migration
-- précédente).

-- camions
drop policy if exists managers_manage_trucks on public.camions;

create policy managers_insert_trucks on public.camions as permissive for insert to authenticated
  with check (( select private.authorized_for_group(camions.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

create policy managers_update_trucks on public.camions as permissive for update to authenticated
  using (( select private.authorized_for_group(camions.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group))
  with check (( select private.authorized_for_group(camions.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

create policy managers_delete_trucks on public.camions as permissive for delete to authenticated
  using (( select private.authorized_for_group(camions.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

-- commandes_fournisseurs
drop policy if exists managers_manage_orders on public.commandes_fournisseurs;

create policy managers_insert_orders on public.commandes_fournisseurs as permissive for insert to authenticated
  with check (( select private.authorized_for_group(commandes_fournisseurs.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

create policy managers_update_orders on public.commandes_fournisseurs as permissive for update to authenticated
  using (( select private.authorized_for_group(commandes_fournisseurs.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group))
  with check (( select private.authorized_for_group(commandes_fournisseurs.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

create policy managers_delete_orders on public.commandes_fournisseurs as permissive for delete to authenticated
  using (( select private.authorized_for_group(commandes_fournisseurs.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

-- emplacements_stock
drop policy if exists managers_manage_locations on public.emplacements_stock;

create policy managers_insert_locations on public.emplacements_stock as permissive for insert to authenticated
  with check (( select private.authorized_for_group(emplacements_stock.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

create policy managers_update_locations on public.emplacements_stock as permissive for update to authenticated
  using (( select private.authorized_for_group(emplacements_stock.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group))
  with check (( select private.authorized_for_group(emplacements_stock.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

create policy managers_delete_locations on public.emplacements_stock as permissive for delete to authenticated
  using (( select private.authorized_for_group(emplacements_stock.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

-- fournisseurs
drop policy if exists managers_manage_suppliers on public.fournisseurs;

create policy managers_insert_suppliers on public.fournisseurs as permissive for insert to authenticated
  with check (( select private.authorized_for_group(fournisseurs.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

create policy managers_update_suppliers on public.fournisseurs as permissive for update to authenticated
  using (( select private.authorized_for_group(fournisseurs.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group))
  with check (( select private.authorized_for_group(fournisseurs.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

create policy managers_delete_suppliers on public.fournisseurs as permissive for delete to authenticated
  using (( select private.authorized_for_group(fournisseurs.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

-- groupes (admin seul, pas responsable)
drop policy if exists managers_manage_group on public.groupes;

create policy managers_insert_group on public.groupes as permissive for insert to authenticated
  with check (( select private.authorized_for_group(groupes.id, array['admin'::user_role]) as authorized_for_group));

create policy managers_update_group on public.groupes as permissive for update to authenticated
  using (( select private.authorized_for_group(groupes.id, array['admin'::user_role]) as authorized_for_group))
  with check (( select private.authorized_for_group(groupes.id, array['admin'::user_role]) as authorized_for_group));

create policy managers_delete_group on public.groupes as permissive for delete to authenticated
  using (( select private.authorized_for_group(groupes.id, array['admin'::user_role]) as authorized_for_group));

-- lignes_commande (scopée via la commande parente)
drop policy if exists managers_manage_order_lines on public.lignes_commande;

create policy managers_insert_order_lines on public.lignes_commande as permissive for insert to authenticated
  with check (
    exists (
      select 1 from public.commandes_fournisseurs c
      where c.id = lignes_commande.commande_id
        and ( select private.authorized_for_group(c.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group)
    )
  );

create policy managers_update_order_lines on public.lignes_commande as permissive for update to authenticated
  using (
    exists (
      select 1 from public.commandes_fournisseurs c
      where c.id = lignes_commande.commande_id
        and ( select private.authorized_for_group(c.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group)
    )
  )
  with check (
    exists (
      select 1 from public.commandes_fournisseurs c
      where c.id = lignes_commande.commande_id
        and ( select private.authorized_for_group(c.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group)
    )
  );

create policy managers_delete_order_lines on public.lignes_commande as permissive for delete to authenticated
  using (
    exists (
      select 1 from public.commandes_fournisseurs c
      where c.id = lignes_commande.commande_id
        and ( select private.authorized_for_group(c.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group)
    )
  );

-- stocks
drop policy if exists managers_manage_stocks on public.stocks;

create policy managers_insert_stocks on public.stocks as permissive for insert to authenticated
  with check (( select private.authorized_for_group(stocks.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

create policy managers_update_stocks on public.stocks as permissive for update to authenticated
  using (( select private.authorized_for_group(stocks.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group))
  with check (( select private.authorized_for_group(stocks.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

create policy managers_delete_stocks on public.stocks as permissive for delete to authenticated
  using (( select private.authorized_for_group(stocks.groupe_id, array['admin'::user_role, 'responsable'::user_role]) as authorized_for_group));

-- materiels : la policy de gestion couvre aussi les fiches inactives
-- (materiels.actif = false), que la policy de lecture exclut explicitement.
-- Elle n'est donc pas un sous-ensemble de la lecture ici : on fusionne les deux
-- conditions par OR dans une policy de lecture unique, au lieu de simplement
-- retirer le SELECT de la policy de gestion (ce qui aurait empêché les
-- gestionnaires de voir les fiches désactivées).
drop policy if exists managers_manage_materials on public.materiels;
drop policy if exists active_materials_for_authorized_users_read on public.materiels;

create policy materiels_read on public.materiels as permissive for select to authenticated
  using (
    (materiels.actif and ( select private.authorized_any_group(array['admin'::user_role, 'responsable'::user_role, 'lecture'::user_role, 'superviseur'::user_role]) as authorized_any_group))
    or ( select private.authorized_any_group(array['admin'::user_role, 'responsable'::user_role]) as authorized_any_group)
  );

create policy managers_insert_materials on public.materiels as permissive for insert to authenticated
  with check (( select private.authorized_any_group(array['admin'::user_role, 'responsable'::user_role]) as authorized_any_group));

create policy managers_update_materials on public.materiels as permissive for update to authenticated
  using (( select private.authorized_any_group(array['admin'::user_role, 'responsable'::user_role]) as authorized_any_group))
  with check (( select private.authorized_any_group(array['admin'::user_role, 'responsable'::user_role]) as authorized_any_group));

create policy managers_delete_materials on public.materiels as permissive for delete to authenticated
  using (( select private.authorized_any_group(array['admin'::user_role, 'responsable'::user_role]) as authorized_any_group));

-- profils : deux policies SELECT distinctes (son propre profil / les admins sur
-- leur groupe) fusionnées en une seule policy à condition combinée par OR.
drop policy if exists admins_read_group_profiles on public.profils;
drop policy if exists own_profile_read on public.profils;

create policy profils_read on public.profils as permissive for select to authenticated
  using (
    profils.id = ( select auth.uid())
    or ( select private.authorized_for_group(profils.groupe_id, array['admin'::user_role]) as authorized_for_group)
  );
