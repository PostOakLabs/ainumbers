# OpenChainGraph Work Mandates → Transaction Tokens, RAR and Token Exchange Mapping

**Status: INFORMATIVE.** This document is not part of the OpenChainGraph (OCG) v0.4 normative
specification. It does not define new vocabulary, does not change `execution_hash`, and conformance
with OCG v0.4 does not depend on anything below. The normative text this document explains lives in
[`SPEC.md`](SPEC.md) §22 (Work Mandates): §22.1 (mandate document), §22.2 (signature and mandate
hash) and §22.10 (offline mandate attenuation). It follows the same pattern as
[`SCITT-MAPPING.md`](SCITT-MAPPING.md): a field-by-field mapping onto external OAuth vocabularies,
with every row citing the section it relies on, and no claim that the two sides are interchangeable.

**Boundary (read first).** An IdP-issued Txn-Token is an **authorization artifact**, not an OCG
receipt. It carries no §18 compute proof, no §17 kernel identity and no §16 signature over an OCG
artifact, and it does not replace §22.2's mandate hash: the mandate hash remains the identifier of
the policy in force, and anything a token carries about it is a signed *pointer* a verifier
recomputes, never a substitute. Nothing below makes OCG depend on any IdP or TTS.

## 0. Pinned primary texts

All external claims below cite one of these three texts, read verbatim as plain text
(fetched 2026-10-23; snapshot copies with sha256 at `research/txn-token-sources-2026-10-22/` in the
build workspace, with `PROVENANCE.md`):

- **`draft-ietf-oauth-transaction-tokens-11`**: *Transaction Tokens*, A. Tulshibagwale,
  G. Fletcher, P. Kasselman, 30 July 2026, expires 31 January 2027. Datatracker rev 11
  (2026-08-21T11:57:16Z), state Active, IESG state "I-D Exists"; rev -12 does not exist
  (HTTP 404 at fetch), so -11 is current. sha256
  `937eeaac88c19eb00c7a3581f3de850c79c32aa7e4484ded329c15c123718364`.
  Work in progress: cited as draft -11, never as a standard.
- **RFC 9396**: *OAuth 2.0 Rich Authorization Requests* (RAR), Standards Track, **Proposed
  Standard**, May 2023. sha256
  `d6a8f032d8a585daae1c33a8c7b6e539d199f886ec8cc1c7898436f7f2eed29c`.
- **RFC 8693**: *OAuth 2.0 Token Exchange*, Standards Track, **Proposed Standard**, January 2022.
  sha256 `358d658014738bf4dc56c8aae2094ce716ede23b6d5a80488a7dc8e8d72da609`.

Claim naming note, measured in the draft itself: earlier revisions named a `purpose` claim and an
`azd` claim; the -11 appendix ("Since Draft 04") records "Renamed azd claim to tctx claim" and a
later block records "Rename the purpose claim to scope". Draft -11 therefore carries **`scope`**
(draft §9.2, §9.2.1) and **`tctx`** (draft §9.2.3) where older secondary literature says `purpose`
and `azd`. This document cites only claim names it read in the -11 text.

## 1. Scope, and what the mapping does NOT claim

**What is mapped.** A §22 Work Mandate is a signed OCG artifact that delegates bounded authority to
an agent over named nodes and chains (`scope`), under threshold conditions, inside a validity window,
signed by a principal. A Txn-Token (draft -11 §4, §9) is a short-lived JWT a Transaction Token
Service (TTS) issues to carry user identity, workload identity and immutable transaction context
down a call chain. The mapping shows which mandate members have a natural home in a Txn-Token's
claims or in an RFC 9396 `authorization_details` object, so an enterprise IdP/TTS (Okta, Entra, or
any RFC 8693-speaking AS) could issue the *authorization* half of a mandate as a token.

**What is NOT claimed:**

- An IdP-issued token is an **authorization artifact, not an OCG receipt**. It proves nothing about
  computational correctness (§18), authorship (§16) or kernel identity (§17), and it is not the
  receipt a §22.5-governed run folds its `mandate_hash` into.
- It **does not replace the §22.2 mandate hash**. The mandate hash (the mandate artifact's own §4
  `execution_hash`) is the identifier of the policy in force; §9 below shows how a token can *carry*
  it, not *be* it.
- OCG's §22 runtime (§22.4 `compile_work_mandate`, §22.5 binding, §22.8 escalation records) does not
  call a TTS and defines no TTS profile. This document stages no such dependency; it is a mapping an
  implementer holding both sides can apply.
- The draft is a work in progress. Nothing here is a conformance claim against it, and the mapping
  must be re-checked when (and if) the draft becomes an RFC (§10).

## 2. Field-by-field: §22.1 mandate members → Txn-Token claims and RAR `authorization_details`

Draft -11 §9.2 defines the Txn-Token body claims: `iss` (OPTIONAL), `iat`, `aud`, `exp`, `txn`,
`sub`, `scope`, `tctx` (RECOMMENDED), `rctx` (RECOMMENDED), `req_wl` (all REQUIRED except as noted).
RFC 9396 §2 defines `authorization_details` as an array of JSON objects whose shape is fixed by
their `type` field, with common data fields `locations`, `actions`, `datatypes`, `identifier` and
`privileges` (RFC 9396 §2.3).

| §22.1 mandate member | Txn-Token claim home (draft -11) | RFC 9396 `authorization_details` home | Notes |
|---|---|---|---|
| `mandate_type` (envelope value `"work_mandate"`, §5, §22.1) | No dedicated claim. As a Txn-Token additional claim (permitted by draft §9.2: "A Txn-Token MAY contain additional claims"; recipients MUST ignore unknown claims), or as a `tctx` member | The `type` field (RFC 9396 §2.2, REQUIRED): a registered type value such as `ocg-work-mandate` fixes the allowable contents of the object | The `type` row is the cleanest home: RFC 9396 §2.2 makes `type` the discriminator that determines the object's other fields |
| `scope.tool_ids[]` / `scope.chains[]` (§22.1) | `tctx` members (draft §9.2.3: `tctx` "contains the actual authorizaton details that are determined by the TTS" and "remain immutable through the Call Chain") | `actions` and `locations` (RFC 9396 §2.3): each authorized chain/node invocation is an action at a location URI identifying the node/chain endpoint | `actions` is "kinds of actions", `locations` "location of the resource or RS ... typically URIs". Node ids and chain names are OCG-internal identifiers; as `locations` they would need an OCG node URI convention, which this document does not define |
| `conditions[]` (`{ pointer, op, value }`, §22.1, ops from §21.4) | `tctx` members (the threshold envelope is immutable transaction context) | **UNMAPPED**: RFC 9396 §2.3 defines no conditional/threshold vocabulary; its common fields are static descriptions of requested access | A §22 condition names an auto-approval envelope tested at runtime (§21.4 gates). That is runtime gate configuration, not access-description data; forcing it into `actions`/`datatypes` would change its meaning. The honest home is `tctx`, carried verbatim |
| `escalation_triggers[]` (§22.1) | `tctx` members, same shape as conditions | **UNMAPPED**, same reason | Escalation semantics are §22.3/§22.8; no RAR field expresses "route to a human on this test" |
| `validity.not_after` (§22.1) | `exp` (draft §9.2, REQUIRED: "Expiry time of the Txn-Token") | No direct field; lifetime is the AS's `expires_in` (RFC 8693 §2.2.2, RECOMMENDED) and any JWT `exp` on the issued token | Asymmetry, stated plainly: the mandate validity window can span months (the §22.4 worked example uses a year); a Txn-Token is short-lived by design (draft §6). The token's `exp` bounds the call chain, the mandate's `not_after` bounds the authority. They are different clocks |
| `validity.not_before` (§22.1) | **UNMAPPED**: draft -11's claim list has no `nbf`; the claims a Txn-Token MUST/SHOULD carry are fixed at §9.2 and `nbf` is not among them | No field | A TTS simply would not issue before `not_before`; enforcement stays OCG-side (§22.5 rejects runs outside the window) |
| `principal.id` (§22.1, a §9 `did:key` or LEI) | `sub` (draft §9.2, REQUIRED: "This claim represents the principal of the transaction"). Note the draft's explicit caveat: "the sub claim is NOT associated with the iss claim" (draft §9.2) | No direct field; `authorization_details` describes access, not parties | `iss` (draft §9.2, OPTIONAL) names the issuing TTS, never the mandate principal. For delegation chains RFC 8693 §4.1's `act` claim identifies the acting party, but that is delegation, not the authorizing principal |
| `anchor` (OPTIONAL §20 anchor binding, §22.1) | **UNMAPPED** | **UNMAPPED** | An anchor is an OCG §20 transparency binding over the mandate hash (RFC 3161 / OTS / C2SP / SCITT). No Txn-Token or RAR field carries a third-party timestamp structure, and §2 of SCITT-MAPPING.md already owns the token-shaped SCITT mapping. No clean home; none forced |

Every row above cites the section it relies on; the two UNMAPPED-by-necessity rows state their
reason rather than forcing a fit.

## 3. How §22.2's mandate hash binds the token

§22.2 makes the mandate's own §4 `execution_hash` its identifier, the **mandate hash**; a §22.5 run
folds it into every step's `policy_parameters` so the composite receipt proves which policy governed
the run. A Txn-Token issued under a mandate should carry the same hash so a downstream service can
tie the token to the mandate in force:

- **Carry it inside an `authorization_details` entry of a registered type** (RFC 9396 §2.2: the
  `type` value "determines the allowable contents of the object that contains it"), for example a
  type `ocg-work-mandate` with a member carrying the mandate hash. RFC 9396 §2.2 permits
  type-specific members; the common fields (§2.3) remain available alongside.
- Equivalently (or additionally) as a `tctx` member: draft §9.2.3 makes `tctx` the place for "the
  actual authorizaton details that are determined by the TTS" that "remain immutable through the
  Call Chain", which is exactly the mandate-hash property (it is fixed at authorization time and
  must not vary as the token travels).
- **A verifier recomputes it.** The hash is a §4 canonical hash over the mandate artifact's
  `{ policy_parameters, output_payload }` via `kernels/_hash.mjs` (RFC 8785 / JCS `cgCanon`,
  SPEC §22.4 rule 5). A token claim carrying it is a *pointer*, not a duplicate: a verifier holding
  the signed mandate artifact recomputes the hash and checks equality with the token's carried value.
  Token possession alone authorizes nothing OCG-side; §22.5's runtime verifies the mandate's §16
  signature, validity window and scope from the artifact itself.

## 4. How §22.10 offline attenuation lines up with RFC 8693 token exchange (narrowing only)

§22.10 makes multi-hop mandate delegation a **Biscuit-style offline attenuation-block chaining**:
each hop appends a signed caveat block under a single-use keypair, a holder can only narrow, and a
verifier checks the whole chain under ONE root public key, so widening is structurally impossible
and the whole chain verifies **offline**.

RFC 8693 token exchange shares the narrowing goal and nothing else:

- **Narrowing:** a holder presents the mandate-derived token as `subject_token` (RFC 8693 §2.1,
  REQUIRED) and requests a new token whose `scope` (RFC 8693 §2.1) is a subset. RFC 8693 §2.2.2
  makes the response `scope` "OPTIONAL if the scope of the issued security token is identical to the
  scope requested by the client; otherwise, it is REQUIRED", i.e. the AS records the scope it
  actually granted, which MAY be narrower than requested. The AS enforces no-widening by policy.
- **Online, not offline.** Each exchange needs a live token endpoint round trip and the AS's
  signature; there is no offline verifier-side recheck of a hop chain, which is the entire point of
  §22.10's construction. Token exchange is therefore an **online narrowing** counterpart, suitable
  for hops across trust boundaries where an AS is reachable, and not a replacement for §22.10's
  offline chain.
- **Same direction, different mechanism.** Draft -11 §11 profiles RFC 8693 directly: a Txn-Token
  request is a token-exchange request with `grant_type=urn:ietf:params:oauth:grant-type:token-exchange`,
  `requested_token_type=urn:ietf:params:oauth:token-type:txn_token`, a REQUIRED `audience` (the
  Trust Domain) and a REQUIRED `scope` that "MUST represent the specific purpose or intent of the
  transaction". A mandate-derived exchange would narrow by requesting only the `scope` and
  `request_details` the next hop needs; the TTS constructs the resulting `tctx` (draft §9.2.3).
  OCG defines none of this profile; it is the alignment a TTS implementer would use.

## 5. Worked example, from an existing §22 fixture

The mandate below is the §22.4 SPEC worked example (chain `loan-preflight`, steps
`[assess_loan, record_outcome]`, checkpoint `assess_loan` on pointer `/decision/approved`), which
SPEC §22.4 names "authoritative target for the compiler fixture". Its machine-checkable counterpart
is the `single_condition_threshold` vector of
`repo/chaingraph/kernels/fixtures/art-274-compile-work-mandate.fixtures.json`
(`art-274-compile-work-mandate`, §22.4 conformance vectors), whose mandate payload is:

```json
{
  "mandate_type": "work_mandate",
  "scope": { "tool_ids": ["assess_loan", "record_outcome"], "chains": [] },
  "conditions":  [ { "pointer": "/decision/approved", "op": "eq", "value": true } ],
  "escalation_triggers": []
}
```

(the fixture vector is minimal; the §22.4 SPEC worked example adds
`escalation_triggers: [{ "pointer": "/decision/approved", "op": "eq", "value": false }]` and the
members below). Under §2's mapping, a TTS issuing a Txn-Token for a run governed by this mandate
would produce body claims shaped like:

```json
{
  "iat": 1792000000,
  "aud": "trust-domain.example",
  "exp": 1792003600,
  "txn": "97053963-771d-49cc-a4e3-20aad399c312",
  "sub": "did:key:z6MkExampleAuthorizingPrincipalKey",
  "req_wl": "assess_loan.trust-domain.example",
  "scope": "ocg.chain.loan-preflight",
  "tctx": {
    "mandate_hash": "sha256:d1530dac91c4032091d3a1a7d9234ab4e0b4eb373957099b2209d74fc542d58f",
    "tool_ids": ["assess_loan", "record_outcome"],
    "conditions": [{ "pointer": "/decision/approved", "op": "eq", "value": true }],
    "escalation_triggers": [{ "pointer": "/decision/approved", "op": "eq", "value": false }]
  },
  "rctx": { "transport": "https" }
}
```

and an equivalent `authorization_details` entry in the exchange or authorization request
(RFC 9396 §2, §7: the AS MUST return the granted `authorization_details` in the token response):

```json
[
  {
    "type": "ocg-work-mandate",
    "actions": ["assess_loan", "record_outcome"],
    "locations": ["ocg://chain/loan-preflight"],
    "mandate_hash": "sha256:d1530dac91c4032091d3a1a7d9234ab4e0b4eb373957099b2209d74fc542d58f"
  }
]
```

The `mandate_hash` shown is the fixture vector's real pinned `golden_hash`
(`d1530dac91c4032091d3a1a7d9234ab4e0b4eb373957099b2209d74fc542d58f`); the surrounding claim values
(`txn`, timestamps, `req_wl`, the `ocg://` location URI) are synthetic illustrations of the shape,
not a profile. `principal.id` from the §22.4 SPEC example maps to `sub` per §2; the mandate's
`validity` window (a year in §22.4) does not appear in the token, whose `exp` bounds only this call
chain (§2, validity row). Note what the token does NOT carry: no conditions evaluated, no §21.4
decision record, no receipt. The run's composite receipt, with the same mandate hash folded into its
preimage (§22.5), remains the OCG-side proof that the policy governed the run.

## 6. External status and re-check obligation

`draft-ietf-oauth-transaction-tokens` is at revision **-11** (datatracker rev 11,
2026-08-21T11:57:16Z), state Active, IESG state "I-D Exists"; rev -12 returned HTTP 404 at fetch
(2026-10-23), so -11 is current; the document is dated 30 July 2026 and expires 31 January 2027.
RFC 9396 (May 2023) and RFC 8693 (January 2022) are Published Standards and stable citation targets.
**This mapping must be re-checked when the draft becomes an RFC**: section numbers, claim REQUIREMENT
levels and even claim names have moved between draft revisions already (`azd` → `tctx`,
`purpose` → `scope`, §0 above), and any RFC publication may move them again.

## 7. Related OCG surfaces not touched here

`SPEC.md` §22.6 already aligns mandate vocabulary with Google AP2 and OpenID AuthZEN AARP as
informative alignments with no runtime dependency; this document adds the OAuth transaction-token
alignment in the same spirit and changes no normative text. `SCITT-MAPPING.md` owns the
transparency-side mapping (OCG artifacts and receipts to SCITT Signed Statements and Receipts); the
mandate hash a token carries under §3 here is exactly the value a future SCITT registration of a
mandate would anchor, so the two documents compose without overlap.

---

*Sources: `draft-ietf-oauth-transaction-tokens-11` (30 July 2026, expires 31 January 2027, Active,
IESG "I-D Exists"), RFC 9396 (Proposed Standard, May 2023) and RFC 8693 (Proposed Standard,
January 2022), all read verbatim from the vendored plain texts fetched 2026-10-23 (sha256 pins in
§0; `research/txn-token-sources-2026-10-22/PROVENANCE.md` in the build workspace). OCG-side text:
`SPEC.md` §22 (§22.1, §22.2, §22.4, §22.5, §22.6, §22.10). Fixture:
`repo/chaingraph/kernels/fixtures/art-274-compile-work-mandate.fixtures.json`, vector
`single_condition_threshold`.*
