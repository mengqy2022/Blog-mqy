import type {
	ExpressiveCodeConfig,
	GiscusConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
	title: "Mengqy's Blog",
	subtitle: "Personal Blog",
	lang: "en", // Language code, e.g. 'en', 'zh_CN', 'ja', etc.
	themeColor: {
		hue: 250, // Default hue for the theme color, from 0 to 360. e.g. red: 0, teal: 200, cyan: 250, pink: 345
		fixed: false, // Hide the theme color picker for visitors
	},
	banner: {
		enable: false,
		src: "assets/images/demo-banner.png", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
		position: "center", // Equivalent to object-position, only supports 'top', 'center', 'bottom'. 'center' by default
		credit: {
			enable: false, // Display the credit text of the banner image
			text: "", // Credit text to be displayed
			url: "", // (Optional) URL link to the original artwork or artist's page
		},
	},
	toc: {
		enable: true, // Display the table of contents on the right side of the post
		depth: 2, // Maximum heading depth to show in the table, from 1 to 3
	},
	favicon: [
		// Leave this array empty to use the default favicon
		// {
		//   src: '/favicon/icon.png',    // Path of the favicon, relative to the /public directory
		//   theme: 'light',              // (Optional) Either 'light' or 'dark', set only if you have different favicons for light and dark mode
		//   sizes: '32x32',              // (Optional) Size of the favicon, set only if you have favicons of different sizes
		// }
	],
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		LinkPreset.About,
		{
			name: "GitHub",
			url: "https://github.com/mengqy2022", // Internal links should not include the base path, as it is automatically added
			external: true, // Show an external link icon and will open in a new tab
		},
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "https://github.com/mengqy2022.png", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
	name: "Mengqy",
	bio: "记录学习与生活的个人博客",
	links: [
		{
			name: "GitHub",
			icon: "fa6-brands:github", // Visit https://icones.js.org/ for icon codes
			// You will need to install the corresponding icon set if it's not already included
			// `pnpm add @iconify-json/<icon-set-name>`
			url: "https://github.com/mengqy2022",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// Note: Some styles (such as background color) are being overridden, see the astro.config.mjs file.
	// Please select a dark theme, as this blog theme currently only supports dark background color
	theme: "github-dark",
};

export const giscusConfig: GiscusConfig = {
	enable: true,
	// Your GitHub repository. It must be PUBLIC and have the Discussions feature enabled,
	// and the Giscus app (https://github.com/apps/giscus) must be installed on it.
	repo: "mengqy2022/Blog-mqy",
	// !!! IMPORTANT !!!
	// repoId and categoryId are NOT your GitHub username/numbers.
	// Get them from https://giscus.app -> enter your repository -> copy the values
	// shown in the generated "data-repo-id" and "data-category-id" attributes.
	// The comment section is hidden until both are filled in.
	repoId: "",
	category: "Announcements", // The Discussions category used for comments (must exist in your repo)
	categoryId: "",
	mapping: "pathname", // How to map a page to a discussion: 'pathname' | 'url' | 'title' | 'og:title'
	reactionsEnabled: true, // Allow emoji reactions on comments
	inputPosition: "bottom", // Position of the comment input box: 'top' | 'bottom'
	lang: "en", // UI language of the comment widget, e.g. 'en', 'zh-CN'
	theme: "light", // Base theme; it is automatically synced with the site's light/dark mode
};
