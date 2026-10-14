# a grey area — agreyarea.co

The website for A Grey Area. Netlify builds it automatically from this repository whenever something changes here.

## Where things live

| What | Where |
| --- | --- |
| Site name, email, landing blurbs | `content/site.json` |
| Featured projects (one file each) | `content/projects/*.md` |
| Every show, for the Index page | `content/index.csv` |
| Information page text, services, companies | `content/information.md` |
| Images and loops | `media/<project-name>/` |
| Look and layout | `assets/styles.css` |

## Adding a show

**Index only:** add one line to `content/index.csv` — `year,project,company,role,` (leave the last column empty).

**Featured with its own page:**

1. Put its images and loop in a new folder, e.g. `media/new-show/` (`cover.jpg`, `loop.mp4`, `1.jpg`, `2.jpg`…).
2. Copy any file in `content/projects/`, rename it `new-show.md`, and change the details at the top. `featured: true` puts it on the homepage; `order` sets its position. Paste the Vimeo or YouTube link after `video:`.
3. Add its row to `content/index.csv` with `new-show` in the last column so the Index links to it.

Or send Claude: *"New show for the A Grey Area site: [title], [company], [year], [role]. Index only / featured. Assets are in Drive folder: [link]."*

## Before launch

Set `"standIns": false` in `content/site.json` once real images replace the generated stand-ins.

## Building locally (optional)

Needs Node 18 or newer, no other installs: `node build.js`, then open `_site/index.html` through any local web server.
