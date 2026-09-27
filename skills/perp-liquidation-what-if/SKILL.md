---
name: perp-liquidation-what-if
description: "Find where my perp gets liquidated across venues and see the full lifecycle scenario. Use when the task is a crypto-asset or on-chain question. Written for the DeFi traders audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "perp-liquidation-what-if"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "647bdbeed4d9"
---

# Perp liquidation what-if

Find where my perp gets liquidated across venues and see the full lifecycle scenario.

## Prompt

Know your liquidation point from a deterministic model, not a dashboard screenshot.

1. Write down the position: notional, entry, leverage, funding, margin. Synthetic numbers only.
2. Call compute_perp_margin for the current state. Record the margin ratio and the maintenance threshold.
3. Call model_perp_position across a price ladder (your entry down 5/10/20/50 percent, and up). Record the liquidation price the model returns and the funding drag per rung.
4. Re-run the worst rung with funding doubled. Note how much the liquidation price moves; that sensitivity is your model risk.
5. Call verify_execution_hash (send the artifact or its hash as claimed_hash) on the worst-run output to confirm the hash is the deterministic function of its inputs. Record it.
6. build_session_receipt over the ladder runs; give me the ledger link.
7. Write the note for yourself: the liquidation price, the funding sensitivity, and the ledger link, so the scenario is reproducible after the position is long gone.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
