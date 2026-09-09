# NAIC AI Systems Program Readiness Assessment

Scores insurance AI program readiness against the NAIC Model Bulletin on the Use of Artificial Intelligence Systems by Insurers (adopted 4 Dec 2023) and the NAIC AI Systems Evaluation Tool (exposure draft v4.0, Sep 2025). Six dimensions scored 0-3 (Not Started/Planning/Partial/Implemented): Governance & Accountability, Risk Management Framework, Data Governance & Bias Monitoring, Testing & Validation, Transparency & Explainability, Complaint & Audit Readiness. Total 0-18; readiness tier: GREEN >= 78% (EXAM_READY), YELLOW >= 44% (IN_PROGRESS), RED < 44% (SIGNIFICANT_GAPS). 24+ states have adopted or substantially adopted the NAIC AI Model Bulletin as of mid-2026; 12-state market-conduct exam pilot ran Jan-Sep 2026 (verify current adoption status with NAIC and your state regulator).

- Page: https://ainumbers.co/chaingraph/art-240-assess-naic-ais-program-readiness.html
- Markdown twin: https://ainumbers.co/chaingraph/art-240-assess-naic-ais-program-readiness.md
- MCP tool: assess_naic_ais_program_readiness (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "governance_score": 3,
  "risk_mgmt_score": 3,
  "data_governance_score": 3,
  "testing_score": 3,
  "transparency_score": 3,
  "audit_score": 3
}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_naic_ais_program_readiness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
