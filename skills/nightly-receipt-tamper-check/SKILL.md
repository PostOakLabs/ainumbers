---
name: nightly-receipt-tamper-check
description: "Every night, re-verify every receipt in my export and tell me exactly what changed, if anything. Use when you want a short routine task run against the AINumbers suite. Written for the OpenClaw / AutoClaw users audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "nightly-receipt-tamper-check"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "1e8cd3fdd287"
---

# Nightly receipt tamper check

Every night, re-verify every receipt in my export and tell me exactly what changed, if anything.

## Prompt

Set up the nightly habit: re-verify every receipt in your export and surface any drift.

1. Export your receipts from the ledger page to receipts.json (id, chain, step, execution_hash, input_payload per line).
2. For each receipt, call find_chain to resolve the node and tool that produced it.
3. Re-run each step with run_chain using the recorded input_payload. Record today's execution_hash next to the stored one.
4. Call verify_execution_hash on each pair and classify: MATCH, MISMATCH, or UNRUNNABLE (input no longer accepted).
5. For every MISMATCH, diff the stored input_payload against today's accepted schema and quote the differing field.
6. build_session_receipt over the whole sweep. Give me the ledger link.
7. Write the nightly note for your own channel: counts per class, any MISMATCH with its diff, and the ledger link. Save the note where your cron already posts, so tomorrow's run compares against today's counts. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
