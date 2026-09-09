# Basel Endgame & FRTB Capital Impact

Model-risk gap analysis > FRTB IMA eligibility > Basel III endgame capital impact > CRR3 output-floor phase-in > trading-desk IMA eligibility: composite Basel endgame capital mandate.

- Page: https://ainumbers.co/chaingraph/chains/basel-endgame-frtb-capital.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/basel-endgame-frtb-capital.md

## Workflow chain: Basel Endgame & FRTB Capital Impact

Model-risk gap analysis > FRTB IMA eligibility > Basel III endgame capital impact > CRR3 output-floor phase-in > trading-desk IMA eligibility: composite Basel endgame capital mandate.

Domain: Bank Capital & Credit Risk

### Steps

1. 339-sr2602-model-risk-mgmt-gap-analyzer
   model_risk_gaps and sr2602_alignment feed Stage 2 FRTB IMA eligibility
2. 340-frtb-internal-model-eligibility-checker
   ima_eligibility and desk_qualifications feed Stage 3 Basel III endgame capital
3. 341-basel-iii-endgame-capital-impact-estimator
   capital_impact_estimate and rwa_delta feed Stage 4 CRR3 output-floor calc
4. 357-crr3-output-floor-phase-in-calculator
   output_floor_rwa and phase_in_schedule feed Stage 5 trading-desk IMA assessment
5. 398-frtb-trading-desk-ima-eligibility-assessor
   desk_ima_status and composite capital_mandate - final Basel endgame mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
