# BNPL Plan Comparator

Side-by-side BNPL plan cost comparison on the estate's Reg Z APR maths: the APR for every plan is computed by art-215 compute_reg_z_appendix_j_apr (12 CFR 1026 Appendix J general actuarial equation, bracketed bisection), imported and delegated to, never reimplemented. Inputs: a USD principal plus 1 to 8 plans, each either a provider preset or explicit parameters (number of instalments, cadence weekly, biweekly or monthly, stated APR, upfront and per-instalment fees, optional quoted instalment amount and down payment). Outputs per plan: the payment schedule with each instalment's due period from purchase and amount, total of payments, fee total, finance charge, and the Reg Z Appendix J APR of the stream (null with a named flag when no rate is bracketed), plus a comparison ranking plans by total of payments. Provider presets are labelled examples quoted from dated primary-text snapshots, never an offer: PayPal Pay in 4 (P1: four interest-free biweekly instalments, first at purchase, $10 to $2,000 band, lender PayPal, Inc. NMLS# 910457), Klarna Pay in 4 (K1) plus its apply-in-advance service-fee labelled example ($248 purchase, $62 down and three biweekly $62, $4.99 service fee, 35.68% APR stated, WebBank, K2), Afterpay Pay in 4 (A1/A2) plus its finance-fee labelled example ($110 loan, $27.50 down and three biweekly $28.26, 36% APR stated, First Electronic Bank for fee-bearing loans, A1), and Affirm at 0 to 36% APR with its $400 monthly labelled example ($80 down, 12 monthly $28.88, 15% APR stated) and $400 pay-in-4 labelled example (four biweekly $100, 0% APR) (F1/F2), all fetched 2026-10-28 from research/clause-snapshots/bnpl-paypal-2026-10/SNAPSHOT.md, bnpl-klarna-2026-10, bnpl-afterpay-2026-10 and bnpl-affirm-2026-10 (row BNPL-TERMS-PRIMARY-TEXT-1). Terms vary by provider, merchant and credit decision: every preset carries the provider's own qualifier quotes, its lender of record where stated, and its late-fee clause as information only, because late fees are contingent on missed payments and never part of a schedule. An interest-bearing custom plan must carry its quoted instalment amount: this node compares quoted plans and does not originate an amortizing schedule. Unknown preset, unknown cadence, preset and explicit fields together, invalid principal, instalment count, fee or APR values, non-USD currency, more than 8 plans and an empty plan list are refused by name. Zero network, zero PII, synthetic values only.

- Page: https://ainumbers.co/chaingraph/art-779-bnpl-plan-comparator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-779-bnpl-plan-comparator.md
- MCP tool: compare_bnpl_plans (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- principal (number, required): Purchase amount in USD to split across each plan.
- currency (string, optional): Currency; only USD is supported (US consumer terms).
- plans (array, required): Plans to compare; preset entries inherit a provider's published plan shape.

## Sample

```json
{
  "principal": 248,
  "plans": [
    {
      "preset": "klarna_service_fee_example"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compare_bnpl_plans` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
