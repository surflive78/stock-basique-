// Export CSV pour l'exploitant : mouvements de stock et commandes fournisseurs,
// sur une période choisie. Tout est déjà chargé côté client (RLS Supabase
// filtre par groupe) : pas de nouvelle requête, juste un filtrage en mémoire
// puis un Blob téléchargé.

import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import type { CommandeFournisseur, Mouvement } from './types'

type Dataset = 'mouvements' | 'commandes'

type ColumnDef<T> = { key: string; label: string; get: (row: T) => string | number }

const MOVEMENT_COLUMNS: ColumnDef<Mouvement>[] = [
  { key: 'date', label: 'Date', get: (m) => new Date(m.date_heure).toLocaleString('fr-FR') },
  { key: 'materiel', label: 'Matériel', get: (m) => `${m.materiels.code} ${m.materiels.nom}` },
  { key: 'type', label: 'Type', get: (m) => m.type },
  { key: 'quantite', label: 'Quantité', get: (m) => m.quantite },
  { key: 'source', label: 'Source', get: (m) => m.emplacements_source?.nom ?? '' },
  { key: 'destination', label: 'Destination', get: (m) => m.emplacements_destination?.nom ?? '' },
  { key: 'commentaire', label: 'Commentaire', get: (m) => m.commentaire ?? '' },
]

const ORDER_COLUMNS: ColumnDef<CommandeFournisseur>[] = [
  { key: 'reference', label: 'Référence', get: (o) => o.reference },
  { key: 'fournisseur', label: 'Fournisseur', get: (o) => o.fournisseurs?.nom ?? '' },
  { key: 'statut', label: 'Statut', get: (o) => o.statut },
  { key: 'date_commande', label: 'Date commande', get: (o) => o.date_commande ?? '' },
  { key: 'date_livraison', label: 'Livraison prévue', get: (o) => o.date_livraison_prevue ?? '' },
  {
    key: 'lignes',
    label: 'Lignes',
    get: (o) => o.lignes_commande.map((l) => `${l.materiels.code}×${l.quantite_commandee}`).join(' | '),
  },
]

function toCsv<T>(rows: T[], columns: ColumnDef<T>[]) {
  const esc = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
  const header = columns.map((c) => esc(c.label)).join(';')
  const lines = rows.map((row) => columns.map((c) => esc(c.get(row))).join(';'))
  return [header, ...lines].join('\r\n')
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function inRange(iso: string | null, start: string, end: string) {
  if (!iso) return false
  const day = iso.slice(0, 10)
  if (start && day < start) return false
  if (end && day > end) return false
  return true
}

export function ExportView({
  moves,
  orders,
  groupLabel,
}: {
  moves: Mouvement[]
  orders: CommandeFournisseur[]
  groupLabel: string
}) {
  const [dataset, setDataset] = useState<Dataset>('mouvements')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [columns, setColumns] = useState<Set<string>>(
    () => new Set(MOVEMENT_COLUMNS.map((c) => c.key)),
  )

  const columnDefs = dataset === 'mouvements' ? MOVEMENT_COLUMNS : ORDER_COLUMNS

  const chooseDataset = (next: Dataset) => {
    setDataset(next)
    setColumns(new Set((next === 'mouvements' ? MOVEMENT_COLUMNS : ORDER_COLUMNS).map((c) => c.key)))
  }

  const toggleColumn = (key: string) => {
    setColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const rangedMoves = useMemo(
    () => moves.filter((m) => inRange(m.date_heure, start, end)),
    [moves, start, end],
  )

  const rangedOrders = useMemo(
    () => orders.filter((o) => inRange(o.date_commande, start, end)),
    [orders, start, end],
  )

  const selectedColumns = columnDefs.filter((c) => columns.has(c.key))
  const rowCount = dataset === 'mouvements' ? rangedMoves.length : rangedOrders.length

  const exportCsv = () => {
    const csv =
      dataset === 'mouvements'
        ? toCsv(rangedMoves, selectedColumns as ColumnDef<Mouvement>[])
        : toCsv(rangedOrders, selectedColumns as ColumnDef<CommandeFournisseur>[])
    const period = start || end ? `_${start || '...'}_${end || '...'}` : ''
    downloadCsv(`${dataset}_${groupLabel}${period}.csv`, csv)
  }

  return (
    <div className="feature-stack">
      <section className="panel full">
        <div className="toolbar">
          <div>
            <h3>Exporter des données</h3>
            <p>Choisissez le jeu de données, la période et les colonnes à inclure, puis téléchargez le CSV.</p>
          </div>
        </div>

        <div className="form">
          <label>
            Jeu de données
            <select value={dataset} onChange={(e) => chooseDataset(e.target.value as Dataset)}>
              <option value="mouvements">Mouvements de stock</option>
              <option value="commandes">Commandes fournisseurs</option>
            </select>
          </label>

          <div className="field-row">
            <label>
              Du
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label>
              Au
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>

          <div className="field-row">
            {columnDefs.map((c) => (
              <label className="checkbox-field" key={c.key}>
                <input type="checkbox" checked={columns.has(c.key)} onChange={() => toggleColumn(c.key)} />
                <span>{c.label}</span>
              </label>
            ))}
          </div>

          <button className="primary" onClick={exportCsv} disabled={selectedColumns.length === 0 || rowCount === 0}>
            <Download /> Exporter {rowCount} ligne{rowCount > 1 ? 's' : ''} (CSV)
          </button>
        </div>
      </section>
    </div>
  )
}
