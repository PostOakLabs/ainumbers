---
name: helm-nightly-check-with-openclaw
description: "Every night, recompute my extracts with helmd and post failures to my channel. Use when you want a short routine task run against the AINumbers suite. Written for the helm operators audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "helm-nightly-check-with-openclaw"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "8770e0e5aba5"
---

# Helm nightly check with OpenClaw

Every night, recompute my extracts with helmd and post failures to my channel.

## Prompt

Nightly loop for a paired helmd: recompute your packs and post only the failures.

1. helmd catalog.search for each pack family you own (for example "2052a"); record the workflow ids and manifest digests.
2. For each pack, helmd workflow.dry_run against today's extract files. Record any dry-run gate failures; those are your input problems, fix them before the real run.
3. helmd workflow.run each pack for real. Poll helmd artifact.get for each run's execution_hash and per-step digests.
4. helmd artifact.verify each run against its manifest digest. Classify: VERIFIED, FAILED, or STALE (digest drifted from yesterday).
5. Compare each execution_hash with yesterday's note. A hash that changes when the extract did not change is your top alarm; quote the changed step.
6. Give me the per-pack table: workflow id, digest, execution_hash, class.
7. Write the nightly note for your channel: failures first, then the table, then the one command a teammate runs on their own helmd to reproduce any line. State plainly that nothing here required trusting your machine: every line re-verifies from the manifest digest. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
