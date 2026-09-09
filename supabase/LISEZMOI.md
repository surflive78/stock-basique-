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
