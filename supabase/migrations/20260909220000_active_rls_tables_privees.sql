-- Active RLS sur les tables du schéma private, restées sans RLS depuis le
-- schéma initial. Ces tables ne sont pas exposées par l'API REST (schéma non
-- exposé) et ne sont modifiées que par des fonctions SECURITY DEFINER
-- possédées par le rôle postgres, qui contourne RLS en tant que propriétaire
-- de la table : aucune politique n'est donc nécessaire, seulement l'activation
-- en profondeur recommandée par Supabase.

alter table "private"."autorisations_comptes" enable row level security;
alter table "private"."inventaires_stock" enable row level security;
