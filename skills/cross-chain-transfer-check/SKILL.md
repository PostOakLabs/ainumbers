---
name: cross-chain-transfer-check
description: "Validate a CCTP v2 transfer and classify L2 finality before you rely on it. Use when the task is a crypto-asset or on-chain question. Written for the bridges / treasuries audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "cross-chain-transfer-check"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "1e8cd3fdd287"
---

# Cross-chain transfer check

Validate a CCTP v2 transfer and classify L2 finality before you rely on it.

## Prompt

Check a bridged transfer before you treat it as settled.

1. Take the synthetic CCTP v2 message attestation for the transfer (nonce, amount, source/destination domain).
2. Call validate_cctp_v2_transfer. Record the attestation verdict and the mint/destroy pair it implies.
3. Call check_linea_l2_finality_window for the source chain state. Record whether the finality window has fully elapsed and what remains exposed before it does.
4. Run the chain arc-dvp-settlement with run_chain to place the transfer in a settlement context. Record execution_hash.
5. Failure test: re-validate with the fast-transfer flag set but the finality window not elapsed; confirm the tool flags the gap. Quote the flag.
6. build_session_receipt over the checks; give me the ledger link.
7. Write the treasury note: transfer id, attestation verdict, finality status, the exposure window in minutes, and the ledger link.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
