# XBRLCSV-SSOT-1 (2026-07-26) — exporter runtime read + EBA disposition close

## Job 1 — kill the hand-mirror

`chaingraph/exporters/xbrl-csv.mjs` hard-coded `COREP_MAPS_CSV` as a literal JS object
(`entry_point_schemaRef: null`, 3 `{eba_qname: null}` fields for `eba-corep-own-funds`,
2 for `eba-corep-lcr-nsfr`) instead of reading
`chaingraph/exporters/taxonomies/eba-dpm2-xbrlcsv-corep-map.json`. Two sources of truth
for one mapping.

**Diff check (JS hand-mirror vs. JSON scaffold) — NO DISAGREEMENT FOUND.** Both sides:
- `eba-corep-own-funds`: `entry_point_schemaRef: null`, 3 fields, every `eba_qname: null`.
- `eba-corep-lcr-nsfr`: `entry_point_schemaRef: null`, 2 fields, every `eba_qname: null`.

Field counts and null-ness matched exactly; the only difference was that the JSON carries
richer provenance (`payload_field`, `source_tools`, `corep_template`, `item_label`, `status`)
that the JS never needed. Nothing to reconcile — the hand-mirror had not drifted, it was
just redundant.

**Fix:** `xbrl-csv.mjs` now `readFileSync`s `taxonomies/eba-dpm2-xbrlcsv-corep-map.json` at
runtime (`loadCorepMaps()`), filters to entries shaped like a taxonomy (`entry_point_schemaRef`
present) so the JSON's metadata keys (`_status`, `source_of_truth`, `conventions`, `_next_steps`)
are ignored automatically, and uses that as `COREP_MAPS_CSV`. Zero new dependency — plain
`node:fs` + `JSON.parse`, same pattern already used by `xbrl-csv-fixtures.test.mjs` and
documented in `exporters/README.md`'s vendoring snippet.

**Deploy-safety fallback (why `loadCorepMaps()` catches):** `mcp-apps-poc/generate.mjs` vendors
only `*.mjs` files out of `chaingraph/exporters/` (not the `taxonomies/` subfolder) — see
`exporters/README.md`'s vendoring block. If this exporter is ever vendored into the worker
without its taxonomy JSON alongside, `readFileSync` throws, `loadCorepMaps()` returns `null`,
and `buildCorepCsv()` falls through to the exact same "pending" guard as today (`map` is
`undefined` → `ready` is falsy). No new failure mode reaches production; the taxonomy id list
(`XBRL_CSV_TAXONOMIES`) is kept as a small static array for the same reason — the two
`eba-corep-*` names are a registry, not the driftable mapping data. No vendoring was run this
session (see Job 3 below) and none was needed.

## Job 2 — EBA disposition recorded as SETTLED

Per Tim's 2026-07-26 ruling (row XBRLCSV-SSOT-1 Job 2): accept the gap as a documented limit
and close the thread. `EBA-CONCEPTMAP-BUILD-1` already established that real `eba_qname`
values are unobtainable without an XBRL/DPM 2.0 taxonomy processor (declined dependency) or
manual XSD/linkbase parsing (not done); it confirmed this live against the EBA RF4.0 page
(zip/xlsx only, no flat qname lookup) and refused to fabricate per §13.14.5.

Disposition text added in three places, framed as decided (not "not done yet"), with a
CONDITION-based revival trigger (never a date — SO #0):
- `exporters/xbrl-csv.mjs`'s `buildCorepCsv()` guard error message (the surface a caller
  actually hits).
- `exporters/taxonomies/eba-dpm2-xbrlcsv-corep-map.json` header (`_disposition` field).
- `exporters/taxonomies/eba-corep-concept-map.json` header (`_disposition` field) — the §13.8
  XML sibling scaffold carries the identical disposition, since the root cause (no taxonomy
  processor) is the same; `exporters/xbrl.mjs` (the §13.8 exporter) is outside this WU's fence
  and was not edited.

Revival trigger, verbatim: **"a citable flat eba_qname lookup source becomes available."**
Not a date, not a recurring review.

**Not touched:** `repo/chaingraph/standard/SPEC.md` §13.14 — per this row's own instruction,
flagging instead. **FLAG for a future SPEC.md-authorised row:** if §13.14 should carry this
settled-disposition language (it currently just states the guard exists), a spec-scribe WU
should add it — this session did not touch SPEC.md.

## Job 3 — behavioural no-op proof

- Fixture gate baseline (pre-refactor, this session): `node chaingraph/exporters/xbrl-csv-fixtures.test.mjs`
  → **36/36 pass** (9 metadata + 6 CSV + 5 annex2 + 16 live-exporter assertions).
- Same command post-refactor: **36/36 pass**, unchanged.
- `eba-corep-own-funds` and `eba-corep-lcr-nsfr` both re-confirmed still pending-guarded
  post-refactor (test suite covers `eba-corep-own-funds`; `eba-corep-lcr-nsfr` re-checked by
  hand in this session — throws the same disposition message).
- `ocg-ext` re-confirmed still emitting a valid package post-refactor (ZIP signature, STORE
  parts, metadata.json/data.csv readable by an independent unzip, byte-identical on repeat run).

No fixture was weakened. REC 2021-10-13 structural conformance is not claimed — remains
externally validated by design (§13.14.4), unchanged from prior rows.

## §18 / vendor — unmoved, not touched

This WU touches no kernel, chain, or node — §18 gate counts and node/chain totals (477/325 per
the row's own statement) are unmoved; no baseline or ratchet edit. No vendor run: this change
never touches `chaingraph.json`, manifests, or the worker's imported surface, and
`generate.mjs` was not invoked.
