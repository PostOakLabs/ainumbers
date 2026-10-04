# Agent Identity & Delegation Chain Verifier

Verifies the two most-cited emerging agent-identity primitives in sequence: a did:webvh DID log's hash-chain and update-key authorization, then an ACDC credential chain's SAID integrity and issuer-to-issuee edge linkage back to a stated root AID. Verify-only across both steps.

- Page: https://ainumbers.co/chaingraph/chains/verify-agent-delegation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/verify-agent-delegation.md

## Workflow chain: Agent Identity & Delegation Chain Verifier

Verifies the two most-cited emerging agent-identity primitives in sequence: a did:webvh DID log's hash-chain and update-key authorization, then an ACDC credential chain's SAID integrity and issuer-to-issuee edge linkage back to a stated root AID. Verify-only across both steps.

Domain: AI & Agent Governance

### Steps

1. art-284-did-webvh-log-verifier
   did, current_version_id, and deactivated status establish which controller AID is currently authoritative before the delegation chain below is evaluated
2. art-285-acdc-delegation-chain-verifier
   chain_depth, root_aid_matched, and said_failures/edge_failures form the final delegation-authority determination for the agent named in the leaf credential

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: An agent presents a chained delegation for a payment scope. Does every hop verify, and does the chain root at the controller we issued?
Run the AINumbers MCP tool `run_chain` with {"chain":"verify-agent-delegation"} and read `art-285-acdc-delegation-chain-verifier.valid`.
Re-run with `inputs` for `art-285-acdc-delegation-chain-verifier`, reusing the values that result echoed, with `expected_root_aid` set to "EAlt-controller-AID-0000000000000000000000000". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/verify-agent-delegation.html
