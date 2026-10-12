"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchBox } from "@/components/search-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ALL = "all";
const views = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
] as const;

/** View / search / status / date / resource filters stored in the URL so lists are shareable and server-rendered. */
export function BookingFilters({
  resources,
  providers,
}: {
  resources?: { id: string; name: string }[];
  providers?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value && value !== ALL) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next}`);
  }

  // Date ranges default to "all"; otherwise the list opens on upcoming bookings.
  const view = params.get("when") ?? (params.has("from") || params.has("to") ? "all" : "upcoming");
  const hasFilters = ["when", "q", "status", "from", "to", "resource", "provider"].some((key) => params.has(key));

  return (
    <div className="mb-4 grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Which bookings" className="inline-flex rounded-md border p-0.5">
          {views.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-current={view === option.key ? "page" : undefined}
              onClick={() => update("when", option.key)}
              className={cn(
                "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                view === option.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </nav>
        <form
          role="search"
          className="flex max-w-sm flex-1 gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            update("q", new FormData(event.currentTarget).get("q")?.toString().trim() ?? "");
          }}
        >
          <Label htmlFor="filter-q" className="sr-only">
            Search by guest or booking code
          </Label>
          <SearchBox
            key={params.get("q") ?? ""}
            scope="bookings"
            id="filter-q"
            name="q"
            defaultValue={params.get("q") ?? ""}
            placeholder="Guest name, email or booking code"
          />
          <Button type="submit" variant="secondary" size="icon" aria-label="Search">
            <Search aria-hidden />
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="filter-status">Status</Label>
          <Select value={params.get("status") ?? ALL} onValueChange={(value) => update("status", value)}>
            <SelectTrigger id="filter-status" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="NO_SHOW">No-show</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {providers ? (
          <div className="grid gap-1.5">
            <Label htmlFor="filter-provider">Business</Label>
            <Select value={params.get("provider") ?? ALL} onValueChange={(value) => update("provider", value)}>
              <SelectTrigger id="filter-provider" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All businesses</SelectItem>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {resources ? (
          <div className="grid gap-1.5">
            <Label htmlFor="filter-resource">Assigned to</Label>
            <Select value={params.get("resource") ?? ALL} onValueChange={(value) => update("resource", value)}>
              <SelectTrigger id="filter-resource" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any room, table or staff</SelectItem>
                {resources.map((resource) => (
                  <SelectItem key={resource.id} value={resource.id}>
                    {resource.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="grid gap-1.5">
          <Label htmlFor="filter-from">From</Label>
          <Input
            id="filter-from"
            type="date"
            className="w-40"
            defaultValue={params.get("from") ?? ""}
            onChange={(event) => update("from", event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filter-to">To</Label>
          <Input
            id="filter-to"
            type="date"
            className="w-40"
            defaultValue={params.get("to") ?? ""}
            onChange={(event) => update("to", event.target.value)}
          />
        </div>
        {hasFilters ? (
          <Button variant="ghost" onClick={() => router.push(pathname)}>
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
