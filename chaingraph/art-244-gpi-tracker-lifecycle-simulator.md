# SWIFT GPI Tracker Lifecycle Simulator

Validates SWIFT GPI pacs.002 payment status code transitions against the GPI state machine (PDNG, ACSP, ACSP/ACWC, ACCC, RJCT) and checks the Universal Confirmation SLA (ACCC must be sent within 24 hours of ACSP). Detects invalid transitions, transitions from terminal states, and SLA at-risk or breached conditions. For use in agent-driven GPI payment monitoring workflows.

- Page: https://ainumbers.co/chaingraph/art-244-gpi-tracker-lifecycle-simulator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-244-gpi-tracker-lifecycle-simulator.md
- MCP tool: simulate_gpi_tracker_lifecycle (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- amount_usd (number, required): Amount in US dollars
- current_status (unknown, required)
- hours_elapsed (number, required)
- next_status (unknown, required)

## Outputs

- allowed_next_statuses (array, optional)
- amount_usd (integer, optional)
- current_status (string, optional)
- hours_elapsed (integer, optional)
- is_rejected (boolean, optional)
- is_settled (boolean, optional)
- is_terminal (boolean, optional)
- issues (array, optional)
- lifecycle_states (array, optional)
- next_status (string, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- sla_breached (boolean, optional)
- sla_hours_limit (integer, optional)
- sla_note (string, optional)
- stage_description (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- transition_reason (string, optional)
- transition_valid (boolean, optional)

## Sample

```json
{
  "current_status": "ACSP",
  "next_status": "ACCC",
  "hours_elapsed": 12,
  "amount_usd": 50000
}
```

## Verify

Run the sample policy_parameters through MCP tool `simulate_gpi_tracker_lifecycle` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
