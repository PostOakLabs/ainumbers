# AIUC-1 Evidence Pack Assembler

Assembles a signed, AIUC-1 control-keyed evidence pack from execution receipts, escalation closures, and work mandates: binds each mapped control to its resolved artifact digests, computes pack_claim_strength as the honest minimum across bound controls, and exports an OSCAL Assessment Results document (arXiv:2604.13767 AI-evidence property-extension mapping, cited not vendored) plus an optional cadence attestation referencing the shipped aggregate_execution_receipts kernel. Verify-side evidence assembly only; never asserts these controls are certified or that any underwriter accepts the pack. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-304-aiuc1-evidence-pack-assembler.html
- Markdown twin: https://ainumbers.co/chaingraph/art-304-aiuc1-evidence-pack-assembler.md
- MCP tool: assemble_aiuc1_evidence_pack (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- aiuc1_version (unknown, required)
- anchor_document_integrity (unknown, required)
- artifacts (unknown, required)
- cadence_attestation_input (unknown, required)
- cadence_period_days (unknown, required): Duration in days
- control_mapping (array, required)

## Outputs

- aiuc1_version (string, optional)
- anchor (string, optional)
- cadence_attestation (object, optional)
- controls (array, optional)
- insufficient_evidence (boolean, optional)
- oscal_assessment_results (object, optional)
- pack_claim_strength (string, optional)
- version_mismatch (boolean, optional)

## Sample

```json
{
  "aiuc1_version": "2026-Q1",
  "artifacts": {
    "receipts": [
      {
        "id": "r1",
        "digest": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      },
      {
        "id": "r2",
        "digest": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
      }
    ],
    "escalation_closures": [
      {
        "id": "e1",
        "digest": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
      }
    ],
    "mandates": [
      {
        "id": "m1",
        "digest": "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
      }
    ]
  },
  "control_mapping": [
    {
      "control_id": "AIUC-A-01",
      "artifact_refs": [
        "r1"
      ]
    },
    {
      "control_id": "AIUC-B-01",
      "artifact_refs": [
        "r2",
        "e1"
      ]
    },
    {
      "control_id": "AIUC-E-01",
      "artifact_refs": [
        "m1"
      ]
    }
  ],
  "cadence_attestation_input": {
    "max_gap_days_by_control": [
      {
        "control_id": "AIUC-A-01",
        "max_gap_days": 45
      }
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `assemble_aiuc1_evidence_pack` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
