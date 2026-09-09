import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTasks } from '../src/lib/tasks.ts'

// Ces tests importent le vrai module — pas une copie de ses règles.

const TODAY = new Date('2026-08-31T09:00:00Z')

const base = { stocks: [], orders: [], trucks: [], controls: [] }
const run = (partial) => buildTasks({ ...base, ...partial }, TODAY)

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

const crane = (id, immatriculation) => ({
  id, groupe_id: 'G1', immatriculation, agence: 'Giberville', statut: 'Actif',
  commentaire: null, est_camion_grue: true, racine_vehicule: null, type_vehicule: 'Porteur Grue 32T', loueur: null,
})

const vgp = (camion_id, date_echeance) => ({
  id: 'c' + camion_id, groupe_id: 'G1', camion_id, controle_type: 'VGP',
  date_controle: null, date_echeance, organisme: null, resultat: 'Valide',
  commentaire: null, created_at: '2026-08-01T00:00:00Z', camions: null,
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

test('le stock et les commandes se cumulent, triés par gravité', () => {
  const out = run({
    stocks: [stock('a', 'Sangle', 0), stock('b', 'Cliquet', 90, 32)],
    orders: [order('1', 'commande')],
  })
  assert.deepEqual(out.map((t) => t.kind), ['stock', 'commande'])
  assert.equal(out[0].severity, 'critique')
})

test('les VGP dépassées passent avant les proches, la plus en retard en tête', () => {
  const out = run({
    trucks: [crane('t1', 'AA-111-AA'), crane('t2', 'BB-222-BB'), crane('t3', 'CC-333-CC')],
    controls: [vgp('t1', '2026-09-20'), vgp('t2', '2025-12-16'), vgp('t3', '2026-08-01')],
  })
  assert.deepEqual(out.map((t) => t.id), ['vgp-echue-t2', 'vgp-echue-t3', 'vgp-proche-t1'])
  assert.match(out[0].detail, /Dépassée de 258 jours/)
})

test('un camion-grue sans contrôle est signalé plutôt qu’ignoré', () => {
  const out = run({ trucks: [crane('t1', 'AA-111-AA')] })
  assert.equal(out.length, 1)
  assert.equal(out[0].id, 'vgp-manquante-t1')
})

test('un camion typé grue sans la case cochée est surveillé quand même', () => {
  const mal_saisi = { ...crane('t1', 'FG-440-BD'), est_camion_grue: false }
  const out = run({ trucks: [mal_saisi], controls: [vgp('t1', '2025-12-16')] })
  assert.equal(out[0].id, 'vgp-echue-t1')
})

test('la sécurité passe avant le stock à gravité égale', () => {
  const out = run({
    trucks: [crane('t1', 'AA-111-AA')],
    controls: [vgp('t1', '2026-09-15')],
    stocks: [stock('a', 'Sangle', 4, 5), stock('b', 'Cliquet', 90, 32)],
  })
  assert.equal(out[0].kind, 'securite')
  assert.equal(out[1].kind, 'stock')
})

test('une rupture de stock passe devant une VGP à venir', () => {
  const out = run({
    trucks: [crane('t1', 'AA-111-AA')],
    controls: [vgp('t1', '2026-09-15')],
    stocks: [stock('a', 'Sangle', 0), stock('b', 'Cliquet', 90, 32)],
  })
  assert.equal(out[0].severity, 'critique')
  assert.equal(out[0].kind, 'stock')
})

test('un périmètre sain ne produit aucune tâche', () => {
  const out = run({
    stocks: [stock('a', 'Sangle', 50, 5)],
    trucks: [crane('t1', 'AA-111-AA')],
    controls: [vgp('t1', '2027-06-01')],
  })
  assert.deepEqual(out, [])
})
