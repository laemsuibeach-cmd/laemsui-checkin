/**
 * passport-store.ts — in-memory store for extra passport Files
 * Uses window object (browser-level singleton) so it persists across
 * Next.js page navigations even when modules are split into separate chunks.
 */

declare global {
  interface Window { __extraPassports?: File[] }
}

export function setExtraPassports(files: File[]) {
  if (typeof window !== 'undefined') window.__extraPassports = [...files]
}

export function getExtraPassports(): File[] {
  if (typeof window === 'undefined') return []
  return window.__extraPassports ?? []
}

export function clearExtraPassports() {
  if (typeof window !== 'undefined') window.__extraPassports = undefined
}
