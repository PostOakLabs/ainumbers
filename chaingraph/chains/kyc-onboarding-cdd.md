# KYC Onboarding & Customer Due Diligence

CDD/EDD checklist > KYB/UBO mapping > PEP/sanctions simulation > adverse media profiling > KYC document checklist: composite KYC onboarding mandate.

- Page: https://ainumbers.co/chaingraph/chains/kyc-onboarding-cdd.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/kyc-onboarding-cdd.md

## Workflow chain: KYC Onboarding & Customer Due Diligence

CDD/EDD checklist > KYB/UBO mapping > PEP/sanctions simulation > adverse media profiling > KYC document checklist: composite KYC onboarding mandate.

Domain: Financial Crime & KYC

### Steps

1. 109-cdd-edd-checklist
   cdd_edd_requirements and risk_factors feed Stage 2 KYB/UBO mapping
2. 111-kyb-ubo-mapper
   ubo_structure and beneficial_owners feed Stage 3 PEP/sanctions simulation
3. 112-pep-sanctions-simulator
   pep_flags and sanctions_hits feed Stage 4 adverse media profiling
4. 113-adverse-media-profiler
   adverse_media_score and risk_narrative feed Stage 5 KYC document checklist
5. 114-kyc-document-checklist
   document_requirements and onboarding_checklist - final KYC onboarding mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
