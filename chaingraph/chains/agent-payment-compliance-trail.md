# Agent Payment Compliance Trail

A nine-stage agent payment workflow over caller-declared data. Step 1 validates the AP2 Intent, Cart and Payment mandate trio for signature-chain integrity, scope and limit consistency, expiry and over-spend (art-01). Step 2 then validates the on-behalf-of mandate the agent acts under, covering subject, scope, intent and validity window (art-151). Step 3 then cross-checks the declared KYA credential scope against the declared x402 payment payload (art-565). Step 4 then scores the declared transaction graph for laundering typologies (art-10). Step 5 then validates travel-rule field completeness across the declared transfer batch (art-104). Step 6 then binds the screening decision to the exact dataset version it was screened against (art-585). Step 7 then verifies the payment receipt against its mandate chain under the human-not-present guardrail (art-62). Step 8 then recomputes the Permit2 settlement digest for the declared payment (art-699). Step 9 aggregates the declared execution hashes of the session into one Merkle-root audit receipt (cry-05). Each step computes from its own declared inputs; the order is analytical, not a statutory sequence, and the workflow certifies nothing.

- Page: https://ainumbers.co/chaingraph/chains/agent-payment-compliance-trail.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agent-payment-compliance-trail.md

## Workflow chain: Agent Payment Compliance Trail

A nine-stage agent payment workflow over caller-declared data. Step 1 validates the AP2 Intent, Cart and Payment mandate trio for signature-chain integrity, scope and limit consistency, expiry and over-spend (art-01). Step 2 then validates the on-behalf-of mandate the agent acts under, covering subject, scope, intent and validity window (art-151). Step 3 then cross-checks the declared KYA credential scope against the declared x402 payment payload (art-565). Step 4 then scores the declared transaction graph for laundering typologies (art-10). Step 5 then validates travel-rule field completeness across the declared transfer batch (art-104). Step 6 then binds the screening decision to the exact dataset version it was screened against (art-585). Step 7 then verifies the payment receipt against its mandate chain under the human-not-present guardrail (art-62). Step 8 then recomputes the Permit2 settlement digest for the declared payment (art-699). Step 9 aggregates the declared execution hashes of the session into one Merkle-root audit receipt (cry-05). Each step computes from its own declared inputs; the order is analytical, not a statutory sequence, and the workflow certifies nothing.

Domain: Agent Economy

### Steps

1. art-01-ap2-mandate-chain-validator
   Validates the caller-declared AP2 Intent, Cart and Payment mandate trio for signature-chain integrity, scope and limit consistency, expiry and over-spend detection. Step 2 then checks the on-behalf-of mandate the agent acts under. Stage 1 of 9.
2. art-151-agent-obo-mandate-validator
   Validates the caller-declared on-behalf-of mandate, checking the represented subject, the bounded scope array, the intent string and the validity window, and refusing on mismatch or expiry. Step 3 then checks the payment against the credential's scope. Stage 2 of 9.
3. art-565-kya-x402-scope-verifier
   Cross-checks the declared KYA credential scope against the declared x402 payment payload, comparing amount, network, asset, payee and validity window, and returning an in-scope, out-of-scope or indeterminate verdict. Step 4 then scores the declared transaction graph for laundering typologies. Stage 3 of 9.
4. art-10-amla-transaction-typology-risk-scorer
   Scores the declared transaction graph against money-laundering typologies, returning a risk determination per account and cluster. Step 5 then validates travel-rule field completeness across the declared transfer batch. Stage 4 of 9.
5. art-104-tfr-travel-rule-batch-validator
   Validates originator and beneficiary field completeness across the declared transfer batch branches and reports batch conformance with a Merkle root. Step 6 then binds the screening decision to its dataset version. Stage 5 of 9.
6. art-585-sanctions-screening-evidence-pack
   Binds the caller-declared screening decision to the exact versioned dataset it was screened against, comparing the caller-computed artifact digest with the published digest for that version. Step 7 then verifies the payment receipt. Stage 6 of 9.
7. art-62-ap2-payment-receipt-verifier
   Verifies the caller-declared payment receipt against its signed mandate chain, applying the human-not-present guardrail on amount, category, mandate age and cart freshness. Step 8 then recomputes the settlement evidence. Stage 7 of 9.
8. art-699-x402-permit2-evidence-recomputer
   Recomputes the Permit2 typed-data digest the payer's wallet signs for the declared x402 payment, deriving the domain separator, struct hash and digest for each single-item message shape. Step 9 then aggregates the audit trail. Stage 8 of 9.
9. cry-05-agent-action-audit-trail-aggregator
   Aggregates the caller-declared execution hashes of the agent session into one SHA-256 Merkle-root session receipt with per-leaf inclusion proofs and an ordered chain-depth map. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: An agent's x402 payment exceeds its credential's spend cap. Does the scope check report the payment out of scope, or clear it as in scope?
Run the AINumbers MCP tool `run_chain` with {"chain":"agent-payment-compliance-trail"} and read `art-565-kya-x402-scope-verifier.verdict`.
Re-run with `inputs` for `art-565-kya-x402-scope-verifier`, reusing the values that result echoed, with `x402_payload` changed so swap in the fixture out-of-scope payload whose payment amount exceeds the credential spend cap. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/agent-payment-compliance-trail.html
