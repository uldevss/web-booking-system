"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Month calendar (react-day-picker v9) styled with the app theme. */
function Calendar({ className, classNames, showOutsideDays = true, ...props }: ComponentProps<typeof DayPicker>) {
  const defaults = getDefaultClassNames();
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 [--cell-size:2.25rem]", className)}
      classNames={{
        root: cn("w-fit", defaults.root),
        months: cn("relative flex flex-col gap-4", defaults.months),
        month: cn("flex w-full flex-col gap-4", defaults.month),
        nav: cn("absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1", defaults.nav),
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "size-(--cell-size) p-0 select-none aria-disabled:opacity-40",
          defaults.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "size-(--cell-size) p-0 select-none aria-disabled:opacity-40",
          defaults.button_next,
        ),
        month_caption: cn("flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)", defaults.month_caption),
        caption_label: cn("text-sm font-medium select-none", defaults.caption_label),
        month_grid: "w-full border-collapse",
        weekdays: cn("flex", defaults.weekdays),
        weekday: cn("flex-1 rounded-md text-[0.8rem] font-normal text-muted-foreground select-none", defaults.weekday),
        week: cn("mt-1 flex w-full", defaults.week),
        day: cn("relative aspect-square size-(--cell-size) p-0 text-center select-none", defaults.day),
        day_button: cn(
          "flex size-(--cell-size) items-center justify-center rounded-md text-sm font-medium transition-colors",
          "hover:bg-primary/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          "disabled:pointer-events-none",
        ),
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
        today: "[&>button]:ring-1 [&>button]:ring-primary/40",
        outside: "text-muted-foreground/50",
        disabled: "text-muted-foreground/40 [&>button]:font-normal",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClass }) =>
          orientation === "left" ? (
            <ChevronLeftIcon aria-hidden className={cn("size-4", chevronClass)} />
          ) : (
            <ChevronRightIcon aria-hidden className={cn("size-4", chevronClass)} />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
