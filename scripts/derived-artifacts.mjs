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
 * ⚠ MEASURE IDEMPOTENCY BY CONTENT HASH, NOT BY `git status`
 * (NODE-FANOUT-REGEN-CLOSE-1, 2026-08-21). A porcelain grep for ` M` misses the
 * `MM` a staged-then-rewritten file reports, which produced a FALSE GREEN for
 * gen-fv-status.mjs on the first pass of this very row. Run the generator twice
 * and compare the BYTES of every path it touched.
 *
 * ── THE SECOND DERIVATION: NODE-REGISTRATION FAN-OUT (2026-08-21) ───────────
 * The measurement above answered "which artifacts does a page-adding commit
 * co-modify?" — a question about what sessions HAD been rewriting by hand. It
 * could not see a surface that goes stale and that nobody was regenerating,
 * because such a surface never appears in a co-modification tally. That blind
 * spot redded `main` three times in one day (art-661/664/665) and, each time,
 * silently ejected every PR from the merge queue.
 *
 * So a second, independent derivation was run against the primary sources: every
 * generator preflight.mjs executes that publishes a freshness gate AND reads the
 * node graph — 30 of them — then every one of those run in write mode against a
 * REAL drifted tree (278e0318, art-665 registered, pre-#1430). Exactly six
 * drifted. They are the six marked below. Fourteen had been in neither list.
 *
 * ⛔ THAT COUNT IS NOW A GATE, NOT A COMMENT: scripts/check-derived-fanout-
 * coverage.mjs recomputes the same candidate set on every preflight run and
 * fails on anything classified in neither list. Adding a node-sensitive
 * generator without deciding its ownership is no longer possible silently.
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
    // DERIVED-DECLARE-PARITY-1: Python, so the parity gate's JS write-target
    // parser cannot statically resolve it — mirrors `artifacts` (the same
    // measured-2026-08-16 list above) so the gate has a ground truth instead
    // of refusing this entry outright.
    writes: [
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
    // DERIVED-DECLARE-PARITY-1: sync-stats.mjs writes via a `write(relPath, …)`
    // helper called with a variable, not a literal at the writeFileSync call
    // site — unresolvable by static source analysis. Mirrors `artifacts`.
    writes: ['mcp.html', 'chaingraph/chaingraph-hub.html'],
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
  // ── NODE-REGISTRATION FAN-OUT (NODE-FANOUT-REGEN-CLOSE-1, 2026-08-21) ──────
  // Six surfaces that go stale the moment a node appears in chaingraph.json and
  // NOTHING regenerated them, so every registration redded main: art-661 (#1409
  // ⇒ fixed by #1423), art-664 (#1411 ⇒ fixed inside MAIN-UNBLOCK-0821-1),
  // art-665 (#1428 ⇒ fixed by #1430). Three incidents, one day, byte-identical
  // shape each time — a CLASS, not three instances.
  //
  // ⭐ THEY CASCADE, which is why each incident cost ~6 sequential preflight
  // cycles: `gen-euc-register-page --check` is GREEN while the register ENTRY is
  // still missing and only goes red once gen-euc-register has written it
  // (measured on the real pre-#1430 tree 278e0318). A session fixing one surface
  // could not see the next.
  //
  // ⚠ THESE SIX DECLARE DIRECTORIES, NOT FILE LISTS — deliberately. A node
  // registration ADDS files whose names it alone determines
  // (registry/kernel/<kernel_digest>.json, chaingraph/register/<tool_id>.register.json,
  // chaingraph/okf/{tools,computations}/<tool_id>.md). A literal path list can
  // only ever name what existed at declaration time, so the next node's new file
  // would be undeclared and trip the regen workflow's anti-escape guard — the
  // exact incompatibility EXCLUDED cites for registry/lineage. `git add -- <dir>`
  // stages every change beneath it, including the new files, so the guard stays
  // meaningful. Safe here ONLY because each directory is 100% generator-owned:
  // nothing hand-authored lives in any of them.
  //
  // ⭐ `writes:` on four of them is the declaration-parity gate's explicit escape
  // hatch for a write target that is not a static literal
  // (scripts/check-derived-declare-parity.mjs rule 1): these generators build
  // their filenames from a digest or a tool_id at runtime, so no static parse can
  // name them. Declaring the generator-owned DIRECTORY as both the write target
  // and the declared artifact does not weaken that gate — it is a STRONGER
  // statement than a file list, because `git add -- <dir>` provably covers every
  // future name the generator can produce, which is precisely the coverage a
  // literal list loses the moment the next node lands.
  {
    id: 'registry-kernel-resolve',
    // REGISTRY-RESOLVE-STATIC-1. One kernel_digest -> spec_digest resolution
    // record per in-scope kernel; a new node adds a new <hex>.json.
    regen: 'node scripts/gen-registry-kernel-resolve.mjs --write',
    gate: 'node scripts/gen-registry-kernel-resolve.mjs --check',
    // <kernel_digest>.json — name determined at runtime, so declared as its root.
    writes: ['registry/kernel'],
    artifacts: ['registry/kernel'],
    share: '100% (3/3 node registrations on 2026-08-21)',
  },
  {
    id: 'euc-register',
    // EUC-SITE-1. Was EXCLUDED as NON-IDEMPOTENT ("601 wall-clock rewrites per
    // invocation"). ⛔ THAT REASON IS NO LONGER TRUE and the stale exclusion is
    // half of why three nodes redded main: the generator now routes every write
    // through writeIfChanged() and strips the generated_at stamp before
    // comparing, so two consecutive passes over a clean main are byte-identical
    // (re-measured 2026-08-21 by content hash, not by `git status` — a staged
    // file re-modified reads as `MM`, which a porcelain grep misses).
    // MUST run before 'euc-register-page' — that page is derived from these
    // entries and cannot detect its own staleness until they exist.
    regen: 'node scripts/gen-euc-register.mjs',
    gate: 'node scripts/gen-euc-register.mjs --check',
    // <tool_id>.register.json + index.json — names determined at runtime.
    writes: ['chaingraph/register'],
    artifacts: ['chaingraph/register'],
    share: '100% (3/3 node registrations on 2026-08-21)',
  },
  {
    id: 'euc-register-page',
    // EUC-SITE-1, the page over the entries above. THE CASCADE TAIL: green
    // while the entry is missing, red once it lands. Order is load-bearing.
    regen: 'node scripts/gen-euc-register-page.mjs',
    gate: 'node scripts/gen-euc-register-page.mjs --check',
    // Enforced, not merely intended: check-derived-fanout-coverage.mjs fails if a
    // future re-sort of this array puts the page before the entries it reads.
    after: 'euc-register',
    artifacts: ['euc-register.html'],
    share: '100% (3/3 node registrations on 2026-08-21)',
  },
  {
    id: 'fv-status',
    // FV-AGENTSURFACE-BUILD-1. IDEMPOTENT ONLY SINCE the skip-if-unchanged guard
    // shipped in this same diff — before it, --write restamped wall-clock
    // issued_at/checked_at/expires_at on every invocation, which in an
    // App-authored (workflow-re-triggering) auto-commit chain never converges.
    // ⛔ Do not register a wall-clock generator here without checking that first.
    regen: 'node scripts/gen-fv-status.mjs --write',
    gate: 'node scripts/gen-fv-status.mjs --check',
    // <spec_digest>.json — name determined at runtime.
    writes: ['fv-status'],
    artifacts: ['fv-status'],
    share: '100% (3/3 node registrations on 2026-08-21)',
  },
  {
    id: 'integrator-profile',
    // OCG-INTEGRATOR-PROFILE-1. Reads chaingraph.json + CHANGELOG.md + SPEC.md
    // §15 + conformance-roster.html. The roster is deliberately NOT regenerated
    // (see EXCLUDED — it stamps HEAD), so this entry's only moving input in the
    // regen chain is chaingraph.json itself.
    regen: 'node scripts/gen-integrator-profile.mjs',
    gate: 'node scripts/gen-integrator-profile.mjs --check',
    artifacts: ['chaingraph/integrator-profile.html'],
    share: '100% (3/3 node registrations on 2026-08-21)',
  },
  {
    id: 'okf',
    // The OKF companion bundle: two new concept files per node plus the index/
    // log/mandate-type rollups. Widest single fan-out of the six — 8 files
    // drifted for art-665 alone.
    regen: 'node chaingraph/generate-okf.mjs --write',
    gate: 'node chaingraph/generate-okf.mjs --check',
    // one concept file per node under tools/ and computations/, plus rollups.
    writes: ['chaingraph/okf'],
    artifacts: ['chaingraph/okf'],
    share: '100% (3/3 node registrations on 2026-08-21)',
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
      // fv-explainer.html carries count sentinels too (verify-counts.mjs's own
      // list includes it). Omitting it here made the regen bot's anti-escape
      // guard reject the whole run — "a generator wrote outside the declared
      // set" — which stalled every downstream regen and kept main red.
      // Reconciled against verify-counts.mjs's full 16-file list, not patched
      // one file at a time. (DERIVED-SET-SELFTEST-1, 2026-08-22: this entry
      // used to list the path TWICE — a pure authoring duplicate with zero
      // effect on coveredPaths()'s Set-dedupe, but caught as a genuine
      // within-entry CLASS C finding by check-derived-regen-live.mjs, which
      // treats that shape as always a bug, unlike the cross-entry sharing
      // check-derived-declare-parity.mjs's WARN allows by design. Collapsed
      // to one entry here so that gate can be wired blocking.)
      'fv-explainer.html',
      '.well-known/mcp.json', '.well-known/mcp/server.json', 'mcp/server.json',
      'llms.txt',
      // CLAIMS-SENTINEL-TIER1-1: verify-counts.mjs's comment-sentinel scan now also covers the
      // five hub hero pages (hubTools.* — audit Q7). SO #47: any write verify-counts.mjs --fix
      // gains must be declared here in the same diff, or the main-side regen's anti-escape guard
      // rejects the whole run exactly like the fv-explainer.html omission above did.
      'guides/dora-operational-resilience-hub.html', 'guides/fraud-risk-hub.html',
      'guides/sme-financial-health-hub.html', 'guides/tradetech-hub.html',
      'guides/capital-markets-settlement-hub.html',
    ],
    // DERIVED-DECLARE-PARITY-1: verify-counts.mjs writes via a `write(rel, …)`
    // helper called mostly with loop/lookup variables (ATTR_RULES `.file`,
    // the HTML-sentinel loop's `rel`), not literals at the call site —
    // unresolvable by static source analysis. Mirrors `artifacts` (already
    // reconciled against verify-counts.mjs's own file list, see comment above).
    writes: [
      'docs/index.html', 'index.html', 'start.html', 'about.html',
      'chaingraph/openchain-graph-paper.html', 'sitemap.html', 'tools.html',
      'mcp.html', 'chaingraph/chaingraph-hub.html',
      'chaingraph/zkvm-compute-integrity.html', 'chaingraph/why-openchain-graph.html',
      'fv-explainer.html',
      '.well-known/mcp.json', '.well-known/mcp/server.json', 'mcp/server.json',
      'llms.txt',
      'guides/dora-operational-resilience-hub.html', 'guides/fraud-risk-hub.html',
      'guides/sme-financial-health-hub.html', 'guides/tradetech-hub.html',
      'guides/capital-markets-settlement-hub.html',
    ],
    share: '27%',
  },
  {
    id: 'debt-ledger',
    // DEBT-LEDGER-1 (0xAlpha/2026-08-21-mechanical-verification-audit.md
    // Finding 3): owns ONE self-delimited region of fv-explainer.html
    // (`<!-- GEN:DEBT-LEDGER:START -->...:END -->`), independent of the
    // `<!--COUNT:-->` sentinels the 'counts' entry above already owns on
    // this same page — same "two generators, two regions, one shared file"
    // pattern as 'chain-index' and 'chaingraph-hub' both declaring
    // chaingraph/chaingraph-hub.html below. New today; no co-modification
    // history yet to measure a share rate from.
    regen: 'node scripts/gen-debt-ledger.mjs --write',
    gate: 'node scripts/gen-debt-ledger.mjs --check',
    artifacts: ['fv-explainer.html'],
    share: 'n/a (new 2026-08-21, DEBT-LEDGER-1)',
  },
];

/**
 * ⛔ DELIBERATELY EXCLUDED — each with the measured reason. Kept here so a future
 * session reads the omission as a decision rather than an oversight.
 *
 * ⭐ `script` (NODE-FANOUT-REGEN-CLOSE-1) is the MACHINE-READABLE half: the repo-
 * relative generator path, so scripts/check-derived-fanout-coverage.mjs can prove
 * that EVERY preflight `--check` generator which reads the node graph is
 * classified — COVERED or EXCLUDED, never merely absent. Absence was the whole
 * defect: gen-euc-register sat here under a reason that had stopped being true,
 * and five other node-sensitive generators appeared in neither list, so three
 * consecutive node registrations redded main with nobody able to see why.
 * ⛔ A new node-sensitive `--check` generator with no entry in either list now
 * fails that gate. Prose alone never caught this and never will.
 */
export const EXCLUDED = [
  {
    what: 'sitemap.xml (via scripts/regen-sitemap.mjs)',
    script: 'scripts/regen-sitemap.mjs',
    share: '94% — the HIGHEST measured skew rate of any artifact (124/132)',
    why: 'Out of scope by row order (SITEMAP-MAIN-REGEN-1 step 5): sitemap.xml is DISCOVER-1 territory, '
       + 'not the SO #28 shard set. The row requires the skew rate be MEASURED and STATED, then left '
       + 'unchanged pending a follow-up judgment. ⛔ No silent scope creep. The measurement is the 94% above.',
  },
  {
    what: 'chaingraph/clause-edges/index.json (via scripts/gen-clause-edge-report.mjs)',
    script: 'scripts/gen-clause-edge-report.mjs',
    share: '0% — no drift on a real node registration (measured on tree 278e0318, art-665)',
    why: 'NON-IDEMPOTENT wall-clock "generated_at". Re-measured 2026-08-21 by content hash on the real '
       + 'art-665 fixture: a node registration does NOT drift it, so it is not part of the node fan-out '
       + 'class this file now covers. Revisit only if it grows a writeIfChanged() guard like the EUC '
       + 'register did.',
  },
  {
    what: 'chaingraph/clause-edges page (via scripts/gen-clause-edge-report-page.mjs)',
    script: 'scripts/gen-clause-edge-report-page.mjs',
    share: '0% — no drift on a real node registration (measured on tree 278e0318, art-665)',
    why: 'IDEMPOTENT, but derived from the clause-edge report immediately above, which is excluded for '
       + 'wall-clock non-idempotency. Regenerating the page while its data source is frozen would publish a '
       + 'page describing a report main never refreshed — the two move together or not at all.',
  },
  {
    what: 'chaingraph/conformance-roster.html (via scripts/gen-ocg-conformance-roster.mjs)',
    script: 'scripts/gen-ocg-conformance-roster.mjs',
    share: '0% — no drift on a real node registration (measured on tree 278e0318, art-665)',
    why: 'LIVENESS STAMP OF HEAD — the strongest exclusion in this list. The page records "the §15 gates ran '
       + 'clean on main at commit <sha>" plus a run date, so a write-mode run on main ALWAYS diffs (HEAD just '
       + 'moved). The regen workflow pushes with an App token, which re-triggers the workflow, which sees a '
       + 'new HEAD, which diffs again: an unbounded commit chain, not a convergent one (measured 2026-08-21 — '
       + 'the generator rewrote 87c01d2e -> 770f069a on an otherwise-clean tree). Worse than churn, it is a '
       + 'SELF-ATTESTED PROVENANCE CLAIM (SO #34): auto-restamping would assert a gate result for a commit at '
       + 'which no session ran those gates. This page stays a deliberate, dated, human-run assessment.',
  },
  {
    what: 'chaingraph/kernels/*.kernel.mjs identity stamps (via chaingraph/kernels/gen-kernel-identity.mjs --write)',
    script: 'chaingraph/kernels/gen-kernel-identity.mjs',
    share: 'n/a — node-local, authored by the build row',
    why: 'TWO independent reasons. (1) NODE-LOCAL, not shared: SO #28 leaves a node\'s own identity shard to '
       + 'the K row that builds it, and kernel-preflight.mjs + NODE-COMPLETENESS-GATE-1 already block a PR '
       + 'that omits one. (2) ITS WRITE PATH TARGETS chaingraph.json, which has a DIFFERENT single writer '
       + '(assemble-chaingraph.mjs, COVERED id chaingraph-assemble) — two writers on one artifact is the '
       + 'defect SO #35 exists to prevent. ⚠ Measured 2026-08-21 on clean main: `--write` currently CRASHES '
       + '(SyntaxError, its raw text-splice produces invalid JSON at gen-kernel-identity.mjs:323) while '
       + '`--check` passes. Recorded as a finding, not fixed here — out of this row\'s fence.',
  },
  {
    what: 'manifests/*.manifest.json (via scripts/generate-node-manifest.mjs)',
    script: 'scripts/generate-node-manifest.mjs',
    share: 'n/a — node-local, authored by the build row',
    why: 'NODE-LOCAL by CONTRACT (repo/CLAUDE.md §Wave Completion #1): one manifest per tool, written by the '
       + 'row that adds the tool. Its preflight gate is a dry-run (--all --check) over manifests already '
       + 'committed, and it has no whole-estate write mode to run here.',
  },
  {
    what: 'chaingraph/kernel-vm.html (via chaingraph/vm/scripts/gen-kernel-vm-html.mjs)',
    script: 'chaingraph/vm/scripts/gen-kernel-vm-html.mjs',
    share: '0% — no drift on a real node registration (measured on tree 278e0318, art-665)',
    why: 'IDEMPOTENT and safe, but it reads the VM surface rather than the node roster: a node registration '
       + 'produced zero drift on the real art-665 fixture. Left out to keep the auto-commit set to writers '
       + 'with a MEASURED reason to be there (its sibling gen-kernel-vm-explainer.mjs IS covered — that one '
       + 'does track the kernel roster). Cover it the day a measurement shows it drifting.',
  },
  {
    what: 'chaingraph/runners/* (via scripts/gen-chain-runners.mjs)',
    script: 'scripts/gen-chain-runners.mjs',
    share: '0% — no drift on a real node registration (measured on tree 278e0318, art-665)',
    why: 'Drifts on CHAIN changes, not node registrations (measured: zero drift for art-665). Chain changes '
       + 'are out of the main-side auto-writer\'s scope by design — assemble-chaingraph.mjs REFUSES any '
       + 'graph/chains/ diff and those land through an explicit ASSEMBLE/LAND row. It also injects links into '
       + 'pages outside its own directory, so its write set is not cleanly declarable, and a wrong '
       + '`artifacts` declaration takes down every other artifact\'s regen in the same run (SO #47).',
  },
  {
    what: 'chaingraph/agentic-payments map output (via scripts/gen-agentic-payments-map.mjs)',
    script: 'scripts/gen-agentic-payments-map.mjs',
    share: '0% — no drift on a real node registration (measured on tree 278e0318, art-665)',
    why: 'Tracks a curated topic map, not the node roster — zero drift on the real art-665 fixture. Its own '
       + 'header already states it writes no file in this shared set.',
  },
  {
    what: 'output-contract sidecars (via scripts/gen-output-schema.mjs)',
    script: 'scripts/gen-output-schema.mjs',
    share: '0% — no drift on a real node registration (measured on tree 278e0318, art-665)',
    why: 'Derived from kernel FIXTURES, not from chaingraph.json membership — a node registering with its '
       + 'fixtures already committed produces no drift (measured). The sidecar moves when a fixture moves, '
       + 'which is a kernel-row event the K row owns.',
  },
  {
    what: 'scripts/check-node-complete.mjs (NODE-COMPLETENESS-GATE-1)',
    script: 'scripts/check-node-complete.mjs',
    share: 'n/a — a gate, not a generator',
    why: 'NOT A GENERATOR. It reads the node graph and matches the --check heuristic, but its only '
       + 'writeFileSync is the --update-baseline path, deliberately human-invoked. There is no derived '
       + 'artifact here for main to own. Listed so the coverage gate reads it as a decision, not a gap.',
  },
  {
    what: 'scripts/check-derived-declare-parity.mjs (DERIVED-DECLARE-PARITY-1)',
    script: 'scripts/check-derived-declare-parity.mjs',
    share: 'n/a — a gate, not a generator',
    why: 'NOT A GENERATOR — measured, not assumed. A grep for writeFileSync/writeFile in this script '
       + 'returns 4 hits and every one is inert: two are comments, one is the DETECTION REGEX it uses '
       + 'to find writes in OTHER generators, and one is an error string. Zero are write calls. That '
       + 'distinction is the whole point of the entry — the script statically PARSES other generators\' '
       + 'sources to assert each COVERED entry declares everything it writes, so it reads the node graph '
       + 'transitively through COVERED and trips the coverage heuristic while producing no artifact for '
       + 'main to own. Nothing about it can go stale, and covering it would be incoherent: there is no '
       + 'regen command that could converge. Listed so the fan-out gate reads a decision rather than a '
       + 'gap — same shape and same reason as check-node-complete.mjs directly above.',
  },
  {
    what: 'registry/lineage/** (via scripts/gen-registry-lineage.mjs — REGISTRY-LINEAGE-RETRY-1)',
    script: 'scripts/gen-registry-lineage.mjs',
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
  {
    what: 'registry/errata/** (via scripts/gen-registry-errata.mjs — REGISTRY-ERRATA-RETRY-1)',
    script: 'scripts/gen-registry-errata.mjs',
    share: 'n/a',
    why: 'SAME UNBOUNDED-PATH-SET incompatibility as registry/lineage/** immediately above (identical C2SP '
       + 'tlog-tiles layout, identical anti-escape-guard hazard on the next tile-adding append) — PLUS a second, '
       + 'independent reason COVERED registration would be actively harmful here, not merely unsupported: this '
       + 'generator\'s `regen` step performs a LIVE Sigsum add-leaf submission against a 288/24h rate-limited '
       + 'bucket (gen-registry-errata.mjs submitCheckpointToSigsum — unconditional, no skip-if-unchanged guard). '
       + 'COVERED\'s `--regen` runs every entry\'s `regen` command on EVERY push to main (derived-artifacts-regen.yml) '
       + '— wiring this generator there would submit a new Sigsum leaf on every single main-side push, burning the '
       + 'shared per-domain budget on pure liveness noise for an artifact whose entire design intent (row header, '
       + 'BUILD-SPEC §9) is explicitly NO liveness duty: "must not answer on demand, must not imply it tracks a '
       + 'live source." `--check` (read-only recompute-and-verify against the currently-published checkpoint, no '
       + 'network call) is wired into scripts/preflight.mjs directly, same as lineage\'s. Publishing a new entry '
       + 'set stays a manual/generated run: `node scripts/gen-registry-errata.mjs`.',
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
