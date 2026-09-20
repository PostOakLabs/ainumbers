# FICC-CME Cross-Margining Estimator

Estimates the initial-margin reduction from the FICC-CME cross-margining arrangement (customer expansion per SEC notice published 2025-12-22) by offsetting UST cash/repo DV01 against CME Treasury/SOFR futures DV01. Educational proxy.

- Page: https://ainumbers.co/chaingraph/art-51-cross-margining-benefit-estimator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-51-cross-margining-benefit-estimator.md
- MCP tool: estimate_cross_margin_benefit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- account_type (any, optional): type not evidenced by kernel source
- cme_positions (any, optional): type not evidenced by kernel source
- confidence_level (any, optional): type not evidenced by kernel source
- mpor_days (any, optional): Duration in days; type not evidenced by kernel source
- ust_positions (any, optional): type not evidenced by kernel source

## Outputs

- account_type_note (string, optional)
- assumptions (object, optional)
- cross_margined_im (integer, optional)
- eligible_offsets (array, optional)
- im_reduction_pct (integer, optional)
- im_reduction_usd (integer, optional)
- ineligible_offsets (array, optional)
- note (string, optional)
- standalone_im_total (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `estimate_cross_margin_benefit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
