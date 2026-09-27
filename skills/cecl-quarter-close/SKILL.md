---
name: cecl-quarter-close
description: "Close the CECL quarter locally with helmd and prove the allowance rollforward. Use when the task is a banking or payment-operations question. Written for the finance audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "cecl-quarter-close"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "647bdbeed4d9"
---

# CECL quarter close

Close the CECL quarter locally with helmd and prove the allowance rollforward.

## Prompt

Close the quarter's CECL allowance where the numbers never leave your machine.

1. helmd catalog.search for the CECL allowance pack; record the workflow id and manifest digest.
2. helmd workflow.dry_run the pack against this quarter's synthetic loan tape. Fix any gate failure before the real run.
3. helmd workflow.run the pack. Poll helmd artifact.get for the execution_hash and per-step digests.
4. helmd artifact.verify the run against the manifest digest. State pass/fail.
5. Cross-check one number on the public worker: find_tool for the allowance or amortization tool, run the same rollforward input remotely, and compare hashes. If they differ, your local pack and the published kernel have drifted; quote both.
6. build_session_receipt over the local run and the remote cross-check; give me the ledger link.
7. Write the close note for the controller: the allowance figure, the manifest digest it came from, the cross-check result, and the ledger link. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
