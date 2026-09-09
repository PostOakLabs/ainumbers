# ERC-2981 Royalty Calculator

Recomputes an ERC-2981 royalty amount as floor(sale_price * royalty_fraction_bps / 10000) - the same integer-division convention the OpenZeppelin reference ERC2981 implementation uses - from a caller-declared sale_price and royalty_fraction_bps, using BigInt arithmetic throughout so a sale_price beyond Number.MAX_SAFE_INTEGER never loses precision. Flags a bps value above 10000 (100%) as out of range (the value the reference implementation reverts on) while still reporting the raw recompute, and compares against an optional claimed_royalty_amount. Zero network calls: this tool never queries a contract's actual royaltyInfo() return value - sale_price, royalty_fraction_bps, and receiver are all caller-declared. Cross-links 528-nft-metadata-validator and 521-cant-be-evil-nft-license-picker for adjacent NFT-standard surfaces (metadata shape, license terms) this tool does not cover. ERC-2981 royalty payment is a voluntary off-chain convention: this tool makes no claim that any marketplace will actually pay the computed amount.

- Page: https://ainumbers.co/chaingraph/art-608-erc2981-royalty-calculator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-608-erc2981-royalty-calculator.md
- MCP tool: calculate_erc2981_royalty (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- claimed_royalty_amount (unknown, required)
- receiver (string, required)
- royalty_fraction_bps (unknown, required): Amount in basis points
- sale_price (unknown, required)

## Outputs

- claimed_royalty_amount (string, optional)
- computed_royalty_amount (string, optional)
- effective_royalty_pct (string, optional)
- findings (array, optional)
- not_proven (array, optional)
- overall_determination (string, optional)
- receiver (string, optional)
- related_tools (array, optional)
- royalty_fraction_bps (string, optional)
- sale_price (string, optional)
- scope_note (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `calculate_erc2981_royalty` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
