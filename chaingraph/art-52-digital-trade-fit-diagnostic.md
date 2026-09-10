# Digital Trade Corridor Fit Diagnostic

12-question A–F readiness diagnostic for digital trade / electronic trade documents (MLETR). Grades corridor legality, document digitisation, platform connectivity, trade-rule basis (eUCP/URDTT), financing, and AML/TBML controls; routes to the right chain and emits a remediation checklist.

- Page: https://ainumbers.co/chaingraph/art-52-digital-trade-fit-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-52-digital-trade-fit-diagnostic.md
- MCP tool: run_digital_trade_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- annual_trade_docs (unknown, optional)
- api_readiness (unknown, optional)
- counterparty_type (unknown, optional)
- dest_jurisdiction (unknown, optional)
- doc_set_scope (unknown, optional)
- ebl_platform (unknown, optional)
- ebl_usage (unknown, optional)
- finance_mode (unknown, optional)
- origin_jurisdiction (unknown, optional)
- party_screening (unknown, optional)
- rule_basis (unknown, optional)
- tbml_controls (unknown, optional)

## Outputs

- corridor_enforceability_flag (string, optional)
- dim_scores (object, optional)
- note (string, optional)
- overall_grade (string, optional)
- overall_score (integer, optional)
- primary_recommendation (string, optional)
- remediation_checklist (array, optional)
- secondary_recommendations (array, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `run_digital_trade_fit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
