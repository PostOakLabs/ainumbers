# Green Finance & Transition Plan

Greenwashing risk assessment > SLL KPI adequacy > EU Green Bond Standard screening > net-zero alignment scoring > transition-plan adequacy: composite green-finance transition mandate.

- Page: https://ainumbers.co/chaingraph/chains/green-finance-transition.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/green-finance-transition.md

## Workflow chain: Green Finance & Transition Plan

Greenwashing risk assessment > SLL KPI adequacy > EU Green Bond Standard screening > net-zero alignment scoring > transition-plan adequacy: composite green-finance transition mandate.

Domain: Climate & Sustainable Finance

### Steps

1. 365-greenwashing-risk-assessor
   greenwashing_risk_score and disclosure_gaps feed Stage 2 SLL KPI adequacy
2. 366-sll-kpi-adequacy-checker
   kpi_adequacy_assessment and improvement_flags feed Stage 3 EUGB screening
3. 381-eu-green-bond-standard-screener
   eugb_compliance_status and use_of_proceeds feed Stage 4 net-zero alignment
4. 382-net-zero-alignment-scorer
   net_zero_alignment_score and gap_to_target feed Stage 5 transition-plan adequacy
5. 385-transition-plan-adequacy-checker
   transition_plan_adequacy and composite_score - final green-finance transition mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
