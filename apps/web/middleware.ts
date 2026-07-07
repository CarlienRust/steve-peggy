import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/userProfile";

const WORKSPACE_ROUTES = ["/dashboard", "/ingest", "/findings", "/chat", "/gaps", "/compare"];
const PROJECTS_HOME = "/";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (path === "/projects") {
    return NextResponse.redirect(new URL(PROJECTS_HOME, request.url));
  }

  const profileComplete = user?.user_metadata?.profile_complete === true;
  const activeWorkspaceId = request.cookies.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const needsWorkspace = WORKSPACE_ROUTES.some((p) => path === p || path.startsWith(`${p}/`));
  const isSetupRoute =
    path === PROJECTS_HOME ||
    path === "/onboarding" ||
    path === "/login" ||
    path.startsWith("/auth/");

  if (!user && (needsWorkspace || path === PROJECTS_HOME)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && !profileComplete && !isSetupRoute) {
    const url = request.nextUrl.clone();
    url.pathname = PROJECTS_HOME;
    return NextResponse.redirect(url);
  }

  if (
    user &&
    profileComplete &&
    path === "/onboarding" &&
    request.nextUrl.searchParams.get("update") !== "1"
  ) {
    return NextResponse.redirect(new URL(PROJECTS_HOME, request.url));
  }

  if (user && profileComplete && needsWorkspace && !activeWorkspaceId) {
    return NextResponse.redirect(new URL(PROJECTS_HOME, request.url));
  }

  if (user && path === "/login") {
    return NextResponse.redirect(new URL(PROJECTS_HOME, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
