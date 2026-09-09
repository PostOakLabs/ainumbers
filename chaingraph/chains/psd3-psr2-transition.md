# PSD3 / PSR2 Transition Planning

EU IPR ISO20022 address validation > PSD3/PSR2 transition impact assessment > SCA exemption mapping > VRP mandate builder: composite PSD3 transition mandate.

- Page: https://ainumbers.co/chaingraph/chains/psd3-psr2-transition.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/psd3-psr2-transition.md

## Workflow chain: PSD3 / PSR2 Transition Planning

EU IPR ISO20022 address validation > PSD3/PSR2 transition impact assessment > SCA exemption mapping > VRP mandate builder: composite PSD3 transition mandate.

Domain: Open Banking / Open Finance

### Steps

1. 342-eu-ipr-iso20022-address-validator
   address_validation_errors and iso20022_ipr_compliance feed Stage 2 PSD3 impact assessment
2. 343-psd3-psr2-transition-impact-assessor
   psd3_impact_score and compliance_gaps feed Stage 3 SCA exemption mapping
3. 92-sca-exemption-mapper
   sca_exemption_options and liability_shift feed Stage 4 VRP mandate builder
4. 93-vrp-mandate-builder
   vrp_mandate_terms and composite_psd3_mandate - final PSD3/PSR2 transition mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
