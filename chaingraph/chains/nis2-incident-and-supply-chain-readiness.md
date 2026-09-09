# NIS2 Incident Reporting & Supply-Chain Readiness

Score whether an operational event meets the NIS2 Article 23 significant-incident threshold (firing the 24h/72h/30-day reporting clocks), assess ICT vendor due-diligence posture against Art. 21(2)(d) and ENISA supply-chain guidance, and check Art. 20 management-body governance readiness including personal-liability risk flag. Terminal stage exports governance attestation with execution_hash.

- Page: https://ainumbers.co/chaingraph/chains/nis2-incident-and-supply-chain-readiness.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/nis2-incident-and-supply-chain-readiness.md

## Workflow chain: NIS2 Incident Reporting & Supply-Chain Readiness

Score whether an operational event meets the NIS2 Article 23 significant-incident threshold (firing the 24h/72h/30-day reporting clocks), assess ICT vendor due-diligence posture against Art. 21(2)(d) and ENISA supply-chain guidance, and check Art. 20 management-body governance readiness including personal-liability risk flag. Terminal stage exports governance attestation with execution_hash.

Domain: DORA / NIS2 / ICT Resilience

### Steps

1. art-144-nis2-incident-significance-scorer
   Incident significance verdict and reporting clocks feed ICT supply-chain diligence scorer
2. art-145-nis2-ict-supply-chain-diligence-scorer
   Vendor risk tier and remediation checklist feed governance readiness checker
3. art-146-nis2-governance-readiness-checker
   Governance grade and personal liability risk - governance attestation with execution_hash

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
