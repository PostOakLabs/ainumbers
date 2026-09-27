---
name: certified-payroll-recompute
description: "Recompute certified payroll against prevailing wage and sign the receipt. Use when the task is a regulatory compliance question that needs an evidence trail. Written for the contractors audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "certified-payroll-recompute"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "1e8cd3fdd287"
---

# Certified payroll recompute

Recompute certified payroll against prevailing wage and sign the receipt.

## Prompt

Recompute a certified payroll from the raw timesheets so the certification has a hash behind it.

1. Prepare a synthetic weekly payroll: workers, classifications, hours per day, fringe payments.
2. Call recompute_certified_payroll_pwa with the synthetic data and the applicable prevailing-wage determinations. Record the computed wage rates, the underpayments flagged, and the per-worker totals.
3. Confirm the recomputation matches what was certified for the week; quote any line that differs with both numbers.
4. Call verify_execution_hash (send the artifact or its hash as claimed_hash) over the recompute output. Record the hash.
5. Negative test: change one worker's hours by one, re-run, confirm both the totals and the hash change. Revert.
6. build_session_receipt over the runs; give me the ledger link.
7. Write the note for the compliance officer: the week covered, the flagged lines, the hash, and the ledger link. The certification now points at a receipt instead of a spreadsheet.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
