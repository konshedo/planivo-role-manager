import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const safeProfileName = (profile: any, fallback = 'Unknown') => 
  profile?.full_name || fallback;

export const safeProfileEmail = (profile: any, fallback = 'No email') => 
  profile?.email || fallback;
