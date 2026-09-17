# MiCA CASP Passporting & Market Surveillance

CASP authorisation check > passporting readiness > market-abuse surveillance mapping > periodic reporting obligations > significant-token threshold: composite MiCA CASP mandate.

- Page: https://ainumbers.co/chaingraph/chains/mica-passporting-surveillance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mica-passporting-surveillance.md

## Workflow chain: MiCA CASP Passporting & Market Surveillance

CASP authorisation check > passporting readiness > market-abuse surveillance mapping > periodic reporting obligations > significant-token threshold: composite MiCA CASP mandate.

Domain: Digital-Asset Rails

### Steps

1. 332-mica-casp-authorization-checker
   casp_auth_status and gaps feed Stage 2 passporting readiness
2. 393-mica-casp-passporting-readiness-checker
   passporting_pathway and timeline feed Stage 3 market-abuse mapping
3. 392-mica-market-abuse-surveillance-mapper
   mar_surveillance_requirements feed Stage 4 periodic reporting obligations
4. 394-mica-periodic-reporting-obligation-mapper
   reporting_obligations and deadlines feed Stage 5 significant-token threshold
5. 391-mica-significant-token-threshold-calculator
   threshold_status and enhanced_obligations - final MiCA CASP mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
