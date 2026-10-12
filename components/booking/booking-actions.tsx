"use client";

import { CalendarClock, Check, CircleSlash, Loader2, UserRoundX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SlotPicker } from "@/components/booking/slot-picker";
import { StayPicker, type Stay } from "@/components/booking/stay-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BookingStatus, BookingType } from "@/lib/generated/prisma/enums";
import { formatDate, formatDateTime } from "@/lib/format";

type BookingSummary = {
  id: string;
  startAt: string;
  serviceId: string;
  resourceId: string | null;
  bookingType: BookingType;
  nights: number;
};

/** PATCH /api/bookings/:id; returns true on success. */
async function patchBooking(bookingId: string, body: object, success: string) {
  try {
    const response = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error ?? "That didn't work. Please try again.");
      return false;
    }
    toast.success(success);
    return true;
  } catch {
    toast.error("Network error. Please try again.");
    return false;
  }
}

const statusActions: Partial<Record<BookingStatus, { label: string; done: string; icon: typeof Check; variant: "default" | "outline" }>> = {
  CONFIRMED: { label: "Confirm booking", done: "Booking confirmed.", icon: Check, variant: "default" },
  COMPLETED: { label: "Mark completed", done: "Marked as completed.", icon: Check, variant: "default" },
  NO_SHOW: { label: "Mark no-show", done: "Marked as no-show.", icon: UserRoundX, variant: "outline" },
};

/**
 * The actions a viewer may take on a booking. The server decides what's
 * allowed (`allowedStatuses`, `canChange`) and checks again on submit.
 */
export function BookingActions({
  booking,
  allowedStatuses,
  canChange,
  changeBlockedReason,
  resources,
}: {
  booking: BookingSummary;
  allowedStatuses: BookingStatus[];
  /** May cancel / reschedule (policy already applied). */
  canChange: boolean;
  changeBlockedReason?: string | null;
  /** Rooms, tables, spaces or staff set up for this option, for the business to reassign. */
  resources?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, body: object, success: string) {
    setBusy(key);
    const ok = await patchBooking(booking.id, body, success);
    setBusy(null);
    if (ok) router.refresh();
    return ok;
  }

  const statusButtons = allowedStatuses.filter((status) => status !== "CANCELLED" && statusActions[status]);
  const when = booking.bookingType === "NIGHTLY" ? `stay from ${formatDate(booking.startAt)}` : `${formatDateTime(booking.startAt)} booking`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {statusButtons.map((status) => {
          const action = statusActions[status]!;
          const Icon = action.icon;
          return (
            <Button
              key={status}
              variant={action.variant}
              disabled={busy !== null}
              onClick={() => run(status, { action: "status", status }, action.done)}
            >
              {busy === status ? <Loader2 aria-hidden className="animate-spin" /> : <Icon aria-hidden />}
              {action.label}
            </Button>
          );
        })}

        {canChange ? (
          <>
            <RescheduleDialog booking={booking} onDone={() => router.refresh()} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={busy !== null} className="text-destructive hover:text-destructive">
                  <X aria-hidden />
                  Cancel booking
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The {when} will be released and everyone involved will be notified. This can&apos;t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep booking</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={() => run("cancel", { action: "cancel" }, "Booking cancelled.")}
                  >
                    Cancel booking
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : null}
      </div>

      {!canChange && changeBlockedReason ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <CircleSlash aria-hidden className="mt-0.5 size-4 shrink-0" />
          {changeBlockedReason}
        </p>
      ) : null}

      {resources && canChange ? (
        <AssignResource bookingId={booking.id} current={booking.resourceId} resources={resources} onDone={() => router.refresh()} />
      ) : null}
    </div>
  );
}

function RescheduleDialog({ booking, onDone }: { booking: BookingSummary; onDone: () => void }) {
  const nightly = booking.bookingType === "NIGHTLY";
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [nights, setNights] = useState(booking.nights);
  const [stay, setStay] = useState<Stay | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const chosen = nightly ? Boolean(stay) : Boolean(start);

  async function save() {
    if (!chosen) return;
    setSaving(true);
    const body = nightly
      ? { action: "reschedule", checkIn: stay!.checkIn, nights }
      : { action: "reschedule", startAt: start };
    const ok = await patchBooking(booking.id, body, "Booking rescheduled.");
    setSaving(false);
    if (ok) {
      setOpen(false);
      onDone();
    } else {
      setStart(null);
      setStay(null);
      setRefreshKey((key) => key + 1);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setStart(null);
          setStay(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <CalendarClock aria-hidden />
          {nightly ? "Change dates" : "Reschedule"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{nightly ? "Pick new dates" : "Pick a new time"}</DialogTitle>
          <DialogDescription>
            {nightly ? "Only dates with a free room or unit for the whole stay are shown." : "Only times that are still free are shown."}
          </DialogDescription>
        </DialogHeader>
        {nightly ? (
          <StayPicker
            serviceId={booking.serviceId}
            excludeBookingId={booking.id}
            nights={nights}
            onNightsChange={setNights}
            value={stay?.checkIn ?? null}
            onChange={setStay}
            refreshKey={refreshKey}
          />
        ) : (
          <SlotPicker
            serviceId={booking.serviceId}
            excludeBookingId={booking.id}
            value={start}
            onChange={setStart}
            refreshKey={refreshKey}
          />
        )}
        <DialogFooter>
          <Button onClick={save} disabled={!chosen || saving}>
            {saving ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {nightly
              ? stay
                ? `Move to ${formatDate(stay.start)} (${nights} night${nights === 1 ? "" : "s"})`
                : "Choose dates"
              : start
                ? `Move to ${formatDateTime(start)}`
                : "Choose a time"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignResource({
  bookingId,
  current,
  resources,
  onDone,
}: {
  bookingId: string;
  current: string | null;
  resources: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [resourceId, setResourceId] = useState(current ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const ok = await patchBooking(bookingId, { action: "assign", resourceId }, "Booking reassigned.");
    setSaving(false);
    if (ok) onDone();
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1.5">
        <Label htmlFor="assign-resource">Assigned to</Label>
        <Select value={resourceId} onValueChange={setResourceId}>
          <SelectTrigger id="assign-resource" className="w-64">
            <SelectValue placeholder="Choose a room, table or person" />
          </SelectTrigger>
          <SelectContent>
            {resources.map((resource) => (
              <SelectItem key={resource.id} value={resource.id}>
                {resource.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button variant="secondary" onClick={save} disabled={saving || !resourceId || resourceId === current}>
        {saving ? <Loader2 aria-hidden className="animate-spin" /> : null}
        Reassign
      </Button>
    </div>
  );
}
