---
name: is-my-agent-payments-ready
description: "Grade my stack for agentic payments and MCP, then fix the top gap and re-grade. Use when the task is an agentic commerce or payments question. Written for the CTOs audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "is-my-agent-payments-ready"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "8770e0e5aba5"
---

# Is my agent payments-ready?

Grade my stack for agentic payments and MCP, then fix the top gap and re-grade.

## Prompt

Grade your agentic-payments and MCP surface, fix the worst gap, prove the fix.

1. Call run_agentic_readiness_diagnostic against your deployment's public URL. Record the overall grade and the ranked gap list.
2. Call score_mcp_server_readiness on your MCP endpoint. Record the score and the failing dimensions.
3. Call lint_mcp_server_conformance on the same endpoint. Record every conformance violation with its rule id.
4. Pick the single highest-impact gap across the three reports. State what fixing it requires and who owns it.
5. Fix that one thing (or have the owner fix it). Change nothing else.
6. Re-run all three tools. Quote the before/after numbers for the one gap; leave the others untouched.
7. Give me the ledger link for the re-run session (build_session_receipt over the two diagnostic runs).
8. Write the note for your engineering channel: the three grades, the one fix, the delta, and the ledger link so anyone re-verifies the numbers without asking you.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
