/**
 * scripts/lib/preflight-cap.mjs — PREFLIGHT-HARD-CAP-1: the per-row preflight budget, enforced by the
 * script instead of by the builder's memory.
 *
 * The builder preamble (§8, BUILDER-CTX-PREFLIGHT-BUDGET-1, 2026-10-20) has said "three runs of
 * scripts/preflight.mjs per row, total" since 2026-10-20, counted in `.tmp/preflight-count`. Builders
 * did not keep it: on 2026-10-29 one builder ran 34, and every extra run is re-read on every later
 * turn of a context that is often 200k+. This module makes the fourth run refuse.
 *
 * Scope (what counts): only runs whose repo root is a builder worktree, `<anything>/.wt/<ROW>`.
 * Exempt, never counted: CI (GITHUB_ACTIONS / CI set), the pre-push hook's own run (the hook exports
 * MUTATION_TIER_IN_HOOK=1 around it — "the hooked push runs --quick by itself; it is not one of your
 * three", preamble §8), `--self-test`, and an explicit PREFLIGHT_BUDGET_OVERRIDE=1 (seat or desk use;
 * a builder never sets it). Side-effect-free except through the injected fs functions.
 */
import { join } from 'node:path';

export const PREFLIGHT_CAP = 3;

/**
 * @returns {{ counted: boolean, refused: boolean, count: number, reason: string }}
 */
export function checkPreflightCap({ repo, env = {}, argv = [], fs, cap = PREFLIGHT_CAP }) {
  const skip = (reason) => ({ counted: false, refused: false, count: 0, reason });
  if (env.GITHUB_ACTIONS || env.CI) return skip('CI');
  if (env.MUTATION_TIER_IN_HOOK === '1') return skip('pre-push hook run');
  if (env.PREFLIGHT_BUDGET_OVERRIDE === '1') return skip('PREFLIGHT_BUDGET_OVERRIDE=1');
  if (argv.includes('--self-test')) return skip('--self-test');
  const root = String(repo || '').replace(/\\/g, '/').replace(/\/+$/, '');
  if (!/\/\.wt\/[^/]+$/i.test(root)) return skip('not a .wt/<ROW> builder worktree');

  const dir = join(repo, '.tmp');
  const file = join(dir, 'preflight-count');
  let n = 0;
  try { n = parseInt(String(fs.readFileSync(file, 'utf8')).trim(), 10) || 0; } catch { n = 0; }
  if (n >= cap) return { counted: false, refused: true, count: n, reason: `budget spent (${n}/${cap})` };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, String(n + 1));
  return { counted: true, refused: false, count: n + 1, reason: `run ${n + 1}/${cap}` };
}

export function refusalMessage(r, cap = PREFLIGHT_CAP) {
  return [
    `⛔ PREFLIGHT-HARD-CAP-1: this worktree has used its ${cap} preflight runs (${r.count}/${cap}, counted in .tmp/preflight-count).`,
    'The fourth run is never started (BUILDER-PREAMBLE §8). Check the row off --blocked with the failing gate lines',
    'from your last run quoted (grep -n the gate output; do not re-run the suite). The pre-push hook\'s own run is not',
    'counted, so a green tree can still push.',
  ].join('\n');
}
