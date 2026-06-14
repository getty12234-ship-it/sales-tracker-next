import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // セッションをリフレッシュ（重要: getUser() を使う）
  const { data: { user } } = await supabase.auth.getUser()

  // リダイレクト応答に、getUser()で更新された認証Cookie(トークンローテーション)を引き継ぐ。
  // ※ これをしないと失効間際のセッションがリダイレクト時に旧トークンのまま残り、ランダムな強制ログアウト/往復が起きる。
  const redirectTo = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url))
    supabaseResponse.cookies.getAll().forEach(c => res.cookies.set(c))
    return res
  }

  // 未ログインでダッシュボードにアクセス → ログインページへ
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return redirectTo('/login')
  }

  // ログイン済みでログインページにアクセス → ダッシュボードへ
  if (user && request.nextUrl.pathname === '/login') {
    return redirectTo('/dashboard')
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
