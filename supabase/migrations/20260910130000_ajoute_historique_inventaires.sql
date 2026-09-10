-- Le journal des comptages (private.inventaires_stock) est alimenté depuis la
-- création du projet mais jamais lu côté client : le schéma private n'est pas
-- exposé par l'API REST. On l'expose en lecture via une fonction SECURITY
-- DEFINER plutôt qu'une vue, pour appliquer can_read_group ligne par ligne
-- (contournement RLS assumé, comme pour ajuster_inventaire_stock) et joindre
-- le nom de l'article/emplacement/utilisateur en une seule fois.

create or replace function public.lister_historique_inventaires(p_groupe_id text default null, p_limit integer default 100, p_offset integer default 0)
 returns table (
   id uuid,
   groupe_id text,
   materiel_nom text,
   materiel_code text,
   emplacement_nom text,
   quantite_avant integer,
   quantite_comptee integer,
   stock_global_avant integer,
   stock_global_apres integer,
   commentaire text,
   saisi_par_nom text,
   created_at timestamp with time zone
 )
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select
    i.id, i.groupe_id, m.nom, m.code, e.nom,
    i.quantite_avant, i.quantite_comptee, i.stock_global_avant, i.stock_global_apres,
    i.commentaire, coalesce(p.nom, p.email, 'Utilisateur supprimé'), i.created_at
  from private.inventaires_stock i
  join public.materiels m on m.id = i.materiel_id
  join public.emplacements_stock e on e.id = i.emplacement_id
  left join public.profils p on p.id = i.saisi_par
  where (p_groupe_id is null or i.groupe_id = p_groupe_id)
    and private.can_read_group(i.groupe_id)
  order by i.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0)
$function$;

-- Supabase accorde EXECUTE à anon indépendamment de PUBLIC sur toute
-- nouvelle fonction (privilèges par défaut de la plateforme) : les deux
-- révocations sont nécessaires, l'une ne supplée pas l'autre.
revoke execute on function public.lister_historique_inventaires(text, integer, integer) from public, anon;
grant execute on function public.lister_historique_inventaires(text, integer, integer) to authenticated;
