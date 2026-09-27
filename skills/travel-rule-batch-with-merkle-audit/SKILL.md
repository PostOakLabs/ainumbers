---
name: travel-rule-batch-with-merkle-audit
description: "Validate a transfer batch under TFR, then verify its Merkle audit batch. Use when the task is a crypto-asset or on-chain question. Written for the VASPs audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "travel-rule-batch-with-merkle-audit"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "647bdbeed4d9"
---

# Travel-rule batch with Merkle audit

Validate a transfer batch under TFR, then verify its Merkle audit batch.

## Prompt

Prove a travel-rule batch and leave an audit path that does not depend on your systems.

1. Build a synthetic batch of 20 transfers with complete originator/beneficiary fields and 3 deliberately defective ones.
2. Call validate_tfr_travel_rule_batch. Record per-transfer verdicts; confirm exactly the 3 defectives fail and quote their defect codes.
3. Call verify_merkle_batch on the batch's audit root with one inclusion proof per defective transfer. Confirm each proof resolves to the root.
4. Negative test: swap two transfers in the batch, re-verify the inclusion proofs, confirm they fail against the same root. Revert.
5. Run the chain mica-travel-rule with run_chain for the composed regulatory verdict. Record execution_hash.
6. build_session_receipt over the batch validation and Merkle checks; give me the ledger link.
7. Write the note for compliance: batch size, defect classes, the root, and the ledger link, so the receiving VSP re-verifies inclusions without asking for your files.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
