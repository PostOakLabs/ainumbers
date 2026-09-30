---
name: liquidity-stress-morning
description: "Run LCR/NSFR stress, then Basel RWA scenarios, then VaR, and bind it all in one session receipt. Use when the task is a banking or payment-operations question. Written for the treasury / risk audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "liquidity-stress-morning"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "647bdbeed4d9"
---

# Liquidity stress morning

Run LCR/NSFR stress, then Basel RWA scenarios, then VaR, and bind it all in one session receipt.

## Prompt

One morning risk run, every number re-verifiable.

1. Call run_liquidity_stress_test on a synthetic balance sheet under a combined LCR/NSFR stress (outflow rates up, inflows haircuts). Record the survival horizon and the binding constraint.
2. Call compute_stress_test_scenarios for the scenario set. Record which scenario is worst and by how much.
3. Call compute_rwa_scenarios across the Basel RWA approaches for the same book. Record the RWA range and the approach that binds.
4. Call compute_portfolio_var for the trading book at 99/1-day, then under the worst stress path. Record both numbers.
5. Consistency check: state in one sentence whether the VaR book and the RWA book overlap, and where the models disagree.
6. build_session_receipt over the four runs. Give me the ledger link.
7. Write the morning note for the ALCO: the binding constraint, the worst scenario, the RWA and VaR numbers, and the ledger link, so any attendee recomputes the run from the same inputs without your help.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.
GPU note: the compute_portfolio_var tool computes in your browser, so the MCP endpoint returns no execution_hash; export the Policy Mandate artifact the page produces and pass that full artifact to verify_execution_hash as claimed_hash.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
