import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Fetcher } from "react-router";

/**
 * Watches a fetcher and shows a toast when the action completes.
 * Pass the expected success message. If the fetcher returns { error: string }, shows error toast instead.
 */
export function useFetcherToast(
  fetcher: Fetcher,
  successMessage: string,
  deps?: unknown[]
) {
  const prevIdle = useRef(true);

  useEffect(() => {
    // Detect transition from non-idle to idle (action completed)
    if (fetcher.state === "idle" && !prevIdle.current) {
      const data = fetcher.data as { error?: string; ok?: boolean } | undefined;
      if (data?.error) {
        toast.error(data.error);
      } else if (data?.ok !== false) {
        toast.success(successMessage);
      }
    }
    prevIdle.current = fetcher.state !== "idle";
  }, [fetcher.state, fetcher.data, successMessage]);
}

// Alias for simpler usage
export { useFetcherToast as useActionToast };
