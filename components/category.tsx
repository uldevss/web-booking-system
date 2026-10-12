import { BedDouble, Compass, House, KeyRound, PartyPopper, UtensilsCrossed, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { categories, type CategoryIcon } from "@/lib/catalog";
import type { BusinessCategory } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

const icons: Record<CategoryIcon, LucideIcon> = {
  hotel: BedDouble,
  rental: House,
  tour: Compass,
  escape: KeyRound,
  venue: PartyPopper,
  restaurant: UtensilsCrossed,
};

export function CategoryGlyph({ category, className }: { category: BusinessCategory; className?: string }) {
  const meta = categories.find((c) => c.key === category);
  const Icon = icons[meta?.icon ?? "hotel"];
  return <Icon aria-hidden className={cn("size-4", className)} />;
}

/** Small "icon + Hotel" label. */
export function CategoryBadge({ category, className }: { category: BusinessCategory; className?: string }) {
  const meta = categories.find((c) => c.key === category);
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-muted-foreground", className)}>
      <CategoryGlyph category={category} className="size-3.5" />
      {meta?.singular ?? category}
    </span>
  );
}

/** Filter chips: All + one per category, kept in the URL as ?category=. */
export function CategoryFilter({
  basePath,
  active,
  query,
}: {
  basePath: string;
  active?: BusinessCategory;
  /** Other query params to keep (e.g. a search term). */
  query?: Record<string, string | undefined>;
}) {
  const href = (category?: BusinessCategory) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) if (value) params.set(key, value);
    if (category) params.set("category", category);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const chip = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors";
  return (
    <nav aria-label="Filter by category" className="flex flex-wrap gap-2">
      <Link
        href={href()}
        aria-current={!active ? "page" : undefined}
        className={cn(chip, !active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
      >
        All
      </Link>
      {categories.map((category) => (
        <Link
          key={category.key}
          href={href(category.key)}
          aria-current={active === category.key ? "page" : undefined}
          className={cn(chip, active === category.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
        >
          <CategoryGlyph category={category.key} />
          {category.label}
        </Link>
      ))}
    </nav>
  );
}
