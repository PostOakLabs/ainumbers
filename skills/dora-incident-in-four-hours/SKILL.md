---
name: dora-incident-in-four-hours
description: "Classify this incident under DORA, simulate the ICT cascade, produce the escalation record. Use when the task is a regulatory compliance question that needs an evidence trail. Written for the ops resilience audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "dora-incident-in-four-hours"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "647bdbeed4d9"
---

# DORA incident in four hours

Classify this incident under DORA, simulate the ICT cascade, produce the escalation record.

## Prompt

The first four hours of a DORA incident, with every classification step receipted.

1. Write the incident facts as known at hour zero (system, impact, detection time). Facts only; no cause speculation.
2. Call classify_dora_incident. Record the classification and the reporting clocks it starts, with their deadlines.
3. Call simulate_ict_cascade from the affected service. Record the downstream services hit and the order they fall over.
4. Run the chain dora-escalation-demo with run_chain for the composed escalation verdict. Record execution_hash.
5. Re-run the classification with detection time shifted by one hour; quote how the deadlines move. That sensitivity is what you communicate to the crisis team.
6. build_session_receipt over the classification and cascade; anchor the receipt root with anchor_stamp.
7. Give me the ledger link and the OTS receipt.
8. Write the escalation record for the incident channel: classification, clocks, cascade list, both receipts, and the one line stating which facts are confirmed versus assumed.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.
GPU note: the simulate_ict_cascade tool computes in your browser, so the MCP endpoint returns no execution_hash; export the Policy Mandate artifact the page produces and pass that full artifact to verify_execution_hash as claimed_hash.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
