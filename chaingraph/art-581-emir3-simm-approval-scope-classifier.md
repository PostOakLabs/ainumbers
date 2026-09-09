# EMIR 3 SIMM Approval-Scope Classifier

Classifies which EMIR 3 initial-margin model-approval obligations apply to a caller-declared counterparty profile across four items: prior competent-authority (NCA) authorisation before using or changing an initial-margin model under Article 11(12a) (inserted by Regulation (EU) 2024/2987); EBA central validation of a pro forma model's elements and general aspects, also under Article 11(12a), for the ISDA SIMM case; the recurring end-March annual application-data update to the home NCA for an already-authorised SIMM user, under the Article 11(15) supervisory-procedure process; and the 2026 EBA validation-system onboarding window published for SIMM applicants, open through end-August 2026. Each obligation resolves to IN_SCOPE, OUT_OF_SCOPE, or INDETERMINATE, and INDETERMINATE covers every case where a required fact - a declared home competent authority, or a model-status distinction between a new application and an already-authorised model - was not supplied; none is guessed toward a passing verdict. Carries zero ISDA SIMM methodology content: no risk weight, correlation, bucket, or sensitivity math, and no reproduction of any ISDA document. Cites EMIR Article 11(12a) and Article 11(15) as amended by Regulation (EU) 2024/2987, re-verified against EUR-Lex and EBA's published process at build; the implementing RTS and Guidelines on initial-margin model authorisation were at public-consultation stage (17 March - 17 June 2026) and not yet finalised as of the build date, stated plainly in-page. Distinct from art-576's Active Account Requirement classifier - this is the initial-margin model-approval track, not the clearing-obligation track. Stated boundary: this is not legal advice, expresses no ISDA endorsement, and does not perform any methodology-level verification of an actual initial-margin model - that omission is deliberate and disclosed in-page.

- Page: https://ainumbers.co/chaingraph/art-581-emir3-simm-approval-scope-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-581-emir3-simm-approval-scope-classifier.md
- MCP tool: classify_emir3_simm_approval_scope (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of_date (unknown, optional)
- competent_authority_declared (unknown, optional)
- counterparty_type (unknown, optional)
- model_status (unknown, optional)
- model_type (unknown, optional)
- subject_to_bilateral_im (unknown, optional)

## Outputs

- as_of_date (string, optional)
- competent_authority_declared (boolean, optional)
- counterparty_type (string, optional)
- isda_endorsement (boolean, optional)
- methodology_verification (string, optional)
- model_status (string, optional)
- model_type (string, optional)
- obligations (array, optional)
- subject_to_bilateral_im (boolean, optional)

## Sample

```json
{
  "counterparty_type": "financial_counterparty",
  "subject_to_bilateral_im": true,
  "model_type": "isda_simm",
  "model_status": "new_application",
  "competent_authority_declared": true,
  "as_of_date": "2026-08-07"
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_emir3_simm_approval_scope` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
