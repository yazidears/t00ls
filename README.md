# t00ls

`t00ls` is a static image playground built for GitHub Pages. It turns normal uploads into crunchy meme-ready exports by downsizing, blurring, adding noise, and scaling them back up entirely in the browser.

## Stack

- React 19 + Vite
- Tailwind CSS v4
- `shadcn/ui`
- Client-side Canvas API image processing

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run lint
```

## Deploy

Push to `main` and the included GitHub Actions workflow deploys `dist/` to GitHub Pages.

Because the Vite base is configured relatively, the site works both on the default GitHub Pages project URL and behind a custom domain later.
