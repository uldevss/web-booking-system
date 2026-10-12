import type { Metadata } from "next";
import Link from "next/link";
import { deleteReview, setReviewHidden } from "@/app/admin/actions";
import { ActionButton } from "@/components/action-button";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { RatingStars } from "@/components/rating-stars";
import { pageNumber, PAGE_SIZE } from "@/lib/booking-filters";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { flattenParams, type SearchParams } from "@/lib/search-params";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reviews" };

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser(["ADMIN"]);
  const params = flattenParams(await searchParams);
  const hiddenOnly = params.show === "hidden";
  const page = pageNumber(params);
  const where = hiddenOnly ? { isHidden: true } : {};

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        customer: { select: { name: true, email: true } },
        booking: { select: { id: true, service: { select: { name: true } }, provider: { select: { id: true, businessName: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.review.count({ where }),
  ]);

  return (
    <>
      <PageHeader title="Reviews" description="Hide reviews that break the rules; hidden reviews don't count toward ratings." />
      <nav aria-label="Filter reviews" className="mb-4 flex gap-1">
        {[
          { key: "all", label: "All reviews", href: "/admin/reviews" },
          { key: "hidden", label: "Hidden", href: "/admin/reviews?show=hidden" },
        ].map((tab) => {
          const active = (tab.key === "hidden") === hiddenOnly;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {reviews.length ? (
        <>
          <ul className="grid gap-3">
            {reviews.map((review) => (
              <li key={review.id} className={cn("rounded-lg border p-4", review.isHidden && "bg-muted/50")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <RatingStars value={review.rating} />
                      {review.isHidden ? <span className="text-xs font-medium text-muted-foreground">Hidden</span> : null}
                    </div>
                    <p className="mt-1 text-sm">
                      <Link href={`/providers/${review.booking.provider.id}`} className="font-medium hover:underline">
                        {review.booking.provider.businessName}
                      </Link>
                      <span className="text-muted-foreground"> · {review.booking.service.name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {review.customer.name} ({review.customer.email}) · {formatDate(review.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <ActionButton size="sm" variant="outline" action={setReviewHidden.bind(null, review.id, !review.isHidden)}>
                      {review.isHidden ? "Unhide" : "Hide"}
                    </ActionButton>
                    <ActionButton
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      action={deleteReview.bind(null, review.id)}
                      confirmText="Delete this review permanently? The customer will be able to write a new one."
                    >
                      Delete
                    </ActionButton>
                  </div>
                </div>
                {review.comment ? <p className="mt-3 text-sm whitespace-pre-wrap">{review.comment}</p> : null}
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/reviews" params={params} />
        </>
      ) : (
        <EmptyState title={hiddenOnly ? "No hidden reviews" : "No reviews yet"} />
      )}
    </>
  );
}
