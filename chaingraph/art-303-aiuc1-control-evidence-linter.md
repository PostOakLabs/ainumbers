# AIUC-1 Control Evidence Linter

Lints a supplied control-evidence bundle against the 23 automatable AIUC-1 v2026-Q1 controls (pillars A-F): version-guards the catalog, classifies each automatable control receipt-backed, attestation-only, or missing, and reports per-pillar and overall coverage. The ~26 procedural AIUC-1 controls are structurally out of automatable scope and are reported as such, never claimed covered. Asserts the supplied evidence replays to this coverage score; never that any control is certified, and never an AIUC/underwriter endorsement. Not the same as an underwriting decision or a policy-selling tool. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-303-aiuc1-control-evidence-linter.html
- Markdown twin: https://ainumbers.co/chaingraph/art-303-aiuc1-control-evidence-linter.md
- MCP tool: lint_aiuc1_control_evidence (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- aiuc1_version (unknown, required)
- control_evidence (array, required)

## Outputs

- aiuc1_version (string, optional)
- attestation_only_count (integer, optional)
- automatable_scope (integer, optional)
- insufficient_evidence (boolean, optional)
- missing_count (integer, optional)
- overall_coverage (integer, optional)
- per_control (array, optional)
- per_pillar_coverage (object, optional)
- procedural_controls_out_of_scope (integer, optional)
- receipt_backed_count (integer, optional)
- version_mismatch (boolean, optional)

## Sample

```json
{
  "aiuc1_version": "2026-Q1",
  "control_evidence": [
    {
      "control_id": "AIUC-A-01",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-A-02",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-A-03",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-A-04",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-B-01",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-B-02",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-B-03",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-B-04",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-C-01",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-C-02",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-C-03",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-C-04",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-D-01",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-D-02",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-D-03",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-D-04",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-E-01",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-E-02",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-E-03",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-E-04",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-F-01",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-F-02",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    },
    {
      "control_id": "AIUC-F-03",
      "evidence": [
        {
          "type": "receipt",
          "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "issued_at": "2026-06-01"
        }
      ]
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_aiuc1_control_evidence` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
