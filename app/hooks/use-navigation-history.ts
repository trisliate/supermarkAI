import { useEffect, useRef, useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router";

const MAX_HISTORY = 50;

export function useNavigationHistory() {
  const location = useLocation();
  const navigate = useNavigate();
  const historyRef = useRef<string[]>([]);
  const indexRef = useRef<number>(-1);
  const navigatingRef = useRef(false);
  const [canBack, setCanBack] = useState(false);
  const [canForward, setCanForward] = useState(false);

  const updateButtons = useCallback(() => {
    setCanBack(indexRef.current > 0);
    setCanForward(indexRef.current < historyRef.current.length - 1);
  }, []);

  // Track location changes (only when not navigating via back/forward)
  useEffect(() => {
    if (navigatingRef.current) {
      navigatingRef.current = false;
      return;
    }

    const path = location.pathname + location.search;
    const history = historyRef.current;
    const idx = indexRef.current;

    // If we're at a position and navigate to a different path, truncate forward history
    if (idx >= 0 && idx < history.length - 1) {
      historyRef.current = history.slice(0, idx + 1);
    }

    // Don't push duplicate of current position
    const currentHistory = historyRef.current;
    if (currentHistory.length === 0 || currentHistory[currentHistory.length - 1] !== path) {
      currentHistory.push(path);
      if (currentHistory.length > MAX_HISTORY) {
        currentHistory.shift();
      }
    }

    indexRef.current = currentHistory.length - 1;
    updateButtons();
  }, [location.pathname, location.search, updateButtons]);

  const goBack = useCallback(() => {
    if (indexRef.current <= 0) return;
    indexRef.current--;
    navigatingRef.current = true;
    navigate(historyRef.current[indexRef.current]);
    updateButtons();
  }, [navigate, updateButtons]);

  const goForward = useCallback(() => {
    if (indexRef.current >= historyRef.current.length - 1) return;
    indexRef.current++;
    navigatingRef.current = true;
    navigate(historyRef.current[indexRef.current]);
    updateButtons();
  }, [navigate, updateButtons]);

  return { goBack, goForward, canBack, canForward };
}
