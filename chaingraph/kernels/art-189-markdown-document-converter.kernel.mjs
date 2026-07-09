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

async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(String(str));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function compute(pp) {
  const markdown = typeof pp?.markdown === 'string' ? pp.markdown : '';
  const options = (pp && typeof pp.options === 'object' && pp.options) ? pp.options : {};
  const opts = {
    heading_ids: options.heading_ids === true,
    table_support: options.table_support !== false,
  };

  const { html, plain_text, stats } = parse(markdown, opts);
  const [input_sha256, html_sha256, plain_text_sha256] = await Promise.all([
    sha256Hex(markdown), sha256Hex(html), sha256Hex(plain_text),
  ]);

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
  const { output_payload, compliance_flags } = await compute(pp);
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
