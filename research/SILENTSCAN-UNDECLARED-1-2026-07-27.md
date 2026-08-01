# SILENTSCAN-UNDECLARED-1 — Report (2026-07-27)

**Row:** `board/queued/SILENTSCAN-UNDECLARED-1.md` → `board/done/`. Origin spec: `AUDIT-SILENT-CLASS-SPEC-2026-07-27.md` §2/A1, extended per this row.
**Scope:** report-only, zero pages fixed. Extended `repo/scripts/scan-silent-fail.mjs` with a new predicate (case b: synchronous use of an identifier with no declaration anywhere in the file, and not a known global). Full re-scan across `tools/` (529), `guides/` (106), `chaingraph/` incl. `chains/`+`runners/` (970) = **1,605 files**.
**Read first:** `board/done/ESCDAG-FIX-1.md` confirmed the `esc()` chain-page hazard (143 never-declared, 2 declared-in-a-later-block) already fixed and gated separately (`scripts/check-dag-idents.mjs`). Per the row, `esc` hits are attributed to that WU, not re-reported here.

---

## 0. Allowlist — stated and justified (case b lives or dies here)

Base `KEYWORDS` (pre-existing, case-a scanner) already covered the common set: `window,document,console,Math,JSON,Object,Array,String,Number,Boolean,Date,Error,Promise,Map,Set,RegExp,Symbol,Infinity,NaN,arguments,fetch,localStorage,sessionStorage,navigator,location,history,parseInt,parseFloat,isNaN,isFinite,encodeURIComponent,decodeURIComponent,setTimeout,setInterval,clearTimeout,clearInterval,requestAnimationFrame,Element,HTMLElement,CustomEvent,Event,Blob,FormData,URL,URLSearchParams,Intl,structuredClone,globalThis,self,crypto,TextEncoder,TextDecoder,performance,alert,confirm,prompt`.

Added `CASE_B_GLOBALS` for this row, each justified:

- **Typed arrays / binary data** (`Uint8Array` … `BigUint64Array`, `ArrayBuffer`, `DataView`) — ubiquitous in this site's hash/crypto kernels (§16/§18 signing, digest code).
- **Runtime builtins** (`WeakMap`, `WeakSet`, `Reflect`, `Proxy`, `SubtleCrypto`, `WebAssembly`) — standard ES/Web Crypto globals not in the original KEYWORDS set.
- **Browser/DOM globals** (`MutationObserver`, `ResizeObserver`, `IntersectionObserver`, `requestIdleCallback`, `atob`/`btoa`, `getComputedStyle`, `indexedDB`, `CSS`, `Node`, `NodeList`, `DOMParser`, `XMLSerializer`, `FileReader`, `ReadableStream`, `WritableStream`, `Worker`, `Notification`, `Image`, `Audio`, `Option`, `OffscreenCanvas`) — standard browser APIs, observed in real page code during adjudication.
- **`unescape`/`escape`** — deprecated but still-standard browser globals; found in real decode helpers.
- **Error subclasses** (`TypeError`, `RangeError`, `SyntaxError`, `EvalError`, `URIError`, `ReferenceError`, `AggregateError`) — the original KEYWORDS had base `Error` only; every subclass is equally a real global and their absence was a pure oversight, not a judgment call.
- **`module`, `exports`, `define`, `require`** — the CommonJS/AMD/UMD environment-detection idiom (`typeof module !== 'undefined' && module.exports = ...`). Every occurrence found in the full re-scan was inside (or short-circuit-protected by) a `typeof X !== 'undefined'` guard — exception-safe by construction, not a hazard. Confirmed present in two vendored bundles (Chart.js, PapaParse) and one authored UMD-style export footer (`tools/525-iscc-content-code-generator.html`).

**Page's own `<script src=...>` imports:** a file that loads any local script could define globals this scanner cannot see. Case (b) is skipped ENTIRELY for such files (2 skipped in the full scan) rather than guessed at — same "unknown-safe, not silently ignored" posture as the row asked for.

---

## 1. Parameter/local-scope tracking — CHOSEN (not "expect high false-positive rate")

Per the row's instruction to either add tracking or budget for a high false-positive rate and say which: **I added tracking.** `collectAllLocalNames()` walks the whole block (any nesting depth, FILE-WIDE not scope-precise — same heuristic posture as the rest of this hand-rolled scanner) and captures every name bound as: a function parameter (including destructured/defaulted/rest), an ES6 method-shorthand parameter, an arrow-function parameter, a `var`/`let`/`const` declarator (including destructuring), a `catch` parameter, a class name, and an ES-module `import` binding. A name bound this way ANYWHERE in the file suppresses case-(b) flagging for every use of that name in the file — deliberately coarser than real JS scoping (a genuinely-undeclared global sharing a name with an unrelated parameter elsewhere would be masked), accepted because the alternative — no tracking — turns every parameter name in every function into a false-positive candidate, which would drown the real findings this row exists to surface.

**Positive proof this tracking works** (not just asserted): a scratch page with `function setCell(wb, ref, raw) { return wb; }` calling `setCell({},1,2)` from a load-time IIFE, with `let wb = {}` declared afterward — the exact shape `SILENT-FAIL-AUDIT-1` denied as a case-a false positive — produces **zero** case-b findings (`wb` correctly recognized as a parameter, not an undeclared global).

---

## 2. Positive controls — required before any count is trusted (§4 doctrine, `SILENT-FAIL-AUDIT-1` precedent)

**(1) RED on case (b):** a scratch page with `(function init(){ foo(); })();` and no declaration of `foo` anywhere → scanner flags `foo` as never-declared. ✅ Confirmed, held through every fix in this session.

**(2) RED on case (a), UN-REGRESSED:** reproduced the `CANON-ORDER-1` shape exactly per `SILENT-FAIL-AUDIT-1`'s own method — swapped `chaingraph/chains/2052a-classify-daily.html`'s OCG-CANON `<script>` block (defines `__ocgCanonStr`) to AFTER the block that calls it synchronously in `init()`. Scanner still flags `__ocgCanonStr` used at line 283, declared in a later block. ✅ Confirmed un-regressed across every fix in this session — case (a)'s own logic (`analyzeFile`) was never touched, only shared helpers (`blankNonCode`, `collectAllLocalNames`) that case (a) also benefits from.

**(3) GREEN:** the clean, unmodified `2052a-classify-daily.html` and the `wb`-parameter-shadow scratch page both produce zero findings.

All three re-verified after every fix below (11 rounds total), never regressed.

---

## 3. Scanner defects found and fixed during this audit — WHY the raw count moved so much

Started at **4,567** raw case-b candidates on the first real run. Ended at **197**. This is not "adjudicated away" — six were structural bugs in the scanner itself (one pre-existing, five introduced by this row's own new code), found by iterating a length-preservation invariant check (`blanked.length === content.length`, required by every downstream offset calculation) and by tracing the highest-count false positives back to their source:

1. **Nested template literals corrupted the lexer.** The original `blankNonCode`'s backtick handling scanned to the NEXT raw backtick — a nested template inside a `${...}` hole (`` `${items.map(x=>`<div>${x}</div>`)}` ``) made it treat the FIRST inner backtick as closing the OUTER literal, leaving HTML markup un-blanked and read as live code. Rewrote as `blankTemplateLiteral`/`blankRange`, a hole-aware, recursive, position-preserving pair. This alone explained the initial flood of HTML tag/attribute names (`div`, `span`, `href`, `width`, `style`, 248/129/100+ hits each).
2. **ES6 method-shorthand params never tracked.** `download(manifest, filename) { ... }` inside an object literal has no `function` keyword; the original param-capture regexes never saw it, so every occurrence of that pattern across the site made `manifest`/`filename`/`toolId`/`sab`/etc. look like undeclared globals (`sab` alone: 129 hits).
3. **A lazy `up-to-next-;` regex broke on nested statements.** `var obs = new MutationObserver(function(){ var sab = ...; ... });` — the FIRST `;` is inside the callback, so the naive match truncated the OUTER `obs` declarator there and the inner `var sab` was silently skipped. Rewrote as a depth-aware manual scan.
4. **Method-shorthand NAMES misread as calls.** The generic identifier-use scan has no notion of "this position is a definition, not a use" — `download(...)` the property key read identically to a call to an undeclared `download`. Fixed by recording each method-def name's exact offset and excluding it from the use-scan.
5. **`[^)]*` param-list regexes broke on ANY nested parens before the true close.** `Array.from({ length: 256 }, (_, i) => ...)` — the naive capture grabbed the OUTER `Array.from(`'s span and stopped at the FIRST `)` it could find (the inner `(_, i)`'s), producing a garbled, unusable capture and silently dropping `_`/`i` as locals (`_` was the single highest-count false positive, 100 hits). Rewrote with proper depth-matched paren scanning (`findMatchingClose`), and rewrote arrow-param detection to anchor on `=>` and scan BACKWARD to the matching open paren instead of forward from an assumed `(`.
6. **The regex-vs-division heuristic was unanchored (pre-existing bug, not introduced by this row).** `/[=([{,;:!&|?+\-*%^~<>]|^$|return|typeof/.test(tail.slice(-6))` matches if any of those characters appears ANYWHERE in the last 6 characters, not just at the very end. `cy-barH/2` (plain division) has a `-` earlier in its 6-char tail (`y-barH`), so `/` was wrongly read as a regex opener — corrupting the hole-boundary scan and breaking the position-preserving invariant for the rest of the file. Found via a `blanked.length !== content.length` sweep across all 1,605 files (27 files hit). Fixed with a properly end-anchored `looksLikeRegexContext()` helper, used in both `blankRange` and the hole-boundary scanner.
7. **`IDENT_RE`'s trailing `\b` mishandled `$`.** `\b` is defined via `\w` (`[A-Za-z0-9_]`), which excludes `$` — so a trailing `\b` after `[\w$]*` forced the regex to backtrack off any trailing `$`, silently truncating `fmt$` (a real declared function) to `fmt`, producing a fake "call to undeclared `fmt`" across 10 files. Fixed with `(?<![\w$])...(?![\w$])` lookaround treating `$` consistently as an identifier character on both sides.
8. **`for (const x of iterable)` / `for (const x in obj)` loop variables silently dropped.** The declarator-list extractor only knew to stop a binding at `=`; `for...of`/`for...in` separates the binding with the word `of`/`in` instead, so the whole "x of iterable" text was treated as one unparseable pattern and the loop variable was never added as a local (`k`, `ti`, `f` in 3 chaingraph files). Fixed by truncating at a top-level `of`/`in` token when it precedes any `=`.
9. **No `import` binding support at all.** `chaingraph/kernel-vm.html`'s `<script type="module">` genuinely imports `runKernelInVM` — a real, correct declaration the scanner had no notion of whatsoever. Added named/default/namespace import-binding extraction.
10. **Class methods after the first were invisible.** `methodStartRe` only recognized `{`, `,`, `;` as valid "start of a new member" delimiters before a method name — but a `class Parser { peek(){...} next(){...} }` has NO separator between consecutive methods, just the previous method's closing `}`. Every method after the first in `tools/554-workbook-table-editor.html`'s `class Parser` (`peek`, `next`, `expect`, `parseExpr`, `parseComparison`, `parseConcat`, `parseAdd`, `parseMul`, `parseUnary`, `parsePow`, `parsePrimary`) was misread as a call to an undeclared function of the same name. Fixed by adding `}` to the allowed preceding-delimiter set.

Each fix was verified against all three positive controls (§2) before moving to the next, and the `blanked.length === content.length` invariant was swept across all 1,605 files after fix #6 and confirmed **zero mismatches** at the end.

---

## 4. Vendored/embedded third-party libraries — NOT individually adjudicated (same posture as the `<script src>` skip)

Three files inline complete third-party libraries with no `<script src>` (so the existing skip doesn't catch them), and account for the overwhelming majority of the remaining raw count:

| File | Library | Evidence |
|---|---|---|
| `tools/a2a-liquidity-simulator.html` (60 hits) | Chart.js | Identifiers are literal Chart.js internal API names: `getValueForPixel`, `getLabelForValue`, `getPixelForValue`, `buildTicks`, `determineDataLimits`, `parseObjectData`, `updateElements`, `getMaxOverflow` |
| `tools/clearcost-card-a2a-analyzer.html` (60 hits) | Chart.js | Same signature, byte-identical vendored copy (same 196,928-char single line) |
| `tools/kernel-vm-widget.html` (46 hits) | Emscripten/V8-inspector-derived WASM glue | 734,887-char single line; identifiers (`awaitYield`, `withScopeAsync`, `maybeIntrinsicName`, `backtraceBarrier`, `includeStrings`/`includeSymbols`/`includePrivate`) match V8 Runtime-inspector-protocol internals used by emscripten's debug/eval glue |
| `chaingraph/art-424-witness-cosignature-verifier.html` (5 hits) | `@noble/hashes` / `@noble/post-quantum` | Explicitly documented in-file: "MIT-licensed noble packages by Paul Miller ... `@noble/hashes v2.2.0 (sha3.js, _u64.js, utils.js) — Keccak/SHAKE`" — the 5 remaining identifiers (`posOut`, `finished`, `state32`, `destroyed`, `canXOF`) are internal Keccak-state variable/method names from that vendored source |

Adjudicating every one of these libraries' hundreds of internal identifiers individually is out of scope — it would be re-reviewing Chart.js/emscripten/noble-hashes upstream, not this site's authored code. This is the same "cannot see what globals get defined, so don't flag" posture as the `<script src>` skip already built into the tool, extended to the (rarer) case where the same category of code is inlined rather than referenced.

---

## 5. Genuine candidates — every one adjudicated, CONFIRMED or DENIED, with evidence

After the allowlist, the local/param-scope tracking, the ten scanner fixes, and the vendored-library exclusion, **8 distinct real findings remain**, all in authored page logic:

### CONFIRMED (5) — live-verified, page-breaking

| File | Identifier(s) | Evidence |
|---|---|---|
| `chaingraph/art-12-acp-checkout-conformance-validator.html` | `event` | `loadPreset(key)` reads the bare `event` global (relies on the deprecated, non-standard `window.event`, only set during a real DOM dispatch) — but is ALSO called directly at top level (`loadPreset('req_pass');`, line 1015) with no wrapping event. Live-verified: after load, **zero** `.tab-btn` elements have the `active` class (even though the first is `active` in static markup — a preceding line strips it from all buttons, then the crash prevents re-adding it) and `#payloadInput` is **empty** (the `JSON.stringify(data,...)` assignment inside `loadPreset` never runs). The page loads with no preset selected and a blank textarea. |
| `tools/rbe-09-credit-policy-decision-table.html` | `updateBands` | Called from a load-time IIFE (`(function init(){updateBands();})();`) and two `onchange` handlers. Live-verified: `typeof updateBands === 'undefined'`; the decision table renders **0 rows**. |
| `tools/rbe-11-dora-incident-classifier.html` | `scoreCriterion` | Called from 12 `oninput`/`onchange` handlers and directly at load (lines 1247, 1259). Live-verified: `typeof scoreCriterion === 'undefined'`. |
| `tools/rbe-12-scheme-compliance-simulator.html` | `getEntityType`, `getRegion`, `isPhase2Active`, `pct` | All four called repeatedly in the compliance-ratio logic and DOM-formatting code; none defined anywhere in the file. Live-verified: all four `typeof` `'undefined'`. |
| `tools/rbe-13-interchange-qualification-engine.html` | `updateCountryContext` | Called from a load-time IIFE and an `onchange` handler. Live-verified: `typeof updateCountryContext === 'undefined'`. |

### CONFIRMED (2) — structural, static evidence (live check blocked by tool access declined)

| File | Identifier | Evidence |
|---|---|---|
| `tools/pf-132-compound-interest-explorer.html` | `_ainStore` | `var _ainStore = {};` (line 306) sits **between two `<script>` blocks** — the preceding block closes at line 167 (`</script>`), the next opens at line 307 (`<script>`); line 306 is plain HTML body text, not JavaScript. `grep -n "<script\|</script>"` confirms: `164:<script>` → `167:</script>` → **306: the `var` line** → `307:<script>`. The `PSS` object at line 308 (inside the NEW block) reads/writes `_ainStore[this.SESSION_KEY]` — a reference to a name that was never actually declared as JS anywhere in the file, because the wrapping `<script>` tags around the declaration were evidently lost in an edit. |
| `tools/pf-140-dividend-drag-vs-growth-simulator.html` | `_ainStore` | Identical shape and mechanism to `pf-132` above (`var _ainStore = {};` at line 301, same `</script>`/`<script>` boundary pattern, same `PSS` object template) — clearly a copy-paste-propagated instance of the same defect. |

### CONFIRMED but LOW SEVERITY — dead code, not reachable in the shipped runtime

| File | Identifier | Evidence |
|---|---|---|
| `tools/277-x402-payload-decoder-flow-simulator.html` | `Buffer` | `b64decode()`/the `EX_HDR` IIFE both guard with `if (typeof atob === 'function') return ...; return Buffer.from(...)...` — the comment literally says "node fallback for tests." `atob`/`btoa` are universal in every real browser this site targets (CONTRACT: zero network, browser-only), so this branch is unreachable in production. `Buffer` is genuinely undeclared and would throw if the branch were ever reached (e.g. a future environment lacking `atob`), but the practical risk today is effectively nil — this is dead code written for a Node test harness, not a live hazard. |

**Total: 8 findings, 7 CONFIRMED-live-verified-or-structural, 1 CONFIRMED-but-dead-code.** Zero DENIED-as-ambiguous or UNDETERMINED remain — every candidate that survived the vendored-library exclusion was traced to a definite verdict.

---

## 6. What I could not determine, and why

- **Whether `_ainStore`'s missing `<script>` wrapper is a one-off editing accident or a wider pattern.** Only `pf-132` and `pf-140` were flagged by this scanner (both hit case b because the "declaration" is genuinely outside any script tag, not merely in a different block). A grep for `_ainStore` elsewhere in `tools/` might find more instances of the same copy-paste template with the SAME bug, or instances where the `<script>` wrapper is intact — not swept exhaustively; out of scope for this report-only row (no page edits).
- **Live verification of `pf-132`'s exact failure mode** — the browser tool declined to open that specific file after several prior navigations in this session (unclear why; other files navigated fine before and after). The static evidence (script-tag boundary grep) is conclusive on its own for the finding, but I could not additionally confirm via `typeof _ainStore` / DOM state the way I did for the other five CONFIRMED-live findings.
- **Whether the three vendored libraries contain any of THEIR OWN case-b hazards** (as opposed to this scanner's false positives on them) — not assessed; reviewing Chart.js/emscripten/noble-hashes upstream code for bugs is out of scope for a site-authored-code audit.
- **A2 (782 catch-writes-DOM candidates)** — unchanged from `SILENT-FAIL-AUDIT-1`'s original scope; not re-audited here (this row's scope was case b only).

---

## 7. Deliverables

- Extended scanner: `repo/scripts/scan-silent-fail.mjs` (case b + 10 bug fixes to shared helpers, all positive-controlled). Zero pages fixed, zero CI/preflight wiring (report-only per the row).
- This report: `research/SILENTSCAN-UNDECLARED-1-2026-07-27.md`.
- 8 real findings (5 live-verified CONFIRMED, 2 structural CONFIRMED, 1 CONFIRMED-dead-code) ready for a remediation row — not fixed here per the row's fence.
