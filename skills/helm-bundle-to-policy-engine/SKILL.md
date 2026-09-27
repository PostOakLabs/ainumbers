---
name: helm-bundle-to-policy-engine
description: "Export a Helm run as an in-toto statement and gate a deployment on it. Use when the task is a governance, model-risk, or control question. Written for the platform teams audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "helm-bundle-to-policy-engine"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "647bdbeed4d9"
---

# Helm bundle to policy engine

Export a Helm run as an in-toto statement and gate a deployment on it.

## Prompt

Make a deployment gate read a Helm run's evidence instead of a human's thumbs-up.

1. On your paired helmd, pick one completed workflow run. helmd artifact.get it; record the execution_hash and per-step digests.
2. helmd artifact.verify the run against its manifest digest. A run that fails verify must never reach the gate; confirm your policy rejects it.
3. helmd evidence.export the run as its in-toto statement export. Record the statement's subject digests.
4. Inspect the statement: confirm the subjects name the artifacts your deployment actually consumes, not a superset.
5. Negative test: modify one byte of a subject artifact and re-verify the statement; confirm verification fails. Quote the failure.
6. Wire the gate: your policy engine (cosign verify or a Kyverno verify rule against the exported statement) checks the statement before allowing the deployment. Record the policy rule text.
7. Give me the gate decision output for one allowed and one blocked deployment.
8. Write the runbook entry for the platform channel: the export command, the policy rule, the two test outputs, and the line that the gate reads digests, not opinions. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
