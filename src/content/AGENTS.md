# Blog Article Rules

Apply these rules to every Markdown article under `src/content/posts/`, including articles inside subdirectories. Read this file before creating or editing an article.

## Frontmatter

Start each article with one YAML frontmatter block. Keep fields in this order:

```yaml
---
title: "A clear article title"
published: 2026-11-20
updated: 2026-11-20
description: "One concise sentence describing the article."
image: "./cover.webp"
tags: ["Example", "Topic"]
category: "Example"
draft: false
lang: en
---
```

- `title`, `published`, `description`, `image`, `tags`, `category`, `draft`, and `lang` use this order. Put `updated` after `published` only when the article has a real revision date.
- Use an ISO date (`YYYY-MM-DD`) for dates. Preserve original publication dates when editing an existing article. Change `updated` only for a substantive revision, not formatting-only cleanup.
- Quote the title and description with YAML double quotes. Escape embedded double quotes as `\"`.
- Use `image: ""` when there is no cover. Store article images beside the article and use a `./filename.ext` path. A root-relative path is for files in `public/`.
- Use a YAML list of quoted strings for tags. Reuse established category names and write `category: ""` when uncategorized.
- Set `draft: true` until an article is ready to publish. Match `lang` to the article's primary language (`en` or `zh_CN`).

## Article structure

- Start the body with a short opening paragraph that explains the subject and why it matters. Add a visible introduction heading only when it helps the reader navigate.
- Use `##` for main sections, `###` for subsections, and `####` only for a genuinely nested topic. The frontmatter supplies the article title, so body headings start at `##`.
- Choose headings that describe their section. Number headings only when the sequence itself matters, such as reproducible procedure steps.
- Order sections for the reader's task. Project articles commonly introduce the result, explain design and implementation, show evidence or usage, and close with limitations or next steps. Tutorials and reference articles can use the sequence their task requires.
- Keep paragraphs focused. Use lists for parallel items, numbered lists for ordered steps, and Markdown tables for compact comparisons.
- Remove repeated introductions, empty sections, filler conclusions, and formatting that adds no information. Preserve the author's meaning, voice, verified facts, dates, attribution, license, and explicit limits.

## Media and code

- Put images on their own line. Write descriptive alt text and add a short italic caption only when the image needs provenance, revision context, or extra explanation.
- Use fenced code blocks with the correct language identifier (`text` for diagrams or literal output). Keep command examples copyable and label required placeholders.
- Keep code block indentation and content unchanged when a demo teaches whitespace, syntax, markers, or exact output.
- Use the repository's supported Markdown extensions only when they fit the content. Examples include `:::note`, `:::tip`, `:::important`, `:::warning`, `:::caution`, `:spoiler[...]`, and `::github{repo="owner/name"}`.
- Use blank lines around headings, paragraphs, lists, tables, images, code blocks, and directives. End the file with one newline.

## Before finishing

- Check frontmatter against `src/content/config.ts`, confirm image paths and external links, and preview the Markdown when a change affects rendering.
- Preserve code samples and technical claims unless the source provides enough evidence to correct them. Mark unverified measurements, simulations, and prototype results accurately.
- For drafts, confirm `draft: true`. For published updates, keep the `updated` date accurate.
