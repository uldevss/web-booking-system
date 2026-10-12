"use client";

import { ArrowLeft, CalendarClock, Clock, Loader2, MapPin, Moon, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SlotPicker } from "@/components/booking/slot-picker";
import { StayPicker, type Stay } from "@/components/booking/stay-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { amountDueFor, bookingTotal, guestsLabel, priceLabel } from "@/lib/catalog";
import { siteConfig } from "@/lib/config";
import type { BookingType, PricingUnit } from "@/lib/generated/prisma/enums";
import { formatDate, formatDateTime, formatDuration, formatMoney, timeZoneLabel } from "@/lib/format";
import { zonedTimeToUtc } from "@/lib/time";

type Service = {
  id: string;
  name: string;
  bookingType: BookingType;
  pricingUnit: PricingUnit;
  price: string;
  durationMin: number | null;
  maxGuests: number;
  provider: { businessName: string; address: string | null };
};

type Gcash = { name: string; number: string; qrUrl: string | null };

type Initial = { start: string | null; checkIn: string | null; nights: number; guests: number };
type Plan = "DEPOSIT" | "FULL";

/**
 * Two steps on one page: choose (a time, or dates for a stay) and party size,
 * then review and confirm. Signed-out visitors are sent to log in and come
 * back with their choice still selected.
 */
export function BookingFlow({
  service,
  viewer,
  initial,
  depositPercent,
  gcash,
}: {
  service: Service;
  viewer: "guest" | "customer" | "other";
  initial: Initial;
  /** Share of the price due upfront when choosing the deposit plan. */
  depositPercent: number;
  /** The platform's GCash account every payment goes to. */
  gcash: Gcash;
}) {
  const router = useRouter();
  const nightly = service.bookingType === "NIGHTLY";
  const [start, setStart] = useState<string | null>(initial.start);
  const [nights, setNights] = useState(initial.nights);
  const [stay, setStay] = useState<Stay | null>(null);
  const [checkIn, setCheckIn] = useState<string | null>(initial.checkIn);
  const [guests, setGuests] = useState(Math.min(Math.max(initial.guests, 1), service.maxGuests));
  const chosen = nightly ? Boolean(checkIn) : Boolean(start);
  const [step, setStep] = useState<"pick" | "confirm">(chosen && viewer === "customer" ? "confirm" : "pick");
  const [notes, setNotes] = useState("");
  const [plan, setPlan] = useState<Plan>("DEPOSIT");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const total = bookingTotal(service, guests, nights);
  const free = total === 0;
  const deposit = amountDueFor(total, "DEPOSIT", depositPercent);
  const due = plan === "FULL" ? total : deposit;
  const paymentReady = free || reference.trim().length >= 4;
  const returnQuery = new URLSearchParams({ guests: String(guests) });
  if (nightly && checkIn) {
    returnQuery.set("checkIn", checkIn);
    returnQuery.set("nights", String(nights));
  }
  if (!nightly && start) returnQuery.set("start", start);
  const loginHref = `/login?callbackUrl=${encodeURIComponent(`/book/${service.id}?${returnQuery}`)}`;

  async function confirm() {
    if (!chosen || !paymentReady) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          guests,
          notes,
          ...(nightly ? { checkIn, nights } : { startAt: start }),
          ...(free ? {} : { payment: { plan, method: "GCASH", reference: reference.trim() } }),
        }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push(loginHref);
        return;
      }
      if (!response.ok) {
        setError(data.error ?? "Booking failed. Please try again.");
        if (response.status === 409) {
          // Taken meanwhile: choose again with fresh availability.
          setStart(null);
          setCheckIn(null);
          setStay(null);
          setStep("pick");
          setRefreshKey((key) => key + 1);
        }
        return;
      }
      router.push(`/dashboard/bookings/${data.booking.id}?booked=1`);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const guestPicker =
    service.maxGuests > 1 ? (
      <div className="grid gap-1.5">
        <Label htmlFor="guests">Guests</Label>
        <Select value={String(guests)} onValueChange={(value) => setGuests(Number(value))}>
          <SelectTrigger id="guests" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: Math.min(service.maxGuests, 50) }, (_, i) => i + 1).map((count) => (
              <SelectItem key={count} value={String(count)}>
                {count} guest{count === 1 ? "" : "s"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ) : null;

  const summary = (
    <dl className="grid gap-3 text-sm">
      <div className="flex items-start gap-3">
        <CalendarClock aria-hidden className="mt-0.5 size-4 text-muted-foreground" />
        <div>
          <dt className="sr-only">When</dt>
          {nightly ? (
            stay || checkIn ? (
              <>
                <dd className="font-medium">
                  Check-in {stay ? formatDateTime(stay.start) : formatDate(zonedTimeToUtc(checkIn!, 12 * 60, siteConfig.timeZone))}
                </dd>
                {stay ? <dd className="text-muted-foreground">Check-out {formatDateTime(stay.end)}</dd> : null}
              </>
            ) : (
              <dd className="font-medium">Choose your dates</dd>
            )
          ) : (
            <>
              <dd className="font-medium">{start ? formatDateTime(start) : "Pick a time"}</dd>
              {start ? <dd className="text-muted-foreground">{timeZoneLabel(start)}</dd> : null}
            </>
          )}
        </div>
      </div>
      <div className="flex items-start gap-3">
        {nightly ? <Moon aria-hidden className="mt-0.5 size-4 text-muted-foreground" /> : <Clock aria-hidden className="mt-0.5 size-4 text-muted-foreground" />}
        <div>
          <dt className="sr-only">Length</dt>
          <dd>{nightly ? `${nights} night${nights === 1 ? "" : "s"}` : formatDuration(service.durationMin ?? 0)}</dd>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <Users aria-hidden className="mt-0.5 size-4 text-muted-foreground" />
        <div>
          <dt className="sr-only">Guests</dt>
          <dd>
            {guests} guest{guests === 1 ? "" : "s"}
            <span className="text-muted-foreground"> · {guestsLabel(service.maxGuests).toLowerCase()}</span>
          </dd>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <MapPin aria-hidden className="mt-0.5 size-4 text-muted-foreground" />
        <div>
          <dt className="sr-only">Where</dt>
          <dd>{service.provider.businessName}</dd>
          {service.provider.address ? <dd className="text-muted-foreground">{service.provider.address}</dd> : null}
        </div>
      </div>
      <div className="flex items-baseline justify-between border-t pt-3">
        <dt className="text-muted-foreground">Total</dt>
        <dd className="text-base font-semibold tabular-nums">{total === 0 ? "Free" : formatMoney(total)}</dd>
      </div>
    </dl>
  );

  if (step === "confirm" && chosen) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Confirm your booking</CardTitle>
          <CardDescription>
            {service.name} · {priceLabel(service)}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {summary}
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Requests for the business (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              maxLength={500}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={nightly ? "Arrival time, bed preference, special occasion…" : "Occasion, dietary needs, accessibility…"}
            />
          </div>
          {free ? (
            <p className="text-xs text-muted-foreground">This option is free. The business confirms your booking.</p>
          ) : (
            <fieldset className="grid gap-4 rounded-lg border p-4">
              <legend className="px-1 text-sm font-semibold">Payment</legend>
              <div role="radiogroup" aria-label="How much to pay now" className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    { value: "DEPOSIT", title: `${depositPercent}% deposit`, amount: deposit, note: "Pay the rest to the business on arrival." },
                    { value: "FULL", title: "Pay in full", amount: total, note: "Nothing more to pay later." },
                  ] as { value: Plan; title: string; amount: number; note: string }[]
                ).map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${plan === option.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={option.value}
                      checked={plan === option.value}
                      onChange={() => setPlan(option.value)}
                      className="mt-0.5 accent-primary"
                    />
                    <span>
                      <span className="block font-medium">
                        {option.title} · {formatMoney(option.amount)}
                      </span>
                      <span className="block text-xs text-muted-foreground">{option.note}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="grid gap-4 rounded-md bg-muted/40 p-4 sm:grid-cols-[auto_1fr]">
                {gcash.qrUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={gcash.qrUrl} alt="GCash QR code" className="size-40 rounded-md bg-white p-1" />
                ) : null}
                <div className="grid content-start gap-2 text-sm">
                  <p className="font-medium">
                    Pay {formatMoney(due)} with GCash
                  </p>
                  <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
                    <li>
                      Open GCash and {gcash.qrUrl ? "scan the QR, or send to " : "send to "}
                      <span className="font-medium text-foreground">{gcash.number}</span> ({gcash.name}).
                    </li>
                    <li>Enter exactly {formatMoney(due)}.</li>
                    <li>Copy the reference number from the GCash receipt and enter it below.</li>
                  </ol>
                </div>
              </div>
              <div className="grid gap-1.5 sm:max-w-sm">
                <Label htmlFor="pay-reference">GCash reference number</Label>
                <Input
                  id="pay-reference"
                  value={reference}
                  maxLength={100}
                  inputMode="numeric"
                  placeholder="e.g. 1234567890123"
                  onChange={(event) => setReference(event.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The business checks your payment and confirms the booking. If it can&apos;t be verified, the booking may be cancelled.
              </p>
            </fieldset>
          )}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <Button variant="ghost" onClick={() => setStep("pick")} disabled={submitting}>
            <ArrowLeft aria-hidden />
            Change
          </Button>
          <Button onClick={confirm} disabled={submitting || !paymentReady}>
            {submitting ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {free ? "Confirm booking" : `I've paid ${formatMoney(due)}, book it`}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader>
          <CardTitle>{nightly ? "Choose your dates" : "Choose a date and time"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          {error ? (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {guestPicker}
          {nightly ? (
            <StayPicker
              serviceId={service.id}
              nights={nights}
              onNightsChange={setNights}
              value={checkIn}
              onChange={(next) => {
                setStay(next);
                setCheckIn(next?.checkIn ?? null);
              }}
              refreshKey={refreshKey}
            />
          ) : (
            <SlotPicker serviceId={service.id} value={start} onChange={setStart} refreshKey={refreshKey} />
          )}
        </CardContent>
      </Card>

      <Card className="self-start">
        <CardHeader>
          <CardTitle className="text-base">{service.name}</CardTitle>
          <CardDescription>{priceLabel(service)}</CardDescription>
        </CardHeader>
        <CardContent>{summary}</CardContent>
        <CardFooter>
          {viewer === "customer" ? (
            <Button className="w-full" disabled={!chosen} onClick={() => setStep("confirm")}>
              Continue
            </Button>
          ) : viewer === "guest" ? (
            <Button className="w-full" disabled={!chosen} asChild={chosen}>
              {chosen ? <Link href={loginHref}>Log in to book</Link> : <span>Log in to book</span>}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Only guest accounts can make bookings.</p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
