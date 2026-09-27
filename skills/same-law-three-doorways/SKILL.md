---
name: same-law-three-doorways
description: "Run one tool in the page, on the hosted MCP worker, and against its signed receipt, then compare the execution_hash character by character. Use when you want one run that shows the same tool returning the same answer through every AINumbers doorway. Written for the demo audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "same-law-three-doorways"
  verify_surface: "https://ledger.ainumbers.co/ https://ainumbers.co/chaingraph/chaingraph.json https://anchor.ainumbers.co/mcp"
  version: "647bdbeed4d9"
---

# One law through three doorways

Run one tool in the page, on the hosted MCP worker, and against its signed receipt, then compare the execution_hash character by character.

## Prompt

You are on an AINumbers node page. Prove that this tool gives the same answer no matter which door you use.

1. List the tools this page registers via WebMCP. Note the tool name.
2. Run that tool IN THE PAGE with the page's own synthetic sample (use the declared inputSchema; do not invent fields). Record the verdict and the execution_hash. Confirm the DevTools Network tab shows zero requests during the call.
3. Call the SAME tool name on mcp.ainumbers.co with the identical inputs. Record its execution_hash.
4. Call verify_execution_hash (send the artifact or its hash as claimed_hash) on the remote artifact. Then compare the two hashes character by character and state whether they are equal.
5. Fetch this node's entry from https://ainumbers.co/chaingraph/chaingraph.json. Report compute_proof.system, receiptFormat, and journal.kernel_digest, and confirm the kernel_digest equals the sha256-source image_id in compute_images.
6. Flip one byte in the signature field of the sample and re-run in the page. Report the new verdict and show the hash changed.
7. Call build_session_receipt with the two matching hashes in call order. Record session_receipt_root.
8. Call anchor_hash on anchor.ainumbers.co with session_receipt_root using the OpenTimestamps authority. Return the anchor receipt.
9. Give me the ledger_url from the remote run, and a one-paragraph statement a regulator could read: which code ran (kernel_digest), where (three doorways), what it decided, and where the timestamp lives.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Arguments

| name | required | what it is |
| --- | --- | --- |
| `node_page` | yes | URL of the AINumbers node page to prove, e.g. https://ainumbers.co/chaingraph/art-129-webbotauth-signature-verifier.html |
| `remote_mcp_url` | no | Hosted MCP endpoint, default https://mcp.ainumbers.co/mcp |
| `anchor_mcp_url` | no | Anchor MCP endpoint, default https://anchor.ainumbers.co/mcp |

### Verify what came back

- https://ledger.ainumbers.co/
- https://ainumbers.co/chaingraph/chaingraph.json
- https://anchor.ainumbers.co/mcp
