-- Vêtements de travail (tenues haute visibilité, chaussures, pantalons) :
-- suivi de quantité comme n'importe quel article, mais volontairement sans
-- alerte de seuil — contrairement au matériel technique, une tenue en
-- rupture n'est pas une urgence opérationnelle, et forcer des seuils sur
-- des dizaines de tailles aurait juste noyé la file de travail.
--
-- alerte_active porte cette distinction par article plutôt que par nom de
-- catégorie (fragile, aurait fallu que le code connaisse la liste exacte des
-- catégories "vêtements") : le tableau de bord, les suggestions de commande
-- et le badge de statut filtrent tous sur cette colonne.

alter table public.materiels add column alerte_active boolean not null default true;

with nouveaux_materiels as (
  insert into public.materiels (code, nom, categorie, unite, actif, alerte_active)
  values
    ('chaussures-34', 'Chaussures de sécurité - taille 34', 'Chaussures', 'Paire', true, false),
    ('chaussures-35', 'Chaussures de sécurité - taille 35', 'Chaussures', 'Paire', true, false),
    ('chaussures-36', 'Chaussures de sécurité - taille 36', 'Chaussures', 'Paire', true, false),
    ('chaussures-37', 'Chaussures de sécurité - taille 37', 'Chaussures', 'Paire', true, false),
    ('chaussures-38', 'Chaussures de sécurité - taille 38', 'Chaussures', 'Paire', true, false),
    ('chaussures-39', 'Chaussures de sécurité - taille 39', 'Chaussures', 'Paire', true, false),
    ('chaussures-40', 'Chaussures de sécurité - taille 40', 'Chaussures', 'Paire', true, false),
    ('chaussures-41', 'Chaussures de sécurité - taille 41', 'Chaussures', 'Paire', true, false),
    ('chaussures-42', 'Chaussures de sécurité - taille 42', 'Chaussures', 'Paire', true, false),
    ('chaussures-43', 'Chaussures de sécurité - taille 43', 'Chaussures', 'Paire', true, false),
    ('chaussures-44', 'Chaussures de sécurité - taille 44', 'Chaussures', 'Paire', true, false),
    ('chaussures-45', 'Chaussures de sécurité - taille 45', 'Chaussures', 'Paire', true, false),
    ('chaussures-46', 'Chaussures de sécurité - taille 46', 'Chaussures', 'Paire', true, false),
    ('chaussures-47', 'Chaussures de sécurité - taille 47', 'Chaussures', 'Paire', true, false),
    ('chaussures-48', 'Chaussures de sécurité - taille 48', 'Chaussures', 'Paire', true, false),
    ('chaussures-49', 'Chaussures de sécurité - taille 49', 'Chaussures', 'Paire', true, false),
    ('chaussures-50', 'Chaussures de sécurité - taille 50', 'Chaussures', 'Paire', true, false),
    ('chaussures-51', 'Chaussures de sécurité - taille 51', 'Chaussures', 'Paire', true, false),
    ('chaussures-52', 'Chaussures de sécurité - taille 52', 'Chaussures', 'Paire', true, false),
    ('pantalon-38', 'Pantalon de travail - taille 38', 'Pantalons', 'Pièce', true, false),
    ('pantalon-40', 'Pantalon de travail - taille 40', 'Pantalons', 'Pièce', true, false),
    ('pantalon-42', 'Pantalon de travail - taille 42', 'Pantalons', 'Pièce', true, false),
    ('pantalon-44', 'Pantalon de travail - taille 44', 'Pantalons', 'Pièce', true, false),
    ('pantalon-46', 'Pantalon de travail - taille 46', 'Pantalons', 'Pièce', true, false),
    ('pantalon-48', 'Pantalon de travail - taille 48', 'Pantalons', 'Pièce', true, false),
    ('pantalon-50', 'Pantalon de travail - taille 50', 'Pantalons', 'Pièce', true, false),
    ('pantalon-52', 'Pantalon de travail - taille 52', 'Pantalons', 'Pièce', true, false),
    ('pantalon-54', 'Pantalon de travail - taille 54', 'Pantalons', 'Pièce', true, false),
    ('pantalon-56', 'Pantalon de travail - taille 56', 'Pantalons', 'Pièce', true, false),
    ('parka-s', 'Parka hiver haute visibilité - taille S', 'Vestes', 'Pièce', true, false),
    ('parka-m', 'Parka hiver haute visibilité - taille M', 'Vestes', 'Pièce', true, false),
    ('parka-l', 'Parka hiver haute visibilité - taille L', 'Vestes', 'Pièce', true, false),
    ('parka-xl', 'Parka hiver haute visibilité - taille XL', 'Vestes', 'Pièce', true, false),
    ('parka-2xl', 'Parka hiver haute visibilité - taille 2XL', 'Vestes', 'Pièce', true, false),
    ('parka-3xl', 'Parka hiver haute visibilité - taille 3XL', 'Vestes', 'Pièce', true, false),
    ('polo-s', 'Polo haute visibilité - taille S', 'Hauts', 'Pièce', true, false),
    ('polo-m', 'Polo haute visibilité - taille M', 'Hauts', 'Pièce', true, false),
    ('polo-l', 'Polo haute visibilité - taille L', 'Hauts', 'Pièce', true, false),
    ('polo-xl', 'Polo haute visibilité - taille XL', 'Hauts', 'Pièce', true, false),
    ('polo-2xl', 'Polo haute visibilité - taille 2XL', 'Hauts', 'Pièce', true, false),
    ('polo-3xl', 'Polo haute visibilité - taille 3XL', 'Hauts', 'Pièce', true, false),
    ('veste-s', 'Veste haute visibilité - taille S', 'Vestes', 'Pièce', true, false),
    ('veste-m', 'Veste haute visibilité - taille M', 'Vestes', 'Pièce', true, false),
    ('veste-l', 'Veste haute visibilité - taille L', 'Vestes', 'Pièce', true, false),
    ('veste-xl', 'Veste haute visibilité - taille XL', 'Vestes', 'Pièce', true, false),
    ('veste-2xl', 'Veste haute visibilité - taille 2XL', 'Vestes', 'Pièce', true, false),
    ('veste-3xl', 'Veste haute visibilité - taille 3XL', 'Vestes', 'Pièce', true, false)
  on conflict (code) do nothing
  returning id, code
)
insert into public.stocks (groupe_id, materiel_id, quantite, seuil_alerte, stock_cible, emplacement)
select 'TEST', nm.id, v.quantite, v.seuil_alerte, v.stock_cible, 'Dépôt de test'
from nouveaux_materiels nm
join (values
    ('chaussures-34', 0, 1, 2),
    ('chaussures-35', 0, 1, 2),
    ('chaussures-36', 0, 1, 2),
    ('chaussures-37', 0, 1, 2),
    ('chaussures-38', 0, 1, 2),
    ('chaussures-39', 0, 1, 2),
    ('chaussures-40', 0, 1, 2),
    ('chaussures-41', 0, 1, 2),
    ('chaussures-42', 0, 1, 2),
    ('chaussures-43', 0, 1, 2),
    ('chaussures-44', 0, 1, 2),
    ('chaussures-45', 0, 1, 2),
    ('chaussures-46', 0, 1, 2),
    ('chaussures-47', 0, 1, 2),
    ('chaussures-48', 0, 1, 2),
    ('chaussures-49', 0, 1, 2),
    ('chaussures-50', 0, 1, 2),
    ('chaussures-51', 0, 1, 2),
    ('chaussures-52', 0, 1, 2),
    ('pantalon-38', 0, 1, 2),
    ('pantalon-40', 0, 1, 2),
    ('pantalon-42', 0, 1, 2),
    ('pantalon-44', 0, 1, 2),
    ('pantalon-46', 0, 1, 2),
    ('pantalon-48', 0, 1, 2),
    ('pantalon-50', 0, 1, 2),
    ('pantalon-52', 0, 1, 2),
    ('pantalon-54', 0, 1, 2),
    ('pantalon-56', 0, 1, 2),
    ('parka-s', 0, 1, 2),
    ('parka-m', 0, 1, 2),
    ('parka-l', 0, 1, 2),
    ('parka-xl', 0, 1, 2),
    ('parka-2xl', 0, 1, 2),
    ('parka-3xl', 0, 1, 2),
    ('polo-s', 0, 1, 2),
    ('polo-m', 3, 1, 2),
    ('polo-l', 0, 1, 2),
    ('polo-xl', 9, 0, 2),
    ('polo-2xl', 0, 1, 2),
    ('polo-3xl', 0, 1, 2),
    ('veste-s', 0, 1, 2),
    ('veste-m', 0, 1, 2),
    ('veste-l', 0, 1, 2),
    ('veste-xl', 0, 1, 2),
    ('veste-2xl', 0, 1, 2),
    ('veste-3xl', 0, 1, 2)
) as v(code, quantite, seuil_alerte, stock_cible) on v.code = nm.code
on conflict (groupe_id, materiel_id) do nothing;

insert into public.stocks_emplacements (groupe_id, materiel_id, emplacement_id, quantite)
select 'TEST', m.id, 'b5dbe3ee-6a89-4628-8cd8-de1fbe3f871c', v.quantite
from public.materiels m
join (values
    ('chaussures-34', 0),
    ('chaussures-35', 0),
    ('chaussures-36', 0),
    ('chaussures-37', 0),
    ('chaussures-38', 0),
    ('chaussures-39', 0),
    ('chaussures-40', 0),
    ('chaussures-41', 0),
    ('chaussures-42', 0),
    ('chaussures-43', 0),
    ('chaussures-44', 0),
    ('chaussures-45', 0),
    ('chaussures-46', 0),
    ('chaussures-47', 0),
    ('chaussures-48', 0),
    ('chaussures-49', 0),
    ('chaussures-50', 0),
    ('chaussures-51', 0),
    ('chaussures-52', 0),
    ('pantalon-38', 0),
    ('pantalon-40', 0),
    ('pantalon-42', 0),
    ('pantalon-44', 0),
    ('pantalon-46', 0),
    ('pantalon-48', 0),
    ('pantalon-50', 0),
    ('pantalon-52', 0),
    ('pantalon-54', 0),
    ('pantalon-56', 0),
    ('parka-s', 0),
    ('parka-m', 0),
    ('parka-l', 0),
    ('parka-xl', 0),
    ('parka-2xl', 0),
    ('parka-3xl', 0),
    ('polo-s', 0),
    ('polo-m', 3),
    ('polo-l', 0),
    ('polo-xl', 9),
    ('polo-2xl', 0),
    ('polo-3xl', 0),
    ('veste-s', 0),
    ('veste-m', 0),
    ('veste-l', 0),
    ('veste-xl', 0),
    ('veste-2xl', 0),
    ('veste-3xl', 0)
) as v(code, quantite) on v.code = m.code
on conflict (groupe_id, materiel_id, emplacement_id) do nothing;
