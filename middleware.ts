import { NextResponse, type NextRequest } from 'next/server'

// Minimal middleware — auth handled client-side in each page
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-|manifest).*)'],
}
