# State-Proof Verification

Single-node diagnostic verifying an EIP-1186 account and storage Merkle-Patricia-Trie proof against a caller-supplied trusted state root.

- Page: https://ainumbers.co/chaingraph/chains/state-proof-verification.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/state-proof-verification.md

## Workflow chain: State-Proof Verification

Single-node diagnostic verifying an EIP-1186 account and storage Merkle-Patricia-Trie proof against a caller-supplied trusted state root.

Domain: Verification & Proof Receipts

### Steps

1. art-279-state-proof-verifier
   verdict and account/storage results feed the auditor's holdings-verification record; standalone check

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
