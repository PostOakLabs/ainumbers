---
name: regulatory-reporting-cycle
description: "Explain the period variance, attest the daily reconciliation, map the Schedule RC-R capital, and seal each receipt. Use when the task is a banking or payment-operations question. Written for the bank regulatory reporting audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "regulatory-reporting-cycle"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "1e1ce005ada9"
---

# A regulatory reporting cycle from variance to capital

Explain the period variance, attest the daily reconciliation, map the Schedule RC-R capital, and seal each receipt.

## Prompt

Run one regulatory reporting cycle and leave receipts a reviewer can re-check.

1. Compare this period's regulatory report instance with the prior period using explain_regrpt_variance. Report absolute and relative movement per line item against the declared materiality threshold, and name the lines that moved most.
2. Attest the daily reconciliation duty with attest_daily_reconciliation over a caller-declared population. The attestation states the duty was discharged over that population; the match computation itself stays outside it.
3. Map the FFIEC 031 Schedule RC-R components with map_call_report_schedule_rcr from declared CET1, additional Tier 1, and Tier 2 capital, total risk-weighted assets, and total leverage exposure. Return the mapped ratios. The sibling tool map_call_report_schedule_rc maps the Schedule RC balance-sheet lines the same way if the cycle needs them.
4. Seal the run with build_session_receipt over the hashes from steps 1 to 3, then call verify_execution_hash (send each receipt's execution_hash as claimed_hash) so every number re-verifies from the receipt alone.
Deliverable: the variance table, the attestation receipt, the capital mapping, the ledger link, and one sentence on what the receipts prove (the declared inputs were processed as given) and what they do not prove (no filing submission, no capital adequacy conclusion).
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
