# DEADLINES-BACKFILL-1 — reg-deadlines.json backfill

2026-07-26 · sonnet

## What was added
Two entries, `data/reg-deadlines.json` + mirrored into `deadline-wall.html`'s embedded `REG_DEADLINES` array (that page has zero network calls; it ships a static copy of the JSON, not a fetch — schema note atop the JS array says "mirrors data/reg-deadlines.json").

### 1. `eu-ai-act-art50-transparency` — 2026-08-02
- Source: https://datamatters.sidley.com/2026/06/24/eu-ai-act-transparency-obligations-preparing-for-compliance-by-2-august-2026/
- Coverage stated as PARTIAL, explicitly: 50(2)/(4) marking/deepfake-disclosure covered by the live 3-node chain `ai-content-disclosure-conformance` (`art-126-ai-act-art50-marking-checker`, `art-127-dual-layer-disclosure-verifier`, `art-128-content-binding-assertion-validator`) — re-verified live below. 50(1)/(3) disclosure (chatbot interaction / emotion-recognition-biometric-categorization) is named as NOT covered — no implied full coverage.
- Annex III (2027-12-02) is named as a separate, later date, not conflated with the Art.50 date.

### 2. `sec-ust-clearing-cash` — 2026-12-31
- Source: https://www.northerntrust.com/united-states/about-us/sec-us-treasury-clearing
- Repo/reverse-repo's separate, later date (2027-06-30) is named but not entered as a duplicate/conflated date.
- Coverage stated as the 9 live wired chains, named below, re-derived independently this session (not taken on trust from `HORIZON-CONFIRM-3-1`).

## Independent re-verification against the live estate (this session, via `node -e` against `chaingraph/chaingraph.json`; never Read whole — Read-denied by `.claudeignore`/settings; node identity = `tool_id`, chain identity = `name`, per standing order)

**AI Act chain — confirmed live:**
```
art-126-ai-act-art50-marking-checker         status=live
art-127-dual-layer-disclosure-verifier       status=live
art-128-content-binding-assertion-validator  status=live
chain "ai-content-disclosure-conformance" exists, steps = exactly these 3 tool_ids
```

**UST clearing — all 9 chain names confirmed present in `g.chains[].name`:**
`treasury-clearing-fit`, `treasury-clearing-access-model`, `treasury-clearing-cross-margin`, `treasury-clearing-repo-margin`, `treasury-clearing-collateral`, `treasury-clearing-capital-relief`, `treasury-clearing-liquidity`, `treasury-clearing-onboarding`, `treasury-clearing-settlement-integrity`, plus umbrella `us-treasury-clearing`.

**Kernel-backed check (not just catalog wiring)** — per-chain scan of `steps[].tool_id` for an `art-`/`sim-`/`cry-`/`qfa-`/`ml-` prefixed step:
- 8 of 9 have at least one kernel-backed step (execute compute): `treasury-clearing-fit`, `-access-model`, `-cross-margin`, `-repo-margin`, `-capital-relief`, `-liquidity`, `-onboarding`, `-settlement-integrity`, `us-treasury-clearing`.
- `treasury-clearing-collateral` is **catalog-only** — its steps are all bare-numeric `repo/tools` references, no kernel step, no computed artifact. Stated explicitly in the entry text so the coverage claim doesn't overstate what that one chain does.

## §18 / vendor / merge
- §18 UNMOVED: this WU adds no kernel, no node, no chain, no proof. Gate node count (477) and chain count (325) untouched — data-only edit, no baseline/ratchet edit.
- No vendor run: `mcp-apps-poc/generate.mjs` was NOT run. Reason: `data/reg-deadlines.json` and `deadline-wall.html` are not vendored to the worker (no `mcp_name`, no manifest, no chaingraph.json touch) — nothing for `generate.mjs` to pick up.
- `node scripts/preflight.mjs` full run: **PASSED**, all hard gates green including `Deadline-wall freshness (SI-DEADLINE-FRESH-1)` and `Copy hallmarks (§1.4)`. `node scripts/check-deadline-freshness.mjs` standalone: 22/22 entries within the 120-day threshold.
- Live-render check (Browser preview against the actual file): page shows "22 of 22 shown" (20 prior + 2 new), both new cards render with full text, correct dates (Aug 2 2026 / Dec 31 2026), sorted into position by date.

## No time/promise language
Neither entry promises AINumbers turnaround, review cadence, or SLA (SO #0 / `feedback-no-time-promises-unfunded`) — both are statements of an external regulatory fact plus a factual coverage/gap statement about the existing live estate.

## Untouched, per fence
`check-deadline-freshness.mjs` not edited. No chains/nodes/kernels/`chaingraph.json` touched. `repo/exporters/` untouched (CFPB 1071 / EBA xBRL-CSV not added — out of scope per row). `mcp-apps-poc/`, `helm/` untouched.
