import test from 'node:test'
import assert from 'node:assert/strict'
import { buildInviteEmail } from '../api/_invite-email.js'

test('construit un e-mail d’invitation lisible', () => {
  const email = buildInviteEmail({
    nom: 'Jean <Dupont>',
    role: 'responsable',
    groupeLabel: 'TEST — Giberville',
    appUrl: 'https://stock-basique.vercel.app',
  })
  assert.match(email.subject, /TEST — Giberville/)
  assert.match(email.html, /Jean &lt;Dupont&gt;/)
  assert.doesNotMatch(email.html, /Jean <Dupont>/)
  assert.match(email.html, /Responsable/)
  assert.match(email.html, /https:\/\/stock-basique\.vercel\.app/)
  assert.match(email.text, /Rôle : Responsable/)
})

test('retombe sur le code du rôle si inconnu', () => {
  const email = buildInviteEmail({ nom: 'Ana', role: 'mystere', groupeLabel: 'G1', appUrl: 'https://exemple.fr' })
  assert.match(email.text, /Rôle : mystere/)
})
