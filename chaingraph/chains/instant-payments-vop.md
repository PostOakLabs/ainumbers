# Instant Payments & Verification of Payee Readiness

Rail participation readiness > Verification of Payee simulation > intraday liquidity sizing > IPR annual report > instant-payments policy mandate.

- Page: https://ainumbers.co/chaingraph/chains/instant-payments-vop.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/instant-payments-vop.md

## Workflow chain: Instant Payments & Verification of Payee Readiness

Rail participation readiness > Verification of Payee simulation > intraday liquidity sizing > IPR annual report > instant-payments policy mandate.

Domain: Cross-Border & Instant Payments

### Steps

1. 229-rtp-network-participation-checker
   participation_gaps feed Stage 2 VoP simulation
2. 289-verification-of-payee-simulator
   vop_match_rates and response_timing feed Stage 3 liquidity sizing
3. 258-intraday-credit-facility-sizer
   intraday_facility_size feeds Stage 4 IPR report
4. 349-sepa-ipr-annual-report-builder
   ipr_report_data feeds Stage 5 RTP policy mandate
5. 259-ap2-rtp-policy-builder
   Exports instant-payments Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
