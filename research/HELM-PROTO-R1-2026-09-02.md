# HELM-PROTO-R1 — phil threat-model review of the `helm://` dispatch path

**Date:** 2026-09-02 · **Row:** HELM-PROTO-R1 (class R, review) · **Verdict: PASS** — all four §2 MUST-NOTs CONFIRMED in the landed source; no findings that gate `HELM-PROTO-4`.
**Anchor:** `HELM-PROTO-BUILD-SPEC.md` §2 (threat model), §3.1 (squatting), §8 (WU row), §10.2 (CVE scope correction), §10.3.
**Gates:** `HELM-PROTO-4` (helm.html dual-presentation Try-It-Now) may merge only after this review.

## Tree freshness (SO #48)

Reviewed tree: `PostOakLabs/ainumbers-helm` `origin/main @ 3c5dd4b7791ada7dcb1bf07670e9789b08187e44` (the merge commit of HELM-PROTO-3, PR #251; contains #247 = 32b6229 and #250 = 33ca628). Read in a fresh worktree (`git worktree add` off `origin/main` after `git fetch`; worktree HEAD == `origin/main` at measurement time; the shared `helm/` checkout sat stale at 40e9d77 and was NOT used). Site repo (`PostOakLabs/ainumbers`) `origin/main @ 54def60454193c4891a82f718ef75525d06c1fcf` hosts this write-up.

## Method

Independent read of the landed source, not of spec prose and not of the tests' claims (SO #34 spirit for review rows): `hub/protocol.mjs` (448 lines, whole file), the `helm://open` dispatch path in `hub/index.mjs` (imports 27-43; `cmdOpen` 480-504; `cmdStart` open gate 396; argv dispatch 567-582; `cmdUninstall` 421-443), the consent endpoint in `hub/server.mjs` (`GET`/`POST /autostart` 453-558; request gate order 1415-1486), `hub/token.mjs` `pairingUrl()` 35-39, `hub/doctor.mjs` wiring 176, and `bin/helmd.mjs` (grep: zero argv or scheme surface). PR bodies #247/#250/#251 read for context. Landed tests then corroborated by running `HELM_NO_OPEN=1 node --test hub/protocol.test.mjs hub/from-scheme.test.mjs` on the reviewed tree: 30 pass / 0 fail.

## §2 MUST-NOT 1: No token acceptance via handler arguments — CONFIRMED

The registered command has no channel for invocation bytes at all. Windows: the `shell\open\command` default is `"<helmd.exe path>" open --from-scheme` (`protocolCommandValue()`, protocol.mjs:64-66); it contains no `%1` placeholder, so Windows never appends the invoking URL to argv. Linux: the `.desktop` `Exec=` line (`desktopEntryContent()`, protocol.mjs:172-188) carries no `%` field code, which is the freedesktop launcher's only mechanism for appending caller-supplied arguments; it is absent entirely. The CLI's entire scheme footprint is one fixed-literal presence check, `args.includes(FROM_SCHEME_FLAG)` (index.mjs:576); `cmdOpen({ fromScheme })` receives a boolean and reads nothing else (index.mjs:480-504). Tokens stay where token.mjs puts them: daemon-minted (`loadOrCreateToken()`), never parsed from any scheme input; the one-URL-per-click tab is `http://127.0.0.1:<port>/#token=...&pair=...&fp=...` assembled solely from daemon state (`pairingUrl()`, token.mjs:35-39). `helm://open?token=...` has no recipient: no code path reads a URL.

## §2 MUST-NOT 2: No file paths parsed from the invocation — CONFIRMED

No invocation string is parsed anywhere. `grep` over `hub/` and `bin/` finds `helm://` only in comments and status-line text; there is no scheme-URL reader in the codebase. The only path in the registered command is the install-time binary path, self-derived from `process.execPath` / `process.argv[1]` at registration time (`protocolCommand()`, protocol.mjs:46-50) — how the installing process itself was started, never what a later invocation carried. No scheme verb in this WU set touches the filesystem.

## §2 MUST-NOT 3: No auto-actions beyond fronting/starting the dashboard — CONFIRMED

Two things only, exactly the spec's (a)+(b):

- **Already-running click:** `cmdOpen` asks the running daemon over the same-user CLI channel (`callDaemon("pair")`, ACL-gated named pipe/UDS); the daemon mints the pairing URL and opens the tab server-side (index.mjs:309-313). No second daemon boots (from-scheme.test asserts it).
- **Not-running click with `--from-scheme`:** falls through to `cmdStart({ open: true })` (index.mjs:497-499) — the same start path a Start Menu double-click uses. The click writes no persistence: `index.mjs` does not import `installProtocol` at all (import list, index.mjs:38 — a structural guarantee, not a discipline), the daemon start path installs nothing (HELM-AUTOSTART-1), and the idle timer owns the daemon's lifetime.

Registration itself is consent-gated on the pre-existing surface: `POST /autostart` with `body.protocol` (server.mjs:543-549), behind the full Host + Origin + Bearer gate — verified by reading the dispatch order in `createHelmServer`: Host check (1415) and Origin check (1444) and bearer match (1468-1482) all precede the `routes` lookup (1485); the autostart routes are in `ROUTES`, not in `serveStatic`'s pre-auth allowlist and not in `DETECTION_PATHS`. `GET /autostart` reports state and writes nothing. Each toggle field applies only when its own boolean is present, so an older tab's `{autostart:...}` POST cannot touch the scheme registration. Plain `helmd open` keeps its exit-1 client contract (index.mjs:501-502).

## §2 MUST-NOT 4: No echoing of caller-supplied data into the opened tab — CONFIRMED

There are no caller-supplied bytes to echo: the invocation contributes nothing (MUST-NOT 1), and the tab the scheme click ends at is always the bare daemon-minted dashboard URL `pairingUrl()` produces, identical to what `helmd open` or a first run would open.

## Registered command line is a fixed literal — CONFIRMED by independent read (row done-item 3)

Verified from the construction code, not from the fixture test that asserts it: `protocolCommand()` accepts only injectable overrides (used by tests) and otherwise derives `command` = `process.execPath` and the fixed args `["open", FROM_SCHEME_FLAG]` (protocol.mjs:46-50); `protocolCommandValue()` quotes the executable and joins the fixed args (64-66); the Linux `Exec=` is the twin with no `%` code (164-188). `FROM_SCHEME_FLAG` is exported once and imported, never re-spelled, in `index.mjs` (38-40, 576). The landed tests corroborate on the reviewed tree: `hub/protocol.test.mjs` gate 1 pins the exact string and the one-templated-sequence regex for both platforms (lines 49-52, 346-365), and `hub/from-scheme.test.mjs` pins the CLI half against comment-stripped source (one `process.argv` read, `FROM_SCHEME_FLAG` exactly twice, `cmdOpen` contains no argv reference, fallthrough target literal). 30/30 green in my run.

## Residual risk (row done-item 2) — the two protocol-handler mechanisms, kept separate

**The real residual risk is OS-native scheme squatting (spec §3.1), and it stands as disclosed.** Registration is per-user and unauthenticated by design: last writer to `HKCU\Software\Classes\helm` (Windows) or to the `x-scheme-handler/helm` association (Linux `mimeapps.list`) wins; there is no signer check on either surface; a malicious app that registers `helm://` first or overwrites the entry later receives the click. This is an OS property no installer can close. What the landed diff adds is exactly what §3.1 asks for, detectability rather than prevention: `protocolStatus()` reports `target_missing` / `unreadable` as `stale: true` (never healthy, both platforms), the Linux branch additionally detects a displaced default via `xdg-mime query` (stale, doctor FAIL), and the `protocol_handler_valid` doctor check plus the `helm://` line in `helmd status` surface all of it. The OS/browser dispatch prompt remains the user-facing trust signal: it names whatever handler is registered, per click, with a per-origin remember.

**CVE-2025-1935 is a different mechanism and does not apply here.** It is Firefox/Thunderbird-only (fixed Firefox 136 / ESR 128.8) and is a clickjacking of the info-bar of the web-facing `navigator.registerProtocolHandler()` API, i.e. a WEBSITE registering ITSELF as a handler. Helm's `helm://` uses none of that: there is OS-native registration only (`HKCU\Software\Classes\helm`, freedesktop `.desktop` + `xdg-mime`), no `registerProtocolHandler` call anywhere in the estate, and no Chrome/Edge CVE of equivalent shape against OS-native registration was found in the respec retrieval (spec §10.2). Nothing in the residual-risk picture may be cited to or excused by CVE-2025-1935; the squatting analysis above is self-contained.

## Observations (non-blocking, recorded for the estate)

1. **Windows foreign-but-existing registration is surfaced, not failed.** If the recorded command points at an existing binary that is not this Helmd (`command_mismatch`, `stale: false`), the doctor check returns `pass: true` with a detail line quoting the recorded path (protocol.mjs:390-404). The in-code rationale ("the recorded entry would still launch a working Helm") holds only when the foreign binary is another Helm copy; a squatter's binary is indistinguishable by path alone. This mirrors the estate's established `autostart.mjs:255` semantics and the pattern the spec names, and the OS prompt still names the true handler, so it is detectable, not silent. But note the asymmetry: `helmd status`'s one-line form prints only "installed (...)" for this case (the mismatch detail lives in `helmd doctor`), and Linux's displaced-default case DOES fail hard because `xdg-mime query` answers authoritatively. Daemon-side (PROTO-1 territory); fine to defer to a future sweep, does not gate PROTO-4.
2. `reg add` overwrites the three values without removing foreign subkeys under the `helm` key; `helmd uninstall`'s `reg delete ... /f` removes the whole tree. Co-ownership nuance inherent to last-writer-wins; acceptable.
3. On a headless Linux box where `xdg-mime query` fails, the association question goes unanswered and status reports the verified entry only. Documented in-code; honest.
4. macOS remains `supported: false` on every surface (FLAG-AND-WAIT per §3.2/§7.1) — confirmed in the landed dispatch (`plat !== "win32" && plat !== "linux"` falls through to unsupported), so no half-working macOS leg exists to review.

## Verdict

**PASS.** The four §2 MUST-NOTs hold in the actual landed diff (origin/main @ 3c5dd4b, ainumbers-helm), the registered command is a fixed literal by construction on both shipped platforms, uninstall and staleness visibility are complete per §4/§3.4, and the residual-risk story correctly separates OS-native squatting (real, disclosed, detectable) from CVE-2025-1935 (different mechanism, not applicable). **No findings for HELM-PROTO-4; the merge gate this row holds is released.**
