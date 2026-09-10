# Commission Integrity and Amortization

Gated three-step chain for commission STP under ASC 606/340-40. Step 1 validates commission hierarchy structure (BFS orphan/cycle/split-sum). Step 2 reconciles commission statement line items; gate on /has_discrepancy: true exits early (discrepancy found - correct base before amortizing). Default (clean statement) proceeds to Step 3: ASC 340-40 amortization with practical expedient check. ZERO PII BY CONSTRUCTION.

- Page: https://ainumbers.co/chaingraph/chains/commission-integrity-and-amortization.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/commission-integrity-and-amortization.md

## Workflow chain: Commission Integrity and Amortization

Gated three-step chain for commission STP under ASC 606/340-40. Step 1 validates commission hierarchy structure (BFS orphan/cycle/split-sum). Step 2 reconciles commission statement line items; gate on /has_discrepancy: true exits early (discrepancy found - correct base before amortizing). Default (clean statement) proceeds to Step 3: ASC 340-40 amortization with practical expedient check. ZERO PII BY CONSTRUCTION.

Domain: Corporate Treasury & FX

### Steps

1. art-264-validate-commission-hierarchy
   BFS hierarchy validation: is_valid (bool), violations[], orphan_count, circular_count, split_violations. Passes structural summary to statement reconciliation.
2. art-266-reconcile-commission-statement
   Statement reconciliation: variance_amount and variance_pct per line. Sets has_discrepancy. GATE: has_discrepancy=true -> END (discrepancy found). Default (false) -> Step 3.
3. art-265-amortize-asc606-commissions
   ASC 340-40 amortization: apply_expedient (bool), monthly_amortization, cumulative_amortized_pct, remaining_book_value. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
