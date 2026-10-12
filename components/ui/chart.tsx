"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

// shadcn/ui-style chart helpers for Recharts: a container that maps a config
// of series to CSS color variables (--color-<key>), plus themed tooltip and
// legend content. Prop types are kept structural so they work across
// Recharts versions.

const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [key in string]: { label?: React.ReactNode; icon?: React.ComponentType } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error("useChart must be used within a <ChartContainer />");
  return context;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border [&_.recharts-layer]:outline-hidden [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-surface]:outline-hidden",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, item]) => item.theme || item.color);
  if (!colorConfig.length) return null;
  const css = Object.entries(THEMES)
    .map(([theme, prefix]) => {
      const vars = colorConfig
        .map(([key, item]) => {
          const color = item.theme?.[theme as keyof typeof item.theme] || item.color;
          return color ? `  --color-${key}: ${color};` : null;
        })
        .filter(Boolean)
        .join("\n");
      return `${prefix} [data-chart=${id}] {\n${vars}\n}`;
    })
    .join("\n");
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

const ChartTooltip = RechartsPrimitive.Tooltip;

type TooltipItem = {
  name?: string | number;
  value?: number | string | (number | string)[];
  dataKey?: string | number | ((entry: never) => unknown);
  color?: string;
  type?: string;
  payload?: Record<string, unknown> & { fill?: string };
};

type ChartTooltipContentProps = Omit<React.ComponentProps<"div">, "color"> & {
  active?: boolean;
  payload?: TooltipItem[];
  label?: React.ReactNode;
  indicator?: "line" | "dot" | "dashed";
  hideLabel?: boolean;
  hideIndicator?: boolean;
  labelFormatter?: (label: React.ReactNode, payload: TooltipItem[]) => React.ReactNode;
  labelClassName?: string;
  formatter?: (
    value: TooltipItem["value"],
    name: TooltipItem["name"],
    item: TooltipItem,
    index: number,
    payload: TooltipItem["payload"],
  ) => React.ReactNode;
  color?: string;
  nameKey?: string;
  labelKey?: string;
};

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: ChartTooltipContentProps) {
  const { config } = useChart();

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) return null;
    const [item] = payload;
    const key = `${labelKey || (typeof item?.dataKey === "function" ? "" : item?.dataKey) || item?.name || "value"}`;
    const itemConfig = getPayloadConfigFromPayload(config, item, key);
    const value =
      !labelKey && typeof label === "string" ? config[label]?.label || label : itemConfig?.label;
    if (labelFormatter) return <div className={cn("font-medium", labelClassName)}>{labelFormatter(value, payload)}</div>;
    if (!value) return null;
    return <div className={cn("font-medium", labelClassName)}>{value}</div>;
  }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

  if (!active || !payload?.length) return null;

  const nestLabel = payload.length === 1 && indicator !== "dot";

  return (
    <div
      className={cn(
        "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
        className,
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {payload
          .filter((item) => item.type !== "none")
          .map((item, index) => {
            const key = `${nameKey || item.name || (typeof item.dataKey === "function" ? "" : item.dataKey) || "value"}`;
            const itemConfig = getPayloadConfigFromPayload(config, item, key);
            const indicatorColor = color || item.payload?.fill || item.color;

            return (
              <div
                key={`${String(key)}-${index}`}
                className={cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:size-2.5 [&>svg]:text-muted-foreground",
                  indicator === "dot" && "items-center",
                )}
              >
                {formatter && item.value !== undefined && item.name !== undefined ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : hideIndicator ? null : (
                      <div
                        className={cn("shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)", {
                          "size-2.5": indicator === "dot",
                          "w-1": indicator === "line",
                          "w-0 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
                          "my-0.5": nestLabel && indicator === "dashed",
                        })}
                        style={{ "--color-bg": indicatorColor, "--color-border": indicatorColor } as React.CSSProperties}
                      />
                    )}
                    <div className={cn("flex flex-1 justify-between gap-4 leading-none", nestLabel ? "items-end" : "items-center")}>
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">{itemConfig?.label || item.name}</span>
                      </div>
                      {item.value !== undefined && item.value !== null ? (
                        <span className="font-medium text-foreground tabular-nums">
                          {typeof item.value === "number" ? item.value.toLocaleString() : String(item.value)}
                        </span>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

const ChartLegend = RechartsPrimitive.Legend;

type LegendItem = {
  value?: string | number;
  dataKey?: string | number | ((entry: never) => unknown);
  color?: string;
  type?: string;
};

function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
}: React.ComponentProps<"div"> & {
  payload?: readonly LegendItem[];
  verticalAlign?: "top" | "bottom" | "middle";
  hideIcon?: boolean;
  nameKey?: string;
}) {
  const { config } = useChart();
  if (!payload?.length) return null;

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-1", verticalAlign === "top" ? "pb-3" : "pt-3", className)}>
      {payload
        .filter((item) => item.type !== "none")
        .map((item, index) => {
          const key = `${nameKey || (typeof item.dataKey === "function" ? "" : item.dataKey) || "value"}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);
          return (
            <div key={`${key}-${index}`} className="flex items-center gap-1.5 text-muted-foreground [&>svg]:size-3 [&>svg]:text-muted-foreground">
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
              )}
              <span className="text-foreground">{itemConfig?.label ?? item.value}</span>
            </div>
          );
        })}
    </div>
  );
}

/** Finds the config entry for a tooltip/legend item. */
function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== "object" || payload === null) return undefined;
  const record = payload as Record<string, unknown>;
  const inner =
    "payload" in record && typeof record.payload === "object" && record.payload !== null
      ? (record.payload as Record<string, unknown>)
      : undefined;

  let configKey = key;
  if (typeof record[key] === "string") configKey = record[key] as string;
  else if (inner && typeof inner[key] === "string") configKey = inner[key] as string;

  return configKey in config ? config[configKey] : config[key];
}

export { ChartContainer, ChartLegend, ChartLegendContent, ChartStyle, ChartTooltip, ChartTooltipContent };
