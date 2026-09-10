# IDV/KYC Session Evidence Chain

Structural camera-provenance check on an IDV/KYC capture's C2PA manifest (art-361), feeding a hash-chained session receipt that binds the verifier's declared results, capture-chain digest, and injection/liveness/document/device verdicts into a single tamper-evident record (art-359). Every verifier-sourced field is labeled asserted: the chain attests the session record as declared, never detection quality or subject genuineness, and consumes only digests, booleans, and scores - zero PII by construction. Gate: an asserted injection-detection verdict of true routes to the verification-failure incident composer (art-418) for fraud-team/regulator/insurer evidence; a clean session ends the chain.

- Page: https://ainumbers.co/chaingraph/chains/idv-session-evidence.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/idv-session-evidence.md

## Workflow chain: IDV/KYC Session Evidence Chain

Structural camera-provenance check on an IDV/KYC capture's C2PA manifest (art-361), feeding a hash-chained session receipt that binds the verifier's declared results, capture-chain digest, and injection/liveness/document/device verdicts into a single tamper-evident record (art-359). Every verifier-sourced field is labeled asserted: the chain attests the session record as declared, never detection quality or subject genuineness, and consumes only digests, booleans, and scores - zero PII by construction. Gate: an asserted injection-detection verdict of true routes to the verification-failure incident composer (art-418) for fraud-team/regulator/insurer evidence; a clean session ends the chain.

Domain: Financial Crime & KYC

### Steps

1. art-361-camera-provenance-check
   C2PA manifest structural verdict and digitalSourceType/trainedAlgorithmicMedia flag feed the session receipt builder's capture-chain field.
2. art-359-idv-session-receipt-builder
   Hash-chained IDV/KYC session receipt. Gate: an asserted injection-detection verdict of true routes to the verification-failure incident composer; a clean session ends the chain.
3. art-418-idv-verification-failure-incident-composer
   Verification-failure incident evidence record for fraud teams, regulators, and insurers - final stage, cross-linked to the session receipt hash.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
