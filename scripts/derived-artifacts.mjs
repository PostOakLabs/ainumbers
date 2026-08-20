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
 *   node scripts/derived-artifacts.mjs --paths    # NUL-free, newline-separated commit pathspec (exit 1 if any is absent on disk)
 *   node scripts/derived-artifacts.mjs --check-paths  # preflight gate: every declared artifact exists on disk
 *   node scripts/derived-artifacts.mjs --regen    # run every generator in write mode
 *   node scripts/derived-artifacts.mjs --context  # print "main" or "pr"
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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
    regen: 'node chaingraph/kernels/gen-index.mjs --write',
    gate: 'node chaingraph/kernels/gen-index.mjs --check',
    artifacts: ['chaingraph/kernels/index.mjs'],
    share: '81%',
  },
  {
    id: 'openapi',
    regen: 'node scripts/gen-openapi.mjs',
    gate: 'node scripts/gen-openapi.mjs --check',
    // docs/catalog.json is a copy of mcp/catalog.json written by this same script
    // (see scripts/gen-openapi.mjs's own header comment), not by regen_catalog.py —
    // undeclared here until ASSEMBLE-ART628-1-FIX2 (2026-08-16), which is why it read
    // as an "escaped" write the first time art-628's tool-count bump made it drift.
    artifacts: ['openapi.json', 'docs/openapi.json', 'docs/catalog.json', 'docs/index.html'],
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
    // --prune, NOT --update: regen may only remove entries that became
    // reachable. --update accepts every current island and would baseline an
    // unlinked page within a minute of it landing (bot commit 130b63db did).
    regen: 'node scripts/check-nav-reachability.mjs --prune',
    // ⚠ --baseline-check ONLY. The plain command (new-island detection) is a
    // content gate, hard in every context — it is NOT a derived-artifact gate
    // and must never be listed here, or a PR that ships an unlinked page goes
    // green (PR #1309, 2026-08-16, chaingraph/integrator-profile.html).
    gate: 'node scripts/check-nav-reachability.mjs --baseline-check',
    artifacts: ['scripts/nav-island-baseline.json'],
    share: '57%',
  },
  {
    id: 'catalog',
    // SO #28's "catalog counts". Python, but ubuntu-latest ships python3 and
    // preflight already shells to python for check_index_sync.py.
    regen: 'python scripts/regen_catalog.py',
    gate: null, // no --check mode; check-catalog-parity.mjs covers orphans only
    // Measured 2026-08-16 by running the generator in a clean worktree: it writes
    // exactly these. Two phantom paths ('catalog.json', 'data/catalog.json') were
    // listed here before and made `git add --pathspec-from-file` abort — see
    // --check-paths, which now fails on any declared artifact absent from disk.
    artifacts: [
      'mcp/catalog.json', 'mcp/server.json',
      '.well-known/mcp.json', 'llms.txt', 'tools.html', 'index.html',
    ],
    share: '15-27%',
  },
  {
    id: 'rule-registry',
    regen: 'node scripts/gen-rule-registry.mjs',
    gate: 'node scripts/gen-rule-registry.mjs --check',
    artifacts: ['chaingraph/kernels/data/rule-registry.json'],
    // Measured 2026-08-16: only one commit to date has added an entry file
    // (645f8a54, #1313) and it did NOT co-modify rule-registry.json — that
    // omission is the incident this row exists to fix (RULEREG-TABLE-LAND-1).
    // n=1, so 0% is the full available sample, not a rounded estimate.
    share: '0% (n=1)',
  },
  {
    id: 'stats',
    regen: 'node scripts/sync-stats.mjs --fix',
    gate: 'node scripts/sync-stats.mjs',
    artifacts: ['mcp.html', 'chaingraph/chaingraph-hub.html'],
    share: '27%',
  },
  {
    id: 'chaingraph-assemble',
    // ASSEMBLE-MAINSIDE-1 (SO #35 extended): chaingraph.json joins the shared
    // single-writer set. The assembler itself refuses (no write, exit 0) when
    // the shard diff includes node removals/renames or any graph/chains/
    // change — those stay explicit ASSEMBLE/LAND rows, never auto-committed
    // here. Gate command is intentionally identical to preflight.mjs's
    // existing 'chaingraph.json shard freshness (CGSHARD-1)' entry — that
    // string match is what makes it advisory-on-PR/blocking-on-main via the
    // generic ADVISORY_ON_PR categorisation in preflight.mjs, no second gate
    // needed.
    // --enroll (ASSEMBLE-MAINSIDE-ENROLL-1): MAINSIDE-1 shipped assembly
    // without enrolment, so a node shard present on disk but absent from
    // order.nodes (art-662, PR #1412) was silently never assembled. --enroll
    // appends any such id to order.nodes (append-only, no re-sort) BEFORE
    // assembling, closing that gap at the source.
    regen: 'node scripts/assemble-chaingraph.mjs --enroll',
    gate: 'node scripts/assemble-chaingraph.mjs --check',
    // chaingraph.meta.json (ENROLL-DECLARE-META-1): --enroll appends new node
    // ids to order.nodes in this file. Undeclared, this write escaped the
    // anti-escape guard and failed the whole regen run (RED-MAIN incident).
    artifacts: ['chaingraph/chaingraph.json', 'chaingraph/chaingraph.meta.json'],
    share: '8%',
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
      'fv-explainer.html',
      '.well-known/mcp.json', '.well-known/mcp/server.json', 'mcp/server.json',
      'llms.txt',
      // fv-explainer.html carries count sentinels too (verify-counts.mjs's own
      // list includes it). Omitting it here made the regen bot's anti-escape
      // guard reject the whole run — "a generator wrote outside the declared
      // set" — which stalled every downstream regen and kept main red.
      // Reconciled against verify-counts.mjs's full 16-file list, not patched
      // one file at a time.
      'fv-explainer.html',
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
    what: 'registry/lineage/** (via scripts/gen-registry-lineage.mjs — REGISTRY-LINEAGE-RETRY-1)',
    share: 'n/a',
    why: 'UNBOUNDED PATH SET, not a fixed rewrite-in-place file list: the C2SP tlog-tiles layout deliberately '
       + 'leaves a stale partial-tile file in place and writes a NEW filename at a new `.p/<W>` path on every '
       + 'single record append (gen-registry-lineage.mjs:54-55, by design — old partials stay valid historical '
       + 'artifacts). A literal `artifacts` list can only ever cover the paths that exist at declaration time. '
       + 'The regen workflow\'s anti-escape guard (.github/workflows/derived-artifacts-regen.yml, "Stage by '
       + 'explicit pathspec, and prove nothing escaped the set") runs `git status --porcelain -- .` over the '
       + 'WHOLE working tree after staging the declared paths — the next legitimate lineage-record append would '
       + 'create an undeclared file and fail that check, taking down every other shared artifact\'s regen in '
       + 'the same run, not just this one. `--check` (read-only, recomputes and verifies the on-disk tree '
       + 'against the published checkpoint) is still wired into scripts/preflight.mjs directly — that path is '
       + 'safe because it never writes. A future session may reconsider COVERED registration if the layout '
       + 'moves to a fixed-name append log, or if the anti-escape guard is scoped to a declared-prefix check.',
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
 * Declared artifacts that do not exist on disk. Must be empty: the regen workflow
 * stages by this exact path list, and `git add` aborts the WHOLE command on a
 * pathspec that matches nothing — so one phantom entry silently stages nothing,
 * and the "escaped output" self-check then reports every real artifact as
 * escaped. (Measured 2026-08-16, runs 31957347527 / 31958761151.)
 */
export function missingPaths() {
  return coveredPaths().filter((p) => !existsSync(resolve(REPO, p)));
}

/**
 * Is this a MAIN context (gates block) or a PR context (gates warn)?
 *
 * ⚠ FAILS CLOSED. Anything undeterminable returns true — a gate stays BLOCKING
 * when we cannot prove we are on a PR. The downgrade is the privilege; it has to
 * be affirmatively earned, never inherited from a failed lookup.
 */
export function isMainContext() {
  // ⚠ STRUCTURED AS A WHITELIST OF PR PROOFS, NOT A BLACKLIST OF MAIN ONES.
  // An earlier draft asked "is GITHUB_REF_NAME === 'main'?" and returned false
  // otherwise — which made an EMPTY/absent ref name read as "PR", i.e. it failed
  // OPEN, silently downgrading gates in an unknown CI context. (Caught by the
  // context probe, not by review.) Only an affirmative proof of a PR may earn
  // the downgrade; every other state blocks.

  // CI: `pull_request` AND `merge_group` are both PR proofs — the regen bot
  // writes these artifacts AFTER merge (SO #35), so staleness inside the merge
  // queue is by-construction, exactly as on a `pull_request`. Treating
  // `merge_group` as MAIN made a queued assemble that obeys SO #35 get
  // ejected by its own freshness gate (ASSEMBLE-LAND-0817-1 folded-in step,
  // 2026-08-17). push-to-main, schedule, workflow_dispatch, workflow_call and
  // anything unrecognised still BLOCK.
  if (process.env.GITHUB_ACTIONS === 'true') {
    const event = process.env.GITHUB_EVENT_NAME;
    return event !== 'pull_request' && event !== 'merge_group';
  }

  // Local pre-push: a feature branch is the PR proof. It must RESOLVE, and be
  // neither `main` nor a detached HEAD, before the downgrade applies.
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: REPO, stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
    if (!branch || branch === 'HEAD' || branch === 'main') return true; // fail closed
    return false;
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
    // Refuse to emit a pathspec that would abort `git add` — fail here, loudly,
    // rather than let the workflow swallow the abort and misreport.
    const missing = missingPaths();
    if (missing.length) {
      console.error(`✗ derived-artifacts --paths: ${missing.length} declared artifact(s) do not exist on disk:\n  ${missing.join('\n  ')}\n  Fix the SSOT entry (or run the generator that should create it).`);
      process.exit(1);
    }
    console.log(coveredPaths().join('\n'));
  } else if (arg === '--check-paths') {
    const missing = missingPaths();
    if (missing.length) {
      console.log(`✗ derived-artifacts: ${missing.length} declared artifact(s) missing on disk:\n  ${missing.join('\n  ')}`);
      process.exit(1);
    }
    console.log(`✓ derived-artifacts: all ${coveredPaths().length} declared artifacts exist on disk.`);
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
