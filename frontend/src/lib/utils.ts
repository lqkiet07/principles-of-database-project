import { cn as cnFunc } from "cn";
import { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return cnFunc(...inputs);
}
