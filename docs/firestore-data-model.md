# Firestore Data Model

Phase 1 uses Firestore as the cloud sync database. The tablet app still uses local SQLite for offline operations.

## Collections

### users

Stores dashboard users and role access.

Key fields:

- `displayName`
- `email`
- `role`: `owner`, `admin`, or `staff`
- `branchIds`
- `createdAt`

### branches

Stores branch/cart records.

Key fields:

- `name`
- `location`
- `active`
- `createdAt`

### menuItems

Stores sellable menu records.

Key fields:

- `code`
- `name`
- `category`
- `sellingPrice`
- `seniorPwdPrice`
- `status`: `draft`, `ready`, or `inactive`
- `requiresChoice`
- `activeFrom`

### inventoryItems

Stores ingredients, packaging, sauces, and supplies.

Key fields:

- `name`
- `category`
- `unit`
- `buyingCost`
- `supplierPriceType`
- `lowStockThreshold`
- `active`

### recipeComponents

Stores recipe and packaging deduction rules.

Key fields:

- `menuItemId`
- `inventoryItemId`
- `quantity`
- `appliesTo`: `base`, `dine_in`, `take_out`, `choice`, or `addon`
- `choiceGroup`

Notes:

- `base` applies whenever the menu item is sold.
- `take_out` applies only for take-out orders.
- `choice` represents required options, such as pork/beef/chicken/wanton siomai.
- Sauces are currently tracked as inventory items, but not forced per order because customers can add sauces freely.

### orders

Stores synced tablet orders.

Key fields:

- `branchId`
- `deviceId`
- `staffId`
- `businessDate`
- `orderType`: `dine_in` or `take_out`
- `grossAmount`
- `discountType`
- `discountAmount`
- `netAmount`
- `status`
- `createdAt`

### stockMovements

Stores all inventory changes.

Key fields:

- `branchId`
- `inventoryItemId`
- `movementType`
- `quantity`
- `sourceType`
- `sourceId`
- `businessDate`
- `createdAt`

### daySessions

Stores opening and closing day records.

Key fields:

- `branchId`
- `businessDate`
- `openedAt`
- `closedAt`
- `status`
- `lastSyncedAt`

### dailyExpenses

Stores simple daily expense references for Phase 1.

Key fields:

- `branchId`
- `businessDate`
- `category`
- `amount`
- `notes`
- `createdAt`

### syncEvents

Stores device sync status events.

Key fields:

- `branchId`
- `deviceId`
- `status`
- `pendingRecords`
- `createdAt`
