#!/usr/bin/env node
/**
 * scripts/derived-artifacts.mjs — SSOT for the SHARED DERIVED ARTIFACT set
 * (SITEMAP-MAIN-REGEN-1, anchored on SO #28 / SO #35).
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * SO #28 requires every page/node-adding shard to regenerate a set of derived
 * surfaces. SO #35 then made those artifacts SINGLE-WRITER, because per-branch
 * ownership caused two measured incidents on 2026-08-11:
 *
 *   1. MERGE-REF SKEW — three PRs failed `gen-sitemap-html --check` on the merge
 *      ref within 90 minutes while each was locally green. Each shard had
 *      regenerated the same file from a different base.
 *   2. SILENT CI REMOVAL (worse) — a conflict on these files DELETES the merge
 *      ref, and a `pull_request` run builds on the merge commit, so GitHub
 *      dispatches ZERO CI. PR #1199 lived its entire life ungated and rendered
 *      identical to an all-green PR (SO #34c).
 *
 * The fix is to move freshness OWNERSHIP from PR branches to `main`: a push-to-
 * main workflow regenerates the set and commits any drift, PR-side freshness
 * gates become ADVISORY, and main-side gates stay BLOCKING.
 *
 * ── HOW THE SET BELOW WAS DERIVED (not copied from any enumeration) ─────────
 * SO #35 says explicitly: derive the list, do not trust any enumeration —
 * including its own. So it was measured from the primary source, git history:
 * over the last 600 non-merge commits, 132 ADD a page or a chaingraph node
 * (`tools/*.html`, `guides/*.html`, `chaingraph/graph/nodes/**`,
 * `chaingraph/kernels/*.kernel.mjs`). For each, the files it also MODIFIES were
 * tallied. `share` below is that co-modification rate — the measured rate at
 * which a page-adding shard rewrites the artifact, i.e. exactly the skew rate
 * this row exists to remove.
 *
 * Two filters were then applied to the measured list:
 *
 *   (a) GENERATOR-OWNED. A file a shard hand-edits (its own index.html card row)
 *       is not a derived artifact. Only generator output qualifies.
 *   (b) IDEMPOTENT. Every generator here was run twice against a clean checkout
 *       of fresh `main`; the second pass must produce a zero diff. This is the
 *       load-bearing safety property: a non-idempotent generator in an
 *       auto-commit chain commits churn on every single push. Two generators
 *       FAILED this and are excluded — see EXCLUDED below.
 *
 * ── CONTEXT SPLIT ───────────────────────────────────────────────────────────
 * PR context   → these gates warn, never block (a shard is now FORBIDDEN by
 *                SO #35 from satisfying them, so blocking would be unsatisfiable).
 * main context → these gates block, and the regen workflow repairs drift.
 *
 * ⛔ NO CHECK IS EVER DELETED. Every gate still RUNS in both contexts; only the
 * exit-code handling differs. A session that forgot regen entirely still sees
 * the warning on its PR.
 *
 * Usage:
 *   node scripts/derived-artifacts.mjs --list     # the set, with generators + measured skew
 *   node scripts/derived-artifacts.mjs --paths    # NUL-free, newline-separated commit pathspec
 *   node scripts/derived-artifacts.mjs --regen    # run every generator in write mode
 *   node scripts/derived-artifacts.mjs --context  # print "main" or "pr"
 */
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The covered set. One entry per generator invocation.
 *   id       — stable slug, used by workflow steps to name the advisory gate
 *   regen    — write-mode command (run by the main-side regen workflow)
 *   gate     — freshness command; ADVISORY on a PR, BLOCKING on main.
 *              null = the generator has no separate freshness gate.
 *   artifacts— every path the generator writes (the commit pathspec)
 *   share    — measured co-modification rate across the 132 page-adding commits
 */
export const COVERED = [
  {
    id: 'kernel-index',
    regen: 'node chaingraph/kernels/gen-index.mjs',
    gate: 'node chaingraph/kernels/gen-index.mjs --check',
    artifacts: ['chaingraph/kernels/index.mjs'],
    share: '81%',
  },
  {
    id: 'openapi',
    regen: 'node scripts/gen-openapi.mjs',
    gate: 'node scripts/gen-openapi.mjs --check',
    artifacts: ['openapi.json', 'docs/openapi.json', 'docs/index.html'],
    share: '27%',
  },
  {
    id: 'llms-full',
    regen: 'node scripts/gen-llms-full.mjs',
    gate: 'node scripts/gen-llms-full.mjs --check',
    artifacts: ['llms-full.txt'],
    share: '39%',
  },
  {
    id: 'estate-map',
    regen: 'node scripts/gen-estate-map.mjs',
    gate: 'node scripts/gen-estate-map.mjs --check',
    artifacts: ['llms.txt'],
    share: '1%',
  },
  {
    id: 'sitemap-html',
    regen: 'node scripts/gen-sitemap-html.mjs',
    gate: 'node scripts/gen-sitemap-html.mjs --check',
    artifacts: ['sitemap.html'],
    share: '91%',
  },
  {
    id: 'start-index',
    regen: 'node scripts/gen-start-index.mjs',
    gate: 'node scripts/gen-start-index.mjs --check',
    artifacts: ['start.html'],
    share: '23%',
  },
  {
    id: 'guides-index',
    regen: 'node scripts/gen-guides-index.mjs',
    gate: 'node scripts/gen-guides-index.mjs --check',
    artifacts: ['guides/index.html'],
    share: '13%',
  },
  {
    id: 'chain-index',
    regen: 'node scripts/gen-chain-index.mjs',
    gate: 'node scripts/gen-chain-index.mjs --check',
    artifacts: ['chaingraph/chaingraph-hub.html'],
    share: '8%',
  },
  {
    id: 'chaingraph-hub',
    regen: 'node scripts/gen-chaingraph-hub.mjs',
    gate: 'node scripts/gen-chaingraph-hub.mjs --check',
    artifacts: ['chaingraph/chaingraph-hub.html'],
    share: '8%',
  },
  {
    id: 'chainbuilder-catalog',
    regen: 'node scripts/gen-chainbuilder-catalog.mjs',
    gate: 'node scripts/gen-chainbuilder-catalog.mjs --check',
    artifacts: ['chaingraph/data/chain-builder-catalog.gen.js'],
    share: '2%',
  },
  {
    id: 'workbench',
    regen: 'node scripts/gen-workbench.mjs',
    gate: 'node scripts/gen-workbench.mjs --check',
    artifacts: ['chaingraph/workbench/workbench.html'],
    share: '2%',
  },
  {
    id: 'canvas',
    regen: 'node scripts/gen-canvas.mjs',
    gate: 'node scripts/gen-canvas.mjs --check',
    artifacts: ['chaingraph/workbench/canvas.html'],
    share: '8%',
  },
  {
    id: 'kernel-vm-explainer',
    regen: 'node chaingraph/vm/scripts/gen-kernel-vm-explainer.mjs',
    gate: 'node chaingraph/vm/scripts/gen-kernel-vm-explainer.mjs --check',
    artifacts: ['chaingraph/kernel-vm-explainer.html'],
    share: '71%',
  },
  {
    id: 'nav-island',
    // The baseline is the allowlist of by-design island pages. A new page that
    // is reachable REMOVES entries; one that is not ADDS them. Either way the
    // baseline is shared state every page-adding shard rewrites.
    regen: 'node scripts/check-nav-reachability.mjs --update',
    gate: 'node scripts/check-nav-reachability.mjs',
    artifacts: ['scripts/nav-island-baseline.json'],
    share: '57%',
  },
  {
    id: 'catalog',
    // SO #28's "catalog counts". Python, but ubuntu-latest ships python3 and
    // preflight already shells to python for check_index_sync.py.
    regen: 'python scripts/regen_catalog.py',
    gate: null, // no --check mode; check-catalog-parity.mjs covers orphans only
    artifacts: [
      'catalog.json', 'data/catalog.json', 'mcp/catalog.json', 'mcp/server.json',
      '.well-known/mcp.json', 'llms.txt', 'tools.html', 'index.html',
    ],
    share: '15-27%',
  },
  {
    id: 'stats',
    regen: 'node scripts/sync-stats.mjs --fix',
    gate: 'node scripts/sync-stats.mjs',
    artifacts: ['mcp.html', 'chaingraph/chaingraph-hub.html'],
    share: '27%',
  },
  {
    id: 'counts',
    // Count sentinels (<!--COUNT:key-->N<!--/COUNT-->, data-count="key") across
    // every page that publishes one. File list mirrors verify-counts.mjs's own
    // sentinel list + ATTR_RULES targets.
    regen: 'node scripts/verify-counts.mjs --fix',
    gate: 'node scripts/verify-counts.mjs --check',
    artifacts: [
      'docs/index.html', 'index.html', 'start.html', 'about.html',
      'chaingraph/openchain-graph-paper.html', 'sitemap.html', 'tools.html',
      'mcp.html', 'chaingraph/chaingraph-hub.html',
      'chaingraph/zkvm-compute-integrity.html', 'chaingraph/why-openchain-graph.html',
      '.well-known/mcp.json', '.well-known/mcp/server.json', 'mcp/server.json',
      'llms.txt',
    ],
    share: '27%',
  },
];

/**
 * ⛔ DELIBERATELY EXCLUDED — each with the measured reason. Kept here so a future
 * session reads the omission as a decision rather than an oversight.
 */
export const EXCLUDED = [
  {
    what: 'sitemap.xml (via scripts/regen-sitemap.mjs)',
    share: '94% — the HIGHEST measured skew rate of any artifact (124/132)',
    why: 'Out of scope by row order (SITEMAP-MAIN-REGEN-1 step 5): sitemap.xml is DISCOVER-1 territory, '
       + 'not the SO #28 shard set. The row requires the skew rate be MEASURED and STATED, then left '
       + 'unchanged pending a follow-up judgment. ⛔ No silent scope creep. The measurement is the 94% above.',
  },
  {
    what: 'chaingraph/register/*.register.json (601 files, via scripts/gen-euc-register.mjs)',
    share: 'n/a',
    why: 'NON-IDEMPOTENT: each file carries a wall-clock "generated_at", so a write-mode run rewrites all '
       + '601 on every invocation. In an auto-commit chain that is 601 timestamp-only files committed on '
       + 'every push to main, forever. Its --check gate ignores the timestamp field, which is why the gate '
       + 'reads green while write mode diffs — a real inconsistency, but NOT this row\'s fence.',
  },
  {
    what: 'chaingraph/clause-edges/index.json (via scripts/gen-clause-edge-report.mjs)',
    share: 'n/a',
    why: 'NON-IDEMPOTENT, same wall-clock "generated_at" shape as the EUC register above.',
  },
  {
    what: 'chaingraph/chaingraph.json',
    share: '8%',
    why: 'ALREADY single-writer — it belongs to the land row (assemble-chaingraph.mjs), the doctrine SO #35 '
       + 'generalises from. Nothing to move.',
  },
];

/** Every path the regen may write, deduped and sorted — the commit pathspec. */
export function coveredPaths() {
  return [...new Set(COVERED.flatMap((c) => c.artifacts))].sort();
}

/** Gate commands that are advisory on a PR and blocking on main. */
export function advisoryGates() {
  return new Set(COVERED.map((c) => c.gate).filter(Boolean));
}

/**
 * Is this a MAIN context (gates block) or a PR context (gates warn)?
 *
 * ⚠ FAILS CLOSED. Anything undeterminable returns true — a gate stays BLOCKING
 * when we cannot prove we are on a PR. The downgrade is the privilege; it has to
 * be affirmatively earned, never inherited from a failed lookup.
 */
export function isMainContext() {
  if (process.env.GITHUB_EVENT_NAME === 'pull_request') return false;
  if (process.env.GITHUB_ACTIONS === 'true') {
    return (process.env.GITHUB_REF_NAME || '') === 'main';
  }
  // Local pre-push: on main → main context; on a feature branch → PR context.
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: REPO, stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
    return branch === 'main' || branch === 'HEAD'; // detached → fail closed
  } catch {
    return true; // undeterminable → fail closed, gates block
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const arg = process.argv[2];
  if (arg === '--paths') {
    console.log(coveredPaths().join('\n'));
  } else if (arg === '--context') {
    console.log(isMainContext() ? 'main' : 'pr');
  } else if (arg === '--regen') {
    // Run every generator in write mode, in dependency order (counts last: they
    // read numbers the earlier generators establish). Stops on first failure —
    // a half-regenerated tree must never reach a commit.
    for (const c of COVERED) {
      process.stdout.write(`▶ ${c.id} … `);
      try {
        execSync(c.regen, {
          cwd: REPO,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        console.log('ok');
      } catch (e) {
        console.log('FAILED');
        console.error(`\n${c.regen}\n` + ((e.stdout?.toString() || '') + (e.stderr?.toString() || '')).trim());
        process.exit(1);
      }
    }
    console.log('\nregen complete');
  } else {
    console.log(`Shared derived artifacts — ${COVERED.length} generators, ${coveredPaths().length} paths`);
    console.log(`context: ${isMainContext() ? 'main (gates BLOCK)' : 'pr (gates WARN)'}\n`);
    for (const c of COVERED) {
      console.log(`  ${c.id.padEnd(22)} skew ${String(c.share).padStart(6)}   ${c.regen}`);
      for (const a of c.artifacts) console.log(`  ${' '.repeat(22)}   → ${a}`);
    }
    console.log('\n⛔ EXCLUDED (decisions, not oversights):');
    for (const e of EXCLUDED) console.log(`  - ${e.what}\n      skew: ${e.share}\n      ${e.why}`);
  }
}
