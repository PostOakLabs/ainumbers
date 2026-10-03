# DORA RoI Annual Cycle

DORA (EU 2022/2554) Art. 28/30 Register of Information annual build in one artifact: criticality designations for ICT third-party providers and functions are recorded as review_required approval records (a judgment call, not kernel-decided); the annual RoI release itself requires a dual_control(2) gate with a management-body-role approver before submission, reflecting the Art. 5 personal management-body accountability for ICT risk management - both recorded now via the §27 Human Accountability vocabulary, enforced once HA-RETRO-1's runtime gating is wired to this chain. Each annual cycle's approvals and gate outcome export as one evidence bundle citing the Art. 5 accountability basis. Never a filed submission.

- Page: https://ainumbers.co/chaingraph/chains/dora-roi-annual-cycle.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/dora-roi-annual-cycle.md

## Workflow chain: DORA RoI Annual Cycle

DORA (EU 2022/2554) Art. 28/30 Register of Information annual build in one artifact: criticality designations for ICT third-party providers and functions are recorded as review_required approval records (a judgment call, not kernel-decided); the annual RoI release itself requires a dual_control(2) gate with a management-body-role approver before submission, reflecting the Art. 5 personal management-body accountability for ICT risk management - both recorded now via the §27 Human Accountability vocabulary, enforced once HA-RETRO-1's runtime gating is wired to this chain. Each annual cycle's approvals and gate outcome export as one evidence bundle citing the Art. 5 accountability basis. Never a filed submission.

Domain: DORA / NIS2 / ICT Resilience

### Steps

1. art-466-dora-roi-builder
   Constructs and cross-validates the RoI template set - final stage. Criticality designations on functions/providers route as review_required approval records (judgment, not kernel-decided). The annual release requires a dual_control(2) gate (preparer + management-body-role approver, Art. 5 personal accountability) before submission, recorded now and runtime-gated once HA-RETRO-1 is wired to this chain; the cycle's approvals and gate outcome export as one evidence bundle citing that Art. 5 basis.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The register of information is due at the supervisor. Does it cross-reference cleanly between providers and the functions they host?
Run the AINumbers MCP tool `run_chain` with {"chain":"dora-roi-annual-cycle"} and read `art-466-dora-roi-builder.validation_report.summary.overall_pass`.
Re-run with `inputs` for `art-466-dora-roi-builder`, reusing the values that result echoed, with `contracts` changed so its provider_id points at prov-2, a provider with no function. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/dora-roi-annual-cycle.html
