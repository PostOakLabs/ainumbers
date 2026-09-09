# ISO 20022 camt.053 Statement Reconciliation

Classifies ISO 20022 camt.053 BkTxCd entries by Domain, Family, and SubFamily per the CGI-MP camt.053 Usage Guide v5.0 and the ISO 20022 ExternalBankTransactionCode1Code registry 2023-03. Validates the OPBD + sum(movements) = CLBD balance equation. Scores structured-remittance match rate. Emits reconciliation_status (CLEAN / PARTIAL_MATCH / LOW_MATCH_RATE / FAILED_BALANCE), match_rate_pct, and domain_buckets[]. Used in corporate TMS straight-through reconciliation. ZERO PII: no account-holder names or identifiers enter this kernel.

- Page: https://ainumbers.co/chaingraph/art-258-parse-camt053-reconciliation.html
- Markdown twin: https://ainumbers.co/chaingraph/art-258-parse-camt053-reconciliation.md
- MCP tool: parse_camt053_reconciliation (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- closing_balance (unknown, required)
- day_count_convention (unknown, required)
- opening_balance (unknown, required)
- transactions (array, required)

## Outputs

- balance_equation_passes (boolean, optional)
- bucket_amounts (object, optional)
- calculated_closing (integer, optional)
- closing_balance (integer, optional)
- credit_sum (integer, optional)
- day_count_convention (string, optional)
- debit_sum (integer, optional)
- match_rate_pct (integer, optional)
- not_legal_advice (string, optional)
- opening_balance (integer, optional)
- pii_note (string, optional)
- reconciliation_status (string, optional)
- regulatory_basis (string, optional)
- structured_count (integer, optional)
- table_source (string, optional)
- table_version (string, optional)
- total_transactions (integer, optional)
- tx_counts_by_bucket (object, optional)
- unstructured_count (integer, optional)
- variance (integer, optional)

## Sample

```json
{
  "opening_balance": 10000,
  "closing_balance": 10500,
  "day_count_convention": "ACT/360",
  "transactions": [
    {
      "amount": 2000,
      "credit_debit_indicator": "CRDT",
      "bk_tx_cd": {
        "domain": "PMNT",
        "family": "RCDT"
      },
      "remittance_info": {
        "structured": true,
        "end_to_end_id": "E2E-001"
      }
    },
    {
      "amount": 1500,
      "credit_debit_indicator": "DBIT",
      "bk_tx_cd": {
        "domain": "PMNT",
        "family": "ICDT"
      },
      "remittance_info": {
        "structured": true,
        "end_to_end_id": "E2E-002"
      }
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `parse_camt053_reconciliation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
