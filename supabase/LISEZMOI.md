# Base de données

Projet neuf : une seule migration, `migrations/20260909120000_schema_initiale.sql`,
qui crée tout le schéma (types, tables, contraintes, index, fonctions,
déclencheurs, RLS et politiques). `schema.sql` en est un instantané identique,
pratique pour relire l'état complet sans rejouer la migration.

## Mise en place sur un nouveau projet Supabase

1. `supabase login`
2. `supabase link --project-ref <votre-ref-projet>`
3. `supabase db push`

Ou, sans CLI : coller le contenu de `schema.sql` dans l'éditeur SQL du
dashboard Supabase.

## Comptes et accès

Les comptes autorisés (email, groupe, rôle) se déclarent dans
`private.autorisations_comptes` avant la première connexion : c'est cette
table que lit le déclencheur `on_auth_user_created_profile` pour créer le
profil au moment de l'inscription. Exemple :

```sql
insert into private.autorisations_comptes (email, nom, groupe_id, role, acces_global)
values ('prenom.nom@exemple.fr', 'Prénom Nom', 'G1', 'responsable', false);
```

## Données

Les données (groupes/dépôts, matériels, fournisseurs…) ne sont pas
versionnées ici : à créer via l'application ou par `insert` manuel une fois
le schéma en place.

## Faux positif attendu à l'audit de sécurité

L'advisor Supabase (lint `authenticated_security_definer_function_executable`)
remonte un WARN « Signed-In Users Can Execute SECURITY DEFINER Function »
pour :

- `ajuster_inventaire_stock`
- `creer_commande`
- `receptionner_commande`
- `enregistrer_controle_vgp_camion`
- `lister_historique_inventaires`

C'est volontaire, pas un trou de sécurité : ce sont les seules portes vers
des écritures qui touchent plusieurs tables sous une même règle de rôle
(ex. `ajuster_inventaire_stock` écrit à la fois dans `public.stocks` et dans
`private.inventaires_stock`), ou vers une lecture du schéma `private`
(`lister_historique_inventaires`) — un schéma non exposé par l'API REST et
donc hors de portée de RLS. Chaque fonction revérifie elle-même les droits
de l'appelant (`private.authorized_for_group` / `can_read_group`) avant
toute opération ; SECURITY DEFINER sert uniquement à traverser la frontière
de schéma `public` ↔ `private`, pas à contourner ces vérifications.

Ne pas « corriger » ce WARN en passant ces fonctions en `SECURITY INVOKER` :
elles perdraient l'accès au schéma `private` et cesseraient de fonctionner
pour un compte `authenticated` normal.
