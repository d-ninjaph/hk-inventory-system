# Phase 1 Roadmap

## 1. Product Setup

- Confirm staff tablet workflow.
- Confirm owner dashboard workflow.
- Collect client menu, stock, supplier price, recipe, and packaging data.
- Keep accounting, payroll, tax reports, and supplier purchase orders out of Phase 1.

## 2. Data Setup

- Menu items with item code, category, selling price, and status.
- Inventory items with unit, discounted buying cost, current stock, and low-stock threshold.
- Recipe components for base ingredients, choices, add-ons, and packaging.
- Stock movements for sales usage, stock-in, wastage, spoilage, mistakes, and adjustments.

## 3. Staff Tablet App

- Tablet-first MVP lives in `apps/tablet-app` as a React/Vite app for immediate UI and sync testing.
- Staff sign-in through Firebase Email/Password for the MVP.
- Start day and end day.
- Take orders.
- Select dine-in or take-out.
- Select required choices.
- Apply Senior/PWD pricing when enabled.
- Queue orders locally when offline.
- Sync orders, stock movements, day sessions, and sync events when online.
- Record stock-in from low-stock alerts.

## 4. Owner Web Dashboard

- Owner login.
- Menu management.
- Inventory management.
- Recipe and packaging setup.
- Low-stock threshold setup.
- Synced sales and inventory reports.
- EOD report viewer.
- Tablet sync status.

Current implemented baseline:

- Firebase Email/Password login.
- Firestore user and branch loading.
- Firestore-backed menu item creation/listing.
- Firestore-backed inventory item creation/listing.
- Firestore-backed recipe/BOM batch rule creation/listing/removal.
- Owner sample data loader for menu, inventory, recipes, and opening stock movements.
- Menu and inventory edit flows.
- Unit dropdowns and clearer currency fields for setup forms.
- Owner-facing pagination, filters, confirmation modals, and contextual help tooltips.
- Tablet MVP scaffold with ordering, local pending queue, stock deduction sync, stock-in, and day-session sync.

## 5. Testing

- Offline order entry.
- Dine-in versus take-out deduction.
- Modifier-based siomai deduction.
- Add-on deduction.
- Low-stock alerts.
- EOD expected versus actual count.
- Sync after reconnecting.
- No duplicate records after retrying sync.
