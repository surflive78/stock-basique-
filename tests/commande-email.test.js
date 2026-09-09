import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCommandeEmail, safeCommandeFilename } from '../api/_commande-email.js'

const order = {
  id: '11111111-1111-4111-8111-111111111111',
  reference: 'CMD-001',
  commentaire: 'Livraison dépôt & accueil',
  fournisseurs: { nom: 'Fournisseur <test>' },
  lignes_commande: [{
    quantite_commandee: 12,
    materiels: { code: 'GANT-08', nom: 'Gants taille 8', unite: 'paire' },
  }],
}

test('construit un e-mail lisible et un CSV compatible Excel', () => {
  const email = buildCommandeEmail(order)
  assert.match(email.subject, /CMD-001/)
  assert.match(email.html, /Fournisseur &lt;test&gt;/)
  assert.doesNotMatch(email.html, /Fournisseur <test>/)
  assert.ok(email.csv.startsWith('﻿'))
  assert.match(email.csv, /"GANT-08";"Gants taille 8";"12";"paire"/)
})

test('nettoie le nom de la pièce jointe', () => {
  assert.equal(safeCommandeFilename('Commande Été / 01'), 'commande-ete-01')
})
