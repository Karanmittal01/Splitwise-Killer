import { cookies } from "next/headers";

export type Theme = "light" | "dark" | "system";

export const THEME_COOKIE = "theme";

/**
 * The chosen theme, read on the server so the right palette is in the HTML
 * from the first byte — no flash of the wrong colours on load.
 */
export async function getTheme(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return value === "light" || value === "dark" ? value : "system";
}
