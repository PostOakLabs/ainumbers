import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-189-markdown-document-converter';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'convert_markdown_document',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Deterministic Markdown -> HTML + plain text over a hand-rolled CommonMark
// subset (headings, paragraphs, bold/italic/code spans, fenced code, blockquotes,
// one-level ordered/unordered lists, links, images-as-links, hr, GFM pipe tables).
// No external library. All raw HTML in the input is escaped, so the output is
// injection-safe. Digests are SHA-256 over the exact UTF-8 bytes of each string,
// with no Unicode normalization (digest_basis records this). Zero network, zero PII.

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Only permit safe URL schemes; a javascript:/data:/vbscript: URL becomes '#'.
function safeUrl(u) {
  const raw = String(u || '').trim();
  if (raw === '') return '#';
  if (/^(https?:|mailto:)/i.test(raw)) return raw;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '#'; // any other explicit scheme is unsafe
  return raw; // relative path or fragment
}

// Inline formatting on an already-block-split line. Escapes HTML first, then
// applies code spans, images, links, bold, italic. Order matters: code spans are
// tokenized first so their contents are not re-parsed.
function inline(text) {
  const codes = [];
  // Extract code spans (single backtick) and stash escaped content.
  let s = String(text).replace(/`([^`]+)`/g, (_, c) => {
    codes.push('<code>' + esc(c) + '</code>');
    return '\uE000CODE' + (codes.length - 1) + '\uE000';
  });
  s = esc(s);
  // Images ![alt](url) -> rendered as a link (never fetches a remote resource).
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) =>
    `<a href="${esc(safeUrl(url))}">${alt || esc(url)}</a>`);
  // Links [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, url) =>
    `<a href="${esc(safeUrl(url))}">${t}</a>`);
  // Bold then italic (bold first so ** is not eaten by the * rule).
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
  // Restore code spans.
  s = s.replace(/\uE000CODE(\d+)\uE000/g, (_, i) => codes[Number(i)]);
  return s;
}

// Strip inline markdown to plain text (for the plain_text output + word count).
function inlineText(text) {
  let s = String(text);
  s = s.replace(/`([^`]+)`/g, '$1');
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) => alt || url);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1');
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');
  s = s.replace(/\*([^*]+)\*/g, '$1').replace(/_([^_]+)_/g, '$1');
  return s;
}

function slugify(text) {
  return String(text).toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parse(md, opts) {
  const headingIds = opts.heading_ids === true;
  const tables = opts.table_support !== false; // default on
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  const plain = [];
  const stats = { headings: 0, links: 0, code_blocks: 0, tables: 0, words: 0 };
  const usedIds = Object.create(null);

  const countLinks = (raw) => {
    const m = String(raw).match(/\[[^\]]+\]\([^)\s]+\)|!\[[^\]]*\]\([^)\s]+\)/g);
    return m ? m.length : 0;
  };

  let i = 0;
  while (i < lines.length) {
    let line = lines[i];

    // Blank line
    if (/^\s*$/.test(line)) { i++; continue; }

    // Fenced code block ``` or ~~~
    const fence = line.match(/^\s*(```|~~~)(.*)$/);
    if (fence) {
      const marker = fence[1];
      const lang = fence[2].trim();
      const buf = [];
      i++;
      while (i < lines.length && !new RegExp('^\\s*' + marker).test(lines[i])) {
        buf.push(lines[i]); i++;
      }
      if (i < lines.length) i++; // consume closing fence
      const cls = lang ? ` class="language-${esc(slugify(lang))}"` : '';
      html.push(`<pre><code${cls}>` + esc(buf.join('\n')) + '</code></pre>');
      plain.push(buf.join('\n'));
      stats.code_blocks++;
      continue;
    }

    // ATX heading
    const h = line.match(/^\s*(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      const level = h[1].length;
      const textRaw = h[2];
      stats.links += countLinks(textRaw);
      let idAttr = '';
      if (headingIds) {
        let base = slugify(inlineText(textRaw)) || 'section';
        let id = base, n = 1;
        while (usedIds[id]) id = base + '-' + (++n);
        usedIds[id] = true;
        idAttr = ` id="${esc(id)}"`;
      }
      html.push(`<h${level}${idAttr}>` + inline(textRaw) + `</h${level}>`);
      plain.push(inlineText(textRaw));
      stats.headings++;
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      html.push('<hr>');
      i++;
      continue;
    }

    // GFM pipe table: a header row followed by a delimiter row of ---|:--- cells
    if (tables && line.includes('|') && i + 1 < lines.length &&
        /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(lines[i + 1])) {
      const splitRow = (r) => r.replace(/^\s*\|/, '').replace(/\|\s*$/, '')
        .split('|').map((c) => c.trim());
      const header = splitRow(line);
      i += 2; // skip header + delimiter
      const bodyRows = [];
      while (i < lines.length && lines[i].includes('|') && !/^\s*$/.test(lines[i])) {
        bodyRows.push(splitRow(lines[i])); i++;
      }
      const th = header.map((c) => { stats.links += countLinks(c); return `<th>${inline(c)}</th>`; }).join('');
      const trs = bodyRows.map((row) => {
        const cells = header.map((_, ci) => {
          const c = row[ci] ?? '';
          stats.links += countLinks(c);
          return `<td>${inline(c)}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      html.push(`<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`);
      plain.push([header, ...bodyRows].map((r) => r.map(inlineText).join('\t')).join('\n'));
      stats.tables++;
      continue;
    }

    // Blockquote (collapse consecutive > lines into one quote, one level)
    if (/^\s*>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, '')); i++;
      }
      const inner = buf.join(' ');
      stats.links += countLinks(inner);
      html.push('<blockquote><p>' + inline(inner) + '</p></blockquote>');
      plain.push(inlineText(inner));
      continue;
    }

    // Unordered list (one nesting level; sub-items flattened into the item text)
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        const itxt = lines[i].replace(/^\s*[-*+]\s+/, '');
        stats.links += countLinks(itxt);
        items.push(itxt); i++;
      }
      html.push('<ul>' + items.map((t) => `<li>${inline(t)}</li>`).join('') + '</ul>');
      plain.push(items.map((t) => '- ' + inlineText(t)).join('\n'));
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const itxt = lines[i].replace(/^\s*\d+\.\s+/, '');
        stats.links += countLinks(itxt);
        items.push(itxt); i++;
      }
      html.push('<ol>' + items.map((t) => `<li>${inline(t)}</li>`).join('') + '</ol>');
      plain.push(items.map((t, n) => (n + 1) + '. ' + inlineText(t)).join('\n'));
      continue;
    }

    // Paragraph: gather consecutive non-blank, non-block lines
    const para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) &&
           !/^\s*(#{1,6})\s+/.test(lines[i]) &&
           !/^\s*(```|~~~)/.test(lines[i]) &&
           !/^\s*>\s?/.test(lines[i]) &&
           !/^\s*[-*+]\s+/.test(lines[i]) &&
           !/^\s*\d+\.\s+/.test(lines[i]) &&
           !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    const ptext = para.join(' ');
    stats.links += countLinks(ptext);
    html.push('<p>' + inline(ptext) + '</p>');
    plain.push(inlineText(ptext));
  }

  const plainText = plain.join('\n\n');
  const words = plainText.trim() === '' ? 0 : plainText.trim().split(/\s+/).length;
  stats.words = words;
  return { html: html.join('\n'), plain_text: plainText, stats };
}

// Synchronous, WebCrypto-free SHA-256 (ASYNC-VACUOUS-REMEDIATE-1).
// Transcribed from the proven art-476 block. compute() MUST be synchronous: the zkVM
// guest and the host verifier both call compute(pp) directly, and an async compute
// returns a Promise that canonicalizes to {} -- a groth16 seal over an empty journal.
// The digest VALUES are unchanged from the WebCrypto path, so fixtures, golden hashes
// and execution_hash all stay identical; the self-check below pins that byte-for-byte.

function _utf8Bytes(str) {
  const s = String(str);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      const hi = c, lo = s.charCodeAt(++i);
      const cp = 0x10000 + ((hi - 0xd800) << 10) + (lo - 0xdc00);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return new Uint8Array(out);
}

function _sha256(bytes) {
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ]);
  const msgLen = bytes.length;
  const paddedLen = Math.ceil((msgLen + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[msgLen] = 0x80;
  const bitLen = msgLen * 8;
  for (let i = 0; i < 8; i++) padded[paddedLen - 8 + i] = Number((BigInt(bitLen) >> BigInt(56 - i * 8)) & 0xffn);
  let [h0,h1,h2,h3,h4,h5,h6,h7] = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rotr = (x, n2) => (x >>> n2) | (x << (32 - n2));
  for (let cs = 0; cs < paddedLen; cs += 64) {
    const W = new Uint32Array(64);
    for (let i = 0; i < 16; i++) { const j = cs + i * 4; W[i] = (padded[j] << 24) | (padded[j+1] << 16) | (padded[j+2] << 8) | padded[j+3]; }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i-15], 7) ^ rotr(W[i-15], 18) ^ (W[i-15] >>> 3);
      const s1 = rotr(W[i-2], 17) ^ rotr(W[i-2], 19) ^ (W[i-2] >>> 10);
      W[i] = (W[i-16] + s0 + W[i-7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = [h0,h1,h2,h3,h4,h5,h6,h7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25), ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22), maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  const r = new Uint8Array(32);
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach(function (v, i) { const j = i * 4; r[j] = v >>> 24; r[j+1] = (v >>> 16) & 0xff; r[j+2] = (v >>> 8) & 0xff; r[j+3] = v & 0xff; });
  return r;
}

function _toHex(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

// STOP conditions. Both MUST pass or this kernel throws and emits no digest.
// KNOWN_VECTOR_ASCII pins the SHA-256 core. KNOWN_VECTOR_UTF8 pins _utf8Bytes against
// the host TextEncoder byte-for-byte: the fixtures are pure ASCII and cannot catch a
// multi-byte divergence, so a non-ASCII vector is pinned explicitly. It covers 2-byte
// (e-acute), 3-byte (euro, CJK) and 4-byte surrogate-pair (emoji) encodings.
const KNOWN_VECTOR_ASCII = 'hello world';
const KNOWN_VECTOR_ASCII_SHA = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
const KNOWN_VECTOR_UTF8 = 'é€中🌍';
const KNOWN_VECTOR_UTF8_BYTES = 'c3a9e282ace4b8adf09f8c8d';
const KNOWN_VECTOR_UTF8_SHA = 'a0ce5afdae3fe5735aafeb2e6e0fc183133f3c47776e74fc85aedcc0cf7f1b6a';
(function _shaSelfCheck() {
  const a = _toHex(_sha256(_utf8Bytes(KNOWN_VECTOR_ASCII)));
  if (a !== KNOWN_VECTOR_ASCII_SHA) {
    throw new Error('SHA-256 self-check FAILED: got ' + a + ' expected ' + KNOWN_VECTOR_ASCII_SHA);
  }
  const encoded = _toHex(_utf8Bytes(KNOWN_VECTOR_UTF8));
  if (encoded !== KNOWN_VECTOR_UTF8_BYTES) {
    throw new Error('UTF-8 encoder self-check FAILED: got ' + encoded + ' expected ' + KNOWN_VECTOR_UTF8_BYTES);
  }
  const u = _toHex(_sha256(_utf8Bytes(KNOWN_VECTOR_UTF8)));
  if (u !== KNOWN_VECTOR_UTF8_SHA) {
    throw new Error('non-ASCII digest self-check FAILED: got ' + u + ' expected ' + KNOWN_VECTOR_UTF8_SHA);
  }
})();

function sha256Hex(text) {
  return _toHex(_sha256(_utf8Bytes(text)));
}

export function compute(pp) {
  const markdown = typeof pp?.markdown === 'string' ? pp.markdown : '';
  const options = (pp && typeof pp.options === 'object' && pp.options) ? pp.options : {};
  const opts = {
    heading_ids: options.heading_ids === true,
    table_support: options.table_support !== false,
  };

  const { html, plain_text, stats } = parse(markdown, opts);
  const [input_sha256, html_sha256, plain_text_sha256] = [
    sha256Hex(markdown), sha256Hex(html), sha256Hex(plain_text),
  ];

  const compliance_flags = [];
  compliance_flags.push('MARKDOWN_CONVERSION_PERFORMED');
  if (stats.tables > 0) compliance_flags.push('GFM_TABLES_RENDERED');
  if (stats.code_blocks > 0) compliance_flags.push('CODE_BLOCKS_PRESENT');
  compliance_flags.push('OUTPUT_INJECTION_SAFE');

  return {
    output_payload: {
      html, plain_text, stats,
      digest_basis: 'utf8-bytes-no-normalization',
      input_sha256, html_sha256, plain_text_sha256,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
