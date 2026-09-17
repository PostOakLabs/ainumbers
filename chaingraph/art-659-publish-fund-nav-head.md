# Publish Fund NAV Head

Publishes one SPEC.md §HEAD-1 head-commit publication event for a tokenized fund's daily-NAV stream, so a fund's NAV-per-share history (art-373-recompute-fund-nav results) becomes a sequence-numbered, signer-continuous chain instead of a series of unlinked artifacts a reviewer must independently discover and order, per NAV-LINEAGE-BUILD-SPEC.md §3. Existing NAV oracles attest transport of an opaque number, not computation; this head-commit tip IS that opaque-number transport layer, but every tip's root is a full OCG NAV receipt (art-373's own execution_hash), not a bare figure. HARD FENCE: this node never accepts or handles private key material, the caller signs the head-commit off-node via chaingraph/kernels/_head.mjs's own buildHead/signHead and separately runs its own Ed25519 verification (again via _head.mjs's verifyHeadProof/verifyChain) before calling this node. signature_valid and chain_valid are the caller's own verification claim, asserted and digested into this receipt, exactly like the sibling art-649-publish-model-risk-head's own caller-verification-claim convention, never independently re-derived by this node (the real zkVM guest has no WebCrypto at all, so an in-kernel Ed25519 verify result would not be reproducible across this repo's required execution environments). The one field this node DOES independently recompute is head_hash (pure SHA-256/JCS over the caller-supplied head, never trusted as a caller-asserted value, per SO #34). Backed by ocg-head-file@1 only at first; a head-file tip proves the signer's claimed daily-NAV tip, it does not itself detect equivocation (needs ocg-head-tlog@1, a later WU) and does not attest anything about the tokenized fund's on-chain share representation, which is out of scope here. The estate's head-commit primitive (SPEC.md §HEAD-1 + _head.mjs) is merged to main; this node applies that estate-internal primitive to a fund-NAV stream and makes no claim under any fund-administration, custody, or NAV-error disclosure regime itself.

- Page: https://ainumbers.co/chaingraph/art-659-publish-fund-nav-head.html
- Markdown twin: https://ainumbers.co/chaingraph/art-659-publish-fund-nav-head.md
- MCP tool: publish_fund_nav_head (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- chain_verification (array, required)
- head (unknown, required)
- prior_head (unknown, required)
- signature_verification (unknown, required)

## Outputs

- chain_errors (array, required)
- chain_valid (null,boolean, required)
- chain_verified_by (null,string, required)
- errors (array, required)
- fence (string, required)
- head_hash (null,string, required)
- is_genesis (boolean, required)
- not_proven (array, required)
- prev_head_hash (null,string, required)
- regulatory_framework (string, required)
- root (null,string, required)
- rotates_to (null,string, required)
- seq (null,number, required)
- signature_valid (null,boolean, required)
- signature_verified_by (null,string, required)
- signer (null,string, required)
- stream (null,string, required)
- structural_error (string,null, required)
- timestamp (null,string, required)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `publish_fund_nav_head` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
