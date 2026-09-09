// Le tableau de bord affichait trois compteurs — unités, alertes, ruptures.
// Un compteur dit où on en est, jamais quoi faire : « 14 alertes » oblige à
// ouvrir deux onglets pour retrouver de quoi il s'agit.
//
// Ce module transforme l'état en travail : chaque entrée est une chose à faire,
// avec l'onglet qui permet de la faire. Il est volontairement pur pour être
// testable.

import type { Camion, CommandeFournisseur, ControleVgp, Stock } from '../types'
import { isCraneTruck } from './fleet.ts'

export type TaskKind = 'securite' | 'inventaire' | 'stock' | 'commande'
export type TaskSeverity = 'critique' | 'attention'
export type TaskTab = 'stocks' | 'commandes' | 'vgp'

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
  securite: 'Sécurité',
  inventaire: 'Inventaire',
  stock: 'Stock',
  commande: 'Commande',
}

const DAY = 86_400_000
const KIND_ORDER: Record<TaskKind, number> = { securite: 0, inventaire: 1, stock: 2, commande: 3 }

// L'échéance est ancrée à midi pour qu'un changement d'heure ne fasse pas
// basculer le résultat d'un jour ; l'écart tombe donc toujours sur un .5, et
// c'est floor qui donne le compte juste des deux côtés.
function daysUntil(dueDate: string, today: Date) {
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  return Math.floor((new Date(`${dueDate}T12:00:00`).getTime() - start.getTime()) / DAY)
}

const plural = (count: number, one: string, many: string) => (count > 1 ? many : one)

// Le contrôle retenu est le dernier saisi, pas celui dont l'échéance est la plus
// lointaine : trier sur l'échéance ferait toujours ressortir la date la plus
// rassurante.
function latestVgp(controls: ControleVgp[], truckId: string) {
  return controls
    .filter((control) => control.camion_id === truckId && control.controle_type === 'VGP')
    .sort((left, right) => right.created_at.localeCompare(left.created_at))[0] || null
}

export function buildTasks(
  input: { stocks: Stock[]; orders: CommandeFournisseur[]; trucks: Camion[]; controls: ControleVgp[] },
  today: Date = new Date(),
): Task[] {
  const tasks: Task[] = []
  const push = (task: Omit<Task, 'rank'>, urgency = 0) =>
    tasks.push({ ...task, rank: (task.severity === 'critique' ? 0 : 1000) + KIND_ORDER[task.kind] * 100 + urgency })

  // — Sécurité : les camions-grues et leur visite générale périodique.
  for (const truck of input.trucks) {
    if (!isCraneTruck(truck) || truck.statut.toLowerCase() !== 'actif') continue
    const control = latestVgp(input.controls, truck.id)
    if (!control) {
      push({
        id: `vgp-manquante-${truck.id}`,
        kind: 'securite',
        severity: 'attention',
        title: `${truck.immatriculation} — aucune VGP enregistrée`,
        detail: 'Camion-grue sans échéance connue : il échappe à la surveillance tant que la date n’est pas saisie.',
        action: 'Renseigner',
        tab: 'vgp',
      }, 50)
      continue
    }
    const days = daysUntil(control.date_echeance, today)
    if (days < 0) {
      push({
        id: `vgp-echue-${truck.id}`,
        kind: 'securite',
        severity: 'critique',
        title: `${truck.immatriculation} — VGP échue`,
        detail: `Dépassée de ${-days} ${plural(-days, 'jour', 'jours')}`,
        action: 'Régulariser',
        tab: 'vgp',
      }, Math.max(0, 99 + days))
    } else if (days <= 30) {
      push({
        id: `vgp-proche-${truck.id}`,
        kind: 'securite',
        severity: 'attention',
        title: `${truck.immatriculation} — VGP à planifier`,
        detail: `Échéance dans ${days} ${plural(days, 'jour', 'jours')}`,
        action: 'Planifier',
        tab: 'vgp',
      }, days)
    }
  }

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
