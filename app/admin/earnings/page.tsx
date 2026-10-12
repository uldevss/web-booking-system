import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PayoutActions } from "@/app/admin/earnings/payout-actions";
import { EarningsTable } from "@/components/earnings-table";
import { PageHeader } from "@/components/page-header";
import { PayoutsTable } from "@/components/payouts-table";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getEarnings } from "@/lib/earnings";
import { formatMoney } from "@/lib/format";
import { listPayouts } from "@/lib/payouts";
import { getPlatformSettings } from "@/lib/platform";
import { flattenParams, type SearchParams } from "@/lib/search-params";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Commission" };

export default async function AdminEarningsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser(["ADMIN"]);
  const q = flattenParams(await searchParams).q?.trim().slice(0, 100) ?? "";
  const [earnings, settings, payouts] = await Promise.all([getEarnings({ q }), getPlatformSettings(), listPayouts({})]);
  const { summary } = earnings;
  const waiting = payouts.filter((p) => p.status === "REQUESTED");
  const sent = payouts.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <>
      <PageHeader
        title="Commission & cash-outs"
        description={`Every confirmed payment arrives in the platform's GCash account. The platform keeps ${Number(settings.commissionPercent)}% and pays the rest out to businesses on request.`}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Collected" value={formatMoney(summary.gross)} hint={`${summary.payments} confirmed payment${summary.payments === 1 ? "" : "s"}`} />
        <StatCard label="Platform commission" value={formatMoney(summary.commission)} />
        <StatCard label="Owed to businesses" value={formatMoney(summary.net - sent)} hint={`${formatMoney(sent)} already paid out`} />
        <StatCard
          label="Cash-outs waiting"
          value={waiting.length}
          hint={waiting.length ? formatMoney(waiting.reduce((sum, p) => sum + Number(p.amount), 0)) : "None"}
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Cash-out requests</CardTitle>
          <CardDescription>Send the amount to the business&apos;s GCash, then mark it as sent with the reference.</CardDescription>
        </CardHeader>
        <CardContent>
          <PayoutsTable
            rows={payouts.map((p) => ({ ...p, amount: p.amount.toString(), business: p.provider.businessName }))}
            showBusiness
            actions={(row) => (row.status === "REQUESTED" ? <PayoutActions payoutId={row.id} /> : null)}
          />
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">Confirmed payments</h2>
        <form role="search" className="flex w-full max-w-md gap-2">
          <label htmlFor="earnings-search" className="sr-only">
            Search payments
          </label>
          <Input id="earnings-search" name="q" defaultValue={q} placeholder="Business, guest, option or GCash reference" />
          <Button type="submit" variant="secondary">
            <Search aria-hidden />
            Search
          </Button>
          {q ? (
            <Button asChild variant="ghost">
              <Link href="/admin/earnings">Clear</Link>
            </Button>
          ) : null}
        </form>
      </div>
      <EarningsTable rows={earnings.rows} hrefBase="/admin/bookings" showBusiness />
    </>
  );
}
