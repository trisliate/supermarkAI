// Cookie-based flash messages for showing toasts after redirects

import { redirect } from "react-router";

const FLASH_COOKIE = "flash-message";
const FLASH_MAX_AGE = 10; // seconds

export interface FlashMessage {
  type: "success" | "error" | "info";
  message: string;
}

export function flashRedirect(url: string, message: FlashMessage): Response {
  return redirect(url, {
    headers: {
      "Set-Cookie": `${FLASH_COOKIE}=${encodeURIComponent(JSON.stringify(message))}; Path=/; Max-Age=${FLASH_MAX_AGE}; SameSite=Lax`,
    },
  });
}
