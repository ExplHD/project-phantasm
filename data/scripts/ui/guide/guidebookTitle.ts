export const GUIDEBOOK_TITLE_MARK = "§r§0§7";

export function guideTitle(title: string): string {
	return `${title}${GUIDEBOOK_TITLE_MARK}`;
}
