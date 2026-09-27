---
name: supply-chain-provenance
description: "Verify the DSCSA T3, the FSMA 204 CTEs, and the DPP carrier for this product. Use when the task is a regulatory compliance question that needs an evidence trail. Written for the pharma / food / consumer goods audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "supply-chain-provenance"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "647bdbeed4d9"
---

# Supply chain provenance

Verify the DSCSA T3, the FSMA 204 CTEs, and the DPP carrier for this product.

## Prompt

Provenance for one product across three regimes, one receipt.

1. Call verify_dscsa_transaction_statement on the synthetic T3 data for the pharma line. Record pass/fail and the trading-party identifiers.
2. Call validate_fsma204_cte on the food line's critical tracking events. Record which CTEs are present and which are missing for the KDE pairs.
3. Call resolve_recall_trace for both lines: given a synthetic lot, record the trace-up and trace-down paths and their terminals.
4. Call validate_dpp_data_carrier on the digital product passport carrier. Record whether the carrier resolves and what data it serves.
5. Recall drill: pick one terminal node from step 3 and confirm the trace lists every affected lot, not just the first. Quote the lot count.
6. build_session_receipt over the four checks; give me the ledger link.
7. Write the provenance note for the quality team: what each regime check covers, the recall path summary, and the ledger link, so a regulator's question is answered by re-running the receipt.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
