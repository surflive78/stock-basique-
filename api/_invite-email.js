const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const ROLE_LABELS = { admin: 'Administrateur', responsable: 'Responsable', lecture: 'Lecture seule' }

export function buildInviteEmail({ nom, role, groupeLabel, appUrl }) {
  const roleLabel = ROLE_LABELS[role] || role
  const subject = `Accès au suivi de stock — ${groupeLabel}`

  const html = `<!doctype html>
  <html lang="fr">
    <body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
      <div style="max-width:680px;margin:0 auto;padding:28px 16px">
        <div style="background:#f5c400;padding:24px;border-radius:16px 16px 0 0">
          <div style="font-size:12px;font-weight:700;letter-spacing:2px">SUIVI DE STOCK</div>
          <h1 style="margin:8px 0 0;font-size:28px">Vous avez été invité(e)</h1>
        </div>
        <div style="background:#ffffff;padding:24px;border-radius:0 0 16px 16px">
          <p style="margin-top:0">Bonjour ${escapeHtml(nom)},</p>
          <p>Un accès au suivi de stock vient de vous être créé :</p>
          <p><strong>Groupe :</strong> ${escapeHtml(groupeLabel)}<br><strong>Rôle :</strong> ${escapeHtml(roleLabel)}</p>
          <p>Pour l’activer, rendez-vous sur <a href="${escapeHtml(appUrl)}">${escapeHtml(appUrl)}</a>, cliquez sur « Créer mon compte » et utilisez cette même adresse e-mail. Vos droits s’appliqueront automatiquement dès la première connexion.</p>
          <p style="font-size:13px;color:#52525b">Si vous ne vous attendiez pas à ce message, vous pouvez l’ignorer.</p>
        </div>
      </div>
    </body>
  </html>`

  const text = `Bonjour ${nom},\n\nUn accès au suivi de stock vient de vous être créé.\nGroupe : ${groupeLabel}\nRôle : ${roleLabel}\n\nPour l’activer, rendez-vous sur ${appUrl}, cliquez sur « Créer mon compte » et utilisez cette même adresse e-mail. Vos droits s’appliqueront automatiquement dès la première connexion.\n\nSi vous ne vous attendiez pas à ce message, vous pouvez l’ignorer.`

  return { subject, html, text }
}
