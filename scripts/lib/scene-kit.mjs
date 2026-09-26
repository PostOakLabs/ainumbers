/**
 * scripts/lib/scene-kit.mjs — SCENE-KIT v1 (INFRA-PROMPTS-SVG-1, 2026-09-26).
 *
 * One shared template for animated SVG scenes: scoped CSS, a head script that
 * opts a page into motion, a figure wrapper, and a few icon builders. The
 * generated pages (gen-infrastructure-page.mjs, gen-prompts-page.mjs) import
 * it directly; hand-authored explainers copy SCENE_KIT_CSS and
 * SCENE_KIT_HEAD_JS inline (CONTRACT: one self-contained file per page).
 *
 * The contract every scene relies on:
 *   · FINAL STATE BY DEFAULT. With no JavaScript, in print, and under
 *     prefers-reduced-motion, every scene renders complete and still. Only
 *     the decorative travelling dots are hidden in that state.
 *   · MOTION IS OPT-IN. The head script adds `sk-js` to <html> only when
 *     IntersectionObserver exists and reduced motion is off, so hidden start
 *     states never apply to a reader who cannot see the animation run. Each
 *     scene gets `sk-play` once, when a fifth of it scrolls into view.
 *   · NO PAGE OVERFLOW. A wide scene scrolls inside its .sk-scroll frame;
 *     `contain:inline-size` keeps the scene's min-width from widening a flex
 *     or grid parent, so a 375 px phone never scrolls the page sideways.
 *   · SCOPED. Every selector sits under .sk-fig, .sk-scene or .sk-scroll, and
 *     every colour falls back to the estate palette, so the kit drops into any
 *     page without touching its own styles.
 *   · DETERMINISTIC. No randomness and no clock, so generated pages stay
 *     byte-stable for their --check gates.
 *
 * Animation classes (set on any SVG element inside .sk-scene):
 *   sk-draw   stroke draws in; give the path pathLength="100"
 *   sk-fade   fades in
 *   sk-pop    scales up from its own centre
 *   sk-slide  slides in by --dx / --dy (default 8px up)
 *   sk-pulse  breathes forever (use sparingly)
 *   sk-travel moves by --tx / --ty over --dur, forever; hidden without motion
 * Per-element timing: style="--d:.6s" (delay).
 */

export const SCENE_KIT_VERSION = 'v1';

export const SCENE_KIT_CSS = `/* SCENE-KIT:v1 (scripts/lib/scene-kit.mjs) */
.sk-fig{margin:1.1rem 0 1.6rem;min-width:0}
.sk-scroll{max-width:100%;overflow-x:auto;contain:inline-size;background:var(--bg-2,#0D1627);border:1px solid var(--border,#1E2F4A);border-radius:10px}
.sk-scroll>svg{display:block;width:100%;height:auto}
.sk-cap{font-size:.78rem;color:var(--body,#6888A8);line-height:1.6;margin-top:.55rem;max-width:780px}
.sk-cap a{color:var(--teal-lt,#2DD4BF);border-bottom:1px dotted currentColor}
.sk-scene text{font-family:'Sora',sans-serif;fill:var(--text,#A8C4DE);font-size:13px}
.sk-scene .m{font-family:'JetBrains Mono',monospace}
.sk-scene .h{font-family:'DM Serif Display',serif;fill:var(--white,#EEF6FD)}
.sk-scene .b{fill:var(--bright,#D4E8F8)}.sk-scene .s{fill:var(--body,#6888A8)}.sk-scene .mu{fill:var(--muted,#3A5270)}
.sk-scene .g{fill:var(--gold,#D4A847)}.sk-scene .t{fill:var(--teal-lt,#2DD4BF)}.sk-scene .p{fill:var(--purple,#9B72F5)}
.sk-scene .ok{fill:var(--green,#22C55E)}.sk-scene .r{fill:var(--red,#EF4444)}
.sk-scene .xs{font-size:10.5px}.sk-scene .sm{font-size:12px}.sk-scene .md{font-size:14px}.sk-scene .lg{font-size:17px}
.sk-scene .u{letter-spacing:.14em;text-transform:uppercase}
.sk-scene a{cursor:pointer}
.sk-scene a:focus{outline:none}
.sk-scene a:hover .sk-hit,.sk-scene a:focus-visible .sk-hit{stroke:var(--teal-lt,#2DD4BF);stroke-width:2}
.sk-scene .sk-pop{transform-box:fill-box;transform-origin:center}
.sk-travel{opacity:0}
.sk-js .sk-scene .sk-draw{stroke-dasharray:100;stroke-dashoffset:100}
.sk-js .sk-scene .sk-fade,.sk-js .sk-scene .sk-pop,.sk-js .sk-scene .sk-slide{opacity:0}
.sk-js .sk-scene.sk-play .sk-draw{animation:sk-draw .9s ease-out forwards var(--d,0s)}
.sk-js .sk-scene.sk-play .sk-fade{animation:sk-fade .6s ease-out forwards var(--d,0s)}
.sk-js .sk-scene.sk-play .sk-pop{animation:sk-pop .5s cubic-bezier(.2,1.4,.4,1) forwards var(--d,0s)}
.sk-js .sk-scene.sk-play .sk-slide{animation:sk-slide .7s ease-out forwards var(--d,0s)}
.sk-js .sk-scene.sk-play .sk-pulse{animation:sk-pulse 2.2s ease-in-out infinite var(--d,0s)}
.sk-js .sk-scene.sk-play .sk-travel{animation:sk-travel var(--dur,2.6s) linear infinite var(--d,0s)}
@keyframes sk-draw{to{stroke-dashoffset:0}}
@keyframes sk-fade{to{opacity:1}}
@keyframes sk-pop{0%{opacity:0;transform:scale(.55)}100%{opacity:1;transform:scale(1)}}
@keyframes sk-slide{from{opacity:0;transform:translate(var(--dx,0px),var(--dy,8px))}to{opacity:1;transform:translate(0,0)}}
@keyframes sk-pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes sk-travel{0%{opacity:0;transform:translate(0,0)}8%{opacity:1}88%{opacity:1}100%{opacity:0;transform:translate(var(--tx,0px),var(--ty,0px))}}
@media print,(prefers-reduced-motion:reduce){
  .sk-js .sk-scene *{animation:none!important}
  .sk-js .sk-scene .sk-fade,.sk-js .sk-scene .sk-pop,.sk-js .sk-scene .sk-slide{opacity:1!important;transform:none!important}
  .sk-js .sk-scene .sk-draw{stroke-dashoffset:0!important}
  .sk-travel{opacity:0!important}
}`;

// Inline in <head>. Adds sk-js before first paint (no flash of hidden
// content), then marks each scene sk-play once it scrolls into view.
export const SCENE_KIT_HEAD_JS = `(function(){var d=document.documentElement;try{if(!('IntersectionObserver' in window))return;if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;d.classList.add('sk-js');document.addEventListener('DOMContentLoaded',function(){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('sk-play');io.unobserve(e.target);}});},{threshold:0.2});Array.prototype.forEach.call(document.querySelectorAll('svg.sk-scene'),function(s){io.observe(s);});});}catch(e){d.classList.remove('sk-js');}})();`;

/**
 * A captioned, horizontally scrollable scene. `title` and `desc` are plain
 * text (escaped here); `body` is trusted SVG markup built by the caller;
 * `caption` is trusted HTML. `role: 'group'` keeps links inside the SVG
 * reachable by assistive technology (role="img" would hide them).
 */
export function sceneFigure({ id, viewBox, minWidth = 640, title, desc, body, caption = '', role = 'img' }) {
  if (!id || !viewBox || !title || !desc) throw new Error('sceneFigure: id, viewBox, title and desc are required');
  return `<figure class="sk-fig" id="${id}">
  <div class="sk-scroll"><svg class="sk-scene" viewBox="${viewBox}" style="min-width:${minWidth}px" role="${role}" aria-labelledby="${id}-t ${id}-d" xmlns="http://www.w3.org/2000/svg"><title id="${id}-t">${escText(title)}</title><desc id="${id}-d">${escText(desc)}</desc>
${body}
  </svg></div>${caption ? `\n  <figcaption class="sk-cap">${caption}</figcaption>` : ''}
</figure>`;
}

export function escText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Icon builders: deterministic SVG fragments ─────────────────────────────
export const icon = {
  // A page with a folded corner, top-left at (x, y).
  doc(x, y, w = 56, h = 70, stroke = 'var(--border-2,#263855)') {
    const f = Math.round(w * 0.28);
    return `<path d="M${x} ${y} H${x + w - f} L${x + w} ${y + f} V${y + h} H${x} Z" fill="var(--bg-3,#111E35)" stroke="${stroke}" stroke-width="1.4"/><path d="M${x + w - f} ${y} V${y + f} H${x + w}" fill="none" stroke="${stroke}" stroke-width="1.2"/>`
      + [0.42, 0.58, 0.74].map((k) => `<path d="M${x + 10} ${Math.round(y + h * k)} H${x + w - 12}" stroke="var(--muted,#3A5270)" stroke-width="2" stroke-linecap="round"/>`).join('');
  },
  // A kernel hexagon with a code glyph, centred at (cx, cy).
  hex(cx, cy, r = 30) {
    const pts = [0, 1, 2, 3, 4, 5].map((i) => {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      return `${Math.round(cx + r * Math.cos(a))},${Math.round(cy + r * Math.sin(a))}`;
    }).join(' ');
    const k = r / 30;
    const p = (dx, dy) => `${Math.round(cx + dx * k)} ${Math.round(cy + dy * k)}`;
    return `<polygon points="${pts}" fill="var(--teal-dim,rgba(20,184,166,.12))" stroke="var(--teal,#14B8A6)" stroke-width="1.8"/><path d="M${p(-9, -7)} L${p(-15, 0)} L${p(-9, 7)} M${p(9, -7)} L${p(15, 0)} L${p(9, 7)} M${p(3, -10)} L${p(-3, 10)}" fill="none" stroke="var(--teal-lt,#2DD4BF)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  },
  // A green check in a circle, centred at (cx, cy).
  check(cx, cy, r = 11) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--green-dim,rgba(34,197,94,.12))" stroke="var(--green,#22C55E)" stroke-width="1.5"/><path d="M${cx - r * 0.45} ${cy} L${cx - r * 0.1} ${cy + r * 0.35} L${cx + r * 0.48} ${cy - r * 0.38}" fill="none" stroke="var(--green,#22C55E)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  },
  // A padlock, top-left at (x, y), 16 x 18.
  lock(x, y, stroke = 'var(--teal,#14B8A6)') {
    return `<rect x="${x}" y="${y + 7}" width="16" height="11" rx="2" fill="var(--bg-3,#111E35)" stroke="${stroke}" stroke-width="1.3"/><path d="M${x + 4} ${y + 7} V${y + 4.5} a4 4 0 0 1 8 0 V${y + 7}" fill="none" stroke="${stroke}" stroke-width="1.3"/>`;
  },
  // A small robot head for an agent, centred at (cx, cy).
  agent(cx, cy) {
    return `<rect x="${cx - 16}" y="${cy - 12}" width="32" height="26" rx="7" fill="var(--purple-dim,rgba(155,114,245,.12))" stroke="var(--purple,#9B72F5)" stroke-width="1.5"/><circle cx="${cx - 6}" cy="${cy}" r="2.6" fill="var(--purple,#9B72F5)"/><circle cx="${cx + 6}" cy="${cy}" r="2.6" fill="var(--purple,#9B72F5)"/><path d="M${cx} ${cy - 12} V${cy - 19}" stroke="var(--purple,#9B72F5)" stroke-width="1.5"/><circle cx="${cx}" cy="${cy - 21}" r="2.4" fill="var(--purple,#9B72F5)"/>`;
  },
  // An arrowhead pointing right, tip at (x, y).
  arrowRight(x, y, fill = 'var(--muted,#3A5270)') {
    return `<path d="M${x} ${y} l-8 -4.5 v9 Z" fill="${fill}"/>`;
  },
  // An arrowhead pointing down, tip at (x, y).
  arrowDown(x, y, fill = 'var(--muted,#3A5270)') {
    return `<path d="M${x} ${y} l-4.5 -8 h9 Z" fill="${fill}"/>`;
  },
  // A gold hash pill, top-left at (x, y).
  hashPill(x, y, label, w = 150) {
    return `<rect x="${x}" y="${y}" width="${w}" height="26" rx="13" fill="var(--gold-dim,rgba(212,168,71,.12))" stroke="var(--gold,#D4A847)" stroke-width="1.3"/><text x="${x + w / 2}" y="${y + 17}" text-anchor="middle" class="m xs g">${escText(label)}</text>`;
  },
};
