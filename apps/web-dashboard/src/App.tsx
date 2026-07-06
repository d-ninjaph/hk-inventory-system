import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { FirebaseError } from 'firebase/app'
import {
  AlertTriangle,
  ArrowDownUp,
  BarChart3,
  BookOpen,
  Boxes,
  Beef,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChefHat,
  CircleDollarSign,
  CircleHelp,
  ClipboardList,
  Cloud,
  CupSoda,
  Download,
  Edit3,
  GlassWater,
  HelpCircle,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  Package,
  PackagePlus,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Soup,
  Trash2,
  Utensils,
  UtensilsCrossed,
  Wheat,
  X,
} from 'lucide-react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore'
import './App.css'
import sevenMbLogo from './assets/7mb-logo.svg'
import { auth, db } from './lib/firebase'

type UserProfile = {
  displayName: string
  email: string
  role: 'owner' | 'admin' | 'staff'
  branchIds: string[]
  createdAt?: Timestamp
}

type Branch = {
  id: string
  name: string
  location: string
  active: boolean
  tabletCatalogStatus?: 'draft' | 'published'
  tabletCatalogPublishedAt?: Timestamp
  tabletCatalogPublishedBy?: string
  tabletCatalogUpdatedAt?: Timestamp
  createdAt?: Timestamp
}

type MenuItemRecord = {
  id: string
  branchId: string
  code: string
  name: string
  category: string
  sellingPrice: number
  seniorPwdPrice?: number
  status: 'draft' | 'ready' | 'inactive'
  setupNotes?: string
}

type InventoryItemRecord = {
  id: string
  branchId: string
  name: string
  category: string
  unit: string
  buyingCost: number
  currentStock: number
  lowStockThreshold: number
  active: boolean
}

type RecipeComponentRecord = {
  id: string
  branchId: string
  menuItemId: string
  menuItemCode: string
  inventoryItemId: string
  inventoryItemName: string
  quantity: number
  unit: string
  usageQuantity?: number
  usageUnit?: string
  stockQuantity?: number
  stockUnit?: string
  appliesTo: 'base' | 'dine_in' | 'take_out' | 'choice' | 'addon'
  choiceGroup?: string
}

type OrderRecord = {
  id: string
  branchId: string
  businessDate?: string
  orderType?: 'dine_in' | 'take_out'
  grossAmount?: number
  discountType?: string
  discountAmount?: number
  netAmount?: number
  status?: string
  createdAt?: Timestamp
}

type StockMovementRecord = {
  id: string
  branchId: string
  inventoryItemId: string
  inventoryItemName?: string
  movementType: string
  quantity: number
  unit?: string
  sourceType?: string
  notes?: string
  businessDate?: string
  createdAt?: Timestamp
}

type DaySessionRecord = {
  id: string
  branchId: string
  businessDate: string
  openedAt?: Timestamp
  closedAt?: Timestamp
  status: string
  lastSyncedAt?: Timestamp
}

type SyncEventRecord = {
  id: string
  branchId: string
  deviceId: string
  status: string
  pendingRecords?: number
  createdAt?: Timestamp
}

type RecipeDraftLine = {
  id: string
  inventoryItemId: string
  quantity: string
  usageUnit: string
}

type StockMovementKind = 'stock_in' | 'wastage' | 'spoilage' | 'mistake' | 'adjustment'

type ActiveSection = 'Overview' | 'Menu' | 'Inventory' | 'Recipes' | 'Reports' | 'Sync' | 'Settings'
type SelectOption = { label: string; value: string }

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Menu', icon: Utensils },
  { label: 'Inventory', icon: Boxes },
  { label: 'Recipes', icon: BookOpen },
  { label: 'Reports', icon: BarChart3 },
  { label: 'Sync', icon: Cloud },
  { label: 'Settings', icon: Settings },
]

const menuCategoryOptions = ['Noodles', 'Rice Meals', 'Dimsum', 'Drinks', 'Add-ons'].map((category) => ({
  label: category,
  value: category,
}))
const inventoryCategoryOptions = ['Ingredient', 'Packaging', 'Sauce', 'Drink', 'Supply'].map((category) => ({
  label: category,
  value: category,
}))
const menuStatusOptions: SelectOption[] = [
  { label: 'Draft', value: 'draft' },
  { label: 'Ready', value: 'ready' },
  { label: 'Archived', value: 'inactive' },
]
const inventoryStatusOptions: SelectOption[] = [
  { label: 'Active', value: 'active' },
  { label: 'Archived', value: 'archived' },
]
const recipeAppliesToOptions: SelectOption[] = [
  { label: 'Base item', value: 'base' },
  { label: 'Dine-in only', value: 'dine_in' },
  { label: 'Take-out only', value: 'take_out' },
  { label: 'Required choice', value: 'choice' },
  { label: 'Add-on', value: 'addon' },
]
const defaultChoiceGroupSuggestions = ['Siomai type', 'Drink size', 'Noodle size', 'Add-on choice', 'Sauce choice']
const unitOptions = ['pc', 'tub', 'kilo', 'gram', 'gallon', 'ml', 'liter'] as const
const unitSelectOptions = unitOptions.map((unit) => ({ label: unit, value: unit }))
const compactInventoryAlertPageSize = 10

const tutorialStorageKey = 'hkInventoryDashboardTutorialSeen'

const tutorialSteps = [
  {
    section: 'Overview',
    title: 'Start with the daily snapshot',
    body: 'Use Overview to check orders, sales, low-stock alerts, recipe coverage, and the fastest links into daily operating work.',
  },
  {
    section: 'Menu',
    title: 'Manage what the branch sells',
    body: 'Menu stores item codes, prices, Senior/PWD prices, and selling status. Keep items in draft until recipes are ready.',
  },
  {
    section: 'Inventory',
    title: 'Track ingredients and supplies',
    body: 'Inventory stores stock levels, reorder reminders, and manual stock movements like stock-in, wastage, spoilage, and count adjustments.',
  },
  {
    section: 'Recipes',
    title: 'Tell the system what each sale deducts',
    body: 'Recipes connect menu items to ingredients, choices, add-ons, and packaging so reports can match real stock usage.',
  },
  {
    section: 'Reports',
    title: 'Review sales and movement history',
    body: 'Reports show synced orders, discounts, stock movements, and end-of-day sessions by business date.',
  },
  {
    section: 'Sync',
    title: 'Watch tablet sync health',
    body: 'Sync shows the latest tablet events, pending records, and day-session sync status once the tablet app starts sending data.',
  },
  {
    section: 'Settings',
    title: 'Use the guide anytime',
    body: 'Settings keeps the dashboard guide available whenever the team needs a quick refresher.',
  },
] as const

const movementOptions: { value: StockMovementKind; label: string; helper: string }[] = [
  { value: 'stock_in', label: 'Stock-in', helper: 'Adds new delivered stock.' },
  { value: 'wastage', label: 'Wastage', helper: 'Deducts stock used but not sold.' },
  { value: 'spoilage', label: 'Spoilage', helper: 'Deducts expired or damaged stock.' },
  { value: 'mistake', label: 'Mistake', helper: 'Deducts stock lost from order mistakes.' },
  { value: 'adjustment', label: 'Count adjustment', helper: 'Sets stock to the counted quantity.' },
]

const pageSizeOptions = [10, 25, 50] as const

function money(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value)
}

function getBusinessDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatTimestamp(timestamp?: Timestamp) {
  if (!timestamp) {
    return 'Not recorded'
  }

  return timestamp.toDate().toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatDateOnly(value?: string) {
  return value || 'No date'
}

function getPageCount(totalItems: number, pageSize: number) {
  return Math.max(1, Math.ceil(totalItems / pageSize))
}

function getPagedItems<T>(items: T[], currentPage: number, pageSize: number) {
  const startIndex = (currentPage - 1) * pageSize

  return items.slice(startIndex, startIndex + pageSize)
}

function getPaginationLabel(totalItems: number, currentPage: number, pageSize: number) {
  if (!totalItems) {
    return 'No items found'
  }

  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(totalItems, currentPage * pageSize)

  return `Showing ${start}-${end} of ${totalItems}`
}

function getCompatibleUsageUnits(stockUnit: string) {
  if (stockUnit === 'kilo') {
    return ['gram', 'kilo']
  }

  if (stockUnit === 'liter') {
    return ['ml', 'liter']
  }

  return [stockUnit]
}

function convertToStockUnit(quantity: number, usageUnit: string, stockUnit: string) {
  if (usageUnit === stockUnit) {
    return quantity
  }

  if (usageUnit === 'gram' && stockUnit === 'kilo') {
    return quantity / 1000
  }

  if (usageUnit === 'ml' && stockUnit === 'liter') {
    return quantity / 1000
  }

  return quantity
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

function escapeCsvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function getLoginErrorMessage(error: unknown) {
  if (error instanceof FirebaseError && error.code === 'auth/too-many-requests') {
    return 'Too many failed login attempts. Please wait a few minutes, then try again.'
  }

  return 'Login failed. Check the email and password, then try again.'
}

function getStockStatus(item: InventoryItemRecord) {
  if (!item.active) {
    return 'Inactive'
  }

  if (item.currentStock <= 0) {
    return 'Critical'
  }

  if (item.currentStock <= item.lowStockThreshold) {
    return 'Reorder'
  }

  return 'OK'
}

function isOpenOrder(order: OrderRecord) {
  return !['cancelled', 'void', 'voided'].includes((order.status ?? '').toLowerCase())
}

function getMovementLabel(movementType: string) {
  return movementType
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getMovementSourceLabel(sourceType?: string) {
  const labels: Record<string, string> = {
    owner_dashboard: 'Dashboard entry',
    owner_sample: 'Opening balance',
    tablet_app: 'Tablet entry',
  }

  return sourceType ? (labels[sourceType] ?? getMovementLabel(sourceType)) : 'Manual entry'
}

function shouldShowCodeBadge(code: string) {
  return /^[A-Z]{1,3}\d{1,2}$/.test(code) && code.length <= 4
}

function getItemIconType(name: string, category = '', code = '') {
  const searchText = `${name} ${category} ${code}`.toLowerCase()

  if (searchText.includes('gulaman') || searchText.includes('drink')) {
    return 'drink'
  }

  if (searchText.includes('noodle')) {
    return 'noodle'
  }

  if (searchText.includes('rice') || searchText.includes('powder')) {
    return 'grain'
  }

  if (
    searchText.includes('siomai') ||
    searchText.includes('sharksfin') ||
    searchText.includes('wanton') ||
    searchText.includes('siopao') ||
    searchText.includes('dimsum')
  ) {
    return 'dimsum'
  }

  if (
    searchText.includes('packaging') ||
    searchText.includes('container') ||
    searchText.includes('tumbler') ||
    searchText.includes('lid') ||
    searchText.includes('cutlery') ||
    searchText.includes('bag')
  ) {
    return 'package'
  }

  if (searchText.includes('sauce') || searchText.includes('oil')) {
    return 'sauce'
  }

  if (searchText.includes('add')) {
    return 'addon'
  }

  return 'default'
}

function getOperationalStatusClass(status?: string) {
  const normalizedStatus = (status ?? '').toLowerCase()

  if (['synced', 'complete', 'completed', 'closed', 'ok', 'online'].includes(normalizedStatus)) {
    return 'ok'
  }

  if (['failed', 'error', 'voided', 'void', 'cancelled'].includes(normalizedStatus)) {
    return 'critical'
  }

  return 'reorder'
}

function getMenuItemSubtitle(item: MenuItemRecord) {
  if (item.status === 'ready') {
    return `${item.category} - Ready for selling`
  }

  if (item.status === 'inactive') {
    return `${item.category} - Archived, hidden from staff`
  }

  return `${item.category} - Add recipe rules before selling`
}

function getMenuStatusLabel(status: MenuItemRecord['status']) {
  return status === 'inactive' ? 'Archived' : status.charAt(0).toUpperCase() + status.slice(1)
}

function getMenuStatusClass(status: MenuItemRecord['status']) {
  if (status === 'ready') {
    return 'ready'
  }

  if (status === 'inactive') {
    return 'inactive'
  }

  return 'draft'
}

function getRecipeAppliesToLabel(appliesTo: RecipeComponentRecord['appliesTo']) {
  const labels = {
    addon: 'Add-on',
    base: 'Base item',
    choice: 'Required choice',
    dine_in: 'Dine-in only',
    take_out: 'Take-out only',
  }

  return labels[appliesTo]
}

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (error) {
      setError(getLoginErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <img className="login-logo" src={sevenMbLogo} alt="7Mb logo" />
        <div>
          <p className="eyebrow">7Mb Inventory System</p>
          <h1>Owner login</h1>
        </div>
        <label>
          Email
          <input
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter email"
            type="email"
            value={email}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            type="password"
            value={password}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-button full-width" disabled={isSubmitting} type="submit">
          {isSubmitting ? <Loader2 className="spin" size={18} /> : <LogIn size={18} />}
          Sign in
        </button>
      </form>
    </main>
  )
}

function LoadingScreen() {
  return (
    <main className="loading-page">
      <Loader2 className="spin" size={28} />
      Loading dashboard
    </main>
  )
}

function SetupWarning({ message }: { message: string }) {
  return (
    <main className="loading-page">
      <AlertTriangle size={28} />
      {message}
    </main>
  )
}

function Dashboard({ branch, profile }: { branch: Branch; profile: UserProfile }) {
  const [activeSection, setActiveSection] = useState<ActiveSection>('Overview')
  const [menuItems, setMenuItems] = useState<MenuItemRecord[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItemRecord[]>([])
  const [recipeComponents, setRecipeComponents] = useState<RecipeComponentRecord[]>([])
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovementRecord[]>([])
  const [daySessions, setDaySessions] = useState<DaySessionRecord[]>([])
  const [syncEvents, setSyncEvents] = useState<SyncEventRecord[]>([])
  const [editingMenuId, setEditingMenuId] = useState('')
  const [editingInventoryId, setEditingInventoryId] = useState('')
  const [menuForm, setMenuForm] = useState({
    code: '',
    name: '',
    category: 'Noodles',
    sellingPrice: '',
    seniorPwdPrice: '',
    status: 'draft',
  })
  const [inventoryForm, setInventoryForm] = useState({
    name: '',
    category: 'Ingredient',
    unit: 'pc',
    buyingCost: '',
    currentStock: '',
    lowStockThreshold: '',
    active: 'active',
  })
  const [movementForm, setMovementForm] = useState({
    inventoryItemId: '',
    movementType: 'stock_in' as StockMovementKind,
    quantity: '',
    businessDate: getBusinessDate(),
    notes: '',
  })
  const [recipeBatchForm, setRecipeBatchForm] = useState({
    menuItemId: '',
    appliesTo: 'base',
    choiceGroup: '',
  })
  const [recipeDraftLines, setRecipeDraftLines] = useState<RecipeDraftLine[]>([
    { id: crypto.randomUUID(), inventoryItemId: '', quantity: '', usageUnit: '' },
  ])
  const [editingRecipeId, setEditingRecipeId] = useState('')
  const [recipeEditForm, setRecipeEditForm] = useState({
    menuItemId: '',
    appliesTo: 'base' as RecipeComponentRecord['appliesTo'],
    choiceGroup: '',
    inventoryItemId: '',
    quantity: '',
    usageUnit: '',
  })
  const [recipeRuleToDelete, setRecipeRuleToDelete] = useState<RecipeComponentRecord | null>(null)
  const [isDeletingRule, setIsDeletingRule] = useState(false)
  const [tabletCatalogStatus, setTabletCatalogStatus] = useState<Branch['tabletCatalogStatus']>(
    branch.tabletCatalogStatus ?? 'draft',
  )
  const [isUpdatingTabletCatalog, setIsUpdatingTabletCatalog] = useState(false)
  const [formMessage, setFormMessage] = useState('')
  const [isTutorialOpen, setIsTutorialOpen] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.localStorage.getItem(tutorialStorageKey) !== 'true'
  })
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0)
  const todayBusinessDate = getBusinessDate()
  const branchStatus = useMemo(() => (branch.active ? 'Active branch' : 'Inactive branch'), [branch.active])
  const isTabletCatalogPublished = tabletCatalogStatus === 'published'
  const reorderCount = inventoryItems.filter((item) => getStockStatus(item) === 'Reorder' || getStockStatus(item) === 'Critical').length
  const todayOrders = orders.filter((order) => order.businessDate === todayBusinessDate && isOpenOrder(order))
  const todaySales = todayOrders.reduce((total, order) => total + (order.netAmount ?? order.grossAmount ?? 0), 0)

  useEffect(() => {
    const menuQuery = query(collection(db, 'menuItems'), where('branchId', '==', branch.id))
    const inventoryQuery = query(collection(db, 'inventoryItems'), where('branchId', '==', branch.id))
    const recipeQuery = query(collection(db, 'recipeComponents'), where('branchId', '==', branch.id))
    const ordersQuery = query(collection(db, 'orders'), where('branchId', '==', branch.id))
    const stockMovementsQuery = query(collection(db, 'stockMovements'), where('branchId', '==', branch.id))
    const daySessionsQuery = query(collection(db, 'daySessions'), where('branchId', '==', branch.id))
    const syncEventsQuery = query(collection(db, 'syncEvents'), where('branchId', '==', branch.id))

    const unsubscribeMenu = onSnapshot(menuQuery, (snapshot) => {
      const nextItems = snapshot.docs
        .map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }) as MenuItemRecord)
        .sort((first, second) => first.code.localeCompare(second.code))
      setMenuItems(nextItems)
    })

    const unsubscribeInventory = onSnapshot(inventoryQuery, (snapshot) => {
      const nextItems = snapshot.docs
        .map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }) as InventoryItemRecord)
        .sort((first, second) => first.name.localeCompare(second.name))
      setInventoryItems(nextItems)
    })

    const unsubscribeRecipes = onSnapshot(recipeQuery, (snapshot) => {
      const nextItems = snapshot.docs
        .map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }) as RecipeComponentRecord)
        .sort((first, second) => first.menuItemCode.localeCompare(second.menuItemCode))
      setRecipeComponents(nextItems)
    })

    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const nextItems = snapshot.docs
        .map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }) as OrderRecord)
        .sort((first, second) => (second.createdAt?.toMillis() ?? 0) - (first.createdAt?.toMillis() ?? 0))
      setOrders(nextItems)
    })

    const unsubscribeStockMovements = onSnapshot(stockMovementsQuery, (snapshot) => {
      const nextItems = snapshot.docs
        .map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }) as StockMovementRecord)
        .sort((first, second) => (second.createdAt?.toMillis() ?? 0) - (first.createdAt?.toMillis() ?? 0))
      setStockMovements(nextItems)
    })

    const unsubscribeDaySessions = onSnapshot(daySessionsQuery, (snapshot) => {
      const nextItems = snapshot.docs
        .map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }) as DaySessionRecord)
        .sort((first, second) => second.businessDate.localeCompare(first.businessDate))
      setDaySessions(nextItems)
    })

    const unsubscribeSyncEvents = onSnapshot(syncEventsQuery, (snapshot) => {
      const nextItems = snapshot.docs
        .map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }) as SyncEventRecord)
        .sort((first, second) => (second.createdAt?.toMillis() ?? 0) - (first.createdAt?.toMillis() ?? 0))
      setSyncEvents(nextItems)
    })

    return () => {
      unsubscribeMenu()
      unsubscribeInventory()
      unsubscribeRecipes()
      unsubscribeOrders()
      unsubscribeStockMovements()
      unsubscribeDaySessions()
      unsubscribeSyncEvents()
    }
  }, [branch.id])

  function openTutorial() {
    setTutorialStepIndex(0)
    setIsTutorialOpen(true)
  }

  function closeTutorial() {
    window.localStorage.setItem(tutorialStorageKey, 'true')
    setIsTutorialOpen(false)
  }

  function resetMenuForm() {
    setEditingMenuId('')
    setMenuForm({
      code: '',
      name: '',
      category: 'Noodles',
      sellingPrice: '',
      seniorPwdPrice: '',
      status: 'draft',
    })
  }

  function resetInventoryForm() {
    setEditingInventoryId('')
    setInventoryForm({
      name: '',
      category: 'Ingredient',
      unit: 'pc',
      buyingCost: '',
      currentStock: '',
      lowStockThreshold: '',
      active: 'active',
    })
  }

  function resetMovementForm() {
    setMovementForm({
      inventoryItemId: '',
      movementType: 'stock_in',
      quantity: '',
      businessDate: getBusinessDate(),
      notes: '',
    })
  }

  function startEditingMenuItem(item: MenuItemRecord) {
    setActiveSection('Menu')
    setEditingMenuId(item.id)
    setFormMessage('')
    setMenuForm({
      code: item.code,
      name: item.name,
      category: item.category,
      sellingPrice: String(item.sellingPrice),
      seniorPwdPrice: item.seniorPwdPrice ? String(item.seniorPwdPrice) : '',
      status: item.status,
    })
  }

  function startEditingInventoryItem(item: InventoryItemRecord) {
    setActiveSection('Inventory')
    setEditingInventoryId(item.id)
    setFormMessage('')
    setInventoryForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      buyingCost: String(item.buyingCost),
      currentStock: String(item.currentStock),
      lowStockThreshold: String(item.lowStockThreshold),
      active: item.active ? 'active' : 'archived',
    })
  }

  async function handleCreateMenuItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage('')

    const payload = {
      code: menuForm.code.trim().toUpperCase(),
      name: menuForm.name.trim(),
      category: menuForm.category,
      sellingPrice: Number(menuForm.sellingPrice),
      seniorPwdPrice: menuForm.seniorPwdPrice ? Number(menuForm.seniorPwdPrice) : null,
      status: menuForm.status,
      updatedAt: serverTimestamp(),
    }

    if (editingMenuId) {
      await updateDoc(doc(db, 'menuItems', editingMenuId), payload)
      setFormMessage('Menu item updated.')
    } else {
      await addDoc(collection(db, 'menuItems'), {
        ...payload,
        branchId: branch.id,
        setupNotes: 'Add recipe rules before selling',
        createdAt: serverTimestamp(),
      })
      setFormMessage('Menu item saved.')
    }

    resetMenuForm()
  }

  async function handleCreateInventoryItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage('')

    const payload = {
      name: inventoryForm.name.trim(),
      category: inventoryForm.category,
      unit: inventoryForm.unit,
      buyingCost: Number(inventoryForm.buyingCost),
      currentStock: Number(inventoryForm.currentStock),
      lowStockThreshold: Number(inventoryForm.lowStockThreshold),
      supplierPriceType: 'discounted',
      active: inventoryForm.active === 'active',
      updatedAt: serverTimestamp(),
    }

    if (editingInventoryId) {
      await updateDoc(doc(db, 'inventoryItems', editingInventoryId), payload)
      setFormMessage('Inventory item updated.')
    } else {
      await addDoc(collection(db, 'inventoryItems'), {
        ...payload,
        branchId: branch.id,
        createdAt: serverTimestamp(),
      })
      setFormMessage('Inventory item saved.')
    }

    resetInventoryForm()
  }

  async function handleCreateStockMovement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage('')

    const inventoryItem = inventoryItems.find((item) => item.id === movementForm.inventoryItemId)
    const quantity = Number(movementForm.quantity)

    if (!inventoryItem || quantity < 0 || Number.isNaN(quantity) || (movementForm.movementType !== 'adjustment' && quantity === 0)) {
      setFormMessage('Choose an inventory item and enter a valid quantity.')
      return
    }

    const nextStock =
      movementForm.movementType === 'stock_in'
        ? inventoryItem.currentStock + quantity
        : movementForm.movementType === 'adjustment'
          ? quantity
          : Math.max(inventoryItem.currentStock - quantity, 0)

    const movementQuantity = nextStock - inventoryItem.currentStock

    await Promise.all([
      updateDoc(doc(db, 'inventoryItems', inventoryItem.id), {
        currentStock: nextStock,
        updatedAt: serverTimestamp(),
      }),
      addDoc(collection(db, 'stockMovements'), {
        branchId: branch.id,
        inventoryItemId: inventoryItem.id,
        inventoryItemName: inventoryItem.name,
        movementType: movementForm.movementType,
        quantity: movementQuantity,
        unit: inventoryItem.unit,
        sourceType: 'owner_dashboard',
        businessDate: movementForm.businessDate,
        notes: movementForm.notes.trim() || null,
        createdAt: serverTimestamp(),
      }),
    ])

    setFormMessage(`${getMovementLabel(movementForm.movementType)} recorded for ${inventoryItem.name}.`)
    resetMovementForm()
  }

  function addRecipeDraftLine() {
    setRecipeDraftLines((lines) => [
      ...lines,
      { id: crypto.randomUUID(), inventoryItemId: '', quantity: '', usageUnit: '' },
    ])
  }

  function removeRecipeDraftLine(lineId: string) {
    setRecipeDraftLines((lines) =>
      lines.length === 1 ? lines : lines.filter((line) => line.id !== lineId),
    )
  }

  function updateRecipeDraftLine(lineId: string, field: 'inventoryItemId' | 'quantity' | 'usageUnit', value: string) {
    setRecipeDraftLines((lines) =>
      lines.map((line) => {
        if (line.id !== lineId) {
          return line
        }

        if (field === 'inventoryItemId') {
          const inventoryItem = inventoryItems.find((item) => item.id === value)
          return { ...line, inventoryItemId: value, usageUnit: inventoryItem?.unit ?? '' }
        }

        return { ...line, [field]: value }
      }),
    )
  }

  function resetRecipeBatchForm(menuItemId = recipeBatchForm.menuItemId) {
    setRecipeBatchForm({
      menuItemId,
      appliesTo: 'base',
      choiceGroup: '',
    })
    setRecipeDraftLines([{ id: crypto.randomUUID(), inventoryItemId: '', quantity: '', usageUnit: '' }])
  }

  function resetRecipeEditForm() {
    setEditingRecipeId('')
    setRecipeEditForm({
      menuItemId: '',
      appliesTo: 'base',
      choiceGroup: '',
      inventoryItemId: '',
      quantity: '',
      usageUnit: '',
    })
  }

  function startEditingRecipeRule(component: RecipeComponentRecord) {
    setActiveSection('Recipes')
    setEditingRecipeId(component.id)
    setFormMessage('')
    setRecipeEditForm({
      menuItemId: component.menuItemId,
      appliesTo: component.appliesTo,
      choiceGroup: component.choiceGroup ?? '',
      inventoryItemId: component.inventoryItemId,
      quantity: formatQuantity(component.usageQuantity ?? component.quantity),
      usageUnit: component.usageUnit ?? component.unit,
    })
  }

  function updateRecipeEditInventoryItem(inventoryItemId: string) {
    const inventoryItem = inventoryItems.find((item) => item.id === inventoryItemId)
    setRecipeEditForm((form) => ({
      ...form,
      inventoryItemId,
      usageUnit: inventoryItem?.unit ?? '',
    }))
  }

  async function handleCreateRecipeBatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage('')

    const menuItem = menuItems.find((item) => item.id === recipeBatchForm.menuItemId)
    const validLines = recipeDraftLines
      .map((line) => ({
        ...line,
        inventoryItem: inventoryItems.find((item) => item.id === line.inventoryItemId),
      }))
      .filter((line) => line.inventoryItem && Number(line.quantity) > 0)

    if (!menuItem || !validLines.length) {
      setFormMessage('Choose a menu item and add at least one valid inventory line.')
      return
    }

    await Promise.all(
      validLines.map((line) => {
        const inventoryItem = line.inventoryItem as InventoryItemRecord

        return addDoc(collection(db, 'recipeComponents'), {
          branchId: branch.id,
          menuItemId: menuItem.id,
          menuItemCode: menuItem.code,
          inventoryItemId: inventoryItem.id,
          inventoryItemName: inventoryItem.name,
          quantity: convertToStockUnit(Number(line.quantity), line.usageUnit || inventoryItem.unit, inventoryItem.unit),
          unit: inventoryItem.unit,
          usageQuantity: Number(line.quantity),
          usageUnit: line.usageUnit || inventoryItem.unit,
          stockQuantity: convertToStockUnit(Number(line.quantity), line.usageUnit || inventoryItem.unit, inventoryItem.unit),
          stockUnit: inventoryItem.unit,
          appliesTo: recipeBatchForm.appliesTo,
          choiceGroup: recipeBatchForm.choiceGroup.trim() || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }),
    )

    resetRecipeBatchForm(menuItem.id)
    setFormMessage(`${validLines.length} recipe rule${validLines.length === 1 ? '' : 's'} saved.`)
  }

  async function handleUpdateRecipeRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage('')

    const menuItem = menuItems.find((item) => item.id === recipeEditForm.menuItemId)
    const inventoryItem = inventoryItems.find((item) => item.id === recipeEditForm.inventoryItemId)
    const usageQuantity = Number(recipeEditForm.quantity)

    if (!editingRecipeId || !menuItem || !inventoryItem || usageQuantity <= 0 || Number.isNaN(usageQuantity)) {
      setFormMessage('Choose a menu item, inventory item, and valid quantity before updating.')
      return
    }

    const stockQuantity = convertToStockUnit(
      usageQuantity,
      recipeEditForm.usageUnit || inventoryItem.unit,
      inventoryItem.unit,
    )

    await updateDoc(doc(db, 'recipeComponents', editingRecipeId), {
      menuItemId: menuItem.id,
      menuItemCode: menuItem.code,
      inventoryItemId: inventoryItem.id,
      inventoryItemName: inventoryItem.name,
      quantity: stockQuantity,
      unit: inventoryItem.unit,
      usageQuantity,
      usageUnit: recipeEditForm.usageUnit || inventoryItem.unit,
      stockQuantity,
      stockUnit: inventoryItem.unit,
      appliesTo: recipeEditForm.appliesTo,
      choiceGroup: recipeEditForm.choiceGroup.trim() || null,
      updatedAt: serverTimestamp(),
    })

    resetRecipeEditForm()
    setFormMessage('Recipe rule updated.')
  }

  async function handleToggleTabletCatalog() {
    setIsUpdatingTabletCatalog(true)
    setFormMessage('')

    const nextStatus: Branch['tabletCatalogStatus'] = isTabletCatalogPublished ? 'draft' : 'published'

    try {
      await updateDoc(doc(db, 'branches', branch.id), {
        tabletCatalogPublishedAt: nextStatus === 'published' ? serverTimestamp() : null,
        tabletCatalogPublishedBy: nextStatus === 'published' ? profile.email : null,
        tabletCatalogStatus: nextStatus,
        tabletCatalogUpdatedAt: serverTimestamp(),
        tabletCatalogUnpublishedAt: nextStatus === 'draft' ? serverTimestamp() : null,
      })
      setTabletCatalogStatus(nextStatus)
      setFormMessage(nextStatus === 'published' ? 'Tablet catalog published.' : 'Tablet catalog paused.')
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : 'Unable to update the tablet catalog.')
    } finally {
      setIsUpdatingTabletCatalog(false)
    }
  }

  function requestDeleteRecipeComponent(component: RecipeComponentRecord) {
    setRecipeRuleToDelete(component)
  }

  async function confirmDeleteRecipeComponent() {
    if (!recipeRuleToDelete) {
      return
    }

    setIsDeletingRule(true)

    try {
      await deleteDoc(doc(db, 'recipeComponents', recipeRuleToDelete.id))
      setFormMessage('Recipe rule deleted.')
      setRecipeRuleToDelete(null)
    } finally {
      setIsDeletingRule(false)
    }
  }

  const recipeEditInventoryItem = inventoryItems.find((item) => item.id === recipeEditForm.inventoryItemId)
  const recipeEditUsageUnits = recipeEditInventoryItem ? getCompatibleUsageUnits(recipeEditInventoryItem.unit) : []
  const recipeEditStockQuantity =
    recipeEditInventoryItem && recipeEditForm.quantity
      ? convertToStockUnit(
          Number(recipeEditForm.quantity),
          recipeEditForm.usageUnit || recipeEditInventoryItem.unit,
          recipeEditInventoryItem.unit,
        )
      : null
  const editingRecipeRule = recipeComponents.find((component) => component.id === editingRecipeId)
  const choiceGroupSuggestions = useMemo(() => {
    const usedGroups = recipeComponents
      .map((component) => component.choiceGroup?.trim())
      .filter((choiceGroup): choiceGroup is string => Boolean(choiceGroup))

    return Array.from(new Set([...defaultChoiceGroupSuggestions, ...usedGroups]))
  }, [recipeComponents])

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <img className="brand-mark" src={sevenMbLogo} alt="7Mb logo" />
          <div>
            <p>7Mb</p>
            <strong>Food & Beverage Station</strong>
          </div>
        </div>

        <nav className="nav-list" aria-label="Dashboard navigation">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={activeSection === item.label ? 'nav-item active' : 'nav-item'}
                key={item.label}
                onClick={() => setActiveSection(item.label as ActiveSection)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <button className="nav-item logout-button" onClick={() => signOut(auth)} type="button">
          <LogOut size={18} />
          <span>Sign out</span>
        </button>
      </aside>

      <section className="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">Hongkong Style Noodles & Dimsum - {branch.name}</p>
            <h1>Owner dashboard</h1>
            <p className="subtle">
              {profile.displayName} - {profile.role} - {branchStatus}
            </p>
          </div>
          <div className="topbar-actions">
            <button className="secondary-button compact-button" onClick={openTutorial} type="button">
              <HelpCircle size={18} />
              Guide
            </button>
            <div className="sync-pill">
              <Cloud size={18} />
              Firestore connected
            </div>
          </div>
        </header>

        {activeSection === 'Overview' ? (
          <>
            <section className="status-grid" aria-label="Daily status">
              <article className="metric-card">
                <ShoppingCart size={22} />
                <p>Orders Today</p>
                <strong>{todayOrders.length}</strong>
              </article>
              <article className="metric-card">
                <CircleDollarSign size={22} />
                <p>Synced Sales</p>
                <strong>{money(todaySales)}</strong>
              </article>
              <article className="metric-card warning">
                <AlertTriangle size={22} />
                <p>Reorder Alerts</p>
                <strong>{reorderCount}</strong>
              </article>
              <article className="metric-card">
                <ClipboardList size={22} />
                <p>Recipe Rules</p>
                <strong>{recipeComponents.length}</strong>
              </article>
            </section>
            <section className="content-grid">
              <MenuListPanel
                menuItems={menuItems.slice(0, 5)}
                onAdd={() => setActiveSection('Menu')}
                onEdit={startEditingMenuItem}
                showControls={false}
              />
              <InventoryAlertsPanel inventoryItems={inventoryItems} onEdit={startEditingInventoryItem} showControls={false} />
              <SetupReadinessPanel
                inventoryItems={inventoryItems}
                menuItems={menuItems}
                onSelectSection={setActiveSection}
                recipeComponents={recipeComponents}
              />
              <OwnerTestChecklistPanel
                inventoryItems={inventoryItems}
                menuItems={menuItems}
                onSelectSection={setActiveSection}
                orders={orders}
                recipeComponents={recipeComponents}
                stockMovements={stockMovements}
              />
            </section>
          </>
        ) : null}

        {activeSection === 'Menu' ? (
          <section className="screen-grid">
            <article className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Setup</p>
                  <h2>Add menu item</h2>
                </div>
                <PackagePlus size={22} />
              </div>
              <form className="form-grid" onSubmit={handleCreateMenuItem}>
                <label>
                  <span className="label-with-help">
                    Code
                    <InfoTooltip text="Short label used on receipts and lists, such as HK1 or GUL-M." />
                  </span>
                  <input
                    onChange={(event) => setMenuForm((form) => ({ ...form, code: event.target.value }))}
                    placeholder="ex: HK10"
                    required
                    value={menuForm.code}
                  />
                </label>
                <label>
                  Name
                  <input
                    onChange={(event) => setMenuForm((form) => ({ ...form, name: event.target.value }))}
                    placeholder="ex: Pork Siomai / Sharksfin"
                    required
                    value={menuForm.name}
                  />
                </label>
                <label>
                  Category
                  <FilterSelect
                    className="field-select"
                    onChange={(value) => setMenuForm((form) => ({ ...form, category: value }))}
                    options={menuCategoryOptions}
                    value={menuForm.category}
                  />
                </label>
                <label>
                  Selling price
                  <span className="currency-field">
                    <span>PHP</span>
                    <input
                      min="0"
                      onChange={(event) => setMenuForm((form) => ({ ...form, sellingPrice: event.target.value }))}
                      placeholder="ex: 55"
                      required
                      type="number"
                      value={menuForm.sellingPrice}
                    />
                  </span>
                </label>
                <label>
                  <span className="label-with-help">
                    Senior/PWD price
                    <InfoTooltip text="Discounted selling price used when the customer qualifies for Senior or PWD pricing." />
                  </span>
                  <span className="currency-field">
                    <span>PHP</span>
                    <input
                      min="0"
                      onChange={(event) => setMenuForm((form) => ({ ...form, seniorPwdPrice: event.target.value }))}
                      placeholder="ex: 44"
                      type="number"
                      value={menuForm.seniorPwdPrice}
                    />
                  </span>
                </label>
                <label>
                  <span className="label-with-help">
                    Status
                    <InfoTooltip text="Draft items stay hidden while details are incomplete. Ready items can be used for selling." />
                  </span>
                  <FilterSelect
                    className="field-select"
                    onChange={(value) => setMenuForm((form) => ({ ...form, status: value }))}
                    options={menuStatusOptions}
                    value={menuForm.status}
                  />
                </label>
                <button className="primary-button form-submit" type="submit">
                  <Plus size={18} />
                  Save menu item
                </button>
              </form>
              {formMessage ? <p className="success-message">{formMessage}</p> : null}
            </article>
            <MenuListPanel menuItems={menuItems} onAdd={() => undefined} onEdit={startEditingMenuItem} />
          </section>
        ) : null}

        {activeSection === 'Inventory' ? (
          <section className="screen-grid inventory-grid">
            <article className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Setup</p>
                  <h2>Add inventory item</h2>
                </div>
                <Boxes size={22} />
              </div>
              <form className="form-grid" onSubmit={handleCreateInventoryItem}>
                <label>
                  Item name
                  <input
                    onChange={(event) => setInventoryForm((form) => ({ ...form, name: event.target.value }))}
                    placeholder="ex: Pork Siomai / Sharksfin"
                    required
                    value={inventoryForm.name}
                  />
                </label>
                <label>
                  <span className="label-with-help">
                    Category
                    <InfoTooltip text="Groups inventory so ingredients, packaging, sauces, drinks, and supplies are easier to filter." />
                  </span>
                  <FilterSelect
                    className="field-select"
                    onChange={(value) => setInventoryForm((form) => ({ ...form, category: value }))}
                    options={inventoryCategoryOptions}
                    value={inventoryForm.category}
                  />
                </label>
                <label>
                  <span className="label-with-help">
                    Unit
                    <InfoTooltip text="Main counting unit for this item, such as pc, kilo, ml, or gallon." />
                  </span>
                  <FilterSelect
                    className="field-select"
                    onChange={(value) => setInventoryForm((form) => ({ ...form, unit: value }))}
                    options={unitSelectOptions}
                    value={inventoryForm.unit}
                  />
                </label>
                <label>
                  <span className="label-with-help">
                    Status
                    <InfoTooltip text="Active items are available for stock tracking. Archived items stay saved but are hidden from daily use." />
                  </span>
                  <FilterSelect
                    className="field-select"
                    onChange={(value) => setInventoryForm((form) => ({ ...form, active: value }))}
                    options={inventoryStatusOptions}
                    value={inventoryForm.active}
                  />
                </label>
                <label>
                  Buying cost
                  <span className="currency-field">
                    <span>PHP</span>
                    <input
                      min="0"
                      onChange={(event) => setInventoryForm((form) => ({ ...form, buyingCost: event.target.value }))}
                      placeholder="ex: 4"
                      required
                      step="0.01"
                      type="number"
                      value={inventoryForm.buyingCost}
                    />
                  </span>
                </label>
                <label>
                  <span className="label-with-help">
                    Current stock
                    <InfoTooltip text="The quantity currently available in the branch using this item's unit." />
                  </span>
                  <input
                    min="0"
                    onChange={(event) => setInventoryForm((form) => ({ ...form, currentStock: event.target.value }))}
                    placeholder="ex: 60"
                    required
                    step="0.01"
                    type="number"
                    value={inventoryForm.currentStock}
                  />
                </label>
                <label>
                  <span className="label-with-help">
                    Reorder reminder
                    <InfoTooltip text="When stock reaches this number or lower, the item appears in inventory alerts." />
                  </span>
                  <input
                    min="0"
                    onChange={(event) =>
                      setInventoryForm((form) => ({ ...form, lowStockThreshold: event.target.value }))
                    }
                    placeholder="ex: 30"
                    required
                    step="0.01"
                    type="number"
                    value={inventoryForm.lowStockThreshold}
                  />
                </label>
                <button className="primary-button form-submit" type="submit">
                  <Plus size={18} />
                  Save inventory item
                </button>
              </form>
              {formMessage ? <p className="success-message">{formMessage}</p> : null}
            </article>
            <StockMovementPanel
              form={movementForm}
              inventoryItems={inventoryItems}
              onChange={setMovementForm}
              onSubmit={handleCreateStockMovement}
            />
            <InventoryAlertsPanel inventoryItems={inventoryItems} onEdit={startEditingInventoryItem} />
          </section>
        ) : null}

        {activeSection === 'Recipes' ? (
          <section className="screen-grid">
            <article className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Ingredients used</p>
                  <h2>Add recipe rules</h2>
                </div>
                <BookOpen size={22} />
              </div>
              <form className="recipe-builder" onSubmit={handleCreateRecipeBatch}>
                <div className="form-grid">
                  <label>
                    Menu item
                    <FilterSelect
                      className="field-select"
                      onChange={(value) => setRecipeBatchForm((form) => ({ ...form, menuItemId: value }))}
                      options={[
                        { label: 'Choose menu item', value: '' },
                        ...menuItems.map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id })),
                      ]}
                      value={recipeBatchForm.menuItemId}
                    />
                  </label>
                  <label>
                    <span className="label-with-help">
                      Applies to
                      <InfoTooltip text="Controls when this rule deducts stock: every sale, a required choice, an add-on, dine-in only, or take-out only." />
                    </span>
                    <FilterSelect
                      className="field-select"
                      onChange={(value) => setRecipeBatchForm((form) => ({ ...form, appliesTo: value }))}
                      options={recipeAppliesToOptions}
                      value={recipeBatchForm.appliesTo}
                    />
                  </label>
                  <ChoiceGroupField
                    onChange={(value) => setRecipeBatchForm((form) => ({ ...form, choiceGroup: value }))}
                    suggestions={choiceGroupSuggestions}
                    value={recipeBatchForm.choiceGroup}
                  />
                </div>

                <div className="recipe-builder-header">
                  <div>
                    <p className="eyebrow">Inventory deducted</p>
                    <h3>Add one or more items</h3>
                  </div>
                  <button className="secondary-button" onClick={addRecipeDraftLine} type="button">
                    <Plus size={18} />
                    Add row
                  </button>
                </div>

                <div className="recipe-draft-list">
                  {recipeDraftLines.map((line, index) => (
                    <RecipeDraftRow
                      inventoryItems={inventoryItems}
                      key={line.id}
                      line={line}
                      lineNumber={index + 1}
                      onRemove={removeRecipeDraftLine}
                      onUpdate={updateRecipeDraftLine}
                    />
                  ))}
                </div>

                <button className="primary-button form-submit" type="submit">
                  <Plus size={18} />
                  Save all recipe rules
                </button>
              </form>
              {formMessage ? <p className="success-message">{formMessage}</p> : null}
            </article>
            <RecipeListPanel
              components={recipeComponents}
              onDelete={requestDeleteRecipeComponent}
              onEdit={startEditingRecipeRule}
            />
          </section>
        ) : null}

        {activeSection === 'Reports' ? (
          <ReportsPanel
            daySessions={daySessions}
            orders={orders}
            stockMovements={stockMovements}
            todayBusinessDate={todayBusinessDate}
          />
        ) : null}

        {activeSection === 'Sync' ? (
          <SyncPanel daySessions={daySessions} syncEvents={syncEvents} />
        ) : null}

        {activeSection === 'Settings' ? (
          <section className="screen-grid">
            <article className="panel tablet-catalog-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Tablet app</p>
                  <h2>Tablet catalog</h2>
                </div>
                <span className={isTabletCatalogPublished ? 'badge ready' : 'badge draft'}>
                  {isTabletCatalogPublished ? 'Published' : 'Draft'}
                </span>
              </div>
              <p className="subtle">
                Keep the tablet empty while the menu, inventory, and recipe rules are still being prepared. Publish
                when staff should start using the current setup for orders.
              </p>
              <button
                className={isTabletCatalogPublished ? 'secondary-button seed-button' : 'primary-button seed-button'}
                disabled={isUpdatingTabletCatalog}
                onClick={handleToggleTabletCatalog}
                type="button"
              >
                {isUpdatingTabletCatalog ? <Loader2 className="spin" size={18} /> : <Cloud size={18} />}
                {isTabletCatalogPublished ? 'Pause tablet catalog' : 'Publish to tablet'}
              </button>
            </article>
            <article className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Help</p>
                  <h2>Dashboard guide</h2>
                </div>
              </div>
              <p className="subtle">
                Open the quick guide anytime the team needs a refresher on each dashboard section.
              </p>
              <button className="secondary-button seed-button" onClick={openTutorial} type="button">
                <HelpCircle size={18} />
                Replay dashboard guide
              </button>
              {formMessage ? <p className="success-message">{formMessage}</p> : null}
            </article>
            <article className="panel">
              <p className="eyebrow">Operating note</p>
              <h2>Sauce tracking</h2>
              <p className="subtle">
                Sauces are tracked through opening and closing counts because customers can add them freely. If the
                branch sets a standard serving amount later, the recipe rules can be updated.
              </p>
            </article>
          </section>
        ) : null}
      </section>
      {isTutorialOpen ? (
        <TutorialModal
          activeIndex={tutorialStepIndex}
          onClose={closeTutorial}
          onSelectSection={(section) => setActiveSection(section)}
          onStepChange={setTutorialStepIndex}
        />
      ) : null}
      {editingMenuId ? (
        <div className="edit-modal-backdrop" role="presentation">
          <section aria-labelledby="menu-edit-title" aria-modal="true" className="edit-modal" role="dialog">
            <button aria-label="Close menu edit" className="icon-button tutorial-close" onClick={resetMenuForm} type="button">
              <X size={18} />
            </button>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Edit menu item</p>
                <h2 id="menu-edit-title">{menuForm.name || 'Menu item'}</h2>
              </div>
            </div>
            <form className="form-grid" onSubmit={handleCreateMenuItem}>
              <label>
                <span className="label-with-help">
                  Code
                  <InfoTooltip text="Short label used on receipts and lists, such as HK1 or GUL-M." />
                </span>
                <input
                  onChange={(event) => setMenuForm((form) => ({ ...form, code: event.target.value }))}
                  required
                  value={menuForm.code}
                />
              </label>
              <label>
                Name
                <input
                  onChange={(event) => setMenuForm((form) => ({ ...form, name: event.target.value }))}
                  required
                  value={menuForm.name}
                />
              </label>
              <label>
                Category
                <FilterSelect
                  className="field-select"
                  onChange={(value) => setMenuForm((form) => ({ ...form, category: value }))}
                  options={menuCategoryOptions}
                  value={menuForm.category}
                />
              </label>
              <label>
                Selling price
                <span className="currency-field">
                  <span>PHP</span>
                  <input
                    min="0"
                    onChange={(event) => setMenuForm((form) => ({ ...form, sellingPrice: event.target.value }))}
                    required
                    type="number"
                    value={menuForm.sellingPrice}
                  />
                </span>
              </label>
              <label>
                <span className="label-with-help">
                  Senior/PWD price
                  <InfoTooltip text="Discounted selling price used when the customer qualifies for Senior or PWD pricing." />
                </span>
                <span className="currency-field">
                  <span>PHP</span>
                  <input
                    min="0"
                    onChange={(event) => setMenuForm((form) => ({ ...form, seniorPwdPrice: event.target.value }))}
                    type="number"
                    value={menuForm.seniorPwdPrice}
                  />
                </span>
              </label>
              <label>
                <span className="label-with-help">
                  Status
                  <InfoTooltip text="Draft items stay hidden while details are incomplete. Ready items can be used for selling." />
                </span>
                <FilterSelect
                  className="field-select"
                  onChange={(value) => setMenuForm((form) => ({ ...form, status: value }))}
                  options={menuStatusOptions}
                  value={menuForm.status}
                />
              </label>
              <div className="modal-actions">
                <button className="secondary-button" onClick={resetMenuForm} type="button">
                  <X size={18} />
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  <Plus size={18} />
                  Save changes
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
      {editingInventoryId ? (
        <div className="edit-modal-backdrop" role="presentation">
          <section aria-labelledby="inventory-edit-title" aria-modal="true" className="edit-modal" role="dialog">
            <button aria-label="Close inventory edit" className="icon-button tutorial-close" onClick={resetInventoryForm} type="button">
              <X size={18} />
            </button>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Edit inventory item</p>
                <h2 id="inventory-edit-title">{inventoryForm.name || 'Inventory item'}</h2>
              </div>
            </div>
            <form className="form-grid" onSubmit={handleCreateInventoryItem}>
              <label>
                Item name
                <input
                  onChange={(event) => setInventoryForm((form) => ({ ...form, name: event.target.value }))}
                  required
                  value={inventoryForm.name}
                />
              </label>
              <label>
                <span className="label-with-help">
                  Category
                  <InfoTooltip text="Groups inventory so ingredients, packaging, sauces, drinks, and supplies are easier to filter." />
                </span>
                <FilterSelect
                  className="field-select"
                  onChange={(value) => setInventoryForm((form) => ({ ...form, category: value }))}
                  options={inventoryCategoryOptions}
                  value={inventoryForm.category}
                />
              </label>
              <label>
                <span className="label-with-help">
                  Unit
                  <InfoTooltip text="Main counting unit for this item, such as pc, kilo, ml, or gallon." />
                </span>
                <FilterSelect
                  className="field-select"
                  onChange={(value) => setInventoryForm((form) => ({ ...form, unit: value }))}
                  options={unitSelectOptions}
                  value={inventoryForm.unit}
                />
              </label>
              <label>
                <span className="label-with-help">
                  Status
                  <InfoTooltip text="Active items are available for stock tracking. Archived items stay saved but are hidden from daily use." />
                </span>
                <FilterSelect
                  className="field-select"
                  onChange={(value) => setInventoryForm((form) => ({ ...form, active: value }))}
                  options={inventoryStatusOptions}
                  value={inventoryForm.active}
                />
              </label>
              <label>
                Buying cost
                <span className="currency-field">
                  <span>PHP</span>
                  <input
                    min="0"
                    onChange={(event) => setInventoryForm((form) => ({ ...form, buyingCost: event.target.value }))}
                    required
                    step="0.01"
                    type="number"
                    value={inventoryForm.buyingCost}
                  />
                </span>
              </label>
              <label>
                <span className="label-with-help">
                  Current stock
                  <InfoTooltip text="The quantity currently available in the branch using this item's unit." />
                </span>
                <input
                  min="0"
                  onChange={(event) => setInventoryForm((form) => ({ ...form, currentStock: event.target.value }))}
                  required
                  step="0.01"
                  type="number"
                  value={inventoryForm.currentStock}
                />
              </label>
              <label>
                <span className="label-with-help">
                  Reorder reminder
                  <InfoTooltip text="When stock reaches this number or lower, the item appears in inventory alerts." />
                </span>
                <input
                  min="0"
                  onChange={(event) =>
                    setInventoryForm((form) => ({ ...form, lowStockThreshold: event.target.value }))
                  }
                  required
                  step="0.01"
                  type="number"
                  value={inventoryForm.lowStockThreshold}
                />
              </label>
              <div className="modal-actions">
                <button className="secondary-button" onClick={resetInventoryForm} type="button">
                  <X size={18} />
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  <Plus size={18} />
                  Save changes
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
      {editingRecipeId ? (
        <div className="edit-modal-backdrop" role="presentation">
          <section aria-labelledby="recipe-edit-title" aria-modal="true" className="edit-modal" role="dialog">
            <button aria-label="Close recipe edit" className="icon-button tutorial-close" onClick={resetRecipeEditForm} type="button">
              <X size={18} />
            </button>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Edit recipe rule</p>
                <h2 id="recipe-edit-title">{editingRecipeRule?.inventoryItemName || 'Recipe rule'}</h2>
              </div>
            </div>
            <form className="form-grid" onSubmit={handleUpdateRecipeRule}>
              <label>
                Menu item
                <FilterSelect
                  className="field-select"
                  onChange={(value) => setRecipeEditForm((form) => ({ ...form, menuItemId: value }))}
                  options={[
                    { label: 'Choose menu item', value: '' },
                    ...menuItems.map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id })),
                  ]}
                  value={recipeEditForm.menuItemId}
                />
              </label>
              <label>
                <span className="label-with-help">
                  Applies to
                  <InfoTooltip text="Controls when this rule deducts stock: every sale, a required choice, an add-on, dine-in only, or take-out only." />
                </span>
                <FilterSelect
                  className="field-select"
                  onChange={(value) =>
                    setRecipeEditForm((form) => ({
                      ...form,
                      appliesTo: value as RecipeComponentRecord['appliesTo'],
                    }))
                  }
                  options={recipeAppliesToOptions}
                  value={recipeEditForm.appliesTo}
                />
              </label>
              <ChoiceGroupField
                onChange={(value) => setRecipeEditForm((form) => ({ ...form, choiceGroup: value }))}
                suggestions={choiceGroupSuggestions}
                value={recipeEditForm.choiceGroup}
              />
              <label>
                Inventory item
                <FilterSelect
                  className="field-select"
                  onChange={updateRecipeEditInventoryItem}
                  options={[
                    { label: 'Choose inventory item', value: '' },
                    ...inventoryItems.map((item) => ({ label: `${item.name} (${item.unit})`, value: item.id })),
                  ]}
                  value={recipeEditForm.inventoryItemId}
                />
              </label>
              <label>
                Quantity
                <input
                  min="0"
                  onChange={(event) => setRecipeEditForm((form) => ({ ...form, quantity: event.target.value }))}
                  required
                  step="0.001"
                  type="number"
                  value={recipeEditForm.quantity}
                />
              </label>
              <label>
                <span className="label-with-help">
                  Usage unit
                  <InfoTooltip text="Unit entered for the recipe amount. The system converts it back to the inventory item's stock unit when needed." />
                </span>
                <FilterSelect
                  className="field-select"
                  disabled={!recipeEditInventoryItem}
                  onChange={(value) => setRecipeEditForm((form) => ({ ...form, usageUnit: value }))}
                  options={[
                    { label: 'Choose unit', value: '' },
                    ...recipeEditUsageUnits.map((unit) => ({ label: unit, value: unit })),
                  ]}
                  value={recipeEditForm.usageUnit}
                />
              </label>
              {recipeEditInventoryItem && recipeEditStockQuantity !== null ? (
                <p className="conversion-preview wide-field">
                  Will deduct {formatQuantity(recipeEditStockQuantity)} {recipeEditInventoryItem.unit} from stock.
                </p>
              ) : null}
              <div className="modal-actions">
                <button className="secondary-button" onClick={resetRecipeEditForm} type="button">
                  <X size={18} />
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  <Plus size={18} />
                  Save changes
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
      {recipeRuleToDelete ? (
        <ConfirmDeleteModal
          body={`${recipeRuleToDelete.inventoryItemName} will be removed from ${recipeRuleToDelete.menuItemCode}. This cannot be undone.`}
          confirmLabel="Delete rule"
          isDeleting={isDeletingRule}
          onCancel={() => setRecipeRuleToDelete(null)}
          onConfirm={confirmDeleteRecipeComponent}
          title="Delete recipe rule?"
        />
      ) : null}
    </main>
  )
}

function TutorialModal({
  activeIndex,
  onClose,
  onSelectSection,
  onStepChange,
}: {
  activeIndex: number
  onClose: () => void
  onSelectSection: (section: ActiveSection) => void
  onStepChange: (index: number) => void
}) {
  const step = tutorialSteps[activeIndex]
  const isFirstStep = activeIndex === 0
  const isLastStep = activeIndex === tutorialSteps.length - 1

  function goToStep(nextIndex: number) {
    const boundedIndex = Math.min(Math.max(nextIndex, 0), tutorialSteps.length - 1)
    onStepChange(boundedIndex)
    onSelectSection(tutorialSteps[boundedIndex].section as ActiveSection)
  }

  return (
    <div className="tutorial-backdrop" role="presentation">
      <section aria-labelledby="tutorial-title" aria-modal="true" className="tutorial-modal" role="dialog">
        <button aria-label="Close guide" className="icon-button tutorial-close" onClick={onClose} type="button">
          <X size={18} />
        </button>
        <p className="eyebrow">Dashboard guide</p>
        <h2 id="tutorial-title">{step.title}</h2>
        <p className="tutorial-copy">{step.body}</p>
        <div className="tutorial-step-card">
          <span>{activeIndex + 1}</span>
          <div>
            <strong>{step.section}</strong>
            <p>{isLastStep ? 'The guide is complete. Continue managing the dashboard anytime.' : 'This section is highlighted in the sidebar.'}</p>
          </div>
        </div>
        <div className="tutorial-progress" aria-label="Guide progress">
          {tutorialSteps.map((item, index) => (
            <button
              aria-label={`Go to ${item.section}`}
              className={index === activeIndex ? 'active' : ''}
              key={item.section}
              onClick={() => goToStep(index)}
              type="button"
            />
          ))}
        </div>
        <div className="tutorial-actions">
          <button className="secondary-button" disabled={isFirstStep} onClick={() => goToStep(activeIndex - 1)} type="button">
            <ChevronLeft size={18} />
            Back
          </button>
          <button className="secondary-button" onClick={onClose} type="button">
            Skip
          </button>
          <button
            className="primary-button"
            onClick={isLastStep ? onClose : () => goToStep(activeIndex + 1)}
            type="button"
          >
            {isLastStep ? 'Finish' : 'Next'}
            {!isLastStep ? <ChevronRight size={18} /> : null}
          </button>
        </div>
      </section>
    </div>
  )
}

function ListControls({
  filterOptions,
  filterValue,
  onFilterChange,
  onSearchChange,
  secondaryFilterLabel,
  secondaryFilterOptions,
  secondaryFilterValue,
  onSecondaryFilterChange,
  searchPlaceholder,
  searchValue,
}: {
  filterOptions: { label: string; value: string }[]
  filterValue: string
  onFilterChange: (value: string) => void
  onSearchChange: (value: string) => void
  secondaryFilterLabel?: string
  secondaryFilterOptions?: { label: string; value: string }[]
  secondaryFilterValue?: string
  onSecondaryFilterChange?: (value: string) => void
  searchPlaceholder: string
  searchValue: string
}) {
  return (
    <div className="list-controls">
      <label className="search-control">
        <Search size={18} />
        <input
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          type="search"
          value={searchValue}
        />
      </label>
      <FilterSelect
        icon={<SlidersHorizontal size={17} />}
        onChange={onFilterChange}
        options={filterOptions}
        value={filterValue}
      />
      {secondaryFilterOptions && secondaryFilterValue !== undefined && onSecondaryFilterChange ? (
        <FilterSelect
          label={secondaryFilterLabel || 'Filter'}
          onChange={onSecondaryFilterChange}
          options={secondaryFilterOptions}
          value={secondaryFilterValue}
        />
      ) : null}
    </div>
  )
}

function FilterSelect({
  className = '',
  disabled = false,
  icon,
  label,
  onChange,
  options,
  value,
}: {
  className?: string
  disabled?: boolean
  icon?: ReactNode
  label?: string
  onChange: (value: string) => void
  options: SelectOption[]
  value: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedOption = options.find((option) => option.value === value) ?? options[0]

  return (
    <div
      className={['select-control filter-select', className, disabled ? 'disabled' : ''].filter(Boolean).join(' ')}
      onBlur={(event) => {
        const nextFocus = event.relatedTarget as Node | null
        if (!nextFocus || !event.currentTarget.contains(nextFocus)) {
          setIsOpen(false)
        }
      }}
    >
      <button
        aria-expanded={isOpen}
        className="filter-select-trigger"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {icon ? <span className="filter-select-icon">{icon}</span> : null}
        {label ? <span className="filter-select-label">{label}</span> : null}
        <span className="filter-select-value">{selectedOption?.label}</span>
        <ChevronDown className={isOpen ? 'filter-select-chevron open' : 'filter-select-chevron'} size={16} />
      </button>
      {isOpen && !disabled ? (
        <div className="filter-select-menu" role="listbox">
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className={option.value === value ? 'filter-select-option selected' : 'filter-select-option'}
              key={option.value}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="info-tooltip">
      <span aria-label={text} className="info-tooltip-trigger" role="button" tabIndex={0}>
        <CircleHelp size={14} />
      </span>
      <span className="info-tooltip-content" role="tooltip">
        {text}
      </span>
    </span>
  )
}

function ChoiceGroupField({
  onChange,
  suggestions,
  value,
}: {
  onChange: (value: string) => void
  suggestions: string[]
  value: string
}) {
  return (
    <label className="choice-group-field">
      <span className="label-with-help">
        Choice group
        <InfoTooltip text="Use this when customers must choose one option from a group, such as Siomai type or Drink size." />
      </span>
      <div className="choice-group-picker">
        <input
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type custom group"
          value={value}
        />
        <div className="choice-group-suggestions" aria-label="Suggested choice groups">
          {suggestions.map((suggestion) => (
            <button
              className={value === suggestion ? 'choice-group-chip selected' : 'choice-group-chip'}
              key={suggestion}
              onClick={() => onChange(suggestion)}
              type="button"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </label>
  )
}

function ConfirmDeleteModal({
  body,
  confirmLabel,
  isDeleting,
  onCancel,
  onConfirm,
  title,
}: {
  body: string
  confirmLabel: string
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
  title: string
}) {
  return (
    <div className="edit-modal-backdrop" role="presentation">
      <section aria-labelledby="delete-confirm-title" aria-modal="true" className="edit-modal confirm-modal" role="dialog">
        <button aria-label="Close delete confirmation" className="icon-button tutorial-close" onClick={onCancel} type="button">
          <X size={18} />
        </button>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Confirm delete</p>
            <h2 id="delete-confirm-title">{title}</h2>
          </div>
        </div>
        <p className="confirm-body">{body}</p>
        <div className="modal-actions">
          <button className="secondary-button" disabled={isDeleting} onClick={onCancel} type="button">
            <X size={18} />
            Cancel
          </button>
          <button className="primary-button danger-button" disabled={isDeleting} onClick={onConfirm} type="button">
            {isDeleting ? <Loader2 className="spin" size={18} /> : <Trash2 size={18} />}
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

function PaginationControls({
  currentPage,
  onPageChange,
  onPageSizeChange,
  pageCount,
  pageSize,
  resultLabel,
}: {
  currentPage: number
  onPageChange: (page: number) => void
  onPageSizeChange: (value: number) => void
  pageCount: number
  pageSize: number
  resultLabel: string
}) {
  return (
    <div className="pagination-controls">
      <div className="pagination-summary">
        <span className="results-count">{resultLabel}</span>
      </div>
      <div className="pagination-actions">
        <label className="page-size-control">
          Rows
          <FilterSelect
            className="page-size-select"
            onChange={(value) => onPageSizeChange(Number(value))}
            options={pageSizeOptions.map((option) => ({ label: String(option), value: String(option) }))}
            value={String(pageSize)}
          />
        </label>
        <button
          className="secondary-button compact-button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          type="button"
        >
          <ChevronLeft size={18} />
          Previous
        </button>
        <span className="page-indicator">
          Page {currentPage} of {pageCount}
        </span>
        <button
          className="secondary-button compact-button"
          disabled={currentPage >= pageCount}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
        >
          Next
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}

function CompactPaginationControls({
  currentPage,
  onPageChange,
  pageCount,
}: {
  currentPage: number
  onPageChange: (page: number) => void
  pageCount: number
}) {
  return (
    <div className="compact-pagination">
      <button
        className="secondary-button compact-button"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        type="button"
      >
        <ChevronLeft size={16} />
        Previous
      </button>
      <span>
        Page {currentPage} of {pageCount}
      </span>
      <button
        className="secondary-button compact-button"
        disabled={currentPage >= pageCount}
        onClick={() => onPageChange(currentPage + 1)}
        type="button"
      >
        Next
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

function StockMovementPanel({
  form,
  inventoryItems,
  onChange,
  onSubmit,
}: {
  form: {
    inventoryItemId: string
    movementType: StockMovementKind
    quantity: string
    businessDate: string
    notes: string
  }
  inventoryItems: InventoryItemRecord[]
  onChange: React.Dispatch<React.SetStateAction<{
    inventoryItemId: string
    movementType: StockMovementKind
    quantity: string
    businessDate: string
    notes: string
  }>>
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  const selectedItem = inventoryItems.find((item) => item.id === form.inventoryItemId)
  const selectedMovement = movementOptions.find((option) => option.value === form.movementType)

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h2>Record stock movement</h2>
        </div>
        <ArrowDownUp size={22} />
      </div>
      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          Inventory item
          <FilterSelect
            className="field-select"
            onChange={(value) => onChange((draft) => ({ ...draft, inventoryItemId: value }))}
            options={[
              { label: 'Choose item', value: '' },
              ...inventoryItems.map((item) => ({
                label: `${item.name} (${formatQuantity(item.currentStock)} ${item.unit})`,
                value: item.id,
              })),
            ]}
            value={form.inventoryItemId}
          />
        </label>
        <label>
          <span className="label-with-help">
            Movement
            <InfoTooltip text="Choose stock-in for deliveries, wastage/spoilage/mistake for deductions, or count adjustment to match an actual count." />
          </span>
          <FilterSelect
            className="field-select"
            onChange={(value) => onChange((draft) => ({ ...draft, movementType: value as StockMovementKind }))}
            options={movementOptions.map((option) => ({ label: option.label, value: option.value }))}
            value={form.movementType}
          />
        </label>
        <label>
          <span className="label-with-help">
            {form.movementType === 'adjustment' ? 'Counted stock' : 'Quantity'}
            <InfoTooltip
              text={
                form.movementType === 'adjustment'
                  ? 'Enter the actual counted stock. The system will set the item to this number.'
                  : 'Enter how much stock is moving in or out, using the selected item unit.'
              }
            />
          </span>
          <input
            min="0"
            onChange={(event) => onChange((draft) => ({ ...draft, quantity: event.target.value }))}
            placeholder={selectedItem ? `in ${selectedItem.unit}` : 'ex: 10'}
            required
            step="0.001"
            type="number"
            value={form.quantity}
          />
        </label>
        <label>
          <span className="label-with-help">
            Business date
            <InfoTooltip text="Date this movement should appear under in reports." />
          </span>
          <input
            onChange={(event) => onChange((draft) => ({ ...draft, businessDate: event.target.value }))}
            required
            type="date"
            value={form.businessDate}
          />
        </label>
        <label className="wide-field">
          Notes
          <input
            onChange={(event) => onChange((draft) => ({ ...draft, notes: event.target.value }))}
            placeholder="ex: supplier delivery / closing count"
            value={form.notes}
          />
        </label>
        <p className="movement-helper">
          {selectedMovement?.helper}
          {selectedItem ? ` Current stock: ${formatQuantity(selectedItem.currentStock)} ${selectedItem.unit}.` : ''}
        </p>
        <button className="primary-button form-submit" type="submit">
          <Plus size={18} />
          Record movement
        </button>
      </form>
    </article>
  )
}

function ReportsPanel({
  daySessions,
  orders,
  stockMovements,
  todayBusinessDate,
}: {
  daySessions: DaySessionRecord[]
  orders: OrderRecord[]
  stockMovements: StockMovementRecord[]
  todayBusinessDate: string
}) {
  const [selectedBusinessDate, setSelectedBusinessDate] = useState(todayBusinessDate)
  const openOrders = orders.filter(isOpenOrder)
  const selectedOrders = openOrders.filter((order) => order.businessDate === selectedBusinessDate)
  const selectedSales = selectedOrders.reduce((total, order) => total + (order.netAmount ?? order.grossAmount ?? 0), 0)
  const totalDiscounts = selectedOrders.reduce((total, order) => total + (order.discountAmount ?? 0), 0)
  const selectedMovements = stockMovements.filter((movement) => movement.businessDate === selectedBusinessDate)
  const recentMovements = selectedMovements.slice(0, 8)
  const selectedDaySessions = daySessions.filter((session) => session.businessDate === selectedBusinessDate)

  function exportOrdersCsv() {
    downloadCsv(
      `sales-${selectedBusinessDate}.csv`,
      ['Business date', 'Created at', 'Order type', 'Status', 'Discount type', 'Discount amount', 'Gross amount', 'Net amount'],
      selectedOrders.map((order) => [
        order.businessDate ?? selectedBusinessDate,
        formatTimestamp(order.createdAt),
        order.orderType === 'take_out' ? 'Take-out' : 'Dine-in',
        order.status ?? 'synced',
        order.discountType || 'None',
        order.discountAmount ?? 0,
        order.grossAmount ?? 0,
        order.netAmount ?? order.grossAmount ?? 0,
      ]),
    )
  }

  function exportMovementsCsv() {
    downloadCsv(
      `stock-movements-${selectedBusinessDate}.csv`,
      ['Business date', 'Item', 'Movement', 'Quantity', 'Unit', 'Source', 'Notes', 'Created at'],
      selectedMovements.map((movement) => [
        movement.businessDate ?? selectedBusinessDate,
        movement.inventoryItemName || movement.inventoryItemId,
        getMovementLabel(movement.movementType),
        formatQuantity(movement.quantity),
        movement.unit || '',
        getMovementSourceLabel(movement.sourceType),
        movement.notes || '',
        formatTimestamp(movement.createdAt),
      ]),
    )
  }

  return (
    <section className="screen-grid reports-grid">
      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Selected date</p>
            <h2>Sales summary</h2>
          </div>
          <BarChart3 size={22} />
        </div>
        <label className="report-date-filter">
          <span className="label-with-help">
            Business date
            <InfoTooltip text="Date used for reports. This may differ from the calendar day if the store closes after midnight." />
          </span>
          <input
            onChange={(event) => setSelectedBusinessDate(event.target.value)}
            type="date"
            value={selectedBusinessDate}
          />
        </label>
        <div className="report-actions">
          <button className="secondary-button compact-button" disabled={!selectedOrders.length} onClick={exportOrdersCsv} type="button">
            <Download size={18} />
            Export sales CSV
          </button>
          <button className="secondary-button compact-button" disabled={!selectedMovements.length} onClick={exportMovementsCsv} type="button">
            <Download size={18} />
            Export stock CSV
          </button>
        </div>
        <div className="summary-grid">
          <div>
            <p>Orders</p>
            <strong>{selectedOrders.length}</strong>
          </div>
          <div>
            <p>Net sales</p>
            <strong>{money(selectedSales)}</strong>
          </div>
          <div>
            <p>Discounts</p>
            <strong>{money(totalDiscounts)}</strong>
          </div>
        </div>
        <div className="table-list report-list">
          {selectedOrders.length ? (
            selectedOrders.slice(0, 6).map((order) => (
              <div className="report-row" key={order.id}>
                <div>
                  <strong>{order.orderType === 'take_out' ? 'Take-out order' : 'Dine-in order'}</strong>
                  <p>
                    {formatTimestamp(order.createdAt)} - {order.discountType || 'No discount'}
                  </p>
                </div>
                <span className={`stock-status ${getOperationalStatusClass(order.status)}`}>
                  {order.status || 'synced'}
                </span>
                <strong>{money(order.netAmount ?? order.grossAmount ?? 0)}</strong>
              </div>
            ))
          ) : (
            <p className="empty-state">No synced orders for {selectedBusinessDate} yet.</p>
          )}
        </div>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Inventory</p>
            <h2>Recent stock movements</h2>
          </div>
          <ArrowDownUp size={22} />
        </div>
        <div className="table-list report-list">
          {recentMovements.length ? (
            recentMovements.map((movement) => (
              <div className="report-row movement-row" key={movement.id}>
                <div>
                  <strong>{movement.inventoryItemName || movement.inventoryItemId}</strong>
                  <p>
                    {getMovementLabel(movement.movementType)} - {getMovementSourceLabel(movement.sourceType)} -{' '}
                    {formatDateOnly(movement.businessDate)}
                  </p>
                </div>
                <strong>
                  {formatQuantity(movement.quantity)} {movement.unit || ''}
                </strong>
              </div>
            ))
          ) : (
            <p className="empty-state">No stock movements have synced yet.</p>
          )}
        </div>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">End of day</p>
            <h2>Day sessions</h2>
          </div>
          <ClipboardList size={22} />
        </div>
        <div className="table-list report-list">
          {selectedDaySessions.length ? (
            selectedDaySessions.map((session) => (
              <div className="report-row" key={session.id}>
                <div>
                  <strong>{session.businessDate}</strong>
                  <p>
                    Opened {formatTimestamp(session.openedAt)} - Closed {formatTimestamp(session.closedAt)}
                  </p>
                </div>
                <span className={`stock-status ${getOperationalStatusClass(session.status)}`}>
                  {session.status}
                </span>
              </div>
            ))
          ) : (
            <p className="empty-state">No day session for {selectedBusinessDate} yet.</p>
          )}
        </div>
      </article>
    </section>
  )
}

function SyncPanel({
  daySessions,
  syncEvents,
}: {
  daySessions: DaySessionRecord[]
  syncEvents: SyncEventRecord[]
}) {
  const latestSync = syncEvents[0]
  const pendingRecords = syncEvents.reduce((total, event) => total + (event.pendingRecords ?? 0), 0)

  return (
    <section className="screen-grid sync-grid">
      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Tablet sync</p>
            <h2>Latest status</h2>
          </div>
          <Cloud size={22} />
        </div>
        <div className="summary-grid">
          <div>
            <p>Last event</p>
            <strong>{latestSync ? formatTimestamp(latestSync.createdAt) : 'None'}</strong>
          </div>
          <div>
            <p className="metric-label-with-help">
              Pending records
              <InfoTooltip text="Tablet records waiting to sync or still not confirmed by Firestore." />
            </p>
            <strong>{pendingRecords}</strong>
          </div>
          <div>
            <p>Devices seen</p>
            <strong>{new Set(syncEvents.map((event) => event.deviceId)).size}</strong>
          </div>
        </div>
        <div className="table-list report-list">
          {syncEvents.length ? (
            syncEvents.slice(0, 10).map((event) => (
              <div className="report-row" key={event.id}>
                <div>
                  <strong>{event.deviceId}</strong>
                  <p>
                    {formatTimestamp(event.createdAt)} - {event.pendingRecords ?? 0} pending
                  </p>
                </div>
                <span className={`stock-status ${getOperationalStatusClass(event.status)}`}>
                  {event.status}
                </span>
              </div>
            ))
          ) : (
            <p className="empty-state">No tablet sync events have been received yet.</p>
          )}
        </div>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Business days</p>
            <h2>Session sync health</h2>
          </div>
          <ClipboardList size={22} />
        </div>
        <div className="table-list report-list">
          {daySessions.length ? (
            daySessions.slice(0, 8).map((session) => (
              <div className="report-row" key={session.id}>
                <div>
                  <strong>{session.businessDate}</strong>
                  <p>Last synced {formatTimestamp(session.lastSyncedAt)}</p>
                </div>
                <span className={`stock-status ${getOperationalStatusClass(session.status)}`}>
                  {session.status}
                </span>
              </div>
            ))
          ) : (
            <p className="empty-state">No day sessions are available in sync history yet.</p>
          )}
        </div>
      </article>
    </section>
  )
}

function ItemBadge({ category, code, name }: { category?: string; code: string; name: string }) {
  if (shouldShowCodeBadge(code)) {
    return (
      <div className="item-badge code-badge" title={code}>
        {code}
      </div>
    )
  }

  return (
    <div aria-label={`${name} icon`} className="item-badge icon-badge" title={`${code} - ${name}`}>
      <ItemBadgeIcon type={getItemIconType(name, category, code)} />
    </div>
  )
}

function ItemBadgeIcon({ type }: { type: string }) {
  if (type === 'drink') {
    return <CupSoda size={24} />
  }

  if (type === 'noodle') {
    return <Soup size={24} />
  }

  if (type === 'grain') {
    return <Wheat size={24} />
  }

  if (type === 'dimsum') {
    return <Beef size={24} />
  }

  if (type === 'package') {
    return <Package size={24} />
  }

  if (type === 'sauce') {
    return <GlassWater size={24} />
  }

  if (type === 'addon') {
    return <UtensilsCrossed size={24} />
  }

  return <CircleHelp size={24} />
}

function MenuListPanel({
  menuItems,
  onAdd,
  onEdit,
  showControls = true,
}: {
  menuItems: MenuItemRecord[]
  onAdd: () => void
  onEdit: (item: MenuItemRecord) => void
  showControls?: boolean
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const categoryOptions = useMemo(
    () => [
      { label: 'All categories', value: 'all' },
      ...Array.from(new Set(menuItems.map((item) => item.category))).map((category) => ({
        label: category,
        value: category,
      })),
    ],
    [menuItems],
  )
  const filteredMenuItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return menuItems.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        `${item.code} ${item.name} ${item.category}`.toLowerCase().includes(normalizedSearch)
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [categoryFilter, menuItems, searchQuery, statusFilter])
  const pageCount = getPageCount(filteredMenuItems.length, pageSize)
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const pagedMenuItems = showControls ? getPagedItems(filteredMenuItems, safeCurrentPage, pageSize) : menuItems

  return (
    <article className="panel menu-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Setup</p>
          <h2>Menu items</h2>
        </div>
        <button className="primary-button" onClick={onAdd} type="button">
          <PackagePlus size={18} />
          Add item
        </button>
      </div>

      {showControls ? (
        <ListControls
          filterOptions={categoryOptions}
          filterValue={categoryFilter}
          onFilterChange={(value) => {
            setCategoryFilter(value)
            setCurrentPage(1)
          }}
          onSearchChange={(value) => {
            setSearchQuery(value)
            setCurrentPage(1)
          }}
          onSecondaryFilterChange={(value) => {
            setStatusFilter(value)
            setCurrentPage(1)
          }}
          searchPlaceholder="Search code, item, or category"
          searchValue={searchQuery}
          secondaryFilterLabel="Status"
          secondaryFilterOptions={[
            { label: 'All statuses', value: 'all' },
            { label: 'Draft', value: 'draft' },
            { label: 'Ready', value: 'ready' },
            { label: 'Archived', value: 'inactive' },
          ]}
          secondaryFilterValue={statusFilter}
        />
      ) : null}

      <div className="table-list">
        {pagedMenuItems.length ? (
          pagedMenuItems.map((item) => (
            <div className="table-row editable-row" key={item.id}>
              <ItemBadge category={item.category} code={item.code} name={item.name} />
              <div>
                <strong>{item.name}</strong>
                <p>{getMenuItemSubtitle(item)}</p>
              </div>
              <div className="price">{money(item.sellingPrice)}</div>
              <span className={`badge ${getMenuStatusClass(item.status)}`}>{getMenuStatusLabel(item.status)}</span>
              <button aria-label={`Edit ${item.name}`} className="icon-button neutral" onClick={() => onEdit(item)} type="button">
                <Edit3 size={18} />
              </button>
            </div>
          ))
        ) : (
          <p className="empty-state">
            {menuItems.length ? 'No menu items match the current search or filters.' : 'No menu items yet. Add the current HK menu here first.'}
          </p>
        )}
      </div>
      {showControls && filteredMenuItems.length > pageSize ? (
        <PaginationControls
          currentPage={safeCurrentPage}
          onPageChange={setCurrentPage}
          onPageSizeChange={(value) => {
            setPageSize(value)
            setCurrentPage(1)
          }}
          pageCount={pageCount}
          pageSize={pageSize}
          resultLabel={getPaginationLabel(filteredMenuItems.length, safeCurrentPage, pageSize)}
        />
      ) : null}
    </article>
  )
}

function InventoryAlertsPanel({
  inventoryItems,
  onEdit,
  showControls = true,
}: {
  inventoryItems: InventoryItemRecord[]
  onEdit: (item: InventoryItemRecord) => void
  showControls?: boolean
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const categoryOptions = useMemo(
    () => [
      { label: 'All categories', value: 'all' },
      ...Array.from(new Set(inventoryItems.map((item) => item.category))).map((category) => ({
        label: category,
        value: category,
      })),
    ],
    [inventoryItems],
  )
  const filteredInventoryItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return inventoryItems.filter((item) => {
      const status = getStockStatus(item).toLowerCase()
      const matchesSearch =
        !normalizedSearch ||
        `${item.name} ${item.category} ${item.unit}`.toLowerCase().includes(normalizedSearch)
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
      const matchesStock = stockFilter === 'all' || status === stockFilter

      return matchesSearch && matchesCategory && matchesStock
    })
  }, [categoryFilter, inventoryItems, searchQuery, stockFilter])
  const pageCount = getPageCount(filteredInventoryItems.length, pageSize)
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const compactPageCount = getPageCount(inventoryItems.length, compactInventoryAlertPageSize)
  const safeCompactCurrentPage = Math.min(currentPage, compactPageCount)
  const pagedInventoryItems = showControls
    ? getPagedItems(filteredInventoryItems, safeCurrentPage, pageSize)
    : getPagedItems(inventoryItems, safeCompactCurrentPage, compactInventoryAlertPageSize)

  return (
    <article className="panel side-panel">
      <div className="panel-header compact">
        <div>
          <p className="eyebrow">Operations</p>
          <h2>Inventory alerts</h2>
        </div>
        <ArrowDownUp size={20} />
      </div>

      {showControls ? (
        <ListControls
          filterOptions={categoryOptions}
          filterValue={categoryFilter}
          onFilterChange={(value) => {
            setCategoryFilter(value)
            setCurrentPage(1)
          }}
          onSearchChange={(value) => {
            setSearchQuery(value)
            setCurrentPage(1)
          }}
          onSecondaryFilterChange={(value) => {
            setStockFilter(value)
            setCurrentPage(1)
          }}
          searchPlaceholder="Search inventory item"
          searchValue={searchQuery}
          secondaryFilterLabel="Stock"
          secondaryFilterOptions={[
            { label: 'All stock', value: 'all' },
            { label: 'OK', value: 'ok' },
            { label: 'Reorder', value: 'reorder' },
            { label: 'Critical', value: 'critical' },
            { label: 'Inactive', value: 'inactive' },
          ]}
          secondaryFilterValue={stockFilter}
        />
      ) : null}

      <div className="alert-list">
        {pagedInventoryItems.length ? (
          pagedInventoryItems.map((item) => {
            const status = getStockStatus(item)
            return (
              <div className="alert-row editable-alert-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <p>
                    {item.currentStock} {item.unit} left - reorder at {item.lowStockThreshold} {item.unit}
                  </p>
                </div>
                <span className={`stock-status ${status.toLowerCase()}`}>{status}</span>
                <button aria-label={`Edit ${item.name}`} className="icon-button neutral" onClick={() => onEdit(item)} type="button">
                  <Edit3 size={18} />
                </button>
              </div>
            )
          })
        ) : (
          <p className="empty-state">
            {showControls && inventoryItems.length
              ? 'No inventory items match the current search or filters.'
              : 'No inventory items yet. Add ingredients, packaging, sauces, and supplies.'}
          </p>
        )}
      </div>
      {showControls && filteredInventoryItems.length > pageSize ? (
        <PaginationControls
          currentPage={safeCurrentPage}
          onPageChange={setCurrentPage}
          onPageSizeChange={(value) => {
            setPageSize(value)
            setCurrentPage(1)
          }}
          pageCount={pageCount}
          pageSize={pageSize}
          resultLabel={getPaginationLabel(filteredInventoryItems.length, safeCurrentPage, pageSize)}
        />
      ) : null}
      {!showControls && inventoryItems.length > compactInventoryAlertPageSize ? (
        <CompactPaginationControls
          currentPage={safeCompactCurrentPage}
          onPageChange={setCurrentPage}
          pageCount={compactPageCount}
        />
      ) : null}
    </article>
  )
}

function RecipeListPanel({
  components,
  onDelete,
  onEdit,
}: {
  components: RecipeComponentRecord[]
  onDelete: (component: RecipeComponentRecord) => void
  onEdit: (component: RecipeComponentRecord) => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [menuCodeFilter, setMenuCodeFilter] = useState('all')
  const [appliesToFilter, setAppliesToFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const menuCodeOptions = useMemo(
    () => [
      { label: 'All menu items', value: 'all' },
      ...Array.from(new Set(components.map((component) => component.menuItemCode))).map((menuItemCode) => ({
        label: menuItemCode,
        value: menuItemCode,
      })),
    ],
    [components],
  )
  const filteredComponents = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return components.filter((component) => {
      const matchesSearch =
        !normalizedSearch ||
        `${component.menuItemCode} ${component.inventoryItemName} ${component.choiceGroup ?? ''}`
          .toLowerCase()
          .includes(normalizedSearch)
      const matchesMenuCode = menuCodeFilter === 'all' || component.menuItemCode === menuCodeFilter
      const matchesAppliesTo = appliesToFilter === 'all' || component.appliesTo === appliesToFilter

      return matchesSearch && matchesMenuCode && matchesAppliesTo
    })
  }, [appliesToFilter, components, menuCodeFilter, searchQuery])
  const pageCount = getPageCount(filteredComponents.length, pageSize)
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const pagedComponents = getPagedItems(filteredComponents, safeCurrentPage, pageSize)

  return (
    <article className="panel menu-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Ingredients used</p>
          <h2>Recipe rules</h2>
        </div>
        <BookOpen size={20} />
      </div>

      <ListControls
        filterOptions={menuCodeOptions}
        filterValue={menuCodeFilter}
        onFilterChange={(value) => {
          setMenuCodeFilter(value)
          setCurrentPage(1)
        }}
        onSearchChange={(value) => {
          setSearchQuery(value)
          setCurrentPage(1)
        }}
        onSecondaryFilterChange={(value) => {
          setAppliesToFilter(value)
          setCurrentPage(1)
        }}
        searchPlaceholder="Search menu code, ingredient, or choice"
        searchValue={searchQuery}
        secondaryFilterLabel="Rule"
        secondaryFilterOptions={[
          { label: 'All rules', value: 'all' },
          { label: 'Base item', value: 'base' },
          { label: 'Dine-in only', value: 'dine_in' },
          { label: 'Take-out only', value: 'take_out' },
          { label: 'Required choice', value: 'choice' },
          { label: 'Add-on', value: 'addon' },
        ]}
        secondaryFilterValue={appliesToFilter}
      />

      <div className="recipe-list">
        {pagedComponents.length ? (
          pagedComponents.map((component) => (
            <div className="recipe-row" key={component.id}>
              <ItemBadge code={component.menuItemCode} name={component.inventoryItemName} />
              <div>
                <strong>{component.inventoryItemName}</strong>
                <p>
                  {component.usageQuantity && component.usageUnit
                    ? `${formatQuantity(component.usageQuantity)} ${component.usageUnit} used, deducts ${formatQuantity(component.stockQuantity ?? component.quantity)} ${component.stockUnit ?? component.unit}`
                    : `${formatQuantity(component.quantity)} ${component.unit}`}
                  {' - '}
                  {getRecipeAppliesToLabel(component.appliesTo)}
                  {component.choiceGroup ? ` - ${component.choiceGroup}` : ''}
                </p>
              </div>
              <div className="row-actions">
                <button
                  aria-label={`Edit ${component.inventoryItemName}`}
                  className="icon-button neutral"
                  onClick={() => onEdit(component)}
                  type="button"
                >
                  <Edit3 size={18} />
                </button>
                <button
                  aria-label={`Delete ${component.inventoryItemName}`}
                  className="icon-button"
                  onClick={() => onDelete(component)}
                  type="button"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="empty-state">
            {components.length
              ? 'No recipe rules match the current search or filters.'
              : 'No recipe rules yet. Add base ingredients, choices, add-ons, and packaging.'}
          </p>
        )}
      </div>
      {filteredComponents.length > pageSize ? (
        <PaginationControls
          currentPage={safeCurrentPage}
          onPageChange={setCurrentPage}
          onPageSizeChange={(value) => {
            setPageSize(value)
            setCurrentPage(1)
          }}
          pageCount={pageCount}
          pageSize={pageSize}
          resultLabel={getPaginationLabel(filteredComponents.length, safeCurrentPage, pageSize)}
        />
      ) : null}
    </article>
  )
}

function RecipeDraftRow({
  inventoryItems,
  line,
  lineNumber,
  onRemove,
  onUpdate,
}: {
  inventoryItems: InventoryItemRecord[]
  line: RecipeDraftLine
  lineNumber: number
  onRemove: (lineId: string) => void
  onUpdate: (lineId: string, field: 'inventoryItemId' | 'quantity' | 'usageUnit', value: string) => void
}) {
  const inventoryItem = inventoryItems.find((item) => item.id === line.inventoryItemId)
  const usageUnits = inventoryItem ? getCompatibleUsageUnits(inventoryItem.unit) : []
  const stockQuantity =
    inventoryItem && line.quantity
      ? convertToStockUnit(Number(line.quantity), line.usageUnit || inventoryItem.unit, inventoryItem.unit)
      : null

  return (
    <div className="recipe-draft-row">
      <span className="line-number">{lineNumber}</span>
      <label>
        <span className="label-with-help">
          Inventory item
          <InfoTooltip text="Ingredient, packaging, or supply that will be deducted when this recipe rule applies." />
        </span>
        <FilterSelect
          className="field-select"
          onChange={(value) => onUpdate(line.id, 'inventoryItemId', value)}
          options={[
            { label: 'Choose inventory item', value: '' },
            ...inventoryItems.map((item) => ({ label: `${item.name} (${item.unit})`, value: item.id })),
          ]}
          value={line.inventoryItemId}
        />
      </label>
      <label>
        Quantity
        <input
          min="0"
          onChange={(event) => onUpdate(line.id, 'quantity', event.target.value)}
          placeholder="ex: 80"
          required
          step="0.001"
          type="number"
          value={line.quantity}
        />
      </label>
      <label>
        <span className="label-with-help">
          Usage unit
          <InfoTooltip text="Unit entered for the recipe amount. The system converts it back to the inventory item's stock unit when needed." />
        </span>
        <FilterSelect
          className="field-select"
          disabled={!inventoryItem}
          onChange={(value) => onUpdate(line.id, 'usageUnit', value)}
          options={[
            { label: 'Choose unit', value: '' },
            ...usageUnits.map((unit) => ({ label: unit, value: unit })),
          ]}
          value={line.usageUnit}
        />
      </label>
      <button
        aria-label="Remove recipe row"
        className="icon-button"
        onClick={() => onRemove(line.id)}
        type="button"
      >
        <Trash2 size={18} />
      </button>
      {inventoryItem && stockQuantity !== null ? (
        <p className="conversion-preview">
          Will deduct {formatQuantity(stockQuantity)} {inventoryItem.unit} from stock.
        </p>
      ) : null}
    </div>
  )
}

function OwnerTestChecklistPanel({
  inventoryItems,
  menuItems,
  onSelectSection,
  orders,
  recipeComponents,
  stockMovements,
}: {
  inventoryItems: InventoryItemRecord[]
  menuItems: MenuItemRecord[]
  onSelectSection: (section: ActiveSection) => void
  orders: OrderRecord[]
  recipeComponents: RecipeComponentRecord[]
  stockMovements: StockMovementRecord[]
}) {
  const checklistItems = [
    {
      done: menuItems.length > 0,
      label: 'Manage menu items',
      section: 'Menu' as ActiveSection,
    },
    {
      done: inventoryItems.length > 0,
      label: 'Add ingredients, packaging, and supplies',
      section: 'Inventory' as ActiveSection,
    },
    {
      done: recipeComponents.length > 0,
      label: 'Connect menu items to recipe rules',
      section: 'Recipes' as ActiveSection,
    },
    {
      done: stockMovements.length > 0,
      label: 'Record a stock-in or count adjustment',
      section: 'Inventory' as ActiveSection,
    },
    {
      done: orders.length > 0 || stockMovements.length > 0,
      label: 'Open Reports and export a CSV file',
      section: 'Reports' as ActiveSection,
    },
  ]
  const completedCount = checklistItems.filter((item) => item.done).length

  return (
    <article className="panel owner-checklist-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Daily readiness</p>
          <h2>Operating checklist</h2>
        </div>
        <ClipboardList size={22} />
      </div>
      <p className="subtle">
        Keep these items complete so menu sales, stock counts, and reports stay accurate.
      </p>
      <div className="checklist-progress" aria-label={`${completedCount} of ${checklistItems.length} checklist items complete`}>
        <span style={{ width: `${(completedCount / checklistItems.length) * 100}%` }} />
      </div>
      <div className="checklist-list">
        {checklistItems.map((item) => (
          <button className="checklist-row" key={item.label} onClick={() => onSelectSection(item.section)} type="button">
            <span className={item.done ? 'check-dot complete' : 'check-dot'}>{item.done ? <Check size={14} /> : null}</span>
            <span>{item.label}</span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
    </article>
  )
}

function SetupReadinessPanel({
  inventoryItems,
  menuItems,
  onSelectSection,
  recipeComponents,
}: {
  inventoryItems: InventoryItemRecord[]
  menuItems: MenuItemRecord[]
  onSelectSection: (section: ActiveSection) => void
  recipeComponents: RecipeComponentRecord[]
}) {
  const readyMenuItems = menuItems.filter((item) => item.status === 'ready')
  const draftMenuItems = menuItems.filter((item) => item.status === 'draft')
  const recipeMenuIds = new Set(recipeComponents.map((component) => component.menuItemId))
  const readyMenuItemsWithRecipes = readyMenuItems.filter((item) => recipeMenuIds.has(item.id)).length
  const stockAlerts = inventoryItems.filter((item) => {
    const status = getStockStatus(item)
    return status === 'Reorder' || status === 'Critical'
  }).length
  const packagingItems = inventoryItems.filter((item) => item.category.toLowerCase() === 'packaging').length
  const recipeStatus = readyMenuItems.length === 0 ? 'draft' : readyMenuItemsWithRecipes === readyMenuItems.length ? 'ready' : 'review'
  const stockStatus = stockAlerts === 0 ? 'ready' : 'review'

  return (
    <article className="panel workflow-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Setup readiness</p>
          <h2>Ready to sell</h2>
        </div>
        <ChefHat size={22} />
      </div>
      <div className="readiness-list">
        <div className="readiness-row">
          <div>
            <strong>Menu items</strong>
            <p>
              {readyMenuItems.length} ready - {draftMenuItems.length} draft
            </p>
          </div>
          <span className={`badge ${readyMenuItems.length ? 'ready' : 'draft'}`}>
            {readyMenuItems.length ? 'Ready' : 'Draft'}
          </span>
        </div>
        <div className="readiness-row">
          <div>
            <strong className="label-with-help">
              Recipe coverage
              <InfoTooltip text="Shows how many ready menu items already have recipe rules linked for stock deduction." />
            </strong>
            <p>
              {readyMenuItemsWithRecipes} of {readyMenuItems.length} ready items linked
            </p>
          </div>
          <span className={`badge ${recipeStatus === 'ready' ? 'ready' : 'draft'}`}>
            {recipeStatus === 'ready' ? 'Ready' : 'Review'}
          </span>
        </div>
        <div className="readiness-row">
          <div>
            <strong className="label-with-help">
              Stock alerts
              <InfoTooltip text="Items at or below their reorder reminder appear here for attention." />
            </strong>
            <p>{stockAlerts ? `${stockAlerts} items need attention` : 'No reorder alerts'}</p>
          </div>
          <span className={`stock-status ${stockStatus === 'ready' ? 'ok' : 'reorder'}`}>
            {stockStatus === 'ready' ? 'OK' : 'Review'}
          </span>
        </div>
        <div className="readiness-row">
          <div>
            <strong className="label-with-help">
              Packaging
              <InfoTooltip text="Packaging inventory used by dine-in or take-out recipe rules, such as containers and lids." />
            </strong>
            <p>{packagingItems} packaging items tracked</p>
          </div>
          <span className={`badge ${packagingItems ? 'ready' : 'draft'}`}>{packagingItems ? 'Ready' : 'Review'}</span>
        </div>
      </div>
      <div className="readiness-actions">
        <button className="secondary-button compact-button" onClick={() => onSelectSection('Menu')} type="button">
          Menu
        </button>
        <button className="secondary-button compact-button" onClick={() => onSelectSection('Inventory')} type="button">
          Inventory
        </button>
        <button className="secondary-button compact-button" onClick={() => onSelectSection('Recipes')} type="button">
          Recipes
        </button>
      </div>
    </article>
  )
}

function App() {
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [branch, setBranch] = useState<Branch | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isDataLoading, setIsDataLoading] = useState(false)
  const [setupError, setSetupError] = useState('')

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user)
      setIsAuthLoading(false)

      if (!user) {
        setProfile(null)
        setBranch(null)
        setSetupError('')
        setIsDataLoading(false)
      }
    })
  }, [])

  useEffect(() => {
    async function loadDashboardData(user: User) {
      setIsDataLoading(true)
      setSetupError('')
      setProfile(null)
      setBranch(null)

      try {
        const profileSnap = await getDoc(doc(db, 'users', user.uid))

        if (!profileSnap.exists()) {
          setSetupError('Your login works, but the matching Firestore user profile was not found.')
          return
        }

        const nextProfile = profileSnap.data() as UserProfile

        if (!['owner', 'admin'].includes(nextProfile.role)) {
          setSetupError('This web dashboard is for owners and admins only. Store staff should use the tablet app for now.')
          return
        }

        setProfile(nextProfile)

        const firstBranchId = nextProfile.branchIds?.[0]

        if (!firstBranchId) {
          setSetupError('Your user profile has no branch assigned yet.')
          return
        }

        const branchSnap = await getDoc(doc(db, 'branches', firstBranchId))

        if (!branchSnap.exists()) {
          setSetupError(`Branch "${firstBranchId}" was not found in Firestore.`)
          return
        }

        setBranch({ id: branchSnap.id, ...(branchSnap.data() as Omit<Branch, 'id'>) })
      } catch {
        setSetupError('Could not load dashboard data. Check Firestore rules and the user profile fields.')
      } finally {
        setIsDataLoading(false)
      }
    }

    if (authUser) {
      void loadDashboardData(authUser)
    }
  }, [authUser])

  if (isAuthLoading) {
    return <LoadingScreen />
  }

  if (!authUser) {
    return <LoginScreen />
  }

  if (isDataLoading) {
    return <LoadingScreen />
  }

  if (setupError) {
    return <SetupWarning message={setupError} />
  }

  if (!profile || !branch) {
    return <LoadingScreen />
  }

  return <Dashboard branch={branch} profile={profile} />
}

export default App
