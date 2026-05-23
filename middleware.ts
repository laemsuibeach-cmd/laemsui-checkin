import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  return NextResponse.next()
}

// Empty matcher = middleware never runs on any route
export const config = {
  matcher: [],
}
