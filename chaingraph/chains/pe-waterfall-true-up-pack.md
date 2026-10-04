# PE Waterfall True-Up Pack

Evidence pack for a private equity fund distribution true-up between a general partner and its limited partners. The pack has one computational stage: a batch recompute of a standard four-tier distribution waterfall, return of capital, preferred return, GP catch-up, and residual carry split, run over caller-declared dated contribution and distribution cashflows and a caller-declared waterfall parameterization, then diffed tier by tier against a caller-supplied GP-reported allocation, with an overall verdict of MATCHES, DIVERGES, or INDETERMINATE and a matching verdict for every individual tier. The pack's evidence value comes from running that one stage twice: the GP's own distribution notice reports an allocation, and the LP side recomputes it independently over the identical declared cashflows and waterfall terms. Because the kernel is deterministic and every tier comparison is exact fixed-point arithmetic with no declared tolerance, two honest recomputations over the same inputs reach the identical execution hash, and each side can countersign a receipt of that recomputation under SPEC.md section 27.12, kernel-pinned and dated, with no relay and no shared registry between the fund and its investor. The receipt is evidence that both parties independently recomputed and signed the same result. It does not state or imply that the LP has approved the distribution, that the true-up is closed, or that a dispute over the underlying waterfall's terms is foreclosed. Every input, the cashflows and their dates and amounts, the preferred return rate and compounding basis, the GP catch-up and carry percentages, the tier structure, and the GP-reported allocation, is declared by the caller: the pack reads no fund administrator ledger and no capital account statement. ILPA's own reporting-template guidance is cited as dated gap evidence that GP-side reporting tooling was not designed for LP-side verification, not as a standard the pack certifies against.

- Page: https://ainumbers.co/chaingraph/chains/pe-waterfall-true-up-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/pe-waterfall-true-up-pack.md

## Workflow chain: PE Waterfall True-Up Pack

Evidence pack for a private equity fund distribution true-up between a general partner and its limited partners. The pack has one computational stage: a batch recompute of a standard four-tier distribution waterfall, return of capital, preferred return, GP catch-up, and residual carry split, run over caller-declared dated contribution and distribution cashflows and a caller-declared waterfall parameterization, then diffed tier by tier against a caller-supplied GP-reported allocation, with an overall verdict of MATCHES, DIVERGES, or INDETERMINATE and a matching verdict for every individual tier. The pack's evidence value comes from running that one stage twice: the GP's own distribution notice reports an allocation, and the LP side recomputes it independently over the identical declared cashflows and waterfall terms. Because the kernel is deterministic and every tier comparison is exact fixed-point arithmetic with no declared tolerance, two honest recomputations over the same inputs reach the identical execution hash, and each side can countersign a receipt of that recomputation under SPEC.md section 27.12, kernel-pinned and dated, with no relay and no shared registry between the fund and its investor. The receipt is evidence that both parties independently recomputed and signed the same result. It does not state or imply that the LP has approved the distribution, that the true-up is closed, or that a dispute over the underlying waterfall's terms is foreclosed. Every input, the cashflows and their dates and amounts, the preferred return rate and compounding basis, the GP catch-up and carry percentages, the tier structure, and the GP-reported allocation, is declared by the caller: the pack reads no fund administrator ledger and no capital account statement. ILPA's own reporting-template guidance is cited as dated gap evidence that GP-side reporting tooling was not designed for LP-side verification, not as a standard the pack certifies against.

Domain: Audit & Assurance

### Steps

1. art-567-pe-waterfall-lp-recompute
   The waterfall recompute, run independently by the GP and the LP over the same declared batch of dated cashflows and the same declared waterfall parameterization, each diffed tier by tier against the GP's own reported allocation with no declared tolerance, exact fixed-point equality only. Every tier carries its own MATCHES, DIVERGES, or INDETERMINATE verdict, and the run carries one overall verdict of the same three values. Only the resulting execution hash, not any editorial reading of it, is what the two sides countersign.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The GP sent its annual allocation report. Does our own recompute of the distribution waterfall tie to it before we book it?
Run the AINumbers MCP tool `run_chain` with {"chain":"pe-waterfall-true-up-pack"} and read `art-567-pe-waterfall-lp-recompute.verdict`.
Re-run with `inputs` for `art-567-pe-waterfall-lp-recompute`, reusing the values that result echoed, with `gp_reported_allocation` changed so the carry_residual tier reports gp_amount 60000, above the recomputed 40000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/pe-waterfall-true-up-pack.html
