# Cyber Incident Notification Clock

Starts three parallel regulatory notification-deadline clocks from one hash-anchored cyber-incident determination timestamp: the 36-hour interagency banking-regulator rule (12 CFR 53/225/304), the 4-business-day SEC Form 8-K Item 1.05 notification (weekends-only business-day arithmetic; no federal holiday calendar is applied, a documented scope limit), and the 72-hour NYDFS 23 NYCRR 500.17(a) notice. Each obligation carries its own decision-tree attestation slot (applicable, deadline, completion state, a §22.11-shaped optional exception for an at-risk or missed deadline) and a stable obligation_id ready to be cited by a future Human-Accountability (BANK-SPEC-HA-1) approval record, without embedding a mutable reference inside its own hashed output. A pending SEC Item 1.05 rescission petition (flagged Apr 2026) is carried as an annotation only; it does not alter the computed deadline. Complementary to tools/incident-response-runbook-builder.html. This tool computes deadlines and attestation slots only; it does not itself transmit, file, or submit any regulatory notification, and it is not legal advice.

- Page: https://ainumbers.co/chaingraph/art-428-cyber-incident-clock.html
- Markdown twin: https://ainumbers.co/chaingraph/art-428-cyber-incident-clock.md
- MCP tool: compute_cyber_incident_notification_clock (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- banking_notification_completed_at (unknown, optional)
- determination_at (unknown, optional)
- determination_evidence_hash (unknown, optional)
- evaluated_at (unknown, optional)
- incident_id (unknown, optional)
- is_bank_holding_company (unknown, optional)
- is_national_bank (unknown, optional)
- is_state_member_bank (unknown, optional)
- nydfs_covered_entity (unknown, optional)
- nydfs_notification_completed_at (unknown, optional)
- sec_8k_filed_at (unknown, optional)
- sec_reporting_company (unknown, optional)
- sec_rescission_petition_pending (unknown, optional)

## Outputs

- determination_at (string, optional)
- determination_at_parsed (boolean, optional)
- determination_evidence_hash (string, optional)
- determination_evidence_hash_well_formed (boolean, optional)
- determinations (array, optional)
- evaluated_at (string, optional)
- incident_id (string, optional)
- note (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_cyber_incident_notification_clock` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
