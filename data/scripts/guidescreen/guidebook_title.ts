// Guidebook title protocol shared by every screen in guidescreen/.
//
// The RP renders guide forms inside a book shell (packs/RP/ui/server_form.json
// + packs/RP/ui/forms/guidebook/guidebook.json) whenever the form title
// contains GUIDEBOOK_TITLE_MARK. The marker is a reset code followed by two
// color codes, so it renders as nothing: with the RP active the book shows,
// without it the vanilla form shows the plain title. Always build guide
// titles with guideTitle() so new screens are routed automatically.
export const GUIDEBOOK_TITLE_MARK = "§r§0§7";

export function guideTitle(title: string): string {
	return `${title}${GUIDEBOOK_TITLE_MARK}`;
}
