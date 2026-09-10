import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/inviter-utilisateur.js'

function responseRecorder() {
  return {
    code: 200,
    headers: {},
    payload: null,
    setHeader(name, value) { this.headers[name] = value },
    status(code) { this.code = code; return this },
    json(payload) { this.payload = payload; return this },
  }
}

test('refuse les méthodes autres que POST', async () => {
  const response = responseRecorder()
  await handler({ method: 'GET', headers: {} }, response)
  assert.equal(response.code, 405)
  assert.equal(response.headers.Allow, 'POST')
})

test('refuse une requête sans session Supabase', async () => {
  const response = responseRecorder()
  await handler({ method: 'POST', headers: {}, body: {} }, response)
  assert.equal(response.code, 401)
  assert.equal(response.payload.error, 'Connexion requise.')
})

test('refuse un corps JSON incorrect avant tout appel externe', async () => {
  const response = responseRecorder()
  await handler({ method: 'POST', headers: { authorization: 'Bearer jeton-test' }, body: '{' }, response)
  assert.equal(response.code, 400)
  assert.equal(response.payload.error, 'Contenu de la requête invalide.')
})

test('refuse des champs invalides avant tout appel externe', async () => {
  const response = responseRecorder()
  await handler(
    { method: 'POST', headers: { authorization: 'Bearer jeton-test' }, body: { email: 'pas-un-email', nom: '', role: 'super-admin', groupe_id: '' } },
    response,
  )
  assert.equal(response.code, 400)
  assert.equal(response.payload.error, 'Champs invalides.')
})
