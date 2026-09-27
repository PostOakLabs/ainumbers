---
name: agent-audit-trail-for-the-examiner
description: "Aggregate every receipt from today’s agent session into one audit object a regulator can re-verify. Use when the task is a governance, model-risk, or control question. Written for the audit / AI Act Art. 12 audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "agent-audit-trail-for-the-examiner"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "647bdbeed4d9"
---

# Agent audit trail for the examiner

Aggregate every receipt from today’s agent session into one audit object a regulator can re-verify.

## Prompt

One audit object for a day of agent activity, framed the way an examiner asks.

1. Collect today's execution receipts (ids and hashes) from your agent sessions. Synthetic sessions are fine; the mechanics are what you are proving.
2. Call aggregate_execution_receipts over the set. Record the aggregate digest and any receipt it could not include, with the reason.
3. Call build_session_receipt over the aggregate. This is the Art. 12-style log entry: what ran, when, under which hash.
4. Call compose_ap2_prompt to render the regulator-framed summary of the aggregate. Record the prompt text it returns.
5. Completeness test: remove one receipt id from the set, re-aggregate, confirm the digest changes. Quote both digests; that sensitivity is what makes the aggregate meaningful.
6. anchor_stamp the aggregate digest on OpenTimestamps.
7. Give me the ledger link and the OTS receipt.
8. Write the examiner note: session coverage window, receipt count, the aggregate digest, both receipts, and the one line stating the log recomputes from the receipts, not from your records.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
