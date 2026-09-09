# Suivi de stock

Application web mobile de suivi de stock multi-dépôts : tableau de bord,
inventaire, mouvements, emplacements et commandes fournisseurs.

Les accès sont isolés par groupe (dépôt) avec les politiques RLS Supabase.
Un profil de supervision en lecture seule peut consulter la vue consolidée
et filtrer chaque groupe.

Version simplifiée : pas de suivi de flotte, de conducteurs, d'ÉPI ni de
VGP — uniquement le stock (articles, seuils, emplacements) et les
commandes fournisseurs.

Projet Supabase : `stock-basique` (réf. `sdlpoamevaqbokqymvsz`, région Paris).

## Configuration

1. Copier `.env.example` vers `.env.local`.
2. Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` avec
   les valeurs du projet Supabase (voir `supabase/LISEZMOI.md` pour créer
   les comptes autorisés et les groupes/dépôts).
3. Installer et lancer : `pnpm install`, puis `pnpm dev`.

## Déploiement

L'application est prévue pour Vercel : build Vite (`pnpm build`, sortie
`dist/`) et l'API `/api/envoyer-commande` comme fonction serverless
(fichiers préfixés par `_` non exposés en route).

Variables à renseigner dans le dashboard Vercel (Project Settings →
Environment Variables) : `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `BREVO_API_KEY`,
`COMMAND_EMAIL_FROM`, `COMMAND_EMAIL_TO`. Aucune clé secrète ou
`service_role` ne doit être exposée au navigateur.
