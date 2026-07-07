# From Oral Tradition to Digital Archive
### Audio-Visual Storytelling & Cultural Memory in Paschim Medinipur

A single-page prototype website documenting the Gajan ritual and Patachitra scroll-painting
research by **Disha Pramanik** and **Simanta Nandi** (IIT (ISM) Dhanbad, Digital Humanities &
Social Sciences).

Everything lives in one self-contained file, **`index.html`** — HTML, CSS and JavaScript
together, plus a Google Fonts link and an embedded Google Maps iframe. There is nothing to
build or install.

---

## Host it on GitHub Pages (2 minutes)

1. **Create a repository**
   - Go to [github.com/new](https://github.com/new)
   - Name it anything, e.g. `paschim-medinipur-archive`
   - Keep it **Public** (required for free GitHub Pages)
   - Click **Create repository**

2. **Upload the file**
   - On the new repo page, click **"uploading an existing file"**
   - Drag in `index.html` from this folder
   - Scroll down, click **Commit changes**

3. **Turn on Pages**
   - Go to the repo's **Settings** tab → **Pages** (left sidebar)
   - Under "Build and deployment" → **Source**, choose **Deploy from a branch**
   - Branch: `main` (or `master`), folder: `/ (root)` → **Save**

4. **Wait ~1 minute**, then refresh that Pages settings screen. GitHub will show your live URL:
   ```
   https://<your-username>.github.io/<repo-name>/
   ```

That's it — no build step, no dependencies, no server.

### Updating the site later
Edit `index.html` directly on GitHub (pencil icon) or push changes via `git`:
```bash
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
# edit index.html
git add index.html
git commit -m "Update site"
git push
```
GitHub Pages redeploys automatically within a minute of every push.

---

## What's inside the page

| Section | Content |
|---|---|
| Gate | A playful "honesty check" instead of a generic CAPTCHA |
| Hero | An animated unfurling-scroll title sequence (the *pata khelano* gesture, in CSS) |
| Abstract | The project's framing thesis and keywords |
| Traditions | Tabbed comparison of Patachitra (with natural pigment swatches) and Gajan (ritual timeline) |
| Field Sites | Embedded map of Naya village, Pingla Block (OpenStreetMap, no API key needed) |
| Patar Gaan | Three field-recorded song excerpts with translation |
| Method | The ethnographic interview structure (Sections A–G) and field participant summaries |
| Theory | The four scholarly frameworks behind "co-archivist" practice |
| Ethics | The Endings Project's three questions *and* its five sustainability pillars, plus this site's licence, open-access stance and version stamp |
| **Digital Footprint** | A filterable directory of ~27 real links showing where Patachitra already circulates online — government pages, artist profiles, the art market, social/video, press, and heritage portals |
| Working Bibliography | Expanded Chicago-style reading list — now including several papers located and verified during this revision (Chakraborty 2019, Datta Gupta 2011, Ferrari 2005, Das Gupta 2022, and others) |
| **Reading Room** | Broader digital-humanities, GIS, digital-storytelling and audio-visual-archiving scholarship, in two tabs |
| Living Models | Comparable real-world platforms — Bengal Patachitra, Sahapedia, SAADA, Mukurtu, Pad.ma, Indian Memory Project, 1947 Partition Archive |
| **Cite This Project** | APA / MLA / Chicago / BibTeX citations with one-click copy |
| Team | Researcher bio-notes |

### A note on this revision
This version replaced the earlier Bichitra (Tagore Variorum) reference in Living Models with Pad.ma, the Indian Memory Project and the 1947 Partition Archive — all closer precedents for an *audio-visual, community-submitted* archive than a text-variorum project. It also verified and corrected several citations against original sources (e.g. Zanatta & Gera Roy's actual names, Ferrari's actual journal, the exact Chitrolekha and JETIR paper titles) rather than leaving them as bare pasted links.

## Notes on content & sourcing
- Field data (interview structure, participant summaries, pigment table, song excerpts) is
  drawn directly from the researchers' own fieldwork documents.
- External facts about comparator platforms and scholarly frameworks are paraphrased summaries,
  with links out to the original sources rather than reproduced text — check those sources
  directly before citing them in academic writing.
- The Working Bibliography and Reading Room were checked against live sources during this
  revision. Entries marked <span style="font-family:monospace">unconfirmed / verify</span> in
  small tags are real, locatable records whose exact title, author, or venue could not be fully
  confirmed — they are flagged rather than guessed at. Everything else has been matched to an
  actual paper, page, or platform.
- The two ScienceDirect links originally supplied as temporary, token-expiring download URLs
  (`X-Amz-Expires=300`, i.e. five minutes) have been replaced with their stable, permanent
  `sciencedirect.com/.../pii/...` record pages, which will still resolve after this file is
  hosted. Always prefer a canonical link over a signed/expiring one in a document meant to last.
- No third-party photographs are included, to keep the file dependency-free and avoid licensing
  issues — the visual language is built entirely from CSS/SVG using a palette drawn from the
  patachitra natural pigments (turmeric, lac red, indigo, leaf green, soot, conch white). The
  Digital Footprint section links to (rather than embeds) image-heavy sources like Getty Images
  and Alamy for the same reason.
- This prototype is offered under CC BY-NC-SA 4.0 (see the Ethics section and footer) — change
  this if the researchers' institution or journal requires a different licence.

## Customising
- **Colours & fonts** are CSS custom properties at the top of the `<style>` block in `index.html`
  (see the `:root` selector) — change hex values there to retheme the whole site.
- **Text content** can be edited directly in the HTML; each section is clearly commented.
- To add real photographs, drop image files into an `images/` folder next to `index.html` and
  reference them with relative paths, e.g. `<img src="images/naya-village.jpg" alt="...">`.

---
Built as a digital humanities research artifact, 2026.
