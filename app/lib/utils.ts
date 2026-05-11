import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(amount: number | { valueOf(): number }): string {
  const n = Number(amount);
  if (!isFinite(n)) return "0.00";
  return n.toFixed(2);
}
