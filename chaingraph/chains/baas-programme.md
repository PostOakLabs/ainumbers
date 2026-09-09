# BaaS Provider Selection to Compliance Mapping

BaaS provider scoring > embedded lending unit economics > compliance control mapping > B2B fraud detection.

- Page: https://ainumbers.co/chaingraph/chains/baas-programme.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/baas-programme.md

## Workflow chain: BaaS Provider Selection to Compliance Mapping

BaaS provider scoring > embedded lending unit economics > compliance control mapping > B2B fraud detection.

Domain: BaaS & Embedded Finance

### Steps

1. 152-baas-provider-comparator
   provider_scores and selection_rationale feed T160 unit economics
2. 160-embedded-lending-unit-economics
   unit_economics and margin_drivers feed T158 compliance mapping
3. 158-fintech-compliance-control-mapper
   control_gaps and framework_obligations feed T140 fraud detection
4. 140-b2b-payment-fraud-detector
   Exports BaaS programme Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
