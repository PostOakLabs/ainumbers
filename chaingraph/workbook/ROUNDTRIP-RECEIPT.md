# Round-Trip Verify-Back Receipt (WORKBOOK-ROUNDTRIP-BUILD-SPEC.md XLR-1)

Two-sided receipt for the Excel round-trip flow: an analyst recomputes a
Helm-emitted calculation in Excel and pastes the result back; this receipt
names whether the pasted-back (`observed`) values match the WB-2 manifest or
`pq-export` side (`expected`). Schema only — this doc defines no comparator,
page, or MCP tool (those are XLR-2/XLR-3/XLR-4).

Schema: [`roundtrip-receipt.schema.json`](roundtrip-receipt.schema.json).
Validator: `node validate-roundtrip-receipt.mjs [<file> ...]` (defaults to
`fixtures/roundtrip-receipt.*.json`).

## Shape

```json
{
  "receipt_type": "workbook-roundtrip-receipt",
  "manifest_ref": "<sha256 hex — the WB-2 manifest's source.csv_digest>",
  "expected": {
    "source": "pq-export" | "manifest",
    "ranges": [ { "ref": "B2:C3", "values_digest": "<sha256 hex>" } ]
  },
  "observed": {
    "source": "excel-paste",
    "ranges": [ { "ref": "B2:C3", "values_digest": "<sha256 hex>" } ]
  },
  "result": "match" | "mismatch",
  "mismatches": [ { "ref": "C3", "expected_value": 200, "observed_value": 205 } ],
  "produced_by": "<free-text: tool or person that produced this receipt>",
  "produced_at": "<ISO 8601 timestamp>"
}
```

- `manifest_ref` — points at the WB-2 [Spreadsheet Input Manifest](INPUT-MANIFEST.md)
  this receipt verifies against, by its `source.csv_digest`. Not a new field —
  the schema's `$ref` resolves directly into `input-manifest.schema.json`.
- `expected.source` — `"pq-export"` when the expected side came from Helm's
  Power Query bridge output, `"manifest"` when it came straight from a WB-2
  manifest's `ranges[].values_digest`.
- `expected.ranges[]` / `observed.ranges[]` — same `{ref, values_digest}` shape
  WB-2 already uses (`input-manifest.schema.json`'s range object minus
  `semantics`, which is a manifest-only provenance field this receipt has no
  use for). No parallel vocabulary invented.
- `result` — closed two-value field, `"match"` or `"mismatch"` — the same
  match/exception naming already used in-repo by
  [`tools/55-dvp-reconciliation.html`](../../tools/55-dvp-reconciliation.html).
  No third state.
- `mismatches[]` — required and non-empty when `result` is `"mismatch"`;
  absent or empty when `result` is `"match"`. Each entry names the one range
  ref that diverged and both sides' raw values (not digests — the point of a
  mismatch entry is a human-readable pointer at what to check in Excel).
- `produced_by` / `produced_at` — same provenance shape as WB-2's manifest.

## Digests are the same digest, not a new one

`values_digest` on both `expected` and `observed` sides is computed the exact
same way WB-1/WB-2 already do it: canonicalize the range's value matrix per
RFC 8785 (JCS), SHA-256 it — `executionHash(values, {})` from
[`_hash.mjs`](../kernels/_hash.mjs). The comparator (XLR-2) runs the pasted-back
range through `workbook.mjs`'s CSV parser and the same range-digest routine
used for the `expected` side, so `match`/`mismatch` reduces to a digest
equality check — no second formula engine, no second canonicalizer.

## Two fixtures

[`fixtures/roundtrip-receipt.match.json`](fixtures/roundtrip-receipt.match.json)
and
[`fixtures/roundtrip-receipt.mismatch.json`](fixtures/roundtrip-receipt.mismatch.json)
validate against the schema and exercise both `result` states, including the
`mismatches[]` cell-list on the mismatch fixture.
