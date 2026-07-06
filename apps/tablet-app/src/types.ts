import type { Timestamp } from 'firebase/firestore'

export type Branch = {
  id: string
  name: string
  location: string
  active: boolean
  tabletCatalogStatus?: 'draft' | 'published'
  tabletCatalogPublishedAt?: Timestamp
  tabletCatalogPublishedBy?: string
  tabletCatalogUpdatedAt?: Timestamp
}

export type UserProfile = {
  displayName: string
  email: string
  role: 'owner' | 'admin' | 'staff'
  branchIds: string[]
}

export type MenuItem = {
  id: string
  branchId: string
  code: string
  name: string
  category: string
  sellingPrice: number
  seniorPwdPrice?: number
  status: 'draft' | 'ready' | 'inactive'
}

export type InventoryItem = {
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

export type RecipeComponent = {
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
  appliesTo: 'base' | 'choice' | 'addon' | 'dine_in' | 'take_out'
  choiceGroup?: string | null
}

export type OrderType = 'dine_in' | 'take_out'
export type DiscountType = 'none' | 'senior_pwd'

export type CartChoice = {
  group: string
  componentId: string
  label: string
}

export type CartItem = {
  id: string
  menuItemId: string
  code: string
  name: string
  quantity: number
  price: number
  seniorPwdPrice?: number
  choices: CartChoice[]
}

export type LocalOrder = {
  id: string
  branchId: string
  deviceId: string
  staffId: string
  staffName: string
  businessDate: string
  orderType: OrderType
  items: CartItem[]
  grossAmount: number
  discountType: DiscountType
  discountAmount: number
  netAmount: number
  status: 'pending_sync' | 'synced'
  createdAtIso: string
  syncedAtIso?: string
}

export type LocalDaySession = {
  id: string
  branchId: string
  businessDate: string
  openedAtIso: string
  closedAtIso?: string
  status: 'open' | 'closed'
  lastSyncedAtIso?: string
}

export type SyncEvent = {
  id: string
  branchId: string
  deviceId: string
  status: string
  pendingRecords: number
  createdAt?: Timestamp
}
