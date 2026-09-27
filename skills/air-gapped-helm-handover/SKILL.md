---
name: air-gapped-helm-handover
description: "Run a CECL workflow on a loopback-only Helm daemon, hit the consent-tier boundary at evidence export, and cross-check the kernel against the public worker. Use when you want one run that shows the same tool returning the same answer through every AINumbers doorway. Written for the banks / IT audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "air-gapped-helm-handover"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp https://anchor.ainumbers.co/mcp"
  version: "1e8cd3fdd287"
---

# Air-gapped control plane: the agent runs it, the human releases it, the bundle verifies without us

Run a CECL workflow on a loopback-only Helm daemon, hit the consent-tier boundary at evidence export, and cross-check the kernel against the public worker.

## Prompt

You are connected to a local Helm daemon at 127.0.0.1:4173. Run a CECL allowance workflow end to end, prove it, and get the evidence out the only way the daemon allows.

1. Call catalog.search with "cecl". Pick the quarterly allowance pack. Call workflow.describe and workflow.manifest_get; list the nodes, the gates, and the manifest digest.
2. Call workflow.dry_run on it (declare the io.modelcontextprotocol/tasks extension). Poll tasks/get until status is completed. Report the execution_hash.
3. Call workflow.run on the same pack. Poll to completion. Report the execution_hash and whether it equals the dry run's.
4. Call artifact.get and then artifact.verify on the real run. Report the per-step digests and the replay verdict.
5. Attempt evidence.export with no ticket. Quote the error verbatim. Then tell me exactly what the human at the Helm UI has to do to mint a consent ticket, and wait for me to paste it.
6. Once I paste the ticket, call evidence.export with it. Save the digest-level record.
7. Cross-check the law: find the same kernel on mcp.ainumbers.co (find_tool "CECL allowance"), call it with the pack's sample inputs, and compare the kernel_digest and execution_hash to the Helm run. State whether the local daemon and the public worker agree.
8. Call anchor_hash on the Helm run's execution_hash (Sigstore TSA). Return the receipt.
9. Write the handover: what ran locally, what never left the machine, where the human consent sat in the flow, and how an auditor verifies the bundle offline with `helmd verify <bundle> --keys <publicKeys.json>` and no network. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Arguments

| name | required | what it is |
| --- | --- | --- |
| `helm_endpoint` | no | Local Helm daemon MCP endpoint, default http://127.0.0.1:4173/mcp |
| `pack_query` | no | catalog.search query for the pack, default cecl |

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
- https://anchor.ainumbers.co/mcp
