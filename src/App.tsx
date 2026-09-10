import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  ChevronRight,
  CircleUserRound,
  ClipboardCheck,
  Download,
  Eye,
  HardHat,
  History,
  Layers3,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  ShoppingCart,
  Truck,
  X,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { configured, supabase } from './lib/supabase'
import { writeError } from './lib/db'
import { buildTasks, KIND_LABEL, type TaskKind } from './lib/tasks'
import type {
  Camion,
  CommandeFournisseur,
  ControleVgp,
  EmplacementStock,
  Fournisseur,
  Groupe,
  HistoriqueInventaire,
  Mouvement,
  Profile,
  Stock,
  StockEmplacement,
} from './types'
import { Empty, Modal, StockBadge } from './components'
import { movementMeta, statusOf } from './lib/stock'
import { HistoriqueView, InventoryAdjustmentForm, LocationsView, OrdersView, ScannerModal, ThresholdForm } from './stockFeatures'
import { ExportView } from './exportFeatures'
import { Trucks, TruckForm, VgpView } from './fleetFeatures'

type Tab = 'dashboard' | 'stocks' | 'mouvements' | 'commandes' | 'emplacements' | 'historique' | 'camions' | 'vgp' | 'export'

type AuthMode = 'login' | 'signup' | 'forgot' | 'recovery'

const ALL_GROUPS = 'ALL'
const MOVEMENT_PAGE_SIZE = 1000
const MOVEMENT_MAX_PAGES = 20

const groupLabel = (group: Groupe) => (group.agence ? `${group.id} — ${group.agence}` : group.id)

const tabs = [
  ['dashboard', 'Tableau de bord', BarChart3],
  ['stocks', 'Stocks', Boxes],
  ['mouvements', 'Mouvements', RefreshCw],
  ['commandes', 'Commandes', ShoppingCart],
  ['emplacements', 'Emplacements', MapPin],
  ['historique', 'Historique', History],
  ['camions', 'Camions', Truck],
  ['vgp', 'VGP', HardHat],
  ['export', 'Export', Download],
] as const

const mobileTabs = tabs.filter(([id]) => ['dashboard', 'stocks', 'mouvements', 'commandes'].includes(id))

const fmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const movementSelect =
  'id,groupe_id,materiel_id,emplacement_source_id,emplacement_destination_id,impact_stock,type,quantite,date_heure,emplacement,commentaire,materiels(nom,code),emplacements_source:emplacements_stock!mouvements_stock_emplacement_source_id_fkey(nom,type),emplacements_destination:emplacements_stock!mouvements_stock_emplacement_destination_id_fkey(nom,type)'

async function fetchAllMovements(groupId: string) {
  const rows: Mouvement[] = []
  for (let page = 0; page < MOVEMENT_MAX_PAGES; page += 1) {
    const from = page * MOVEMENT_PAGE_SIZE
    const to = from + MOVEMENT_PAGE_SIZE - 1
    let request = supabase
      .from('mouvements_stock')
      .select(movementSelect)
      .order('date_heure', { ascending: false })
      .range(from, to)
    if (groupId !== ALL_GROUPS) request = request.eq('groupe_id', groupId)
    const { data, error } = await request
    if (error) return { data: null, error }
    const pageRows = (data || []) as unknown as Mouvement[]
    rows.push(...pageRows)
    if (pageRows.length < MOVEMENT_PAGE_SIZE) break
  }
  return { data: rows, error: null }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [menu, setMenu] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [stocks, setStocks] = useState<Stock[]>([])
  const [moves, setMoves] = useState<Mouvement[]>([])
  const [orders, setOrders] = useState<CommandeFournisseur[]>([])
  const [suppliers, setSuppliers] = useState<Fournisseur[]>([])
  const [locations, setLocations] = useState<EmplacementStock[]>([])
  const [locationStocks, setLocationStocks] = useState<StockEmplacement[]>([])
  const [trucks, setTrucks] = useState<Camion[]>([])
  const [vgpControls, setVgpControls] = useState<ControleVgp[]>([])
  const [inventoryHistory, setInventoryHistory] = useState<HistoriqueInventaire[]>([])
  const [groups, setGroups] = useState<Groupe[]>([])
  const [selectedGroup, setSelectedGroup] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode | null>(null)
  const [legalOpen, setLegalOpen] = useState(false)
  const [movement, setMovement] = useState(false)
  const [editingMovement, setEditingMovement] = useState<Mouvement | null>(null)
  const [movementSeed, setMovementSeed] = useState<{ materialId?: string; type?: string } | null>(null)
  const [scanner, setScanner] = useState(false)
  const [thresholdStock, setThresholdStock] = useState<Stock | null>(null)
  const [inventoryStock, setInventoryStock] = useState<Stock | null>(null)
  const [truckForm, setTruckForm] = useState(false)
  const [editingTruck, setEditingTruck] = useState<Camion | null>(null)

  const clearData = useCallback(() => {
    setStocks([])
    setMoves([])
    setOrders([])
    setSuppliers([])
    setLocations([])
    setLocationStocks([])
    setTrucks([])
    setVgpControls([])
    setInventoryHistory([])
  }, [])

  const load = useCallback(async () => {
    if (!session || !profile || !selectedGroup) return
    setLoading(true)
    setError('')

    let stocksRequest = supabase.from('stocks').select('*,materiels(*)').order('quantite')
    let ordersRequest = supabase
      .from('commandes_fournisseurs')
      .select(
        'id,groupe_id,fournisseur_id,reference,statut,date_commande,date_livraison_prevue,commentaire,created_at,updated_at,fournisseurs(nom),lignes_commande(id,materiel_id,quantite_commandee,quantite_recue,materiels(nom,code,unite))',
      )
      .order('created_at', { ascending: false })
    let suppliersRequest = supabase
      .from('fournisseurs')
      .select('id,groupe_id,nom,email,telephone,actif')
      .order('nom')
    let locationsRequest = supabase
      .from('emplacements_stock')
      .select('id,groupe_id,nom,type,disponible,actif')
      .eq('actif', true)
      .order('type')
      .order('nom')
    let locationStocksRequest = supabase
      .from('stocks_emplacements')
      .select(
        'id,groupe_id,materiel_id,emplacement_id,quantite,updated_at,materiels(nom,code,unite),emplacements_stock(nom,type,disponible)',
      )
      .order('quantite', { ascending: false })
    let trucksRequest = supabase
      .from('camions')
      .select('id,groupe_id,immatriculation,agence,statut,commentaire,est_camion_grue,racine_vehicule,type_vehicule,loueur')
      .order('immatriculation')
    let vgpRequest = supabase
      .from('controles_vgp')
      .select('id,groupe_id,camion_id,controle_type,date_controle,date_echeance,organisme,resultat,commentaire,created_at,camions(immatriculation,agence,racine_vehicule,type_vehicule,loueur)')
      .order('date_echeance', { ascending: true })

    if (selectedGroup !== ALL_GROUPS) {
      stocksRequest = stocksRequest.eq('groupe_id', selectedGroup)
      ordersRequest = ordersRequest.eq('groupe_id', selectedGroup)
      suppliersRequest = suppliersRequest.eq('groupe_id', selectedGroup)
      locationsRequest = locationsRequest.eq('groupe_id', selectedGroup)
      locationStocksRequest = locationStocksRequest.eq('groupe_id', selectedGroup)
      trucksRequest = trucksRequest.eq('groupe_id', selectedGroup)
      vgpRequest = vgpRequest.eq('groupe_id', selectedGroup)
    }
    const historyRequest = supabase.rpc('lister_historique_inventaires', {
      p_groupe_id: selectedGroup === ALL_GROUPS ? null : selectedGroup,
      p_limit: 200,
    })

    const [stockResult, moveResult, orderResult, supplierResult, locationResult, locationStockResult, truckResult, vgpResult, historyResult] =
      await Promise.all([
        stocksRequest,
        fetchAllMovements(selectedGroup),
        ordersRequest,
        suppliersRequest,
        locationsRequest,
        locationStocksRequest,
        trucksRequest,
        vgpRequest,
        historyRequest,
      ])

    const results = [stockResult, moveResult, orderResult, supplierResult, locationResult, locationStockResult, truckResult, vgpResult, historyResult]
    const firstError = results.find((result) => result.error)?.error

    if (firstError) {
      setError(firstError.message)
    } else {
      setStocks((stockResult.data || []) as unknown as Stock[])
      setMoves((moveResult.data || []) as Mouvement[])
      setOrders((orderResult.data || []) as unknown as CommandeFournisseur[])
      setSuppliers((supplierResult.data || []) as Fournisseur[])
      setLocations((locationResult.data || []) as EmplacementStock[])
      setLocationStocks((locationStockResult.data || []) as unknown as StockEmplacement[])
      setTrucks((truckResult.data || []) as Camion[])
      setVgpControls((vgpResult.data || []) as unknown as ControleVgp[])
      setInventoryHistory((historyResult.data || []) as HistoriqueInventaire[])
    }
    setLoading(false)
  }, [profile, selectedGroup, session])

  useEffect(() => {
    if (!configured) {
      setError('Configuration Supabase manquante.')
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setAuthMode('recovery')
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let cancelled = false
    async function initializeAccess() {
      if (!session) {
        setProfile(null)
        setGroups([])
        setSelectedGroup('')
        clearData()
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')
      const { data: profileData, error: profileError } = await supabase
        .from('profils')
        .select('nom,role,groupe_id,acces_global,actif')
        .eq('id', session.user.id)
        .single()

      if (cancelled) return
      if (profileError || !profileData?.actif) {
        setProfile(null)
        setGroups([])
        clearData()
        setError('Ce compte ne possède pas d’accès actif au suivi de stock.')
        setLoading(false)
        return
      }

      const nextProfile = profileData as Profile
      setProfile(nextProfile)
      const { data: groupData, error: groupError } = await supabase
        .from('groupes')
        .select('id,nom,agence,actif')
        .eq('actif', true)
        .order('id')

      if (cancelled) return
      if (groupError) {
        setError(groupError.message)
        setLoading(false)
        return
      }

      const accessibleGroups = (groupData || []) as Groupe[]
      setGroups(accessibleGroups)
      const initialGroup = nextProfile.groupe_id || accessibleGroups[0]?.id || (nextProfile.acces_global ? ALL_GROUPS : '')
      setSelectedGroup(initialGroup)
    }
    initializeAccess()
    return () => {
      cancelled = true
    }
  }, [clearData, session])

  useEffect(() => {
    if (session && profile && selectedGroup) load()
  }, [load, profile, selectedGroup, session])

  const filtered = useMemo(() => {
    const normalizedQuery = query.toLowerCase()
    return stocks.filter((stock) =>
      `${stock.groupe_id} ${stock.materiels.code} ${stock.materiels.nom} ${stock.materiels.categorie}`
        .toLowerCase()
        .includes(normalizedQuery),
    )
  }, [query, stocks])

  const isAllGroups = selectedGroup === ALL_GROUPS
  const selectedGroupInfo = groups.find((group) => group.id === selectedGroup) || null
  const canWrite = Boolean(
    session &&
      profile?.actif &&
      !isAllGroups &&
      (
        profile.groupe_id === selectedGroup ||
        (profile.role === 'superviseur' && profile.acces_global)
      ),
  )
  const canEdit = Boolean(
    canWrite &&
      (profile?.role === 'admin' ||
        profile?.role === 'responsable' ||
        profile?.role === 'superviseur'),
  )
  // L'export est une lecture : pas besoin d'être sur le groupe qu'on modifie,
  // seul le rôle compte.
  const canExport = Boolean(
    session &&
      profile?.actif &&
      (profile?.role === 'admin' || profile?.role === 'responsable' || profile?.role === 'superviseur'),
  )
  const visibleTabs = tabs.filter(([id]) => id !== 'export' || canExport)

  const navigate = (nextTab: Tab) => {
    setTab(nextTab)
    setMenu(false)
    setQuery('')
  }

  const chooseGroup = (groupId: string) => {
    setSelectedGroup(groupId)
    setMovement(false)
    setEditingMovement(null)
    setScanner(false)
    setThresholdStock(null)
    setInventoryStock(null)
    setTruckForm(false)
    setEditingTruck(null)
  }

  const closeMovement = () => {
    setMovement(false)
    setEditingMovement(null)
    setMovementSeed(null)
  }

  const brandCode = isAllGroups ? 'MULTI' : selectedGroup || 'STOCK'
  const brandLocation = isAllGroups ? 'Vue consolidée' : selectedGroupInfo?.agence || 'Suivi de stock'

  return (
    <div className="app">
      <aside className={menu ? 'open' : ''}>
        <div className="brand">
          <div className={`brand-mark ${isAllGroups ? 'multi' : ''}`}>{brandCode}</div>
          <div>
            <strong>Suivi de stock</strong>
            <small>{brandLocation}</small>
          </div>
          <button className="close-menu" onClick={() => setMenu(false)} aria-label="Fermer le menu">
            <X />
          </button>
        </div>
        <nav>
          {visibleTabs.map(([id, label, Icon]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => navigate(id)}>
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="security">
          <ShieldCheck />
          <div>
            <strong>Données sécurisées</strong>
            <span>
              {profile?.role === 'lecture'
                ? 'Accès en lecture seule'
                : profile?.role === 'superviseur'
                  ? 'Accès superviseur global'
                  : 'Supabase · RLS actif'}
            </span>
          </div>
        </div>
        <button className="legal-link" onClick={() => setLegalOpen(true)}>
          Confidentialité &amp; mentions légales
        </button>
      </aside>

      <main>
        <header className="topbar">
          <button className="menu-btn" onClick={() => setMenu(true)} aria-label="Ouvrir le menu">
            <Menu />
          </button>
          <div className="page-title">
            <span className="eyebrow">{isAllGroups ? 'Tous les groupes' : `Groupe ${selectedGroup || '—'}`}</span>
            <h1>{tabs.find(([id]) => id === tab)?.[1]}</h1>
          </div>
          <div className="top-actions">
            {profile?.acces_global && groups.length > 1 && (
              <label className="group-switcher">
                <Layers3 />
                <select value={selectedGroup} onChange={(event) => chooseGroup(event.target.value)}>
                  <option value={ALL_GROUPS}>Tous les groupes</option>
                  {groups.map((group) => (
                    <option value={group.id} key={group.id}>
                      {groupLabel(group)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {profile?.role === 'superviseur' && isAllGroups && (
              <span className="access-pill">
                <Eye /> Vue globale · choisissez un groupe pour modifier
              </span>
            )}
            {(profile?.role === 'lecture' || (profile?.role === 'superviseur' && !isAllGroups)) && (
              <span className="access-pill">
                <Eye /> {profile.role === 'superviseur' ? 'Superviseur · modification autorisée' : 'Lecture seule'}
              </span>
            )}
            <button className="refresh" onClick={load} title="Actualiser" disabled={!session}>
              <RefreshCw className={loading ? 'spin' : ''} />
            </button>
            {canWrite && (
              <button className="scan-btn" onClick={() => setScanner(true)} title="Scanner un article">
                <ScanLine />
                <span>Scanner</span>
              </button>
            )}
            {session ? (
              <button className="user-pill" onClick={() => supabase.auth.signOut()}>
                <CircleUserRound />
                <span>{profile?.nom || session.user.email}</span>
                <LogOut />
              </button>
            ) : (
              <button className="login-btn" onClick={() => setAuthMode('login')}>
                <LogIn /> Connexion
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="error">
            <strong>Impossible de charger les données</strong>
            <span>{error}</span>
          </div>
        )}

        <div className="content">
          {tab === 'dashboard' && (
            <Dashboard
              stocks={stocks}
              moves={moves}
              orders={orders}
              trucks={trucks}
              controls={vgpControls}
              groups={groups}
              isAllGroups={isAllGroups}
              currentGroup={selectedGroupInfo}
              navigate={navigate}
              selectGroup={chooseGroup}
            />
          )}
          {tab === 'stocks' && (
            <Stocks rows={filtered} query={query} setQuery={setQuery} showGroups={isAllGroups} canEdit={canEdit} onInventory={setInventoryStock} />
          )}
          {tab === 'mouvements' && (
            <Movements
              rows={moves}
              canWrite={canWrite}
              canEdit={canEdit}
              showGroups={isAllGroups}
              add={() => setMovement(true)}
              edit={setEditingMovement}
            />
          )}
          {tab === 'commandes' && (
            <OrdersView
              groupId={selectedGroup}
              stocks={stocks}
              orders={orders}
              suppliers={suppliers}
              locations={locations}
              canEdit={canEdit}
              showGroups={isAllGroups}
              onReload={load}
              onEditThreshold={setThresholdStock}
            />
          )}
          {tab === 'emplacements' && (
            <LocationsView locations={locations} locationStocks={locationStocks} showGroups={isAllGroups} />
          )}
          {tab === 'historique' && (
            <HistoriqueView rows={inventoryHistory} showGroups={isAllGroups} />
          )}
          {tab === 'camions' && (
            <Trucks
              rows={trucks}
              showGroups={isAllGroups}
              canEdit={canEdit}
              onAdd={() => setTruckForm(true)}
              onEdit={setEditingTruck}
            />
          )}
          {tab === 'vgp' && (
            <VgpView
              trucks={trucks}
              controls={vgpControls}
              showGroups={isAllGroups}
              canEdit={canEdit}
              onReload={load}
            />
          )}
          {tab === 'export' && canExport && (
            <ExportView moves={moves} orders={orders} groupLabel={isAllGroups ? 'tous-groupes' : selectedGroup} />
          )}
        </div>

        <nav className="bottom-nav">
          {mobileTabs.map(([id, label, Icon]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => navigate(id)}>
              <Icon />
              <span>{label.split(' ')[0]}</span>
            </button>
          ))}
        </nav>
      </main>

      {authMode && (
        <AuthModal
          mode={authMode}
          onModeChange={setAuthMode}
          onClose={() => setAuthMode(null)}
        />
      )}
      {legalOpen && <LegalModal onClose={() => setLegalOpen(false)} />}
      {(movement || editingMovement) && session && selectedGroup !== ALL_GROUPS && (
        <MovementForm
          stocks={stocks}
          locations={locations}
          groupId={selectedGroup}
          userId={session.user.id}
          editing={editingMovement}
          initialMaterialId={movementSeed?.materialId}
          initialType={movementSeed?.type}
          onClose={closeMovement}
          onDone={() => {
            closeMovement()
            load()
          }}
        />
      )}
      {scanner && (
        <ScannerModal
          stocks={stocks}
          canEdit={canEdit}
          onClose={() => setScanner(false)}
          onReload={load}
          onPick={(materialId, type) => {
            setScanner(false)
            if (type === 'inventaire') {
              setInventoryStock(stocks.find((stock) => stock.materiel_id === materialId) || null)
              return
            }
            setMovementSeed({ materialId, type })
            setMovement(true)
          }}
        />
      )}
      {thresholdStock && (
        <ThresholdForm
          stock={thresholdStock}
          onClose={() => setThresholdStock(null)}
          onDone={() => {
            setThresholdStock(null)
            load()
          }}
        />
      )}
      {inventoryStock && (
        <InventoryAdjustmentForm
          stock={inventoryStock}
          locations={locations}
          locationStocks={locationStocks}
          onClose={() => setInventoryStock(null)}
          onDone={() => {
            setInventoryStock(null)
            load()
          }}
        />
      )}
      {(truckForm || editingTruck) && selectedGroup !== ALL_GROUPS && (
        <TruckForm
          truck={editingTruck}
          groupId={selectedGroup}
          defaultAgency={selectedGroupInfo?.agence || ''}
          onClose={() => {
            setTruckForm(false)
            setEditingTruck(null)
          }}
          onDone={() => {
            setTruckForm(false)
            setEditingTruck(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function Dashboard({
  stocks,
  moves,
  orders,
  trucks,
  controls,
  groups,
  isAllGroups,
  currentGroup,
  navigate,
  selectGroup,
}: {
  stocks: Stock[]
  moves: Mouvement[]
  orders: CommandeFournisseur[]
  trucks: Camion[]
  controls: ControleVgp[]
  groups: Groupe[]
  isAllGroups: boolean
  currentGroup: Groupe | null
  navigate: (tab: Tab) => void
  selectGroup: (groupId: string) => void
}) {
  const [kindFilter, setKindFilter] = useState<TaskKind | 'all'>('all')

  const tasks = useMemo(() => buildTasks({ stocks, orders, trucks, controls }), [stocks, orders, trucks, controls])

  const counts = useMemo(() => {
    const map = new Map<TaskKind, number>()
    for (const task of tasks) map.set(task.kind, (map.get(task.kind) || 0) + 1)
    return map
  }, [tasks])

  // Un filtre qui ne correspond plus à rien afficherait une liste vide sans
  // raison visible : on retombe sur la liste complète.
  const activeFilter = kindFilter !== 'all' && !counts.has(kindFilter) ? 'all' : kindFilter
  const visible = activeFilter === 'all' ? tasks : tasks.filter((task) => task.kind === activeFilter)
  const critical = tasks.filter((task) => task.severity === 'critique').length
  const units = stocks.reduce((sum, stock) => sum + stock.quantite, 0)
  const pendingOrders = orders.filter((order) => order.statut === 'commande' || order.statut === 'en_livraison').length

  return (
    <>
      <section className="hero worklist-hero">
        <div>
          <span className="eyebrow">{isAllGroups ? 'Vue consolidée' : currentGroup?.agence || 'Dépôt'}</span>
          <h2>
            {tasks.length === 0
              ? <>Rien ne demande<br />votre attention.</>
              : <>{tasks.length} chose{tasks.length > 1 ? 's' : ''} vous {tasks.length > 1 ? 'attendent' : 'attend'}.</>}
          </h2>
          <p>
            {tasks.length === 0
              ? 'Stocks au-dessus des seuils, commandes réceptionnées.'
              : critical > 0
                ? `Dont ${critical} à traiter en priorité.`
                : 'Rien d’urgent, mais autant s’en occuper maintenant.'}
          </p>
        </div>
        <div className="hero-figures">
          <div><strong>{units}</strong><span>unités en stock</span></div>
          <div><strong className={counts.get('stock') ? 'warn' : ''}>{counts.get('stock') || 0}</strong><span>alertes stock</span></div>
          <div><strong className={counts.get('securite') ? 'warn' : ''}>{counts.get('securite') || 0}</strong><span>points sécurité</span></div>
          <div><strong className={pendingOrders ? 'warn' : ''}>{pendingOrders}</strong><span>commandes en attente</span></div>
        </div>
      </section>

      {isAllGroups && (
        <GroupOverview groups={groups} stocks={stocks} onSelect={selectGroup} />
      )}

      <section className="panel worklist-panel">
        <div className="worklist-head">
          <h3>File de travail</h3>
          <div className="task-filters">
            <button className={activeFilter === 'all' ? 'active' : ''} onClick={() => setKindFilter('all')}>
              Tout · {tasks.length}
            </button>
            {(Object.keys(KIND_LABEL) as TaskKind[])
              .filter((kind) => counts.has(kind))
              .map((kind) => (
                <button key={kind} className={activeFilter === kind ? 'active' : ''} onClick={() => setKindFilter(kind)}>
                  {KIND_LABEL[kind]} · {counts.get(kind)}
                </button>
              ))}
          </div>
        </div>
        {visible.length ? (
          <div className="worklist">
            {visible.map((task) => (
              <div className={`worklist-row ${task.severity}`} key={task.id}>
                <div>
                  <div className="worklist-title">
                    <span className={`task-chip ${task.severity}`}>{KIND_LABEL[task.kind]}</span>
                    <b>{task.title}</b>
                  </div>
                  <span>{task.detail}</span>
                </div>
                <button className="task-action" onClick={() => navigate(task.tab)}>{task.action}</button>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="Tout est en ordre" text="Aucune action en attente sur ce périmètre." />
        )}
      </section>

      <section className="panel">
        <PanelHead title="Derniers mouvements" action={() => navigate('mouvements')} />
        <MoveList rows={moves.slice(0, 5)} showGroups={isAllGroups} />
      </section>
    </>
  )
}

function GroupOverview({
  groups,
  stocks,
  onSelect,
}: {
  groups: Groupe[]
  stocks: Stock[]
  onSelect: (groupId: string) => void
}) {
  return (
    <section className="group-overview">
      {groups.map((group) => {
        const groupStocks = stocks.filter((stock) => stock.groupe_id === group.id)
        const quantity = groupStocks.reduce((sum, stock) => sum + stock.quantite, 0)
        const alerts = groupStocks.filter(
          (stock) => statusOf(stock.quantite, stock.seuil_alerte) !== 'ok',
        ).length
        return (
          <button key={group.id} onClick={() => onSelect(group.id)}>
            <span>{group.agence}</span>
            <strong>{group.id}</strong>
            <div><b>{quantity}</b> unités · <b>{alerts}</b> alertes</div>
            <ChevronRight />
          </button>
        )
      })}
    </section>
  )
}

function PanelHead({ title, action }: { title: string; action: () => void }) {
  return <header className="panel-head"><h3>{title}</h3><button onClick={action}>Tout voir <ChevronRight /></button></header>
}

function Stocks({
  rows,
  query,
  setQuery,
  showGroups,
  canEdit,
  onInventory,
}: {
  rows: Stock[]
  query: string
  setQuery: (value: string) => void
  showGroups: boolean
  canEdit: boolean
  onInventory: (stock: Stock) => void
}) {
  return (
    <section className="panel full">
      <div className="toolbar">
        <div className="search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un article…" /></div>
        <span>{rows.length} référence{rows.length > 1 ? 's' : ''}</span>
      </div>
      {canEdit && <div className="notice inventory-help"><ClipboardCheck />Pendant un inventaire, utilisez « Ajuster » : la quantité comptée remplace le stock de l’emplacement sans ajouter de mouvement.</div>}
      <div className={`stock-table ${showGroups ? 'show-groups' : ''} ${canEdit ? 'with-inventory' : ''}`}>
        <div className="table-head">
          <span>Article</span>
          {showGroups && <span>Groupe</span>}
          <span>Catégorie</span>
          <span>Emplacement</span>
          <span>Quantité</span>
          <span>État</span>
          {canEdit && <span>Inventaire</span>}
        </div>
        {rows.map((stock) => (
          <div className="table-row" key={stock.id}>
            <div className="article">
              <div className="item-icon"><Package /></div>
              <div><strong>{stock.materiels.nom}</strong><span>{showGroups && `${stock.groupe_id} · `}{stock.materiels.code}</span></div>
            </div>
            {showGroups && <span><span className="group-chip">{stock.groupe_id}</span></span>}
            <span>{stock.materiels.categorie}</span>
            <span>{stock.emplacement}</span>
            <div className="quantity"><strong>{stock.quantite}</strong><small>{stock.materiels.unite}</small></div>
            <StockBadge q={stock.quantite} seuil={stock.seuil_alerte} />
            {canEdit && <button className="edit-move inventory-adjust" onClick={() => onInventory(stock)} title={`Ajuster l’inventaire de ${stock.materiels.nom}`}><ClipboardCheck /><span>Ajuster</span></button>}
          </div>
        ))}
      </div>
    </section>
  )
}

function MoveList({
  rows,
  onEdit,
  showGroups = false,
}: {
  rows: Mouvement[]
  onEdit?: (movement: Mouvement) => void
  showGroups?: boolean
}) {
  return (
    <div className="move-list">
      {rows.map((move) => {
        const meta = movementMeta[move.type] || movementMeta.inventaire
        const Icon = meta.icon
        const place = move.type === 'transfert'
          ? `${move.emplacements_source?.nom || 'Source'} → ${move.emplacements_destination?.nom || 'Destination'}`
          : move.emplacements_source?.nom || move.emplacements_destination?.nom || move.emplacement || 'Dépôt'
        return (
          <div key={move.id}>
            <div className={`move-icon ${meta.className}`}><Icon /></div>
            <div>
              <strong>{meta.label} · {move.materiels.nom}</strong>
              <span>{showGroups && `${move.groupe_id} · `}{place} · {fmt.format(new Date(move.date_heure))}</span>
            </div>
            <b className={meta.className}>
              {['entree', 'retour'].includes(move.type) ? '+' : ['sortie', 'hs', 'perdu'].includes(move.type) ? '−' : move.type === 'transfert' ? '↔' : ''}
              {move.quantite}
            </b>
            {onEdit && move.type !== 'inventaire' && (
              <button className="edit-move" onClick={() => onEdit(move)} title="Corriger cette saisie"><Pencil /><span>Corriger</span></button>
            )}
          </div>
        )
      })}
      {!rows.length && <Empty title="Aucun mouvement" text="Les opérations apparaîtront ici." />}
    </div>
  )
}

function Movements({
  rows,
  canWrite,
  canEdit,
  showGroups,
  add,
  edit,
}: {
  rows: Mouvement[]
  canWrite: boolean
  canEdit: boolean
  showGroups: boolean
  add: () => void
  edit: (movement: Mouvement) => void
}) {
  return (
    <section className="panel full">
      <div className="toolbar">
        <div><h3>Journal des mouvements</h3><p>Historique des entrées, sorties et inventaires.</p></div>
        {canWrite && <button className="primary" onClick={add}><Plus /> Nouveau mouvement</button>}
      </div>
      {!canWrite && <div className="notice"><ShieldCheck /> Consultation uniquement : aucune modification n’est autorisée dans cette vue.</div>}
      <MoveList rows={rows} onEdit={canEdit ? edit : undefined} showGroups={showGroups} />
    </section>
  )
}

function AuthModal({
  mode,
  onModeChange,
  onClose,
}: {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)

  const changeMode = (nextMode: AuthMode) => {
    setPassword('')
    setConfirmation('')
    setMessage('')
    setSuccess(false)
    onModeChange(nextMode)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setSuccess(false)

    const normalizedEmail = email.trim().toLowerCase()

    if ((mode === 'signup' || mode === 'recovery') && password !== confirmation) {
      setMessage('Les deux mots de passe ne correspondent pas.')
      setBusy(false)
      return
    }

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })
      setBusy(false)
      if (error?.code === 'email_not_confirmed') {
        setMessage('Votre compte existe, mais l’adresse e-mail n’est pas encore confirmée.')
      } else if (error) {
        setMessage('Adresse e-mail ou mot de passe incorrect.')
      }
      else onClose()
      return
    }

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      setBusy(false)
      if (error) {
        setMessage('Impossible de créer le compte. Vérifiez l’adresse et le mot de passe.')
      } else if (data.session) {
        onClose()
      } else {
        setSuccess(true)
        setMessage('Vérifiez votre boîte mail pour confirmer la création du compte.')
      }
      return
    }

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: window.location.origin,
      })
      setBusy(false)
      if (error) {
        setMessage('Impossible d’envoyer le lien pour le moment. Réessayez plus tard.')
      } else {
        setSuccess(true)
        setMessage('Si cette adresse possède un compte, un lien vient de lui être envoyé.')
      }
      return
    }

    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setMessage('Le mot de passe n’a pas pu être modifié. Demandez un nouveau lien.')
    } else {
      setSuccess(true)
      setMessage('Mot de passe modifié. Vous pouvez maintenant utiliser l’application.')
    }
  }

  const title =
    mode === 'signup'
      ? 'Créer mon compte'
      : mode === 'forgot'
        ? 'Mot de passe oublié'
        : mode === 'recovery'
          ? 'Nouveau mot de passe'
          : 'Connexion sécurisée'

  const intro =
    mode === 'signup'
      ? 'Utilisez exactement l’adresse e-mail autorisée pour votre groupe.'
      : mode === 'forgot'
        ? 'Nous vous enverrons un lien sécurisé pour choisir un nouveau mot de passe.'
        : mode === 'recovery'
          ? 'Choisissez un nouveau mot de passe d’au moins 8 caractères.'
          : 'Votre groupe et vos droits seront appliqués automatiquement selon votre compte.'

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <p>{intro}</p>
        {mode !== 'recovery' && (
          <label>
            Adresse e-mail
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="prenom.nom@entreprise.fr"
            />
          </label>
        )}
        {mode !== 'forgot' && (
          <label>
            {mode === 'recovery' ? 'Nouveau mot de passe' : 'Mot de passe'}
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'login' ? undefined : 8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        )}
        {(mode === 'signup' || mode === 'recovery') && (
          <label>
            Confirmer le mot de passe
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
        )}
        {message && <div className={success ? 'form-success' : 'form-error'}>{message}</div>}
        <button className="primary wide" disabled={busy}>
          {busy
            ? 'Veuillez patienter…'
            : mode === 'signup'
              ? 'Créer mon compte'
              : mode === 'forgot'
                ? 'Envoyer le lien'
                : mode === 'recovery'
                  ? 'Enregistrer le mot de passe'
                  : 'Se connecter'}
        </button>
        {mode === 'login' && (
          <div className="auth-links">
            <button type="button" onClick={() => changeMode('signup')}>Créer mon compte</button>
            <button type="button" onClick={() => changeMode('forgot')}>Mot de passe oublié ?</button>
          </div>
        )}
        {(mode === 'signup' || mode === 'forgot') && (
          <button type="button" className="auth-back" onClick={() => changeMode('login')}>
            Retour à la connexion
          </button>
        )}
      </form>
    </Modal>
  )
}

const RGPD_CONTACT_EMAIL = '[À COMPLÉTER — e-mail du contact RGPD]'

function LegalModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Confidentialité & mentions légales" onClose={onClose}>
      <div className="legal-content">
        <section>
          <h3>Éditeur & responsable de traitement</h3>
          <p>
            Raison sociale : [À COMPLÉTER]<br />
            Adresse du siège : [À COMPLÉTER]<br />
            SIRET : [À COMPLÉTER]<br />
            Directeur de la publication : [À COMPLÉTER]
          </p>
        </section>
        <section>
          <h3>Hébergement</h3>
          <p>
            Application : Render.<br />
            Base de données et authentification : Supabase.<br />
            Envoi d’e-mails transactionnels : Brevo.
          </p>
        </section>
        <section>
          <h3>Données traitées</h3>
          <p>
            Cette application traite des données d’identification professionnelles (nom, e-mail,
            rôle, groupe) et trace nominativement les actions effectuées sur les stocks et
            commandes (auteur et date de chaque saisie), à des fins de gestion opérationnelle et
            de traçabilité des mouvements de matériel.
          </p>
        </section>
        <section>
          <h3>Base légale & durée de conservation</h3>
          <p>
            Traitement fondé sur l’intérêt légitime de l’employeur à la gestion de son stock.
            Durée de conservation : [À COMPLÉTER].
          </p>
        </section>
        <section>
          <h3>Vos droits</h3>
          <p>
            Conformément au RGPD, vous disposez d’un droit d’accès, de rectification, de suppression
            et de portabilité de vos données. Pour l’exercer, contactez :{' '}
            <a href={`mailto:${RGPD_CONTACT_EMAIL}`}>{RGPD_CONTACT_EMAIL}</a>.
          </p>
        </section>
        <section>
          <h3>Information des salariés</h3>
          <p>
            Les actions réalisées dans l’application sont associées au compte de l’utilisateur
            connecté à des fins de traçabilité du matériel. Les représentants du personnel
            compétents ont été informés de la mise en place de cet outil conformément au code du
            travail.
          </p>
        </section>
      </div>
    </Modal>
  )
}

function LocationOptions({ locations }: { locations: EmplacementStock[] }) {
  return (
    <>
      {locations.map((location) => <option value={location.id} key={location.id}>{location.nom}</option>)}
    </>
  )
}

function MovementForm({
  stocks,
  locations,
  groupId,
  userId,
  editing,
  initialMaterialId,
  initialType,
  onClose,
  onDone,
}: {
  stocks: Stock[]
  locations: EmplacementStock[]
  groupId: string
  userId: string
  editing: Mouvement | null
  initialMaterialId?: string
  initialType?: string
  onClose: () => void
  onDone: () => void
}) {
  const available = locations.filter((location) => location.disponible && location.type === 'depot')
  const depot = available[0]?.id || ''
  const startDestination = editing?.emplacement_destination_id && available.some((location) => location.id === editing.emplacement_destination_id)
    ? editing.emplacement_destination_id
    : depot
  const [type, setType] = useState(editing?.type || initialType || 'sortie')
  const [material, setMaterial] = useState(editing?.materiel_id || initialMaterialId || stocks[0]?.materiel_id || '')
  const [qty, setQty] = useState(editing?.quantite ?? 1)
  const [source, setSource] = useState(editing?.emplacement_source_id || depot)
  const [destination, setDestination] = useState(startDestination)
  const [comment, setComment] = useState(editing?.commentaire || '')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const needsSource = ['sortie', 'hs', 'perdu', 'transfert'].includes(type)
  const needsDestination = ['entree', 'retour', 'transfert'].includes(type)
  const isTransfer = type === 'transfert'

  // Basculer en transfert avec le dépôt des deux côtés ne produirait qu'un
  // refus au moment d'enregistrer : mieux vaut vider la destination.
  function pickType(next: string) {
    setType(next)
    if (next === 'transfert' && destination === source) setDestination('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (type === 'transfert' && source === destination) {
      setFormError('La source et la destination doivent être différentes.')
      return
    }
    setBusy(true)
    setFormError('')
    const specialDestination = ['hs', 'perdu'].includes(type)
      ? locations.find((location) => location.type === type)?.id || null
      : null
    const sourceId = needsSource ? source : null
    const destinationId = specialDestination || (needsDestination ? destination : null)
    const sourceName = locations.find((location) => location.id === sourceId)?.nom
    const destinationName = locations.find((location) => location.id === destinationId)?.nom
    const payload = {
      groupe_id: groupId,
      materiel_id: material,
      type,
      quantite: qty,
      emplacement_source_id: sourceId,
      emplacement_destination_id: destinationId,
      emplacement: type === 'transfert'
        ? `${sourceName} → ${destinationName}`
        : destinationName || sourceName || `Dépôt ${groupId}`,
      commentaire: comment || null,
    }
    const saveError = writeError(
      editing
        ? await supabase.from('mouvements_stock').update(payload).eq('id', editing.id).select('id')
        : await supabase.from('mouvements_stock').insert({ ...payload, saisi_par: userId }).select('id'),
      'Aucune ligne modifiée : vos droits ne couvrent pas ce groupe, ou la fiche a été modifiée entre-temps.',
    )
    setBusy(false)
    if (saveError) setFormError(saveError.message)
    else onDone()
  }

  return (
    <Modal title={editing ? 'Corriger le mouvement' : `Nouveau mouvement · ${groupId}`} onClose={onClose}>
      <form onSubmit={submit} className="form">
        {editing && (
          <div className="notice"><RefreshCw />{editing.impact_stock ? 'Le stock et les emplacements seront recalculés automatiquement.' : 'Cette saisie historique ne changera pas le stock actuel.'}</div>
        )}
        <div className="field-row">
          <label>Type<select value={type} onChange={(event) => pickType(event.target.value)}>{Object.entries(movementMeta).filter(([key]) => key !== 'inventaire').map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
          <label>Quantité<input type="number" min={1} required value={qty} onChange={(event) => setQty(Number(event.target.value))} /></label>
        </div>
        <label>Article<select value={material} onChange={(event) => setMaterial(event.target.value)} required>{stocks.map((stock) => <option value={stock.materiel_id} key={stock.id}>{stock.materiels.code} · {stock.materiels.nom} ({stock.quantite})</option>)}</select></label>
        {isTransfer && (
          <div className="notice"><ArrowLeftRight />Un transfert déplace le matériel d’un emplacement à un autre en une seule saisie : le stock du groupe ne bouge pas, seule sa répartition.</div>
        )}
        {(needsSource || needsDestination) && (
          <div className="field-row">
            {needsSource && <label>{isTransfer ? 'Depuis' : 'Emplacement source'}<select value={source} onChange={(event) => setSource(event.target.value)} required><LocationOptions locations={available} /></select></label>}
            {needsDestination && <label>{isTransfer ? 'Vers' : 'Destination'}<select value={destination} onChange={(event) => setDestination(event.target.value)} required><option value="" disabled>Choisir…</option><LocationOptions locations={available} /></select></label>}
          </div>
        )}
        <label>Commentaire<textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} placeholder="Information utile…" /></label>
        {formError && <div className="form-error">{formError}</div>}
        <button className="primary wide" disabled={busy}>{busy ? 'Enregistrement…' : editing ? 'Enregistrer la correction' : 'Enregistrer le mouvement'}</button>
      </form>
    </Modal>
  )
}
