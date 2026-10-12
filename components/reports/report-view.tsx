import { BookingsChart, RevenueChart } from "@/components/reports/report-charts";
import { ReportFilters } from "@/components/reports/report-filters";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { resourceKinds } from "@/lib/catalog";
import { siteConfig } from "@/lib/config";
import { formatMoney, formatPercent } from "@/lib/format";
import type { ResourceKind } from "@/lib/generated/prisma/enums";
import { getReport, type GroupBy, type Report } from "@/lib/reports";
import { addDays, isDayKey, toDayKey, zonedTimeToUtc } from "@/lib/time";
import { reportQuerySchema } from "@/lib/validators";

/** Reads ?from=&to=&groupBy= with sensible defaults (last 30 days, by day). */
export function reportFilterFromParams(params: Record<string, string | undefined>) {
  const today = toDayKey(new Date(), siteConfig.timeZone);
  const parsed = reportQuerySchema.safeParse({
    from: params.from && isDayKey(params.from) ? params.from : addDays(today, -29),
    to: params.to && isDayKey(params.to) ? params.to : today,
    groupBy: params.groupBy,
    providerId: params.providerId || undefined,
  });
  return parsed.success ? parsed.data : { from: addDays(today, -29), to: today, groupBy: "day" as GroupBy };
}

function periodLabel(key: string, groupBy: GroupBy) {
  const date = zonedTimeToUtc(key, 12 * 60, siteConfig.timeZone);
  const options: Intl.DateTimeFormatOptions =
    groupBy === "month" ? { month: "short", year: "numeric" } : { month: "short", day: "numeric" };
  return new Intl.DateTimeFormat(siteConfig.locale, { timeZone: siteConfig.timeZone, ...options }).format(date);
}

/** Collapsible table twin of a chart, so values never depend on color or hover. */
function TableView({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show as table</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header, i) => (
                <TableHead key={header} className={i ? "text-right" : undefined}>
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={String(row[0])}>
                {row.map((cell, i) => (
                  <TableCell key={i} className={i ? "text-right tabular-nums" : undefined}>
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </details>
  );
}

export async function ReportView({
  filter,
  exportBase,
  providers,
  showProviderColumn,
}: {
  filter: { from: string; to: string; groupBy: GroupBy; providerId?: string };
  exportBase: string;
  providers?: { id: string; name: string }[];
  showProviderColumn?: boolean;
}) {
  const report: Report = await getReport(filter);
  const { summary } = report;
  const exportParams = new URLSearchParams({ from: filter.from, to: filter.to });
  if (filter.providerId) exportParams.set("providerId", filter.providerId);

  const revenueData = report.revenueSeries.map((point) => ({
    label: periodLabel(point.key, filter.groupBy),
    revenue: Math.round(point.revenue * 100) / 100,
  }));
  const bookingData = report.bookingSeries.map((point) => ({
    label: periodLabel(point.key, filter.groupBy),
    completed: point.COMPLETED,
    upcoming: point.PENDING + point.CONFIRMED,
    cancelled: point.CANCELLED,
    noShow: point.NO_SHOW,
  }));
  const maxServiceBookings = Math.max(1, ...report.topServices.map((service) => service.bookings));

  return (
    <div className="grid gap-6">
      <ReportFilters
        from={filter.from}
        to={filter.to}
        groupBy={filter.groupBy}
        exportHref={`${exportBase}?${exportParams}`}
        providers={providers}
        providerId={filter.providerId}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Collected revenue" value={formatMoney(summary.revenue)} hint="Paid + partial payments" />
        <StatCard label="Bookings" value={summary.bookings.toLocaleString(siteConfig.locale)} hint={`${summary.completed} completed`} />
        <StatCard label="Cancellation rate" value={formatPercent(summary.cancellationRate)} />
        <StatCard label="No-show rate" value={formatPercent(summary.noShowRate)} />
        <StatCard
          label="Average rating"
          value={summary.averageRating ? summary.averageRating.toFixed(2) : "–"}
          hint={`${summary.reviews} review${summary.reviews === 1 ? "" : "s"} in period`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue collected</CardTitle>
            <CardDescription>By payment date, per {filter.groupBy}</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueData} />
            <TableView
              headers={["Period", "Collected"]}
              rows={revenueData.map((point) => [point.label, formatMoney(point.revenue)])}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bookings by status</CardTitle>
            <CardDescription>By booking start date, per {filter.groupBy}</CardDescription>
          </CardHeader>
          <CardContent>
            <BookingsChart data={bookingData} />
            <TableView
              headers={["Period", "Completed", "Pending / confirmed", "Cancelled", "No-show"]}
              rows={bookingData.map((p) => [p.label, p.completed, p.upcoming, p.cancelled, p.noShow])}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top booking options</CardTitle>
            <CardDescription>Bookings excluding cancellations</CardDescription>
          </CardHeader>
          <CardContent>
            {report.topServices.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Option</TableHead>
                    <TableHead className="w-1/3">Bookings</TableHead>
                    <TableHead className="text-right">Completed value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.topServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell>
                        <span className="font-medium">{service.name}</span>
                        {showProviderColumn ? (
                          <span className="block text-xs text-muted-foreground">{service.businessName}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-[var(--chart-1)]"
                              style={{ width: `${(service.bookings / maxServiceBookings) * 100}%` }}
                            />
                          </div>
                          <span className="w-8 text-right tabular-nums">{service.bookings}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(service.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No bookings in this period.</p>
            )}
          </CardContent>
        </Card>

        {filter.providerId ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rooms, spaces & staff</CardTitle>
              <CardDescription>Completed bookings in the period, by what was booked</CardDescription>
            </CardHeader>
            <CardContent>
              {report.resources.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">Nights</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">No-shows</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.resources.map((resource) => (
                      <TableRow key={resource.id}>
                        <TableCell className="font-medium">{resource.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {resourceKinds[resource.kind as ResourceKind]?.label ?? resource.kind}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{resource.completed}</TableCell>
                        <TableCell className="text-right tabular-nums">{resource.nights}</TableCell>
                        <TableCell className="text-right tabular-nums">{resource.hours.toFixed(1)}</TableCell>
                        <TableCell className="text-right tabular-nums">{resource.noShows}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing set up yet.</p>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
