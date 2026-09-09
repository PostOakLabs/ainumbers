# Validate Adverse Action Notice

Validates an adverse action notice against Reg B §1002.9 completeness requirements: reason count (max 4), prohibited vague reason codes (CFPB Circulars 2022-03/2023-03), required content fields (creditor name, date, statement of rights), and FCRA §615(a) rights disclosure when a credit score was used. Outputs compliance_score (0-100), violation list, and a remediation checklist. Reg B 12 CFR §1002.9, ECOA 15 USC §1691, FCRA §615(a).

- Page: https://ainumbers.co/chaingraph/art-227-validate-adverse-action-notice.html
- Markdown twin: https://ainumbers.co/chaingraph/art-227-validate-adverse-action-notice.md
- MCP tool: validate_adverse_action_notice (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- action_taken (unknown, required)
- credit_score_used (unknown, required)
- notice_includes_action_taken (unknown, required)
- notice_includes_credit_bureau_info (unknown, required)
- notice_includes_creditor_name (unknown, required)
- notice_includes_date (unknown, required)
- notice_includes_dispute_right (unknown, required)
- notice_includes_fcra_rights (unknown, required)
- notice_includes_right_to_copy (unknown, required)
- reason_code_source (unknown, required)
- reasons (unknown, required)

## Outputs

- action_taken (string, optional)
- compliance_score (integer, optional)
- compliant (boolean, optional)
- credit_score_used (boolean, optional)
- fcra_required (boolean, optional)
- fcra_violations (integer, optional)
- pii_note (string, optional)
- reason_count (integer, optional)
- reason_count_valid (boolean, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- violation_count (integer, optional)
- violations (array, optional)
- warning_count (integer, optional)
- warnings (array, optional)

## Sample

```json
{
  "reasons": [
    {
      "code": "22",
      "source": "fico"
    },
    {
      "code": "10",
      "source": "fico"
    },
    {
      "code": "05",
      "source": "fico"
    },
    {
      "code": "08",
      "source": "fico"
    }
  ],
  "action_taken": "denied",
  "reason_code_source": "fico",
  "credit_score_used": true,
  "notice_includes_creditor_name": true,
  "notice_includes_action_taken": true,
  "notice_includes_date": true,
  "notice_includes_fcra_rights": true,
  "notice_includes_credit_bureau_info": true,
  "notice_includes_right_to_copy": true,
  "notice_includes_dispute_right": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_adverse_action_notice` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
