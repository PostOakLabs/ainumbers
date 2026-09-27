---
name: seal-my-agent-log
description: "Take my agent gateway’s action log and seal it into a bundle anyone can verify offline. Use when you want a short routine task run against the AINumbers suite. Written for the agent-ops audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "seal-my-agent-log"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "647bdbeed4d9"
---

# Seal my agent log

Take my agent gateway’s action log and seal it into a bundle anyone can verify offline.

## Prompt

Turn a raw agent gateway action log into a sealed, offline-verifiable bundle.

1. Export the gateway's action log for the window you care about (timestamp, actor, tool, input digest, output digest per line). Do not edit lines; gaps are findings, not noise.
2. On your paired helmd, catalog.search for a pack that ingests an action log; if your deployment has one, note its workflow id. Otherwise use the generic evidence workflow.
3. helmd workflow.run that workflow with the log as input. The run folds each line's digests into the pack's hash tree.
4. helmd artifact.get the run: record execution_hash and the per-step digests.
5. helmd artifact.verify the run against its manifest digest. State pass/fail and which steps are covered.
6. helmd evidence.export the bundle. Confirm it carries: the log digests, the manifest digest, the execution_hash, and a verify command that needs no network.
7. Give me the bundle path and a three-line handover note for your auditor: what the log covers, what the seal attests (digests, not behavior), and the exact offline command they run. Anyone with the bundle and helmd verifies it without contacting us. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
