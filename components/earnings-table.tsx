import Link from "next/link";
import { EmptyState } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";

export type EarningRow = {
  id: string;
  bookingId: string;
  paidAt: Date | null;
  startAt: Date;
  guest: string;
  option: string;
  business: string;
  plan: "DEPOSIT" | "FULL";
  reference: string | null;
  amountPaid: number;
  commissionPercent: number;
  commission: number;
  net: number;
};

/** Confirmed payments with the platform's cut and what the business receives. */
export function EarningsTable({
  rows,
  hrefBase,
  showBusiness,
}: {
  rows: EarningRow[];
  hrefBase: string;
  showBusiness?: boolean;
}) {
  if (!rows.length) return <EmptyState title="No confirmed payments in this period" />;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Confirmed</TableHead>
            <TableHead>Booking</TableHead>
            {showBusiness ? <TableHead>Business</TableHead> : null}
            <TableHead>Guest</TableHead>
            <TableHead>Paid as</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Commission</TableHead>
            <TableHead className="text-right">To business</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="relative">
              <TableCell className="whitespace-nowrap">{row.paidAt ? formatDate(row.paidAt) : "–"}</TableCell>
              <TableCell>
                <Link href={`${hrefBase}/${row.bookingId}`} className="font-medium after:absolute after:inset-0 hover:underline">
                  {row.option}
                </Link>
                <span className="block text-xs text-muted-foreground">
                  {formatDate(row.startAt)}
                  {row.reference ? ` · ref. ${row.reference}` : ""}
                </span>
              </TableCell>
              {showBusiness ? <TableCell>{row.business}</TableCell> : null}
              <TableCell>{row.guest}</TableCell>
              <TableCell>{row.plan === "DEPOSIT" ? "Deposit" : "Full"}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(row.amountPaid)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatMoney(row.commission)}
                <span className="block text-xs">{row.commissionPercent}%</span>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatMoney(row.net)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
