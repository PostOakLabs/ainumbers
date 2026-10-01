---
name: aml-typology-triage
description: "Score transactions for AML typologies and anomalies, then seal the triage. Use when the task is a regulatory compliance question that needs an evidence trail. Written for the FIU / AML audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "aml-typology-triage"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "8770e0e5aba5"
---

# AML typology triage

Score transactions for AML typologies and anomalies, then seal the triage.

## Prompt

Triage a synthetic alert batch and seal the reasoning trail.

1. Build a synthetic batch of 50 transactions embedding three known typologies (structuring, rapid movement, round-amount pairing).
2. Call score_aml_typologies. Record the typology scores; confirm the three planted typologies outrank the filler.
3. Call detect_transaction_anomalies. Record the anomaly list and the method each was flagged by.
4. Call simulate_app_fraud_graph over the customer-payment graph. Record the fraud clusters found and their centrality scores.
5. Disagreement check: name the transactions the typology scorer and the anomaly detector disagree on; those are your review queue, not noise.
6. build_evidence_pack over the scores, anomalies, and graph digests. Give me the ledger link for the pack.
7. Write the triage note for the investigator: the review queue, the planted-typology recall, the pack link, and the one line that says every score recomputes from the same synthetic inputs.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.
GPU note: the score_aml_typologies tool computes in your browser, so the MCP endpoint returns no execution_hash; export the Policy Mandate artifact the page produces and pass that full artifact to verify_execution_hash as claimed_hash.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
