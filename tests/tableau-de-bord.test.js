import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTasks } from '../src/lib/tasks.ts'

// Ces tests importent le vrai module — pas une copie de ses règles.

const base = { stocks: [], orders: [] }
const run = (partial) => buildTasks({ ...base, ...partial })

const stock = (id, nom, quantite, seuil = 5, cible = 10) => ({
  id, groupe_id: 'G1', materiel_id: 'm' + id, quantite, seuil_alerte: seuil, stock_cible: cible,
  emplacement: 'Dépôt', commentaire: null, updated_at: '',
  materiels: { id: 'm' + id, nom, code: id, unite: 'Pièce', categorie: 'Arrimage', actif: true },
})

const order = (id, statut, fournisseur = 'ACME', lignes = 1) => ({
  id, groupe_id: 'G1', fournisseur_id: 'f1', reference: 'CMD-' + id, statut,
  date_commande: null, date_livraison_prevue: null, commentaire: null,
  created_at: '', updated_at: '', fournisseurs: { nom: fournisseur },
  lignes_commande: Array.from({ length: lignes }, (_, i) => ({
    id: 'l' + i, materiel_id: 'm' + i, quantite_commandee: 1, quantite_recue: 0,
    materiels: { nom: 'Article', code: 'A' + i, unite: 'Pièce' },
  })),
})

test('un inventaire jamais fait donne une tâche, pas dix', () => {
  const out = run({ stocks: Array.from({ length: 10 }, (_, i) => stock('s' + i, 'Article ' + i, 0)) })
  assert.equal(out.length, 1)
  assert.equal(out[0].id, 'inventaire-materiel')
  assert.equal(out[0].severity, 'critique')
  assert.equal(out[0].tab, 'stocks')
})

test('un inventaire partiel liste chaque référence en défaut', () => {
  const out = run({
    stocks: [
      stock('a', 'Gants taille 7', 0), stock('b', 'Gants taille 8', 0),
      stock('c', 'Sangle 10 m', 3, 3, 6), stock('d', 'Cliquet', 83, 32, 64), stock('e', 'Gants taille 10', 10, 5),
    ],
  })
  assert.equal(out.length, 3)
  assert.deepEqual(out.map((t) => t.severity), ['critique', 'critique', 'attention'])
  assert.match(out[0].detail, /pour revenir à la cible/)
})

test('une commande en cours ou en livraison apparaît, une commande reçue non', () => {
  const out = run({ orders: [order('1', 'commande'), order('2', 'en_livraison'), order('3', 'recu'), order('4', 'a_commander')] })
  assert.deepEqual(out.map((t) => t.id), ['commande-1', 'commande-2'])
})

test('le stock et les commandes se cumulent, triés par gravité puis par catégorie', () => {
  const out = run({
    stocks: [stock('a', 'Sangle', 0), stock('b', 'Cliquet', 90, 32)],
    orders: [order('1', 'commande')],
  })
  assert.deepEqual(out.map((t) => t.kind), ['stock', 'commande'])
  assert.equal(out[0].severity, 'critique')
})

test('un périmètre sain ne produit aucune tâche', () => {
  const out = run({ stocks: [stock('a', 'Sangle', 50, 5)] })
  assert.deepEqual(out, [])
})
