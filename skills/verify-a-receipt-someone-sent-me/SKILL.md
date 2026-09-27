---
name: verify-a-receipt-someone-sent-me
description: "I was sent a receipt link. Check it is real and see exactly what ran, without trusting the sender. Use when you want a short routine task run against the AINumbers suite. Written for the anyone audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "verify-a-receipt-someone-sent-me"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "1e8cd3fdd287"
---

# Verify a receipt someone sent me

I was sent a receipt link. Check it is real and see exactly what ran, without trusting the sender.

## Prompt

You were handed a receipt link. Check it from primary sources before you rely on it.

1. Open the receipt link. Copy its execution_hash and the named chain and step.
2. Call find_chain for the chain named in the receipt; note the node and tool that produced the step.
3. Re-run the same step yourself with run_chain using the receipt's recorded input_payload (or the tool's declared synthetic sample if inputs are not in the receipt).
4. Call verify_execution_hash over your run's {policy_parameters, output_payload} and compare with the receipt's execution_hash, character by character.
5. State which fields would have to change for the hash to differ, and which fields are not covered by the hash.
6. build_session_receipt over your re-check and give me the ledger link for it.
7. Write a three-line verdict for whoever sent you the link: reproduced / not reproduced, what matched, and the ledger link. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
