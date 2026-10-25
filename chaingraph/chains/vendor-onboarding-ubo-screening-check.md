# Vendor Onboarding UBO Screening Check

Screen a vendor's ultimate beneficial owners in four independent stages: first compute 25% UBO ownership from caller-supplied ownership structure under the FinCEN Customer Due Diligence rule (ART-268, bank KYB, not CTA/BOI beneficial ownership reporting and not the OFAC 50% rule); then screen caller-supplied persons against a caller-supplied private test list, never live sanctions data (ART-413, the screened list stays private); then assemble the screening evidence pack from caller-supplied run facts (ART-585); then a session receipt aggregating the run's execution hashes (CRY-05). All ownership, screening, and evidence facts are caller-supplied; findings are arithmetic findings, never compliance determinations. Federal only, not legal advice.

- Page: https://ainumbers.co/chaingraph/chains/vendor-onboarding-ubo-screening-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/vendor-onboarding-ubo-screening-check.md

## Workflow chain: Vendor Onboarding UBO Screening Check

Screen a vendor's ultimate beneficial owners in four independent stages: first compute 25% UBO ownership from caller-supplied ownership structure under the FinCEN Customer Due Diligence rule (ART-268, bank KYB, not CTA/BOI beneficial ownership reporting and not the OFAC 50% rule); then screen caller-supplied persons against a caller-supplied private test list, never live sanctions data (ART-413, the screened list stays private); then assemble the screening evidence pack from caller-supplied run facts (ART-585); then a session receipt aggregating the run's execution hashes (CRY-05). All ownership, screening, and evidence facts are caller-supplied; findings are arithmetic findings, never compliance determinations. Federal only, not legal advice.

Domain: Vendor Risk & Compliance

### Steps

1. art-268-compute-cdd-ownership-25pct
   Computes 25% ultimate beneficial owners from caller-supplied ownership structure under the FinCEN Customer Due Diligence rule (bank KYB; not CTA/BOI reporting, not the OFAC 50% rule)
2. art-413-screen-sanctions-private
   Screens caller-supplied persons against a caller-supplied private test list (never live sanctions data; the screened list stays private)
3. art-585-sanctions-screening-evidence-pack
   Assembles the sanctions screening evidence pack from caller-supplied run facts
4. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Which natural persons own 25% or more of this vendor through its ownership tiers?
Run the AINumbers MCP tool `run_chain` with {"chain":"vendor-onboarding-ubo-screening-check"} and read `art-268-compute-cdd-ownership-25pct.ownership_tiers`.
Re-run with `inputs` for `art-268-compute-cdd-ownership-25pct`, reusing the values that result echoed, with `ownership_tiers` changed so add a holding company tier above the vendor. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/vendor-onboarding-ubo-screening-check.html
