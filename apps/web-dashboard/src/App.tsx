import { useEffect, useMemo, useState } from 'react'
import { FirebaseError } from 'firebase/app'
import {
  AlertTriangle,
  ArrowDownUp,
  BarChart3,
  BookOpen,
  Boxes,
  ChefHat,
  CircleDollarSign,
  ClipboardList,
  Cloud,
  Database,
  Edit3,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  PackagePlus,
  Plus,
  Settings,
  ShoppingCart,
  Trash2,
  Utensils,
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
  setDoc,
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

type ActiveSection = 'Overview' | 'Menu' | 'Inventory' | 'Recipes' | 'Reports' | 'Sync' | 'Settings'

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Menu', icon: Utensils },
  { label: 'Inventory', icon: Boxes },
  { label: 'Recipes', icon: BookOpen },
  { label: 'Reports', icon: BarChart3 },
  { label: 'Sync', icon: Cloud },
  { label: 'Settings', icon: Settings },
]

const unitOptions = ['pc', 'tub', 'kilo', 'gram', 'gallon', 'ml', 'liter'] as const

const baselineMenuItems = [
  ['hk1', 'HK1', 'Regular HK Style Noodles + 2 pcs Siomai', 'Noodles', 55, 44],
  ['hk2', 'HK2', 'Regular HK Style Noodles + 2 pcs Sharksfin/Japanese', 'Noodles', 59, 47.2],
  ['hk3', 'HK3', 'Jumbo HK Style Noodles + 4 pcs Siomai', 'Noodles', 100, 80],
  ['hk4', 'HK4', 'Jumbo HK Style Noodles + 4 pcs Sharksfin/Japanese', 'Noodles', 105, 84],
  ['hk5', 'HK5', '4 pcs Siomai', 'Dimsum', 50, 40],
  ['hk6', 'HK6', '4 pcs Sharksfin/Japanese Siomai', 'Dimsum', 55, 44],
  ['hk7', 'HK7', 'Rice Toppings + 4 pcs Siomai', 'Rice Meals', 65, 52],
  ['hk8', 'HK8', 'Rice Toppings + 4 pcs Sharksfin/Japanese', 'Rice Meals', 70, 56],
  ['hk9', 'HK9', 'Siopao Asado', 'Dimsum', 40, 32],
  ['gulaman-medium', 'GUL-M', 'Black Gulaman Medium', 'Drinks', 20, 16],
  ['gulaman-large', 'GUL-L', 'Black Gulaman Large', 'Drinks', 25, 20],
  ['addon-siomai', 'ADD-SIO', 'Additional Pork/Beef/Chicken Siomai or Wanton', 'Add-ons', 10, 8],
  ['addon-premium', 'ADD-PRE', 'Additional Japanese Siomai or Sharksfin', 'Add-ons', 12, 9.6],
] as const

const baselineInventoryItems = [
  ['noodles', 'Chow mein noodles', 'Ingredient', 'kilo', 175, 0, 5],
  ['rice', 'Rice', 'Ingredient', 'pc', 0, 0, 20],
  ['regular-tumbler', 'Regular tumbler/container', 'Packaging', 'pc', 3.5, 0, 40],
  ['jumbo-tumbler', 'Jumbo tumbler/container', 'Packaging', 'pc', 5.5, 0, 30],
  ['regular-lid', 'Regular lid', 'Packaging', 'pc', 3, 0, 40],
  ['large-lid', 'Large lid', 'Packaging', 'pc', 5, 0, 30],
  ['cutlery', 'Cutlery', 'Packaging', 'pc', 0, 0, 50],
  ['paper-bag', 'Paper bag', 'Packaging', 'pc', 0, 0, 30],
  ['pork-siomai', 'Pork siomai', 'Ingredient', 'pc', 4, 0, 60],
  ['beef-siomai', 'Beef siomai', 'Ingredient', 'pc', 4, 0, 60],
  ['chicken-siomai', 'Chicken siomai', 'Ingredient', 'pc', 4, 0, 60],
  ['wanton', 'Wanton', 'Ingredient', 'pc', 4, 0, 40],
  ['sharksfin', 'Sharksfin', 'Ingredient', 'pc', 6.25, 0, 40],
  ['japanese-siomai', 'Japanese siomai', 'Ingredient', 'pc', 6.25, 0, 40],
  ['siopao-asado', 'Siopao Asado', 'Ingredient', 'pc', 30, 0, 12],
  ['teriyaki-sauce', 'Teriyaki sauce', 'Sauce', 'gallon', 290, 0, 0.5],
  ['peanut-mongolian-sauce', 'Peanut Mongolian sauce', 'Sauce', 'gallon', 290, 0, 0.5],
  ['korean-bbq-sauce', 'Korean BBQ sauce', 'Sauce', 'gallon', 230, 0, 0.5],
  ['sweet-brown-sauce', 'Sweet brown sauce', 'Sauce', 'gallon', 290, 0, 0.5],
  ['chili-oil-mild', 'Chili oil mild', 'Sauce', 'ml', 175, 0, 500],
  ['chili-oil-extra-spicy', 'Chili oil extra spicy', 'Sauce', 'ml', 265, 0, 500],
  ['gulaman-powder', 'Gulaman powder', 'Ingredient', 'kilo', 395, 0, 1],
  ['caramel-powder', 'Caramel powder', 'Ingredient', 'pc', 5, 0, 10],
] as const

const baselineRecipeComponents = [
  ['hk1', 'noodles', 0.08, 'base', ''],
  ['hk1', 'pork-siomai', 2, 'choice', 'Siomai choice'],
  ['hk1', 'beef-siomai', 2, 'choice', 'Siomai choice'],
  ['hk1', 'chicken-siomai', 2, 'choice', 'Siomai choice'],
  ['hk1', 'wanton', 2, 'choice', 'Siomai choice'],
  ['hk1', 'regular-tumbler', 1, 'take_out', ''],
  ['hk1', 'regular-lid', 1, 'take_out', ''],
  ['hk1', 'cutlery', 1, 'take_out', ''],
  ['hk1', 'paper-bag', 1, 'take_out', ''],
  ['hk2', 'noodles', 0.08, 'base', ''],
  ['hk2', 'sharksfin', 2, 'choice', 'Premium choice'],
  ['hk2', 'japanese-siomai', 2, 'choice', 'Premium choice'],
  ['hk3', 'noodles', 0.12, 'base', ''],
  ['hk3', 'pork-siomai', 4, 'choice', 'Siomai choice'],
  ['hk3', 'beef-siomai', 4, 'choice', 'Siomai choice'],
  ['hk3', 'chicken-siomai', 4, 'choice', 'Siomai choice'],
  ['hk3', 'wanton', 4, 'choice', 'Siomai choice'],
  ['hk3', 'jumbo-tumbler', 1, 'take_out', ''],
  ['hk3', 'large-lid', 1, 'take_out', ''],
  ['hk4', 'noodles', 0.12, 'base', ''],
  ['hk4', 'sharksfin', 4, 'choice', 'Premium choice'],
  ['hk4', 'japanese-siomai', 4, 'choice', 'Premium choice'],
  ['hk5', 'pork-siomai', 4, 'choice', 'Siomai choice'],
  ['hk5', 'beef-siomai', 4, 'choice', 'Siomai choice'],
  ['hk5', 'chicken-siomai', 4, 'choice', 'Siomai choice'],
  ['hk5', 'wanton', 4, 'choice', 'Siomai choice'],
  ['hk6', 'sharksfin', 4, 'choice', 'Premium choice'],
  ['hk6', 'japanese-siomai', 4, 'choice', 'Premium choice'],
  ['hk7', 'rice', 1, 'base', ''],
  ['hk7', 'pork-siomai', 4, 'choice', 'Siomai choice'],
  ['hk7', 'beef-siomai', 4, 'choice', 'Siomai choice'],
  ['hk7', 'chicken-siomai', 4, 'choice', 'Siomai choice'],
  ['hk7', 'wanton', 4, 'choice', 'Siomai choice'],
  ['hk8', 'rice', 1, 'base', ''],
  ['hk8', 'sharksfin', 4, 'choice', 'Premium choice'],
  ['hk8', 'japanese-siomai', 4, 'choice', 'Premium choice'],
  ['hk9', 'siopao-asado', 1, 'base', ''],
  ['gulaman-medium', 'gulaman-powder', 0.02, 'base', ''],
  ['gulaman-medium', 'caramel-powder', 1, 'base', ''],
  ['gulaman-large', 'gulaman-powder', 0.03, 'base', ''],
  ['gulaman-large', 'caramel-powder', 1, 'base', ''],
] as const

function branchDocId(branchId: string, seedId: string) {
  return `${branchId}_${seedId}`
}

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
  })
  const [recipeBatchForm, setRecipeBatchForm] = useState({
    menuItemId: '',
    appliesTo: 'base',
    choiceGroup: '',
  })
  const [recipeDraftLines, setRecipeDraftLines] = useState<RecipeDraftLine[]>([
    { id: crypto.randomUUID(), inventoryItemId: '', quantity: '', usageUnit: '' },
  ])
  const [formMessage, setFormMessage] = useState('')
  const [isSeeding, setIsSeeding] = useState(false)
  const todayBusinessDate = getBusinessDate()
  const branchStatus = useMemo(() => (branch.active ? 'Active branch' : 'Inactive branch'), [branch.active])
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
        setupNotes: 'Recipe setup pending',
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
      active: true,
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

  async function handleDeleteRecipeComponent(componentId: string) {
    await deleteDoc(doc(db, 'recipeComponents', componentId))
    setFormMessage('Recipe component removed.')
  }

  async function handleSeedBaselineData() {
    setIsSeeding(true)
    setFormMessage('')

    try {
      await Promise.all([
        ...baselineMenuItems.map(([seedId, code, name, category, sellingPrice, seniorPwdPrice]) =>
          setDoc(
            doc(db, 'menuItems', branchDocId(branch.id, seedId)),
            {
              branchId: branch.id,
              code,
              name,
              category,
              sellingPrice,
              seniorPwdPrice,
              status: 'draft',
              setupNotes: 'Starter recipe setup - review before selling',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          ),
        ),
        ...baselineInventoryItems.map(([seedId, name, category, unit, buyingCost, currentStock, lowStockThreshold]) =>
          setDoc(
            doc(db, 'inventoryItems', branchDocId(branch.id, seedId)),
            {
              branchId: branch.id,
              name,
              category,
              unit,
              buyingCost,
              currentStock,
              lowStockThreshold,
              supplierPriceType: 'discounted',
              active: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          ),
        ),
      ])

      await Promise.all(
        baselineRecipeComponents.map(([menuSeedId, inventorySeedId, quantity, appliesTo, choiceGroup]) => {
          const menuItem = baselineMenuItems.find(([seedId]) => seedId === menuSeedId)
          const inventoryItem = baselineInventoryItems.find(([seedId]) => seedId === inventorySeedId)
          const componentId = branchDocId(
            branch.id,
            `${menuSeedId}_${inventorySeedId}_${appliesTo}_${choiceGroup || 'base'}`,
          )

          return setDoc(
            doc(db, 'recipeComponents', componentId),
            {
              branchId: branch.id,
              menuItemId: branchDocId(branch.id, menuSeedId),
              menuItemCode: menuItem?.[1] ?? menuSeedId.toUpperCase(),
              inventoryItemId: branchDocId(branch.id, inventorySeedId),
              inventoryItemName: inventoryItem?.[1] ?? inventorySeedId,
              quantity,
              unit: inventoryItem?.[3] ?? 'pcs',
              usageQuantity: quantity,
              usageUnit: inventoryItem?.[3] ?? 'pc',
              stockQuantity: quantity,
              stockUnit: inventoryItem?.[3] ?? 'pc',
              appliesTo,
              choiceGroup: choiceGroup || null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          )
        }),
      )

      setFormMessage('Starter HK menu, inventory, and recipe data loaded.')
    } finally {
      setIsSeeding(false)
    }
  }

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
          <div className="sync-pill">
            <Cloud size={18} />
            Firestore connected
          </div>
        </header>

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

        {activeSection === 'Overview' ? (
          <section className="content-grid">
            <MenuListPanel
              menuItems={menuItems.slice(0, 5)}
              onAdd={() => setActiveSection('Menu')}
              onEdit={startEditingMenuItem}
            />
            <InventoryAlertsPanel inventoryItems={inventoryItems} onEdit={startEditingInventoryItem} />
            <SetupFlowPanel />
          </section>
        ) : null}

        {activeSection === 'Menu' ? (
          <section className="screen-grid">
            <article className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Setup</p>
                  <h2>{editingMenuId ? 'Edit menu item' : 'Add menu item'}</h2>
                </div>
                <PackagePlus size={22} />
              </div>
              <form className="form-grid" onSubmit={handleCreateMenuItem}>
                <label>
                  Code
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
                  <select
                    onChange={(event) => setMenuForm((form) => ({ ...form, category: event.target.value }))}
                    value={menuForm.category}
                  >
                    <option>Noodles</option>
                    <option>Rice Meals</option>
                    <option>Dimsum</option>
                    <option>Drinks</option>
                    <option>Add-ons</option>
                  </select>
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
                  Senior/PWD price
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
                  Status
                  <select
                    onChange={(event) => setMenuForm((form) => ({ ...form, status: event.target.value }))}
                    value={menuForm.status}
                  >
                    <option value="draft">Draft</option>
                    <option value="ready">Ready</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <button className="primary-button form-submit" type="submit">
                  <Plus size={18} />
                  {editingMenuId ? 'Update menu item' : 'Save menu item'}
                </button>
                {editingMenuId ? (
                  <button className="secondary-button form-submit" onClick={resetMenuForm} type="button">
                    <X size={18} />
                    Cancel edit
                  </button>
                ) : null}
              </form>
              {formMessage ? <p className="success-message">{formMessage}</p> : null}
            </article>
            <MenuListPanel menuItems={menuItems} onAdd={() => undefined} onEdit={startEditingMenuItem} />
          </section>
        ) : null}

        {activeSection === 'Inventory' ? (
          <section className="screen-grid">
            <article className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Setup</p>
                  <h2>{editingInventoryId ? 'Edit inventory item' : 'Add inventory item'}</h2>
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
                  Category
                  <select
                    onChange={(event) => setInventoryForm((form) => ({ ...form, category: event.target.value }))}
                    value={inventoryForm.category}
                  >
                    <option>Ingredient</option>
                    <option>Packaging</option>
                    <option>Sauce</option>
                    <option>Drink</option>
                    <option>Supply</option>
                  </select>
                </label>
                <label>
                  Unit
                  <select
                    onChange={(event) => setInventoryForm((form) => ({ ...form, unit: event.target.value }))}
                    required
                    value={inventoryForm.unit}
                  >
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
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
                  Current stock
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
                  Reorder reminder
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
                  {editingInventoryId ? 'Update inventory item' : 'Save inventory item'}
                </button>
                {editingInventoryId ? (
                  <button className="secondary-button form-submit" onClick={resetInventoryForm} type="button">
                    <X size={18} />
                    Cancel edit
                  </button>
                ) : null}
              </form>
              {formMessage ? <p className="success-message">{formMessage}</p> : null}
            </article>
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
                    <select
                      onChange={(event) =>
                        setRecipeBatchForm((form) => ({ ...form, menuItemId: event.target.value }))
                      }
                      required
                      value={recipeBatchForm.menuItemId}
                    >
                      <option value="">Choose menu item</option>
                      {menuItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} - {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Applies to
                    <select
                      onChange={(event) =>
                        setRecipeBatchForm((form) => ({ ...form, appliesTo: event.target.value }))
                      }
                      value={recipeBatchForm.appliesTo}
                    >
                      <option value="base">Base item</option>
                      <option value="dine_in">Dine-in only</option>
                      <option value="take_out">Take-out only</option>
                      <option value="choice">Required choice</option>
                      <option value="addon">Add-on</option>
                    </select>
                  </label>
                  <label>
                    Choice group
                    <input
                      onChange={(event) =>
                        setRecipeBatchForm((form) => ({ ...form, choiceGroup: event.target.value }))
                      }
                      placeholder="ex: Siomai choice"
                      value={recipeBatchForm.choiceGroup}
                    />
                  </label>
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
            <RecipeListPanel components={recipeComponents} onDelete={handleDeleteRecipeComponent} />
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
            <article className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Starter setup</p>
                  <h2>Load HK baseline data</h2>
                </div>
                <Database size={22} />
              </div>
              <p className="subtle">
                Adds starter menu, inventory, and recipe rules based on the standee and supplier discounted prices.
                Existing seeded records are updated, not duplicated.
              </p>
              <button className="primary-button seed-button" disabled={isSeeding} onClick={handleSeedBaselineData} type="button">
                {isSeeding ? <Loader2 className="spin" size={18} /> : <Database size={18} />}
                Load starter data
              </button>
              {formMessage ? <p className="success-message">{formMessage}</p> : null}
            </article>
            <article className="panel">
              <p className="eyebrow">Important</p>
              <h2>Review before live use</h2>
              <p className="subtle">
                Sauce usage is intentionally not forced per order because customers can add sauces freely. Track sauce
                stock through opening and closing counts until the client confirms a standard serving estimate.
              </p>
            </article>
          </section>
        ) : null}

        {activeSection !== 'Overview' &&
        activeSection !== 'Menu' &&
        activeSection !== 'Inventory' &&
        activeSection !== 'Recipes' &&
        activeSection !== 'Reports' &&
        activeSection !== 'Sync' &&
        activeSection !== 'Settings' ? (
          <article className="panel placeholder-panel">
            <p className="eyebrow">Coming next</p>
            <h2>{activeSection}</h2>
            <p className="subtle">This module will be wired after menu and inventory setup are stable.</p>
          </article>
        ) : null}
      </section>
    </main>
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
  const openOrders = orders.filter(isOpenOrder)
  const todayOrders = openOrders.filter((order) => order.businessDate === todayBusinessDate)
  const todaySales = todayOrders.reduce((total, order) => total + (order.netAmount ?? order.grossAmount ?? 0), 0)
  const totalDiscounts = todayOrders.reduce((total, order) => total + (order.discountAmount ?? 0), 0)
  const recentMovements = stockMovements.slice(0, 8)

  return (
    <section className="screen-grid reports-grid">
      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Today</p>
            <h2>Sales summary</h2>
          </div>
          <BarChart3 size={22} />
        </div>
        <div className="summary-grid">
          <div>
            <p>Orders</p>
            <strong>{todayOrders.length}</strong>
          </div>
          <div>
            <p>Net sales</p>
            <strong>{money(todaySales)}</strong>
          </div>
          <div>
            <p>Discounts</p>
            <strong>{money(totalDiscounts)}</strong>
          </div>
        </div>
        <div className="table-list report-list">
          {todayOrders.length ? (
            todayOrders.slice(0, 6).map((order) => (
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
            <p className="empty-state">No synced orders for {todayBusinessDate} yet.</p>
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
                    {getMovementLabel(movement.movementType)} - {movement.sourceType || 'Manual'} -{' '}
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
          {daySessions.length ? (
            daySessions.slice(0, 6).map((session) => (
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
            <p className="empty-state">No day sessions have synced yet.</p>
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
            <p>Pending records</p>
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
            <p className="empty-state">No day sessions are available for sync review yet.</p>
          )}
        </div>
      </article>
    </section>
  )
}

function MenuListPanel({
  menuItems,
  onAdd,
  onEdit,
}: {
  menuItems: MenuItemRecord[]
  onAdd: () => void
  onEdit: (item: MenuItemRecord) => void
}) {
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

      <div className="table-list">
        {menuItems.length ? (
          menuItems.map((item) => (
            <div className="table-row editable-row" key={item.id}>
              <div className="item-code">{item.code}</div>
              <div>
                <strong>{item.name}</strong>
                <p>
                  {item.category} - {item.setupNotes || 'Recipe setup pending'}
                </p>
              </div>
              <div className="price">{money(item.sellingPrice)}</div>
              <span className={item.status === 'ready' ? 'badge ready' : 'badge draft'}>{item.status}</span>
              <button aria-label={`Edit ${item.name}`} className="icon-button neutral" onClick={() => onEdit(item)} type="button">
                <Edit3 size={18} />
              </button>
            </div>
          ))
        ) : (
          <p className="empty-state">No menu items yet. Add the current HK menu here first.</p>
        )}
      </div>
    </article>
  )
}

function InventoryAlertsPanel({
  inventoryItems,
  onEdit,
}: {
  inventoryItems: InventoryItemRecord[]
  onEdit: (item: InventoryItemRecord) => void
}) {
  return (
    <article className="panel side-panel">
      <div className="panel-header compact">
        <div>
          <p className="eyebrow">Operations</p>
          <h2>Inventory alerts</h2>
        </div>
        <ArrowDownUp size={20} />
      </div>

      <div className="alert-list">
        {inventoryItems.length ? (
          inventoryItems.map((item) => {
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
          <p className="empty-state">No inventory items yet. Add ingredients, packaging, sauces, and supplies.</p>
        )}
      </div>
    </article>
  )
}

function RecipeListPanel({
  components,
  onDelete,
}: {
  components: RecipeComponentRecord[]
  onDelete: (componentId: string) => void
}) {
  return (
    <article className="panel menu-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Ingredients used</p>
          <h2>Recipe rules</h2>
        </div>
        <BookOpen size={20} />
      </div>

      <div className="recipe-list">
        {components.length ? (
          components.map((component) => (
            <div className="recipe-row" key={component.id}>
              <div className="item-code">{component.menuItemCode}</div>
              <div>
                <strong>{component.inventoryItemName}</strong>
                <p>
                  {component.usageQuantity && component.usageUnit
                    ? `${formatQuantity(component.usageQuantity)} ${component.usageUnit} used, deducts ${formatQuantity(component.stockQuantity ?? component.quantity)} ${component.stockUnit ?? component.unit}`
                    : `${formatQuantity(component.quantity)} ${component.unit}`}
                  {' - '}
                  {component.appliesTo}
                  {component.choiceGroup ? ` - ${component.choiceGroup}` : ''}
                </p>
              </div>
              <button
                aria-label={`Remove ${component.inventoryItemName}`}
                className="icon-button"
                onClick={() => onDelete(component.id)}
                type="button"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        ) : (
          <p className="empty-state">No recipe rules yet. Add base ingredients, choices, add-ons, and packaging.</p>
        )}
      </div>
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
        Inventory item
        <select
          onChange={(event) => onUpdate(line.id, 'inventoryItemId', event.target.value)}
          required
          value={line.inventoryItemId}
        >
          <option value="">Choose inventory item</option>
          {inventoryItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.unit})
            </option>
          ))}
        </select>
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
        Usage unit
        <select
          disabled={!inventoryItem}
          onChange={(event) => onUpdate(line.id, 'usageUnit', event.target.value)}
          required
          value={line.usageUnit}
        >
          <option value="">Choose unit</option>
          {usageUnits.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
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

function SetupFlowPanel() {
  return (
    <article className="panel workflow-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Next build target</p>
          <h2>Dashboard setup flow</h2>
        </div>
        <ChefHat size={22} />
      </div>
      <div className="flow-steps">
        <span>Menu item</span>
        <span>Choices</span>
        <span>Ingredients used</span>
        <span>Packaging</span>
        <span>Ready to sell</span>
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
