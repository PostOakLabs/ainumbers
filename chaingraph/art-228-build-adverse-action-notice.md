# Build Adverse Action Notice

Assembles an adverse action notice skeleton from SHAP-ranked principal-factor codes (FICO reason codes 01-40, VantageScore VS001-VS015). Resolves codes to full human-readable text, orders sections per Reg B §1002.9, and appends the FCRA §615(a) credit score disclosure when a credit score was used in the decision. Exports a receipt artifact. Reg B 12 CFR §1002.9, CFPB Circulars 2022-03/2023-03, FCRA §615(a).

- Page: https://ainumbers.co/chaingraph/art-228-build-adverse-action-notice.html
- Markdown twin: https://ainumbers.co/chaingraph/art-228-build-adverse-action-notice.md
- MCP tool: build_adverse_action_notice (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- action_taken (unknown, required)
- applicant_name_placeholder (unknown, required)
- credit_bureau_address (unknown, required)
- credit_bureau_name (unknown, required)
- credit_bureau_phone (unknown, required)
- credit_score (number, optional)
- credit_score_source (unknown, required)
- credit_score_used (unknown, required)
- creditor_name (unknown, required)
- date_of_action (unknown, required)
- factor_codes (unknown, required)
- reason_code_source (unknown, required)
- score_range_high (number, optional)
- score_range_low (number, optional)

## Outputs

- compliance_flags_raised (integer, optional)
- notice_sections (object, optional)
- pii_note (string, optional)
- receipt_metadata (object, optional)
- regulatory_basis (string, optional)
- resolved_reasons (array, optional)
- table_source (string, optional)
- table_version (string, optional)

## Sample

```json
{
  "action_taken": "denied",
  "applicant_name_placeholder": "Applicant",
  "creditor_name": "First National Bank",
  "date_of_action": "2026-01-15",
  "factor_codes": [
    {
      "code": "22",
      "source": "fico",
      "rank": 1,
      "shap_value": -0.32
    },
    {
      "code": "10",
      "source": "fico",
      "rank": 2,
      "shap_value": -0.18
    },
    {
      "code": "08",
      "source": "fico",
      "rank": 3,
      "shap_value": -0.12
    }
  ],
  "credit_score_used": true,
  "credit_score": 620,
  "credit_score_source": "FICO 8",
  "score_range_low": 300,
  "score_range_high": 850,
  "credit_bureau_name": "Equifax",
  "credit_bureau_address": "PO Box 740241 Atlanta GA 30374",
  "credit_bureau_phone": "1-800-685-1111"
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_adverse_action_notice` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
