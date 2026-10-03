# GENIUS Listing / Acceptance Pack

Three-step stablecoin issuer conformance pack for GENIUS Act monthly attestations: a pre-issuance reserve attestation check for 1:1 coverage and asset-class eligibility, the GENIUS Act monthly reserve disclosure lint against S.394 Section 4, and an issuer key revocation status check against a supplied BitstringStatusList credential. Composes into a bundle receipt of continuous conformance for an exchange listing desk or a mid-market stablecoin issuer, replacing a static PDF attestation with replayable evidence. Verify-only; asserts only the three conditions it checked, never a broader solvency or safe-to-list guarantee. The receipt does not yet carry a receipt:// resolver link (pending the N1 MCP Resources work) or witness-cosigned anchors (pending SPEC-TICK-088 Section WITNESS-1); both are planned upgrades, not missing requirements.

- Page: https://ainumbers.co/chaingraph/chains/genius-listing-acceptance-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/genius-listing-acceptance-pack.md

## Workflow chain: GENIUS Listing / Acceptance Pack

Three-step stablecoin issuer conformance pack for GENIUS Act monthly attestations: a pre-issuance reserve attestation check for 1:1 coverage and asset-class eligibility, the GENIUS Act monthly reserve disclosure lint against S.394 Section 4, and an issuer key revocation status check against a supplied BitstringStatusList credential. Composes into a bundle receipt of continuous conformance for an exchange listing desk or a mid-market stablecoin issuer, replacing a static PDF attestation with replayable evidence. Verify-only; asserts only the three conditions it checked, never a broader solvency or safe-to-list guarantee. The receipt does not yet carry a receipt:// resolver link (pending the N1 MCP Resources work) or witness-cosigned anchors (pending SPEC-TICK-088 Section WITNESS-1); both are planned upgrades, not missing requirements.

Domain: Digital-Asset Rails

### Steps

1. art-06-genius-act-reserve-attestation
   attestation_readiness_score and pre_check_pass feed the monthly disclosure lint
2. art-275-genius-reserve-disclosure-checker
   monthly disclosure pass or fail feeds the issuer revocation status check
3. art-287-revocation-status-verifier
   issuer key revocation status completes the GENIUS listing pack. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Exchange legal wants the listing file by Friday. Does the reserve attestation come back clean enough to attach?
Run the AINumbers MCP tool `run_chain` with {"chain":"genius-listing-acceptance-pack"} and read `art-06-genius-act-reserve-attestation.attestation_readiness_determination`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/genius-listing-acceptance-pack.html
