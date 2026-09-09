# EMIR Trade-Repository Reconciliation Adjudicator

Under EMIR Refit the trade repository (TR) runs the inter-TR reconciliation and returns a daily ISO 20022 response naming matched/unreconciled fields per UTI - a firm holds that TR response plus its own submitted state, never both counterparties' raw extracts. This node independently reproduces the reconciliation verdict from the TR response + the firm's submitted state, under a policy-supplied per-cycle field/tolerance/suppression table, and emits a stable per-break key (uti::field_name) so consecutive cycles diff cleanly. Disagreement with the TR's own stated match status is a first-class output, never an error. Lifecycle events (amendment, compression, termination) are ordinary inputs. Not art-156-emir-counterparty-pairing-reconciler, which compares two counterparties' own extracts directly - a premise EMIR Refit's TR-mediated reconciliation model replaced. Feeds art-483-emir-break-ageing.

- Page: https://ainumbers.co/chaingraph/art-482-emir-recon-adjudicator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-482-emir-recon-adjudicator.md
- MCP tool: adjudicate_emir_reconciliation (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- firm_state (unknown, required)
- policy (unknown, required)
- tr_response (unknown, required)

## Outputs

- as_of_date (string, optional)
- break_count (integer, optional)
- break_set (array, optional)
- field_tolerance_table_version (string, optional)
- note (string, optional)
- tr_disputed_count (integer, optional)
- tr_matched_count (integer, optional)
- trade_count (integer, optional)
- trades (array, optional)
- verdict_disagrees_with_tr_count (integer, optional)

## Sample

```json
{
  "tr_response": {
    "as_of_date": "2026-07-27",
    "trades": [
      {
        "uti": "UTI0001",
        "tr_match_status": "MATCHED",
        "lifecycle_event": "NEW",
        "tr_reported": {
          "notional_amount": 1000000,
          "price": 101.25,
          "effective_date": "2026-01-15",
          "maturity_date": "2031-01-15",
          "settlement_currency": "USD",
          "delta": 0.42
        }
      }
    ]
  },
  "firm_state": {
    "trades": [
      {
        "uti": "UTI0001",
        "submitted": {
          "notional_amount": 1000000,
          "price": 101.25,
          "effective_date": "2026-01-15",
          "maturity_date": "2031-01-15",
          "settlement_currency": "US DOLLAR",
          "delta": 0.55
        }
      }
    ]
  },
  "policy": {
    "field_tolerance_table_version": "ESMA74-362-2683-PHASE2-2026-04-27",
    "fields": [
      {
        "field_name": "notional_amount",
        "type": "numeric",
        "numeric_tolerance": 10
      },
      {
        "field_name": "price",
        "type": "numeric",
        "numeric_tolerance": 0.01
      },
      {
        "field_name": "effective_date",
        "type": "date",
        "date_tolerance_days": 0
      },
      {
        "field_name": "maturity_date",
        "type": "date",
        "date_tolerance_days": 0
      },
      {
        "field_name": "settlement_currency",
        "type": "enum",
        "enum_equivalence": {
          "USD": "USD",
          "US DOLLAR": "USD"
        }
      },
      {
        "field_name": "delta",
        "type": "numeric",
        "numeric_tolerance": 0.05
      }
    ],
    "suppression_list": [
      "delta"
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `adjudicate_emir_reconciliation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
