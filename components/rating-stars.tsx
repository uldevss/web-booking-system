import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Read-only star rating, e.g. 4.3 shows four full stars. */
export function RatingStars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={cn(
            "size-4",
            star <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}

/** "★ 4.6 (23)" or "No reviews yet". */
export function RatingSummary({ average, count }: { average: number; count: number }) {
  if (!count) return <span className="text-sm text-muted-foreground">No reviews yet</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Star aria-hidden className="size-4 fill-amber-400 text-amber-400" />
      <span className="font-medium tabular-nums">{average.toFixed(1)}</span>
      <span className="text-muted-foreground">
        ({count} review{count === 1 ? "" : "s"})
      </span>
    </span>
  );
}
