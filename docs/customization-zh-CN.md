# 博客自定义与修改说明（中文）

本文档针对 **Mengqy's Blog**（基于 Fuwari 主题的 Astro 静态博客，部署在 Cloudflare，域名 `www.mqymmb.com`）编写，说明代码结构、本次已完成的自定义，以及以后日常维护的方法。

---

## 一、项目概览

| 项目 | 说明 |
| --- | --- |
| 框架 | [Astro](https://astro.build) 5（静态站点生成） |
| 主题 | Fuwari（https://github.com/saicaca/fuwari 的模板） |
| 样式 | Tailwind CSS + Stylus + CSS 变量 |
| 搜索 | Pagefind（构建时生成索引） |
| 页面切换 | Swup（无刷新跳转） |
| 代码仓库 | https://github.com/mengqy2022/Blog-mqy |
| 部署 | Cloudflare（`wrangler.jsonc` 把 `./dist` 作为静态资源） |

常用命令（在项目根目录执行）：

| 命令 | 作用 |
| --- | --- |
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 本地开发，默认 http://localhost:4321 |
| `pnpm build` | 构建生产站点到 `./dist/`（含 Pagefind 索引） |
| `pnpm preview` | 本地预览构建产物 |
| `pnpm new-post <文件名>` | 新建一篇草稿文章 |
| `pnpm check` | 类型与语法检查 |

### 关键目录结构

```
src/
├── config.ts                  ← ★ 站点所有配置都在这（标题/头像/简介/评论…）
├── types/config.ts            ← 配置的类型定义
├── content/
│   ├── config.ts              ← 文章 frontmatter 字段校验
│   ├── posts/                 ← ★ 所有文章（Markdown）放这里
│   └── spec/about.md          ← “关于”页面内容
├── components/                ← 页面组件
│   ├── widget/Profile.astro   ← 侧边栏头像+姓名+简介
│   ├── misc/Giscus.astro      ← ★ 本次新增：评论区组件
│   ├── Navbar.astro           ← 顶部导航栏
│   └── Footer.astro           ← 页脚（自动显示 profileConfig.name）
├── layouts/Layout.astro       ← 全局布局 + 全局脚本（含评论渲染逻辑）
├── pages/                     ← 路由
│   ├── [...page].astro        ← 首页（分页）
│   ├── archive.astro          ← 归档
│   ├── about.astro            ← 关于
│   └── posts/[...slug].astro  ← 文章详情页
├── i18n/                      ← 界面文案（10 种语言）
└── utils/                     ← 工具函数
astro.config.mjs               ← Astro 配置（站点 URL 等）
wrangler.jsonc                 ← Cloudflare 部署配置
```

---

## 二、本次已完成的修改

| 文件 | 改了什么 |
| --- | --- |
| `src/config.ts` | 站点标题改为 **"Mengqy's Blog"**、副标题 **"Personal Blog"**；作者名 **"Lorem Ipsum" → "Mengqy"**；头像改为 GitHub 头像；简介设为中文；删掉演示用的 Twitter/Steam 链接，只保留 GitHub（指向 https://github.com/mengqy2022）；导航栏 GitHub 链接同样指向你的主页；新增 `giscusConfig` 评论配置 |
| `src/types/config.ts` | 新增 `GiscusConfig` 类型 |
| `astro.config.mjs` | 站点 URL 从 `https://fuwari.vercel.app/` 改为 `https://www.mqymmb.com/`（影响 SEO、RSS、sitemap） |
| `src/components/misc/Giscus.astro` | ★ 新增评论组件（未配置好时自动不渲染，不影响站点） |
| `src/pages/posts/[...slug].astro` | 文章页正文下方挂载评论区 |
| `src/layouts/Layout.astro` | 新增全局脚本：评论初始渲染、Swup 每次页面切换后重新渲染评论、深浅色主题变化时同步评论主题 |
| `src/utils/setting-utils.ts` | 主题切换时派发 `theme-change` 事件（供评论同步主题用） |
| `src/content/spec/about.md` | “关于”页从 Fuwari 演示内容改为个人介绍 |

> ⚠️ **还差一步评论才能用**：见下文第六节，把 `src/config.ts` 里 `giscusConfig` 的 `repoId` 和 `categoryId` 填上（需要你到 giscus.app 获取）。

---

## 三、如何更新头像（详细）

头像显示在侧边栏（`src/components/widget/Profile.astro`），数据来自 `src/config.ts` 的 `profileConfig.avatar`。当前值是：

```ts
avatar: "https://github.com/mengqy2022.png",
```

### 方式 A：继续用网络图片（最简单）
把 URL 换成任意图片地址即可，例如你的 GitHub 头像已经自动跟着 GitHub 账号变：

```ts
avatar: "https://github.com/mengqy2022.png",
```

### 方式 B：用本地图片文件
1. 把图片放进 `src/assets/images/` 目录（例如 `my-avatar.png`）；
2. 修改配置为**相对路径（不要带 `src/` 前缀）**：

```ts
avatar: "assets/images/my-avatar.png",
```

### 方式 C：把图片放在 `public/` 目录
1. 把图片放进 `public/`（例如 `public/avatar.png`）；
2. 配置用 **`/` 开头的路径**：

```ts
avatar: "/avatar.png",
```

> 路径规则小结：以 `/` 开头 → 从 `public/` 找；以 `http` 开头 → 直接用外部链接；其余 → 从 `src/` 下找。
> 头像建议用正方形图片（≥ 256×256），显示为圆角方形。

---

## 四、如何写文章

### 1. 新建文章
```sh
pnpm new-post my-first-post
```
会在 `src/content/posts/` 生成 `my-first-post.md`，自动带上今天的日期。

### 2. 文章 frontmatter 字段（`src/content/posts/*.md` 顶部 `---` 之间）

```yaml
---
title: 文章标题
published: 2026-01-01        # 发布日期（必填）
updated: 2026-01-02          # 更新日期（可选）
description: 文章简介，用于列表和 SEO
image: ./cover.jpg           # 封面图：相对本 md 文件所在目录
tags: [教程, 生活]
category: 技术
draft: false                 # true = 草稿，正式构建时不发布
lang: zh_CN                  # 仅当与站点语言不同时填写
---
```

- 封面图路径：相对该文章所在的目录，例如文章在 `posts/guide/index.md`，封面写 `./cover.jpeg`（参考现有 `guide/cover.jpeg`）；
- 分类（category）、标签（tags）会自动出现在侧边栏和归档页；
- 每页列表显示 8 篇（`src/constants/constants.ts` 的 `PAGE_SIZE`）。

### 3. Markdown 扩展语法
- **提示框**（Admonition）：
  ```md
  :::note 标题
  内容
  :::
  ```
  还支持 `tip` / `important` / `caution` / `warning`；
- **GitHub 仓库卡片**：
  ```md
  ::github{repo="mengqy2022/Blog-mqy"}
  ```
- 数学公式（KaTeX）、代码块高亮（Expressive Code）、图片点击放大等都自带。

### 4. 删除演示文章
仓库里现有演示文章可直接删除：
```
src/content/posts/draft.md
src/content/posts/markdown.md
src/content/posts/markdown-extended.md
src/content/posts/expressive-code.md
src/content/posts/video.md
src/content/posts/guide/           （整个目录）
```

---

## 五、如何修改其他站点信息（都在 `src/config.ts`）

| 想改什么 | 位置 |
| --- | --- |
| 站点标题 / 副标题 | `siteConfig.title` / `siteConfig.subtitle`（导航栏、浏览器标签页、页脚 RSS 链接标题） |
| 界面语言（en/zh_CN/ja…） | `siteConfig.lang` |
| 作者名 | `profileConfig.name`（页脚 © 也会跟着变） |
| 个人简介 | `profileConfig.bio` |
| 社交/外链按钮 | `profileConfig.links` 数组（图标代码见 https://icones.js.org/） |
| 导航栏链接 | `navBarConfig.links`（`external: true` 会在新标签打开） |
| 主题色 | `siteConfig.themeColor.hue`（0–360 的色相值；`fixed: true` 可隐藏访客取色器） |
| 顶部横幅 | `siteConfig.banner.enable: true`，并设置 `banner.src` |
| 站点图标 favicon | `siteConfig.favicon` 数组，或直接替换 `public/favicon/` 下的图片 |
| 文章底部版权许可 | `licenseConfig` |
| 代码块主题 | `expressiveCodeConfig.theme` |

> 界面文案（“首页/归档/关于”等按钮文字）在 `src/i18n/languages/*.ts`，由 `siteConfig.lang` 决定用哪套。

---

## 六、评论功能（Giscus）启用步骤 ⭐

评论采用 **Giscus**：评论数据存放在你的 GitHub 仓库的 **Discussions** 里，无需自建服务器。代码已经写好，只差最后两步“填 ID”。

### 前提（一次性配置）
1. **仓库必须公开**：GitHub 仓库 → Settings → 最底部 Danger Zone → *Change repository visibility* → **Public**；
2. **开启 Discussions**：Settings → General → Features → 勾选 **Discussions**；
3. **安装 Giscus App**：打开 https://giscus.app ，在 Repository 一栏输入 `mengqy2022/Blog-mqy`，按提示点击 *Install the giscus app* 并授权（如果仓库公开且 Discussions 已开启，这步很快）。

### 获取两个 ID
4. 在 https://giscus.app 页面上：
   - 选一个分类（Category），例如 `Announcements`，或新建一个 `Comments` 分类；
   - 页面下方会自动生成一段 `<script>` 代码，其中：
     - `data-repo-id="..."` 的值 → **repoId**
     - `data-category-id="..."` 的值 → **categoryId**
5. 把两个值填进 `src/config.ts` 的 `giscusConfig`：

```ts
export const giscusConfig: GiscusConfig = {
	enable: true,
	repo: "mengqy2022/Blog-mqy",
	repoId: "R_kgDOxxxxxxxxxx",   // ← 填 giscus.app 给的 data-repo-id
	category: "Announcements",
	categoryId: "DIC_kwDOxxxxxxxx", // ← 填 giscus.app 给的 data-category-id
	mapping: "pathname",
	reactionsEnabled: true,
	inputPosition: "bottom",
	lang: "en",
	theme: "light",
};
```

6. 提交并推送代码（`git add . && git commit -m "enable giscus" && git push`），等 Cloudflare 重新构建部署完成后，文章页就会出现评论区。

### 说明与注意
- **未填 ID 之前**：评论组件自动不渲染，站点一切正常，不会报错；
- 每篇文章按 URL 路径（`mapping: "pathname"`）对应一个独立 Discussion 话题；
- 评论主题会自动跟随你站点的浅色/深色模式切换；
- 评论数据属于 GitHub Discussions——删除仓库会连评论一起删掉；
- 其他可选项：`reactionsEnabled`（表情回应）、`inputPosition`（输入框位置）、`lang`（评论界面语言，可填 `zh-CN`）、`theme`（基础主题）。

---

## 七、发布 / 部署流程

1. 本地验证：`pnpm build`（成功会生成 `dist/`）→ `pnpm preview` 预览；
2. 提交推送：
   ```sh
   git add .
   git commit -m "描述这次改动"
   git push origin main
   ```
3. Cloudflare 检测到推送后会自动构建并部署（你已连接好，无需额外操作）；
4. 仓库里的 `.github/workflows/build.yml` 只做 `astro check` 和 `astro build` 检查，不影响部署。

---

## 八、常见问题

- **头像不显示**：确认 URL 能直接访问；本地图片请按第三节的路径规则放置。
- **评论不显示**：① `repoId`/`categoryId` 是否已填；② 仓库是否公开；③ Discussions 是否开启；④ giscus App 是否安装；⑤ 部署是否已完成（等 1–2 分钟刷新）。
- **评论一直转圈**：多半是 giscus App 未安装到该仓库。
- **本地图片 404**：`src/assets/images/` 下的图片，配置路径不能带 `src/` 前缀；`public/` 下的图片必须用 `/` 开头。
- **改了配置不生效**：改完要重新构建部署；本地开发时 `pnpm dev` 会自动热更新。
- **想把界面改成中文**：`siteConfig.lang` 改为 `"zh_CN"`（界面文案已内置中文翻译）。
