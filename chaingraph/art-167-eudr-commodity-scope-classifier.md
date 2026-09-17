# EUDR Commodity Scope Classifier

Classify an HS code against EUDR Annex I to determine commodity scope (cattle, cocoa, coffee, oil palm, rubber, soya, wood, or out-of-scope), operator/trader role, SME status, DDS filing obligation, and enforcement deadline (large/medium 2026-12-30; micro/SME 2027-06-30). Returns obligations list and geo-exemption eligibility. Terminal node of the eudr-due-diligence-statement-validation chain. Zero network, zero PII. Reg. EU 2023/1115.

- Page: https://ainumbers.co/chaingraph/art-167-eudr-commodity-scope-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-167-eudr-commodity-scope-classifier.md
- MCP tool: classify_eudr_commodity_scope (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- entity (unknown, optional)
- hs_code (unknown, optional)

## Outputs

- commodity (string, optional)
- dds_filing_required (boolean, optional)
- deadline (string, optional)
- due_diligence_required (boolean, optional)
- entity_role (string, optional)
- geo_exemption_eligible (boolean, optional)
- hs4_matched (string, optional)
- in_scope (boolean, optional)
- is_micro (boolean, optional)
- is_sme (boolean, optional)
- obligations (array, optional)

## Sample

```json
{
  "hs_code": "4407",
  "entity": {
    "entity_type": "operator",
    "employee_count": 500,
    "annual_turnover_eur": 80000000
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_eudr_commodity_scope` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
