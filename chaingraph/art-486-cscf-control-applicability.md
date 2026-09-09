# CSCF Control Applicability & Coverage

Scores a Swift member's declared architecture type and component inventory against a policy-supplied Swift Customer Security Controls Framework (CSCF) control matrix - the published control number, tier (mandatory/advisory), applicable-architecture-type list, and evidence column, never a hand-transcribed list. Returns the applicable mandatory/advisory control set, coverage percentages, a gap list keyed by the published control number, an evidence index mapped to the matrix's supporting-evidence column, and an explicit not-applicable set with a stated reason per exclusion so an omission can never read as a pass. Not a Swift-endorsed tool and not a KYC-SA submission; consumes the firm's own declared architecture and its own copy of the published matrix.

- Page: https://ainumbers.co/chaingraph/art-486-cscf-control-applicability.html
- Markdown twin: https://ainumbers.co/chaingraph/art-486-cscf-control-applicability.md
- MCP tool: check_cscf_control_applicability (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- architecture_type (unknown, required)
- component_inventory (array, required)
- control_matrix (array, required)
- cscf_version (unknown, required)
- implementation_status (unknown, required)

## Outputs

- advisory_coverage_pct (integer, optional)
- applicable_advisory_count (integer, optional)
- applicable_mandatory_count (integer, optional)
- architecture_type (string, optional)
- component_inventory (array, optional)
- cscf_version (string, optional)
- evidence_index (object, optional)
- gap_list (array, optional)
- mandatory_coverage_pct (integer, optional)
- not_applicable_set (object, optional)
- overall_status (string, optional)

## Sample

```json
{
  "architecture_type": "A1",
  "cscf_version": "2026",
  "component_inventory": [
    "swift_alliance_access",
    "hsm",
    "jump_server"
  ],
  "control_matrix": [
    {
      "control_number": "1.1",
      "tier": "mandatory",
      "applicable_architecture_types": [
        "A1",
        "A2",
        "A3",
        "A4"
      ],
      "evidence_ref": "SWIFT.io evidence"
    },
    {
      "control_number": "1.2",
      "tier": "mandatory",
      "applicable_architecture_types": [
        "ALL"
      ],
      "evidence_ref": "Network diagram"
    },
    {
      "control_number": "2.1",
      "tier": "mandatory",
      "applicable_architecture_types": [
        "A1",
        "A2"
      ],
      "evidence_ref": "Access control list"
    },
    {
      "control_number": "2.4A",
      "tier": "advisory",
      "applicable_architecture_types": [
        "A1",
        "A2",
        "A3"
      ],
      "evidence_ref": "Logging config export"
    },
    {
      "control_number": "5.1",
      "tier": "mandatory",
      "applicable_architecture_types": [
        "A1",
        "B",
        "C"
      ],
      "evidence_ref": "HSM audit report"
    },
    {
      "control_number": "7.2",
      "tier": "advisory",
      "applicable_architecture_types": [
        "ALL"
      ],
      "evidence_ref": "Pen-test report"
    }
  ],
  "implementation_status": {
    "1.1": {
      "implemented": true,
      "evidence_provided": true
    },
    "1.2": {
      "implemented": true,
      "evidence_provided": true
    },
    "2.1": {
      "implemented": false,
      "evidence_provided": false
    },
    "5.1": {
      "implemented": true,
      "evidence_provided": true
    },
    "7.2": {
      "not_applicable": true,
      "na_reason": "No externally exposed pen-test surface for this architecture"
    }
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_cscf_control_applicability` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
