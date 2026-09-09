# Reg W 23A/23B Affiliate-Transaction Testing Cycle

Single-stage standing internal-audit test cycle over an institution's own caller-declared population of covered transactions with an affiliate. Per transaction, tests the Regulation W (12 CFR 223, eCFR 2026 codification) 10% single-affiliate and 20% aggregate-affiliate capital limits and the collateral-coverage percentage requirement on covered credit transactions; the qualitative 12 CFR 223.51 market-terms test is a caller-declared boolean the tester records for the artifact only, never a judgment it makes. Capital base, both limit percentages, and the collateral-coverage percentage all arrive as caller-declared policy_parameters cited with a required policy_vintage, never hardcoded. Either quantitative limit breached routes the standing test to internal audit as reviewer (escalate); a collateral shortfall with no capital breach flags review_required; both limits satisfied and full collateral coverage closes auto_pass. The standing internal-audit test-evidence pack closes with a preparer/reviewer pair rather than necessarily a named external approver, since these are internal standing tests, distinct from an externally-facing sign-off; where the institution runs this co-sourced an approver role binding is still available. This tool tracks and evidences the quantitative test only; it never itself determines that a transaction was conducted on market terms.

- Page: https://ainumbers.co/chaingraph/chains/reg-w-23a-23b-testing-cycle.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/reg-w-23a-23b-testing-cycle.md

## Workflow chain: Reg W 23A/23B Affiliate-Transaction Testing Cycle

Single-stage standing internal-audit test cycle over an institution's own caller-declared population of covered transactions with an affiliate. Per transaction, tests the Regulation W (12 CFR 223, eCFR 2026 codification) 10% single-affiliate and 20% aggregate-affiliate capital limits and the collateral-coverage percentage requirement on covered credit transactions; the qualitative 12 CFR 223.51 market-terms test is a caller-declared boolean the tester records for the artifact only, never a judgment it makes. Capital base, both limit percentages, and the collateral-coverage percentage all arrive as caller-declared policy_parameters cited with a required policy_vintage, never hardcoded. Either quantitative limit breached routes the standing test to internal audit as reviewer (escalate); a collateral shortfall with no capital breach flags review_required; both limits satisfied and full collateral coverage closes auto_pass. The standing internal-audit test-evidence pack closes with a preparer/reviewer pair rather than necessarily a named external approver, since these are internal standing tests, distinct from an externally-facing sign-off; where the institution runs this co-sourced an approver role binding is still available. This tool tracks and evidences the quantitative test only; it never itself determines that a transaction was conducted on market terms.

Domain: Audit & Assurance

### Steps

1. art-536-reg-w-affiliate-transaction-tester
   Per-affiliate and aggregate capital-limit test results, collateral-coverage test results, and the caller-declared market-terms declarations, plus the rollup closed decision enum, close the internal-audit test-evidence pack. Single stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
