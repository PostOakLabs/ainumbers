# Agent Audit Trail Conformance Validator (IETF AAT)

Validates agent audit trail records against IETF draft-sharif-agent-audit-trail-00 (AAT, expires Sept 2026). Checks required fields (agent_identity, action_class, outcome, trust_level, timestamp), sha256_prev_record chain-link format (/^[0-9a-f]{64}$/ or empty for first record), ECDSA signature presence, and enum conformance for action_class / outcome / trust_level. Returns conformance_result: CONFORMANT | PARTIAL | NON_CONFORMANT | EMPTY_INPUT with aat_completeness_score and validation_errors. Disambiguates from the RFC 9421 HTTP message signature nodes (art-129..132): those validate HTTP message signatures; this node validates agent-to-agent audit trail records per the IETF AAT draft.

- Page: https://ainumbers.co/chaingraph/art-237-validate-agent-audit-trail.html
- Markdown twin: https://ainumbers.co/chaingraph/art-237-validate-agent-audit-trail.md
- MCP tool: validate_agent_audit_trail (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- action_class (unknown, required)
- action_detail (unknown, required)
- agent_identity (unknown, required)
- ecdsa_present (boolean, required)
- outcome (unknown, required)
- record_id (unknown, required)
- sha256_prev_record (unknown, required)
- trust_level (unknown, required)

## Outputs

- aat_completeness_score (integer, optional)
- aat_required_fields_present (boolean, optional)
- action_class (string, optional)
- action_detail (string, optional)
- agent_identity (string, optional)
- alignment_note (string, optional)
- chain_position (string, optional)
- conformance_result (string, optional)
- ecdsa_present (boolean, optional)
- outcome (string, optional)
- record_id (string, optional)
- regulatory_basis (string, optional)
- sha256_chain_format_valid (boolean, optional)
- sha256_prev_record (string, optional)
- table_version (string, optional)
- trust_level (string, optional)
- validation_errors (array, optional)
- validation_warnings (array, optional)

## Sample

```json
{
  "agent_identity": "did:web:agent.example.com#key-1",
  "action_class": "EXECUTE",
  "outcome": "SUCCESS",
  "trust_level": "HIGH",
  "sha256_prev_record": "aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344",
  "ecdsa_present": true,
  "record_id": "rec-001"
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_agent_audit_trail` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
