---
name: fr2052a-daily
description: "Classify today’s FR 2052a extract locally and seal it. Use when the task is a banking or payment-operations question. Written for the US banks audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "fr2052a-daily"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "1e8cd3fdd287"
---

# FR 2052a daily

Classify today’s FR 2052a extract locally and seal it.

## Prompt

The daily 2052a classification, sealed before you send anything anywhere.

1. helmd catalog.search "2052a". Record the classify pack's workflow id and manifest digest.
2. helmd workflow.dry_run against today's synthetic extract. Fix gate failures; do not classify a file the gates reject.
3. helmd workflow.run. Poll helmd artifact.get for the execution_hash and per-line classification digests.
4. helmd artifact.verify against the manifest digest. State pass/fail.
5. Spot-check three classifications by hand against the instruction text; record agreement.
6. helmd evidence.export the day's bundle. Confirm it carries the manifest digest, the execution_hash, and the offline verify command.
7. Give me the bundle path and the ledger link if your deployment mirrors runs.
8. Write the daily note for the intraday-desk file: line counts, the three spot checks, the digest, and the seal. Whoever audits the submission re-verifies from the bundle, not from your word. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
