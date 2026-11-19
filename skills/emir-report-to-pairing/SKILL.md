---
name: emir-report-to-pairing
description: "Validate the auth.030, pair both counterparties by UTI, close the reconciliation exceptions, and seal the evidence. Use when the task is a regulatory compliance question that needs an evidence trail. Written for the EMIR Refit reporting audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "emir-report-to-pairing"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "1e1ce005ada9"
---

# An EMIR Refit report from validation to pairing

Validate the auth.030, pair both counterparties by UTI, close the reconciliation exceptions, and seal the evidence.

## Prompt

Follow one derivative trade through the EMIR Refit reporting checks and leave a receipt a supervisor can re-check.

1. Validate a synthetic auth.030 trade report with validate_emir_trade_report (action type, both 20-character LEIs, UTI, UPI, notional, currency); fix the reported field defects in the input and re-run until clean. Record the execution hash.
2. Pair the two counterparties' reports by UTI with reconcile_emir_pairing over a declared matching-field set within a per-field tolerance. List every field that lands outside tolerance with its two reported values.
3. Correct each out-of-tolerance field in the input, re-run reconcile_emir_pairing, and keep the before/after exception list until the declared matching-field set comes back clean.
4. Seal the run with build_session_receipt over the hashes from steps 1 to 3, then call verify_execution_hash (send each receipt's execution_hash as claimed_hash) so every number re-verifies from the receipt alone.
Deliverable: the validation verdict, the before/after pairing exceptions, the ledger link, and one sentence on what the receipts prove (the declared synthetic reports were validated and paired as given) and what they do not prove (no real counterparty data, no filing, no regulatory determination).
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
