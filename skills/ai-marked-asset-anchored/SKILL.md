---
name: ai-marked-asset-anchored
description: "Validate a C2PA manifest and AI Act Art. 50 marking in the page, replay the content-credential chain remotely, and anchor the disclosure manifest to Bitcoin. Use when you want one run that shows the same tool returning the same answer through every AINumbers doorway. Written for the web3 / marketing audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "ai-marked-asset-anchored"
  verify_surface: "https://ledger.ainumbers.co/ https://ainumbers.co/chaingraph/art-123-c2pa-manifest-validator.html https://anchor.ainumbers.co/mcp"
  version: "1e8cd3fdd287"
---

# Is this asset real, AI-marked, and provably timestamped?

Validate a C2PA manifest and AI Act Art. 50 marking in the page, replay the content-credential chain remotely, and anchor the disclosure manifest to Bitcoin.

## Prompt

A marketing team is about to publish an AI-generated product image with a C2PA manifest. Decide if it can ship, and give them proof.

1. On https://ainumbers.co/chaingraph/art-123-c2pa-manifest-validator.html, run the WebMCP tool with the page's synthetic manifest. Record verdict + execution_hash.
2. On art-126, run check_ai_act_art50_marking with the same manifest's assertion set. On art-127, run verify_dual_layer_disclosure. Record both hashes.
3. Call run_chain on content-credential-verification (art-123 > art-124 > art-125) remotely with the same synthetic manifest. Compare the art-123 step hash to your in-page hash from step 1 and state whether they are identical.
4. Call build_disclosure_manifest over the five artifacts. Then call verify_disclosure_inclusion for the art-126 artifact and show the inclusion path.
5. Call anchor_hash with the disclosure manifest root on OpenTimestamps. Then call upgrade_ots_proof and report whether the proof is still pending or already Bitcoin-attested (pending is expected within the first hours; say so).
6. Build the ledger link for the composite chain artifact. Open it and report the §17 kernel identity and §18 compute proof lines.
7. Write the publish decision: ship / do not ship, the Art. 50 findings, and a verification recipe a journalist could follow without contacting us (ledger link, OTS proof, kernel digest).
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Arguments

| name | required | what it is |
| --- | --- | --- |
| `manifest_page` | yes | URL of the C2PA validator page, default https://ainumbers.co/chaingraph/art-123-c2pa-manifest-validator.html |
| `chain_id` | no | Content-credential chain to replay remotely, default content-credential-verification |

### Verify what came back

- https://ledger.ainumbers.co/
- https://ainumbers.co/chaingraph/art-123-c2pa-manifest-validator.html
- https://anchor.ainumbers.co/mcp
