# Conditional-Relief Collateral Evidence

Six-step composed evidence chain for accepting a payment stablecoin as collateral under a conditional regulatory relief. Step 1 confirms GENIUS Act reserve-attestation readiness for the permitted payment stablecoin. Step 2 checks the MiCA reserve disclosure and records, via a gate on token_type, whether the issuer is also a regulated e-money-token issuer; either branch continues to the reserve-proof stage, since the GENIUS Act attestation from step 1 stands on its own regardless of MiCA classification. Step 3 independently verifies the reserve proof and Chainlink PoR/NAVLink depeg staleness. Step 4 classifies the tokenized leg's DTC/Fed eligibility and Basel HQLA tier. Step 5 applies the Basel CRE22 comprehensive-approach collateral haircut. Step 6 builds the conditional-relief collateral receipt: a per-condition PASS/FAIL/UNDECIDABLE verdict against the caller's own condition set, a version-staleness check, the applicable capital charge, and the revocation-exposure figure if the relief were withdrawn.

- Page: https://ainumbers.co/chaingraph/chains/conditional-relief-collateral.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/conditional-relief-collateral.md

## Workflow chain: Conditional-Relief Collateral Evidence

Six-step composed evidence chain for accepting a payment stablecoin as collateral under a conditional regulatory relief. Step 1 confirms GENIUS Act reserve-attestation readiness for the permitted payment stablecoin. Step 2 checks the MiCA reserve disclosure and records, via a gate on token_type, whether the issuer is also a regulated e-money-token issuer; either branch continues to the reserve-proof stage, since the GENIUS Act attestation from step 1 stands on its own regardless of MiCA classification. Step 3 independently verifies the reserve proof and Chainlink PoR/NAVLink depeg staleness. Step 4 classifies the tokenized leg's DTC/Fed eligibility and Basel HQLA tier. Step 5 applies the Basel CRE22 comprehensive-approach collateral haircut. Step 6 builds the conditional-relief collateral receipt: a per-condition PASS/FAIL/UNDECIDABLE verdict against the caller's own condition set, a version-staleness check, the applicable capital charge, and the revocation-exposure figure if the relief were withdrawn.

Domain: Digital-Asset Rails

### Steps

1. art-06-genius-act-reserve-attestation
   attestation_readiness_determination and coverage_ratio_pct establish the payment stablecoin's GENIUS Act reserve-attestation readiness before the MiCA leg is checked.
2. art-512-check-mica-reserve-disclosure
   token_type, coverage, and judgment_required record whether the issuer is also a MiCA e-money-token issuer and whether that leg resolved cleanly.
3. art-280-reserve-proof-verifier
   reserve_proof_determination and root_hash_match feed the tokenized-collateral eligibility check with an independently verified reserve and depeg-staleness record.
4. 505-tokenized-collateral-eligibility-checker
   dtc_status and hqla_tier feed the Basel haircut engine as the tokenized leg's eligibility tier.
5. art-444-collateral-haircut-engine
   collateral_adjusted_total and net_exposure feed the conditional-relief receipt as the haircut-adjusted collateral value.
6. art-514-conditional-relief-collateral-receipt
   all_conditions_met, applicable_capital_charge, and revocation_capital_delta are the chain output.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
