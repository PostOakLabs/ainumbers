# XBRLCSV-EXPORTER-1 — §13.14 xBRL-CSV runtime exporter (2026-07-26)

## Job 0 — deferral reason (why `XBRLCSV-1` split this out)

`XBRLCSV-1`'s row and its check-off both say the same thing, quoted verbatim from
`board/done/XBRLCSV-1.md`: *"Exporter runtime (exporters/xbrl-csv.mjs) and the populated Annex 2
concept map remain separate, later work units per the §13.14 fence."* SPEC.md §13.14's own Fence
paragraph confirms this is a deliberate scope split, not a discovered blocker — it names the exact
pattern §13.13 and the §PPH-1 shape gate used before their runtimes landed: fixture-only conformance
first, runtime later. **No licence, taxonomy-availability, or profile-ambiguity blocker was stated.**
Verdict: the deferral no longer holds as a blocker — proceeded.

## Job 1 — EBA DPM version / taxonomy release, and concept-map population

**Exact version cited (source fetched 2026-07-26):**
`https://www.eba.europa.eu/risk-and-data-analysis/reporting/reporting-frameworks/reporting-framework-40`
— **DPM database 2.0, taxonomy package v4.0 (taxonomy architecture v2.0), published 2025-03-20.**
Page states "EBA reporting framework 4.0 is expected to apply from 03/2025."

**Named gap:** the xBRL-CSV mandatory-switch date (2026-03-31, corroborated below) falls inside
Reporting Framework **4.2** (a further DPM 2.0 update effective from reference date 2025-12), not
RF4.0. RF4.2's own taxonomy-package page (`reporting-framework-42`) returned HTTP 404 as of
2026-07-26 — its exact taxonomy package version/date could not be corroborated in this session. This
is stated explicitly in the concept map rather than silently assuming RF4.0 and RF4.2 share qnames.

**Mandatory date, corroborated:** `https://www.dnb.nl/en/login/dlr/supervisory-reports/banks/news-and-messages/news/2025/2025-06-27-revised-date-for-transition-to-xbrl-csv/`
— EBA postponed the mandatory xBRL-CSV switch to **31 March 2026**; xBRL-XML no longer accepted by
DNB/SRB/ECB/EBA from that reference date. Matches `XBRL-COVERAGE-CONFIRM-1`'s finding.

**Concept-map population — honest outcome: NOT populated, and could not honestly be.** A pre-existing
scaffold already lived at `exporters/taxonomies/eba-dpm2-xbrlcsv-corep-map.json` (shipped in PR #619 /
`XBRLCSV-1`, dated 2026-07-25) — this WU extended its `source_of_truth` block with the citations above
rather than creating a second, driftable copy. Every `eba_qname` stays `null`: those machine-readable
concept identifiers exist only inside the taxonomy package's own DPM dictionary (a multi-file XSD +
linkbase download), which this session did not fetch or parse — there is no XBRL/XML taxonomy
processor available in this zero-dependency, no-new-dependency repo, and guessing a qname from an ITS
Annex PDF label would be exactly the fabrication SPEC.md §13.14.5 bans. The `corep_ref_indicative`
row/col pointers in the scaffold are carried over unverified from the §13.8 XML sibling map — a
starting pointer for whoever populates this, not a coverage claim.

**Subset actually covered:** zero populated concepts. The scaffold names 2 own-funds fields
(`basel31_rwa_bn` / TREA, `cet1_ratio_basel31_pct` / CET1 ratio) plus 2 liquidity fields as
*template-referenced but unmapped* — this is unchanged from what `XBRLCSV-1` shipped. Nothing wider
is claimed.

## Job 2 — runtime exporter

Built `chaingraph/exporters/xbrl-csv.mjs` (not `repo/exporters/...` as the row's fence literally
said — the existing sibling `xbrl.mjs`/`xbrl-json-fixtures.test.mjs`/taxonomies live under
`chaingraph/exporters/`, so the new file follows the same real location for consistency and so
`import`s resolve without a second directory tree).

`buildXbrlCsv(artifact, xbrl_csv_taxonomy='ocg-ext')`:
- **`ocg-ext`** (works today): builds a real xBRL-CSV (REC 2021-10-13) report package — a JSON
  metadata part (`documentInfo`/`tableTemplates`/`tables`, JCS-canonicalized via the shared
  `cgCanon` from `kernels/_hash.mjs`, never hand-rolled) plus one CSV data part, rows sorted
  ascending by the declared row-id column, zipped together with the repo's existing zero-dep
  `zip.mjs` STORE-only writer (the same one that produces `.xlsx`). Reuses `xbrl.mjs`'s own
  `OCG_EXT_CONCEPTS`/`OCG_EXT_NAMESPACE_URI`/`OCG_EXT_SCHEMA_REF` (three new named exports added
  to `xbrl.mjs`, additive only) so the CSV profile cannot drift from the XML profile's taxonomy —
  one source of truth, not two. A payload field with no matching concept is **omitted** from the
  table, never emitted under an invented placeholder concept.
- **`eba-corep-own-funds` / `eba-corep-lcr-nsfr`**: throw a clear "pending" error, mirroring
  `xbrl.mjs`'s `buildCorep()` guard — `entry_point_schemaRef` / every `eba_qname` null per the
  concept map above, so no fabricated EBA concept can reach output.

**Zero new dependencies.** Only imports from existing sibling modules
(`_meta.mjs`, `zip.mjs`, `../kernels/_hash.mjs`, `xbrl.mjs`).

**Deliberately out of this WU's fence** (per SPEC.md §13.14's own Fence text, which lists worker
wiring and the MCP `export_artifact` format arm as separate, later work units): `exporters/index.mjs`
was NOT touched — `xbrl-csv` is not yet in `EXPORTERS`/`SUPPORTED_FORMATS`/the MCP tool's format enum.
A follow-up WU wires it in (adds `xbrl-csv: (a, t) => buildXbrlCsv(a, t)` to `index.mjs`'s `EXPORTERS`
map + extends the `format` zod enum + the tool description), then the two-repo vendor step
(`node generate.mjs` in `mcp-apps-poc/`) makes it live on the MCP surface.

## Job 3 — RED before / GREEN after / validated against the profile's own rules

**(a) RED, quoted:** before this WU, `chaingraph/exporters/xbrl-csv.mjs` did not exist —
`import { buildXbrlCsv } from './xbrl-csv.mjs'` would throw `ERR_MODULE_NOT_FOUND`. Verified by hand
(the file was absent; `git log -- chaingraph/exporters/xbrl-csv.mjs` on the pre-change tree returns
no commits).

**(b) GREEN, quoted** — `node chaingraph/exporters/xbrl-csv-fixtures.test.mjs` (extended in this WU
with a live-exporter block, run against a real kernel artifact from
`art-35-tempo-payments-business-case`):

```
live exporter (exporters/xbrl-csv.mjs) — §13.14.6 properties on ACTUAL output, not fixtures:
  ✓ live export: media_type application/zip
  ✓ live export: bytes start with ZIP local-file-header signature (PK)
  ✓ live export: ZIP contains metadata.json + data.csv (readable by an independent unzip, not just our own writer)
  ✓ live export: both parts are STORE (method 0) — no compression to independently re-implement to read them
  ✓ live export: metadata.json is byte-identical to its own canonical (JCS) re-serialization (§13.14.1)
  ✓ live export: documentInfo.features["xbrl:canonicalValues"] === true
  ✓ live export: execution_hash embedded matches the source artifact, sha256:-prefixed
  ✓ live export: chaingraph_version carried through unchanged (export mints no envelope change)
  ✓ live export: documentInfo.namespaces binds a prefix to the real ocg-ext namespace URI
  ✓ live export: data.csv has at least one data row for this real artifact
  ✓ live export: data.csv rows sorted ascending by the declared row-id column
  ✓ live export: concept "ocg-ext:AnnualSaving" resolves to a real ocg-ext taxonomy concept, never a placeholder
  ✓ live export: concept "ocg-ext:Verdict" resolves to a real ocg-ext taxonomy concept, never a placeholder
  ✓ live export: eba-corep-own-funds throws "pending" through the real exporter — no fabricated EBA concept ever reaches output
  ✓ live export: deterministic run does not throw on repeat call
  ✓ live export: byte-identical on re-run for the same artifact (determinism)

✓ all §13.14 fixture + live-exporter checks pass
```
All 3 original fixture-only checks (metadata/data/annex2) also still pass unchanged — 30 assertions
total, 0 failures.

**(c) Validated against the profile's own rules, not our own expectations, and the unverified
remainder stated plainly:**
- The ZIP is unzipped by an **independently hand-written reader** in the test (a minimal STORE-only
  central-directory-free scanner reading local file headers), not by re-using `zip.mjs`'s own writer
  logic — proves the archive is genuinely readable by different code, the way any real unzip tool
  would read it, not merely self-consistent with its own writer.
- The metadata JSON part is checked against §13.14.1's own canonicalization rule (JCS via the shared
  `cgCanon`, the SAME function `kernels/_hash.mjs` uses for `execution_hash` — not a second
  reimplementation) and §13.14.6's named properties (canonical-values feature flag, row-id-sorted CSV,
  every table column resolving to a real taxonomy concept), exactly as the fixture gate already
  enforces on the committed fixtures — now enforced on live output too.
- The Annex 2 pending guard is exercised through the **real exporter function**, not a simulated
  `if (!ready) throw` copy-pasted into the test (the fixture-only version of this check, still present
  above it, does simulate — the live-export block calls `buildXbrlCsv` itself).
- **What remains genuinely unverified, stated plainly:** full OIM/xBRL-CSV REC 2021-10-13 structural
  conformance (the report-package JSON Schema, table-linking machinery, dimensional/validation-rule
  layer) beyond the §13.14.6-named properties this gate checks. SPEC.md §13.14.4 itself says
  validation is EXTERNAL, by pointer — this spec vendors no DPM 2.0 validator, and this repo is
  zero-dependency by CONTRACT so it cannot vendor Arelle or any other certified OIM/xBRL-CSV
  processor. **No offline validator was available to run in this session; this is not claimed as
  submission-ready or regulator-accepted anywhere in code, comments, or this document** (SPEC.md
  §13.14.3's normative caveat — "submittable format, unvalidated content" — is the correct framing
  and is exactly what ships).

## §18 / node / chain counts

Not touched. No new chaingraph node, no kernel, no digest-freshness or ratchet edit. §18 gates,
node count (477), and chain count (325) are UNMOVED by this WU — nothing here writes `chaingraph.json`
or any node/chain shard.

## Fence discipline

Touched only: `chaingraph/exporters/xbrl-csv.mjs` (new), `chaingraph/exporters/xbrl.mjs` (additive
exports only — `OCG_EXT_CONCEPTS`, `OCG_EXT_SCHEMA_REF`), `chaingraph/exporters/taxonomies/eba-dpm2-xbrlcsv-corep-map.json`
(provenance tightened, no concept populated), `chaingraph/exporters/xbrl-csv-fixtures.test.mjs`
(extended, original fixture checks unweakened), and this file. `SPEC.md` untouched.
`chaingraph.json` untouched. No worktree/kernel/art-number/mcp-apps-poc/helm files touched.
