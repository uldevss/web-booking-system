import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { ReactNode } from "react";

export type PayoutRow = {
  id: string;
  amount: number | string | { toString(): string };
  gcashName: string;
  gcashNumber: string;
  status: "REQUESTED" | "PAID" | "REJECTED";
  reference: string | null;
  note: string | null;
  requestedAt: Date;
  resolvedAt: Date | null;
  business?: string;
};

const statusLabels = { REQUESTED: "Waiting", PAID: "Sent", REJECTED: "Rejected" } as const;

export function PayoutStatusBadge({ status }: { status: PayoutRow["status"] }) {
  const tone =
    status === "PAID"
      ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
      : status === "REJECTED"
        ? "bg-destructive/15 text-destructive"
        : "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{statusLabels[status]}</span>;
}

/** Cash-out history; `actions(row)` renders admin controls for waiting requests. */
export function PayoutsTable({
  rows,
  showBusiness,
  actions,
}: {
  rows: PayoutRow[];
  showBusiness?: boolean;
  actions?: (row: PayoutRow) => ReactNode;
}) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No cash-outs yet.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Requested</TableHead>
            {showBusiness ? <TableHead>Business</TableHead> : null}
            <TableHead>To GCash</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Details</TableHead>
            {actions ? <TableHead className="text-right">Action</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap">{formatDateTime(row.requestedAt)}</TableCell>
              {showBusiness ? <TableCell>{row.business}</TableCell> : null}
              <TableCell>
                {row.gcashNumber}
                <span className="block text-xs text-muted-foreground">{row.gcashName}</span>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatMoney(row.amount)}</TableCell>
              <TableCell>
                <PayoutStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {row.status === "PAID" && row.reference ? `Ref. ${row.reference}` : null}
                {row.status === "REJECTED" && row.note ? row.note : null}
                {row.resolvedAt ? <span className="block">{formatDateTime(row.resolvedAt)}</span> : null}
              </TableCell>
              {actions ? <TableCell className="text-right">{actions(row)}</TableCell> : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
