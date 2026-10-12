import { CalendarCheck } from "lucide-react";
import Link from "next/link";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { siteConfig } from "@/lib/config";
import { homePathFor, roleLabels } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      {user && !user.emailVerifiedAt ? (
        <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-sm">
          Please verify your email address to start booking.{" "}
          <Link href="/verify" className="font-medium text-primary hover:underline">
            Enter the code
          </Link>
        </div>
      ) : null}
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <CalendarCheck aria-hidden className="size-5 text-primary" />
          <span className="truncate">{siteConfig.name}</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 text-sm md:flex">
          <Link href="/services" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground">
            Services
          </Link>
          <Link href="/providers" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground">
            Businesses
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href={homePathFor(user.role)}>
                  {user.role === "CUSTOMER" ? "My bookings" : `${roleLabels[user.role]} dashboard`}
                </Link>
              </Button>
              <NotificationBell />
              <UserMenu
                name={user.name}
                email={user.email}
                avatarUrl={user.avatarUrl}
                homeHref={homePathFor(user.role)}
              />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/provider/register">List your business</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
