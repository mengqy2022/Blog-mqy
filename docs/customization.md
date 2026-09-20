# Blog Customization Guide (English)

This document is written for **Mengqy's Blog** (an Astro static blog based on the Fuwari theme, deployed on Cloudflare at `www.mqymmb.com`). It explains the code structure, the customization already applied, and how to maintain the site day to day.

---

## 1. Project Overview

| Item | Description |
| --- | --- |
| Framework | [Astro](https://astro.build) 5 (static site generator) |
| Theme | Fuwari (template from https://github.com/saicaca/fuwari) |
| Styling | Tailwind CSS + Stylus + CSS variables |
| Search | Pagefind (index built at build time) |
| Page transitions | Swup (no-reload navigation) |
| Repository | https://github.com/mengqy2022/Blog-mqy |
| Deployment | Cloudflare (`wrangler.jsonc` serves `./dist` as static assets) |

Common commands (run from the project root):

| Command | What it does |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Local dev server, default http://localhost:4321 |
| `pnpm build` | Build the production site into `./dist/` (includes the Pagefind index) |
| `pnpm preview` | Preview the built site locally |
| `pnpm new-post <filename>` | Create a new draft post |
| `pnpm check` | Type & syntax check |

### Key directory structure

```
src/
├── config.ts                  ← ★ ALL site settings live here (title/avatar/bio/comments…)
├── types/config.ts            ← Type definitions for the config
├── content/
│   ├── config.ts              ← Frontmatter schema validation for posts
│   ├── posts/                 ← ★ All posts (Markdown) go here
│   └── spec/about.md          ← Content of the "About" page
├── components/                ← UI components
│   ├── widget/Profile.astro   ← Sidebar avatar + name + bio
│   ├── misc/Giscus.astro      ← ★ Comment section component (added)
│   ├── Navbar.astro           ← Top navigation bar
│   └── Footer.astro           ← Footer (automatically shows profileConfig.name)
├── layouts/Layout.astro       ← Global layout + global scripts (incl. comment rendering)
├── pages/                     ← Routes
│   ├── [...page].astro        ← Home page (paginated)
│   ├── archive.astro          ← Archive
│   ├── about.astro            ← About
│   └── posts/[...slug].astro  ← Post detail page
├── i18n/                      ← UI strings (10 languages)
└── utils/                     ← Helper functions
astro.config.mjs               ← Astro config (site URL, plugins, etc.)
wrangler.jsonc                 ← Cloudflare deployment config
```

---

## 2. Changes Already Applied

| File | What was changed |
| --- | --- |
| `src/config.ts` | Site title → **"Mengqy's Blog"**, subtitle → **"Personal Blog"**; author name **"Lorem Ipsum" → "Mengqy"**; avatar → local `assets/images/avatar.jpg`; bio in English; removed the demo Twitter/Steam links, kept only GitHub (pointing to https://github.com/mengqy2022); navbar GitHub link updated as well; added the `giscusConfig` comment settings |
| `src/types/config.ts` | Added the `GiscusConfig` type |
| `astro.config.mjs` | Site URL changed from `https://fuwari.vercel.app/` to `https://www.mqymmb.com/` (affects SEO, RSS, sitemap) |
| `src/components/misc/Giscus.astro` | ★ New comment section component (auto-hides when not configured, never breaks the site) |
| `src/pages/posts/[...slug].astro` | Comment section mounted below the post body |
| `src/layouts/Layout.astro` | Global script: initial comment render, re-render on every Swup page transition, theme handling |
| `src/utils/setting-utils.ts` | Dispatches a `theme-change` event on theme switch (used by comments) |
| `src/content/spec/about.md` | About page rewritten from the Fuwari demo into a personal introduction, with a GitHub repo card for `mengqy2022/Blog-mqy` |
| `src/content/posts/bioinformatics-blog.md` | ★ New post introducing the old bioinformatics blog with a link to https://mengqy2022.github.io/ |
| `docs/customization.md` | This guide |

---

## 3. How to Update the Avatar

The avatar is shown in the sidebar (`src/components/widget/Profile.astro`) and its value comes from `profileConfig.avatar` in `src/config.ts`. The current value is:

```ts
avatar: "assets/images/avatar.jpg",
```

### Option A: Use a network image
Replace the value with any image URL, e.g. your GitHub avatar (it follows your GitHub account automatically):

```ts
avatar: "https://github.com/mengqy2022.png",
```

### Option B: Use a local image file
1. Put the image into `src/assets/images/` (e.g. `my-avatar.png`);
2. Set the config to a **relative path (without the `src/` prefix)**:

```ts
avatar: "assets/images/my-avatar.png",
```

### Option C: Put the image in the `public/` directory
1. Put the image into `public/` (e.g. `public/avatar.png`);
2. Set the config to a **`/`-prefixed path**:

```ts
avatar: "/avatar.png",
```

> Path rules: starts with `/` → looked up in `public/`; starts with `http` → used as an external link; anything else → looked up under `src/`.
> A square image (≥ 256×256) is recommended; it is displayed as a rounded square.

---

## 4. How to Write Posts

### 1. Create a new post
```sh
pnpm new-post my-first-post
```
This creates `src/content/posts/my-first-post.md` with today's date filled in.

### 2. Frontmatter fields (between the `---` lines at the top of `src/content/posts/*.md`)

```yaml
---
title: Post title
published: 2026-01-01        # Publication date (required)
updated: 2026-01-02          # Update date (optional)
description: Short summary for lists and SEO
image: ./cover.jpg           # Cover image: relative to the post's own directory
tags: [Tutorial, Life]
category: Tech
draft: false                 # true = draft, not published in production builds
lang: zh_CN                  # Only needed when the post language differs from the site language
---
```

- Cover image path: relative to the post's directory, e.g. `posts/guide/index.md` uses `./cover.jpeg` (see the existing `guide/cover.jpeg`);
- Categories and tags automatically appear in the sidebar and the archive page;
- The home page shows 8 posts per page (`PAGE_SIZE` in `src/constants/constants.ts`).

### 3. Extended Markdown syntax
- **Admonitions**:
  ```md
  :::note Title
  Content
  :::
  ```
  Also supports `tip` / `important` / `caution` / `warning`;
- **GitHub repository card**:
  ```md
  ::github{repo="mengqy2022/Blog-mqy"}
  ```
- Math formulas (KaTeX), syntax-highlighted code blocks (Expressive Code), click-to-zoom images, etc. are all built in.

### 4. Removing the demo posts
The demo posts shipped with the template can simply be deleted:
```
src/content/posts/draft.md
src/content/posts/markdown.md
src/content/posts/markdown-extended.md
src/content/posts/expressive-code.md
src/content/posts/video.md
src/content/posts/guide/           (whole directory)
```

---

## 5. Other Site Settings (all in `src/config.ts`)

| What to change | Where |
| --- | --- |
| Site title / subtitle | `siteConfig.title` / `siteConfig.subtitle` (navbar, browser tab, RSS title) |
| Interface language (en/zh_CN/ja…) | `siteConfig.lang` |
| Author name | `profileConfig.name` (the footer © also follows) |
| Bio | `profileConfig.bio` |
| Social / external links | the `profileConfig.links` array (icons at https://icones.js.org/) |
| Navbar links | `navBarConfig.links` (`external: true` opens in a new tab) |
| Theme color | `siteConfig.themeColor.hue` (hue 0–360; `fixed: true` hides the visitor color picker) |
| Top banner | set `siteConfig.banner.enable: true` and configure `banner.src` |
| Favicon | the `siteConfig.favicon` array, or replace the images in `public/favicon/` |
| Post license at the bottom | `licenseConfig` |
| Code block theme | `expressiveCodeConfig.theme` |

> The UI strings ("Home/Archive/About", etc.) live in `src/i18n/languages/*.ts` and are selected by `siteConfig.lang`.

---

## 6. Comments (Giscus) — Already Configured ✅

Comments use **Giscus**: comment data is stored in the **Discussions** of your GitHub repository — no server needed.
**The `giscusConfig` in `src/config.ts` already contains real IDs and comments are enabled**, as long as your repository stays **public**, has **Discussions** enabled, and the **Giscus App** is installed (one-time setup, see below).

### One-time prerequisites (just confirm these)
1. **Repository must be public**: GitHub repo → Settings → scroll to the bottom → Danger Zone → *Change repository visibility* → **Public**;
2. **Enable Discussions**: Settings → General → Features → check **Discussions**;
3. **Install the Giscus App**: open https://giscus.app , enter `mengqy2022/Blog-mqy` in the Repository field, and follow the prompt to install/authorize the app.

### Current configuration (`src/config.ts`)

```ts
export const giscusConfig: GiscusConfig = {
	enable: true,
	repo: "mengqy2022/Blog-mqy",
	repoId: "R_kgDOUeaXXQ",
	category: "General",
	categoryId: "DIC_kwDOUeaXXc4DF_4o",
	mapping: "pathname",
	reactionsEnabled: true,
	inputPosition: "bottom",
	lang: "en",
	theme: "preferred_color_scheme", // follows the OS scheme; can also be 'light' / 'dark'
};
```

### Notes
- Each post maps to its own Discussion by URL path (`mapping: "pathname"`);
- The comment widget follows the OS color scheme (`preferred_color_scheme`);
- Comment data belongs to GitHub Discussions — deleting the repository deletes the comments too;
- Other options: `reactionsEnabled` (emoji reactions), `inputPosition` (input box position), `lang` (comment UI language, e.g. `en`, `zh-CN`), `theme` (base theme).

---

## 7. Publishing / Deployment

1. Verify locally: `pnpm build` (a successful build produces `dist/`) → `pnpm preview`;
2. Commit and push:
   ```sh
   git add .
   git commit -m "describe your changes"
   git push origin main
   ```
3. Cloudflare detects the push and rebuilds/deploys automatically (already connected, nothing else to do);
4. `.github/workflows/build.yml` in the repo only runs `astro check` and `astro build` — it does not deploy.

---

## 8. FAQ

- **Avatar not showing**: make sure the URL is reachable; for local images, follow the path rules in section 3.
- **Comments not showing**: ① are `repoId`/`categoryId` filled in? ② is the repo public? ③ is Discussions enabled? ④ is the Giscus App installed? ⑤ has the deployment finished? (wait 1–2 minutes and refresh).
- **Comments stuck loading**: usually the Giscus App is not installed on the repository.
- **Local image 404**: images under `src/assets/images/` must use a path without the `src/` prefix; images under `public/` must start with `/`.
- **Changes not taking effect**: rebuild and redeploy; `pnpm dev` hot-reloads during development.
- **Want a Chinese interface**: set `siteConfig.lang` to `"zh_CN"` (Chinese translations are built in).
