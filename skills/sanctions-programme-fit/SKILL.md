---
name: sanctions-programme-fit
description: "Scope my sanctions programme, aggregate 50% ownership, check list coverage, calibrate fuzzy matching. Use when the task is a regulatory compliance question that needs an evidence trail. Written for the compliance audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "sanctions-programme-fit"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "8770e0e5aba5"
---

# Sanctions programme fit

Scope my sanctions programme, aggregate 50% ownership, check list coverage, calibrate fuzzy matching.

## Prompt

Test the sanctions programme's mechanics against cases you control.

1. Call run_sanctions_screening_fit with your synthetic screening configuration and sample flow. Record the coverage verdict per list.
2. Call aggregate_ownership_50pct on a synthetic ownership graph containing one chain that lands exactly at 50 percent and one at 49. Confirm the tool classifies them differently and quote both paths.
3. Fuzzy-match calibration: screen a synthetic name with transposed letters and one with an honorific prefix. Record whether each hit matches and at what threshold.
4. Call classify_eccn_dual_use on one synthetic item to confirm the export-control lane is wired. Record the classification.
5. Run the chain sanctions-screening-demo (or the sanctions chain your inventory names) with run_chain. Record execution_hash.
6. build_session_receipt over the runs; give me the ledger link.
7. Write the note for the head of compliance: the 50% results, the fuzzy thresholds you set, the chain hash, and the ledger link. The calibration cases become next quarter's regression test.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
