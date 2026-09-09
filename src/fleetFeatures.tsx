import { FormEvent, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  HardHat,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { Empty, Modal } from './components'
import { supabase } from './lib/supabase'
import { writeError } from './lib/db'
import { isCraneTruck } from './lib/fleet'
import type { Camion, ControleVgp } from './types'

type DueTone = 'ok' | 'soon' | 'late' | 'missing'

const shortDate = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

function dateLabel(value: string | null | undefined) {
  return value ? shortDate.format(new Date(`${value}T12:00:00`)) : 'À renseigner'
}

function dueTone(value: string | null | undefined): DueTone {
  if (!value) return 'missing'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(`${value}T12:00:00`)
  const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return 'late'
  if (days <= 30) return 'soon'
  return 'ok'
}

function dueText(value: string | null | undefined) {
  const tone = dueTone(value)
  if (tone === 'missing') return 'Date à renseigner'
  if (tone === 'late') return 'VGP expirée'
  if (tone === 'soon') return 'VGP proche'
  return 'Conforme'
}

// Le contrôle retenu est le dernier saisi, pas celui dont l'échéance est la
// plus lointaine : trier sur l'échéance ferait toujours ressortir la date la
// plus rassurante.
function latestVgp(controls: ControleVgp[], truckId: string) {
  return controls
    .filter((control) => control.camion_id === truckId && control.controle_type === 'VGP')
    .sort((left, right) => right.created_at.localeCompare(left.created_at))[0] || null
}

export function Trucks({
  rows,
  showGroups,
  canEdit,
  onAdd,
  onEdit,
}: {
  rows: Camion[]
  showGroups: boolean
  canEdit: boolean
  onAdd: () => void
  onEdit: (truck: Camion) => void
}) {
  const [showInactive, setShowInactive] = useState(false)
  const inactiveCount = rows.filter((truck) => truck.statut.toLowerCase() !== 'actif').length
  const visibleRows = showInactive ? rows : rows.filter((truck) => truck.statut.toLowerCase() === 'actif')
  return (
    <div className="feature-stack">
      <section className="panel fleet-toolbar">
        <div className="toolbar">
          <div><h3>Camions du groupe</h3><p>Le suivi VGP des camions-grue se planifie depuis l’onglet dédié.</p></div>
          {canEdit && <button className="primary" onClick={onAdd}><Plus /> Ajouter un camion</button>}
        </div>
        {!canEdit && <div className="notice"><ShieldCheck /> Consultation uniquement : la gestion est réservée au responsable du groupe.</div>}
        {inactiveCount > 0 && (
          <button className="inactive-toggle" onClick={() => setShowInactive((value) => !value)}>
            {showInactive ? 'Masquer les inactifs' : `Afficher les inactifs (${inactiveCount})`}
          </button>
        )}
      </section>
      {visibleRows.length ? (
        <section className="cards-grid">
          {visibleRows.map((truck) => (
            <article className={`truck-card ${truck.statut.toLowerCase() === 'actif' ? '' : 'inactive'}`} key={truck.id}>
              <Truck />
              <div>
                <span>{showGroups ? `${truck.groupe_id} · ` : ''}{truck.agence}</span>
                <h3>{truck.immatriculation}</h3>
                {isCraneTruck(truck) && (
                  <span className="crane-badge">
                    <HardHat /> Camion-grue
                    {!truck.est_camion_grue && <em title="Le type mentionne une grue mais la case n’est pas cochée. Le suivi VGP s’appuie sur le type en attendant.">· à confirmer</em>}
                  </span>
                )}
                {truck.type_vehicule && <p>{truck.type_vehicule}{truck.loueur ? ` · ${truck.loueur}` : ''}</p>}
              </div>
              <span className={`dot ${truck.statut.toLowerCase() === 'actif' ? 'on' : ''}`}>{truck.statut}</span>
              {canEdit && <button className="fleet-edit" onClick={() => onEdit(truck)} title="Modifier ce camion"><Pencil /><span>Modifier</span></button>}
            </article>
          ))}
        </section>
      ) : (
        <section className="panel full"><Empty title="Aucun camion actif" text="Ajoutez un camion pour commencer." /></section>
      )}
    </div>
  )
}

export function TruckForm({
  truck,
  groupId,
  defaultAgency,
  onClose,
  onDone,
}: {
  truck: Camion | null
  groupId: string
  defaultAgency: string
  onClose: () => void
  onDone: () => void
}) {
  const [registration, setRegistration] = useState(truck?.immatriculation || '')
  const [agency, setAgency] = useState(truck?.agence || defaultAgency)
  const [status, setStatus] = useState(truck?.statut || 'Actif')
  const [comment, setComment] = useState(truck?.commentaire || '')
  const [isCrane, setIsCrane] = useState(truck?.est_camion_grue || false)
  const [vehicleRoot, setVehicleRoot] = useState(truck?.racine_vehicule || '')
  const [vehicleType, setVehicleType] = useState(truck?.type_vehicule || '')
  const [lessor, setLessor] = useState(truck?.loueur || '')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFormError('')
    const payload = {
      immatriculation: registration.trim().toUpperCase(),
      agence: agency.trim(),
      statut: status,
      commentaire: comment.trim() || null,
      est_camion_grue: isCrane,
      racine_vehicule: vehicleRoot.trim() || null,
      type_vehicule: vehicleType.trim() || null,
      loueur: lessor.trim() || null,
    }
    const saveError = writeError(
      truck
        ? await supabase.from('camions').update(payload).eq('id', truck.id).eq('groupe_id', groupId).select('id')
        : await supabase.from('camions').insert({ ...payload, groupe_id: groupId }).select('id'),
      'Aucune ligne modifiée : vos droits ne couvrent pas ce groupe, ou la fiche a été modifiée entre-temps.',
    )
    setBusy(false)
    if (saveError?.code === '23505') setFormError('Cette immatriculation existe déjà.')
    else if (saveError) setFormError(saveError.message)
    else onDone()
  }

  return (
    <Modal title={truck ? 'Modifier le camion' : `Nouveau camion · ${groupId}`} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <div className="field-row">
          <label>Immatriculation<input required maxLength={20} value={registration} onChange={(event) => setRegistration(event.target.value.toUpperCase())} placeholder="AA-123-BB" /></label>
          <label>Agence<input required maxLength={120} value={agency} onChange={(event) => setAgency(event.target.value)} /></label>
        </div>
        <label className="checkbox-field"><input type="checkbox" checked={isCrane} onChange={(event) => setIsCrane(event.target.checked)} />Camion-grue à suivre dans l’onglet VGP</label>
        {isCrane && <><div className="field-row"><label>Racine véhicule<input value={vehicleRoot} onChange={(event) => setVehicleRoot(event.target.value.toUpperCase())} placeholder="POR15G010114" /></label><label>Loueur<input value={lessor} onChange={(event) => setLessor(event.target.value)} placeholder="VOLVO, FRAIKIN…" /></label></div><label>Type de véhicule<input value={vehicleType} onChange={(event) => setVehicleType(event.target.value)} placeholder="Porteur Grue 32T" /></label></>}
        <label>Statut<select value={status} onChange={(event) => setStatus(event.target.value)}><option>Actif</option><option>Inactif</option></select></label>
        {truck && status === 'Inactif' && <div className="notice"><ShieldCheck /> Le camion n’apparaîtra plus dans le registre actif. Son historique VGP reste conservé.</div>}
        <label>Commentaire<textarea rows={3} maxLength={500} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Information utile…" /></label>
        {formError && <div className="form-error">{formError}</div>}
        <button className="primary wide" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </form>
    </Modal>
  )
}

export function VgpView({
  trucks,
  controls,
  showGroups,
  canEdit,
  onReload,
}: {
  trucks: Camion[]
  controls: ControleVgp[]
  showGroups: boolean
  canEdit: boolean
  onReload: () => void
}) {
  const [editingControl, setEditingControl] = useState<ControleVgp | null | undefined>(undefined)
  const [controlTarget, setControlTarget] = useState('')
  const [notice, setNotice] = useState('')
  const cranes = useMemo(
    () => trucks.filter((truck) => isCraneTruck(truck) && truck.statut.toLowerCase() === 'actif'),
    [trucks],
  )
  const activeControls = useMemo(() => {
    const activeCraneIds = new Set(cranes.map((truck) => truck.id))
    return controls.filter((control) => activeCraneIds.has(control.camion_id))
  }, [controls, cranes])
  const dueDates = cranes.map((truck) => latestVgp(activeControls, truck.id)?.date_echeance || null)
  const expired = dueDates.filter((date) => dueTone(date) === 'late').length
  const soon = dueDates.filter((date) => dueTone(date) === 'soon').length
  const missing = dueDates.filter((date) => dueTone(date) === 'missing').length

  const upcoming = useMemo(() => {
    const existing = activeControls
      .filter((control) => control.controle_type === 'VGP')
      .map((control) => ({
        key: control.id,
        date: control.date_echeance,
        label: control.camions?.immatriculation || 'Camion-grue',
        detail: `${control.groupe_id} · ${control.controle_type}`,
        tone: dueTone(control.date_echeance),
      }))
    const withoutDate = cranes
      .filter((truck) => !latestVgp(activeControls, truck.id))
      .map((truck) => ({ key: `missing-${truck.id}`, date: '', label: truck.immatriculation, detail: `${truck.groupe_id} · VGP à renseigner`, tone: 'missing' as DueTone }))
    return [...existing, ...withoutDate].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')).slice(0, 8)
  }, [activeControls, cranes])

  return <div className="equipment-stack">
    <section className="equipment-heading">
      <div><span className="equipment-kicker"><HardHat /> Sécurité</span><h2>Contrôles VGP des camions-grue</h2><p>Vérification générale périodique : échéances, résultats et historique.</p></div>
      {canEdit && <div className="equipment-actions"><button className="primary" onClick={() => { setControlTarget(''); setEditingControl(null) }}><CalendarClock /> Planifier une VGP</button></div>}
    </section>
    {notice && <div className="notice"><CheckCircle2 />{notice}</div>}
    <section className="equipment-kpis">
      <div className="equipment-kpi dark"><Truck /><span>Camions-grue suivis</span><strong>{cranes.length}</strong></div>
      <div className="equipment-kpi danger"><AlertTriangle /><span>VGP expirées</span><strong>{expired}</strong></div>
      <div className="equipment-kpi warning"><CalendarClock /><span>Dates à renseigner</span><strong>{missing}</strong></div>
      <div className="equipment-kpi success"><CheckCircle2 /><span>VGP sous 30 jours</span><strong>{soon}</strong></div>
    </section>
    <div className="equipment-register-layout">
      <section className="panel full equipment-panel">
        <div className="equipment-panel-head"><div><h3>Registre des camions-grue</h3><p>État de la dernière VGP par camion</p></div></div>
        <div className="equipment-table-wrap"><table className="equipment-table"><thead><tr><th>Camion</th>{showGroups && <th>Groupe</th>}<th>Racine véhicule</th><th>Agence</th><th>Échéance VGP</th><th>État</th><th>Actions</th></tr></thead><tbody>
          {cranes.map((truck) => { const control = latestVgp(activeControls, truck.id); return <tr key={truck.id}><td><div className="equipment-name"><span><Truck /></span><div><b>{truck.immatriculation}</b><small>{truck.type_vehicule || 'Camion-grue'} · {truck.loueur || 'Loueur non renseigné'}</small></div></div></td>{showGroups && <td><span className="group-chip">{truck.groupe_id}</span></td>}<td>{truck.racine_vehicule || '—'}</td><td>{truck.agence}</td><td>{dateLabel(control?.date_echeance)}</td><td><span className={`equipment-status ${dueTone(control?.date_echeance)}`}>{dueText(control?.date_echeance)}</span></td><td><div className="equipment-row-actions">{canEdit && <button onClick={() => { setControlTarget(truck.id); setEditingControl(control || null) }} title={control ? 'Modifier la VGP' : 'Renseigner la VGP'}><Pencil /></button>}</div></td></tr> })}
        </tbody></table></div>
        {!cranes.length && <Empty title="Aucun camion-grue" text="Cochez « Camion-grue » sur une fiche camion pour l’inclure ici." />}
      </section>
      <div className="equipment-side">
        <section className="vgp-calendar">
          <header><div><span>Prochaines visites</span><h3>Calendrier VGP</h3></div><CalendarClock /></header>
          <div>{upcoming.map((entry) => <article key={entry.key}><span className={`calendar-date ${entry.tone}`}>{entry.date ? shortDate.format(new Date(`${entry.date}T12:00:00`)) : 'À renseigner'}</span><div><b>{entry.label}</b><small>{entry.detail}</small></div></article>)}{!upcoming.length && <Empty title="Aucune échéance" text="Les contrôles planifiés apparaîtront ici." />}</div>
        </section>
        <section className="equipment-help"><ShieldAlert /><div><h3>Sécurité prioritaire</h3><p>Un camion-grue dont la VGP est expirée doit être immobilisé jusqu’à régularisation.</p></div></section>
      </div>
    </div>
    {editingControl !== undefined && <VgpForm control={editingControl} defaultTruckId={controlTarget} trucks={cranes} onClose={() => setEditingControl(undefined)} onDone={() => { setEditingControl(undefined); setNotice('Contrôle VGP enregistré.'); onReload() }} />}
  </div>
}

function VgpForm({
  control,
  defaultTruckId,
  trucks,
  onClose,
  onDone,
}: {
  control: ControleVgp | null
  defaultTruckId: string
  trucks: Camion[]
  onClose: () => void
  onDone: () => void
}) {
  const initialTruckId = control?.camion_id || (trucks.some((truck) => truck.id === defaultTruckId) ? defaultTruckId : '')
  const [truckId, setTruckId] = useState(initialTruckId)
  const [controlType, setControlType] = useState<ControleVgp['controle_type']>(control?.controle_type || 'VGP')
  const [controlDate, setControlDate] = useState(control?.date_controle || '')
  const [dueDate, setDueDate] = useState(control?.date_echeance || '')
  const [organization, setOrganization] = useState(control?.organisme || '')
  const [result, setResult] = useState<ControleVgp['resultat']>(control?.resultat || 'Valide')
  const [comment, setComment] = useState(control?.commentaire || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!truckId) { setError('Sélectionnez un camion-grue.'); return }
    setBusy(true)
    setError('')
    let saveError: { message: string } | null = null
    if (control) {
      const payload = { controle_type: controlType, date_controle: controlDate || null, date_echeance: dueDate, organisme: organization.trim() || null, resultat: result, commentaire: comment.trim() || null }
      const response = await supabase.from('controles_vgp').update(payload).eq('id', control.id).select('id')
      saveError = response.error
      if (!saveError && !response.data?.length) {
        saveError = { message: "Le contrôle n'a pas été modifié : vous n'avez pas les droits sur ce groupe, ou la ligne n'existe plus." }
      }
    } else {
      const response = await supabase.rpc('enregistrer_controle_vgp_camion', {
        p_camion_id: truckId,
        p_controle_type: controlType,
        p_date_controle: controlDate || null,
        p_date_echeance: dueDate,
        p_organisme: organization.trim(),
        p_resultat: result,
        p_commentaire: comment.trim(),
      })
      saveError = response.error
    }
    setBusy(false)
    if (saveError) setError(saveError.message)
    else onDone()
  }

  return (
    <Modal title={control ? 'Modifier le contrôle' : 'Planifier un contrôle VGP'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Camion-grue<select value={truckId} onChange={(event) => setTruckId(event.target.value)} disabled={Boolean(control)} required><option value="">Sélectionner…</option>{trucks.map((truck) => <option value={truck.id} key={truck.id}>{truck.groupe_id} · {truck.immatriculation} · {truck.type_vehicule || 'Camion-grue'}</option>)}</select></label>
        <div className="field-row">
          <label>Type de contrôle<select value={controlType} onChange={(event) => setControlType(event.target.value as ControleVgp['controle_type'])}><option>VGP</option><option>Mines</option><option>Chronotachygraphe</option><option>Limiteur</option><option>Treuil</option></select></label>
          <label>Résultat<select value={result} onChange={(event) => setResult(event.target.value as ControleVgp['resultat'])}><option>Valide</option><option>Avec observation</option><option>Non conforme</option></select></label>
        </div>
        <div className="field-row">
          <label>Date du contrôle<input type="date" value={controlDate} onChange={(event) => setControlDate(event.target.value)} /></label>
          <label>Date d’échéance<input type="date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
        </div>
        <label>Organisme / loueur<input value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="Organisme de contrôle" /></label>
        <label>Commentaire<textarea rows={2} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
        {result === 'Non conforme' && <div className="form-error"><ShieldAlert />Le camion doit être placé hors service.</div>}
        {error && <div className="form-error">{error}</div>}
        <button className="primary wide" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le contrôle'}</button>
      </form>
    </Modal>
  )
}
