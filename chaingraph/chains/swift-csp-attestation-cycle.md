# Customer Security Controls Attestation Cycle

Two-step annual attestation cycle over a declared architecture type and component inventory. Step 1 derives the applicable mandatory and advisory control set from the policy-supplied control-framework version, scores declared implementation status, and returns coverage figures, a gap list keyed by published control number, an evidence index aligned to the framework's own supporting-evidence column, and an explicit not-applicable set with stated reasons so an omission cannot read as a pass. Step 2 tests assessor eligibility: assessment route, claimed certifications against the required set, independence from the implementer by distinct-identity counting, and assessment-date validity against the attestation deadline. Step 1 is gated hold while any mandatory control gap remains. Step 2 is gated reject, a terminal human rejection, when the assessor is ineligible, and the failing predicate is carried as the reason code. Release of the attestation bundle is a dual-control act with the assessor bound as reviewer and the attesting officer as approver; an examiner role binding grants inspection only and never an approval path. The framework's annual 31 December attestation deadline is a fact about the regime. This surface produces the firm's own evidence: it is not a Swift endorsement, not an assessor accreditation, and does not satisfy a KYC-SA submission.

- Page: https://ainumbers.co/chaingraph/chains/swift-csp-attestation-cycle.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/swift-csp-attestation-cycle.md

## Workflow chain: Customer Security Controls Attestation Cycle

Two-step annual attestation cycle over a declared architecture type and component inventory. Step 1 derives the applicable mandatory and advisory control set from the policy-supplied control-framework version, scores declared implementation status, and returns coverage figures, a gap list keyed by published control number, an evidence index aligned to the framework's own supporting-evidence column, and an explicit not-applicable set with stated reasons so an omission cannot read as a pass. Step 2 tests assessor eligibility: assessment route, claimed certifications against the required set, independence from the implementer by distinct-identity counting, and assessment-date validity against the attestation deadline. Step 1 is gated hold while any mandatory control gap remains. Step 2 is gated reject, a terminal human rejection, when the assessor is ineligible, and the failing predicate is carried as the reason code. Release of the attestation bundle is a dual-control act with the assessor bound as reviewer and the attesting officer as approver; an examiner role binding grants inspection only and never an approval path. The framework's annual 31 December attestation deadline is a fact about the regime. This surface produces the firm's own evidence: it is not a Swift endorsement, not an assessor accreditation, and does not satisfy a KYC-SA submission.

Domain: DORA / NIS2 / ICT Resilience

### Steps

1. art-486-cscf-control-applicability
   Applicable control set, coverage figures, gap list and evidence index keyed by control number feed the assessor-eligibility stage
2. art-487-assessor-independence-check
   Eligible or ineligible with the failing predicate named, closing the attestation evidence bundle. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
