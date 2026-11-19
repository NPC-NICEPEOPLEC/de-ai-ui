#!/usr/bin/env node
// de-ai-ui / slop-lint
// A zero-dependency, deterministic audit for the UI tells that make an
// interface look "AI generated". Every rule maps to a source in
// references/sources.md; nothing here is a matter of taste on its own.
//
// Usage:
//   node scripts/slop-lint.mjs <files-or-dirs...> [--json] [--min-severity P1]
//   node scripts/slop-lint.mjs src --json --fail-under 90
//
// Exit codes: 0 clean enough, 1 below --fail-under, 2 bad input.

import { readFileSync, statSync, readdirSync } from 'node:fs';
import { extname, join, resolve as resolvePath, relative } from 'node:path';

const VERSION = '1.0.0';
const EXTENSIONS = new Set(['.html', '.htm', '.css', '.jsx', '.tsx', '.vue', '.svelte', '.astro']);
const SEVERITY_ORDER = { P0: 0, P1: 1, P2: 2 };
const WEIGHT = { P0: 12, P1: 5, P2: 2 };

const RULES = {
  R001: ['P1', 'radius off the 4px grid', 'Nested radii only stay concentric when R, padding and r share one scale. Snap every radius to the 4px grid.'],
  R002: ['P2', 'too many distinct radii', 'More than 4 radius values means the corner language is unplanned. Collapse to a token set.'],
  R003: ['P2', 'radius below 4px', 'A 1-3px radius reads as a rendering accident, not a decision. Use 4px or 0.'],
  C001: ['P1', 'purple/violet gradient', 'The default AI palette. Gradients on purple hues are the single most recognisable slop tell.'],
  C002: ['P1', 'gradient on a button', 'A gradient primary button competes with the content it is supposed to serve. Use a flat surface.'],
  C003: ['P2', 'more than one saturated hue on chrome', 'Buttons, cards and inputs should carry no colour; colour belongs to photos, illustrations and data.'],
  T001: ['P1', 'more than 4 font sizes', 'Hierarchy should come from weight, colour and spacing, not a fifth size.'],
  T002: ['P1', 'font size below 12px', 'Under 12px the interface stops being readable and starts looking cheap.'],
  T003: ['P1', 'overused AI font', 'Instrument Serif / Space Grotesk / Bricolage Grotesque are the current slop signatures.'],
  T004: ['P2', 'uppercase micro-heading', 'All-caps section labels are a template tell. Use sentence case and weight.'],
  T005: ['P1', 'CJK font listed before the Latin font', 'Latin must come first, otherwise the CJK font hijacks Latin glyphs and numbers.'],
  T006: ['P2', 'font stack without a generic fallback', 'Always end the stack with sans-serif, serif or monospace.'],
  T007: ['P2', 'hero type above 64px', 'Oversized hero headlines are a landing-page template habit, not a hierarchy.'],
  Y001: ['P1', 'middle dot used as a separator', 'The "·" separator is the most copied AI copy pattern. Remove it or use real punctuation.'],
  Y002: ['P2', 'emoji in body copy', 'Emoji inside copy or headings reads as template filler.'],
  Y003: ['P2', 'eyebrow / overline label', 'Small caps labels above a heading are decoration the page does not need.'],
  Y004: ['P2', 'numbered section label', 'Section numbers are a portfolio trope; they add no information.'],
  L001: ['P1', '1px border where 0.5px belongs', 'Hairlines should be 0.5px; a 1px line is twice as heavy as the interface expects.'],
  L002: ['P1', 'coloured bar on a card edge', 'The left accent strip is a stock dashboard tell. Remove it and let spacing group content.'],
  M001: ['P2', 'transition slower than 400ms', 'Slow default transitions feel like a demo, not a product.'],
  M002: ['P2', 'ease-in on a transition', 'ease-in delays the first frame and reads as lag; entrances should be ease-out.'],
  M003: ['P2', 'transition: all', 'transition: all animates layout and colour together and produces jank.'],
  A001: ['P2', 'most content is centred', 'Centre-aligned blocks everywhere destroy reading rhythm. Centre only short, isolated elements.'],
  A002: ['P2', 'hard-coded values in an inline style', 'Inline pixel values bypass the token layer and cannot be themed.'],
  K001: ['P1', 'mixed icon families', 'Two icon libraries in one interface produce mismatched stroke weight and corner radius.'],
  D001: ['P2', 'card inside a card', 'Nested framed containers double the border and shadow weight.'],
  S001: ['P1', 'html element without lang', 'A missing lang attribute breaks CJK line breaking, hyphens and screen readers.'],
  S002: ['P1', 'img without alt', 'Every image needs an alt text, decorative or not (alt="").'],
};

// ---------------------------------------------------------------- utilities

function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) if (text[i] === '\n') starts.push(i + 1);
  return starts;
}

function position(starts, index) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid; else hi = mid - 1;
  }
  return { line: lo + 1, column: index - starts[lo] + 1 };
}

const blank = (match) => match.replace(/[^\n]/g, ' ');

function maskScripts(text) {
  return text.replace(/<script\b[\s\S]*?<\/script>/gi, blank);
}

function maskNonText(html) {
  let out = maskScripts(html);
  out = out.replace(/<style\b[\s\S]*?<\/style>/gi, blank);
  out = out.replace(/<!--[\s\S]*?-->/g, blank);
  out = out.replace(/<[^>]*>/g, blank);
  return out
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function cssBlocks(text, ext) {
  if (ext === '.css') return [{ start: 0, css: text }];
  const blocks = [];
  for (const m of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    blocks.push({ start: m.index + m[0].indexOf('>') + 1, css: m[1] });
  }
  for (const m of text.matchAll(/\bstyle\s*=\s*"([^"]*)"/g)) {
    blocks.push({ start: m.index + m[0].indexOf('"') + 1, css: m[1] });
  }
  for (const m of text.matchAll(/\bstyle\s*=\s*'([^']*)'/g)) {
    blocks.push({ start: m.index + m[0].indexOf("'") + 1, css: m[1] });
  }
  return blocks;
}

// Last selector-ish text before a declaration, so we can tell a button from a body.
function selectorFor(css, index) {
  const head = css.slice(Math.max(0, index - 400), index);
  const brace = head.lastIndexOf('{');
  if (brace === -1) return '';
  const before = head.slice(0, brace);
  const start = Math.max(before.lastIndexOf('}'), before.lastIndexOf(';')) + 1;
  return before.slice(start).trim().toLowerCase();
}

function hueSat(color) {
  let r; let g; let b;
  const hex = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (h.length < 6) return null;
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  } else {
    const rgb = color.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    const hsl = color.match(/hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
    if (rgb) {
      [r, g, b] = rgb.slice(1, 4).map(Number);
    } else if (hsl) {
      return { hue: Number(hsl[1]), sat: Number(hsl[2]), light: Number(hsl[3]) };
    } else {
      return null;
    }
  }
  const rn = r / 255; const gn = g / 255; const bn = b / 255;
  const max = Math.max(rn, gn, bn); const min = Math.min(rn, gn, bn);
  const light = ((max + min) / 2) * 100;
  const delta = max - min;
  if (delta === 0) return { hue: 0, sat: 0, light };
  const sat = (delta / (1 - Math.abs((2 * light) / 100 - 1))) * 100;
  let hue;
  if (max === rn) hue = ((gn - bn) / delta) % 6;
  else if (max === gn) hue = (bn - rn) / delta + 2;
  else hue = (rn - gn) / delta + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return { hue, sat, light };
}

const COLOR_TOKEN = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;

function colorsIn(value) {
  return (value.match(COLOR_TOKEN) || [])
    .map((hex) => {
      const parsed = hueSat(hex);
      return parsed ? { hex, ...parsed } : null;
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------- analysis

function analyze(file, text) {
  const ext = extname(file).toLowerCase();
  const starts = lineStarts(text);
  const findings = [];
  const stats = { radii: new Set(), fontSizes: new Set(), chromeHues: new Set(), pxBorders: 0 };

  const add = (rule, index, message) => {
    const [severity, title, detail] = RULES[rule];
    const { line, column } = position(starts, Math.max(0, Math.min(index, text.length - 1)));
    findings.push({ rule, severity, title, line, column, message: message || detail, detail, file });
  };

  const blocks = cssBlocks(text, ext);
  const declarations = [];
  for (const block of blocks) {
    const re = /([-a-zA-Z]+)\s*:\s*([^;{}]+)/g;
    let m;
    while ((m = re.exec(block.css))) {
      declarations.push({
        prop: m[1].toLowerCase(),
        value: m[2].trim(),
        selector: selectorFor(block.css, m.index),
        index: block.start + m.index,
      });
    }
  }

  const visible = ext === '.css' ? '' : maskNonText(text);
  const tags = maskScripts(text);
  const hasCJK = /[\u3400-\u9fff]/.test(visible) || /[\u3400-\u9fff]/.test(tags);

  // ---- radius
  for (const d of declarations) {
    // Radius tokens (--r-*, --radius-*, --corner-*) must obey the same grid as
    // the literal declarations, otherwise moving a value into a variable would
    // hide it from the audit.
    const isRadiusToken = /^--/.test(d.prop)
      && /(radius|round|corner)/.test(d.prop) || /^--r[-_]/.test(d.prop);
    if ((!/radius$/.test(d.prop) && !isRadiusToken) || /var\(|calc\(|%/.test(d.value)) continue;
    for (const n of d.value.match(/-?[\d.]+(?=px)/g) || []) {
      const r = parseFloat(n);
      if (!Number.isFinite(r)) continue;
      if (r >= 999) continue;
      stats.radii.add(r);
      if (r > 0 && r < 4) add('R003', d.index, `${d.prop}: ${r}px is below the 4px minimum`);
      else if (r > 0 && r % 4 !== 0) add('R001', d.index, `${d.prop}: ${r}px is off the 4px grid`);
    }
  }
  if (stats.radii.size > 4) {
    add('R002', 0, `${stats.radii.size} distinct radii: ${[...stats.radii].sort((a, b) => a - b).join(', ')}px`);
  }

  // ---- colour
  for (const d of declarations) {
    const isGradient = /gradient\(/.test(d.value);
    const colors = colorsIn(d.value);
    if (isGradient) {
      const purple = colors.some((c) => c.hue >= 250 && c.hue <= 330 && c.sat > 20);
      if (purple) {
        add('C001', d.index);
        if (/button|btn|cta|primary/.test(d.selector)) add('C002', d.index);
      }
    }
    if (/^(background|background-color|color|border|border-[a-z]+|border-color|fill|stroke)$/.test(d.prop)) {
      for (const c of colors) {
        if (c.sat >= 25 && c.light > 8 && c.light < 92) stats.chromeHues.add(Math.round(c.hue / 45));
      }
    }
  }
  for (const m of tags.matchAll(/\bclass(?:Name)?\s*=\s*["']([^"']*)["']/g)) {
    if (/(?:from|via|to|bg)-(purple|violet|indigo|fuchsia)-\d{2,3}/.test(m[1])) {
      add('C001', m.index, 'gradient/background built from a purple scale utility class');
    }
    if (/(?:^|\s)btn-primary\b/.test(m[1]) && /(?:bg-gradient|from-)/.test(m[1])) add('C002', m.index);
    if (/\b(eyebrow|overline|kicker)\b/.test(m[1])) add('Y003', m.index, `class "${m[1].trim()}" is an eyebrow label`);
  }
  if (stats.chromeHues.size > 1) {
    add('C003', 0, `${stats.chromeHues.size} saturated hue families on interface chrome`);
  }

  // ---- type
  for (const d of declarations) {
    const isFontSize = d.prop === 'font-size';
    const isSizeVar = /^--/.test(d.prop) && /(text|font|type|fs[-_]?)/.test(d.prop) && /px/.test(d.value);
    if (d.prop === 'text-transform' && /uppercase/i.test(d.value)) add('T004', d.index);
    if (!isFontSize && !isSizeVar) continue;
    for (const n of d.value.match(/[\d.]+(?=px)/g) || []) {
      const size = parseFloat(n);
      if (!Number.isFinite(size)) continue;
      stats.fontSizes.add(size);
      if (size < 12) add('T002', d.index, `font-size ${size}px is below the 12px floor`);
      if (size > 64 && isFontSize) add('T007', d.index, `font-size ${size}px is hero-scale (over 64px)`);
    }
    if (isFontSize && /Instrument Serif|Space Grotesk|Bricolage Grotesque/i.test(d.value)) add('T003', d.index);
  }
  for (const name of ['Instrument Serif', 'Space Grotesk', 'Bricolage Grotesque']) {
    if (!new RegExp(name, 'i').test(text)) continue;
    if (!findings.some((f) => f.rule === 'T003')) add('T003', text.indexOf(name), `"${name}" appears in the file`);
  }
  if (stats.fontSizes.size > 4) {
    add('T001', 0, `${stats.fontSizes.size} distinct font sizes: ${[...stats.fontSizes].sort((a, b) => a - b).join(', ')}px`);
  }

  const CJK = /pingfang|hiragino sans|microsoft yahei|msyh|noto sans (cjk|sc|tc)|source han|heiti|simsun|songti|microsoft jhenghei/i;
  const LATIN = /-apple-system|blinkmacsystemfont|helvetica|arial|roboto|segoe ui|inter|geist|sf pro|system-ui|georgia|times/i;
  for (const d of declarations) {
    if (d.prop !== 'font-family') continue;
    const families = d.value.split(',').map((f) => f.trim().replace(/^["']|["']$/g, ''));
    const cjkIndex = families.findIndex((f) => CJK.test(f));
    const latinIndex = families.findIndex((f) => LATIN.test(f));
    if (hasCJK && cjkIndex !== -1 && latinIndex !== -1 && cjkIndex < latinIndex) {
      add('T005', d.index, `"${families[cjkIndex]}" is listed before "${families[latinIndex]}"`);
    }
    if (!/sans-serif|serif|monospace|system-ui|cursive|fantasy/i.test(d.value)) add('T006', d.index);
  }

  // ---- copy
  for (const m of visible.matchAll(/[·•]/g)) {
    add('Y001', m.index, `"${m[0]}" used in visible copy`);
  }
  for (const m of visible.matchAll(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu)) {
    add('Y002', m.index, `"${m[0]}" appears in visible copy`);
  }
  for (const m of visible.matchAll(/(?:^|\n)\s*0\d\s*[—–\-]\s*\S/g)) {
    add('Y004', m.index, `"${m[0].trim()}" looks like a numbered section label`);
  }

  // ---- borders
  for (const d of declarations) {
    if (!/^border(-[a-z]+)?(-width)?$/.test(d.prop)) continue;
    if (/(?<![\d.])1px/.test(d.value)) {
      stats.pxBorders += 1;
      add('L001', d.index, `${d.prop}: ${d.value} should be a 0.5px hairline`);
    }
    if (d.prop.startsWith('border-left')) {
      const colors = colorsIn(d.value).filter((c) => c.sat >= 25);
      if (colors.length) add('L002', d.index, `${d.prop} carries a saturated accent colour`);
    }
  }

  // ---- motion
  for (const d of declarations) {
    if (d.prop !== 'transition' && d.prop !== 'animation' && d.prop !== 'transition-duration') continue;
    for (const m of d.value.matchAll(/([\d.]+)(ms|s)\b/g)) {
      const ms = m[2] === 's' ? parseFloat(m[1]) * 1000 : parseFloat(m[1]);
      if (ms > 400) add('M001', d.index, `${Math.round(ms)}ms transition exceeds 400ms`);
    }
    if (/ease-in\b(?!-out)/.test(d.value)) add('M002', d.index);
    if (/\ball\b/.test(d.value) && d.prop.startsWith('transition')) add('M003', d.index);
  }

  // ---- alignment
  const aligns = declarations.filter((d) => d.prop === 'text-align');
  const centered = aligns.filter((d) => /center/.test(d.value));
  if (aligns.length >= 4 && centered.length / aligns.length >= 0.6) {
    add('A001', centered[0]?.index ?? 0, `${centered.length} of ${aligns.length} text-align rules are centred`);
  }
  for (const m of text.matchAll(/\bstyle\s*=\s*["'][^"']*[\d.]+px[^"']*["']/g)) {
    if (!/var\(/.test(m[0])) add('A002', m.index, 'inline style hard-codes a pixel value');
  }

  // ---- assets
  const iconLibs = new Set();
  for (const m of text.matchAll(/(?:from|require\()\s*['"]{1}([^'"]+)['"]/g)) {
    const spec = m[1];
    if (/lucide|heroicons|react-icons|@tabler\/icons|phosphor|feather-icons|font-awesome|@fortawesome|@remixicon|iconoir|bootstrap-icons|@iconify/i.test(spec)) {
      iconLibs.add(spec.split('/')[0] + '/' + (spec.split('/')[1] || ''));
    }
  }
  if (iconLibs.size > 1) add('K001', 0, `icons imported from ${iconLibs.size} families: ${[...iconLibs].join(', ')}`);
  if (/class(?:Name)?\s*=\s*["'][^"']*\bcard\b[^"']*["'][^>]*>\s*<[^>]*class(?:Name)?\s*=\s*["'][^"']*\bcard\b/.test(tags)) {
    add('D001', 0);
  }
  if (ext === '.html' || ext === '.htm' || ext === '.vue' || ext === '.svelte' || ext === '.astro') {
    const html = text.match(/<html\b([^>]*)>/i);
    if (html && !/\blang\s*=/.test(html[1])) add('S001', html.index);
  }
  for (const m of tags.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\balt\s*=/i.test(m[1])) add('S002', m.index, 'img has no alt attribute');
  }

  return { file, findings, stats: {
    radii: [...stats.radii].sort((a, b) => a - b),
    fontSizes: [...stats.fontSizes].sort((a, b) => a - b),
    lines: starts.length,
  } };
}

function scoreOf(findings) {
  const perRule = new Map();
  for (const f of findings) perRule.set(f.rule, (perRule.get(f.rule) || 0) + 1);
  let cost = 0;
  for (const [rule, count] of perRule) cost += WEIGHT[RULES[rule][0]] * Math.min(count, 2);
  return Math.max(0, Math.round(100 - cost));
}

// ---------------------------------------------------------------- files

function collect(targets) {
  const files = [];
  const missing = [];
  for (const target of targets) {
    const abs = resolvePath(target);
    let stat;
    try {
      stat = statSync(abs);
    } catch {
      missing.push(target);
      continue;
    }
    if (stat.isFile()) {
      files.push(abs);
      continue;
    }
    for (const entry of readdirSync(abs, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile()) continue;
      if (!EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
      if (entry.name.includes('node_modules')) continue;
      files.push(join(entry.parentPath || entry.path, entry.name));
    }
  }
  return { files: [...new Set(files)].sort(), missing };
}

// ---------------------------------------------------------------- output

function parseArgs(argv) {
  const opts = { json: false, minSeverity: 'P2', failUnder: 80, targets: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') opts.json = true;
    else if (arg === '--min-severity') opts.minSeverity = (argv[++i] || 'P2').toUpperCase();
    else if (arg === '--fail-under') opts.failUnder = Number(argv[++i] ?? 80);
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--version') opts.version = true;
    else opts.targets.push(arg);
  }
  if (!SEVERITY_ORDER[opts.minSeverity] && SEVERITY_ORDER[opts.minSeverity] !== 0) opts.minSeverity = 'P2';
  return opts;
}

const HELP = `de-ai-ui slop-lint v${VERSION}

  node scripts/slop-lint.mjs <files-or-dirs...> [options]

  --json                 machine-readable report
  --min-severity P0|P1|P2  hide findings below this tier (default P2)
  --fail-under <score>   exit 1 when the score is lower (default 80)
`;

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(HELP); return 0; }
  if (opts.version) { console.log(VERSION); return 0; }
  if (!opts.targets.length) {
    console.error('slop-lint: no files given\n\n' + HELP);
    return 2;
  }

  const { files, missing } = collect(opts.targets);
  if (missing.length) {
    console.error(`slop-lint: no such file or directory: ${missing.join(', ')}`);
    return 2;
  }
  if (!files.length) {
    console.error('slop-lint: no supported files found (.html .css .jsx .tsx .vue .svelte .astro)');
    return 2;
  }

  const reports = files.map((file) => {
    try {
      return analyze(file, readFileSync(file, 'utf8'));
    } catch (error) {
      return { file, error: String(error), findings: [], stats: {} };
    }
  });

  const all = reports.flatMap((r) => r.findings);
  const bySeverity = { P0: 0, P1: 0, P2: 0 };
  for (const f of all) bySeverity[f.severity] += 1;
  const score = scoreOf(all);
  const threshold = SEVERITY_ORDER[opts.minSeverity] ?? 2;
  const shown = reports.map((r) => ({
    ...r,
    findings: r.findings
      .filter((f) => SEVERITY_ORDER[f.severity] <= threshold)
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.rule.localeCompare(b.rule)),
  }));

  const summary = { files: files.length, findings: all.length, bySeverity, score, rules: new Set(all.map((f) => f.rule)).size };

  if (opts.json) {
    console.log(JSON.stringify({ tool: 'de-ai-ui/slop-lint', version: VERSION, files: shown, summary }, null, 2));
  } else {
    const cwd = process.cwd();
    for (const report of shown) {
      if (!report.findings.length) continue;
      console.log(`\n${relative(cwd, report.file) || report.file}`);
      for (const f of report.findings) {
        console.log(`  ${f.severity}  ${f.rule}  ${String(f.line).padStart(4)}:${String(f.column).padEnd(3)}  ${f.message}`);
      }
    }
    console.log(`\n${summary.findings} findings across ${summary.files} file(s) — P0 ${bySeverity.P0} / P1 ${bySeverity.P1} / P2 ${bySeverity.P2}`);
    console.log(`craft score ${score}/100   (fail under ${opts.failUnder})`);
  }

  return score < opts.failUnder || bySeverity.P0 > 0 ? 1 : 0;
}

process.exitCode = main();
