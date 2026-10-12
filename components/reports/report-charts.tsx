"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { siteConfig } from "@/lib/config";

// Chart styling follows the data-viz rules: thin columns (<= 24px) with 4px
// rounded tops, hairline solid grid, muted axis text, a tooltip on every bar,
// and a table view next to each chart so no value depends on color or hover.

const money = new Intl.NumberFormat(siteConfig.locale, {
  style: "currency",
  currency: siteConfig.currency,
  maximumFractionDigits: 0,
});
const compactMoney = new Intl.NumberFormat(siteConfig.locale, {
  style: "currency",
  currency: siteConfig.currency,
  notation: "compact",
  maximumFractionDigits: 1,
});

export type RevenuePoint = { label: string; revenue: number };
export type BookingPoint = { label: string; completed: number; upcoming: number; cancelled: number; noShow: number };

const revenueConfig = {
  revenue: { label: "Collected", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Single series, so no legend: the card title names it. */
export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ChartContainer config={revenueConfig} className="aspect-auto h-64 w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={64}
          allowDecimals={false}
          tickFormatter={(value: number) => compactMoney.format(value)}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">Collected</span>
                  <span className="font-medium text-foreground tabular-nums">{money.format(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ChartContainer>
  );
}

const bookingsConfig = {
  completed: { label: "Completed", color: "var(--chart-1)" },
  upcoming: { label: "Pending / confirmed", color: "var(--chart-2)" },
  cancelled: { label: "Cancelled", color: "var(--chart-3)" },
  noShow: { label: "No-show", color: "var(--chart-4)" },
} satisfies ChartConfig;

const stackOrder = ["completed", "upcoming", "cancelled", "noShow"] as const;

/** Stacked columns by outcome; a 2px surface-colored edge keeps segments apart. */
export function BookingsChart({ data }: { data: BookingPoint[] }) {
  return (
    <ChartContainer config={bookingsConfig} className="aspect-auto h-72 w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
        <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {stackOrder.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="bookings"
            fill={`var(--color-${key})`}
            stroke="var(--card)"
            strokeWidth={2}
            maxBarSize={24}
            radius={index === stackOrder.length - 1 ? [4, 4, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
