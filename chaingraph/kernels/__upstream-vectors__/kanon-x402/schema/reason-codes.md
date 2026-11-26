# Kanon Reason Code Registry

Version: 2.0.0

This file is the authoritative, versioned registry of verdict reason codes. The reason code is part of every verdict, not a diagnostic afterthought. A verifier that returns the right boolean with the wrong reason code has failed the vector.

Reason codes are a stable interface. Adding a code, removing a code, or redefining what an existing code means is a breaking change and requires a registry version bump. The normative check order in this document is also part of the contract. Reordering it is breaking.

> **2.0.0 (breaking):** `ASSET_MISMATCH` was removed. In the single verbatim `input` model there is no second asset value to compare against `input.accepted.asset`, so a wrong `verifyingContract` is cryptographically indistinguishable from any other domain mismatch and correctly resolves to `SIGNER_MISMATCH`. Cross-contract and wrong-`verifyingContract` cases are represented by `SIGNER_MISMATCH` (named in the vector's `encodes` field).

## Codes (v2.0.0)

Each code below states what makes it detectable by a stateless, offline verifier.

- `NETWORK_MISMATCH`: The vector's target `network` differs from `input.accepted.network`. Plaintext comparison, before any cryptography.
- `SIG_MALLEABLE`: The ECDSA `s` value is in the upper half of the curve order, violating the EIP-2 and EIP-2098 low s requirement. Detected by inspecting the signature bytes before recovery.
- `SIGNER_MISMATCH`: The signature does not recover to `input.payload.authorization.from` when the EIP-712 digest is reconstructed from the expected domain (chainId from `input.accepted.network`, verifying contract `input.accepted.asset`, name and version from `input.accepted.extra`) and the authorization struct. This one cause covers cross chain replay, cross contract replay, and tampering of any signed field, which are cryptographically indistinguishable at recovery. The specific attack is named in the vector's `encodes` field.
- `NOT_YET_VALID`: `context.verification_time` is before `input.payload.authorization.validAfter`. Requires `context.verification_time`.
- `EXPIRED`: `context.verification_time` is at or after `input.payload.authorization.validBefore`. Requires `context.verification_time`.
- `NONCE_REPLAY`: `input.payload.authorization.nonce` is present in `context.seen_nonces`. Requires `context.seen_nonces`. Models a nonce already consumed or settled by `authorization.from` on `input.accepted.asset` (SPEC.md §5).
- `AMOUNT_INSUFFICIENT`: The signature is valid and recovers correctly, but `input.payload.authorization.value` is less than `input.accepted.amount`. The mandate is authentic, it just underpays. Forging the amount instead breaks the signature and yields `SIGNER_MISMATCH`.
- `VALID`: All checks pass. Positive vectors only.

## Normative check order

A conformant verifier MUST evaluate checks in this order and return the reason code of the first check that fails. If no check fails, the verdict is `VALID`.

1. `NETWORK_MISMATCH`
2. `SIG_MALLEABLE`
3. `SIGNER_MISMATCH`
4. `NOT_YET_VALID`
5. `EXPIRED`
6. `NONCE_REPLAY`
7. `AMOUNT_INSUFFICIENT`
8. `VALID`

The cheap structural comparison against the target comes first. Signature encoding validity (malleability) is checked before recovery because it is a property of the signature bytes. Recovery then establishes authenticity. Temporal and replay checks follow. The amount sufficiency check runs last because it is only meaningful once the signature is known authentic. Corpus vectors isolate a single fault, so this order only disambiguates adversarial multi fault inputs, but it is normative so that all verifiers agree.

## Intentionally absent codes

`DOMAIN_CHAINID_MISMATCH` and `DOMAIN_CONTRACT_MISMATCH` are intentionally absent. EIP-712 binds chainId and the verifying contract into the same digest as every other signed field, so a verifier cannot distinguish them from a generic recovery failure. Demanding them as expected reason codes would cause correct verifiers to fail the corpus. The attacks they named are preserved in the `encodes` field of the relevant `SIGNER_MISMATCH` vectors.

`ASSET_MISMATCH` is also absent, for the same underlying reason. With the requirements carried inside `input.accepted`, the asset under test is `input.accepted.asset` itself; there is no independent second asset to compare it against, so a wrong verifying contract is indistinguishable from any other domain mismatch and resolves to `SIGNER_MISMATCH`. Keeping `ASSET_MISMATCH` would define a check that compares a field to itself.

A null or zero-address signer, or a signature whose recovery id is invalid and recovers no key, is likewise not a separate code: recovery simply fails to match the declared `authorization.from` and resolves to `SIGNER_MISMATCH`, consistent with the CWE-347 framing.

`RESOURCE_MISMATCH` is absent for a different reason. The domain codes above name attacks on signed fields that a verifier detects but cannot tell apart from other recovery failures. `resource` is not signed at all, so no verdict over the mandate can depend on it and there is no attack to encode, not even under `SIGNER_MISMATCH`. Binding a payment to the resource it unlocks is the resource server's job; see SPEC.md §5 and [x402-foundation/x402#3838](https://github.com/x402-foundation/x402/issues/3838).
