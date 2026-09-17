# Dora Roi Gleif Preflight Pack

DORA RoI GLEIF pre-submission evidence pack, terminal node of chain dora-roi-gleif-preflight-pack (art-466 -> art-599 x N -> art-600 x N -> art-601). Pure composition over upstream node outputs: links to the upstream dora-roi-builder artifact by execution_hash + tool_id (never the raw dataset), and for each LEI-bearing counterparty carries forward its art-599 GLEIF snapshot digest result and its art-600 relationship-consistency result. Rolls up all_snapshots_captured and any_relationship_violation across the counterparty set, plus a named-human attestation closure (management-body role, art-300 pattern). Every element carries captured_at and a source digest so staleness stays visible without the pack asserting freshness. Preparation aid only: assembles evidence a firm compiles when preparing its own DORA RoI submission. Not a submission, not a filing, not a determination that a submission is complete or accurate, and not a statement that any regulator has reviewed or would accept this output. compliance_flags describe pack-assembly state only.

- Page: https://ainumbers.co/chaingraph/art-601-dora-roi-gleif-preflight-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/art-601-dora-roi-gleif-preflight-pack.md
- MCP tool: compute_dora_roi_gleif_preflight_pack (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- attestation (unknown, required)
- counterparties (array, required)
- dora_roi_artifact (unknown, required)

## Outputs

- attestation (object, optional)
- counterparties (array, optional)
- counterparty_count (integer, optional)
- dora_roi_artifact_ref (object, optional)
- error (string, optional)
- rollup (object, optional)
- scope_note (string, optional)

## Sample

```json
{
  "dora_roi_artifact": {
    "execution_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "tool_id": "art-466-dora-roi-builder"
  },
  "counterparties": [
    {
      "counterparty_id": "provider-1",
      "gleif_snapshot": {
        "lei": "5493001KJTIIGC8Y1R12",
        "lei_checksum_valid": true,
        "source_sha256": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "captured_at": "2026-08-17T00:00:00Z",
        "last_update_date": "2026-01-01",
        "snapshot_captured": true
      },
      "lei_relationship_check": {
        "subject_lei": "5493001KJTIIGC8Y1R12",
        "records_assessed": true,
        "consistent": true,
        "violation_count": 0
      }
    },
    {
      "counterparty_id": "provider-2",
      "gleif_snapshot": {
        "lei": "213800WSGIIZCXF1P572",
        "lei_checksum_valid": true,
        "source_sha256": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        "captured_at": "2026-08-17T00:00:00Z",
        "last_update_date": "2026-02-01",
        "snapshot_captured": true
      },
      "lei_relationship_check": {
        "subject_lei": "213800WSGIIZCXF1P572",
        "records_assessed": true,
        "consistent": true,
        "violation_count": 0
      }
    }
  ],
  "attestation": {
    "name": "Jane Doe",
    "title": "Head of ICT Risk",
    "timestamp": "2026-08-17T12:00:00Z"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_dora_roi_gleif_preflight_pack` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
