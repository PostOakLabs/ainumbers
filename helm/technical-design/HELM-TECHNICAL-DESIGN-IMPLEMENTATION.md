# Helm Technical Design Implementation

**Audience:** an engineer, security reviewer, or diligence reader deciding whether this is real.
**Not a marketing document.** The marketing surface is `helm.html` on ainumbers.co, which lives in a different repository.

Every claim below was read off the code in this repository at commit `8cddd4a`, not recalled. Where the code and an existing spec or board row disagree, the code wins and the disagreement is written down (see §10). Where something is designed but not built, it says so.

---

## 1. What helmd is

`helmd` is a local-first control plane. It is one process (`hub/index.mjs`) that:

- opens an HTTP server bound to `127.0.0.1` only (`hub/server.mjs:1102`),
- serves its own browser UI from that loopback socket (`hub/static.mjs`, `hub/ui-manifest.mjs`),
- runs deterministic OpenChainGraph (OCG) kernels vendored into this repository (`hub/kernel-runner.mjs`),
- records everything into an append-only, hash-chained journal on the local disk (`hub/journal.mjs`),
- and packages the result into a signed evidence bundle that a third party can verify with no network access at all (`hub/bundle.mjs`).

State lives in `~/.helm`, created mode `0700`, overridable with `HELM_HOME` (`hub/state-dir.mjs:8-16`).

What it is not:

- **Not a hosted service.** There is one instance per installation. Nothing is centrally hosted.
- **Not a cloud agent.** The core loop (start, run a workflow, journal it, export evidence) makes no outbound request. Anchoring is the one optional network step, and it is off by default (`hub/config.mjs:44`, `anchorOnCheckpoint: false`).
- **Not multi-tenant, and not a server you expose.** The socket is loopback and the Host header is checked against `127.0.0.1:<port>` before anything else runs (`hub/server.mjs:72-74`, `1031-1034`).

Default port is `4173` (`hub/config.mjs:9`). Default allowed browser origin is derived from the port rather than hardcoded, `http://127.0.0.1:<port>` (`hub/config.mjs:22-26`).

---

## 2. Process and serving model

### Start

`helmd start` runs `cmdStart()` (`hub/index.mjs:83-338`) in this order:

1. Load config, load or create the bearer token, load or create the Ed25519 + ML-DSA-44 identity keys, load or create the HA identity (`hub/index.mjs:84-87`).
2. Open the journal database and verify its hash chain before serving anything (§4 below, `hub/index.mjs:105-148`).
3. Build the idle timer (`hub/index.mjs:173-183`).
4. Create the HTTP server and bind it. A port already in use is a clean refusal, never a silent fallback to another port (`hub/server.mjs:1106-1123`, called at `hub/index.mjs:200-204`).
5. Only after the socket is listening, fire the checkpoint build, deliberately not awaited, so readiness never depends on a timestamp authority round trip (`hub/index.mjs:206-233`).
6. Open the CLI channel, a named pipe on Windows and a unix domain socket elsewhere, carrying `pair`, `stop`, and `status` (`hub/index.mjs:235-281`, `hub/cli-channel.mjs`).
7. Print the pairing URL and open a browser tab (`hub/index.mjs:291-319`).

`helmd stop` and `helmd status` do not go over HTTP. They connect to that CLI channel, whose trust boundary is the operating system's own ACL on the pipe or socket. The reasoning is recorded in the code: an unauthenticated HTTP route that stops the daemon or hands out the token would be reachable by any local process (`hub/index.mjs:237-253`).

### Idle shutdown

`helmd` stops itself after `idleTimeoutMs`, default 120000 ms (`hub/idle-timer.mjs:8`, `hub/config.mjs:38`). "Idle" is deliberately wider than "no request arrived": an open server-sent-events connection, a run in flight, a live pairing window, or a backup in progress each hold the daemon open (`hub/index.mjs:175`). The timeout is announced on `GET /health`, in `helmd status`, and in the boot banner rather than only enforced (`hub/index.mjs:299`, `hub/server.mjs:171-173`).

### Serving the shell

The browser UI is served by `helmd` itself from `127.0.0.1`. `repo/helm.html` in the site repository is a marketing page and is a different file in a different repository. Do not read one as evidence about the other.

Static serving is a hand-rolled handler over an explicit allowlist (`hub/static.mjs:58-73`, `hub/ui-manifest.mjs:3-9`). There is no directory listing, and no filesystem path is ever built from request input, so there is no traversal surface to construct. A path not in the map falls through to the API router and gets an ordinary 404.

The shell is served before the Origin and bearer checks, and the code states why: a top-level browser navigation carries no `Origin` header and cannot attach an `Authorization` header at all, so gating the shell on either would make the page unloadable. The Host check still applies, and the shell itself is inert static assets holding no secret. Every API route behind it stays fully gated (`hub/static.mjs:7-14`).

The real Content-Security-Policy, sent with every static asset (`hub/static.mjs:28-36`):

```
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:;
connect-src 'self' https:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'
```

There is **no `unsafe-inline`** and no `unsafe-eval`. `connect-src` was widened from `'self'` to `'self' https:` so an embedder-hosted company-profile JSON can be fetched by URL, which is a data-only widening: `script-src`, `style-src`, and `img-src` are untouched, so a hostile config can be read as data and can never load as script, stylesheet, or frame (`hub/static.mjs:20-27`). Accompanying headers are `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, and `Cache-Control: no-cache`.

---

## 3. Pairing and the three-part request gate

### Pairing

The bearer token is 32 random bytes hex-encoded, stored in a mode-`0600` file under the state directory, created once and reused (`hub/token.mjs:9-19`).

The pairing URL is `http://127.0.0.1:<port>/#token=<token>&pair=<nonce>&fp=<fingerprint>` (`hub/token.mjs:35-39`). Three separate things ride in that fragment, for three separate reasons:

- **`token`** is the durable credential the browser tab keeps for the session. It stays durable because revoking it per call would break server-sent-events and health polling, which cannot rotate a credential mid-connection (`hub/token.mjs:21-26`).
- **`pair`** is a single-use nonce with a five minute TTL, held in memory only and cleared on restart. Redemption deletes it whether or not it was still valid, so a second redeem of the same value always fails. Its only power is `/pair/redeem`, which records the pairing event so a replayed old link is detectable. It never gates ordinary API calls (`hub/token.mjs:51-68`).
- **`fp`** is the fingerprint of the daemon's own Ed25519 identity key. This is the one channel a port squatter cannot spoof, because only the process holding the key file can mint it. The browser pins it and afterwards refuses any `/pair/challenge` response whose public key fingerprint does not match, which closes a self-consistency-only gap in challenge verification (`hub/token.mjs:28-34`, `hub/index.mjs:88-93`).

Re-pairing goes over the CLI channel (`helmd open`), never over HTTP (`hub/index.mjs:237-246`).

For server-sent events specifically, the durable token is not put in the query string. `POST /events/ticket` mints a 15 second single-use ticket over an already-authenticated call, and `/events` accepts that ticket instead (`hub/token.mjs:88-104`, `hub/server.mjs:335-342`, `1077-1085`).

### The gate

Every request passes three checks, in this order (`hub/server.mjs:3-7` and the dispatcher at `1030-1101`):

1. **Host** must equal `127.0.0.1:<port>` exactly (`hub/server.mjs:72-74`, checked at `1031`).
2. **Origin** must equal the configured origin exactly, never a wildcard (`hub/server.mjs:106-108`, checked at `1062`).
3. **`Authorization: Bearer <token>`** must match, compared with `timingSafeEqual` after a length check (`hub/server.mjs:1075-1089`, `hub/token.mjs:41-47`).

All three are needed because each defeats a different attacker, and none of them subsumes another:

- **Origin alone does not stop DNS rebinding.** An attacker who controls a domain can point it at `127.0.0.1` after the page loads, at which point the browser sends requests to the daemon that are same-origin from the browser's point of view. The Host check kills that, because the rebound request carries the attacker's hostname in `Host`, not `127.0.0.1:<port>`.
- **Host alone does not stop cross-site request forgery.** Any website in the user's browser can issue a request to `http://127.0.0.1:4173/`, and it will carry the correct `Host`. The exact-match Origin check kills that, because the request carries the attacking site's origin.
- **Host and Origin together do not stop a non-browser local caller.** Any process on the machine can set both headers to whatever it likes with a raw socket. Only the bearer token, which lives in a mode-`0600` file, distinguishes the paired browser from another local program.

Three deliberate exceptions exist and each is narrower than the general rule:

- **The static shell** is pre-Origin and pre-auth, for the reason in §2. Host still applies.
- **The detection surface**, exactly `GET /version` and `GET /pair/challenge`, accepts either the loopback origin or the fixed hosted origin `https://ainumbers.co`, and requires no token. It is an exact origin match, never a wildcard, and it never touches vault, journal, or run data (`hub/server.mjs:58-59`, `272-292`, dispatched at `1042-1049`).
- **`POST /connectors/inbound-webhook`** is pre-Origin and pre-bearer, because the caller is a local orchestrator with neither a browser Origin nor the pairing token. Its authentication is an HMAC over the raw request body, computed before any JSON parsing so the signature covers the exact bytes sent (`hub/server.mjs:61-67`, dispatched at `1051-1060`, HMAC checked at `645-651`, `hub/webhook-guard.mjs`). Host still applies.

Requests are logged by pathname only, never by `req.url`. The reason is written in the code: the bearer used to ride in the `/events` query string, so logging a rejected request verbatim would write a working credential to stdout, which a macOS LaunchAgent can capture to a file (`hub/server.mjs:76-85`).

### Autostart

Autostart and the Start Menu shortcut are **opt-in and default off on every platform**. Nothing on the daemon's start path writes a persistence entry; `hub/index.mjs` does not import an installer at all (`hub/index.mjs:24-27`, and the explanation at `321-337`).

The only way either gets installed is a person ticking the box in the Helm tab, which issues `POST /autostart`. That route is POST and never GET, because a GET that installs persistence is reachable from an `<img src=...>` or a prefetch, paths where a page's script never runs and the Origin check is the only obstacle. Both `/autostart` routes sit in the ordinary route table behind the full Host, Origin, and bearer gate, not in the static allowlist and not in the detection paths (`hub/server.mjs:375-456`, registered at `968-969`).

The status route reports what is actually on the machine rather than what was requested: on an unsupported platform the installer returns `{supported:false}` and writes nothing, so the response echoes re-read state (`hub/server.mjs:453-456`). Status distinguishes `ok`, `not_installed`, `unsupported`, `target_missing`, `unreadable`, and `command_mismatch`, and `target_missing` surfaces as a `BROKEN` state in `helmd status` and in `helmd doctor` rather than reporting healthy forever (`hub/autostart.mjs:207-272`, `hub/index.mjs:424-429`).

---

## 4. The journal and the digest chain

### On-disk form

One SQLite database at `~/.helm/journal.db`, opened through the Node builtin `node:sqlite` (`DatabaseSync`), not an npm native module. `journal_mode = WAL`. Tables: `journal`, `stream_state`, `checkpoints`, `journal_meta` (`hub/journal.mjs:19`, `51-83`).

One process, one writer. `node:sqlite`'s `DatabaseSync` is synchronous, so there are no concurrent-writer races to guard against, and transactions are wrapped by hand because it has no `.transaction()` helper (`hub/journal.mjs:3-4`, `39-49`).

### The chain

Per-stream running hash:

```
rh_0 = SHA-256(stream_id)
rh_n = SHA-256(rh_{n-1} || stream_id || journal_seq || entry_digest)
```

(`hub/journal.mjs:6-11`, implemented at `99-101` and `116-147`.)

`entry_digest` is SHA-256 over the JCS-canonical form of the full entry (`hub/journal.mjs:31-34`, `119`). `journal_seq` is the **global** monotonic row id, not a per-stream counter, so the hash binds each stream's position in the overall append order. Reordering rows across streams, not only within one, breaks the chain (`hub/journal.mjs:9-11`).

Every entry must carry the EU AI Act Article 12(2) and 12(3) field groups, `period_start`, `period_end`, `reference_db_version`, `triggering_input_digest`, and `humans_involved[]`, and they must be populated by the caller. The journal module never derives them, and refuses an entry that is missing one (`hub/journal.mjs:13-15`, `23`, `103-113`).

### `rh_0` is unsalted by design

`rh_0 = SHA-256(stream_id)` has no salt and no nonce. **This is a design decision, not an open issue.** It was re-examined in a read-only design review on 2026-07-26, which re-derived the construction from this file and concluded it is correct as built. The reasoning is reproduced below so it does not have to be re-found.

The reasoning, in short: `stream_id` is not, and was never intended to be, confidential. It is a plaintext column in the local schema (`hub/journal.mjs:57`), it sits in plaintext inside the same predicate object as `rh` in every checkpoint (`hub/checkpoint.mjs:24-27`), and that predicate travels verbatim inside every exported evidence bundle (`hub/bundle.mjs:113-158`). An offline verifier is *handed* `stream_id`; it never has to guess it. So the "attacker must recover a hash preimage" premise does not apply, whatever the entropy of a given stream identifier.

The offline-verification consequence is the decisive half. A salt would have to either travel in the checkpoint, making it exactly as public as `stream_id` and therefore useless, or be withheld, which would make `journal_root_digest` unrecomputable and fail every legitimate verifier. Neither helps, and the second contradicts the offline verifiability the whole product rests on (§9).

Only the bare `journal_root_digest` scalar ever leaves the machine to a timestamp authority. The authority never sees `stream_id` or any receipt content (`hub/anchor-client.mjs`).

### Verification at boot

A daemon must never serve a journal it cannot prove is unbroken, but a full genesis-to-head replay on every boot grows without bound and eventually exhausts memory on a long-lived install. The resolution (`hub/index.mjs:95-148`):

- If the latest checkpoint's envelope signature and internal consistency verify, and it is anchored or anchoring is not required, boot replays **from that checkpoint forward** (`hub/journal.mjs:195-214`). Cost is bounded by rows written since the checkpoint.
- Otherwise boot does a full replay from genesis and records the timestamp (`hub/journal.mjs:165-182`, `90-97`).

The fast path is not a weaker check. Every row's `rh` is still recomputed and compared; nothing is trusted on presence alone. A stream created after the checkpoint was taken is absent from it and replays from genesis like normal, so nothing added later is exempted (`hub/journal.mjs:184-194`).

`helmd doctor` always runs the unconditional full replay. That is the tool for proving the whole history, and it is deliberately not what every boot does (`hub/journal.mjs:158-164`).

After a clean verification, boot advances the checkpoint frontier so the next boot's delta is bounded by one uptime rather than by the daemon's lifetime (`hub/index.mjs:150-164`).

### Broken journals

A journal that fails verification is no longer a dead end. The whole state directory is renamed aside with a timestamp, never deleted, a crash log recording `brokenAt` is written into the quarantined copy, `config.json` is carried forward because port and idle timeout are user preference rather than trust-sensitive state, and boot re-enters against fresh state (`hub/recovery.mjs:25-51`, driven from `hub/index.mjs:140-148`). A second failure immediately after quarantine refuses loudly instead of quarantining in a loop (`hub/index.mjs:129-139`). The recovery is announced in the boot banner, not only in a log line, because a double-click launch closes its console (`hub/index.mjs:301-310`).

### Checkpoints

A checkpoint is a signed summary: `{ checkpoint_seq, streams[], journal_root_digest, anchors[] }`, where `streams[]` is every stream's `{stream_id, journal_seq, rh}` head and `journal_root_digest` is the SHA-256 of the JCS-canonical `streams` array (`hub/checkpoint.mjs:23-36`).

Two verification functions exist and the difference matters. `verifyCheckpointSignature` checks only the envelope signature and that `journal_root_digest` really digests the `streams` it claims, which is what the boot fast path needs because boot's whole point is trusting a checkpoint that is behind the live head. `verifyCheckpoint` additionally requires the recorded heads to match the journal's current heads, which is the "matches right now" check (`hub/checkpoint.mjs:87-129`).

---

## 5. Runs, connectors, and consent

### The run engine

`executeRun` (`hub/run.mjs:375-459`) is a SQLite step-checkpoint executor over the journal.

Steps are planned from the workflow manifest in fixed layer order, `connectors`, `attested_artifacts`, `nodes`, `gates`, `actions`, with array order inside a layer as execution order (`hub/run.mjs:209-245`). That layer order is the **default** DAG, used whenever a manifest declares no binding. A manifest may also declare `connector_inputs[]`, and each declared binding orders a connector fetch ahead of the node it feeds, so the plan is a stable topological sort rather than a fixed linear chain (`hub/run.mjs:3-6`, `237-245`). Ties break on base index, so a manifest whose bindings impose no ordering keeps exactly the layer order it would have had.

Every step result is memoized by `(run_id, step_id, input_digest)`, where `input_digest` binds the run id, the step id, the step's content digest, the prior step's output digest, the dry-run flag, and, for a bound step, its resolved bindings (`hub/run.mjs:291-300`). This makes crash-resume and deterministic replay the same code path: resuming a run means the early steps' memo lookups hit instead of miss. Reading a memo recomputes the output digest from the stored payload every time, so a row altered after the fact fails loudly rather than feeding a wrong value forward (`hub/run.mjs:303-317`).

The lifecycle is a state machine with an explicit transition table, and an illegal transition throws (`hub/run.mjs:25-41`, `336-338`). Every transition is journaled as an `execution_state` entry on the `run:<run_id>` stream, and the engine predicts the journal sequence it is about to be assigned and throws if the prediction drifts, which turns any violation of the single-writer invariant into an immediate failure (`hub/run.mjs:340-358`).

The final `execution_hash` is SHA-256 over the JCS-canonical `{run_id, workflow_manifest_digest, steps[]}` (`hub/run.mjs:454`). `replayExecutionHash` recomputes it from persisted state alone, with no manifest re-fetch and no step execution, which is the deterministic-replay gate (`hub/run.mjs:462-487`).

### Kernel steps

A `nodes` step invokes a vendored OCG kernel. Before it runs, the manifest's `kernel_digest` is checked against the vendored file's own digest from `hub/vendored/ocg/MANIFEST.json`. A stale or tampered pin fails loudly rather than silently invoking a different kernel version than the manifest recorded (`hub/kernel-runner.mjs:3-8`, `19-47`).

When a kernel attaches a compute proof, both the binding and, for `groth16-bn254` receipts, the seal must verify before the step may complete. An unverifiable proof is a hard failure of the step, never a silent downgrade to a weaker trust label (`hub/kernel-runner.mjs:83-90`).

A step that reproduces is labeled `kernel_verified`. A step that cannot be reproduced throws rather than degrading its label, because collapsing or mislabeling trust claims is forbidden (`hub/kernel-runner.mjs:48-52`, `94`).

### Human consent inside a run

Consent is a hold, not a prompt. A step whose pack item declares a gate policy blocks **before** the step runner is ever invoked, and stays blocked until the gate check reports satisfied. The run transitions to `awaiting_data` and returns (`hub/run.mjs:412-427`, `hub/ha-gate.mjs`). Three properties follow directly from that placement:

- A gated step never runs speculatively.
- A held attempt is never memoized, so re-polling costs nothing and re-reads fresh approval state every time.
- What a human approves is the OCG artifact's own execution hash, which is why the gate check is handed the full prior step output rather than only the internal memo digest (`hub/run.mjs:418-421`).

Resuming is `POST /run/resume`, the same idempotent path crash recovery already uses. A run that is not actually held returns 404 or 409, never a silent 200 (`hub/server.mjs:559-570`).

### Connectors and egress

A connector may only reach a `(host, method)` pair present in its own signed contract's allowlist. No wildcard, no path matching, no fallthrough (`hub/connector.mjs:54-56`). The contract is schema-validated on load and its digest is the SHA-256 of its own JCS-canonical form (`hub/connector.mjs:43-50`).

Every egress decision, allowed or blocked, is journaled to an append-only per-connector stream **before** the call throws, so a block is provable evidence rather than a swallowed error (`hub/connector.mjs:237-256`, `285-296`).

`performEgress` is the single choke point, and it is hardened past the hostname allowlist (`hub/connector.mjs:275-327`):

- **Redirects are manual.** Node's default follow behavior would egress to a redirect target that was never checked against the contract, so each hop gets its own allowlist check and its own journal entry, capped at five (`hub/connector.mjs:266-271`, `312-319`).
- **DNS rebinding is closed at the resolution layer.** The hostname is resolved and every returned address is checked against a hardcoded deny list covering loopback, private ranges, carrier-grade NAT, and link-local including the cloud metadata address, for both IPv4 and IPv6 including IPv4-mapped forms (`hub/connector.mjs:72-142`). The vetted address is then **pinned** through a one-time patch of `node:dns`'s `lookup`, so the connect uses the exact answer the guard vetted rather than a second independent DNS round trip an attacker with a short TTL could answer differently (`hub/connector.mjs:151-232`). The pin is reference-counted and released in a `finally`.
- The deny list applies only to connector egress. The daemon's own loopback API and the OAuth loopback redirect call `fetch` directly and never pass through here, so their legitimate `127.0.0.1` use is unaffected by construction rather than by a carve-out (`hub/connector.mjs:64-71`).
- A 15 second timeout means a hung endpoint cannot stall the runtime (`hub/connector.mjs:259`).

Secrets are resolved to a header value at the egress boundary, so connector code handles an opaque credential descriptor and never the raw secret (`hub/connector.mjs:272-276`, `hub/credential-provider.mjs`). Secrets at rest go to the platform keychain first, macOS Keychain, Linux Secret Service, or Windows DPAPI, falling back to an AES-256-GCM encrypted mode-`0600` file whose key is scrypt-derived (`hub/vault.mjs:32`, `98`, `124`, `144`, `204-224`).

A connector result is labeled `connector_asserted`: it claims only that an authorized connector retrieved or received the payload, never that the payload is true, and it carries a payload digest rather than the bytes (`hub/connector.mjs:329-350`).

### The read tier ruling

There is a ruling on record that **bulk evidence export does not belong inside a capability tier named "read"**. The wording is that `evidence.export` sitting inside a capability boundary named READ/RUN is bulk exfiltration behind a gate called read, and that export must be split out of the read tier before any agent-facing surface ships it.

**Status: the ruling exists, the surface it constrains does not.** There is no MCP endpoint in this repository today. The Agents and MCP navigation slot ships disabled, with no route reachable. The point of recording the ruling here is that the constraint is on the record before the surface is built, not after.

The general principle it expresses is already load-bearing elsewhere in the design: a capability name is a promise about blast radius, and "read" implies bounded, targeted access. An operation that hands over the entire evidence corpus in one call is not a read, whatever the verb in its name.

---

## 6. Evidence and offline verification

This is the load-bearing claim of the product, so it is sourced precisely.

### What gets signed

Every signed Helm object is an in-toto Statement v1 inside a DSSE envelope (`hub/envelope.mjs:15-16`). The payload is canonicalized with the same JCS canonicalizer the OCG kernels hash with, so a statement's bytes never diverge from the OCG digest convention (`hub/envelope.mjs:7-10`, `55`).

Signing is dual. Ed25519 is required, ML-DSA-44 is a co-signature (`hub/envelope.mjs:54-69`). Verification treats Ed25519 as mandatory and ML-DSA-44 as recommended: an absent post-quantum signature does not fail the envelope, but a **present and wrong** one does, so a tampered co-signature is still caught. A `strict` option flips both to mandatory for the day post-quantum becomes required (`hub/envelope.mjs:71-104`).

The DSSE pre-authentication encoding binds `payloadType` into the signed bytes, so a signature cannot be replayed across payload types (`hub/envelope.mjs:34-43`).

### Bundles

`assembleBundle` (`hub/bundle.mjs:113-158`) seals each object, builds a manifest predicate listing every entry's kind, digest, and trust label plus checkpoint and anchor references, schema-validates it, and signs the manifest.

Redaction is a structural backstop, not a hope. Objects entering a bundle are expected to already be digest-only summaries, and a set of known-dangerous field names (`access_token`, `refresh_token`, `id_token`, `secret`, `secretKey`, `privateKey`, `password`, `api_key`, `raw_payload`, `payload_bytes`, `payload_body`) is refused outright, recursively, so an upstream mistake cannot leak through silently (`hub/bundle.mjs:60-76`).

Each object carries exactly one trust label, defaulted by kind, and labels are never collapsed (`hub/bundle.mjs:37-59`).

### Verifying offline

`verifyBundle` (`hub/bundle.mjs:160-205`) takes a bundle and a set of public keys and does zero network work. It checks the manifest envelope and schema, that the signed predicate matches the carried one, and then for every entry: the object exists, its kind matches, its trust label matches, its envelope verifies, its **recomputed** digest matches the manifest entry, and its predicate still passes the redaction check. Checkpoint envelopes are verified and cross-referenced. It returns `{valid, reasons[]}` and never throws on a bad bundle, which is what a deliberately tampered fixture asserts against.

`exportBundleZip` (`hub/bundle.mjs:221-261`) produces the shareable artifact: `bundle.json` (the evidence itself), `verify.html` (a standalone verifier that runs in any browser with no network), `auditor.html` (a printable human-readable record), and a README. The export runs the same WebCrypto verify chain the embedded `verify.html` will run, against the real code path rather than a simulation, so a bundle that would not verify is caught before it ships.

Verification does not need `helmd`. It needs the bundle and the public keys, both of which travel inside the zip.

### Anchoring

Anchoring submits only the `journal_root_digest` to an external timestamp authority. Two types can be emitted, `rfc3161` and `opentimestamps`; a `scitt-receipt` type is reserved and never emitted (`hub/anchor-client.mjs:3-5`).

The RFC 3161 path reuses the shipped Anchor Suite relay at `anchor.ainumbers.co` and its vendored TimeStampReq builder, the same code the browser-side anchor and verify pages run, rather than reimplementing DER encoding (`hub/anchor-client.mjs:7-10`, `22`). The OpenTimestamps path posts the raw digest to public calendars and stores the returned pending attestation as-is; upgrading that to a full Merkle-to-block-header proof is **not built** (`hub/anchor-client.mjs:12-17`).

Anchoring is off by default (`hub/config.mjs:44`) and is logged once per boot when disabled, with the exact config key to change (`hub/index.mjs:212-219`). A checkpoint that could not be anchored is still a valid, verifiable signed object; a relay failure produces a schema-valid queued or skipped marker rather than an exception (`hub/checkpoint.mjs:20-22`, `50-55`).

---

## 7. Borrowed versus built

| Component | Where it came from | License | Why |
|---|---|---|---|
| OCG kernels, `_hash.mjs`, `_computeproof.mjs`, `_proof.mjs`, `_rfc3161.mjs`, SPEC.md, v0.4 schema, `chaingraph.json` | `github.com/PostOakLabs/ainumbers`, pinned at `31e0402` | MIT (site repository `LICENSE`) | The kernels are the deterministic compute. Reimplementing them here would create a second canonical hash path, which is exactly the failure the pin exists to prevent. |
| Anchor Suite `tsq.mjs` (RFC 3161 TimeStampReq builder) and its PKI.js bundle | `github.com/PostOakLabs/anchor-suite`, pinned at `1aa6d22` | MIT, with third-party BSD-3-Clause and MIT code preserved in-file inside the PKI.js bundle; see NOTICE (`hub/vendored/anchor-suite/MANIFEST.json`) | DER encoding for timestamp requests is exacting and already shipped and exercised in the browser. Vendoring the shipped code beats a second implementation. |
| ML-DSA-44 implementation | Reached through `hub/vendored/ocg/kernels/_proof.mjs` | Follows the OCG vendored tree above | Same reason as the kernels. One implementation, one canonical form. |
| Helm itself: `hub/`, `ui/`, `scripts/`, `schema/` | Written here | Apache-2.0 (`LICENSE`, `package.json`, SPDX header on every source file) | Phase 4 decision. The repository is public under Apache-2.0. |

**The vendoring invariant, stated plainly because a reader will otherwise get it wrong:** vendored code is **never edited in `helm/`**. A defect in a kernel is fixed upstream in the site repository and then re-vendored (`npm run vendor`, `scripts/vendor.mjs`). A local edit would break the digest pin that `hub/kernel-runner.mjs:19-47` enforces, which means the very next run would fail rather than silently diverge. The invariant is enforced by the code, not only by convention.

**Vendor manifests record the pinned commit.** `hub/vendored/ocg/MANIFEST.json` carries `sourceRepo`, `pinnedSha`, `vendoredPaths`, a file count, and a SHA-256 per file. The same shape covers the Anchor Suite vendor.

**No n8n or Windmill code, ever.** This is a licensing constraint and it is absolute. n8n appears in this repository only as the name of an external system Helm interoperates with, in an allowlist host string, in test fixtures, and in comments explaining what the inbound webhook route is for (`hub/connectors/inbound-webhook.contract.json:5`, `hub/server.mjs:62`, `hub/webhook-guard.mjs:11`). No line of n8n or Windmill source is present, and none may be added.

### Standards followed rather than invented

Verified against the source files that cite them:

- **JSON Canonicalization Scheme, RFC 8785.** The canonical form under every digest (`hub/envelope.mjs:8`).
- **DSSE**, payload type `application/vnd.in-toto+json`, with the standard pre-authentication encoding (`hub/envelope.mjs:16`, `36-43`).
- **in-toto Statement v1**, `https://in-toto.io/Statement/v1` (`hub/envelope.mjs:15`).
- **Time-Stamp Protocol, RFC 3161** (`hub/anchor-client.mjs:7`).
- **OAuth 2.0 for Native Apps, RFC 8252**, the loopback redirect flow, with PKCE (RFC 7636) and OAuth 2.0 itself (RFC 6749). Token revocation is RFC 7009 where a provider offers it; GitHub does not, and the code says so rather than pretending (`hub/oauth-pkce.mjs:3`, `24`, `98`, `hub/oauth-providers.mjs:19`).
- **SMTP, RFC 5321**, including reply-line continuation and dot-stuffing (`hub/connectors/smtp-send.mjs:40`, `175`).
- **ML-DSA-44**, the FIPS 204 parameter set, as the post-quantum co-signature.
- **BPMN 2.0** for workflow export (`hub/bpmn-export.mjs`) and **DMN** for decision tables (`ui/lib/decision-table.mjs`).
- **EU AI Act Regulation 2024/1689 Article 12(2) and 12(3)** record-keeping fields, enforced per journal entry (`hub/journal.mjs:13-15`, `103-113`).

One citation is carried as the source file states it rather than independently confirmed in this pass: `hub/envelope.mjs:6-8` attributes the JOSE algorithm identifiers `"EdDSA"` and `"ML-DSA-44"` to **RFC 9964**. The identifier strings in the emitted envelopes are `EdDSA` and `ML-DSA-44` and that is verifiable from the code (`hub/envelope.mjs:65-66`); the RFC number is quoted from the comment and has not been checked against the RFC index here.

### Zero npm dependencies, deliberately

`package.json` declares `"dependencies": {}` and the repository has no runtime dependency at all. This is not an accident of a small codebase and it is not a preference. It is asserted by a test so it cannot regress (`bin/zero-dep.test.mjs:16-18`).

Consequences visible throughout the code:

- The journal uses the Node builtin `node:sqlite` rather than `better-sqlite3`, which is why transactions are hand-wrapped (`hub/journal.mjs:16-19`, `39-49`).
- JSON Schema validation is a hand-rolled validator (`scripts/lib/schema-validator.mjs`), not Ajv.
- Opening a browser shells out to each platform's native opener rather than using the `open` package (`hub/index.mjs:34`, `60-73`).
- The CLI is `process.argv.slice(2)` and a chain of comparisons, with the zero-dep test spelling out that a CLI framework must never sneak back in (`bin/zero-dep.test.mjs:4-6`, `hub/index.mjs:455-466`).

---

## 8. Design constraints, and why the product has this shape

The governing constraint is: **if nobody ever touched this again, does it keep working and keep being true?**

That single question explains nearly every structural decision above, and it is worth being explicit that these are consequences of it rather than independent preferences:

- **Zero dependencies** because a dependency is a promise that someone will keep upgrading it. An unmaintained dependency tree is the most common way software stops working without anyone touching it.
- **No build step** because a build step is a second thing that must keep working, on a machine nobody is maintaining, with a toolchain that ages.
- **Client-side and local-first compute** because a service that computes on your behalf stops computing when the service stops. A deterministic program on your own machine does not.
- **An offline verifier shipped inside the evidence bundle** because verification that depends on a server is verification that expires. `verify.html` in the zip has no network dependency, so a bundle checked in five years is checked the same way it was checked on the day it was made.
- **Deterministic kernels with pinned digests** because "the same inputs produce the same outputs" is what makes a receipt re-checkable by someone who was not there and cannot ask anyone.
- **Anchoring off by default** because the core loop must not depend on a third party being reachable. Anchoring adds a claim about *when*; it is deliberately additive, and its absence degrades nothing.
- **Announcing behavior rather than only enforcing it** (idle shutdown in `/health`, in `helmd status`, and in the boot banner) because a surprise that requires a human to explain it is a maintenance duty in disguise.
- **No promises about time anywhere in this repository.** No response windows, no support commitments, no update cadences, no uptime figures. An unmet published promise is worse than no promise, and there is nobody funded to honor one.

The autostart change in §3 is the same constraint applied to consent. A silent persistence install relies on a console announcement being read, and the audience for a downloaded executable double-clicks it and closes the window. A mitigation that depends on a human noticing something is a mitigation that does not survive the absence of that human, so the default became off and the toggle became a surface that persists.

---

## 9. Known limitations

Published deliberately. A reader finding these is worse than a reader being told.

1. **Binaries are unsigned.** The single-executable builds are not code-signed. Microsoft Defender and SmartScreen commonly flag an unsigned single-executable binary on first run, and Smart App Control can block one outright, with no mitigation currently built for that case. Clean-file submission to Microsoft is a manual runbook and an unsigned binary hash needs re-submission per build (`docs/INSTALL.md:94-97`, `docs/CATEGORIZATION-SUBMISSIONS-RUNBOOK.md:6-16`, `68-80`). The macOS component package is likewise unsigned (`docs/IT-DEPLOYMENT.md:50-62`). A blocked launch is hard to distinguish from nothing happening, which is the real cost.

2. **Connector and action dispatch is wired, but narrowly, and only for browser-originated runs.** This limitation used to read "no runner in the served run path"; that is no longer true, and the change is worth stating precisely because it widens what a run can reach. The kernel step runner throws for any step kind other than `nodes` and `attested_artifacts` unless it is given an `otherKindsRunner` (`hub/kernel-runner.mjs:124-129`). Two production call sites now supply one: `POST /run/resume` unconditionally (`hub/server.mjs:580`), and `startWorkflowRun`, which backs `POST /run/start`, **only when `callerOrigin === "ui"`** (`hub/run-actions.mjs:129-131`). Anything other than the literal `"ui"` fails closed, so an MCP-originated run still gets no connector or action capability. A third call site remains bare (`hub/server.mjs:722`).

   What the dispatcher can actually reach is narrower than "connectors work". A step's manifest item carries only what the schema allows, so today only a connector whose invocation reduces to reaching `target_host` is dispatchable at all; `google-drive.fetch` and `smtp.send` need parameters no manifest member carries and are deliberately absent from the registry rather than listed with a builder that always throws (`hub/connectors/dispatch.mjs:11-20`, `46`). Gate steps still have no runner. Among the compiled packs in `packs/`, one declares a connector step (`packs/pack-2052a-classify-daily.json`) and one declares an attested artifact (`packs/pack-bank-nydfs-annual-certification.json`); the rest declare only `nodes`.

3. **The Google Drive connector is not wired to anything.** `hub/connectors/google-drive-fetch.mjs` is imported only by its own test file. It is a complete connector with a signed contract and no production caller, which is a specific case of the previous item.

4. **The OpenTimestamps anchor is stored as a pending attestation only.** Upgrading it to a full Merkle-to-block-header proof, the step a complete OTS client performs later, is not built (`hub/anchor-client.mjs:12-17`).

5. **Manifests have one kind of edge, not a general DAG.** This limitation used to read "manifests have no edges". A manifest may now declare `connector_inputs[]`, and each binding orders a connector fetch ahead of the node it feeds, resolved by a stable topological sort that throws on a cycle (`schema/workflow-manifest.schema.json:149`, `hub/run.mjs:237-283`). That is the only edge vocabulary there is: every edge runs connector to node. Conditional execution, fan-out, and fan-in are still not implemented, so a workflow that needs real branching cannot be expressed.

6. **Review states are not in this engine.** The run lifecycle here is a Phase 1 subset; review states are named in the spec and not reachable through this executor (`hub/run.mjs:23-28`).

7. **No agent-facing MCP endpoint exists.** The navigation slot ships disabled. The read-tier ruling in §5 constrains a surface that has not been built.

8. **`hub/vendored/ocg/MANIFEST.json` records no license field**, unlike the Anchor Suite manifest which does. The license is MIT, from the site repository's own `LICENSE`, but the vendor manifest does not state it, so the fact lives one repository away from the vendored code.

### Two limitations on record elsewhere that the code no longer supports

Both are recorded here because the accuracy rule requires the disagreement to be written down rather than silently resolved.

- **"Journal corruption crashes rather than degrades" is no longer true.** It was true when it was written. `hub/recovery.mjs` and the boot path at `hub/index.mjs:126-148` now quarantine the broken state directory with a timestamp, never delete it, carry `config.json` forward, write a crash log into the quarantined copy, and re-enter boot against fresh state, announcing all of it in the banner. The residual risk is different and smaller: an install whose journal breaks starts over from empty, and the old data is preserved only as a quarantined directory a human must go look at.

- **"`exportBpmn` is unreachable" is no longer true.** It is reachable from the CLI: `helmd export-bpmn <workflow_id> [out.bpmn]` dispatches to `scripts/export-bpmn.mjs`, which loads a compiled pack and calls `exportBpmn` from `hub/bpmn-export.mjs` (`bin/helmd.mjs:31`, `115-116`). It is documented in `helmd --help` and listed among the stable verbs (`bin/helmd.mjs:52-53`, `72`). What remains true is that there is no HTTP route and no UI button for it, so it is CLI-only.
