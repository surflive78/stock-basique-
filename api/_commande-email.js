const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`

const materialOf = (line) => Array.isArray(line.materiels)
  ? line.materiels[0]
  : line.materiels

const supplierOf = (order) => Array.isArray(order.fournisseurs)
  ? order.fournisseurs[0]
  : order.fournisseurs

export function buildCommandeEmail(order) {
  const supplier = supplierOf(order)?.nom || 'Fournisseur non renseigné'
  const lines = Array.isArray(order.lignes_commande) ? order.lignes_commande : []
  const subject = `Commande ${order.reference} — ${supplier}`

  const tableRows = lines.map((line) => {
    const material = materialOf(line) || {}
    return `<tr>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb">${escapeHtml(material.code || '')}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb">${escapeHtml(material.nom || '')}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right"><strong>${escapeHtml(line.quantite_commandee)}</strong> ${escapeHtml(material.unite || '')}</td>
    </tr>`
  }).join('')

  const textLines = lines.map((line) => {
    const material = materialOf(line) || {}
    return `- ${material.code || ''} — ${material.nom || ''} : ${line.quantite_commandee} ${material.unite || ''}`
  }).join('\n')

  const csvHeader = ['Référence commande', 'Fournisseur', 'Code article', 'Article', 'Quantité', 'Unité', 'Commentaire']
  const csvRows = lines.map((line) => {
    const material = materialOf(line) || {}
    return [order.reference, supplier, material.code, material.nom, line.quantite_commandee, material.unite, order.commentaire || '']
      .map(csvCell)
      .join(';')
  })
  const csv = `\uFEFF${csvHeader.map(csvCell).join(';')}\r\n${csvRows.join('\r\n')}\r\n`

  const html = `<!doctype html>
  <html lang="fr">
    <body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
      <div style="max-width:680px;margin:0 auto;padding:28px 16px">
        <div style="background:#f5c400;padding:24px;border-radius:16px 16px 0 0">
          <div style="font-size:12px;font-weight:700;letter-spacing:2px">SUIVI DE STOCK</div>
          <h1 style="margin:8px 0 0;font-size:28px">Commande ${escapeHtml(order.reference)}</h1>
        </div>
        <div style="background:#ffffff;padding:24px;border-radius:0 0 16px 16px">
          <p style="margin-top:0">Commande fournisseur à traiter.</p>
          <p><strong>Fournisseur :</strong> ${escapeHtml(supplier)}</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0">
            <thead><tr style="background:#18181b;color:#ffffff">
              <th style="padding:10px;text-align:left">Code</th>
              <th style="padding:10px;text-align:left">Article</th>
              <th style="padding:10px;text-align:right">Quantité</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          ${order.commentaire ? `<p><strong>Commentaire :</strong><br>${escapeHtml(order.commentaire)}</p>` : ''}
          <p style="font-size:13px;color:#52525b">Le détail est également joint au format CSV.</p>
        </div>
      </div>
    </body>
  </html>`

  const text = `Commande ${order.reference}\n\nFournisseur : ${supplier}\n\n${textLines}${order.commentaire ? `\n\nCommentaire : ${order.commentaire}` : ''}\n\nLe détail est également joint au format CSV.`

  return { subject, html, text, csv }
}

export function safeCommandeFilename(reference) {
  return String(reference || 'commande')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'commande'
}
