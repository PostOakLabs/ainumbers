---
name: authz-decision-receipt
description: "Make an AuthZEN decision, then prove the gate decision in the receipt. Use when the task is an agentic commerce or payments question. Written for the IAM audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "authz-decision-receipt"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "1e8cd3fdd287"
---

# AuthZ decision receipt

Make an AuthZEN decision, then prove the gate decision in the receipt.

## Prompt

Prove that the access decision your gate claims is the decision it made.

1. Call compute_authzen_conformance_fixture for one AuthZEN evaluation request (subject, action, resource). Record the expected decision.
2. Send the same request to your gate. Record what it actually decided. If expected and actual differ, that difference is the whole finding.
3. Call checklist_validate_definition on the checklist that defines this decision step. Record pass/fail and the definition digest.
4. Call checklist_step_receipt for the step: this binds the decision, the definition digest, and the inputs into one receipt. Record execution_hash.
5. Negative test: change the resource id in the request, re-run the step, confirm the receipt's hash changes. Quote both hashes.
6. build_session_receipt over the fixture, the definition check, and both step receipts. Give me the ledger link.
7. Write the note for the IAM review: the decision, the definition digest, the two hashes, and the ledger link, so an auditor re-verifies the gate without your help.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
