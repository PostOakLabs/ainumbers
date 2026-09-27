---
name: mcp-server-self-attest
description: "Lint my MCP server, score readiness, and produce the self-attestation pack. Use when the task is a regulatory compliance question that needs an evidence trail. Written for the MCP builders audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "mcp-server-self-attest"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "1e8cd3fdd287"
---

# MCP server self-attest

Lint my MCP server, score readiness, and produce the self-attestation pack.

## Prompt

Self-attest your MCP server with receipts instead of a checkbox.

1. Call lint_mcp_server_conformance against your server endpoint. Record every violation with its rule id and severity.
2. Call score_mcp_server_readiness. Record the score, the per-dimension breakdown, and the weakest dimension.
3. Fix the conformance violations (or file them with owners). Fix nothing else this pass.
4. Re-run both tools. Quote before/after per dimension; the score delta is your attestation claim.
5. Rescan after one week without changes to confirm the score holds; that re-run is what makes it an attestation rather than a snapshot.
6. build_session_receipt over all four runs; give me the ledger link.
7. Write the self-attestation for your server's README or trust page: the score, the date, the rules checked, and the ledger link, so a client verifies the claim against the receipt rather than your wording.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
