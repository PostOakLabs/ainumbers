# Public-Money Settlement Receipt

Turns one caller-transcribed payment of public money into settlement evidence an audit authority can check with no access to the operator's database: a single-settlement verdict confirming the obligation was discharged exactly once across all declared rail legs, a ministry/agency attribution verdict against the caller's own revenue-code table, an at-par verdict comparing amount credited to amount collected with every fee itemised and never netted, a finality class echoed per rail from the caller's own declared basis, and a structural exceptions list. Portable to any government payment platform, any treasury-single-account regime, any supreme audit institution - not built to any one vendor's data model. No rail connector, no switch, no live payment observation: the event is transcribed by the caller, exactly as art-497 transcribes a validator change. Does not classify finality itself - art-492-classify-settlement-finality and art-59-settlement-asset-finality-classifier already do that; a chain composes them upstream of this node. Zero PII: payer is a class plus an opaque reference, never a name, account number, or address. compliance_control.

- Page: https://ainumbers.co/chaingraph/art-513-public-money-settlement-receipt.html
- Markdown twin: https://ainumbers.co/chaingraph/art-513-public-money-settlement-receipt.md
- MCP tool: build_public_money_settlement_receipt (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- amount_collected (unknown, required)
- amount_credited (unknown, required)
- as_of (unknown, required)
- currency (unknown, required)
- declared_revenue_code (unknown, required)
- fees (array, required)
- payer_class (unknown, required)
- payment_ref (unknown, required)
- rails (array, required)
- reconciliation_window (unknown, required)
- revenue_code_table (array, required)
- treasury_account_credited (unknown, required)

## Outputs

- amount_collected (integer, optional)
- amount_credited (number, optional)
- as_of (string, optional)
- at_par (boolean, optional)
- at_par_discrepancy (integer, optional)
- attributed_ministry (string, optional)
- attribution_matched (boolean, optional)
- currency (string, optional)
- declared_revenue_code (string, optional)
- exceptions (array, optional)
- expected_credit (number, optional)
- fees (array, optional)
- payer_class (string, optional)
- payer_class_valid (boolean, optional)
- payment_ref (string, optional)
- rails (array, optional)
- reconciled (boolean, optional)
- reconciliation_window (string, optional)
- single_settlement_status (string, optional)
- total_fees_itemised (number, optional)
- treasury_account_credited (string, optional)

## Sample

```json
{
  "payment_ref": "PMT-2026-0001-OPAQUE",
  "payer_class": "business",
  "declared_revenue_code": "REV-1200-CUSTOMS",
  "revenue_code_table": [
    {
      "code": "REV-1100-INCOME",
      "ministry": "Ministry of Finance"
    },
    {
      "code": "REV-1200-CUSTOMS",
      "ministry": "Ministry of Revenue and Customs"
    },
    {
      "code": "REV-1300-LICENCE",
      "ministry": "Ministry of Commerce"
    }
  ],
  "treasury_account_credited": "TSA-MAIN-001",
  "currency": "USD",
  "amount_collected": 1000,
  "fees": [
    {
      "type": "acquirer_fee",
      "amount": 2.5
    }
  ],
  "amount_credited": 997.5,
  "rails": [
    {
      "rail": "rtgs",
      "settlement_ref": "RTGS-REF-88431",
      "declared_finality_basis": "central_bank_settlement_finality_statute",
      "settled": true
    }
  ],
  "reconciliation_window": "2026-07-01/2026-07-31",
  "as_of": "2026-07-31T23:59:59Z"
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_public_money_settlement_receipt` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
