# Large Exposures Limit Check

Basel III large exposures framework (BCBS 283) and U.S. single-counterparty credit limits (Regulation YY, 12 CFR 252 Subpart H) limit check: aggregates each counterparty's gross exposure net of eligible credit-risk-mitigation, rolls connected/economically-interdependent counterparties into one group exposure, then checks the group against Tier 1 capital under the general 25% limit or the tighter 15% GSIB-to-GSIB limit. Emits a breach-list artifact of every group exceeding its applicable limit. Deterministic point-in-time calculation from caller-supplied exposure, CRM, and capital figures for a single reporting date.

- Page: https://ainumbers.co/chaingraph/art-425-large-exposures-limit-check.html
- Markdown twin: https://ainumbers.co/chaingraph/art-425-large-exposures-limit-check.md
- MCP tool: compute_large_exposures_limit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- caller_is_gsib (boolean, required)
- counterparties (unknown, required)
- tier1_capital_musd (number, optional)

## Outputs

- breach_list (array, optional)
- caller_is_gsib (boolean, optional)
- counterparties (array, optional)
- groups (array, optional)
- note (string, optional)
- regulatory_basis (string, optional)
- tier1_capital_musd (integer, optional)

## Sample

```json
{
  "tier1_capital_musd": 10000,
  "caller_is_gsib": true,
  "counterparties": [
    {
      "counterparty_id": "cp-A",
      "counterparty_name": "Standalone Corp A",
      "connected_group_id": null,
      "is_gsib": false,
      "exposures": [
        {
          "label": "Term loan",
          "gross_exposure_musd": 2000,
          "crm_eligible": true,
          "crm_value_musd": 400
        }
      ]
    },
    {
      "counterparty_id": "cp-B",
      "counterparty_name": "Group B Sub 1",
      "connected_group_id": "grp1",
      "is_gsib": false,
      "exposures": [
        {
          "label": "Revolving credit",
          "gross_exposure_musd": 1000,
          "crm_eligible": false,
          "crm_value_musd": 0
        }
      ]
    },
    {
      "counterparty_id": "cp-C",
      "counterparty_name": "Group B Sub 2",
      "connected_group_id": "grp1",
      "is_gsib": false,
      "exposures": [
        {
          "label": "Bond holding",
          "gross_exposure_musd": 800,
          "crm_eligible": true,
          "crm_value_musd": 300
        }
      ]
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_large_exposures_limit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
