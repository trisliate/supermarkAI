import { useEffect } from "react";
import { toast } from "sonner";

export interface FlashMessage {
  type: "success" | "error" | "info";
  message: string;
}

export function useFlashToast() {
  useEffect(() => {
    const cookies = document.cookie.split(";").map((c) => c.trim());
    const flashCookie = cookies.find((c) => c.startsWith("flash-message="));
    if (!flashCookie) return;

    try {
      const value = decodeURIComponent(flashCookie.split("=").slice(1).join("="));
      const flash: FlashMessage = JSON.parse(value);

      // Small delay to ensure toast renders after page mount
      setTimeout(() => {
        if (flash.type === "success") toast.success(flash.message);
        else if (flash.type === "error") toast.error(flash.message);
        else toast.info(flash.message);
      }, 100);

      // Clear the cookie
      document.cookie = "flash-message=; Path=/; Max-Age=0; SameSite=Lax";
    } catch {
      // Invalid flash cookie, clear it
      document.cookie = "flash-message=; Path=/; Max-Age=0; SameSite=Lax";
    }
  }, []);
}
