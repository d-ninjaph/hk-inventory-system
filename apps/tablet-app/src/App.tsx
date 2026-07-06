import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownUp,
  Check,
  ChefHat,
  Loader2,
  LogOut,
  Minus,
  Plus,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  Store,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type {
  Branch,
  CartChoice,
  CartItem,
  DiscountType,
  InventoryItem,
  LocalDaySession,
  LocalOrder,
  MenuItem,
  OrderType,
  RecipeComponent,
  UserProfile,
} from './types'

const deviceIdStorageKey = 'hkTabletDeviceId'
const ordersStorageKey = 'hkTabletOrders'
const sessionStorageKey = 'hkTabletDaySession'
const categories = ['All', 'Noodles', 'Dimsum', 'Drinks', 'Rice Meals', 'Add-ons']

type Deductions = Map<string, { itemName: string; quantity: number; unit: string }>

function getDeviceId() {
  const savedId = window.localStorage.getItem(deviceIdStorageKey)

  if (savedId) {
    return savedId
  }

  const nextId = `tablet_${crypto.randomUUID()}`
  window.localStorage.setItem(deviceIdStorageKey, nextId)
  return nextId
}

function getBusinessDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function money(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

function getStoredOrders() {
  const raw = window.localStorage.getItem(ordersStorageKey)
  return raw ? (JSON.parse(raw) as LocalOrder[]) : []
}

function storeOrders(orders: LocalOrder[]) {
  window.localStorage.setItem(ordersStorageKey, JSON.stringify(orders.slice(0, 80)))
}

function getStoredSession() {
  const raw = window.localStorage.getItem(sessionStorageKey)
  return raw ? (JSON.parse(raw) as LocalDaySession) : null
}

function storeSession(session: LocalDaySession | null) {
  if (!session) {
    window.localStorage.removeItem(sessionStorageKey)
    return
  }

  window.localStorage.setItem(sessionStorageKey, JSON.stringify(session))
}

function getOrderTotals(cart: CartItem[], discountType: DiscountType) {
  const grossAmount = cart.reduce((total, item) => total + item.price * item.quantity, 0)
  const netAmount =
    discountType === 'senior_pwd'
      ? cart.reduce((total, item) => total + (item.seniorPwdPrice ?? item.price) * item.quantity, 0)
      : grossAmount

  return {
    discountAmount: Math.max(grossAmount - netAmount, 0),
    grossAmount,
    netAmount,
  }
}

function getChoiceGroups(menuItemId: string, recipeComponents: RecipeComponent[]) {
  const groups = new Map<string, RecipeComponent[]>()

  recipeComponents
    .filter((component) => component.menuItemId === menuItemId && component.appliesTo === 'choice')
    .forEach((component) => {
      const groupName = component.choiceGroup || 'Required choice'
      groups.set(groupName, [...(groups.get(groupName) ?? []), component])
    })

  return Array.from(groups.entries()).map(([name, options]) => ({ name, options }))
}

function calculateDeductions(order: LocalOrder, recipeComponents: RecipeComponent[]) {
  const deductions: Deductions = new Map()

  order.items.forEach((cartItem) => {
    const matchingRules = recipeComponents.filter((component) => {
      if (component.menuItemId !== cartItem.menuItemId) {
        return false
      }

      if (component.appliesTo === 'base') {
        return true
      }

      if (component.appliesTo === order.orderType) {
        return true
      }

      return cartItem.choices.some((choice) => choice.componentId === component.id)
    })

    matchingRules.forEach((component) => {
      const quantity = (component.stockQuantity ?? component.quantity) * cartItem.quantity
      const existing = deductions.get(component.inventoryItemId)

      deductions.set(component.inventoryItemId, {
        itemName: component.inventoryItemName,
        quantity: (existing?.quantity ?? 0) + quantity,
        unit: component.stockUnit ?? component.unit,
      })
    })
  })

  return deductions
}

function App() {
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [branch, setBranch] = useState<Branch | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [recipeComponents, setRecipeComponents] = useState<RecipeComponent[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderType, setOrderType] = useState<OrderType>('dine_in')
  const [discountType, setDiscountType] = useState<DiscountType>('none')
  const [activeCategory, setActiveCategory] = useState('All')
  const [localOrders, setLocalOrders] = useState<LocalOrder[]>(() => getStoredOrders())
  const [daySession, setDaySession] = useState<LocalDaySession | null>(() => getStoredSession())
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [configuringMenuItem, setConfiguringMenuItem] = useState<MenuItem | null>(null)
  const [selectedChoices, setSelectedChoices] = useState<Record<string, RecipeComponent>>({})
  const [quantity, setQuantity] = useState(1)
  const deviceId = useMemo(() => getDeviceId(), [])
  const pendingOrders = localOrders.filter((order) => order.status === 'pending_sync')
  const totals = getOrderTotals(cart, discountType)
  const visibleMenuItems = menuItems.filter(
    (item) => item.status === 'ready' && (activeCategory === 'All' || item.category === activeCategory),
  )
  const reorderItems = inventoryItems.filter((item) => item.currentStock <= item.lowStockThreshold)

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setAuthUser(user)
      setIsAuthLoading(false)

      if (!user) {
        setProfile(null)
        setBranch(null)
        return
      }

      const profileSnap = await getDoc(doc(db, 'users', user.uid))
      const nextProfile = profileSnap.exists() ? ({ ...profileSnap.data() } as UserProfile) : null
      const firstBranchId = nextProfile?.branchIds?.[0]

      if (!nextProfile || !firstBranchId) {
        setMessage('No branch access found for this account.')
        return
      }

      const branchSnap = await getDoc(doc(db, 'branches', firstBranchId))

      setProfile(nextProfile)
      setBranch(branchSnap.exists() ? ({ id: branchSnap.id, ...branchSnap.data() } as Branch) : null)
    })
  }, [])

  useEffect(() => {
    function updateOnlineStatus() {
      setIsOnline(navigator.onLine)
    }

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  useEffect(() => {
    if (!branch) {
      return undefined
    }

    const menuQuery = query(collection(db, 'menuItems'), where('branchId', '==', branch.id))
    const inventoryQuery = query(collection(db, 'inventoryItems'), where('branchId', '==', branch.id))
    const recipeQuery = query(collection(db, 'recipeComponents'), where('branchId', '==', branch.id))

    const unsubscribeMenu = onSnapshot(menuQuery, (snapshot) => {
      setMenuItems(
        snapshot.docs
          .map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }) as MenuItem)
          .sort((first, second) => first.code.localeCompare(second.code)),
      )
    })
    const unsubscribeInventory = onSnapshot(inventoryQuery, (snapshot) => {
      setInventoryItems(
        snapshot.docs
          .map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }) as InventoryItem)
          .filter((item) => item.active)
          .sort((first, second) => first.name.localeCompare(second.name)),
      )
    })
    const unsubscribeRecipes = onSnapshot(recipeQuery, (snapshot) => {
      setRecipeComponents(snapshot.docs.map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }) as RecipeComponent))
    })

    return () => {
      unsubscribeMenu()
      unsubscribeInventory()
      unsubscribeRecipes()
    }
  }, [branch])

  useEffect(() => {
    storeOrders(localOrders)
  }, [localOrders])

  useEffect(() => {
    storeSession(daySession)
  }, [daySession])

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    await signInWithEmailAndPassword(auth, email, password)
  }

  function startDay() {
    if (!branch) {
      return
    }

    setDaySession({
      branchId: branch.id,
      businessDate: getBusinessDate(),
      id: `${branch.id}_${getBusinessDate()}_${deviceId}`,
      openedAtIso: new Date().toISOString(),
      status: 'open',
    })
    setMessage('Business day started.')
  }

  function closeDay() {
    if (!daySession) {
      return
    }

    setDaySession({
      ...daySession,
      closedAtIso: new Date().toISOString(),
      status: 'closed',
    })
    setMessage('Business day closed. Sync when online.')
  }

  function requestMenuItem(item: MenuItem) {
    const groups = getChoiceGroups(item.id, recipeComponents)

    if (!groups.length) {
      addToCart(item, [], 1)
      return
    }

    setConfiguringMenuItem(item)
    setSelectedChoices({})
    setQuantity(1)
  }

  function addToCart(item: MenuItem, choices: CartChoice[], itemQuantity: number) {
    const cartId = `${item.id}_${choices.map((choice) => choice.componentId).join('_') || 'base'}`
    setCart((currentCart) => {
      const existing = currentCart.find((cartItem) => cartItem.id === cartId)

      if (existing) {
        return currentCart.map((cartItem) =>
          cartItem.id === cartId ? { ...cartItem, quantity: cartItem.quantity + itemQuantity } : cartItem,
        )
      }

      return [
        ...currentCart,
        {
          choices,
          code: item.code,
          id: cartId,
          menuItemId: item.id,
          name: item.name,
          price: item.sellingPrice,
          quantity: itemQuantity,
          seniorPwdPrice: item.seniorPwdPrice,
        },
      ]
    })
  }

  function confirmConfiguredItem() {
    if (!configuringMenuItem) {
      return
    }

    const groups = getChoiceGroups(configuringMenuItem.id, recipeComponents)
    const missingGroup = groups.find((group) => !selectedChoices[group.name])

    if (missingGroup) {
      setMessage(`Choose ${missingGroup.name} before adding the item.`)
      return
    }

    addToCart(
      configuringMenuItem,
      groups.map((group) => ({
        componentId: selectedChoices[group.name].id,
        group: group.name,
        label: selectedChoices[group.name].inventoryItemName,
      })),
      quantity,
    )
    setConfiguringMenuItem(null)
    setMessage('')
  }

  function changeCartQuantity(cartItemId: string, delta: number) {
    setCart((currentCart) =>
      currentCart
        .map((item) => (item.id === cartItemId ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0),
    )
  }

  function queueOrder() {
    if (!branch || !profile || !cart.length || !daySession || daySession.status !== 'open') {
      setMessage('Start the day and add at least one item before placing an order.')
      return
    }

    const orderTotals = getOrderTotals(cart, discountType)
    const order: LocalOrder = {
      ...orderTotals,
      branchId: branch.id,
      businessDate: daySession.businessDate,
      createdAtIso: new Date().toISOString(),
      deviceId,
      discountType,
      id: `${branch.id}_${crypto.randomUUID()}`,
      items: cart,
      orderType,
      staffId: authUser?.uid ?? 'unknown_staff',
      staffName: profile.displayName,
      status: 'pending_sync',
    }

    setLocalOrders((orders) => [order, ...orders])
    setCart([])
    setDiscountType('none')
    setMessage(isOnline ? 'Order saved. Tap Sync to send it to the dashboard.' : 'Order saved offline.')
  }

  async function syncOrder(order: LocalOrder) {
    const deductions = calculateDeductions(order, recipeComponents)
    const batch = writeBatch(db)
    const createdAt = Timestamp.fromDate(new Date(order.createdAtIso))

    batch.set(doc(db, 'orders', order.id), {
      branchId: order.branchId,
      businessDate: order.businessDate,
      createdAt,
      deviceId: order.deviceId,
      discountAmount: order.discountAmount,
      discountType: order.discountType === 'none' ? null : order.discountType,
      grossAmount: order.grossAmount,
      items: order.items,
      netAmount: order.netAmount,
      orderType: order.orderType,
      staffId: order.staffId,
      staffName: order.staffName,
      status: 'synced',
      syncedAt: serverTimestamp(),
    })

    deductions.forEach((deduction, inventoryItemId) => {
      batch.set(doc(db, 'stockMovements', `${order.id}_${inventoryItemId}`), {
        branchId: order.branchId,
        businessDate: order.businessDate,
        createdAt,
        inventoryItemId,
        inventoryItemName: deduction.itemName,
        movementType: 'sale_usage',
        notes: `Order ${order.id}`,
        quantity: -deduction.quantity,
        sourceId: order.id,
        sourceType: 'tablet_app',
        unit: deduction.unit,
      })
      batch.update(doc(db, 'inventoryItems', inventoryItemId), {
        currentStock: increment(-deduction.quantity),
        updatedAt: serverTimestamp(),
      })
    })

    await batch.commit()
  }

  async function syncDaySession(nextPendingCount: number) {
    if (!daySession || !branch) {
      return
    }

    await setDoc(
      doc(db, 'daySessions', daySession.id),
      {
        branchId: daySession.branchId,
        businessDate: daySession.businessDate,
        closedAt: daySession.closedAtIso ? Timestamp.fromDate(new Date(daySession.closedAtIso)) : null,
        deviceId,
        lastSyncedAt: serverTimestamp(),
        openedAt: Timestamp.fromDate(new Date(daySession.openedAtIso)),
        status: daySession.status,
      },
      { merge: true },
    )

    await setDoc(doc(collection(db, 'syncEvents')), {
      branchId: branch.id,
      createdAt: serverTimestamp(),
      deviceId,
      pendingRecords: nextPendingCount,
      status: nextPendingCount ? 'pending' : 'synced',
    })

    setDaySession({ ...daySession, lastSyncedAtIso: new Date().toISOString() })
  }

  async function syncPending() {
    if (!branch || !isOnline) {
      setMessage('Connect to the internet before syncing.')
      return
    }

    setIsSyncing(true)
    setMessage('')

    try {
      const syncedIds: string[] = []

      for (const order of pendingOrders) {
        await syncOrder(order)
        syncedIds.push(order.id)
      }

      const nextOrders = localOrders.map((order) =>
        syncedIds.includes(order.id)
          ? { ...order, status: 'synced' as const, syncedAtIso: new Date().toISOString() }
          : order,
      )
      const nextPendingCount = nextOrders.filter((order) => order.status === 'pending_sync').length

      setLocalOrders(nextOrders)
      await syncDaySession(nextPendingCount)
      setMessage(syncedIds.length ? `${syncedIds.length} order${syncedIds.length === 1 ? '' : 's'} synced.` : 'Session synced.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sync failed. Try again.')
    } finally {
      setIsSyncing(false)
    }
  }

  async function recordStockIn(item: InventoryItem) {
    if (!branch || !daySession) {
      setMessage('Start the day before recording stock.')
      return
    }

    const quantityText = window.prompt(`Stock-in quantity for ${item.name} (${item.unit})`)
    const quantityValue = Number(quantityText)

    if (!quantityText || quantityValue <= 0 || Number.isNaN(quantityValue)) {
      return
    }

    await updateDoc(doc(db, 'inventoryItems', item.id), {
      currentStock: increment(quantityValue),
      updatedAt: serverTimestamp(),
    })
    await setDoc(doc(collection(db, 'stockMovements')), {
      branchId: branch.id,
      businessDate: daySession.businessDate,
      createdAt: serverTimestamp(),
      inventoryItemId: item.id,
      inventoryItemName: item.name,
      movementType: 'stock_in',
      notes: 'Tablet stock entry',
      quantity: quantityValue,
      sourceType: 'tablet_app',
      unit: item.unit,
    })
    setMessage(`Stock-in recorded for ${item.name}.`)
  }

  if (isAuthLoading) {
    return (
      <main className="loading-screen">
        <Loader2 className="spin" size={28} />
        Loading tablet
      </main>
    )
  }

  if (!authUser || !profile || !branch) {
    return (
      <main className="login-screen">
        <form className="login-panel" onSubmit={handleLogin}>
          <div className="brand-lockup">
            <Store size={34} />
            <div>
              <p>7Mb Food & Beverage Station</p>
              <h1>Staff tablet</h1>
            </div>
          </div>
          <label>
            Email
            <input onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </label>
          <label>
            Password
            <input onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </label>
          <button className="primary-button" type="submit">
            Sign in
          </button>
          {message ? <p className="message error">{message}</p> : null}
        </form>
      </main>
    )
  }

  return (
    <main className="tablet-shell">
      <header className="tablet-header">
        <div>
          <p>{branch.location}</p>
          <h1>{branch.name}</h1>
        </div>
        <div className="header-actions">
          <span className={isOnline ? 'status-pill online' : 'status-pill offline'}>
            {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
            {isOnline ? 'Online' : 'Offline'}
          </span>
          <button className="secondary-button" onClick={() => signOut(auth)} type="button">
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </header>

      <section className="day-strip">
        <div>
          <p>Business date</p>
          <strong>{daySession?.businessDate ?? getBusinessDate()}</strong>
        </div>
        <div>
          <p>Day status</p>
          <strong>{daySession ? daySession.status : 'not started'}</strong>
        </div>
        <div>
          <p>Pending sync</p>
          <strong>{pendingOrders.length}</strong>
        </div>
        <div className="day-actions">
          {!daySession || daySession.status === 'closed' ? (
            <button className="primary-button" onClick={startDay} type="button">
              <ChefHat size={18} />
              Start day
            </button>
          ) : (
            <button className="secondary-button" onClick={closeDay} type="button">
              <Check size={18} />
              End day
            </button>
          )}
          <button className="primary-button" disabled={isSyncing || !isOnline} onClick={syncPending} type="button">
            {isSyncing ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
            Sync
          </button>
        </div>
      </section>

      {message ? <p className="message">{message}</p> : null}

      <section className="tablet-grid">
        <section className="menu-surface">
          <div className="section-heading">
            <div>
              <p>Orders</p>
              <h2>Menu</h2>
            </div>
            <div className="segmented-control">
              <button className={orderType === 'dine_in' ? 'active' : ''} onClick={() => setOrderType('dine_in')} type="button">
                Dine-in
              </button>
              <button className={orderType === 'take_out' ? 'active' : ''} onClick={() => setOrderType('take_out')} type="button">
                Take-out
              </button>
            </div>
          </div>
          <div className="category-tabs">
            {categories.map((category) => (
              <button className={activeCategory === category ? 'active' : ''} key={category} onClick={() => setActiveCategory(category)} type="button">
                {category}
              </button>
            ))}
          </div>
          <div className="menu-grid">
            {visibleMenuItems.map((item) => (
              <button className="menu-tile" key={item.id} onClick={() => requestMenuItem(item)} type="button">
                <span>{item.code}</span>
                <strong>{item.name}</strong>
                <em>{money(item.sellingPrice)}</em>
              </button>
            ))}
          </div>
        </section>

        <aside className="cart-panel">
          <div className="section-heading">
            <div>
              <p>Current order</p>
              <h2>Cart</h2>
            </div>
            <ShoppingCart size={26} />
          </div>
          <div className="cart-list">
            {cart.length ? (
              cart.map((item) => (
                <div className="cart-row" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    {item.choices.length ? <p>{item.choices.map((choice) => choice.label).join(', ')}</p> : null}
                    <span>{money(item.price)} x {item.quantity}</span>
                  </div>
                  <div className="quantity-stepper">
                    <button onClick={() => changeCartQuantity(item.id, -1)} type="button">
                      <Minus size={16} />
                    </button>
                    <strong>{item.quantity}</strong>
                    <button onClick={() => changeCartQuantity(item.id, 1)} type="button">
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-state">Tap a menu item to start an order.</p>
            )}
          </div>
          <div className="discount-toggle">
            <button className={discountType === 'none' ? 'active' : ''} onClick={() => setDiscountType('none')} type="button">
              Regular
            </button>
            <button className={discountType === 'senior_pwd' ? 'active' : ''} onClick={() => setDiscountType('senior_pwd')} type="button">
              Senior/PWD
            </button>
          </div>
          <div className="total-box">
            <span>Gross</span>
            <strong>{money(totals.grossAmount)}</strong>
            <span>Discount</span>
            <strong>{money(totals.discountAmount)}</strong>
            <span>Net total</span>
            <strong>{money(totals.netAmount)}</strong>
          </div>
          <button className="primary-button checkout-button" disabled={!cart.length} onClick={queueOrder} type="button">
            <ReceiptText size={20} />
            Place order
          </button>
        </aside>

        <section className="alerts-panel">
          <div className="section-heading">
            <div>
              <p>Inventory</p>
              <h2>Alerts and stock-in</h2>
            </div>
            <AlertTriangle size={24} />
          </div>
          <div className="alert-list">
            {reorderItems.length ? (
              reorderItems.slice(0, 8).map((item) => (
                <div className="alert-row" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <p>{formatQuantity(item.currentStock)} {item.unit} left - reorder at {formatQuantity(item.lowStockThreshold)} {item.unit}</p>
                  </div>
                  <button className="secondary-button compact" onClick={() => recordStockIn(item)} type="button">
                    <ArrowDownUp size={16} />
                    Stock-in
                  </button>
                </div>
              ))
            ) : (
              <p className="empty-state">No reorder alerts right now.</p>
            )}
          </div>
        </section>
      </section>

      {configuringMenuItem ? (
        <div className="modal-backdrop">
          <section className="choice-modal" role="dialog" aria-modal="true">
            <button className="close-button" onClick={() => setConfiguringMenuItem(null)} type="button" aria-label="Close choices">
              <X size={18} />
            </button>
            <p>Required choices</p>
            <h2>{configuringMenuItem.name}</h2>
            {getChoiceGroups(configuringMenuItem.id, recipeComponents).map((group) => (
              <div className="choice-group" key={group.name}>
                <strong>{group.name}</strong>
                <div>
                  {group.options.map((option) => (
                    <button
                      className={selectedChoices[group.name]?.id === option.id ? 'selected' : ''}
                      key={option.id}
                      onClick={() => setSelectedChoices((choices) => ({ ...choices, [group.name]: option }))}
                      type="button"
                    >
                      {option.inventoryItemName}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="modal-footer">
              <div className="quantity-stepper large">
                <button onClick={() => setQuantity((current) => Math.max(current - 1, 1))} type="button">
                  <Minus size={18} />
                </button>
                <strong>{quantity}</strong>
                <button onClick={() => setQuantity((current) => current + 1)} type="button">
                  <Plus size={18} />
                </button>
              </div>
              <button className="primary-button" onClick={confirmConfiguredItem} type="button">
                Add to cart
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

export default App
