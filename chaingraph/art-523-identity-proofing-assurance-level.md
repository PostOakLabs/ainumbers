# Identity-Proofing Assurance Level Evaluator

Rates whether a DECLARED identity-evidence set reaches a DECLARED target level of a caller-supplied, versioned assurance-level framework (the art-444 policy-input pattern) - never a hardcoded framework such as NIST 800-63-3 or eIDAS. The level definition supplies levels ordered lowest-to-highest rigor, each with criteria naming a required evidence type and a numeric min_strength on a caller-normalized 0-100 scale; the kernel never interprets a framework's own named tiers. A criterion the definition cannot express (no required_evidence_type or no min_strength) is flagged IAL_DEFINITION_INSUFFICIENT, distinct from IAL_SHORTFALL (evidence present but not meeting a well-formed criterion) - the two are never conflated. When the target level is not met, achieved level falls back to the highest fully-met level below it. This node rates an evidence set against a declared policy; it does NOT assert that a person is who they claim to be, and no output or copy implies verification of a natural person. No identity attributes are ever computed over - evidence items are types, strengths and verification methods, with an optional opaque attribute reference (caller-supplied, no commitment scheme claimed by this node) carried through unread, never a plaintext value. No approver identity, signature, approval field or role - manual review/EDD escalation is a separate signed §27 human_accountability_record, not minted by this kernel. This is the assurance-LEVEL evaluator specifically, distinct from any private-check-receipt evidencing scheme or a re-verification-cadence evaluator (neither built in this exercise). Not 490-eudi-kyc-flow-designer (an eIDAS/LoA-specific flow-design tool) - this is framework-agnostic by construction and takes any structurally-expressible level definition as a policy input, with no dependency on any named jurisdiction or procurement.

- Page: https://ainumbers.co/chaingraph/art-523-identity-proofing-assurance-level.html
- Markdown twin: https://ainumbers.co/chaingraph/art-523-identity-proofing-assurance-level.md
- MCP tool: compute_identity_proofing_assurance_level (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (unknown, required)
- declared_target_level (unknown, required)
- evidence_items (unknown, required)
- level_definition (unknown, required)

## Outputs

- achieved_level (string, optional)
- as_of (string, optional)
- criteria_evaluated (integer, optional)
- criteria_met (integer, optional)
- criteria_shortfall_count (integer, optional)
- criteria_undecidable_count (integer, optional)
- declared_target_level (string, optional)
- evidence_item_count (integer, optional)
- framework_id (string, optional)
- framework_version (string, optional)
- levels_defined (integer, optional)
- note (string, optional)
- shortfall (array, optional)
- target_level_found (boolean, optional)
- target_met (boolean, optional)
- undecidable (array, optional)

## Sample

```json
{
  "level_definition": {
    "framework_id": "vendor-framework-A-tiers",
    "framework_version": "2026-01",
    "levels": [
      {
        "level_id": "tier-1",
        "criteria": [
          {
            "criterion_id": "id-doc",
            "description": "one identity document",
            "required_evidence_type": "government_id",
            "min_strength": 30
          }
        ]
      },
      {
        "level_id": "tier-2",
        "criteria": [
          {
            "criterion_id": "id-doc",
            "description": "verified identity document",
            "required_evidence_type": "government_id",
            "min_strength": 60
          },
          {
            "criterion_id": "biometric",
            "description": "biometric match",
            "required_evidence_type": "biometric_match",
            "min_strength": 60
          }
        ]
      },
      {
        "level_id": "tier-3",
        "criteria": [
          {
            "criterion_id": "id-doc",
            "description": "verified identity document, high assurance",
            "required_evidence_type": "government_id",
            "min_strength": 85
          },
          {
            "criterion_id": "biometric",
            "description": "biometric match, high assurance",
            "required_evidence_type": "biometric_match",
            "min_strength": 85
          }
        ]
      }
    ]
  },
  "evidence_items": [
    {
      "evidence_id": "e1",
      "type": "government_id",
      "strength": 70,
      "verification_method": "document_authentication"
    },
    {
      "evidence_id": "e2",
      "type": "biometric_match",
      "strength": 65,
      "verification_method": "live_capture"
    }
  ],
  "declared_target_level": "tier-2",
  "as_of": "2026-08-01"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_identity_proofing_assurance_level` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

## Workflow chain: Government Payment Programme Assurance

Lifecycle-of-the-programme evidence, complementing the payment-level lifecycle chain: entering a programme (identity assurance for an onboarding agency), migrating into it (legacy data arrives complete and reconcilable), and leaving it (the operator can hand the data back in an open format). Rates a declared identity-evidence set against a declared assurance-level framework, then checks declared legacy migration counts and control totals for completeness, then evaluates a declared operator-exit and data-portability posture. Every fact is a caller-declared input - no country, agency, or framework is hardcoded.

Domain: Public Finance & Government Payments

### Steps

1. art-523-identity-proofing-assurance-level
   the achieved assurance level and any IAL_SHORTFALL/IAL_DEFINITION_INSUFFICIENT flags feed the migration-completeness check as the onboarding agency's identity posture
2. art-519-payment-data-migration-completeness
   per-partition completeness, aggregate reconciliation, and transformation-coverage verdicts feed the operator-exit portability check as the migrated data's known state
3. art-520-operator-exit-data-portability
   the stranded-category list and control/dependency flags are the terminal evidence for this run

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
