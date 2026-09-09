# Build Allocation Decision Receipt

Re-derives whether an allocation produced by an optimizer is explained by the objective and inputs that were true when it was made: the eligibility schedule snapshot, the inventory snapshot offered, the haircut table version, and the declared objective. Portable to any optimizer, not collateral only, so the same input shape covers a liquidity sweep, a treasury cash placement, a payment-routing choice, or an order allocation. Re-derives ONE candidate allocation for a declared objective (cheapest_to_deliver, preserve_hqla, or minimise_movements) using a fixed, published greedy rule, and compares it to the allocation the caller says was actually chosen: a reproducibility verdict, the delta versus the re-derived allocation in cost and in eligibility terms, and the binding constraint explaining each difference. A caller-named objective outside the three known ones is recorded but not solved, since this kernel has no fixed re-derivation rule for it. ADR_DIVERGENT is not a finding of error: a divergence means the chosen allocation is not explained by the declared objective and inputs, which is routinely legitimate (a trader override, an undeclared constraint, a stale snapshot); no output here characterises intent. This is not a competing optimizer and never claims the re-derived allocation is better than the one chosen. Eligibility, inventory, haircuts and the objective are every one of them a caller input, transcribed from the snapshot in force when the allocation was made; this kernel ships no eligibility table, no inventory feed and no haircut table of its own, and performs no lookups of any kind (zero-egress). Distinct from art-370-supervisory-scenario-replay, which replays the Fed's published macro scenario paths against caller loss/PPNR functions (a scenario replay over regulator-published inputs, not a decision re-derivation), and from art-236-build-ai-decision-log-record, which builds an EU AI Act Art 12(2) decision-log record (metadata about a decision, with no reproducibility verdict and no optimal-allocation computation). Reuses 505-tokenized-collateral-eligibility-checker for eligibility of each candidate and art-444-collateral-haircut-engine for the haircut applied; consumes their outcome as a caller-declared input and edits neither.

- Page: https://ainumbers.co/chaingraph/art-515-build-allocation-decision-receipt.html
- Markdown twin: https://ainumbers.co/chaingraph/art-515-build-allocation-decision-receipt.md
- MCP tool: build_allocation_decision_receipt (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- allocation_chosen (array, required)
- as_of (unknown, optional)
- eligibility_schedule (array, required)
- eligibility_schedule_ref (unknown, optional)
- haircut_table_version (unknown, optional)
- inventory_ref (unknown, optional)
- inventory_snapshot (array, required)
- objective (string, optional)
- obligation_amount (unknown, required)
- obligation_ref (unknown, optional)
- rounding (unknown, required)

## Outputs

- as_of (string, optional)
- binding_constraints (array, optional)
- delta (object, optional)
- eligibility_schedule_ref (string, optional)
- exceptions (array, optional)
- fence (string, optional)
- haircut_table_version (string, optional)
- inventory_ref (string, optional)
- judgment_required (string, optional)
- not_proven (array, optional)
- objective (string, optional)
- obligation (object, optional)
- obligation_ref (string, optional)
- rationale (array, optional)
- reproducibility (object, optional)
- rounding (object, optional)

## Sample

```json
{
  "obligation_ref": "OBL-DEMO-01",
  "as_of": "2026-06-30",
  "eligibility_schedule_ref": "ELIG-2026-06",
  "inventory_ref": "INV-2026-06-30",
  "haircut_table_version": "HC-2026Q2",
  "obligation_amount": "1000000",
  "objective": "cheapest_to_deliver",
  "eligibility_schedule": [
    {
      "asset_id": "A1",
      "eligible": true
    },
    {
      "asset_id": "A2",
      "eligible": true
    }
  ],
  "inventory_snapshot": [
    {
      "asset_id": "A1",
      "available_amount": "600000",
      "cost_bps": "5",
      "hqla": true,
      "haircut_pct": "0"
    },
    {
      "asset_id": "A2",
      "available_amount": "600000",
      "cost_bps": "2",
      "hqla": false,
      "haircut_pct": "0"
    }
  ],
  "allocation_chosen": [
    {
      "asset_id": "A2",
      "amount": "600000"
    },
    {
      "asset_id": "A1",
      "amount": "400000"
    }
  ],
  "rounding": {
    "decimal_places": 2,
    "mode": "half_up"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_allocation_decision_receipt` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
