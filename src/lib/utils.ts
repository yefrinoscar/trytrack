import { twMerge } from 'tailwind-merge'
import { clsx, type ClassValue } from './clsx'

export type { ClassValue }

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs))
}
