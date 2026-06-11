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
  Settings,
  ShoppingCart,
  Utensils,
} from 'lucide-react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { doc, getDoc, type Timestamp } from 'firebase/firestore'
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

type MenuItem = {
  code: string
  name: string
  category: string
  price: number
  status: 'Ready' | 'Draft'
  setup: string
}

type InventoryItem = {
  name: string
  stock: string
  threshold: string
  status: 'OK' | 'Reorder' | 'Critical'
}

const menuItems: MenuItem[] = [
  {
    code: 'HK1',
    name: 'Regular Noodles + 2 pcs Siomai',
    category: 'Noodles',
    price: 55,
    status: 'Ready',
    setup: 'Needs siomai choice',
  },
  {
    code: 'HK2',
    name: 'Regular Noodles + 2 pcs Sharksfin/Japanese',
    category: 'Noodles',
    price: 59,
    status: 'Ready',
    setup: 'Needs premium choice',
  },
  {
    code: 'HK3',
    name: 'Jumbo Noodles + 4 pcs Siomai',
    category: 'Noodles',
    price: 100,
    status: 'Draft',
    setup: 'Recipe review',
  },
  {
    code: 'HK7',
    name: 'Rice Toppings + 4 pcs Siomai',
    category: 'Rice Meals',
    price: 65,
    status: 'Ready',
    setup: 'Needs siomai choice',
  },
  {
    code: 'HK9',
    name: 'Siopao Asado',
    category: 'Dimsum',
    price: 40,
    status: 'Ready',
    setup: 'Fixed item',
  },
]

const inventoryItems: InventoryItem[] = [
  { name: 'Chow mein noodles', stock: '12 kg', threshold: '8 kg', status: 'OK' },
  { name: 'Pork siomai', stock: '42 pcs', threshold: '60 pcs', status: 'Reorder' },
  { name: 'Regular lids', stock: '18 pcs', threshold: '40 pcs', status: 'Critical' },
  { name: 'Sweet brown sauce', stock: '0.7 gal', threshold: '0.5 gal', status: 'OK' },
]

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
  const branchStatus = useMemo(() => (branch.active ? 'Active branch' : 'Inactive branch'), [branch.active])

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
          {navItems.map((item, index) => {
            const Icon = item.icon
            return (
              <button className={index === 0 ? 'nav-item active' : 'nav-item'} key={item.label}>
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
            <strong>126</strong>
          </article>
          <article className="metric-card">
            <CircleDollarSign size={22} />
            <p>Synced Sales</p>
            <strong>{money(12680)}</strong>
          </article>
          <article className="metric-card warning">
            <AlertTriangle size={22} />
            <p>Reorder Alerts</p>
            <strong>2</strong>
          </article>
          <article className="metric-card">
            <ClipboardList size={22} />
            <p>Setup Checks</p>
            <strong>3 drafts</strong>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel menu-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Setup</p>
                <h2>Menu items</h2>
              </div>
              <button className="primary-button">
                <PackagePlus size={18} />
                Add item
              </button>
            </div>

            <div className="table-list">
              {menuItems.map((item) => (
                <div className="table-row" key={item.code}>
                  <div className="item-code">{item.code}</div>
                  <div>
                    <strong>{item.name}</strong>
                    <p>
                      {item.category} - {item.setup}
                    </p>
                  </div>
                  <div className="price">{money(item.price)}</div>
                  <span className={item.status === 'Ready' ? 'badge ready' : 'badge draft'}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel side-panel">
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">Operations</p>
                <h2>Inventory alerts</h2>
              </div>
              <ArrowDownUp size={20} />
            </div>

            <div className="alert-list">
              {inventoryItems.map((item) => (
                <div className="alert-row" key={item.name}>
                  <div>
                    <strong>{item.name}</strong>
                    <p>
                      {item.stock} left - reorder at {item.threshold}
                    </p>
                  </div>
                  <span className={`stock-status ${item.status.toLowerCase()}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </article>

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
        </section>
      </section>
    </main>
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
