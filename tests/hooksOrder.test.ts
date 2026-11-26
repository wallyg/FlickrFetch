import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ts = require('typescript') as typeof import('typescript')

// A screen that calls a React hook (useState, useEffect ...) after an early "return" crashes the moment that return is taken
// ("Rendered fewer hooks than expected"). Opening a photo in Discover > Explore did exactly that. This reads every screen and
// finds any hook placed after a return that sits at the top of the same function.

const SRC = join(process.cwd(), 'src/renderer')
const files = (dir: string): string[] => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(p) ? [p] : [] })

type Node = import('typescript').Node
const isHookCall = (n: Node): boolean => ts.isCallExpression(n) && ((ts.isIdentifier(n.expression) && /^use[A-Z]/.test(n.expression.text)) || (ts.isPropertyAccessExpression(n.expression) && /^use[A-Z]/.test(n.expression.name.text)))
function containsReturn(n: Node): boolean {
  let found = false
  const visit = (x: Node): void => { if (found || ts.isFunctionLike(x)) return; if (ts.isReturnStatement(x)) { found = true; return } ts.forEachChild(x, visit) }
  visit(n); return found
}
function firstHook(n: Node): Node | null {
  let found: Node | null = null
  const visit = (x: Node): void => { if (found || (ts.isFunctionLike(x) && x !== n)) return; if (isHookCall(x)) { found = x; return } ts.forEachChild(x, visit) }
  visit(n); return found
}

export function hooksAfterReturn(source: string, name = 'file.tsx'): string[] {
  const sf = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const problems: string[] = []
  const check = (fn: import('typescript').FunctionLikeDeclaration, label: string): void => {
    if (!fn.body || !ts.isBlock(fn.body)) return
    let early: Node | null = null
    for (const st of fn.body.statements) {
      if (early) {
        const h = firstHook(st)
        if (h) problems.push(`${label}: a hook on line ${sf.getLineAndCharacterOfPosition(h.getStart()).line + 1} comes after the return on line ${sf.getLineAndCharacterOfPosition(early.getStart()).line + 1}`)
      } else if ((ts.isIfStatement(st) && containsReturn(st)) || ts.isReturnStatement(st)) early = st
    }
  }
  const isComponentName = (n: string): boolean => /^[A-Z]|^use[A-Z]/.test(n)
  const visit = (n: Node): void => {
    if (ts.isFunctionDeclaration(n) && n.name && isComponentName(n.name.text)) check(n, n.name.text)
    else if (ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && isComponentName(d.name.text) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) check(d.initializer, d.name.text)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return problems
}

test('no screen calls a hook after an early return', () => {
  const found = files(SRC).flatMap(f => hooksAfterReturn(readFileSync(f, 'utf8'), f).map(p => `${f.slice(SRC.length + 1)}: ${p}`))
  assert.deepEqual(found, [])
})

test('the check itself catches the Explore mistake and leaves a correct screen alone', () => {
  const bad = `function Screen() { const [a] = useState(0); if (a) { return null } useEffect(() => {}, []); return null }`
  const good = `function Screen() { const [a] = useState(0); useEffect(() => {}, []); if (a) { return null } return null }`
  const callbackOnly = `function Screen() { const [a] = useState(0); if (a) return null; const f = () => { return 1 }; return null }`
  assert.equal(hooksAfterReturn(bad).length, 1)
  assert.equal(hooksAfterReturn(good).length, 0)
  assert.equal(hooksAfterReturn(callbackOnly).length, 0)
})
