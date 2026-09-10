# eBAM Account Message Flow Validation

Validates the CGI-MP eBAM 2023 account message state machine across acmt.007 (opening request), acmt.010 (opening confirmation), acmt.011 (closing request), acmt.017 (modification request), and acmt.019 (modification confirmation) message types. Detects orphan messages (confirmation without matching request). Determines final acmt_state (OPENING_CONFIRMED / CLOSURE_CONFIRMED / MODIFICATION_CONFIRMED / PENDING / INVALID). ZERO PII: account_reference_id is a business identifier, not personal data.

- Page: https://ainumbers.co/chaingraph/art-262-validate-ebam-acmt-flow.html
- Markdown twin: https://ainumbers.co/chaingraph/art-262-validate-ebam-acmt-flow.md
- MCP tool: validate_ebam_acmt_flow (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- acmt_messages (array, required)
- strict_order (boolean, required)

## Outputs

- ack_count (integer, optional)
- acmt_state (string, optional)
- error_count (integer, optional)
- is_valid (boolean, optional)
- message_sequence (array, optional)
- not_legal_advice (string, optional)
- orphan_count (integer, optional)
- orphan_requests (array, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- report_count (integer, optional)
- request_count (integer, optional)
- table_source (string, optional)
- table_version (string, optional)
- total_messages (integer, optional)
- validation_errors (array, optional)
- validation_warnings (array, optional)
- warning_count (integer, optional)

## Sample

```json
{
  "strict_order": true,
  "acmt_messages": [
    {
      "message_type": "acmt.007",
      "message_id": "MSG-001",
      "account_id": "ACC-ALPHA-001"
    },
    {
      "message_type": "acmt.010",
      "message_id": "MSG-002",
      "account_id": "ACC-ALPHA-001",
      "ref_message_id": "MSG-001"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_ebam_acmt_flow` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
