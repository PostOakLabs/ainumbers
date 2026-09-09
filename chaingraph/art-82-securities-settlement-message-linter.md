# Securities-Settlement Message Linter (ISO 20022 sese/semt)

Validates ISO 20022 securities-settlement messages (sese.023 instruction, sese.024 status advice, semt.044 account statement) for schema conformance, mandatory-field presence, ISIN (ISO 6166), and BIC (ISO 9362) validity. Scoped strictly to the sese/semt securities family - NOT the payments pacs/camt work in cbpr-cutover/rca-03.

- Page: https://ainumbers.co/chaingraph/art-82-securities-settlement-message-linter.html
- Markdown twin: https://ainumbers.co/chaingraph/art-82-securities-settlement-message-linter.md
- MCP tool: lint_securities_settlement_message (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- messages (unknown, optional)

## Outputs

- fail_count (integer, optional)
- in_scope_message_types (array, optional)
- note (string, optional)
- out_of_scope_count (integer, optional)
- pass_count (integer, optional)
- pass_rate (integer, optional)
- reference (object, optional)
- results (array, optional)
- scope_guard_note (string, optional)
- total_issues (integer, optional)
- total_messages (integer, optional)
- warn_count (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_securities_settlement_message` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
