const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

function parseSender(raw) {
  const match = /^(.*)<(.+)>$/.exec(raw || '')
  if (match) return { name: match[1].trim().replace(/^"|"$/g, '') || undefined, email: match[2].trim() }
  return { email: String(raw || '').trim() }
}

export async function sendBrevoEmail({ apiKey, from, to, subject, html, text, attachments, tags }) {
  const response = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: parseSender(from),
      to: to.map((email) => ({ email })),
      subject,
      htmlContent: html,
      textContent: text,
      ...(attachments?.length ? { attachment: attachments.map((a) => ({ name: a.filename, content: a.content })) } : {}),
      ...(tags?.length ? { tags: tags.map((t) => `${t.name}:${t.value}`) } : {}),
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    return { error: { name: payload?.code || `http_${response.status}`, message: payload?.message } }
  }
  return { data: { id: payload?.messageId } }
}
