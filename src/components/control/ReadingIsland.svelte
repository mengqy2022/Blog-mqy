<script lang="ts">
import { onMount } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import { readingProgress } from "@utils/reading-progress";

let attributes: HTMLAttributes<HTMLElement> = $props();
let title = $state("");
let progress = $state(0);
let visible = $state(false);
let expanded = $state(false);
let feedback = $state("");
let copying = $state(false);
let articleCenter = $state(0);
let root: HTMLElement;
let toggle: HTMLButtonElement;
let article: HTMLElement | null = null;
let articleUrl = "";
let page = 0;
let feedbackTimer: ReturnType<typeof setTimeout>;

function close(restoreFocus = false) {
	expanded = false;
	if (restoreFocus) toggle?.focus();
}

async function copyLink() {
	const currentPage = page;
	copying = true;
	clearTimeout(feedbackTimer);
	try {
		await navigator.clipboard.writeText(articleUrl);
		if (currentPage === page) feedback = "Link copied";
	} catch {
		if (currentPage === page) feedback = "Couldn't copy. Try again.";
	} finally {
		if (currentPage === page) {
			copying = false;
			feedbackTimer = setTimeout(() => { feedback = ""; }, 2400);
		}
	}
}

function backToTop() {
	close();
	const heading = document.querySelector<HTMLElement>('#post-container [data-pagefind-meta="title"]');
	if (heading) {
		heading.tabIndex = -1;
		heading.focus({ preventScroll: true });
	}
	window.scrollTo({
		top: 0,
		behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
	});
}

function jumpToBottom() {
	close();
	const footer = Array.from(document.querySelectorAll<HTMLElement>(".footer"))
		.find((element) => element.getClientRects().length > 0);
	footer?.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
	window.scrollTo({
		top: document.documentElement.scrollHeight,
		behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
	});
}

onMount(() => {
	let frame = 0;
	let post: HTMLElement | null = null;
	const resizeObserver = new ResizeObserver(scheduleUpdate);

	function update() {
		frame = 0;
		if (!article) return;
		const rect = article.getBoundingClientRect();
		articleCenter = rect.left + rect.width / 2;
		const navbar = document.getElementById("navbar-wrapper");
		const navbarGone = !navbar || navbar.classList.contains("navbar-hidden") || navbar.getBoundingClientRect().bottom <= 0;
		progress = readingProgress(rect.top, rect.height, window.innerHeight);
		visible = navbarGone && rect.top <= 80;
		if (!visible) close();
	}

	function scheduleUpdate() {
		if (!frame) frame = requestAnimationFrame(update);
	}

	function resetPage() {
		page++;
		resizeObserver.disconnect();
		article = null;
		post = null;
		visible = false;
		expanded = false;
		feedback = "";
		copying = false;
		clearTimeout(feedbackTimer);
	}

	function readPage() {
		resetPage();
		post = document.querySelector<HTMLElement>("#post-container[data-reading-title]");
		article = post?.querySelector<HTMLElement>(".markdown-content") ?? null;
		title = post?.dataset.readingTitle ?? "";
		articleUrl = post?.dataset.readingUrl ?? "";
		if (article && post) {
			resizeObserver.observe(article);
			resizeObserver.observe(post);
		}
		scheduleUpdate();
	}

	function outsideClick(event: PointerEvent) {
		if (event.target instanceof Node && !root.contains(event.target)) close();
	}

	document.addEventListener("astro:before-swap", resetPage);
	document.addEventListener("astro:page-load", readPage);
	document.addEventListener("pointerdown", outsideClick);
	window.addEventListener("scroll", scheduleUpdate, { passive: true });
	window.addEventListener("resize", scheduleUpdate);
	readPage();
	return () => {
		resetPage();
		cancelAnimationFrame(frame);
		document.removeEventListener("astro:before-swap", resetPage);
		document.removeEventListener("astro:page-load", readPage);
		document.removeEventListener("pointerdown", outsideClick);
		window.removeEventListener("scroll", scheduleUpdate);
		window.removeEventListener("resize", scheduleUpdate);
	};
});
</script>

<svelte:window onkeydown={(event) => { if (event.key === "Escape" && expanded) close(true); }} />

<aside {...attributes} id="reading-island" bind:this={root} style:--article-center={`${articleCenter}px`} class:visible class:expanded inert={!visible} aria-label="Reading tools" data-pagefind-ignore>
    <button bind:this={toggle} class="island-toggle" aria-expanded={expanded} aria-controls="reading-island-actions"
        aria-label={`${expanded ? "Close" : "Open"} reading tools: ${title}, ${progress}% read`}
        onclick={() => { expanded = !expanded; }}>
        <span class="progress-ring" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
                <circle class="ring-track" cx="16" cy="16" r="12" />
                <circle class="ring-value" cx="16" cy="16" r="12" pathLength="100" stroke-dasharray="100" stroke-dashoffset={100 - progress} />
            </svg>
            {#if progress === 100}<span class="complete">✓</span>{:else}<span class="ring-dot"></span>{/if}
        </span>
        <span class="island-label">{feedback || title}</span>
        <span class="percentage" aria-hidden="true">{progress}%</span>
        <svg class="chevron" class:rotated={expanded} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
    </button>
    <div class="panel-wrapper" inert={!expanded}>
        <div class="panel" id="reading-island-actions">
            <div class="panel-content">
                <div class="reading-caption"><span>READING PROGRESS</span><span>{progress === 100 ? "Complete" : `${progress}%`}</span></div>
                <p class="article-title">{title}</p>
                <div class="progress-track" role="progressbar" aria-label="Reading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
                    <div style:width={`${progress}%`}></div>
                </div>
                <div class="actions">
                    <button onclick={copyLink} disabled={copying}>
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0)" /></svg>
                        {copying ? "Copying…" : "Copy link"}
                    </button>
                    <button onclick={backToTop} aria-label="Back to top">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 12 6-6 6 6m-6-6v14M5 3h14" /></svg>
                        Top
                    </button>
                    <button onclick={jumpToBottom} aria-label="Jump to bottom">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 12 6 6 6-6m-6 6V4M5 21h14" /></svg>
                        Bottom
                    </button>
                </div>
            </div>
        </div>
    </div>
</aside>
<span class="sr-only" role="status">{feedback}</span>

<style>
    aside {
        position: fixed;
        z-index: 60;
        top: calc(env(safe-area-inset-top, 0px) + 12px);
        left: 50%;
        width: min(320px, calc(100vw - 32px));
        border: 1px solid color-mix(in oklch, var(--primary) 18%, transparent);
        border-radius: 28px;
        color: var(--deep-text);
        background: var(--card-bg);
        box-shadow: 0 8px 32px -12px rgb(0 0 0 / 24%);
        opacity: 0;
        visibility: hidden;
        transform: translate(-50%, -16px) scale(.94);
        transform-origin: top center;
        transition: transform .35s cubic-bezier(.2, .8, .2, 1), opacity .2s, visibility .2s, width .4s cubic-bezier(.2, .8, .2, 1), border-radius .35s;
    }
    :global(.dark) aside { color: rgb(255 255 255 / 90%); box-shadow: 0 8px 32px -8px rgb(0 0 0 / 45%); }
    aside.visible { opacity: 1; visibility: visible; transform: translate(-50%, 0) scale(1); }
    aside.expanded { width: min(380px, calc(100vw - 32px)); border-radius: 24px; }
    button { color: inherit; font: inherit; cursor: pointer; }
    button:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; }
    .island-toggle { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 52px; padding: 8px 16px 8px 10px; border-radius: 28px; text-align: left; }
    .progress-ring { position: relative; flex-shrink: 0; width: 32px; height: 32px; color: var(--primary); }
    .progress-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); stroke-width: 2.5; }
    .ring-track { stroke: var(--btn-regular-bg); }
    .ring-value { stroke: currentColor; stroke-linecap: round; transition: stroke-dashoffset .2s; }
    .ring-dot { position: absolute; inset: 13px; border-radius: 50%; background: currentColor; }
    .complete { position: absolute; inset: 0; display: grid; place-items: center; font-size: 15px; font-weight: 700; }
    .island-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 500; }
    .percentage { color: var(--btn-content); font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .chevron { width: 16px; height: 16px; flex-shrink: 0; opacity: .5; transition: transform .25s; }
    svg path { stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .chevron.rotated { transform: rotate(180deg); }
    .panel-wrapper { display: grid; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows .35s cubic-bezier(.2, .8, .2, 1), opacity .2s; }
    .expanded .panel-wrapper { grid-template-rows: 1fr; opacity: 1; }
    .panel { min-height: 0; overflow: hidden; }
    .panel-content { padding: 4px 20px 18px; }
    .reading-caption { display: flex; justify-content: space-between; gap: 8px; font-size: 10px; font-weight: 700; letter-spacing: .1em; color: var(--btn-content); }
    .article-title { margin: 10px 0 14px; font-size: 16px; line-height: 1.45; font-weight: 700; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .progress-track { height: 4px; border-radius: 4px; overflow: hidden; background: var(--btn-regular-bg); }
    .progress-track div { height: 100%; border-radius: inherit; background: var(--primary); transition: width .2s; }
    .actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 18px; }
    .actions button { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; border-radius: 12px; background: var(--btn-regular-bg); color: var(--btn-content); font-size: 12px; font-weight: 500; transition: background .15s; }
    .actions button:hover { background: var(--btn-regular-bg-hover); }
    .actions button:active { background: var(--btn-regular-bg-active); }
    .actions button:disabled { opacity: .6; cursor: wait; }
    .actions svg { width: 17px; height: 17px; flex-shrink: 0; }
    @media (min-width: 1024px) {
        aside {
            top: calc(env(safe-area-inset-top, 0px) + 16px);
            left: clamp(300px, var(--article-center, 50vw), calc(100vw - 300px));
            width: 400px;
            border-radius: 24px;
        }
        aside.expanded { width: 560px; border-radius: 22px; }
        .island-toggle { min-height: 48px; padding: 8px 16px 8px 12px; gap: 12px; }
        .progress-ring { width: 28px; height: 28px; }
        .ring-dot { inset: 12px; }
        .panel-content { display: grid; grid-template-columns: minmax(0, 1fr) 136px; gap: 10px 24px; padding: 6px 20px 20px; }
        .reading-caption { grid-column: 1; grid-row: 1; align-self: end; }
        .article-title { grid-column: 1; grid-row: 2; margin: 0; font-size: 15px; align-self: center; }
        .progress-track { grid-column: 1; grid-row: 3; align-self: start; }
        .actions { grid-column: 2; grid-row: 1 / 4; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; }
        .actions button:first-child { grid-column: 1 / -1; }
        .actions button { gap: 5px; }
    }
    @media (prefers-reduced-motion: reduce) {
        aside, .panel-wrapper, .chevron, .ring-value, .progress-track div, .actions button { transition: none; }
    }
</style>
