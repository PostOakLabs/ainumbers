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

### Ask your agent

Question: The vendor calls this authenticator quantum-ready. Does it meet the ML-DSA-65 conformance target as shipped?
Run the AINumbers MCP tool `run_chain` with {"chain":"pqc-fido-webauthn"} and read `art-88-fido-pqc-conformance-checker.conformant`.
Re-run with `inputs` for `art-88-fido-pqc-conformance-checker`, reusing the values that result echoed, with `authenticator` changed so cose_algorithms is [-49] and ctap_version is 2.3. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/pqc-fido-webauthn.html
