# Audit-Trail Completeness Attestation

Attests that an audit log covering transactions and user activity is complete and gap-free over a caller-declared window, against a caller-declared continuity mechanism: sequence numbers, hash-chain links, or periodic control totals. Enumerates gap position where the mechanism can localize one, reports privileged-action coverage separately from transaction coverage (a trail that logs transactions but not administrator actions fails the 'and user activities' requirement explicitly), checks retention conformance, and reports an undecidable list where the declared mechanism cannot support a position-level verdict (control totals confirm a period is short but cannot localize which event is missing). No log ingestion, no vendor log format parsing - the caller supplies counts and the declared mechanism only. Zero PII: users are role classes and opaque refs, never a username, email, or IP. Region-portable: window, retention requirement, and mechanism are entirely caller-declared inputs, with no country, currency, scheme, or statute hardcoded. Disambiguation: art-237-validate-agent-audit-trail validates the field structure of one IETF AAT agent-to-agent record; cry-05-agent-action-audit-trail-aggregator builds a Merkle root over this suite's own execution receipts. Neither evaluates a window, detects a gap across a population of external log events, or checks privileged-action coverage - that is this node.

- Page: https://ainumbers.co/chaingraph/art-517-audit-trail-completeness.html
- Markdown twin: https://ainumbers.co/chaingraph/art-517-audit-trail-completeness.md
- MCP tool: validate_audit_trail_completeness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- chain_links (unknown, required)
- continuity_mechanism (unknown, required)
- declared_retention_period_days (unknown, required): Duration in days
- gap_candidates (unknown, required)
- observed_event_counts_by_type (unknown, required)
- observed_sequence_numbers (unknown, required)
- periods (unknown, required)
- required_retention_period_days (unknown, required): Duration in days
- sequence_end (unknown, required)
- sequence_start (unknown, required)
- window_end (unknown, required)
- window_start (unknown, required)

## Outputs

- continuity_mechanism (string, optional)
- continuity_verdict (string, optional)
- event_counts_by_type (object, optional)
- gap_count (integer, optional)
- gaps (array, optional)
- known_gap_candidates_reconciled (array, optional)
- privileged_action_coverage (object, optional)
- regulatory_basis (string, optional)
- retention_conformance (object, optional)
- table_version (string, optional)
- undecidable (array, optional)
- window_end (string, optional)
- window_start (string, optional)

## Sample

```json
{
  "window_start": "2026-07-01T00:00:00Z",
  "window_end": "2026-07-01T23:59:59Z",
  "continuity_mechanism": "sequence_number",
  "sequence_start": 1000,
  "sequence_end": 1010,
  "observed_sequence_numbers": [
    1000,
    1001,
    1002,
    1003,
    1004,
    1005,
    1006,
    1007,
    1008,
    1009,
    1010
  ],
  "observed_event_counts_by_type": {
    "transaction": 850,
    "user_activity": 140,
    "privileged_action": 12
  },
  "declared_retention_period_days": 120,
  "required_retention_period_days": 90,
  "gap_candidates": []
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_audit_trail_completeness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
