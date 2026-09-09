# Suivi de stock

Application web mobile de suivi de stock multi-dépôts : tableau de bord,
inventaire, mouvements, emplacements et commandes fournisseurs.

Les accès sont isolés par groupe (dépôt) avec les politiques RLS Supabase.
Un profil de supervision en lecture seule peut consulter la vue consolidée
et filtrer chaque groupe.

Version simplifiée : pas de suivi de flotte, de conducteurs, d'ÉPI ni de
VGP — uniquement le stock (articles, seuils, emplacements) et les
commandes fournisseurs.

## Configuration

1. Créer un nouveau projet Supabase et y appliquer `supabase/schema.sql`
   (voir `supabase/LISEZMOI.md`).
2. Copier `.env.example` vers `.env.local`.
3. Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` avec
   les valeurs du nouveau projet.
4. Installer et lancer : `pnpm install`, puis `pnpm dev`.

## Déploiement

L'application est prévue pour Render via `render.yaml` (Blueprint). Le
service web sert le build statique et l'API `/api/envoyer-commande`.

Variables à renseigner dans le dashboard Render (non versionnées) :
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `BREVO_API_KEY`, `COMMAND_EMAIL_FROM`,
`COMMAND_EMAIL_TO`. Aucune clé secrète ou `service_role` ne doit être
exposée au navigateur.
