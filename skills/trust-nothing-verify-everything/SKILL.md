---
name: trust-nothing-verify-everything
description: "Verify the estate’s own claims from primary bytes: recompute the kernel digest, check the risc0 image id, verify the Groth16 seal with an independent library, then verify a DeFi computation you ran yourself. Use when you are walking a role through a full scenario and want the evidence captured at each step. Written for the protocol researcher audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "trust-nothing-verify-everything"
  verify_surface: "https://ledger.ainumbers.co/ https://ainumbers.co/chaingraph/art-610-erc4626-vault-share-math.html"
  version: "1e8cd3fdd287"
---

# Trust nothing, verify everything

Verify the estate’s own claims from primary bytes: recompute the kernel digest, check the risc0 image id, verify the Groth16 seal with an independent library, then verify a DeFi computation you ran yourself.

## Prompt

Do not take this site's word for anything. Verify its claims from primary bytes, then use it for one real computation.

1. Fetch https://ainumbers.co/chaingraph/chaingraph.json. Pick the node art-610 (recompute_erc4626_vault_share_math). Record compute_proof.system, receiptFormat, imageId, journal.kernel_digest.
2. Fetch the kernel source named by the node's compute_images sha256-source entry (chaingraph/kernels/art-610-erc4626-vault-share-math.kernel.mjs). Hash it yourself. State whether it equals journal.kernel_digest. If not, stop and say so.
3. Verify the Groth16 seal with a library you trust that is NOT ours (any BN254 Groth16 verifier). The verification key and public inputs are in the receipt; state pass/fail and which library you used.
4. Now call recompute_erc4626_vault_share_math on mcp.ainumbers.co with a synthetic vault (totalAssets, totalSupply, a deposit). Record execution_hash. Recompute the hash yourself: RFC 8785 canonical JSON of {policy_parameters, output_payload}, SHA-256. State equality.
5. Repeat the same inputs on the page https://ainumbers.co/chaingraph/art-610-erc4626-vault-share-math.html through its WebMCP tool. State whether the three hashes (worker, page, your recompute) are identical.
6. Run classify_erc1967_proxy_slot and verify_merkle_airdrop_proof once each with synthetic inputs, verify each hash the same way, then build_session_receipt over all three and anchor the root with anchor_stamp on OpenTimestamps.
7. Write the shortest possible statement of what you verified independently versus what you took on trust. Name every point where trust was still required. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://ainumbers.co/chaingraph/art-610-erc4626-vault-share-math.html
