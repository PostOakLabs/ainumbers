# Digital Trade Rules Compliance Checker

Machine-checks a digital trade presentation (digital LC, collection, or open-account transaction) against the ICC digital rulebooks: eUCP v2.1, eURC v1.1, URDTT v1.0. Produces a discrepancy list with article citations, severity ratings, and remediation actions.

- Page: https://ainumbers.co/chaingraph/art-54-digital-trade-rules-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-54-digital-trade-rules-checker.md
- MCP tool: check_digital_trade_rules (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- electronic_address_provided (unknown, optional)
- format_specified (unknown, optional)
- lc_terms (unknown, optional)
- presentation (unknown, optional)
- rule_set (unknown, optional)

## Outputs

- amount_check (string, optional)
- discrepancies (array, optional)
- expiry_check (string, optional)
- note (string, optional)
- presentation_summary (object, optional)
- verdict (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `check_digital_trade_rules` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
