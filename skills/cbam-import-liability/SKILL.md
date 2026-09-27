---
name: cbam-import-liability
description: "Resolve CBAM default values, aggregate precursors, and price certificates for this import schedule. Use when the task is a regulatory compliance question that needs an evidence trail. Written for the importers / ESG audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "cbam-import-liability"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "1e8cd3fdd287"
---

# CBAM import liability

Resolve CBAM default values, aggregate precursors, and price certificates for this import schedule.

## Prompt

Price one import schedule's CBAM exposure with every number re-computable.

1. List the synthetic import schedule: goods, CN codes, origin, quantities, per quarter.
2. Call resolve_cbam_default_value per good. Record the default embedded-emissions values used where no actuals exist.
3. Call aggregate_cbam_precursor_emissions for goods with precursor inputs. Record the aggregated values.
4. Call calculate_cbam_embedded_emissions per line. Record the totals.
5. Call model_cbam_certificate_cost across the schedule with this quarter's certificate price and the free-allocation phase-down. Record the cost range.
6. Call score_taxonomy_alignment for the optional alignment KPI. Record the score.
7. build_session_receipt over the runs; give me the ledger link.
8. Write the note for the sustainability lead: the cost range, which lines drove it, the default-versus-actuals mix, and the ledger link, so the numbers survive a supplier sending better data (re-run and the receipt updates).
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
