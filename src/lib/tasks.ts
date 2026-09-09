// Le tableau de bord affichait trois compteurs — unités, alertes, ruptures.
// Un compteur dit où on en est, jamais quoi faire : « 14 alertes » oblige à
// ouvrir deux onglets pour retrouver de quoi il s'agit.
//
// Ce module transforme l'état en travail : chaque entrée est une chose à faire,
// avec l'onglet qui permet de la faire. Il est volontairement pur pour être
// testable.

import type { CommandeFournisseur, Stock } from '../types'

export type TaskKind = 'inventaire' | 'stock' | 'commande'
export type TaskSeverity = 'critique' | 'attention'
export type TaskTab = 'stocks' | 'commandes'

export type Task = {
  id: string
  kind: TaskKind
  severity: TaskSeverity
  title: string
  detail: string
  action: string
  tab: TaskTab
  rank: number
}

export const KIND_LABEL: Record<TaskKind, string> = {
  inventaire: 'Inventaire',
  stock: 'Stock',
  commande: 'Commande',
}

const KIND_ORDER: Record<TaskKind, number> = { inventaire: 0, stock: 1, commande: 2 }

const plural = (count: number, one: string, many: string) => (count > 1 ? many : one)

export function buildTasks(input: { stocks: Stock[]; orders: CommandeFournisseur[] }): Task[] {
  const tasks: Task[] = []
  const push = (task: Omit<Task, 'rank'>, urgency = 0) =>
    tasks.push({ ...task, rank: (task.severity === 'critique' ? 0 : 1000) + KIND_ORDER[task.kind] * 100 + urgency })

  // — Inventaire jamais fait : une seule entrée, sinon dix ruptures noieraient
  //   le reste alors qu'il n'y a qu'une seule action à mener.
  const inventoryMissing = input.stocks.length > 0 && input.stocks.every((stock) => stock.quantite === 0)
  if (inventoryMissing) {
    push({
      id: 'inventaire-materiel',
      kind: 'inventaire',
      severity: 'critique',
      title: 'L’inventaire du matériel n’a jamais été saisi',
      detail: `${input.stocks.length} ${plural(input.stocks.length, 'référence attend sa quantité', 'références attendent leur quantité')} · rien ne peut être commandé avant.`,
      action: 'Compter',
      tab: 'stocks',
    })
  } else {
    for (const stock of input.stocks) {
      if (stock.quantite > stock.seuil_alerte) continue
      const toOrder = Math.max(stock.stock_cible - stock.quantite, 0)
      const unit = stock.materiels.unite.toLowerCase()
      const empty = stock.quantite === 0
      push({
        id: `stock-${stock.id}`,
        kind: 'stock',
        severity: empty ? 'critique' : 'attention',
        title: `${stock.materiels.nom} — ${empty ? 'en rupture' : 'au seuil'}`,
        detail: `${stock.quantite} en stock · seuil ${stock.seuil_alerte} · ${toOrder} ${unit}${toOrder > 1 ? 's' : ''} pour revenir à la cible`,
        action: 'Commander',
        tab: 'commandes',
      }, stock.quantite)
    }
  }

  // — Commandes déjà passées qu'il reste à réceptionner.
  for (const order of input.orders) {
    if (order.statut !== 'commande' && order.statut !== 'en_livraison') continue
    push({
      id: `commande-${order.id}`,
      kind: 'commande',
      severity: 'attention',
      title: `${order.reference} — à réceptionner`,
      detail: `${order.fournisseurs?.nom || 'Fournisseur non renseigné'} · ${order.lignes_commande.length} ${plural(order.lignes_commande.length, 'ligne', 'lignes')}`,
      action: 'Réceptionner',
      tab: 'commandes',
    })
  }

  return tasks.sort((left, right) => left.rank - right.rank || left.title.localeCompare(right.title, 'fr'))
}
