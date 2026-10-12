"use client";

import { Download } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { siteConfig } from "@/lib/config";
import { addDays, toDayKey } from "@/lib/time";

type Range = { from: string; to: string };

function presets(): { key: string; label: string; range: Range }[] {
  const today = toDayKey(new Date(), siteConfig.timeZone);
  return [
    { key: "7d", label: "Last 7 days", range: { from: addDays(today, -6), to: today } },
    { key: "30d", label: "Last 30 days", range: { from: addDays(today, -29), to: today } },
    { key: "90d", label: "Last 90 days", range: { from: addDays(today, -89), to: today } },
    { key: "mtd", label: "Month to date", range: { from: `${today.slice(0, 8)}01`, to: today } },
    { key: "12m", label: "Last 12 months", range: { from: addDays(today, -364), to: today } },
  ];
}

/** One filter row above all report sections; every chart and table uses the same slice. */
export function ReportFilters({
  from,
  to,
  groupBy,
  exportHref,
  providers,
  providerId,
}: {
  from: string;
  to: string;
  groupBy: string;
  exportHref: string;
  providers?: { id: string; name: string }[];
  providerId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const options = presets();
  const active = options.find((option) => option.range.from === from && option.range.to === to)?.key ?? "custom";

  function apply(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(`${pathname}?${next}`);
  }

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="report-range">Period</Label>
        <Select
          value={active}
          onValueChange={(key) => {
            const preset = options.find((option) => option.key === key);
            if (!preset) return;
            const groupFor = key === "12m" ? "month" : key === "90d" ? "week" : "day";
            apply({ ...preset.range, groupBy: groupFor });
          }}
        >
          <SelectTrigger id="report-range" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label}
              </SelectItem>
            ))}
            {active === "custom" ? <SelectItem value="custom">Custom range</SelectItem> : null}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="report-from">From</Label>
        <Input id="report-from" type="date" className="w-40" value={from} max={to} onChange={(e) => e.target.value && apply({ from: e.target.value })} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="report-to">To</Label>
        <Input id="report-to" type="date" className="w-40" value={to} min={from} onChange={(e) => e.target.value && apply({ to: e.target.value })} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="report-group">Group by</Label>
        <Select value={groupBy} onValueChange={(value) => apply({ groupBy: value })}>
          <SelectTrigger id="report-group" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {providers ? (
        <div className="grid gap-1.5">
          <Label htmlFor="report-provider">Business</Label>
          <Select value={providerId ?? "all"} onValueChange={(value) => apply({ providerId: value === "all" ? undefined : value })}>
            <SelectTrigger id="report-provider" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All businesses</SelectItem>
              {providers.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <Button asChild variant="outline" className="ml-auto">
        <a href={exportHref} download>
          <Download aria-hidden />
          Export CSV
        </a>
      </Button>
    </div>
  );
}
