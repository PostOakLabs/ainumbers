# Publish Model Risk Head

Publishes one SPEC.md §HEAD-1 head-commit publication event for a model's revalidation-history stream, so a model's validation history (art-453/art-489 results, or art-562/art-648 lineage artifacts) becomes a sequence-numbered, signer-continuous chain instead of a series of unlinked artifacts a reviewer must independently discover and order, mirroring NAV-LINEAGE-BUILD-SPEC.md §3 and INDEX-LINEAGE-BUILD-SPEC.md §5, applied to a model's revalidation cadence. HARD FENCE: this node never accepts or handles private key material, the caller signs the head-commit off-node via chaingraph/kernels/_head.mjs's own buildHead/signHead and separately runs its own Ed25519 verification (again via _head.mjs's verifyHeadProof/verifyChain) before calling this node. signature_valid and chain_valid are the caller's own verification claim, asserted and digested into this receipt, exactly like art-562's stage-reference citations, never independently re-derived by this node (the real zkVM guest has no WebCrypto at all, so an in-kernel Ed25519 verify result would not be reproducible across this repo's required execution environments). The one field this node DOES independently recompute is head_hash (pure SHA-256/JCS over the caller-supplied head, never trusted as a caller-asserted value, per SO #34). Backed by ocg-head-file@1 only at first, matching the NAV/index lineage rows; a head-file tip proves the signer's claimed tip, it does not itself detect equivocation (needs ocg-head-tlog@1, a later WU) and is not itself a revalidation-cadence enforcement mechanism. The estate's head-commit primitive (SPEC.md §HEAD-1 + _head.mjs) is merged to main; this node applies that estate-internal primitive to a model-risk stream and makes no claim under RDARR, BCBS 239, or SR 26-2 itself.

- Page: https://ainumbers.co/chaingraph/art-649-publish-model-risk-head.html
- Markdown twin: https://ainumbers.co/chaingraph/art-649-publish-model-risk-head.md
- MCP tool: publish_model_risk_head (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- chain_verification (array, required)
- head (unknown, required)
- prior_head (unknown, required)
- signature_verification (unknown, required)

## Outputs

- chain_errors (array, required)
- chain_valid (null,boolean, required)
- chain_verified_by (null,string, required)
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

Run the sample policy_parameters through MCP tool `publish_model_risk_head` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
