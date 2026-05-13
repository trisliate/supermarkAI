import { useEffect, useRef, useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router";

const MAX_HISTORY = 50;

export function useNavigationHistory() {
  const location = useLocation();
  const navigate = useNavigate();
  const historyRef = useRef<string[]>([]);
  const indexRef = useRef<number>(-1);
  const skipNextRef = useRef(false);
  const [canBack, setCanBack] = useState(false);
  const [canForward, setCanForward] = useState(false);

  const updateState = useCallback(() => {
    setCanBack(indexRef.current > 0);
    setCanForward(indexRef.current < historyRef.current.length - 1);
  }, []);

  useEffect(() => {
    const path = location.pathname + location.search;
    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }
    // Truncate forward history when navigating to a new page
    const truncated = historyRef.current.slice(0, indexRef.current + 1);
    truncated.push(path);
    if (truncated.length > MAX_HISTORY) truncated.shift();
    historyRef.current = truncated;
    indexRef.current = truncated.length - 1;
    updateState();
  }, [location.pathname, location.search, updateState]);

  const goBack = useCallback(() => {
    if (indexRef.current <= 0) return;
    indexRef.current--;
    skipNextRef.current = true;
    navigate(historyRef.current[indexRef.current]);
    updateState();
  }, [navigate, updateState]);

  const goForward = useCallback(() => {
    if (indexRef.current >= historyRef.current.length - 1) return;
    indexRef.current++;
    skipNextRef.current = true;
    navigate(historyRef.current[indexRef.current]);
    updateState();
  }, [navigate, updateState]);

  return { goBack, goForward, canBack, canForward };
}
