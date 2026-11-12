# CGMCP-TOOLSCHEMA-400-CURE-1 — offline meta-schema sweep and cure

Row: `CGMCP-TOOLSCHEMA-400-CURE-1` · 2026-10-21 · FLASH class (schema-only, no kernel bytes)

## Defect (anchored on CGMCP-SONNET-RERUN-1)

Anthropic API, full catalogue loaded (`ENABLE_TOOL_SEARCH=false`, and identically with
`alwaysLoad:true`):

```
tools.41.custom.input_schema: JSON schema is invalid. It must match JSON Schema draft 2020-12
```

Canary bytes: `.scratch/cg-mcp-bench-1/sonnet-rerun-canary/sonnet-rerun-mcp-idx0.json`
(probed tool `art-235-test-hpml-escrow`, error at request tools index 41).

## Offline repro (no API quota)

Validator: ajv 8.20.0 draft-2020-12 (`ajv/dist/2020.js`, `validateSchema` = strict
draft 2020-12 meta-schema validation). Input: the captured served `tools/list`
(`.scratch/cg-mcp-bench-1/mcp-tools-live.json`, 721 tools, request order).

Sweep (baseline, committed at `.scratch/cg-mcp-bench-1/toolschema-cure/sweep-baseline.txt`):

```
TOTAL tools=721 invalid=721
```

Every one of the 721 failures is the SAME single defect — a declared dialect member:

```
"$schema": "http://json-schema.org/draft-07/schema#"
```

Index 41 in the captured list is `ha_gate_status` — matching the API's
`tools.41.custom.input_schema` error index exactly (the API names the first invalid tool;
all 721 were lurking behind it). Re-running the sweep with the `$schema` member removed:

```
after strip, invalid: 0 of 721
```

The schema BODIES are 2020-12-clean. The only invalidating member is the declared dialect.

## Source of the draft-07 stamp

1. The MCP SDK's zod→JSON Schema conversion stamps every registered tool's schema with
   `$schema: draft-07` (worker serves ~160 registered tools; the precompute captures the
   SDK's `tools/list` bytes verbatim — `mcp-apps-poc/scripts/precompute-discovery.mjs`).
2. 25 hand-curated site manifests declare it explicitly inside `input_schema` (and one
   output slot), e.g. `manifests/311-gdpr-dsr-workflow-generator.manifest.json` — 51
   occurrences across 25 files.

## Cure (this PR)

- Site: the 25 manifests re-declare `https://json-schema.org/draft/2020-12/schema`
  (51 insertions / 51 deletions, no other bytes touched).
- Vendor (`PostOakLabs/ainumbers-mcp-apps`, branch `cgmcp-toolschema-400-cure-1`,
  commit `f766fc2`): `scripts/precompute-discovery.mjs` re-declares any draft-07
  `$schema` as the 2020-12 URI across `inputSchema`/`outputSchema` of the captured
  `tools/list`; the same normalization is mirrored in the `worker.mjs` SDK-fallback
  serve path (`SCHEMA_DIALECT_2020`) so a static-miss serve is the same answer.
- Vendor step: `node generate.mjs --repo=<worktree>` regenerated `data/` + `kernels/`
  (self-check "all outputs match site source ✓"); regenerated in the same vendor commit.

## Post-fix verification (quoted)

Meta-schema sweep over the REGENERATED served `tools/list`
(`mcp-apps-poc/data/mcp/static/tools-list.sse.txt`, ajv 2020-12 meta-schema, both schema
slots per tool):

```
REGEN SWEEP tools=746 invalidSlots=0
```

Static bytes: `draft-07/schema#` occurrences — tools-list 0, tool-describe.json 0,
tools-list-lite 0, prompt-context.json 0, output-schemas.json 0; `draft/2020-12/schema`
present 746× (tools-list) and 747× (tool-describe).

- `node scripts/gen-input-schemas.mjs --check` — `✓ input-schema backfill freshness
  clean — 538 provenance-marked schema(s) byte-match fresh derivations` (GREEN)
- `node scripts/cg-mcp-bench.mjs --self-test` — `SELF-TEST PASS … 18/18 … GREEN (0 RED) …
  0 provider calls, 0 MCP calls`
- vendor `node scripts/check-worker-invariants.mjs` — `✓ worker-invariants clean (13
  checks)`

## Live round-trip gate — DEFERRED TO THE RESET WINDOW

Quota-gated: the weekly limit was exhausted at triage time 2026-10-21; this gate runs
>06:00Z 2026-10-22. Shape: re-run the SONNET-RERUN canary with the full catalogue
(`ENABLE_TOOL_SEARCH=false`) AND the `alwaysLoad:true` arm against the deployed worker;
both must pass schema validation (any non-400 answer proves the cure; a quota/limit
message is not a schema 400). CGMCP-SONNET-RERUN-1 drives the live re-dispatch; this row
does not score bench rows.

## Fence conformance

No kernel `.kernel.mjs` logic bytes, no fixtures, no goldens/execution hashes, no node
pages, no `chaingraph.json`, no bench scoring. The `data/chain-fixtures.json` /
`data/kernels/index.mjs` vendor deltas are pure regeneration output of `generate.mjs`
against the committed site source (self-check-verified), reflecting main's art-758/art-770
state — not hand edits.
