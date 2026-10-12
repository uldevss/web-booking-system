"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteService, saveService } from "@/app/provider/actions";
import { FieldNote, FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_CHECK_IN, DEFAULT_CHECK_OUT, resourceKinds } from "@/lib/catalog";
import { siteConfig } from "@/lib/config";
import { checkedValues, isChecked } from "@/lib/forms";
import type { BookingType, PricingUnit, ResourceKind } from "@/lib/generated/prisma/enums";

type Service = {
  id: string;
  name: string;
  description: string | null;
  bookingType: BookingType;
  pricingUnit: PricingUnit;
  price: string;
  durationMin: number | null;
  maxGuests: number;
  checkInTime: string | null;
  checkOutTime: string | null;
  isActive: boolean;
  resourceIds: string[];
};

type ResourceOption = { id: string; name: string; kind: ResourceKind };

export function ServiceForm({
  service,
  resources,
  defaultBookingType,
}: {
  service?: Service;
  resources: ResourceOption[];
  defaultBookingType: BookingType;
}) {
  const router = useRouter();
  const [state, action] = useActionState(saveService, undefined);
  const [deleting, startDelete] = useTransition();
  const [bookingType, setBookingType] = useState<BookingType>(
    (state?.values?.bookingType as BookingType | undefined) ?? service?.bookingType ?? defaultBookingType,
  );
  const nightly = bookingType === "NIGHTLY";
  // New options default to every resource; after a failed save, keep what was ticked.
  const checkedResources = checkedValues(state, "resourceIds", service?.resourceIds ?? resources.map((r) => r.id));

  return (
    <form action={action} className="grid max-w-2xl gap-5">
      {service ? <input type="hidden" name="id" value={service.id} /> : null}
      <input type="hidden" name="bookingType" value={bookingType} />
      <FormMessage state={state} />

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">How guests book it</legend>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
          {(
            [
              { value: "TIMED", title: "A time slot", text: "Tours, escape rooms, tables, venue hire" },
              { value: "NIGHTLY", title: "Overnight stay", text: "Hotel rooms and rental units, by the night" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={bookingType === option.value}
              onClick={() => setBookingType(option.value)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                bookingType === option.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"
              }`}
            >
              <span className="block text-sm font-medium">{option.title}</span>
              <span className="block text-xs text-muted-foreground">{option.text}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <TextField
        name="name"
        label="Name"
        placeholder={nightly ? "Deluxe King Room" : "Island Hopping Tour A"}
        defaultValue={service?.name}
        required
        state={state}
      />
      <TextAreaField
        name="description"
        label="Description"
        rows={3}
        defaultValue={service?.description ?? ""}
        hint="Optional. Shown to guests."
        state={state}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="price"
          label={`Price (${siteConfig.currency})${nightly ? " per night" : ""}`}
          inputMode="decimal"
          defaultValue={service?.price ?? ""}
          placeholder="0 for free reservations"
          required
          state={state}
        />
        {nightly ? (
          <input type="hidden" name="pricingUnit" value="PER_NIGHT" />
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="pricingUnit">Charged</Label>
            <Select
              name="pricingUnit"
              defaultValue={
                state?.values?.pricingUnit ??
                (service?.pricingUnit && service.pricingUnit !== "PER_NIGHT" ? service.pricingUnit : "PER_BOOKING")
              }
            >
              <SelectTrigger id="pricingUnit" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PER_BOOKING">Per booking</SelectItem>
                <SelectItem value="PER_PERSON">Per person</SelectItem>
              </SelectContent>
            </Select>
            <FieldNote id="pricingUnit" error={state?.fields?.pricingUnit} />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {nightly ? (
          <>
            <TextField
              name="checkInTime"
              label="Check-in from"
              type="time"
              defaultValue={service?.checkInTime ?? DEFAULT_CHECK_IN}
              required
              state={state}
            />
            <TextField
              name="checkOutTime"
              label="Check-out by"
              type="time"
              defaultValue={service?.checkOutTime ?? DEFAULT_CHECK_OUT}
              required
              state={state}
            />
          </>
        ) : (
          <TextField
            name="durationMin"
            label="Length (minutes)"
            type="number"
            inputMode="numeric"
            min={5}
            max={1440}
            step={5}
            defaultValue={service?.durationMin ?? 60}
            required
            state={state}
          />
        )}
        <TextField
          name="maxGuests"
          label="Max guests"
          type="number"
          inputMode="numeric"
          min={1}
          max={1000}
          defaultValue={service?.maxGuests ?? 2}
          required
          state={state}
        />
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">
          {nightly ? "Rooms or units of this type" : "Who or what can be booked for it"}
        </legend>
        {resources.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {resources.map((resource) => (
              <div key={resource.id} className="flex items-center gap-2">
                <Checkbox
                  id={`resource-${resource.id}`}
                  name="resourceIds"
                  value={resource.id}
                  defaultChecked={checkedResources.has(resource.id)}
                />
                <Label htmlFor={`resource-${resource.id}`} className="font-normal">
                  {resource.name}
                  <span className="text-xs text-muted-foreground">({resourceKinds[resource.kind].label})</span>
                </Label>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add rooms, tables, spaces or staff under Staff & resources first; an option needs at least one to be bookable.
          </p>
        )}
      </fieldset>

      <div className="flex items-center gap-2">
        <Checkbox id="isActive" name="isActive" defaultChecked={isChecked(state, "isActive", service?.isActive ?? true)} />
        <Label htmlFor="isActive" className="font-normal">
          Guests can book this option
        </Label>
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <SubmitButton pendingText="Saving…">{service ? "Save changes" : "Create option"}</SubmitButton>
        {service ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={deleting}
            onClick={() => {
              if (!confirm(`Delete “${service.name}”? Options with bookings are deactivated instead.`)) return;
              startDelete(async () => {
                const result = await deleteService(service.id);
                if (result?.error) toast.error(result.error);
                else {
                  toast.success(result?.success ?? "Done.");
                  router.push("/provider/services");
                }
              });
            }}
          >
            <Trash2 aria-hidden />
            Delete
          </Button>
        ) : null}
      </div>
    </form>
  );
}
