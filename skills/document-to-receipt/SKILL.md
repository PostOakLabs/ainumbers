---
name: document-to-receipt
description: "Convert this document deterministically, prove the sanitisation, and emit the digest manifest. Use when the task is a governance, model-risk, or control question. Written for the records audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "document-to-receipt"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "1e8cd3fdd287"
---

# Document to receipt

Convert this document deterministically, prove the sanitisation, and emit the digest manifest.

## Prompt

Move a document from someone's laptop trust into a verifiable record.

1. Take one markdown document and its converted form (the published artifact). Synthetic or public text only.
2. Call convert_markdown_document on the source. Record the conversion digest and whether the conversion is deterministic (re-run and compare).
3. Diff the fresh conversion against the published artifact. If they differ, the published copy drifted; quote the differing lines.
4. Call build_disclosure_manifest over the document's redaction set (the spans that must not ship). Record the manifest digest.
5. Call verify_disclosure_inclusion to confirm the manifest covers exactly the redacted spans and nothing more. Record pass/fail.
6. Negative test: add one span to the manifest, re-verify, confirm the check flags it. Revert.
7. build_session_receipt over the conversion and manifest hashes; give me the ledger link.
8. Write the records note: the document id, the conversion digest, the redaction manifest digest, and the ledger link, so records management re-verifies the artifact without keeping the original machine.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
