# Commercial Loan Underwriting Check

Checks the two numbers a credit committee starts with: debt-service coverage and risk-adjusted pricing. art-363 rebuilds the borrower's coverage ratios (basic/cash/FCF DSCR, FCCR, EBIT- and EBITDA-basis ICR, leverage in x EBITDA) against its five-category lender matrix; art-362 prices the loan on a risk-adjusted return-on-capital basis and reports the spread needed to clear the hurdle rate; cry-05 aggregates the run's execution receipts. Steps are independent runs; step-1 ratios and execution hashes are cited for manual comparison. The pricer takes user-supplied inputs. Not a credit decision.

- Page: https://ainumbers.co/chaingraph/chains/commercial-loan-underwriting-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/commercial-loan-underwriting-check.md

## Workflow chain: Commercial Loan Underwriting Check

Checks the two numbers a credit committee starts with: debt-service coverage and risk-adjusted pricing. art-363 rebuilds the borrower's coverage ratios (basic/cash/FCF DSCR, FCCR, EBIT- and EBITDA-basis ICR, leverage in x EBITDA) against its five-category lender matrix; art-362 prices the loan on a risk-adjusted return-on-capital basis and reports the spread needed to clear the hurdle rate; cry-05 aggregates the run's execution receipts. Steps are independent runs; step-1 ratios and execution hashes are cited for manual comparison. The pricer takes user-supplied inputs. Not a credit decision.

Domain: Bank Capital & Credit Risk

### Steps

1. art-363-compute-dscr
   Produces basic/cash/FCF DSCR, FCCR, EBIT- and EBITDA-basis ICR, and leverage in x EBITDA, with a pass/fail assessment against the five-category lender matrix; the run's execution_hash anchors this stage
2. art-362-compute-raroc-loan-price
   Produces RAROC, the hurdle-rate verdict, break-even spread and gap in bps, and economic capital; step-1 ratios and execution_hash are cited for manual comparison against the pricing inputs (the pricer takes user-supplied inputs and does not read the borrower's books)
3. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Does a $50M five-year commercial loan at 175bps over benchmark clear a 12% hurdle rate, and how does RAROC move if the spread is 275bps?
Run the AINumbers MCP tool `run_chain` with {"chain":"commercial-loan-underwriting-check"} and read `art-362-compute-raroc-loan-price.raroc_pct`.
Re-run with `inputs` for `art-362-compute-raroc-loan-price`, reusing the values that result echoed, with `margin_bps` set to 275. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/commercial-loan-underwriting-check.html
