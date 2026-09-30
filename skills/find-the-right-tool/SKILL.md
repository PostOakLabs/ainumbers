---
name: find-the-right-tool
description: "I need to check X. Find the tool, run the sample once, and give me a link that reproduces it. Use when you want a short routine task run against the AINumbers suite. Written for the first-timers audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "find-the-right-tool"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "647bdbeed4d9"
---

# Find the right tool

I need to check X. Find the tool, run the sample once, and give me a link that reproduces it.

## Prompt

Find the right tool for a check you have in mind, prove it runs, and leave a reproducible link.

1. State the check you want in one sentence (for example: does this reserve attestation add up).
2. Call find_tool with that sentence. List the top three candidate tools with their one-line descriptions.
3. Pick one candidate. Read its declared inputSchema and confirm the fields make sense for your check; if none fit, take the next candidate.
4. Run the tool once with its synthetic sample inputs via the worker. Record the verdict and the execution_hash.
5. Call find_chain to see whether the tool belongs to a longer chain; note the chain name if so.
6. Call build_workflow_links for the node. Give me the deep link that re-opens the node page with the same inputs.
7. Write a note for a colleague who has never used the site: what you wanted checked, which tool you found, the verdict, and the deep link. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
