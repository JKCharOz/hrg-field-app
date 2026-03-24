import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// Routes that don't require authentication
var PUBLIC_ROUTES = ['/', '/login']

export async function middleware(request) {
  var response = NextResponse.next({ request: { headers: request.headers } })

  var supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: function () {
          return request.cookies.getAll()
        },
        setAll: function (cookiesToSet) {
          cookiesToSet.forEach(function (c) {
            request.cookies.set(c.name, c.value)
          })
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(function (c) {
            response.cookies.set(c.name, c.value, c.options)
          })
        },
      },
    }
  )

  // This refreshes the session if expired and sets updated cookies
  var result = await supabase.auth.getUser()
  var user = result.data.user

  var pathname = request.nextUrl.pathname
  var isPublic = PUBLIC_ROUTES.indexOf(pathname) !== -1

  // Not logged in and trying to access protected route → redirect to login
  if (!user && !isPublic) {
    var url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Logged in and on login page → redirect to projects
  if (user && pathname === '/') {
    var url = request.nextUrl.clone()
    url.pathname = '/projects'
    return NextResponse.redirect(url)
  }

  return response
}

export var config = {
  matcher: [
    // Match all routes except static files, images, and api routes
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
