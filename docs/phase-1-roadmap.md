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

- Local staff PIN login.
- Start day.
- Take orders.
- Select dine-in or take-out.
- Select siomai/dimsum choices.
- Add toppings.
- Apply Senior/PWD discounts when enabled.
- Record stock-in and wastage.
- Review low-stock alerts.
- Complete EOD count.
- Sync when online.

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
- Firestore-backed recipe/BOM rule creation/listing/removal.
- Starter HK menu, inventory, and recipe seed action.

## 5. Testing

- Offline order entry.
- Dine-in versus take-out deduction.
- Modifier-based siomai deduction.
- Add-on deduction.
- Low-stock alerts.
- EOD expected versus actual count.
- Sync after reconnecting.
- No duplicate records after retrying sync.
