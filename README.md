# Chitragatha - deploy bundle

Every file sits at one level, so this folder **is** the website root.

## Publishing on GitHub Pages

1. Create a repository (any name).
2. Upload **the contents of this folder** - not the folder itself - to the
   repository root. `index.html` must end up at the top level.
3. Repository **Settings -> Pages**.
4. Under *Build and deployment*, set **Source: Deploy from a branch**,
   branch `main`, folder `/ (root)`. Save.
5. Wait a minute, then open `https://<your-username>.github.io/<repo>/`.

`.nojekyll` is included so GitHub serves the files as they are instead of
running them through Jekyll.

## If you update the site later

The pages ask for `style.css?v=...` and `app.js?v=...` with a build stamp,
so a replaced file is always fetched fresh instead of being served from a
stale browser or CDN cache. Upload every file from the new bundle together,
HTML included, or the stamps will not match.

## Map data

`westbengal.json` holds the district outlines for the maps on the Gajan and
Patachitra pages: India district boundaries (Census 2011) by the DataMeet
India community, CC BY 4.0, simplified and redrawn as SVG for this site.
