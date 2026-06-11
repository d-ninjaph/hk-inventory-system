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
  PackagePlus,
  Settings,
  ShoppingCart,
  Utensils,
} from 'lucide-react'
import './App.css'

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

function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">HK</div>
          <div>
            <p>Hongkong Style</p>
            <strong>Noodles & Dimsum</strong>
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
      </aside>

      <section className="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">Cabugao Ilocos branch</p>
            <h1>Owner dashboard</h1>
          </div>
          <div className="sync-pill">
            <Cloud size={18} />
            Last synced today, 9:15 PM
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

export default App
