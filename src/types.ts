export type Groupe = {
  id: string
  nom: string
  agence: string
  actif: boolean
}

export type Materiel = {
  id: string
  code: string
  code_barres: string | null
  nom: string
  categorie: string
  unite: string
  actif: boolean
}

export type Stock = {
  id: string
  groupe_id: string
  materiel_id: string
  quantite: number
  seuil_alerte: number
  stock_cible: number
  emplacement: string
  commentaire: string | null
  updated_at: string
  materiels: Materiel
}

export type EmplacementStock = {
  id: string
  groupe_id: string
  nom: string
  type: 'depot' | 'hs' | 'perdu'
  disponible: boolean
  actif: boolean
}

export type StockEmplacement = {
  id: string
  groupe_id: string
  materiel_id: string
  emplacement_id: string
  quantite: number
  updated_at: string
  materiels: { nom: string; code: string; unite: string }
  emplacements_stock: { nom: string; type: string; disponible: boolean }
}

export type Mouvement = {
  id: string
  groupe_id: string
  materiel_id: string
  emplacement_source_id: string | null
  emplacement_destination_id: string | null
  impact_stock: boolean
  type: string
  quantite: number
  date_heure: string
  emplacement: string | null
  commentaire: string | null
  materiels: { nom: string; code: string }
  emplacements_source: { nom: string; type: string } | null
  emplacements_destination: { nom: string; type: string } | null
}

export type Fournisseur = {
  id: string
  groupe_id: string
  nom: string
  email: string | null
  telephone: string | null
  actif: boolean
}

export type LigneCommande = {
  id: string
  materiel_id: string
  quantite_commandee: number
  quantite_recue: number
  materiels: { nom: string; code: string; unite: string }
}

export type CommandeFournisseur = {
  id: string
  groupe_id: string
  fournisseur_id: string | null
  reference: string
  statut: 'a_commander' | 'commande' | 'en_livraison' | 'recu'
  date_commande: string | null
  date_livraison_prevue: string | null
  commentaire: string | null
  created_at: string
  updated_at: string
  fournisseurs: { nom: string } | null
  lignes_commande: LigneCommande[]
}

export type Profile = {
  nom: string | null
  role: 'admin' | 'responsable' | 'superviseur' | 'lecture'
  groupe_id: string | null
  acces_global: boolean
  actif: boolean
}
