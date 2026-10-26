# Chitragāthā — deploy bundle

Every file sits at one level, so this folder **is** the website root.

## Publishing on GitHub Pages

1. Create a repository (any name).
2. Upload **the contents of this folder** — not the folder itself — to the
   repository root. `index.html` must end up at the top level.
3. Repository **Settings → Pages**.
4. Under *Build and deployment*, set **Source: Deploy from a branch**,
   branch `main`, folder `/ (root)`. Save.
5. Wait a minute, then open `https://<your-username>.github.io/<repo>/`.

`.nojekyll` is included so GitHub serves the files as they are instead of
running them through Jekyll.

## Notes

- No build step, no dependencies, no server code. Plain static files.
- AR/VR needs HTTPS, which GitHub Pages provides automatically.
- Leave the filenames as they are: the pages, the stylesheet and the
  three.js module graph all reference each other by these exact names.
