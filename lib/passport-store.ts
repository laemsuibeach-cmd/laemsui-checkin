/**
 * passport-store.ts — in-memory store for extra passport Files
 * Keeps File objects directly in memory (no base64 / sessionStorage conversion)
 * so there's no size limit. Valid for the lifetime of the browser session (SPA navigation).
 */

let _extraPassports: File[] = []

export function setExtraPassports(files: File[])  { _extraPassports = [...files] }
export function getExtraPassports(): File[]        { return _extraPassports }
export function clearExtraPassports()              { _extraPassports = [] }
