# DPA Article 28 Completeness Checker

Checks a data processing agreement against GDPR Article 28(3)'s 12 mandatory processor clauses - subject-matter, duration, nature/purpose, data categories, controller-instructions-only, confidentiality, Article 32 security, sub-processor authorization, data-subject-rights assistance, breach/DPIA assistance, deletion/return, and audit rights. Deterministic checklist over a caller-declared present/missing/weak status per clause, returning a completeness verdict and coverage percentage. This node reads the caller's own compliance reading of an agreement - it never vendors, assembles, or redistributes any third-party template body. Not legal advice and not a determination that any agreement is compliant. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-409-dpa-art28-completeness-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-409-dpa-art28-completeness-checker.md
- MCP tool: check_dpa_gdpr_art28 (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "clause_status": {
    "subject_matter": "present",
    "duration": "present",
    "nature_purpose": "present",
    "data_categories": "present",
    "controller_instructions_only": "present",
    "confidentiality": "present",
    "article32_security": "present",
    "subprocessor_authorization": "present",
    "data_subject_rights_assistance": "present",
    "breach_dpia_assistance": "present",
    "deletion_or_return": "present",
    "audit_rights": "present"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_dpa_gdpr_art28` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
