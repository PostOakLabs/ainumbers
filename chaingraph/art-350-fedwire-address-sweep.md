# Fedwire Payment-File Address Sweep

Batch-sweeps a Fedwire or CHIPS payment file (CSV, one record per row) through the November 2026 structured-address mandate lint (lint_fedwire_structured_address, art-349) per record. Returns a rejection-risk report - violation counts by rule and the worst offenders - and a remediation-worksheet receipt (file digest, per-record findings digest, risk score), so a migration team can triage a whole payment file before the 2026-11-16 cutover instead of discovering rejections message-by-message in production. Reuses art-349's rule set rather than reimplementing it - one kernel is the source of truth for Fedwire/CHIPS structured-address rules.

- Page: https://ainumbers.co/chaingraph/art-350-fedwire-address-sweep.html
- Markdown twin: https://ainumbers.co/chaingraph/art-350-fedwire-address-sweep.md
- MCP tool: sweep_fedwire_addresses (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- file_content (unknown, required)
- records (array, required)

## Outputs

- disambiguation (string, optional)
- fedwire_chips_deadline (string, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- rejection_risk_report (object, optional)
- risk_score (integer, optional)
- table_source (string, optional)
- table_version (string, optional)

## Sample

```json
{
  "records": [
    {
      "network": "fedwire",
      "street_name": "400 South Hope Street",
      "post_code": "90071",
      "town_name": "Los Angeles",
      "country": "US",
      "country_subdivision": "CA"
    },
    {
      "network": "chips",
      "street_name": "1 Chase Manhattan Plaza",
      "post_code": "10005",
      "town_name": "New York",
      "country": "US"
    },
    {
      "network": "fedwire",
      "town_name": "Zurich",
      "country": "CH",
      "address_lines": [
        "Bahnhofstrasse 1"
      ]
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `sweep_fedwire_addresses` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
