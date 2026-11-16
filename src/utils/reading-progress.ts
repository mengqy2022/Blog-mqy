/** Progress reaches 100 when the bottom of the article enters the viewport. */
export function readingProgress(
	top: number,
	height: number,
	viewportHeight: number,
	inset = 80,
): number {
	if (height <= viewportHeight - inset) {
		return top + height <= viewportHeight ? 100 : 0;
	}
	const fraction = (inset - top) / (height - viewportHeight + inset);
	return Math.round(Math.min(1, Math.max(0, fraction)) * 100);
}
