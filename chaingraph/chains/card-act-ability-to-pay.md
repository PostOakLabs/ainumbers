# CARD Act Ability to Pay

Gated two-step chain for CARD Act ability-to-pay compliance. Step 1 evaluates ATP per §1026.51 (DTI threshold 45%, under-21 income restriction, penalty fee safe harbor $32/$43). Gate: atp_passes=true exits immediately (approved). Failed ATP continues to Step 2: adverse action notice build per Reg B §1002.9 with SHAP-ranked factor codes. CFPB $8 late fee rule vacated January 17, 2025 (Fifth Circuit No. 24-10266); $32/$43 remain in effect.

- Page: https://ainumbers.co/chaingraph/chains/card-act-ability-to-pay.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/card-act-ability-to-pay.md

## Workflow chain: CARD Act Ability to Pay

Gated two-step chain for CARD Act ability-to-pay compliance. Step 1 evaluates ATP per §1026.51 (DTI threshold 45%, under-21 income restriction, penalty fee safe harbor $32/$43). Gate: atp_passes=true exits immediately (approved). Failed ATP continues to Step 2: adverse action notice build per Reg B §1002.9 with SHAP-ranked factor codes. CFPB $8 late fee rule vacated January 17, 2025 (Fifth Circuit No. 24-10266); $32/$43 remain in effect.

Domain: Consumer Lending & Fair Lending

### Steps

1. art-233-check-card-act-ability-to-pay
   ATP decision with DTI, under-21 gate, and penalty fee safe harbor. Gate: atp_passes=true exits (approved); failed ATP continues to adverse action notice.
2. art-228-build-adverse-action-notice
   Adverse action notice skeleton per Reg B §1002.9 with SHAP-ranked factor codes. Only reached when ATP fails. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
