// Runs the platonic-ts check gate over the viewer workspace: typecheck and lint through platonic-ts,
// the escape-hatch ratchet through its pure scanner (its own gate shells out to a platonic-ts-only
// command for unused exports), then the V2 tests.
// Run with: node ../platonic-ts/node_modules/tsx/dist/cli.mjs tools/platonic-check.mts
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { compareToBaseline, type RatchetBaseline } from '../../platonic-ts/packages/check/src/ratchet.ts'
import { runCheck } from '../../platonic-ts/packages/check/src/run.ts'
import { scanRepo } from '../../platonic-ts/packages/check/src/scan.ts'

const repoDir = resolve(import.meta.dirname, '..', 'viewer')
const baselinePath = resolve(repoDir, 'ratchet.json')

const report = (name: string, ok: boolean, detail: string): boolean => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`)
  return ok
}

const ratchet = async (): Promise<boolean> => {
  const baseline: Partial<RatchetBaseline> = JSON.parse(await readFile(baselinePath, 'utf8'))
  const current = await scanRepo(repoDir)
  const result = compareToBaseline(current, baseline)
  const regressed = result.verdict === 'regressed'
  return report('ratchet', !regressed, regressed ? `regressed: ${result.regressions.join(', ')}` : `${result.verdict} ${JSON.stringify(current)}`)
}

const tests = async (): Promise<boolean> => {
  const outcome = await promisify(execFile)('npm', ['run', 'test:v2', '--silent'], { cwd: repoDir, shell: true, maxBuffer: 1 << 26 })
    .then((result) => ({ ok: true, text: `${result.stdout}${result.stderr}` }))
    .catch((error: { stdout?: string; stderr?: string }) => ({ ok: false, text: `${error.stdout ?? ''}${error.stderr ?? ''}` }))
  const summary = outcome.text.split('\n').filter((line) => /Test Files|Tests |FAIL/.test(line)).map((line) => line.trim()).join(' | ')
  return report('tests', outcome.ok, summary)
}

const gate = await runCheck({ repoDir, baselinePath, steps: ['typecheck', 'lint'] })
const ok = gate.steps.every((step) => report(step.name, step.ok, step.ok ? `${Math.round(step.durationMs)} ms` : step.detail)) && (await ratchet()) && (await tests())
process.exitCode = ok ? 0 : 1
