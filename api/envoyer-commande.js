import { createClient } from '@supabase/supabase-js'
import { sendBrevoEmail } from './_brevo.js'
import { buildCommandeEmail, safeCommandeFilename } from './_commande-email.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY
const COMMAND_EMAIL_TO = process.env.COMMAND_EMAIL_TO
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function json(response, status, payload) {
  response.status(status).json(payload)
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return json(response, 405, { error: 'Méthode non autorisée.' })
  }

  const authorization = request.headers.authorization || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return json(response, 401, { error: 'Connexion requise.' })

  let body
  try {
    body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body || {})
  } catch {
    return json(response, 400, { error: 'Contenu de la requête invalide.' })
  }
  const commandeId = body.commande_id
  if (!UUID_PATTERN.test(commandeId || '')) {
    return json(response, 400, { error: 'Commande invalide.' })
  }

  const from = process.env.COMMAND_EMAIL_FROM
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey || !from || !COMMAND_EMAIL_TO || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return json(response, 503, { error: 'Le service e-mail n’est pas encore configuré.' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) {
    return json(response, 401, { error: 'Session invalide ou expirée.' })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profils')
    .select('groupe_id,role,actif')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile?.actif || !['admin', 'responsable'].includes(profile.role)) {
    return json(response, 403, { error: 'Vous n’êtes pas autorisé à envoyer une commande.' })
  }

  const { data: order, error: orderError } = await supabase
    .from('commandes_fournisseurs')
    .select('id,groupe_id,reference,commentaire,created_at,fournisseurs(nom),lignes_commande(quantite_commandee,materiels(nom,code,unite))')
    .eq('id', commandeId)
    .eq('groupe_id', profile.groupe_id)
    .single()

  if (orderError || !order) {
    return json(response, 404, { error: 'Commande introuvable ou inaccessible.' })
  }

  const email = buildCommandeEmail(order)
  const { data, error: sendError } = await sendBrevoEmail({
    apiKey,
    from,
    to: [COMMAND_EMAIL_TO],
    subject: email.subject,
    html: email.html,
    text: email.text,
    attachments: [{
      filename: `${safeCommandeFilename(order.reference)}.csv`,
      content: Buffer.from(email.csv, 'utf8').toString('base64'),
    }],
    tags: [
      { name: 'groupe', value: order.groupe_id },
      { name: 'commande', value: safeCommandeFilename(order.reference).slice(0, 256) },
    ],
  })

  if (sendError) {
    console.error('Brevo order email failed', { commandeId: order.id, code: sendError.name })
    return json(response, 502, { error: 'La commande est enregistrée, mais l’e-mail n’a pas pu être envoyé.' })
  }

  return json(response, 200, { ok: true, email_id: data?.id, destinataire: COMMAND_EMAIL_TO })
}
