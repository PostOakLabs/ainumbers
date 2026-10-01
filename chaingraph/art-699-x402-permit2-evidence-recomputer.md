# X402 Permit2 Evidence Recomputer

Recomputes the Permit2 typed-data digest a payer's wallet signs for an x402 payment, for the three single-item message shapes the exact and upto schemes use: a witness transfer that binds the destination, an unwitnessed signature transfer, and an allowance permit. From caller-supplied domain and message fields it derives the domain separator, the struct hash and the digest, deriving each type hash at run time from the type string rather than carrying a transcribed constant, and it reports binding facts against a caller-supplied payment requirement: whether the spender is the pinned x402 proxy, whether the destination bound into the witness matches payTo, whether the token matches the asset, whether the chain matches the network, and whether the amount holds under the scheme rule, which is equality under exact and a ceiling under upto. It reports nonce facts in the right space, keeping the unordered bitmap decomposition of the transfer shapes apart from the sequential counter of the allowance shape, and it reports that an allowance expiration of zero lasts only the current block rather than never expiring. Signature bytes are classified without recovery: length class, whether s sits above half the curve order, the recovery byte form including the raw parity case an on-chain call cannot use, and the counterfactual wrapper marker. Signer recovery itself is handed off to art-591 in that node's exact input shape, and a sponsored approval leg is handed off to art-612 in its. Scope limits: it reads no chain, so nonce spend state, stored allowance, contract code and the current time are caller-declared inputs echoed back, and any absent input reports NOT_EVALUATED rather than a pass. It never originates, relays or submits a payment.

- Page: https://ainumbers.co/chaingraph/art-699-x402-permit2-evidence-recomputer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-699-x402-permit2-evidence-recomputer.md
- MCP tool: recompute_x402_permit2_digest (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "variant": "x402_witness_transfer",
  "chainId": 84532,
  "verifyingContract": "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  "permitted": {
    "token": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "amount": "10000"
  },
  "spender": "0x402085c248EeA27D92E8b30b2C58ed07f9E20001",
  "nonce": "1701411834604692317316873037158841057",
  "deadline": "1790000600",
  "witness": {
    "to": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
    "validAfter": "1790000000"
  },
  "from": "0x2c7536e3605d9c16a7a3d7b1898e529396a65c23",
  "requirement": {
    "scheme": "exact",
    "network": "eip155:84532",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
    "amount": "10000"
  },
  "now_unix": "1790000300",
  "signature": "0x25756b2bf033967940a5fdc0735ab623fea0727447b70dbf4980a4e26a10a1e168a8a260ea84da98a5674371f183b87b966c972e320aac93d1e85916ca50aa841c"
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_x402_permit2_digest` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
