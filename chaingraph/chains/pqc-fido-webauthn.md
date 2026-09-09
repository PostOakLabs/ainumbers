# FIDO2 / WebAuthn PQC Conformance

FIDO2/WebAuthn/COSE ML-DSA conformance vs IANA identifiers + CTAP2.3 (ART-88) -> audit receipt (cry-05). Credential crypto-suite migration; credential FORMAT/protocol conformance belongs to any future EUDI wave.

- Page: https://ainumbers.co/chaingraph/chains/pqc-fido-webauthn.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/pqc-fido-webauthn.md

## Workflow chain: FIDO2 / WebAuthn PQC Conformance

FIDO2/WebAuthn/COSE ML-DSA conformance vs IANA identifiers + CTAP2.3 (ART-88) -> audit receipt (cry-05). Credential crypto-suite migration; credential FORMAT/protocol conformance belongs to any future EUDI wave.

Domain: Post-Quantum Cryptography

### Steps

1. art-88-fido-pqc-conformance-checker
   conformance verdict (H1) feeds the aggregator
2. cry-05-agent-action-audit-trail-aggregator
   Exports composite FIDO PQC conformance artifact with execution_hash (H2) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
