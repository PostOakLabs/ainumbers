---
name: frtb-pre-validate
description: "Pre-validate my FRTB IMA expected shortfall before the regulator does. Use when the task is a banking or payment-operations question. Written for the market risk audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "frtb-pre-validate"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "8770e0e5aba5"
---

# FRTB pre-validate

Pre-validate my FRTB IMA expected shortfall before the regulator does.

## Prompt

Run the desk's FRTB expected shortfall through the same arithmetic a reviewer would.

1. Assemble a synthetic trading-position sample for one desk (instruments, sensitivities, liquidity horizons).
2. Call simulate_frtb_es under the IMA expected-shortfall settings. Record the ES figure and the liquidity-horizon mapping used.
3. Run the chain basel-endgame-frtb-capital with run_chain for the capital composition. Record execution_hash.
4. Cross-check: recompute ES at doubled liquidity horizons and quote the delta; this is where most desk models are thin.
5. Record which inputs drove the result: perturb the largest position 10 percent and quote the ES delta.
6. build_session_receipt over the runs; give me the ledger link.
7. Write the pre-validation note for the model-risk team: the ES figure, the horizon sensitivity, the perturbation delta, and the ledger link.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
