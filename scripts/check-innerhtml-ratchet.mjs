#!/usr/bin/env node
// scripts/check-innerhtml-ratchet.mjs — interpolated-markup ratchet over tools/*.html.
//
// WHAT THIS GATE WATCHES. Every tool page builds DOM output as strings. When a
// page assigns interpolated markup into an HTML sink, an unescaped value is an
// injection risk with no CSP backstop (the estate's script-src allows
// 'unsafe-inline'), so the only line of defense is the escaping discipline at
// each site. That discipline had no gate: nothing failed when a NEW
// `${value}` landed inside an innerHTML assignment. This ratchet pins the
// sites that exist and fails when a NEW one appears. It never fails on a
// pre-existing site — the baseline shields those — and it names the safe
// construct (textContent, createElement) in every failure line.
//
// THE RULE (one precise rule, stated once; the implementation follows it):
//   A FINDING is a sink statement that either
//     (a) DIRECT — contains a template-literal `${expr}` hole that is
//         UNSAFE (the expr is not provably numeric and not a whole-expr call
//         to an escaper THIS PAGE defines and this gate has verified), or
//         sits in an ATTRIBUTE CONTEXT where escaping cannot make it safe,
//         or
//     (b) INDIRECT — has NO template hole but a non-literal payload (any
//         identifier, member access or call in the RHS / call arguments:
//         `el.innerHTML = html`, `document.write(parts.join(''))`,
//         `el.innerHTML = esc(v)` — the bucket records the flow; escaping is
//         only credited where the gate can see the hole it wraps).
//         String(), fmt() and .join() are NOT escaping — a payload that only
//         reaches the sink through them is still counted, in this bucket.
//   Pure-literal payloads (`el.innerHTML = ''`, `document.write('done')`)
//   are clean and never counted.
//
// SINKS (assignment properties and calls, in inline <script> only):
//   .innerHTML = / +=        .outerHTML = / +=        .srcdoc = / +=
//   insertAdjacentHTML(      document.write(          document.writeln(
//   setHTMLUnsafe(           parseFromString(         createContextualFragment(
//
// SAFE WRAPPERS (exhaustive list; nothing else is accepted inside a hole):
//   numeric literals            42, 3.5
//   Number(...)                 coerces to number or NaN
//   Math.<fn>(...)              any Math member call
//   <receiver>.toFixed(n)       returns a numeric string
//   a verified page escaper     see ESCAPER VERIFICATION
//   concatenation               a top-level `+` chain whose every operand is
//                               itself safe or a string literal
//
// ESCAPER VERIFICATION — do not trust names. A page-defined function counts as
// an escaper only if its body demonstrably covers ALL FOUR of & < > " (an
// escaper that skips " does not count: an interpolated value inside a quoted
// attribute can break out with a bare quote). Coverage is accepted from either
// shape, scoped to the function's body:
//   - a regex char class containing the char (e.g. /[&<>"']/g), or
//   - .replace( / .replaceAll( / .split( whose argument is exactly that
//     single char, as a regex (/&/) or string ('&') literal.
// Calls are matched whole: `${esc(v)}` is safe when esc is verified;
// `${esc(v).slice(1)}` is NOT (a safe call's result flows through more code
// before reaching the sink).
//
// ATTRIBUTE CONTEXT — escaping is not escaping in an attribute. A hole is
// context-flagged when the literal text immediately before it inside the SAME
// template literal ends with a dangerous attribute value opening:
//   on<name>=  style=  href=  src=  srcdoc=  action=  formaction=
// each with an OPTIONAL opening quote (the hole is the value), plus ANY
// attribute opening with NO quote at all (unquoted value starts at the hole).
// javascript: URLs pass through HTML escaping untouched — that is why these
// holes are flagged even when the interpolation is escaped.
//
// STATEMENT EXTRACTION — statement-level, never line-level. The statement
// starts at the recovered receiver expression (identifier / `.` / balanced
// (…) / […] chains walked backwards from the sink token) and runs forward to
// the terminating `;` at bracket depth zero relative to that start, across
// lines, with strings, template literals and comments treated as opaque (a
// `;` inside them terminates nothing). Multi-line template assignments are
// the common shape in this estate, not an edge case.
//
// BASELINE (scripts/innerhtml-ratchet-baseline.json) — keyed by FILE plus a
// 16-hex sha256 of the normalized statement (whitespace collapsed), so
// removing one site and adding another in the same file still fails: the
// added statement has a hash the baseline never pinned. Top-level `direct`
// and `indirect` totals are DERIVED (sums of the per-file lists) and are
// cross-checked on every run — a hand-edited baseline whose numbers no longer
// match its own lists is a hard failure, not a pass. Counts only go down:
//   --init / --update   writer. Lowers freely (sites removed). REFUSES any
//                       raise (a hash the old baseline did not pin) with exit
//                       2 — raising the ceiling requires --allow-raise plus a
//                       separately reviewed approval, never a side effect of
//                       a content PR.
//   --advisory          same scan and report, exit 0 even with NEW sites.
//                       Baseline integrity failures still exit 1: a missing
//                       or corrupt baseline is a broken control, not a
//                       finding.
//   --changed <REF>     scope the scan to files touched vs REF (shared
//                       _changed-files-lib.js; an undeterminable diff falls
//                       back to a full scan, safe by cost).
//   --root <DIR>        scan DIR instead of this checkout (fixture route).
//
// ADVISORY FIRST CYCLE. preflight.mjs wires this gate with --advisory for its
// first cycle: the report is printed, nothing fails, and the estate's NEW-site
// rate is read before the ratchet bites. The flip is a one-flag change in the
// preflight entry; the self-test pair proves the blocking mode CAN fail from
// day one, so the flip is a policy change, not new machinery.
//
// Self-test: scripts/check-innerhtml-ratchet.selftest.mjs (RED/GREEN fixtures,
// subprocess exit codes). Pure Node, no network, no dependencies.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRatchetBaseline, readBaselineForUpdate } from './ratchet-baseline.mjs';
import { resolveChangedScope, isTouched } from './_changed-files-lib.js';

// ── CLI ───────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const argOf = (name) => {
  const i = argv.indexOf(name);
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : null;
};

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = argOf('--root') ? resolve(argOf('--root')) : resolve(HERE, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'innerhtml-ratchet-baseline.json');
const ADVISORY = flag('--advisory');
const WRITER = flag('--init') || flag('--update');
const ALLOW_RAISE = flag('--allow-raise');
const CHANGED_REF = argOf('--changed');
if (WRITER && CHANGED_REF) {
  console.error('check-innerhtml-ratchet: --init/--update cannot be combined with --changed (the writer always measures the full tree).');
  process.exit(2);
}
if (argOf('--root') && CHANGED_REF) {
  console.error('check-innerhtml-ratchet: --root (fixture tree) cannot be combined with --changed (not a git checkout).');
  process.exit(2);
}

// ── Sink and context patterns ────────────────────────────────────────────────
const ASSIGN_SINK_RE = /\.(innerHTML|outerHTML|srcdoc)\s*(\+=|=)(?!=)/g;
const CALL_SINK_RE = /\b(insertAdjacentHTML|setHTMLUnsafe|parseFromString|createContextualFragment|write(?:ln)?)\s*\(/g;
// Dangerous attribute value openings: the literal text before the hole ends
// with `on<name>=`, `style=`, `href=`, ... with an OPTIONAL opening quote, or
// any attribute name `=` with NO quote at all (unquoted value = the hole).
const DANGEROUS_ATTR_RE = /(?:\bon[a-zA-Z][\w-]*|style|href|src|srcdoc|action|formaction)\s*=\s*(["'])?$/;
const UNQUOTED_ATTR_RE = /[\w-]\s*=\s*$/;
// Identifiers that are literals-in-spirit, not values flowing to the sink.
const NON_VALUE_KEYWORDS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'this']);
const STMT_CAP = 16000;   // statement-search cap (chars of source span)
const HASH_LEN = 16;

// ── Lexer ─────────────────────────────────────────────────────────────────────
// Emits TOP-LEVEL segments {type:'code'|'str'|'re'|'lc'|'bc'|'tpl', start, end,
// text, ...}. Template segments additionally carry holes (with each hole's
// expr and the cooked text preceding it) and the full cooked literal. The
// interior of a ${...} hole is lexed for BALANCE only and never emits a
// segment — it stays inside its opaque template segment, so a `;`, brace or
// bracket inside an interpolation can never terminate or redepth the
// enclosing statement. Nesting works both ways: templates inside holes
// (their holes are analysed against their own cooked context) and holes
// inside those templates.
const REGEX_PRECEDERS = new Set([
  '', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^', '<', '>',
  'return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'instanceof', 'do', 'else', 'throw',
]);

export function lexJs(src) {
  const segs = [];
  // current accumulating segment at top level
  let segStart = -1;
  let segType = 'code';
  const flushSeg = (end) => {
    if (segStart !== -1 && end > segStart) {
      segs.push({ type: segType, start: segStart, end, text: src.slice(segStart, end) });
    }
    segStart = -1;
  };
  const openCode = (at) => { if (segStart === -1) { segStart = at; segType = 'code'; } };
  // enter a special segment at top level (flush code first)
  const openSpecial = (at, type) => { flushSeg(at); segStart = at; segType = type; };
  // leave a special segment: push it (top level) or drop it (inside a hole)
  let specialStart = -1;
  let specialType = null;
  let specialEmit = false;

  let mode = 'top';            // 'top' | 'hole' | 'tplLit' | 'sq' | 'dq' | 'lc' | 'bc'
  const stack = [];            // {kind:'tpl', frame, returnMode} | {kind:'hole', frame, depth, exprStart, cookedLen}
  let braceDepth = 0;
  let lastTok = '';            // last significant code token: a word, or one punct char
  let i = 0;
  const n = src.length;

  const noteTok = (c) => {
    if (/\s/.test(c)) return;
    if (/[\w$]/.test(c)) lastTok = /[\w$]/.test(lastTok) ? lastTok + c : c;
    else lastTok = c;
  };

  while (i < n) {
    const c = src[i];

    if (mode === 'top' || mode === 'hole') {
      const emit = mode === 'top';
      if (c === '/' && src[i + 1] === '/') {
        if (emit) openSpecial(i, 'lc'); else specialStart = i;
        mode = 'lc'; i += 2; continue;
      }
      if (c === '/' && src[i + 1] === '*') {
        if (emit) openSpecial(i, 'bc'); else specialStart = i;
        mode = 'bc'; i += 2; continue;
      }
      if (c === "'" || c === '"') {
        specialStart = i;
        specialEmit = emit;
        if (emit) openSpecial(i, 'str');
        mode = c === "'" ? 'sq' : 'dq'; i++; continue;
      }
      if (c === '`') {
        const frame = { cooked: '', holes: [], returnMode: mode };
        stack.push({ kind: 'tpl', frame });
        if (emit) openSpecial(i, 'tpl');
        mode = 'tplLit'; i++; continue;
      }
      if (c === '/' && REGEX_PRECEDERS.has(lastTok)) {
        // Try a regex literal; if it never closes before a newline this slash
        // is division — fall through as a plain code char and rescan after it.
        let j = i + 1, inClass = false, closed = false;
        while (j < n) {
          const r = src[j];
          if (r === '\\') { j += 2; continue; }
          if (r === '\n') break;
          if (inClass) { if (r === ']') inClass = false; j++; continue; }
          if (r === '[') { inClass = true; j++; continue; }
          if (r === '/') { closed = true; j++; break; }
          j++;
        }
        if (closed) {
          while (j < n && /[a-z]/.test(src[j])) j++;
          if (emit) { flushSeg(i); segs.push({ type: 're', start: i, end: j, text: src.slice(i, j) }); openCode(j); }
          lastTok = '/';
          i = j; continue;
        }
        // division: fall through
      }
      if (c === '{') {
        braceDepth++;
        noteTok(c); if (emit) openCode(i);
        i++; continue;
      }
      if (c === '}') {
        const top = stack[stack.length - 1];
        if (top && top.kind === 'hole' && top.depth === braceDepth) {
          top.frame.holes.push({
            exprStart: top.exprStart,
            exprEnd: i,
            expr: src.slice(top.exprStart, i),
            cookedBefore: top.frame.cooked.slice(0, top.cookedLen),
          });
          stack.pop();
          mode = 'tplLit';
          i++; continue;
        }
        braceDepth--;
        noteTok(c); if (emit) openCode(i);
        i++; continue;
      }
      noteTok(c);
      if (emit) openCode(i);
      i++; continue;
    }

    if (mode === 'tplLit') {
      const entry = stack[stack.length - 1];
      const frame = entry.frame;
      if (c === '\\') { frame.cooked += src.slice(i, i + 2); i += 2; continue; }
      if (c === '`') {
        if (frame.returnMode === 'top') {
          // this segment is the whole template, holes included
          segs.push({
            type: 'tpl', start: segStart, end: i + 1, text: src.slice(segStart, i + 1),
            holes: frame.holes, cooked: frame.cooked,
          });
          segStart = -1;
          openCode(i + 1);
        }
        stack.pop();
        mode = frame.returnMode;
        lastTok = '`';
        i++; continue;
      }
      if (c === '$' && src[i + 1] === '{') {
        stack.push({ kind: 'hole', frame, depth: braceDepth, exprStart: i + 2, cookedLen: frame.cooked.length });
        mode = 'hole';
        i += 2; continue;
      }
      frame.cooked += c;
      i++; continue;
    }

    if (mode === 'sq' || mode === 'dq') {
      const q = mode === 'sq' ? "'" : '"';
      if (c === '\\') { i += 2; continue; }
      if (c === q || c === '\n') {
        // closing quote (a lenient stop at a newline keeps the lexer in sync;
        // unterminated strings are the syntax gate's failure, not ours)
        if (specialEmit) { flushSeg(i + 1); openCode(i + 1); }
        mode = stack[stack.length - 1] && stack[stack.length - 1].kind === 'hole' ? 'hole' : 'top';
        lastTok = q;
        i++; continue;
      }
      i++; continue;
    }

    if (mode === 'lc') {
      if (c === '\n') {
        if (segStart !== -1 && segType === 'lc') { flushSeg(i); openCode(i); }
        mode = stack[stack.length - 1] && stack[stack.length - 1].kind === 'hole' ? 'hole' : 'top';
      }
      i++; continue;
    }

    if (mode === 'bc') {
      if (c === '*' && src[i + 1] === '/') {
        if (segStart !== -1 && segType === 'bc') { flushSeg(i + 2); openCode(i + 2); }
        mode = stack[stack.length - 1] && stack[stack.length - 1].kind === 'hole' ? 'hole' : 'top';
        i += 2; continue;
      }
      i++; continue;
    }

    i++; // unreachable safety
  }
  flushSeg(n);
  return segs;
}

// ── Script-block extraction from a page ──────────────────────────────────────
export function extractScriptBlocks(html) {
  const blocks = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/.test(attrs)) continue;
    if (/\btype\s*=/i.test(attrs) && !/javascript|module/i.test(attrs)) continue;
    blocks.push({ start: m.index + m[0].indexOf(m[2]), len: m[2].length });
  }
  return blocks;
}

// ── Small segment utilities (offsets are absolute in the lexed source) ───────
function segAt(segs, pos) {
  for (const s of segs) if (pos >= s.start && pos < s.end) return s;
  return null;
}
function segCharAt(segs, pos) {
  const s = segAt(segs, pos);
  return s ? s.text[pos - s.start] : '';
}
function endOf(segs) {
  return segs.length ? segs[segs.length - 1].end : 0;
}
// Matching bracket for the one at openIdx (any direction-independent walk
// forward); non-code segments are opaque. -1 when unbalanced.
function matchForward(segs, openIdx) {
  const open = segCharAt(segs, openIdx);
  const closeOf = { '(': ')', '[': ']', '{': '}' }[open];
  if (!closeOf) return -1;
  let depth = 0;
  for (let pos = openIdx; pos < endOf(segs); pos++) {
    const seg = segAt(segs, pos);
    if (!seg) break;
    if (seg.type !== 'code') { pos = seg.end - 1; continue; }
    const ch = seg.text[pos - seg.start];
    if (ch === open) depth++;
    else if (ch === closeOf) { depth--; if (depth === 0) return pos; }
  }
  return -1;
}
// Next non-space code char from `from`; its position when it equals `want`, -1
// on the first non-space char that is not `want`, -1 at end.
function nextNonSpaceChar(segs, from, want) {
  for (let pos = from; pos < endOf(segs); pos++) {
    const seg = segAt(segs, pos);
    if (!seg) break;
    if (seg.type !== 'code') { pos = seg.end - 1; continue; }
    const ch = seg.text[pos - seg.start];
    if (/\s/.test(ch)) continue;
    return ch === want ? pos : -1;
  }
  return -1;
}
function textAt(segs, from, len) {
  let out = '';
  for (let pos = from; out.length < len && pos < endOf(segs); pos++) {
    const seg = segAt(segs, pos);
    if (!seg) break;
    if (seg.type !== 'code') { pos = seg.end - 1; continue; }
    out += seg.text[pos - seg.start];
  }
  return out;
}
// First `=>` from `from`, stopping at a `;` or newline first.
function findArrow(segs, from) {
  for (let pos = from; pos < endOf(segs); pos++) {
    const seg = segAt(segs, pos);
    if (!seg) break;
    if (seg.type !== 'code') { pos = seg.end - 1; continue; }
    const rel = pos - seg.start;
    if (seg.text[rel] === '=' && seg.text[rel + 1] === '>') return pos;
    if (seg.text[rel] === ';' || seg.text[rel] === '\n') return -1;
  }
  return -1;
}

// Statement end: the first `;` in CODE at bracket depth zero counted from
// `from` (the receiver start), non-code segments opaque. Capped at STMT_CAP
// chars of span; on cap or end-of-input the cap/end is returned (the analysis
// still runs — an unterminated tail is the syntax gate's problem).
function findStatementEnd(segs, from, cap) {
  const limit = Math.min(from + cap, endOf(segs));
  let depth = 0;
  for (let pos = from; pos < limit; pos++) {
    const seg = segAt(segs, pos);
    if (!seg) break;
    if (seg.type !== 'code') { pos = seg.end - 1; continue; }
    const rel = pos - seg.start;
    for (let k = rel; k < seg.text.length && pos + (k - rel) < limit; k++) {
      const ch = seg.text[k];
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      else if (ch === ';' && depth === 0) return { end: pos + (k - rel) + 1, capped: false };
    }
    pos = seg.end - 1;
  }
  return { end: limit, capped: true };
}

// Receiver start: walk BACKWARDS from `sinkStart` over identifiers, `.`,
// optional chains and balanced bracket pairs (their interiors, including
// string/template segments, are swallowed whole). Stops at anything else.
function findReceiverStart(segs, sinkStart, cap) {
  const floor = Math.max(0, sinkStart - cap);
  let pos = sinkStart;
  for (let guard = 0; guard < 100 && pos > floor; guard++) {
    // skip whitespace backwards (code segments only)
    for (;;) {
      const seg = segAt(segs, pos - 1);
      if (seg && seg.type === 'code' && /\s/.test(seg.text[pos - 1 - seg.start])) pos--;
      else break;
    }
    if (pos <= floor) break;
    const seg = segAt(segs, pos - 1);
    if (!seg) break;
    if (seg.type === 'code') {
      const ch = seg.text[pos - 1 - seg.start];
      if (/[\w$]/.test(ch)) {
        while (pos > floor) {
          const s2 = segAt(segs, pos - 1);
          if (s2 === seg && /[\w$]/.test(seg.text[pos - 1 - seg.start])) pos--;
          else break;
        }
      } else if (ch === '.') {
        pos--;
      } else if (ch === ')' || ch === ']' || ch === '}') {
        let depth = 0;
        let p = pos;
        let ok = false;
        for (let g2 = 0; p > floor && g2 < 4000; p--) {
          const s2 = segAt(segs, p - 1);
          if (!s2) break;
          if (s2.type === 'code') {
            const c2 = s2.text[p - 1 - s2.start];
            if (c2 === ')' || c2 === ']' || c2 === '}') depth++;
            else if (c2 === '(' || c2 === '[' || c2 === '{') {
              depth--;
              if (depth === 0) { p--; ok = true; break; }
            }
          }
        }
        if (!ok) break;
        pos = p;
      } else break;
    } else {
      // string/template/regex directly before the sink token: part of the
      // receiver's argument list interior only if it ENDS exactly here
      if (seg.end === pos) pos = seg.start;
      else break;
    }
    // whatever we consumed must itself follow a receiver-ish char, else stop
    if (pos > floor) {
      const s3 = segAt(segs, pos - 1);
      if (!s3 || s3.type !== 'code') break;
      if (!/[\w$.)\]}]/.test(s3.text[pos - 1 - s3.start])) break;
    }
  }
  return pos;
}

// ── Escaper verification ──────────────────────────────────────────────────────
// Coverage of & < > " inside a body span, from the segments that intersect it:
// regex char classes, and .replace/.replaceAll/.split calls whose argument is
// exactly that single char (as /x/ or 'x').
function bodyCoverage(bodySegs) {
  const covered = new Set();
  const CHARS = ['&', '<', '>', '"'];
  for (const seg of bodySegs) {
    if (seg.type === 're') {
      const cls = seg.text.match(/\[(.*?)\]/);
      if (cls) for (const ch of cls[1]) if (CHARS.includes(ch)) covered.add(ch);
      const bare = seg.text.replace(/^\/\^?/, '').split('/')[0];
      if (CHARS.includes(bare)) covered.add(bare);
    }
  }
  for (let s = 0; s < bodySegs.length; s++) {
    const seg = bodySegs[s];
    if (seg.type !== 'code') continue;
    const callRe = /\.(?:replace|replaceAll|split)\s*\(\s*/g;
    let m;
    while ((m = callRe.exec(seg.text))) {
      const argOff = seg.start + m.index + m[0].length;
      for (let t = s + 1; t < bodySegs.length; t++) {
        const nxt = bodySegs[t];
        if (nxt.end <= argOff) continue;
        if (nxt.start > argOff + 4) break;
        if (nxt.type === 'str' && CHARS.includes(nxt.text.slice(1, -1))) covered.add(nxt.text.slice(1, -1));
        if (nxt.type === 're') {
          const bare = nxt.text.replace(/^\/\^?/, '').split('/')[0];
          if (CHARS.includes(bare)) covered.add(bare);
        }
        break;
      }
    }
  }
  return covered;
}

// Verified-escaper table for one page: name -> true/false. Candidates are
// function declarations and const/let/var function-or-arrow assignments.
// A name seen twice is verified if ANY of its bodies covers all four chars.
export function findEscapers(segs) {
  const verdicts = new Map();
  const cand = [];
  for (const seg of segs) {
    if (seg.type !== 'code') continue;
    let m;
    const fd = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
    while ((m = fd.exec(seg.text))) {
      const openParen = seg.start + m.index + m[0].length - 1;
      const close = matchForward(segs, openParen);
      if (close === -1) continue;
      const braceAt = nextNonSpaceChar(segs, close + 1, '{');
      if (braceAt === -1) continue;
      const bodyEnd = matchForward(segs, braceAt);
      if (bodyEnd === -1) continue;
      cand.push([m[1], braceAt + 1, bodyEnd]);
    }
    const ca = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?/g;
    while ((m = ca.exec(seg.text))) {
      const afterEq = seg.start + m.index + m[0].length;
      if (/^function\b/.test(textAt(segs, afterEq, 8))) {
        const openParen = afterEq + 'function'.length;
        // allow a name between `function` and `(`
        let p = openParen;
        while (p < endOf(segs) && /[\w$\s]/.test(segCharAt(segs, p)) && segCharAt(segs, p) !== '(') p++;
        const parenAt = nextNonSpaceChar(segs, p - 1 >= afterEq ? p : afterEq, '(') === -1
          ? indexOfCodeChar(segs, afterEq, '(')
          : nextNonSpaceChar(segs, p - 1 >= afterEq ? p : afterEq, '(');
        if (parenAt === -1) continue;
        const close = matchForward(segs, parenAt);
        if (close === -1) continue;
        const braceAt = nextNonSpaceChar(segs, close + 1, '{');
        if (braceAt === -1) continue;
        const bodyEnd = matchForward(segs, braceAt);
        if (bodyEnd === -1) continue;
        cand.push([m[1], braceAt + 1, bodyEnd]);
        continue;
      }
      const arrowAt = findArrow(segs, afterEq);
      if (arrowAt === -1) continue;
      const bodyOpen = nextNonSpaceChar(segs, arrowAt + 2, '{');
      if (bodyOpen !== -1) {
        const bodyEnd = matchForward(segs, bodyOpen);
        if (bodyEnd !== -1) cand.push([m[1], bodyOpen + 1, bodyEnd]);
      } else {
        const { end } = findStatementEnd(segs, afterEq, 2000);
        cand.push([m[1], arrowAt + 2, Math.max(arrowAt + 2, end - 1)]);
      }
    }
  }
  for (const [name, b0, b1] of cand) {
    const bodySegs = [];
    for (const seg of segs) {
      if (seg.end <= b0 || seg.start >= b1) continue;
      const s0 = Math.max(seg.start, b0);
      const s1 = Math.min(seg.end, b1);
      bodySegs.push({ ...seg, start: s0, end: s1, text: seg.text.slice(s0 - seg.start, s1 - seg.start) });
    }
    const covered = bodyCoverage(bodySegs);
    const verified = ['&', '<', '>', '"'].every((c) => covered.has(c));
    if (!verdicts.has(name) || verified) verdicts.set(name, verified);
  }
  return verdicts;
}
function indexOfCodeChar(segs, from, want) {
  for (let pos = from; pos < endOf(segs); pos++) {
    const seg = segAt(segs, pos);
    if (!seg) break;
    if (seg.type !== 'code') { pos = seg.end - 1; continue; }
    if (seg.text[pos - seg.start] === want) return pos;
  }
  return -1;
}

// ── Hole-safety analysis ──────────────────────────────────────────────────────
function splitTopLevel(expr, sep) {
  const parts = [];
  let depth = 0, cur = '', q = null;
  for (let k = 0; k < expr.length; k++) {
    const ch = expr[k];
    if (q) { cur += ch; if (ch === q && expr[k - 1] !== '\\') q = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { q = ch; cur += ch; continue; }
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === sep && depth === 0) {
      if (expr[k + 1] === sep || expr[k + 1] === '=') return null; // ++ / += : not a concat list
      parts.push(cur); cur = ''; continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

function isStringLiteral(s) {
  const t = s.trim();
  return (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
    || (t.startsWith('"') && t.endsWith('"') && t.length >= 2);
}

function isWholeCall(expr) {
  const t = expr.trim();
  if (!t.endsWith(')')) return false;
  let depth = 0, q = null;
  for (let k = 0; k < t.length; k++) {
    const ch = t[k];
    if (q) { if (ch === q && t[k - 1] !== '\\') q = null; continue; }
    if (ch === "'" || ch === '"') { q = ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') { depth--; if (depth === 0 && k !== t.length - 1) return false; }
  }
  return depth === 0;
}

function wrapsWhole(expr) {
  if (!expr.startsWith('(') || !expr.endsWith(')')) return false;
  let depth = 0, q = null;
  for (let k = 0; k < expr.length; k++) {
    const ch = expr[k];
    if (q) { if (ch === q && expr[k - 1] !== '\\') q = null; continue; }
    if (ch === "'" || ch === '"') { q = ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') { depth--; if (depth === 0 && k !== expr.length - 1) return false; }
  }
  return depth === 0;
}

export function isSafeHoleExpr(exprIn, verifiedEscapers) {
  let expr = exprIn.trim();
  while (wrapsWhole(expr)) expr = expr.slice(1, -1).trim();
  if (!expr) return false;
  if (/^[+-]?\d+(?:\.\d+)?$/.test(expr)) return true;                          // 42 / 3.5
  if (/^Number\s*\(/.test(expr) && isWholeCall(expr)) return true;              // Number(...)
  if (/^Math\s*\.[\w$]+\s*\(/.test(expr) && isWholeCall(expr)) return true;     // Math.round(x)
  if (/^[\w$]+(?:\.[\w$]+)*(?:\([^()]*\))?\.toFixed\s*\([^()]*\)$/.test(expr)) return true; // x.toFixed(2)
  const esc = expr.match(/^(?:[\w$]+\.)*([A-Za-z_$][\w$]*)\s*\(/);
  if (esc && isWholeCall(expr) && verifiedEscapers.get(esc[1]) === true) return true; // esc(v) / obj.esc(v)
  const parts = splitTopLevel(expr, '+');
  if (parts && parts.length > 1
    && parts.every((p) => p.trim() && (isStringLiteral(p) || isSafeHoleExpr(p, verifiedEscapers)))) {
    return true;                                                                // 'a' + esc(x) + `${n}`-safe operands
  }
  return false;
}

function contextFlagged(cookedBefore) {
  return DANGEROUS_ATTR_RE.test(cookedBefore || '') || UNQUOTED_ATTR_RE.test(cookedBefore || '');
}

// ── Page scan ────────────────────────────────────────────────────────────────
// Offsets: the page's script blocks are lexed as ONE source (concatenated),
// so segment offsets live in that space; blockOffsets maps them back to the
// page for line numbers.
export function scanPage(relPath, html) {
  const findings = [];
  const blocks = extractScriptBlocks(html);
  const blockOffsets = blocks.map((b) => ({ start: b.start, len: b.len }));
  let allCode = '';
  for (const b of blocks) allCode += html.slice(b.start, b.start + b.len);
  const segs = lexJs(allCode);

  const verifiedEscapers = findEscapers(segs);

  const offsetInHtml = (off) => {
    let acc = 0;
    for (const b of blockOffsets) {
      if (off < acc + b.len) return b.start + (off - acc);
      acc += b.len;
    }
    return html.length;
  };
  // line-start table for cheap line numbers
  const lineStarts = [0];
  for (let k = 0; k < html.length; k++) if (html[k] === '\n') lineStarts.push(k + 1);
  const lineOf = (htmlOff) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= htmlOff) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  const statements = [];
  for (const seg of segs) {
    if (seg.type !== 'code') continue;
    let m;
    ASSIGN_SINK_RE.lastIndex = 0;
    while ((m = ASSIGN_SINK_RE.exec(seg.text))) {
      statements.push({ kind: 'assign', sinkStart: seg.start + m.index, matchEnd: seg.start + m.index + m[0].length });
    }
    CALL_SINK_RE.lastIndex = 0;
    while ((m = CALL_SINK_RE.exec(seg.text))) {
      statements.push({ kind: 'call', sinkStart: seg.start + m.index, matchEnd: seg.start + m.index + m[0].length });
    }
  }

  for (const st of statements) {
    const recvStart = findReceiverStart(segs, st.sinkStart, 400);
    const { end } = findStatementEnd(segs, recvStart, STMT_CAP);
    const stmtStart = recvStart;
    const normalized = allCode.slice(stmtStart, end).replace(/\s+/g, ' ').trim();
    const hash = createHash('sha256')
      .update(relPath.replace(/\\/g, '/') + '\u0000' + normalized)
      .digest('hex').slice(0, HASH_LEN);

    // payload region: assignments -> after the `=`; calls -> inside the parens
    let region0, region1;
    if (st.kind === 'assign') {
      region0 = st.matchEnd;
      region1 = end;
    } else {
      const openParen = st.matchEnd - 1; // CALL_SINK_RE ends immediately after `(`
      const close = matchForward(segs, openParen);
      region0 = openParen + 1;
      region1 = close === -1 ? end : close;
    }

    const reasons = [];
    let sawHole = false;
    for (const seg of segs) {
      if (seg.type !== 'tpl' || seg.end <= region0 || seg.start >= region1) continue;
      for (const h of seg.holes || []) {
        if (h.exprStart < region0 || h.exprEnd > region1) continue;
        sawHole = true;
        const safe = isSafeHoleExpr(h.expr, verifiedEscapers);
        const ctx = contextFlagged(h.cookedBefore);
        if (ctx) {
          reasons.push(`attribute-context hole \${${h.expr.trim().slice(0, 40)}} — escaping cannot make an on*/style/URL/unquoted attribute value safe`);
        } else if (!safe) {
          const known = verifiedEscapers.has(h.expr.trim().split('(')[0].split('.').pop());
          reasons.push(known
            ? `interpolation via ${h.expr.trim().split('(')[0]} — that name is defined on this page but NOT verified to escape & < > "`
            : `unescaped interpolation \${${h.expr.trim().slice(0, 40)}}`);
        }
      }
    }
    let bucket = null;
    if (reasons.length) bucket = 'direct';
    else if (!sawHole && regionIsNonLiteral(segs, region0, region1)) bucket = 'indirect';

    if (bucket) {
      findings.push({
        bucket,
        hash,
        line: lineOf(offsetInHtml(stmtStart)),
        snippet: normalized.slice(0, 110),
        reasons: [...new Set(reasons)].slice(0, 3),
      });
    }
  }
  return findings;
}

function regionIsNonLiteral(segs, r0, r1) {
  for (const seg of segs) {
    if (seg.end <= r0 || seg.start >= r1 || seg.type !== 'code') continue;
    const text = seg.text.slice(Math.max(0, r0 - seg.start), Math.min(seg.text.length, r1 - seg.start));
    const ids = text.match(/[A-Za-z_$][\w$]*/g) || [];
    for (const id of ids) if (!NON_VALUE_KEYWORDS.has(id)) return true;
  }
  return false;
}

// ── Baseline shape ────────────────────────────────────────────────────────────
const BASELINE_REQUIRED_KEYS = ['direct', 'indirect'];
const BASELINE_NOTE =
  'Pinned site hashes for the interpolated-markup ratchet (scripts/check-innerhtml-ratchet.mjs). ' +
  'direct = statements with an unsafe or attribute-context template hole; indirect = non-literal payloads with no hole. ' +
  'Totals are DERIVED from files{} and cross-checked every run. Counts only go down: --update lowers freely and refuses any raise.';

function failBaseline(msg) {
  console.error(`check-innerhtml-ratchet: ${msg}`);
  process.exit(1);
}

function validateBaselineShape(baseline) {
  if (!baseline.files || typeof baseline.files !== 'object' || Array.isArray(baseline.files)) {
    failBaseline('baseline has no files{} object — a baseline without per-file lists is a switched-off ratchet, not a clean one.');
  }
  let direct = 0, indirect = 0;
  for (const [file, entry] of Object.entries(baseline.files)) {
    const okShape = entry && typeof entry === 'object' && !Array.isArray(entry)
      && Array.isArray(entry.direct) && Array.isArray(entry.indirect)
      && entry.direct.every((h) => typeof h === 'string' && /^[0-9a-f]{16}$/.test(h))
      && entry.indirect.every((h) => typeof h === 'string' && /^[0-9a-f]{16}$/.test(h));
    if (!okShape) {
      failBaseline(`baseline entry for ${file} is malformed (expected {direct:[16-hex], indirect:[16-hex]}).`);
    }
    direct += entry.direct.length;
    indirect += entry.indirect.length;
  }
  if (direct !== baseline.direct || indirect !== baseline.indirect) {
    failBaseline(
      `baseline totals do not match its own lists (direct ${baseline.direct} vs ${direct}, indirect ${baseline.indirect} vs ${indirect}). ` +
      'The totals are derived, never authoritative — a hand-edited ceiling is exactly the tamper this check exists to catch.');
  }
  return { direct, indirect };
}

// ── Tree scan ─────────────────────────────────────────────────────────────────
function scanTree(changed) {
  const dir = join(ROOT, 'tools');
  const perFile = {};
  if (!existsSync(dir)) return { perFile, scanned: 0 };
  const files = readdirSync(dir).filter((f) => f.endsWith('.html')).sort();
  let scanned = 0;
  for (const f of files) {
    const rel = `tools/${f}`;
    if (changed && !isTouched(rel, changed)) continue;
    scanned++;
    const findings = scanPage(rel, readFileSync(join(dir, f), 'utf8'));
    if (findings.length) perFile[rel] = findings;
  }
  return { perFile, scanned };
}

function currentCounts(perFile) {
  let direct = 0, indirect = 0;
  const filesMap = {};
  for (const rel of Object.keys(perFile).sort()) {
    const findings = perFile[rel];
    const d = [...new Set(findings.filter((x) => x.bucket === 'direct').map((x) => x.hash))].sort();
    const n = [...new Set(findings.filter((x) => x.bucket === 'indirect').map((x) => x.hash))].sort();
    if (d.length || n.length) filesMap[rel] = { direct: d, indirect: n };
    direct += d.length;
    indirect += n.length;
  }
  return { direct, indirect, files: filesMap };
}

// ── Main ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}

function main() {
  const changed = CHANGED_REF
    ? resolveChangedScope(CHANGED_REF, { gate: 'check-innerhtml-ratchet.mjs', failClosed: false })
    : null;

  if (WRITER) {
    const existing = readBaselineForUpdate(BASELINE_PATH, BASELINE_REQUIRED_KEYS, {
      label: 'interpolated-markup ratchet baseline',
      repinCommand: 'node scripts/check-innerhtml-ratchet.mjs --update',
    });
    if (existing) validateBaselineShape(existing);
    const { perFile } = scanTree(null);
    const cur = currentCounts(perFile);
    if (existing) {
      const raises = [];
      for (const [rel, entry] of Object.entries(cur.files)) {
        const old = existing.files[rel] || { direct: [], indirect: [] };
        for (const h of entry.direct) if (!old.direct.includes(h)) raises.push(`${rel} [direct] ${h}`);
        for (const h of entry.indirect) if (!old.indirect.includes(h)) raises.push(`${rel} [indirect] ${h}`);
      }
      if (raises.length && !ALLOW_RAISE) {
        console.error(`check-innerhtml-ratchet: --update REFUSES to raise — ${raises.length} site(s) not pinned by the current baseline:`);
        for (const r of raises.slice(0, 20)) console.error(`  + ${r}`);
        if (raises.length > 20) console.error(`  ... and ${raises.length - 20} more`);
        console.error('Counts only go down. Raising the ceiling needs --allow-raise AND a separately reviewed approval — never a side effect of a content PR.');
        process.exit(2);
      }
      if (raises.length && ALLOW_RAISE) {
        console.warn(`check-innerhtml-ratchet: --allow-raise present — pinning ${raises.length} NEW site(s). The PR that carries this baseline change must name its own review.`);
      }
    }
    writeFileSync(BASELINE_PATH, JSON.stringify({
      generated: new Date().toISOString().slice(0, 10),
      note: BASELINE_NOTE,
      direct: cur.direct,
      indirect: cur.indirect,
      files: cur.files,
    }, null, 2) + '\n');
    console.log(`check-innerhtml-ratchet: baseline written — ${cur.direct} direct + ${cur.indirect} indirect site(s) across ${Object.keys(cur.files).length} file(s).`);
    process.exit(0);
  }

  // check mode: the baseline is a CONTROL — absent or corrupt is a hard fail in
  // advisory mode too (a missing ceiling is not "zero findings").
  let baseline;
  try {
    baseline = loadRatchetBaseline(BASELINE_PATH, BASELINE_REQUIRED_KEYS, {
      label: 'interpolated-markup ratchet baseline',
      repinCommand: 'node scripts/check-innerhtml-ratchet.mjs --update',
    });
  } catch (e) {
    console.error(e.message || String(e));
    process.exit(1);
  }
  validateBaselineShape(baseline);

  const { perFile, scanned } = scanTree(changed);

  const news = [];
  const seenNews = new Set();
  let removed = 0;
  for (const [rel, findings] of Object.entries(perFile)) {
    const base = baseline.files[rel] || { direct: [], indirect: [] };
    for (const f of findings) {
      if (base[f.bucket].includes(f.hash)) continue;
      const key = `${rel}:${f.bucket}:${f.hash}`;
      if (seenNews.has(key)) continue;
      seenNews.add(key);
      news.push({ rel, ...f });
    }
  }
  for (const [rel, entry] of Object.entries(baseline.files)) {
    if (changed && !isTouched(rel, changed)) continue;
    const curHashes = new Set((perFile[rel] || []).map((x) => `${x.bucket}:${x.hash}`));
    for (const h of entry.direct) if (!curHashes.has(`direct:${h}`)) removed++;
    for (const h of entry.indirect) if (!curHashes.has(`indirect:${h}`)) removed++;
  }

  const scopeNote = changed ? ` — touched-scope: ${scanned} file(s) scanned` : '';
  if (news.length) {
    const head = ADVISORY
      ? `check-innerhtml-ratchet: ADVISORY (first cycle) — ${news.length} NEW interpolated-markup site(s); exit 0 by design, the blocking flip is a one-flag change in preflight`
      : `check-innerhtml-ratchet: FAILED — ${news.length} NEW interpolated-markup site(s) not covered by the baseline`;
    console.error(head + scopeNote);
    for (const nw of news.slice(0, 30)) {
      console.error(`  ${nw.rel}:${nw.line} [${nw.bucket}] ${nw.snippet}`);
      for (const r of nw.reasons) console.error(`      - ${r}`);
      console.error('      fix: assign textContent / build nodes with createElement, or pass the value through a page escaper verified to escape & < > " (attribute values: DOM property assignment)');
    }
    if (news.length > 30) console.error(`  ... and ${news.length - 30} more`);
    if (removed) console.error(`  (${removed} baselined site(s) no longer present — prune with --update)`);
    process.exit(ADVISORY ? 0 : 1);
  }
  console.log(`check-innerhtml-ratchet: 0 new sites (${baseline.direct} direct + ${baseline.indirect} indirect baselined; ${removed} no longer present)${scopeNote}.`);
}
