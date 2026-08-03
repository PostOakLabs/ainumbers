# RUNNERGEN-SCOPE-1 — runner-backfill scoping (2026-08-03)

Fence: read-only. Nothing generated, nothing staged. Zero files changed outside `research/`.

## (1) How were the 90 existing runners produced

**Generator, not hand-authored: `repo/scripts/gen-chain-runners.mjs`.**

`node scripts/gen-chain-runners.mjs --check` → `✓ all 90 runners up-to-date` — every runner on disk byte-matches what the generator would emit right now. Zero drift, zero hand-editing.

It did NOT stop at 90 by curation or staleness. It's a mechanical eligibility gate: for each of the 336 chains in `chaingraph.json`, walk every step's `tool_id`, resolve the source file (`chaingraph/<id>.html` for `art-*` ids, else `tools/<id>.html`), and require the file (a) exist and (b) contain the literal string `AINBridge`. First step that fails either check drops the whole chain — no partial/degraded runner.

Live breakdown (`--check` doesn't print skip reasons; reproduced its exact logic read-only against current `chaingraph.json` — see command in §4 for reproducibility):

| gate | chains affected |
|---|---|
| eligible (has runner) | 90 |
| skipped: a step's tool lacks `AINBridge` | 229 |
| skipped: a step's tool file doesn't exist on disk | 17 |
| **total** | **336** |

Root cause of the 229, at the tool-file level (unique `tool_id`s referenced across all 336 chains, 716 total):

- `chaingraph/art-*.html` nodes: **365 unique ids lack `AINBridge`**, only **8** (of 494 `art-*.html` files that exist on disk suite-wide) carry it.
- `tools/*.html` nodes: only 9 unique ids lack `AINBridge` (491 of 529 tool files already carry it — the bridge rollout is essentially done in `tools/`).
- 15 unique ids resolve to no file at all (renamed/removed/typo'd `tool_id`, all in the `tools/` namespace — `art-*` had zero missing files).

**This is the real blocker, and it isn't a runner-generation problem.** The generator already covers every chain whose steps are bridge-instrumented. The 247-chain gap is downstream of a much bigger fact: `chaingraph/art-*.html` — the OCG chain-node tool files — are 486/494 un-instrumented with `AINBridge`. Generating runners is a non-event once that's fixed; nothing to build, just re-run the existing script.

## (2) Non-derivable content — 3-runner diff

Confirmed by §1's `--check` result already (all 90 are exact generator output), but to name it concretely: `renderRunnerHTML()` (script L99–556) derives **100%** of runner content from `chaingraph.json` + on-disk fixtures — nothing is hand-added post-generation:

- Chrome/CSS/layout/CSP: static template, identical across all 90.
- Title, step names, step count, badges: `chain.title`, `chain.steps`, `displayName(tool_id)` (from node's `display_name` in `chaingraph.json`, or slug-derived).
- Iframe `src` per step: mechanical path rule (`art-*` → `../<id>.html`, else `../../tools/<id>.html`).
- Seed values (pre-filled form inputs): `resolveSeed(tool_id)` — pulled from `chaingraph/conformance/vectors/<id>.fixture.json` or `chaingraph/kernels/fixtures/<id>.fixtures.json`; empty object if neither fixture exists (seed then stays blank, not an error).
- Hash/export/sign/verify JS blocks (§4 composite, VC, Ed25519): byte-identical boilerplate injected into every runner, sourced from the shared `_hash.mjs`/`_proof.mjs` canonicalization (per repo `CLAUDE.md`, never hand-built).

Diffed `agent-economy-audit-pack`-adjacent eligible runners (`a2a-payment-rail-compliance`, `2052a-classify-daily`, and one 4-step runner) against a fresh in-memory render — all three are pure function-of-`chaingraph.json`+fixtures. **No copy, no fixtures, no input examples require a human hand once a chain's steps are bridge-instrumented.** A backfill wave, if scoped correctly, is a re-run of one script — not 247 authored artifacts.

## (3) Runner vs. workbench fallback — measured, not assumed

The row's premise ("fallback path... WORKS") does **not hold**. Read `chaingraph/workbench/workbench.html` L340–414: workbench's catalog carries a precomputed `has_runner` flag per chain. When `true`, it iframes the **actual runner file** (`frame.src = '../runners/'+name+'.html#embed'`) — the workbench IS the runner, embedded; there's no separate execution path. When `false` (the 247 gap chains), it shows `#noRunnerState`: *"No browser runner for `<chain title>`"* with a disabled Run button and one link — `View chain definition ↗` → `chaingraph/chains/<name>.html`.

That chain-definition page is static: it computes a **definition hash** over the chain's declared metadata (no iframe, no `AINBridge`, no real tool execution — confirmed by grep on `chains/aca-226j-response-composer.html`, an uncovered chain: `execution_hash` present but no `iframe`/`AINBridge` anywhere in the file). It is not a composite execution artifact and cannot become one without a runner.

**Delta a runner adds, measured:** for the 247 chains without one, there is currently **no live-execution path anywhere on the site** — not a degraded UX, a hard stop. Workbench's fallback is a dead-end link to a static hash-of-the-definition, not an alternate way to run the chain. §21.2-style composite §4 hashing (real tool outputs, not definition metadata) is only reachable via a runner.

## (4) Recommendation

**Not a runner-generation wave. A bridge-instrumentation wave, then a one-command regenerate.**

1. **No RUNNERGEN backfill WU as scoped.** The generator is correct, deterministic, and already covers every eligible chain. Staging 247 hand-built runner WUs would be building something the script already does for free the moment its inputs qualify.
2. **The real gap is `chaingraph/art-*.html` AINBridge coverage** — 486 of 494 files lack it, and 365 of those are referenced by at least one chain. This is D-class work (new capability on existing node files, disjoint per file — same shape as other node work in this workspace), sized for a sharded wave: one shard per node-file batch, `AINBridge` retrofit is the SOP already proven in `tools/` (491/529 done there — copy that pattern, don't invent one).
3. **Separately, 17 chains (15 unique ids) reference tool files that don't exist at all** — likely renamed/retired `tool_id`s. That's a `chaingraph.json` data-hygiene row (fix or retire the chain), not bridge work, and should be its own small WU so it doesn't block the bridge wave.
4. **After any batch of `art-*.html` files gains `AINBridge`**, re-run `node scripts/gen-chain-runners.mjs` (no code change needed) and the newly-eligible chains get runners automatically, plus their chain-page "Run this chain (live)" links auto-inject. Verify via `--check` before commit.
5. **Suggested WU shape:** `ART-BRIDGE-<shard>` rows (class D, sharded, SONNET, kernel-adjacent — read `board/RIDER-KERNEL.md` since these are `chaingraph/` node files) sized ~20-30 files each (≈365 ids / 15-18 shards), fence = the named `art-*.html` files only, done-criterion = `AINBridge` present + `gen-chain-runners.mjs --check` shows the newly-eligible chains no longer stale + no `execution_hash`/kernel behavior change (bridge is UI wiring, not kernel logic — verify no hash-moving edit per `RIDER-KERNEL.md`). Plus one `CHAINDATA-HYGIENE-1` row for the 15 missing-file ids.

## Reproducibility

```bash
node scripts/gen-chain-runners.mjs --check   # confirms 90/90 up to date, read-only
```

Skip-reason breakdown (§1 table) and namespace split (§1 root-cause table) were reproduced by running the generator's exact `hasBridge`/`toolFilePath` logic read-only in a `node -e` one-liner against current `chaingraph.json` — no files written, `git status` clean before/after.
