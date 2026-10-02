---
name: two-hosts-one-hash
description: "Run the same tool from two different agents and prove they agree on the execution hash. Use when you want a short routine task run against the AINumbers suite. Written for the multi-agent teams audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "two-hosts-one-hash"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "8770e0e5aba5"
---

# Two hosts return one hash

Run the same tool from two different agents and prove they agree on the execution hash.

## Prompt

Prove that two independent agent hosts get byte-identical results from the same tool.

1. Pick one node tool (any page in /chaingraph/ works). Call find_tool to confirm its exact mcp_name and inputSchema.
2. Fix one synthetic input once, write it down, and do not change it for the rest of the run.
3. Host A: run the tool through the hosted MCP worker with that input. Record execution_hash.
4. Host B: a different agent (Claude, OpenClaw, Goose, anything that speaks MCP) runs the same tool with the same input through the same worker. Record execution_hash.
5. Compare the two hashes character by character. If they differ, the input was not identical: diff both recorded inputs and re-run until you have either two equal hashes or a proven input difference.
6. Call verify_execution_hash yourself over {policy_parameters, output_payload} to confirm the hash is the deterministic function both hosts should compute.
7. build_session_receipt over the comparison and give me the ledger link.
8. Write the note for your team's runbook: which hosts agreed, the hash, and the ledger link, so the next person repeats this with their own agents. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
