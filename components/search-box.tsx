"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Suggestion = { label: string; hint?: string; href?: string; kind: string };

/**
 * A search input that shows suggestions from `/api/suggest?scope=` as you
 * type. Picking a suggestion with a link goes straight there; otherwise it
 * fills the box and submits the surrounding form. Works without JavaScript
 * as a plain input.
 */
export function SearchBox({
  scope,
  className,
  wrapperClassName,
  defaultValue,
  ...input
}: Omit<ComponentProps<typeof Input>, "type" | "onChange" | "value"> & {
  scope: "catalog" | "bookings" | "users";
  wrapperClassName?: string;
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // The box is controlled from here on; `defaultValue` only seeds it.
  const [query, setQuery] = useState(String(defaultValue ?? ""));
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);

  // Fetch suggestions a moment after typing stops; drop stale responses.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/suggest?scope=${scope}&q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = response.ok ? await response.json() : { suggestions: [] };
        setItems(data.suggestions ?? []);
        setActive(-1);
      } catch {
        // Aborted or offline: keep whatever is shown.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, scope]);

  function choose(item: Suggestion) {
    setOpen(false);
    if (item.href) {
      router.push(item.href);
      return;
    }
    setQuery(item.label);
    const field = inputRef.current;
    if (field) {
      field.value = item.label;
      field.form?.requestSubmit();
    }
  }

  const showList = open && items.length > 0;

  return (
    <div className={cn("relative min-w-0 flex-1", wrapperClassName)}>
      <Input
        {...input}
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={query}
        className={cn("pr-8", className)}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          setOpen(true);
          if (value.trim().length < 2) {
            setItems([]);
            setLoading(false);
          }
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (!showList) {
            if (event.key === "ArrowDown" && items.length) setOpen(true);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => (index + 1) % items.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => (index <= 0 ? items.length - 1 : index - 1));
          } else if (event.key === "Enter" && active >= 0) {
            event.preventDefault();
            choose(items[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {loading ? (
        <Loader2 aria-hidden className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
      <ul
        id={listId}
        role="listbox"
        hidden={!showList}
        className="absolute top-full right-0 left-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      >
        {items.map((item, index) => {
          const heading = item.kind !== items[index - 1]?.kind ? item.kind : null;
          return (
            <li key={`${item.kind}-${item.label}-${item.href ?? ""}`} role="presentation">
              {heading ? <p className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">{heading}</p> : null}
              <button
                type="button"
                id={`${listId}-${index}`}
                role="option"
                aria-selected={active === index}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(item)}
                className={cn(
                  "flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm",
                  active === index ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                )}
              >
                <span>{item.label}</span>
                {item.hint ? <span className="text-xs text-muted-foreground">{item.hint}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
