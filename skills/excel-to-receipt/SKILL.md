---
name: excel-to-receipt
description: "My numbers live in a workbook. Evaluate it deterministically, digest the range, and give the auditor a receipt. Use when you want a short routine task run against the AINumbers suite. Written for the finance teams audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "excel-to-receipt"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "647bdbeed4d9"
---

# Excel to receipt

My numbers live in a workbook. Evaluate it deterministically, digest the range, and give the auditor a receipt.

## Prompt

Take a spreadsheet out of email-and-trust and put it under a receipt.

1. Export one workbook sheet to CSV. Use a synthetic copy if the sheet has real counterparty data.
2. Call workbook_csv_parse. Record the parsed shape (rows, columns, types) and any cell that failed to parse.
3. Call workbook_evaluate over the formula range. Record the computed values and the evaluation order the engine used.
4. Call workbook_range_digest over the evaluated range. Record the digest; this is what the auditor will re-verify.
5. Call workbook_roundtrip_verify to prove the evaluated workbook round-trips to the same digest. State pass/fail.
6. build_evidence_pack over the parse, evaluate, and digest hashes.
7. Give me the ledger link for the pack and the one command an auditor runs to recompute the digest from the same CSV.
8. Write the note for your finance lead: which range is under receipt, the digest, and what the receipt does and does not claim (it covers the numbers as given, not the business judgment behind them). If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
