# Agent Payment Dispute Evidence

AP2 mandate-chain validator confirms the payment mandate's signature chain and scope; agent token scope checker evaluates the disputed action against the mandate's declared bounds; chargeback evidence bundle composer assembles both verdicts plus mandate/receipt, payment-protocol, and session/delivery evidence into a Merkle-rooted adjudication bundle.

- Page: https://ainumbers.co/chaingraph/chains/agent-payment-dispute-evidence.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agent-payment-dispute-evidence.md

## Workflow chain: Agent Payment Dispute Evidence

AP2 mandate-chain validator confirms the payment mandate's signature chain and scope; agent token scope checker evaluates the disputed action against the mandate's declared bounds; chargeback evidence bundle composer assembles both verdicts plus mandate/receipt, payment-protocol, and session/delivery evidence into a Merkle-rooted adjudication bundle.

Domain: Fraud & Dispute

### Steps

1. art-01-ap2-mandate-chain-validator
   mandate signature-chain, scope/limit, and TTL verdict feeds Stage 2 agent token scope check against the same mandate
2. art-385-agent-token-scope-checker
   in-scope / out-of-scope verdict and receipt feed Stage 3 chargeback evidence bundle composer as the mandate/receipt evidence group input
3. 567-chargeback-evidence-bundle-composer
   assembles mandate-chain and scope verdicts with payment-protocol and session/delivery evidence into a hash-chained, Merkle-rooted adjudication bundle; terminal check

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
