"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Store the theme choice. "system" clears it and follows the device again. */
export async function setThemeAction(theme: Theme): Promise<void> {
  const jar = await cookies();

  if (theme === "system") {
    jar.delete(THEME_COOKIE);
  } else {
    jar.set(THEME_COOKIE, theme, {
      path: "/",
      maxAge: ONE_YEAR,
      sameSite: "lax",
      httpOnly: false,
    });
  }

  revalidatePath("/", "layout");
}
