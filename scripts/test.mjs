// Runs the tests in tests/*.test.ts. No test library is needed: each test file is bundled with esbuild (already installed with the app's build
// tools) and run with Node's built-in test runner, using Electron's own copy of Node so the database library is the same one the app uses.
// "electron" itself is swapped for a tiny stand-in (tests/stubs/electron.ts), so nothing opens a window or touches your real library.
import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'

const root = resolve(import.meta.dirname, '..')
const out = join(root, '.test-out')
const filter = process.argv[2]   // optional: only test files whose name contains this
const files = readdirSync(join(root, 'tests')).filter(f => f.endsWith('.test.ts') && (!filter || f.includes(filter)))
if (files.length === 0) { console.error('No test files found.'); process.exit(1) }

rmSync(out, { recursive: true, force: true })
await build({
  entryPoints: files.map(f => join(root, 'tests', f)),
  outdir: out, outExtension: { '.js': '.cjs' },
  bundle: true, platform: 'node', format: 'cjs', target: 'node22', logLevel: 'warning',
  external: ['better-sqlite3', 'typescript'],   // typescript is read by the hooks-order test, not bundled
  alias: { electron: join(root, 'tests/stubs/electron.ts') }
})

const electron = createRequire(import.meta.url)('electron')   // the path to the Electron binary
const run = spawnSync(electron, ['--test', ...files.map(f => join(out, f.replace(/\.ts$/, '.cjs')))], {
  cwd: root, stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})
process.exit(run.status ?? 1)
