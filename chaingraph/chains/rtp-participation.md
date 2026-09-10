# Real-Time Rail Participation

Score FedNow/RTP participation readiness, check network rules, size intraday credit, and build the AP2 policy mandate.

- Page: https://ainumbers.co/chaingraph/chains/rtp-participation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/rtp-participation.md

## Workflow chain: Real-Time Rail Participation

Score FedNow/RTP participation readiness, check network rules, size intraday credit, and build the AP2 policy mandate.

Domain: Cross-Border & Instant Payments

### Steps

1. 255-fednow-participation-readiness-scorer
   readiness_score and gap_items feed T229 RTP network rule check
2. 229-rtp-network-participation-checker
   rule_compliance and membership_flags feed T258 intraday credit sizing
3. 258-intraday-credit-facility-sizer
   credit_requirement and peak_exposure feed T259 AP2 policy build
4. 259-ap2-rtp-policy-builder
   Exports RTP participation Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
