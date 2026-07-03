import { readFile } from 'node:fs/promises'
import auth from '../node_modules/firebase-tools/lib/auth.js'
import { getAccessToken } from '../node_modules/firebase-tools/lib/apiv2.js'

const projectConfig = JSON.parse(await readFile(new URL('../.firebaserc', import.meta.url), 'utf8'))
const projectId = projectConfig.projects?.default
const hasConfirmFlag = process.argv.includes('--confirm')

if (!projectId) {
  throw new Error('No default Firebase project found in .firebaserc.')
}

if (!hasConfirmFlag) {
  throw new Error('This deletes branch data before loading samples. Re-run with --confirm to continue.')
}

const databasePath = `projects/${projectId}/databases/(default)`
const apiBase = `https://firestore.googleapis.com/v1/${databasePath}/documents`
const commitUrl = `https://firestore.googleapis.com/v1/${databasePath}/documents:commit`
const runQueryUrl = `https://firestore.googleapis.com/v1/${databasePath}/documents:runQuery`
const firebaseAccount = auth.getProjectDefaultAccount(process.cwd()) ?? auth.getGlobalDefaultAccount()

if (!firebaseAccount) {
  throw new Error('Firebase CLI is not logged in. Run firebase login before loading sample data.')
}

auth.setActiveAccount({}, firebaseAccount)
const token = await getAccessToken()

const sampleMenuItems = [
  ['hk1', 'HK1', 'Regular HK Style Noodles + 2 pcs Siomai', 'Noodles', 55, 44],
  ['gulaman-medium', 'GUL-M', 'Black Gulaman Medium', 'Drinks', 20, 16],
  ['addon-siomai', 'ADD-SIO', 'Additional Pork/Beef/Chicken Siomai or Wanton', 'Add-ons', 10, 8],
]

const sampleInventoryItems = [
  ['noodles', 'Chow mein noodles', 'Ingredient', 'kilo', 175, 5, 2],
  ['beef-siomai', 'Beef siomai', 'Ingredient', 'pc', 4, 60, 20],
  ['regular-tumbler', 'Regular tumbler/container', 'Packaging', 'pc', 3.5, 25, 10],
  ['gulaman-powder', 'Gulaman powder', 'Ingredient', 'kilo', 395, 2, 1],
  ['caramel-powder', 'Caramel powder', 'Ingredient', 'pc', 5, 0, 10],
]

const sampleRecipeComponents = [
  ['hk1', 'noodles', 0.08, 'base', ''],
  ['hk1', 'beef-siomai', 2, 'choice', 'Siomai choice'],
  ['hk1', 'regular-tumbler', 1, 'take_out', ''],
  ['gulaman-medium', 'gulaman-powder', 0.02, 'base', ''],
  ['gulaman-medium', 'caramel-powder', 1, 'base', ''],
]

const sampleStockMovements = [
  ['noodles', 'stock_in', 5, 'Opening stock entry'],
  ['beef-siomai', 'stock_in', 60, 'Opening delivery entry'],
]

const collectionsToReset = [
  'menuItems',
  'inventoryItems',
  'recipeComponents',
  'stockMovements',
  'orders',
  'daySessions',
  'dailyExpenses',
  'syncEvents',
]

function branchDocId(branchId, seedId) {
  return `${branchId}_${seedId}`
}

function businessDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function fieldValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null }
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value }
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: value } : { doubleValue: value }
  }

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() }
  }

  return { stringValue: String(value) }
}

function fieldsFromObject(record) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, fieldValue(value)]))
}

function valueFromField(field) {
  if ('stringValue' in field) return field.stringValue
  if ('booleanValue' in field) return field.booleanValue
  if ('integerValue' in field) return Number(field.integerValue)
  if ('doubleValue' in field) return Number(field.doubleValue)
  if ('timestampValue' in field) return field.timestampValue
  return null
}

function docName(collectionName, docId) {
  return `${databasePath}/documents/${collectionName}/${docId}`
}

async function firestoreFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${options.method ?? 'GET'} ${url} failed with ${response.status}: ${body}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

async function listBranches() {
  const payload = await firestoreFetch(`${apiBase}/branches?pageSize=100`)
  return (payload.documents ?? []).map((document) => {
    const id = document.name.split('/').pop()
    const fields = Object.fromEntries(
      Object.entries(document.fields ?? {}).map(([key, value]) => [key, valueFromField(value)]),
    )

    return { id, ...fields }
  })
}

async function queryBranchDocs(collectionName, branchId) {
  const payload = await firestoreFetch(runQueryUrl, {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collectionName }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'branchId' },
            op: 'EQUAL',
            value: { stringValue: branchId },
          },
        },
      },
    }),
  })

  return payload.map((result) => result.document).filter(Boolean)
}

async function deleteBranchData(branchId) {
  const counts = {}

  for (const collectionName of collectionsToReset) {
    const documents = await queryBranchDocs(collectionName, branchId)
    counts[collectionName] = documents.length

    for (const document of documents) {
      await firestoreFetch(`https://firestore.googleapis.com/v1/${document.name}`, { method: 'DELETE' })
    }
  }

  return counts
}

async function commitWrites(writes) {
  await firestoreFetch(commitUrl, {
    method: 'POST',
    body: JSON.stringify({ writes }),
  })
}

function updateWrite(collectionName, docId, record) {
  return {
    update: {
      name: docName(collectionName, docId),
      fields: fieldsFromObject(record),
    },
  }
}

async function seedSampleData(branchId) {
  const now = new Date()
  const writes = []

  for (const [seedId, code, name, category, sellingPrice, seniorPwdPrice] of sampleMenuItems) {
    writes.push(
      updateWrite('menuItems', branchDocId(branchId, seedId), {
        branchId,
        code,
        name,
        category,
        sellingPrice,
        seniorPwdPrice,
        status: 'ready',
        setupNotes: 'Ready for daily selling',
        createdAt: now,
        updatedAt: now,
      }),
    )
  }

  for (const [seedId, name, category, unit, buyingCost, currentStock, lowStockThreshold] of sampleInventoryItems) {
    writes.push(
      updateWrite('inventoryItems', branchDocId(branchId, seedId), {
        branchId,
        name,
        category,
        unit,
        buyingCost,
        currentStock,
        lowStockThreshold,
        supplierPriceType: 'discounted',
        active: true,
        createdAt: now,
        updatedAt: now,
      }),
    )
  }

  for (const [menuSeedId, inventorySeedId, quantity, appliesTo, choiceGroup] of sampleRecipeComponents) {
    const menuItem = sampleMenuItems.find(([seedId]) => seedId === menuSeedId)
    const inventoryItem = sampleInventoryItems.find(([seedId]) => seedId === inventorySeedId)
    const componentId = branchDocId(branchId, `${menuSeedId}_${inventorySeedId}_${appliesTo}_${choiceGroup || 'base'}`)
    const unit = inventoryItem?.[3] ?? 'pc'

    writes.push(
      updateWrite('recipeComponents', componentId, {
        branchId,
        menuItemId: branchDocId(branchId, menuSeedId),
        menuItemCode: menuItem?.[1] ?? menuSeedId.toUpperCase(),
        inventoryItemId: branchDocId(branchId, inventorySeedId),
        inventoryItemName: inventoryItem?.[1] ?? inventorySeedId,
        quantity,
        unit,
        usageQuantity: quantity,
        usageUnit: unit,
        stockQuantity: quantity,
        stockUnit: unit,
        appliesTo,
        choiceGroup: choiceGroup || null,
        createdAt: now,
        updatedAt: now,
      }),
    )
  }

  for (const [inventorySeedId, movementType, quantity, notes] of sampleStockMovements) {
    const inventoryItem = sampleInventoryItems.find(([seedId]) => seedId === inventorySeedId)

    writes.push(
      updateWrite('stockMovements', branchDocId(branchId, `sample_${movementType}_${inventorySeedId}`), {
        branchId,
        inventoryItemId: branchDocId(branchId, inventorySeedId),
        inventoryItemName: inventoryItem?.[1] ?? inventorySeedId,
        movementType,
        quantity,
        unit: inventoryItem?.[3] ?? 'pc',
        sourceType: 'owner_sample',
        businessDate: businessDate(),
        notes,
        createdAt: now,
      }),
    )
  }

  await commitWrites(writes)

  return writes.length
}

const requestedBranchId = process.argv.find((argument) => argument.startsWith('--branch='))?.split('=')[1]
const branches = await listBranches()
const branch = requestedBranchId
  ? branches.find((candidate) => candidate.id === requestedBranchId)
  : branches.find((candidate) => candidate.active) ?? branches[0]

if (!branch) {
  throw new Error('No branch document found. Create a branch before loading sample data.')
}

const deletedCounts = await deleteBranchData(branch.id)
const createdCount = await seedSampleData(branch.id)

console.log(`Loaded owner sample data for branch: ${branch.name ?? branch.id} (${branch.id})`)
console.log(`Deleted existing branch records: ${JSON.stringify(deletedCounts)}`)
console.log(`Created sample records: ${createdCount}`)
