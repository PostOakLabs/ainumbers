# Consumer Protection & FCA Consumer Duty

Vulnerability assessment > fair-value assessment > MiFID costs & charges > PRIIPs KID compliance > Consumer Duty board MI > composite consumer-duty mandate.

- Page: https://ainumbers.co/chaingraph/chains/consumer-protection.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/consumer-protection.md

## Workflow chain: Consumer Protection & FCA Consumer Duty

Vulnerability assessment > fair-value assessment > MiFID costs & charges > PRIIPs KID compliance > Consumer Duty board MI > composite consumer-duty mandate.

Domain: Consumer & Wealth Compliance

### Steps

1. 395-consumer-duty-vulnerability-assessment-builder
   vulnerability_segments feed Stage 2 fair-value assessment
2. 396-consumer-duty-price-value-assessment
   value_rating and outlier_flags feed Stage 3 costs aggregation
3. 428-mifid-costs-charges-calculator
   total_cost_ratio and cost_breakdown feed Stage 4 KID check
4. 448-priips-kid-compliance-checker
   kid_compliance_status feeds Stage 5 board MI framework
5. 397-consumer-duty-mi-framework-builder
   Exports consumer protection Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
