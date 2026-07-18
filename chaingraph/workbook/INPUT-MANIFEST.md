# Spreadsheet Input Manifest (WORKBOOK-1-BUILD-SPEC.md §WB-2)

Engine-free evidence binding spreadsheet inputs into OCG. A manifest names a CSV
source and the ranges pulled out of it for a policy calculation, each carrying a
`values_digest` so a downstream artifact/chain can point at exactly which cells
its `policy_parameters` came from.

Schema: [`input-manifest.schema.json`](input-manifest.schema.json).
Validator: `node validate-input-manifest.mjs [<file> ...]` (defaults to `fixtures/*.json`).

## Shape

```json
{
  "manifest_type": "spreadsheet-input-manifest",
  "source": { "filename": "line-items.csv", "csv_digest": "<sha256 hex>" },
  "ranges": [
    { "ref": "B2:C3", "values_digest": "<sha256 hex>", "semantics": "policy_parameters pointer: ..." }
  ],
  "produced_by": "<free-text: tool or person that produced this manifest>",
  "produced_at": "<ISO 8601 timestamp>"
}
```

- `source.csv_digest` — digest of the full parsed CSV value matrix.
- `ranges[].ref` — an A1-style cell or range reference (`B2`, `B2:C3`).
- `ranges[].values_digest` — digest of just that range's value matrix.
- `ranges[].semantics` — free-text pointer describing what the range means to the
  consuming `policy_parameters` (not a JSON Pointer itself; §23 `pointer` below is).
- `produced_by` / `produced_at` — provenance: who/what produced the manifest, when.

## The digest algorithm is the whole point of "engine-free"

Both `csv_digest` and `values_digest` are computed the SAME way: take the value
matrix (rows of cells, already type-coerced — numeric-looking cells are JSON
numbers, everything else is a string), canonicalize it per RFC 8785 (JCS), and
SHA-256 the result — the exact `executionHash(values, {})` call the rest of OCG
uses for `execution_hash` (`chaingraph/kernels/_hash.mjs`). **Any tool that can do
that one step — canonical-JSON-then-SHA-256 — can produce a conformant manifest.**
The AINumbers workbook (`workbook.mjs`'s `csvDigest`/`rangeDigest`) is one producer
of this shape, never the only one: an Excel export, a Python script, or any other
tool computing the same digest over the same value matrix produces an identical,
interoperable `csv_digest`/`values_digest`. Two fixtures under `fixtures/` prove
this split: [`input-manifest.workbench-produced.json`](fixtures/input-manifest.workbench-produced.json)
came from `workbook.mjs`; [`input-manifest.hand-produced.json`](fixtures/input-manifest.hand-produced.json)
was computed by calling `executionHash()` directly on a hand-built matrix, with no
workbook module in the loop. Both validate against the schema unmodified.

## Relationship to SPEC.md §23 (Input Attestations)

This manifest is evidence *about* an input, not an attestation itself. A manifest's
`values_digest` MAY be the digest an [SPEC.md §23](../standard/SPEC.md) `input_attestations`
entry binds to (its `pointer` resolves into the consuming artifact's
`policy_parameters`, and the attested digest MUST equal that same §4-canonical
digest). §23 defines the attestation envelope and verification profile; this
document does not restate it — see SPEC.md §23 for the normative text.
