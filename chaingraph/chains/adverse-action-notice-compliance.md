# Adverse Action Notice Compliance

Gated two-step chain for adverse action notice compliance. Step 1 builds the notice skeleton from SHAP-ranked FICO or VantageScore factor codes. Gate: action_taken=approved exits immediately (no notice required for approved applications). Denied, counteroffer, or incomplete applications continue to Step 2 notice validation against Reg B §1002.9 completeness requirements and CFPB Circular prohibited-vague-code list.

- Page: https://ainumbers.co/chaingraph/chains/adverse-action-notice-compliance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/adverse-action-notice-compliance.md

## Workflow chain: Adverse Action Notice Compliance

Gated two-step chain for adverse action notice compliance. Step 1 builds the notice skeleton from SHAP-ranked FICO or VantageScore factor codes. Gate: action_taken=approved exits immediately (no notice required for approved applications). Denied, counteroffer, or incomplete applications continue to Step 2 notice validation against Reg B §1002.9 completeness requirements and CFPB Circular prohibited-vague-code list.

Domain: Consumer Lending & Fair Lending

### Steps

1. art-228-build-adverse-action-notice
   Notice skeleton with SHAP-ranked factor codes. Gate: action_taken=approved exits (no notice required); denied/counteroffer continues to validation.
2. art-227-validate-adverse-action-notice
   Compliance score (0-100), violation list, FCRA §615(a) completeness check. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
