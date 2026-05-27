'use client'
/**
 * Checkin layout — wraps all steps under /checkin/[ref]/*
 * Provides CheckinContext so extra passport Files can be shared
 * between passport/page and complete/page without going through
 * sessionStorage (which has a 5 MB quota that large images exceed).
 *
 * Next.js App Router keeps this layout mounted across client-side
 * navigations between sibling pages, so React state is preserved.
 */
import { createContext, useContext, useState } from 'react'

/* ── Context types ── */
type CheckinContextType = {
  extraPassports: File[]
  setExtraPassports: (files: File[]) => void
  clearExtraPassports: () => void
}

const CheckinContext = createContext<CheckinContextType>({
  extraPassports: [],
  setExtraPassports: () => {},
  clearExtraPassports: () => {},
})

export function useCheckinContext() {
  return useContext(CheckinContext)
}

/* ── Layout component ── */
export default function CheckinLayout({ children }: { children: React.ReactNode }) {
  const [extraPassports, setExtras] = useState<File[]>([])

  return (
    <CheckinContext.Provider
      value={{
        extraPassports,
        setExtraPassports: (files) => setExtras([...files]),
        clearExtraPassports: () => setExtras([]),
      }}
    >
      {children}
    </CheckinContext.Provider>
  )
}
