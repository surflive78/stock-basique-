import { createClient } from '@supabase/supabase-js'
import { sendBrevoEmail } from './_brevo.js'
import { buildInviteEmail } from './_invite-email.js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sdlpoamevaqbokqymvsz.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_RLNXU4S6rbh6KZgOVRit9w_E842rQzV'
const APP_URL = process.env.APP_URL || 'https://stock-basique.vercel.app'
const ROLES = ['admin', 'responsable', 'lecture']

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

  const email = String(body.email || '').trim().toLowerCase()
  const nom = String(body.nom || '').trim()
  const role = String(body.role || '')
  const groupeId = String(body.groupe_id || '').trim()
  if (!email.includes('@') || !nom || !ROLES.includes(role) || !groupeId) {
    return json(response, 400, { error: 'Champs invalides.' })
  }

  const apiKey = process.env.BREVO_API_KEY
  const from = process.env.COMMAND_EMAIL_FROM
  if (!apiKey || !from) {
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

  const { data: caller, error: callerError } = await supabase
    .from('profils')
    .select('groupe_id,role,acces_global,actif')
    .eq('id', userData.user.id)
    .single()

  const authorized = Boolean(caller?.actif && (
    (caller.role === 'admin' && caller.groupe_id === groupeId) ||
    (caller.role === 'superviseur' && caller.acces_global)
  ))
  if (callerError || !authorized) {
    return json(response, 403, { error: 'Vous n’êtes pas autorisé à inviter un utilisateur pour ce groupe.' })
  }

  const { data: group, error: groupError } = await supabase
    .from('groupes')
    .select('id,agence')
    .eq('id', groupeId)
    .single()
  if (groupError || !group) {
    return json(response, 404, { error: 'Groupe introuvable.' })
  }

  const groupeLabel = group.agence ? `${group.id} — ${group.agence}` : group.id
  const invite = buildInviteEmail({ nom, role, groupeLabel, appUrl: APP_URL })
  const { data, error: sendError } = await sendBrevoEmail({
    apiKey,
    from,
    to: [email],
    subject: invite.subject,
    html: invite.html,
    text: invite.text,
    tags: [{ name: 'groupe', value: groupeId }, { name: 'invitation', value: 'true' }],
  })

  if (sendError) {
    console.error('Brevo invite email failed', { groupeId, code: sendError.name })
    return json(response, 502, { error: 'Le compte est pré-autorisé, mais l’e-mail n’a pas pu être envoyé.' })
  }

  return json(response, 200, { ok: true, email_id: data?.id })
}
