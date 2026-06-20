# OpenChainGraph Export Profiles — `chaingraph_export` (OCG Standard §13, v0.4)

Server-side, hash-excluded renderings of a verified v0.4 artifact. Parallel to `../kernels/`.
All four `chaingraph_export` formats are implemented and tested. `xbrl` ships a working
`ocg-ext` taxonomy (our namespace) now; the `eba-corep-*` taxonomies are registered but return
a "pending — do not fabricate" error until their concept maps are populated from the published
EBA taxonomy (core project rule).

## Files
| File | Role |
|---|---|
| `index.mjs` | Registry + `exportArtifact()` dispatcher + `registerExportArtifact(server, z, opts)` + `EXPORT_ARTIFACT_TOOL_NAME` |
| `_meta.mjs` | Metadata block, filename, **standard** base64 (not url-safe), payload flattener, XML/CSV escapers |
| `zip.mjs` | Dependency-free STORE-only ZIP + CRC32 (xlsx is a ZIP; Workers-safe, deterministic) |
| `xlsx.mjs` | `buildXlsx(artifact)` → 3-sheet workbook (Decision / Data / Provenance), inline strings |
| `csv.mjs` | `buildCsv(artifact)` → manifest + scalars + tables (UTF-8 BOM) |
| `pdf.mjs` | `buildPdf(artifact)` → paginated Helvetica memo, per-`mandate_type` title, provenance footer, **QR** of the verify URL (top-right) |
| `qr.mjs` | `qrMatrix(text)` → boolean module matrix (byte mode, EC-M, v1–7). ⚠ SCAN the sample PDF to confirm |
| `xbrl.mjs` | `buildXbrl(artifact, taxonomy)` → XBRL v2.1; `ocg-ext` validates against the published `../xbrl/ocg-ext/ocg-ext-2026.xsd`; `eba-corep-*` loader present but **guarded** (optional/pull-driven) |
| `export.test.mjs` | Node smoke test; writes `sample-export.{xlsx,csv,pdf,xbrl}` + QR structural check |

**TODOs:** `qr.mjs` is unverified against a scanner in CI — scan `sample-export.pdf` once (the verify URL is
also printed as text, so a non-scanning QR loses nothing). `xbrl.mjs` COREP emission is wired (`buildCorep`)
but `eba-corep-*` stay guarded until `COREP_MAPS` (and the JSON scaffold at `taxonomies/eba-corep-concept-map.json`)
have real `eba_qname`/`schemaRef` values from the published EBA taxonomy — do not fabricate.

## Test (Node 18+)
```
node repo/chaingraph/exporters/export.test.mjs
```
Open the emitted `sample-export.xlsx` in Excel/LibreOffice to eyeball the 3 sheets.

## Wiring into the Worker (do as one push — CONTRACT §A4)

**1. `mcp-apps-poc/worker.mjs`** — import and register beside the utility tools.
Near the other imports:
```js
import { registerExportArtifact } from './exporters/index.mjs';
```
After the utility tools are registered (the worker already builds `cgById` from `chaingraph.nodes`),
add — driving per-node `export_capability` (OCG §13.10):
```js
const isFormatAllowed = (tool_id, format) => {
  const cap = cgById[tool_id]?.export_capability;
  if (!cap || !cap.length) return true;            // JSON-only nodes: allow (additive rollout)
  return cap.some(c => c === format || c.startsWith(format + ':'));  // 'xbrl:eba-corep-own-funds'
};
registerExportArtifact(server, z, { isFormatAllowed });
```
(Use the stricter `return false` default instead of `return true` once `export_capability` is
back-filled across nodes, if you want hard enforcement per §13.4.)

**2. `mcp-apps-poc/generate.mjs`** — vendor `exporters/` exactly like `kernels/`. After the kernels block, add:
```js
const EXPORTERS_SRC    = resolve(REPO, 'chaingraph', 'exporters');
const EXPORTERS_DATA   = resolve(DATA, 'exporters');
const EXPORTERS_BUNDLE = resolve(ROOT, 'exporters');     // alongside worker.mjs → bundled by wrangler
mkdirSync(EXPORTERS_DATA,   { recursive: true });
mkdirSync(EXPORTERS_BUNDLE, { recursive: true });
const EXPORTER_FILE_RE = /^(?!.*\.test\.mjs$)[a-z0-9_-]+\.mjs$/;   // all .mjs except *.test.mjs
for (const f of readdirSync(EXPORTERS_SRC).filter(f => EXPORTER_FILE_RE.test(f))) {
  const src = readFileSync(resolve(EXPORTERS_SRC, f));
  writeFileSync(resolve(EXPORTERS_DATA, f), src);
  writeFileSync(resolve(EXPORTERS_BUNDLE, f), src);
}
```
Run `node mcp-apps-poc/generate.mjs` and commit `mcp-apps-poc/exporters/` + `mcp-apps-poc/data/exporters/`
in the SAME push as the source (two-repo discipline, CONTRACT §A4 #2).

**3. `mcp-apps-poc/scripts/check-tool-names.mjs`** — add `export_artifact` to the utility-tool name
set so the uniqueness gate counts it (it's the 7th utility tool). Import `EXPORT_ARTIFACT_TOOL_NAME`
from `../exporters/index.mjs` or add the literal.

**4. `mcp-apps-poc/generate.mjs` counts** — bump `UTIL_TOOL_COUNT` 6 → 7 (and its comment) so
`counts.json.mcp_tools_total` stays correct.

**5. `chaingraph.json`** — add `export_capability` arrays to nodes (OCG §13.10), e.g.
`"export_capability": ["xlsx","csv","xbrl:eba-corep-own-funds"]`. Optional/additive — absent = JSON-only.

## Deploy & verify (gated CI only — no hand `wrangler deploy`)
1. Confirm `export_artifact` mcp_name is unique: `node mcp-apps-poc/scripts/check-tool-names.mjs`.
2. Push (site repo: source under `repo/chaingraph/exporters/`; server repo: vendored `exporters/` + `data/exporters/`).
3. Gated GitHub Actions deploys. Verify: Actions green + post-deploy `/mcp` smoke + `initialize` 200,
   and `export_artifact` appears in `tools/list`. Round-trip check: call a compute tool, pass the artifact
   to `export_artifact` with `format:"xlsx"`, confirm the returned `metadata.execution_hash` equals the
   artifact's and the blob opens in Excel.

## Invariant
Exports are generated **after** and are **excluded from** `execution_hash = SHA-256(JCS({policy_parameters, output_payload}))`.
A view, never a fact — verification always routes back to the canonical JSON (OCG §13.2).
