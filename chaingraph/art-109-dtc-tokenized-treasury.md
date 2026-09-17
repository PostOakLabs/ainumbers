# DTC-Custodied Tokenized U.S. Treasury Issuance & DvP

Validate a DTCC/ComposerX tokenized U.S. Treasury for issuance and atomic settlement: DTC-custody linkage, Fed eligibility, ComposerX DAML lifecycle coverage (issuance→corporate-actions→redemption), atomic-DvP readiness, and programmable-collateral-at-issuance. Treasury/DTC-custody-specific; not generic securities lifecycle (512) or FICC clearing economics.

- Page: https://ainumbers.co/chaingraph/art-109-dtc-tokenized-treasury.html
- Markdown twin: https://ainumbers.co/chaingraph/art-109-dtc-tokenized-treasury.md
- MCP tool: validate_dtc_tokenized_treasury (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- tokenized_ust_config (unknown, required)

## Outputs

- collateral_reuse_ok (boolean, optional)
- custody_link_ok (boolean, optional)
- daml_lifecycle_gaps (array, optional)
- daml_template_ok (boolean, optional)
- dvp_ready (boolean, optional)
- fed_eligible (boolean, optional)
- verdict (string, optional)

## Sample

```json
{
  "tokenized_ust_config": {
    "cusip_class": "US-TREASURY",
    "dtc_custody_ref": "DTC-123456-UST",
    "fed_eligible": true,
    "composerx_daml_template": "composerx:ust-lifecycle-v1",
    "lifecycle_events": [
      "issuance",
      "corporate_actions",
      "redemption"
    ],
    "collateral_reuse_policy": "allowed"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_dtc_tokenized_treasury` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
