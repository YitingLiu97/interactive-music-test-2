# Spatial Music Lab app

The main [project README](../README.md) covers the live demo, interaction guide, architecture, content schema, and credits.

From this directory:

```bash
npm ci
npm run dev
npm run build
```

The Next.js app serves prepared mixes from `public/content/<slug>/`. Its home route uses the `justintest` composition; `/<slug>` loads another composition through the content API.
