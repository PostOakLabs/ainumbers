# Interest Accrual Recompute

Core Verify pack, chain 1 of 3 (CORE-VERIFY-BUILD-SPEC.md §1): independently recomputes a core-system-reported interest accrual figure from the caller-declared principal, annual rate, day-count basis, and days accrued, then diffs the recomputed figure against the core's reported amount under a caller-declared variance tolerance. This chain configures the existing audit recalculation suite (art-463) to its interest_accrual category only - no new kernel, no new node. The day-count/compounding convention is a contract term the caller declares for each item, never inferred or defaulted by this chain. A DIVERGES result names the exact recalculated-vs-reported variance in cents and percent for the flagged item(s); MATCHES/DIVERGES/INDETERMINATE semantics are the underlying node's own verdict, unchanged.

- Page: https://ainumbers.co/chaingraph/chains/interest-accrual-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/interest-accrual-recompute.md

## Workflow chain: Interest Accrual Recompute

Core Verify pack, chain 1 of 3 (CORE-VERIFY-BUILD-SPEC.md §1): independently recomputes a core-system-reported interest accrual figure from the caller-declared principal, annual rate, day-count basis, and days accrued, then diffs the recomputed figure against the core's reported amount under a caller-declared variance tolerance. This chain configures the existing audit recalculation suite (art-463) to its interest_accrual category only - no new kernel, no new node. The day-count/compounding convention is a contract term the caller declares for each item, never inferred or defaulted by this chain. A DIVERGES result names the exact recalculated-vs-reported variance in cents and percent for the flagged item(s); MATCHES/DIVERGES/INDETERMINATE semantics are the underlying node's own verdict, unchanged.

Domain: Audit & Assurance

### Steps

1. art-463-recalc-suite
   Recomputes each declared interest-accrual item (principal, annual_rate_pct, days_accrued, day_count_basis) independently and diffs the result against the core-reported interest figure, flagging any variance outside the caller-declared tolerance (tolerance_abs, tolerance_pct). Terminal stage - this chain runs the suite's interest_accrual category only; the suite's other four categories (depreciation, EPS, amortization, prepaid roll-forward) are out of scope for this chain and are not invoked.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
