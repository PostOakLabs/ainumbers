# EMIR Lifecycle Event Validator

Validate an EMIR Refit action type against the prior reported state of the UTI: New/Position are legal on a previously unreported trade; Modify/Correct/Valuation/Terminate/Error require a prior open trade; Revive/Correct/Error apply to terminated trades. Catches the most common Refit rejection cause before Trade Repository submission. Feeds readiness diagnostic (art-158).

- Page: https://ainumbers.co/chaingraph/art-157-emir-lifecycle-event-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-157-emir-lifecycle-event-validator.md
- MCP tool: validate_emir_lifecycle_event (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "action_type": "New",
  "prior_state": "none"
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_emir_lifecycle_event` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
