---
name: contract-redline-proof
description: "Show exactly what changed between two contract versions and seal the diff. Use when you want a short routine task run against the AINumbers suite. Written for the legal ops audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "contract-redline-proof"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "8770e0e5aba5"
---

# Contract redline proof

Show exactly what changed between two contract versions and seal the diff.

## Prompt

Make a contract diff that outlives both parties' copy of the file.

1. Export both contract versions to plain text (v1.txt, v2.txt). Use synthetic or redacted text if the contract is confidential; the proof covers structure, not secrets.
2. Call redline_diff on the two files. Record the changed spans with their context.
3. Call redline_verify to confirm the diff is complete and reproduces both documents from v1 plus the patch. State pass/fail.
4. Confirm the patch alone, applied to v1, yields v2 byte-for-byte; quote the byte counts of v1, patch, and v2.
5. anchor_stamp the patch digest on OpenTimestamps. Record the OTS receipt.
6. build_session_receipt over the diff and verify hashes; give me the ledger link.
7. Write the note for the deal file: the two version identifiers, the patch digest, the OTS receipt, and the one command that re-applies the patch and re-verifies the digest years from now, without contacting us. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
