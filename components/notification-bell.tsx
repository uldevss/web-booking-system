"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; message: string; link: string | null; isRead: boolean; createdAt: string };

const timeAgo = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
function ago(iso: string) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return timeAgo.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return timeAgo.format(hours, "hour");
  return timeAgo.format(Math.round(hours / 24), "day");
}

/** In-app notifications: unread badge, refreshed every minute and when opened. */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data: { notifications: Item[]; unread: number } = await response.json();
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      // Offline or signed out; try again on the next tick.
    }
  }, []);

  // Poll like an external subscription: first fetch right after mount, then every minute.
  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  async function markRead(body: { all: true } | { ids: string[] }) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    void load();
  }

  function openItem(item: Item) {
    setOpen(false);
    if (!item.isRead) void markRead({ ids: [item.id] });
    if (item.link) router.push(item.link);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell aria-hidden />
          {unread > 0 ? (
            <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground tabular-nums">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 ? (
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => void markRead({ all: true })}>
              Mark all as read
            </button>
          ) : null}
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</li>
          ) : (
            items.map((item) => (
              <li key={item.id} className="border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => openItem(item)}
                  className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-muted/60", !item.isRead && "bg-primary/5")}
                >
                  <span
                    aria-hidden
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.isRead ? "bg-transparent" : "bg-primary")}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{item.title}</span>
                    <span className="block text-sm text-muted-foreground">{item.message}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{ago(item.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="border-t px-4 py-2 text-center">
          <Link href="/notifications" className="text-xs font-medium text-primary hover:underline" onClick={() => setOpen(false)}>
            See all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
