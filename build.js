// Builds the A Grey Area site into _site/ using only Node's built-in modules.
// Run: node build.js
// Content lives in content/ (site settings, projects, index rows, information page).

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, '_site');
const CONTENT = path.join(ROOT, 'content');

// ---------- helpers ----------

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function readFrontMatter(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const data = {};
  let body = raw;
  if (m) {
    body = m[2];
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':');
      if (i === -1 || line.trim().startsWith('#')) continue;
      const key = line.slice(0, i).trim();
      let val = line.slice(i + 1).trim();
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      data[key] = val;
    }
  }
  return { data, body: body.trim() };
}

// Very small markdown: paragraphs, **bold**, *italic*, [links](url).
function md(text) {
  return String(text || '').split(/\n\s*\n/).filter((p) => p.trim()).map((p) => {
    let h = esc(p.trim()).replace(/\n/g, '<br>');
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
    h = h.replace(/\[(.+?)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2">$1</a>');
    return `<p>${h}</p>`;
  }).join('\n');
}

function list(v) {
  return String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function parseCSV(text) {
  const rows = [];
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { cells.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  const [head, ...rest] = rows;
  return rest.map((r) => Object.fromEntries(head.map((h, i) => [h.trim().toLowerCase(), r[i] || ''])));
}

function embedUrl(url) {
  if (!url) return '';
  let m = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([0-9a-f]+))?/);
  if (m) return `https://player.vimeo.com/video/${m[1]}${m[2] ? `?h=${m[2]}` : ''}`;
  m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0`;
  return '';
}

function write(rel, html) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

// ---------- load content ----------

const site = JSON.parse(fs.readFileSync(path.join(CONTENT, 'site.json'), 'utf8'));

const projects = fs.readdirSync(path.join(CONTENT, 'projects'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const { data, body } = readFrontMatter(path.join(CONTENT, 'projects', f));
    return { slug: f.replace(/\.md$/, ''), ...data, body, stills: list(data.stills), order: Number(data.order || 999) };
  })
  .filter((p) => p.published !== false)
  .sort((a, b) => a.order - b.order);

const featured = projects.filter((p) => p.featured === true);
const indexRows = parseCSV(fs.readFileSync(path.join(CONTENT, 'index.csv'), 'utf8'));
const info = readFrontMatter(path.join(CONTENT, 'information.md'));

const url = (p) => `/work/${p.slug}/`;

// ---------- shared layout ----------

function layout({ title, description, body, pagePath = '/', bodyClass = '', image }) {
  const fullTitle = title ? `${title} — ${site.name}` : `${site.name} — ${site.titleSuffix}`;
  const desc = description || site.description;
  const img = `${site.url}${image || '/media/og.jpg'}`;
  const nav = [['work', '/'], ['index', '/index/'], ['information', '/information/']]
    .map(([label, href]) => `<a href="${href}"${(href === '/' ? pagePath === '/' || pagePath.startsWith('/work/') : pagePath.startsWith(href)) ? ' aria-current="page"' : ''}>${label}</a>`)
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${site.url}${pagePath}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${site.url}${pagePath}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#252525">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<script src="/site.js" defer></script>
</head>
<body class="${bodyClass}" data-reveal="${esc(site.reveal || 'pixels')}" data-tint="${esc(site.tint || 0)}" data-flicker="${site.flicker ? 'true' : 'false'}" data-bloom="${site.bloom ? 'true' : 'false'}">
<a class="skip" href="#main">skip to content</a>
<header class="site-header">
<a class="wordmark" href="/">${esc(site.name)}</a>
<nav aria-label="Main">${nav}</nav>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer" id="contact">
<a class="cta" href="mailto:${esc(site.email)}">start a project → ${esc(site.email)}</a>
<span>${esc(site.name)} · ${esc(site.location)}</span>
</footer>
</body>
</html>
`;
}

function media(p, { cls = '', eager = false } = {}) {
  const alt = esc(p.alt || `${p.title}`);
  if (p.loop) {
    return `<video class="${cls}" src="/${esc(p.loop)}" ${p.cover ? `poster="/${esc(p.cover)}"` : ''} autoplay muted loop playsinline preload="metadata" aria-hidden="true"></video>`;
  }
  if (p.cover) {
    return `<img class="${cls}" src="/${esc(p.cover)}" alt="${alt}" ${eager ? '' : 'loading="lazy"'} decoding="async">`;
  }
  return `<div class="${cls} empty" aria-hidden="true"></div>`;
}

// ---------- pages ----------

function homePage() {
  const slots = [
    { left: 24, top: 40, w: 52, ratio: '16 / 9', z: 1, speed: 0 },
    { left: 2, top: 560, w: 34, ratio: '16 / 10', z: 2, speed: 0.18 },
    { left: 30, top: 700, w: 58, ratio: '16 / 9', z: 3, speed: -0.08 },
    { left: 4, top: 1150, w: 36, ratio: '4 / 3', z: 2, speed: 0.22 },
    { left: 20, top: 1360, w: 30, ratio: '16 / 10', z: 3, speed: 0.12 },
    { left: 62, top: 1460, w: 34, ratio: '16 / 10', z: 2, speed: 0.3 }
  ];
  const collagePool = featured.filter((p) => p.cover || p.loop);
  const order = site.collageOrder && site.collageOrder.length
    ? site.collageOrder.map((s) => projects.find((p) => p.slug === s)).filter(Boolean)
    : collagePool;
  const shots = slots.map((s, i) => {
    const p = order[i];
    if (!p) return '';
    return `<a class="shot shot-${i + 1}" href="${url(p)}" data-speed="${s.speed}" style="--l:${s.left}%;--t:${s.top}px;--w:${s.w}%;--r:${s.ratio};--z:${s.z}" aria-label="${esc(p.title)}">${media(p, { eager: i < 2 })}</a>`;
  }).join('\n');

  const tiles = featured.map((p) => `<a class="tile" href="${url(p)}">
<div class="tile-media">${media(p)}<span class="scrim" aria-hidden="true"></span><span class="tile-title">${esc(p.title)}</span></div>
</a>`).join('\n');

  const body = `<section class="collage" aria-label="Studio introduction">
${shots}
<p class="blurb blurb-1">${esc(site.blurbs[0])}</p>
<p class="blurb blurb-2">${esc(site.blurbs[1])}</p>
</section>
<section class="featured" aria-labelledby="featured-label">
<div class="section-bar"><h2 id="featured-label">featured</h2><a href="/index/">full index →</a></div>
<div class="tiles">
${tiles}
</div>
${site.standIns ? '<p class="note">Images and loops on this preview are generated stand-ins, not real project footage.</p>' : ''}
</section>`;
  write('index.html', layout({ body, pagePath: '/', bodyClass: 'home' }));
}

function projectPage(p, i) {
  const next = featured.length ? featured[(featured.findIndex((f) => f.slug === p.slug) + 1) % featured.length] : null;
  const embed = embedUrl(p.video);
  const hero = embed
    ? `<div class="hero-media"><iframe src="${esc(embed)}" title="${esc(p.title)} video" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
    : `<div class="hero-media">${media(p, { eager: true })}</div>`;
  const meta = [p.company, p.place, p.year].filter(Boolean).map(esc).join(' — ');
  const credits = [['role', p.role], ['director', p.director], ['company', p.company], ['venue', p.venue]]
    .filter(([, v]) => v)
    .map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  const stills = p.stills.length
    ? `<div class="stills">${p.stills.map((s, n) => `<img src="/${esc(s)}" alt="${esc(p.title)}, still ${n + 1}" loading="lazy" decoding="async">`).join('')}</div>`
    : '';
  const body = `<article class="project">
<header class="project-head">
<h1>${esc(p.title)}</h1>
${meta ? `<p class="meta">${meta}</p>` : ''}
</header>
${hero}
<div class="project-text">
<div class="description">${md(p.body)}</div>
${credits ? `<dl class="credits">${credits}</dl>` : ''}
</div>
${stills}
${next && next.slug !== p.slug ? `<a class="next" href="${url(next)}"><span>next project</span><strong>${esc(next.title)} →</strong></a>` : ''}
</article>`;
  write(`work/${p.slug}/index.html`, layout({
    title: p.title,
    description: p.summary || `${p.title}${p.company ? ` — ${p.company}` : ''}. ${p.role || ''}`.trim(),
    body,
    pagePath: url(p),
    image: p.cover ? `/${p.cover}` : undefined
  }));
}

function indexPage() {
  const rows = indexRows.map((r) => {
    const page = r.page && projects.find((p) => p.slug === r.page);
    const title = page ? `<a href="${url(page)}">${esc(r.project)}</a>` : esc(r.project);
    return `<tr><td class="yr">${esc(r.year)}</td><td class="pj">${title}</td><td>${esc(r.company)}</td><td>${esc(r.role)}</td><td class="mk">${page ? '→' : ''}</td></tr>`;
  }).join('\n');
  const body = `<section class="index-page">
<h1>index</h1>
<div class="table-wrap">
<table>
<thead><tr><th scope="col">year</th><th scope="col">project</th><th scope="col">company</th><th scope="col">role</th><th scope="col"><span class="sr">page</span></th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</div>
<p class="note">→ has a project page</p>
</section>`;
  write('index/index.html', layout({ title: 'index', body, pagePath: '/index/' }));
}

function informationPage() {
  const clients = list(info.data.companies).map((c) => `<li>${esc(c)}</li>`).join('');
  const services = list(info.data.services).map((c) => `<li>${esc(c)}</li>`).join('');
  const body = `<section class="info-page">
<h1>information</h1>
<div class="info-grid">
<div class="info-text">${md(info.body)}
<p class="info-cta"><a href="mailto:${esc(site.email)}">start a project → ${esc(site.email)}</a></p>
</div>
<div class="info-lists">
${services ? `<h2>services</h2><ul>${services}</ul>` : ''}
${clients ? `<h2>worked with</h2><ul>${clients}</ul>` : ''}
</div>
</div>
</section>`;
  write('information/index.html', layout({ title: 'information', body, pagePath: '/information/' }));
}

function notFound() {
  write('404.html', layout({ title: 'not found', body: `<section class="info-page"><h1>not found</h1><p>That page isn't here. <a href="/">Back to the work →</a></p></section>`, pagePath: '/404' }));
}

// ---------- run ----------

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
homePage();
projects.forEach(projectPage);
indexPage();
informationPage();
notFound();
copyDir(path.join(ROOT, 'media'), path.join(OUT, 'media'));
copyDir(path.join(ROOT, 'assets'), OUT);
console.log(`Built ${projects.length} projects, ${indexRows.length} index rows → _site/`);
