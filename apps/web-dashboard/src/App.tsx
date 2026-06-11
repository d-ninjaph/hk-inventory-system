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
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  PackagePlus,
  Plus,
  Settings,
  ShoppingCart,
  Utensils,
} from 'lucide-react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
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

function money(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value)
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
    unit: 'pcs',
    buyingCost: '',
    currentStock: '',
    lowStockThreshold: '',
  })
  const [formMessage, setFormMessage] = useState('')
  const branchStatus = useMemo(() => (branch.active ? 'Active branch' : 'Inactive branch'), [branch.active])
  const reorderCount = inventoryItems.filter((item) => getStockStatus(item) === 'Reorder' || getStockStatus(item) === 'Critical').length
  const draftCount = menuItems.filter((item) => item.status === 'draft').length

  useEffect(() => {
    const menuQuery = query(collection(db, 'menuItems'), where('branchId', '==', branch.id))
    const inventoryQuery = query(collection(db, 'inventoryItems'), where('branchId', '==', branch.id))

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

    return () => {
      unsubscribeMenu()
      unsubscribeInventory()
    }
  }, [branch.id])

  async function handleCreateMenuItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage('')

    await addDoc(collection(db, 'menuItems'), {
      branchId: branch.id,
      code: menuForm.code.trim().toUpperCase(),
      name: menuForm.name.trim(),
      category: menuForm.category,
      sellingPrice: Number(menuForm.sellingPrice),
      seniorPwdPrice: menuForm.seniorPwdPrice ? Number(menuForm.seniorPwdPrice) : null,
      status: menuForm.status,
      setupNotes: 'Recipe setup pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    setMenuForm({
      code: '',
      name: '',
      category: 'Noodles',
      sellingPrice: '',
      seniorPwdPrice: '',
      status: 'draft',
    })
    setFormMessage('Menu item saved.')
  }

  async function handleCreateInventoryItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage('')

    await addDoc(collection(db, 'inventoryItems'), {
      branchId: branch.id,
      name: inventoryForm.name.trim(),
      category: inventoryForm.category,
      unit: inventoryForm.unit.trim(),
      buyingCost: Number(inventoryForm.buyingCost),
      currentStock: Number(inventoryForm.currentStock),
      lowStockThreshold: Number(inventoryForm.lowStockThreshold),
      supplierPriceType: 'discounted',
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    setInventoryForm({
      name: '',
      category: 'Ingredient',
      unit: 'pcs',
      buyingCost: '',
      currentStock: '',
      lowStockThreshold: '',
    })
    setFormMessage('Inventory item saved.')
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
            <strong>0</strong>
          </article>
          <article className="metric-card">
            <CircleDollarSign size={22} />
            <p>Synced Sales</p>
            <strong>{money(0)}</strong>
          </article>
          <article className="metric-card warning">
            <AlertTriangle size={22} />
            <p>Reorder Alerts</p>
            <strong>{reorderCount}</strong>
          </article>
          <article className="metric-card">
            <ClipboardList size={22} />
            <p>Setup Checks</p>
            <strong>{draftCount} drafts</strong>
          </article>
        </section>

        {activeSection === 'Overview' ? (
          <section className="content-grid">
            <MenuListPanel menuItems={menuItems.slice(0, 5)} onAdd={() => setActiveSection('Menu')} />
            <InventoryAlertsPanel inventoryItems={inventoryItems} />
            <SetupFlowPanel />
          </section>
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
                  Code
                  <input
                    onChange={(event) => setMenuForm((form) => ({ ...form, code: event.target.value }))}
                    placeholder="HK10"
                    required
                    value={menuForm.code}
                  />
                </label>
                <label>
                  Name
                  <input
                    onChange={(event) => setMenuForm((form) => ({ ...form, name: event.target.value }))}
                    placeholder="Regular Noodles + 2 pcs Siomai"
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
                  <input
                    min="0"
                    onChange={(event) => setMenuForm((form) => ({ ...form, sellingPrice: event.target.value }))}
                    placeholder="55"
                    required
                    type="number"
                    value={menuForm.sellingPrice}
                  />
                </label>
                <label>
                  Senior/PWD price
                  <input
                    min="0"
                    onChange={(event) => setMenuForm((form) => ({ ...form, seniorPwdPrice: event.target.value }))}
                    placeholder="44"
                    type="number"
                    value={menuForm.seniorPwdPrice}
                  />
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
                  Save menu item
                </button>
              </form>
              {formMessage ? <p className="success-message">{formMessage}</p> : null}
            </article>
            <MenuListPanel menuItems={menuItems} onAdd={() => undefined} />
          </section>
        ) : null}

        {activeSection === 'Inventory' ? (
          <section className="screen-grid">
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
                    placeholder="Pork siomai"
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
                  <input
                    onChange={(event) => setInventoryForm((form) => ({ ...form, unit: event.target.value }))}
                    placeholder="pcs, kg, gal"
                    required
                    value={inventoryForm.unit}
                  />
                </label>
                <label>
                  Buying cost
                  <input
                    min="0"
                    onChange={(event) => setInventoryForm((form) => ({ ...form, buyingCost: event.target.value }))}
                    placeholder="4"
                    required
                    step="0.01"
                    type="number"
                    value={inventoryForm.buyingCost}
                  />
                </label>
                <label>
                  Current stock
                  <input
                    min="0"
                    onChange={(event) => setInventoryForm((form) => ({ ...form, currentStock: event.target.value }))}
                    placeholder="60"
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
                    placeholder="30"
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
            <InventoryAlertsPanel inventoryItems={inventoryItems} />
          </section>
        ) : null}

        {activeSection !== 'Overview' && activeSection !== 'Menu' && activeSection !== 'Inventory' ? (
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

function MenuListPanel({ menuItems, onAdd }: { menuItems: MenuItemRecord[]; onAdd: () => void }) {
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
            <div className="table-row" key={item.id}>
              <div className="item-code">{item.code}</div>
              <div>
                <strong>{item.name}</strong>
                <p>
                  {item.category} - {item.setupNotes || 'Recipe setup pending'}
                </p>
              </div>
              <div className="price">{money(item.sellingPrice)}</div>
              <span className={item.status === 'ready' ? 'badge ready' : 'badge draft'}>{item.status}</span>
            </div>
          ))
        ) : (
          <p className="empty-state">No menu items yet. Add the current HK menu here first.</p>
        )}
      </div>
    </article>
  )
}

function InventoryAlertsPanel({ inventoryItems }: { inventoryItems: InventoryItemRecord[] }) {
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
              <div className="alert-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <p>
                    {item.currentStock} {item.unit} left - reorder at {item.lowStockThreshold} {item.unit}
                  </p>
                </div>
                <span className={`stock-status ${status.toLowerCase()}`}>{status}</span>
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
      return
    }

    setProfile(null)
    setBranch(null)
    setSetupError('')
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
