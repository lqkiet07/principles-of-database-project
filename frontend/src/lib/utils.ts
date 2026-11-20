import { cn as cnFunc } from "cn";

export function cn(...inputs: Parameters<typeof cnFunc>): string {
  return cnFunc(...inputs);
}
