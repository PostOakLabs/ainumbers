# Insurance AI Bias Attestation

Gated two-step chain for Colorado SB 21-169 / Reg. 10-1-1 annual bias attestation for insurance AI models. Step 1 tests BIFSG proxy bias thresholds (art-239) from aggregate regression outputs (ZERO PII). Gate: bias_detected=true proceeds to NAIC AIS readiness assessment (art-240) for remediation planning. When bias is not detected, chain terminates (annual attestation evidence is the execution_hash anchored at anchor.ainumbers.co/mcp). Step 2 (art-240) scores insurance AI program readiness across 6 NAIC AIS dimensions and produces exam-ready gap list.

- Page: https://ainumbers.co/chaingraph/chains/insurance-ai-bias-attestation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/insurance-ai-bias-attestation.md

## Workflow chain: Insurance AI Bias Attestation

Gated two-step chain for Colorado SB 21-169 / Reg. 10-1-1 annual bias attestation for insurance AI models. Step 1 tests BIFSG proxy bias thresholds (art-239) from aggregate regression outputs (ZERO PII). Gate: bias_detected=true proceeds to NAIC AIS readiness assessment (art-240) for remediation planning. When bias is not detected, chain terminates (annual attestation evidence is the execution_hash anchored at anchor.ainumbers.co/mcp). Step 2 (art-240) scores insurance AI program readiness across 6 NAIC AIS dimensions and produces exam-ready gap list.

Domain: AI & Agent Governance

### Steps

1. art-239-test-bifsg-bias-thresholds
   BIFSG proxy bias test result. Gate: bias_detected=true proceeds to NAIC AIS readiness assessment; PASS exits with execution_hash for annual attestation anchor.
2. art-240-assess-naic-ais-program-readiness
   NAIC AIS readiness tier, dimension scores, and exam-ready gap list. Only reached when bias is detected. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
