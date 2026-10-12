import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CashOutForm } from "@/app/provider/(dashboard)/earnings/cash-out-form";
import { EarningsTable } from "@/components/earnings-table";
import { PageHeader } from "@/components/page-header";
import { PayoutsTable } from "@/components/payouts-table";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getEarnings } from "@/lib/earnings";
import { formatMoney } from "@/lib/format";
import { listPayouts, payoutBalance } from "@/lib/payouts";
import { getPlatformSettings } from "@/lib/platform";
import { flattenParams, type SearchParams } from "@/lib/search-params";
import { requireProvider } from "@/lib/session";

export const metadata: Metadata = { title: "Earnings" };

export default async function ProviderEarningsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { provider } = await requireProvider();
  const q = flattenParams(await searchParams).q?.trim().slice(0, 100) ?? "";
  const [earnings, settings, balance, payouts] = await Promise.all([
    getEarnings({ providerId: provider.id, q }),
    getPlatformSettings(),
    payoutBalance(provider.id),
    listPayouts({ providerId: provider.id }),
  ]);
  const { summary } = earnings;
  const percent = Number(settings.commissionPercent);
  const waiting = payouts.find((p) => p.status === "REQUESTED");

  return (
    <>
      <PageHeader
        title="Earnings"
        description={`Guests pay the platform's GCash account when they book. Each payment is recorded at once, the platform keeps ${percent}%, and the rest is yours to cash out.`}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Confirmed payments" value={formatMoney(summary.gross)} hint={`${summary.payments} payment${summary.payments === 1 ? "" : "s"}${q ? " matching" : ""}`} />
        <StatCard label="Platform commission" value={formatMoney(summary.commission)} hint={`${percent}% of each payment`} />
        <StatCard label="Available to cash out" value={formatMoney(balance.available)} hint={`${formatMoney(balance.paidOut)} already cashed out`} />
        <StatCard
          label="From bookings awaiting confirmation"
          value={formatMoney(summary.awaitingAmount)}
          hint={
            summary.awaitingCount ? (
              <Link href="/provider/bookings?status=PENDING" className="text-primary hover:underline">
                {summary.awaitingCount} booking{summary.awaitingCount === 1 ? "" : "s"} to confirm
              </Link>
            ) : (
              "Nothing waiting"
            )
          }
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cash out</CardTitle>
            <CardDescription>We send your available balance to your GCash. Requests are usually processed within a day.</CardDescription>
          </CardHeader>
          <CardContent>
            <CashOutForm
              available={balance.available.toFixed(2)}
              defaults={{ gcashName: provider.payoutGcashName ?? "", gcashNumber: provider.payoutGcashNumber ?? "" }}
              disabledReason={
                waiting
                  ? `A cash-out of ${formatMoney(waiting.amount)} is waiting to be sent. You can request another once it's done.`
                  : balance.available <= 0
                    ? "Nothing to cash out yet."
                    : null
              }
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cash-out history</CardTitle>
          </CardHeader>
          <CardContent>
            <PayoutsTable rows={payouts.map((p) => ({ ...p, amount: p.amount.toString() }))} />
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">Confirmed payments</h2>
        <form role="search" className="flex w-full max-w-md gap-2">
          <label htmlFor="earnings-search" className="sr-only">
            Search payments
          </label>
          <Input id="earnings-search" name="q" defaultValue={q} placeholder="Guest, booking option or GCash reference" />
          <Button type="submit" variant="secondary">
            <Search aria-hidden />
            Search
          </Button>
          {q ? (
            <Button asChild variant="ghost">
              <Link href="/provider/earnings">Clear</Link>
            </Button>
          ) : null}
        </form>
      </div>
      <EarningsTable rows={earnings.rows} hrefBase="/provider/bookings" />
    </>
  );
}
