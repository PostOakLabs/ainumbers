---
name: zero-egress-emir-proof
description: "Run four EMIR Refit validators inside the browser tab, pack and anchor only the hashes, and hand a supervisor the re-verification recipe. Use when you want one run that shows the same tool returning the same answer through every AINumbers doorway. Written for the RegTech audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "zero-egress-emir-proof"
  verify_surface: "https://ledger.ainumbers.co/ https://ainumbers.co/chaingraph/art-158-emir-reporting-readiness-diagnostic.html https://anchor.ainumbers.co/mcp"
  version: "8770e0e5aba5"
---

# Regulatory proof without the data leaving the browser

Run four EMIR Refit validators inside the browser tab, pack and anchor only the hashes, and hand a supervisor the re-verification recipe.

## Prompt

You are a trade-reporting agent at an EU counterparty. The trade report is confidential: it must not leave this machine. Prove readiness anyway.

1. Take the synthetic EMIR Refit auth.030 sample from the art-158 page. Do NOT paste it into any remote call at any point.
2. On each page, invoke the WebMCP-registered tool in the page with that sample:
   - art-154 check_emir_uti_completeness
   - art-155 validate_emir_upi
   - art-157 validate_emir_lifecycle_event
   - art-158 run_emir_reporting_fit
   Record each verdict and execution_hash. Confirm zero network requests during each call.
3. Call verify_execution_hash (send the artifact or its hash as claimed_hash) on mcp.ainumbers.co for each artifact, sending ONLY the artifact (policy_parameters + output_payload as emitted by the page). State whether every recompute matches.
4. Call build_evidence_pack with the four hashes, labelled by node, plus the four kernel_digest values from chaingraph.json.
5. Call anchor_batch on anchor.ainumbers.co with the four hashes and the pack digest. Use two authorities: Sigstore TSA and OpenTimestamps.
6. Build the ledger fragment link for the art-158 artifact and open it. Report the verify chips.
7. Write the cover note for the trade repository: which checks ran, on which kernel versions, that the report content never left the workstation, and how a supervisor re-verifies with no access to us (ledger link + anchor receipt + kernel_digest). If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Arguments

| name | required | what it is |
| --- | --- | --- |
| `emir_sample_source` | no | Page supplying the synthetic EMIR Refit auth.030 sample, default the art-158 page |
| `anchor_mcp_url` | no | Anchor MCP endpoint, default https://anchor.ainumbers.co/mcp |

### Verify what came back

- https://ledger.ainumbers.co/
- https://ainumbers.co/chaingraph/art-158-emir-reporting-readiness-diagnostic.html
- https://anchor.ainumbers.co/mcp
