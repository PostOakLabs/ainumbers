# Member Margin Call Lifecycle to Client Porting Check

Attests a clearing member's margin call lifecycle against its SLA window; an unmet-SLA call (disputed, escalated, or still-open past the SLA) routes to the client porting check as a contingency path, while a funded within-SLA call ends.

- Page: https://ainumbers.co/chaingraph/chains/chain-member-margin-call-to-porting.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/chain-member-margin-call-to-porting.md

## Workflow chain: Member Margin Call Lifecycle to Client Porting Check

Attests a clearing member's margin call lifecycle against its SLA window; an unmet-SLA call (disputed, escalated, or still-open past the SLA) routes to the client porting check as a contingency path, while a funded within-SLA call ends.

Domain: Treasury Clearing

### Steps

1. art-531-member-margin-call-lifecycle
   suggested_gate_route of end closes the chain; escalate or hold routes to Stage 2's client porting check as a contingency path
2. art-532-client-porting-check
   checks whether the member's client positions and collateral are portable to a backup clearing member given the unmet-SLA margin call; terminal check

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A margin call issued yesterday is already funded. Does the lifecycle attestation show it met the declared SLA?
Run the AINumbers MCP tool `run_chain` with {"chain":"chain-member-margin-call-to-porting"} and read `art-531-member-margin-call-lifecycle.met_within_sla`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/chain-member-margin-call-to-porting.html
