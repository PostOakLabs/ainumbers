---
name: pqc-migration-plan
description: "Find where I am exposed to harvest-now-decrypt-later and get the migration plan. Use when the task is a regulatory compliance question that needs an evidence trail. Written for the CISOs audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "pqc-migration-plan"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "8770e0e5aba5"
---

# PQC migration plan

Find where I am exposed to harvest-now-decrypt-later and get the migration plan.

## Prompt

Turn post-quantum anxiety into a dated, receipted plan.

1. Call run_pqc_timeline_fit with your synthetic crypto inventory (TLS endpoints, certificate lifetimes, data sensitivity classes). Record the fit verdict and the dates it assumes.
2. Call plan_tls_pki_migration for the TLS/PKI estate. Record the migration order, the hybrid periods, and the cutover dates.
3. Call classify_blockchain_quantum_risk for any chain exposure in the inventory. Record which assets are harvest-now-decrypt-later sensitive versus signature-only exposed.
4. Name the data with the longest secrecy requirement; that is what HNDL actually threatens. Quote its decrypt-by horizon versus the migration date.
5. build_session_receipt over the three runs; give me the ledger link.
6. Write the plan for the security steering group: the three phases, the HNDL priority list, the ledger link, and the assumption that the timeline tools take standard dates as inputs, so the plan re-runs when NIST dates move.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
