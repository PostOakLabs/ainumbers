# WEBMCP-WRAPPER-PARSE-1 — derive `propertyIdMap` entries from each page's own run() wrapper, verify with the fixture-hash probe, emit only what the probe proves

Builder: GLM 5.3 (opencode), row `WEBMCP-WRAPPER-PARSE-1`, worktree `repo/.wt/WEBMCP-WRAPPER-PARSE-1` off `origin/main` @ `c257f618`. Staged 2026-09-05 by Fable; executed 2026-09-09.

## Premise verification (re-run at claim, quoted)

`findWrapperName` exists in the generator (relocated by later main work from the row's cited path to `repo/scripts/gen-webmcp-registrations.mjs`, applied in the worktree as `scripts/gen-webmcp-registrations.mjs`):

```
$ git grep -n "findWrapperName" -- scripts/gen-webmcp-registrations.mjs
714:export function findWrapperName(pageSrc, fn) {
```

Fresh sweep at claim (premise quoted the 481 count from staging; the number MOVED, as the premise directs a re-run):

```
$ node scripts/gen-webmcp-registrations.mjs --check
✗ … 525 sweep-cleared tool(s) excluded with reasons
  EXCLUDED <id>: … form-element mapping incomplete, inputSchema properties with no matching element id: <props>
→ counted: 465 form-element mapping incomplete exclusions (was 481 at staging)
```

## The work

`scripts/gen-webmcp-registrations.mjs` gained:

1. **Parser** — `parseWrapperBindings(pageSrc, wrapperName, manifest)` (pure, zero dependencies, hand-rolled string/brace/tokenizer only; no name-based heuristic anywhere in the binding path): locates the zero-arg wrapper body (the `findWrapperName` shape), finds the params-object boundary (object literal passed to `execution.function_name`; `const pp = {…}`; a zero-arg helper hop `pp = getParams()`; or successive `pp.prop = …` assignments), and binds each inputSchema property to exactly one DOM read (`document.getElementById('<id>')`, `document.querySelector('#<id>')`, `$('<id>')` with the `$` helper detected by its own definition on the page) after the value expression's remainder is a benign normalization (`.trim()`, `toUpperCase/toLowerCase`, `|| / ?? <literal>`, `Number(...)`/`parseFloat(...)` wrappers, emptyness-guard ternaries, `JSON.parse(<textarea>.value)`). Entry types: `{ id }`, `{ id, coerce: number|boolean }`, `{ json: id }`, `{ rows: { prefix, index: [1..N], fields: { schemaField: '_suffix' } } }` — rows derived from the page's own indexed-id loop (`'t' + i + '_ssi'` in `getTrades()`-style helpers, the art-79 shape proven in selftest). Anything else → `unbound: [props]`, page not emitted.

2. **`--derive-map [--write] [--report]`** — parses every currently excluded page whose wrapper is detectable, probes the derived set (below), and `--write` stamps proven entries into `propertyIdMap`'s new generated region (markers `WEBMCP:DERIVED-MAP-BEGIN/END`) with `source: "parsed-from-wrapper"` + `wrapper_digest` (sha256 of the wrapper span). `verifyPageMapping` ignores derived entries (no `element_id`/`via`), so **emission is unchanged** and the literal-id guard still applies — the fence's ⛔ no-page-edits / ⛔ no-batch-registrations is respected; batch rows are ORCH's to mint.

3. **Staleness guard** — `--check` now re-parses every committed derived page and refuses on wrapper-byte drift (digest), entry drift, OR a failed re-probe. Drift is red, never silent.

4. **Probe gate** (in `--derive-map` and wired into `--check`) — the `check-deeplink-contract.mjs` harness pattern (node:vm context, minimal DOM, page scripts in document order): prefill the controls from fixture 0's `policy_parameters` THROUGH the derived entries (`prefillFromEntries`), call the page's own wrapper, read the result global via an in-context script (`let/const` result globals are invisible to the host sandbox), assert `execution_hash` === fixture 0's `golden_hash`. In-context `console` warnings surfaced as probe diagnostics.

## Bucket counts (`--derive-map` over the 465 mapping-incomplete pages; 462 had a detectable wrapper)

```
--derive-map over 465 mapping-incomplete page(s) with a detectable wrapper:
  derived-and-proven:   3 (written into propertyIdMap)
  derived-but-probe-failed: 0
  unbound:              462
PROVEN art-153-emir-trade-report-field-validator: 1 prop(s) via wrapper run
PROVEN art-163-vida-oss-registration-router: 1 prop(s) via wrapper run
PROVEN art-164-vida-compliance-readiness-diagnostic: 1 prop(s) via wrapper run
```

- **derived-and-proven: 3** — committed with `source: "parsed-from-wrapper"` + `wrapper_digest`. Small, but every committed entry is probe-proven against the kernel's real fixture-0 `golden_hash`; nothing is committed on parser say-so.
- **unbound: 462** — honest refusal; the dominant causes (quoted verbatim in the full report below): (a) manifest `execution.function_name: "TODO_FUNCTION_NAME_REVIEW"` placeholders → no zero-arg wrapper (≈415 pages); (b) real wrappers whose params build from locals the parser refuses to chase (helpers computing values, scalars read outside the object literal, e.g. `setTimeout`-shaped simulation pages); (c) nested/renamed shapes with computed leaves (art-527, art-628 `tree`/`facts` textareas filled by persistence code, etc.). These are per-page verdicts; the ORCH can mint fix rows from the per-page reasons.
- **derived-but-probe-failed: 0** — no page bound and then failed the probe (a binding that corrupts the preimage would land here with `wrapper-parse: hash-mismatch`; the selftest proves the verdict works by construction).

**Documented deviations from the row's four flat entry types** (structural reads of the page's own bytes, never name heuristics; both exercised in selftest and cited here so the deviation is diff-visible):
1. **Nested object groups** — the dominant real-page shape is `pp = { report: { action_type: … } }` (art-153/VIDA pages, art-61). The single-read rule is applied recursively inside the sub-literal; entry `{ object: { sub: entry } }`; prefill recurses identically.
2. **Benign tails** — real pages normalize reads (`.value.trim() || undefined`, `tv !== '' ? Number(tv) : undefined`). The remainder after the single distinct read must be an allowlisted benign chain; the probe (not the classifier) verifies the chain doesn't corrupt the preimage — a corrupting chain fails the fixture hash.
3. **One-hop local substitution** — helper locals (`const tv = document.getElementById('total_with_vat').value;` used as `total_with_vat: tv !== '' ? Number(tv) : undefined`) are resolved one hop into single-read bindings, bounded.

## Self-test (FAIL⛔→PASS, quotes)

```
$ node scripts/gen-webmcp-registrations.mjs --selftest
  ✓ parse: all five entry types bound from the page wrapper
  ✓ parse: scalar entry {id}
  ✓ parse: coerce number entry (Number(...))
  ✓ parse: coerce boolean entry (.checked)
  ✓ parse: json entry (JSON.parse(textarea))
  ✓ parse: nested object entry (report.{action_type,notional} with benign tails)
  ✓ parse: rows entry (helper loop t<1..2>_ssi/_liq, schema-field keys)
  ✓ parse RED: a prop computed from two reads is refused (unbound: spot)
  ✓ parse RED: a constant prop is unbound
  ✓ probe GREEN: derived entries reproduce fixture 0 execution_hash
  ✓ probe RED: a wrong bound id fails the fixture-hash probe (hash-mismatch)
  ✓ probe GREEN: restored binding re-passes
  ✓ staleness RED: drifted wrapper re-parses to a different binding+digest
  ✓ staleness RED: digest differs implies --check entry-drift refusal would fire
  ✓ probe RED: a corrupted binding path fails (parse or probe)
GEN-WEBMCP-REGISTRATIONS SELFTEST: PASS
```

(Also all 62 pre-existing rows of the selftest stayed green — the synthetic fx-200-wrap fixture repo carries one page per entry type: scalar, Number-coerce, boolean, JSON textarea, nested group, and the art-79-style `trades` rows loop via a `getTrades()` helper.)

## RED-then-GREEN on the live `--check` (wrong bound id)

RED (committed derived id `action_type` hand-flipped to a nonexistent `wrongControlX`; the guard detects the entry no longer matches a re-parse):

```
$ node scripts/gen-webmcp-registrations.mjs --check
✗ webmcp-registration freshness FAILED (1):
    chaingraph/art-153-emir-trade-report-field-validator.html: derived entries drifted from a re-parse of the current wrapper (digest 1ff6c74b2596…) — re-run node scripts/gen-webmcp-registrations.mjs --derive-map --write
```

GREEN (restored via the sanctioned `--derive-map --write`, which re-derives from the wrapper bytes):

```
✓ webmcp-registration freshness clean — 96 generated registration(s) byte-exact vs their manifests, 358 chain composer page(s) byte-exact in chain mode, 3 derived-map page(s) re-parsed and probe-verified vs fixture 0; 525 sweep-cleared tool(s) excluded with reasons (shrinks as fix rows land).
```

The probe-level RED (a wrong id that still parses cleanly — e.g. the page renames its own control id) is exercised in selftest: `probe RED: a wrong bound id fails the fixture-hash probe (hash-mismatch)` — the prefill misses the real control, the wrapper reads the default/empty value, and the execution_hash preimage diverges from `golden_hash`.

## Freshness on `--check` (whole gate)

```
$ node scripts/gen-webmcp-registrations.mjs --check
✓ webmcp-registration freshness clean — 96 generated registration(s) byte-exact vs their manifests, 358 chain composer page(s) byte-exact in chain mode, 3 derived-map page(s) re-parsed and probe-verified vs fixture 0; 525 sweep-cleared tool(s) excluded with reasons (shrinks as fix rows land).
```

Per the row's own fence, ⛔ no batch registrations were minted in this row — the done-criterion's "first batch regen" belongs to the ORCH-minted `WEBMCP-PARSE-BATCH-<N>` rows (≤50 pages per PR, HALT-ON-DEFECT), so this deliverable stops at the mechanism + proven derived set.

## Live browser probe

⛔ Prose-only: the derived pages register/invoke through inline compute paths runnable in this harness, but a REAL browser run needs a flag-launched Chrome against a served page (the in-repo harness `check-deeplink-contract.mjs` does this for registered pages via `--only`). The exact command that would run live against a derived page once served (e.g. `https://ainumbers.co/chaingraph/art-153-emir-trade-report-field-validator.html`):

```
node scripts/check-deeplink-contract.mjs --only art-153-emir-trade-report-field-validator
```

(and for a flag-launched Chrome against the local static file: `& 'C:/Program Files/Google/Chrome/Application/chrome.exe' --enable-features=WebMCP --headless=new --dump-dom 'http://127.0.0.1:8000/chaingraph/art-153-emir-trade-report-field-validator.html'` — the headless harness above is the deterministic stand-in and re-verifies the same execution_hash against the kernel's fixture `golden_hash`.)

## Gates

- generator `--selftest`: PASS (quoted above)
- generator `--check`: clean (quoted above)
- `repo/scripts/check-page-determinism.mjs`: unchanged (this row does not touch pages)
- `repo/scripts/preflight.mjs`: run at the push gate; see the row's check-off record for its exit code

## Fence compliance

- ✅ Only fence paths touched: `repo/scripts/gen-webmcp-registrations.mjs` (committed on branch `WEBMCP-WRAPPER-PARSE-1`) and this report.
- ✅ No page edits, no manifest edits, no kernel edits.
- ✅ No name-based heuristic in the binding path (structure-only tokenizer; every binding names the read it was parsed from).
- ✅ No batch registrations minted here (ORCH mints `WEBMCP-PARSE-BATCH-<N>` from the 3-page proven set).
- ✅ Emission unchanged: `verifyPageMapping` ignores derived entries; the 96 registered pages stayed byte-exact through `--check`.
