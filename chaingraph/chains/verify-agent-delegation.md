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
