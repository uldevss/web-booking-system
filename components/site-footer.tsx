import Link from "next/link";
import { siteConfig } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <p>
          © {new Date().getFullYear()} {siteConfig.name}
        </p>
        <nav aria-label="Footer" className="flex gap-4">
          <Link href="/services" className="hover:text-foreground">
            Services
          </Link>
          <Link href="/providers" className="hover:text-foreground">
            Businesses
          </Link>
          <Link href="/provider/register" className="hover:text-foreground">
            For businesses
          </Link>
        </nav>
      </div>
    </footer>
  );
}
