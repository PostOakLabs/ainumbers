# Retail Installment Contract TILA Disclosure Checker

Ties declared retail-installment-contract Amount Financed, Finance Charge, and Total of Payments (12 CFR 1026.18) against a REUSED amortization schedule - compose by feeding build_amortization_schedule's (art-332) output_payload straight in, or by reference via its totals and schedule_digest. Does not amortize itself. Also records a dealer-participation/markup declaration as an asserted, receipt-bound fair-lending adjacency note - no discrimination determination is computed.

- Page: https://ainumbers.co/chaingraph/art-404-check-retail-installment-disclosures.html
- Markdown twin: https://ainumbers.co/chaingraph/art-404-check-retail-installment-disclosures.md
- MCP tool: check_retail_installment_disclosures (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- inputs (unknown, optional)

## Outputs

- amortization_provenance (object, optional)
- amount_financed (integer, optional)
- compliant (boolean, optional)
- dealer_participation (object, optional)
- disambiguation (string, optional)
- finance_charge (number, optional)
- regulatory_basis (string, optional)
- tie_outs (array, optional)
- tolerance_cents (integer, optional)
- total_of_payments (number, optional)

## Sample

```json
{
  "inputs": {
    "cash_price": 21500,
    "downpayment": 1500,
    "other_amounts_financed": 0,
    "prepaid_finance_charge": 0,
    "amortization_schedule": {
      "totals": {
        "total_interest": 3479.43,
        "total_principal": 20000,
        "num_payments": 60,
        "ending_balance": 0
      },
      "schedule_digest": "sha256:cd726c8717cdc5b1dde830101a5a7fb29f10840048b8cb85d5d834837c493f3d",
      "source_tool_id": "art-332-build-amortization-schedule"
    },
    "disclosed_amount_financed": 20000,
    "disclosed_finance_charge": 3479.43,
    "disclosed_total_of_payments": 23479.43,
    "tolerance_cents": 500,
    "dealer_participation": {
      "markup_pct": 1.5,
      "dealer_reserve_disclosed": true,
      "declaration_note": "Dealer participation disclosed per contract Sec 4."
    }
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_retail_installment_disclosures` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
