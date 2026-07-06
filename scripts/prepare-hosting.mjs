import { cp, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const hostingDist = resolve(root, 'dist/hosting')
const dashboardDist = resolve(root, 'apps/web-dashboard/dist')
const tabletDist = resolve(root, 'apps/tablet-app/dist')

await rm(hostingDist, { force: true, recursive: true })
await mkdir(resolve(hostingDist, 'tablet'), { recursive: true })
await cp(dashboardDist, hostingDist, { recursive: true })
await cp(tabletDist, resolve(hostingDist, 'tablet'), { recursive: true })

console.log('Prepared Firebase Hosting output at dist/hosting')
