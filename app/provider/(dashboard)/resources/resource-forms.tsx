"use client";

import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { createResource, createStaff, setResourceActive, updateResourceServices } from "@/app/provider/actions";
import { FormMessage, SubmitButton, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resourceKinds } from "@/lib/catalog";
import { checkedValues, type FormState } from "@/lib/forms";

type ServiceOption = { id: string; name: string };

function ServiceChecklist({ services, checked }: { services: ServiceOption[]; checked: Set<string> }) {
  if (!services.length) {
    return <p className="text-sm text-muted-foreground">No booking options yet. You can link them later.</p>;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {services.map((service) => (
        <div key={service.id} className="flex items-center gap-2">
          <Checkbox id={`service-${service.id}`} name="serviceIds" value={service.id} defaultChecked={checked.has(service.id)} />
          <Label htmlFor={`service-${service.id}`} className="font-normal">
            {service.name}
          </Label>
        </div>
      ))}
    </div>
  );
}

const resourceKindOptions = (["ROOM", "UNIT", "TABLE", "SPACE"] as const).map((kind) => ({
  value: kind,
  label: resourceKinds[kind].label,
}));

/** Rooms, rental units, tables and spaces: bookable, but no login. */
export function ResourceCreateForm({ services, defaultKind }: { services: ServiceOption[]; defaultKind: string }) {
  const [state, action] = useActionState(createResource, undefined);
  return (
    <form action={action} className="grid max-w-2xl gap-5">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="resource-kind">Type</Label>
          <Select name="kind" defaultValue={state?.values?.kind ?? defaultKind}>
            <SelectTrigger id="resource-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {resourceKindOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state?.fields?.kind ? <p className="text-sm text-destructive">{state.fields.kind}</p> : null}
        </div>
        <TextField name="name" label="Name" placeholder="Room 1201, Table 4, Garden Pavilion" required state={state} />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Booking options it can be used for</legend>
        <ServiceChecklist services={services} checked={checkedValues(state, "serviceIds", services.map((s) => s.id))} />
      </fieldset>
      <div>
        <SubmitButton pendingText="Adding…">Add resource</SubmitButton>
      </div>
    </form>
  );
}

/** Staff such as tour guides: they get a login to see their bookings. */
export function StaffCreateForm({ services }: { services: ServiceOption[] }) {
  const [state, action] = useActionState(createStaff, undefined);
  return (
    <form action={action} className="grid max-w-2xl gap-5">
      <FormMessage state={state} />
      <TextField name="name" label="Full name" required state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="email" label="Email (their login)" type="email" required state={state} />
        <TextField name="phone" label="Mobile number" type="tel" state={state} />
      </div>
      <TextField
        name="password"
        label="Temporary password"
        type="text"
        autoComplete="off"
        minLength={8}
        required
        hint="Share it with them privately. They can change it under Profile after logging in."
        state={state}
      />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Booking options they handle</legend>
        <ServiceChecklist services={services} checked={checkedValues(state, "serviceIds", services.map((s) => s.id))} />
      </fieldset>
      <div>
        <SubmitButton pendingText="Adding…">Add staff member</SubmitButton>
      </div>
    </form>
  );
}

export function ResourceServicesForm({
  resourceId,
  services,
  assigned,
}: {
  resourceId: string;
  services: ServiceOption[];
  assigned: string[];
}) {
  const [state, action] = useActionState<FormState, FormData>(updateResourceServices.bind(null, resourceId), undefined);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <ServiceChecklist services={services} checked={checkedValues(state, "serviceIds", assigned)} />
      <div>
        <SubmitButton variant="secondary" pendingText="Saving…">
          Save
        </SubmitButton>
      </div>
    </form>
  );
}

export function ResourceStatusButton({ resourceId, isActive, isStaff }: { resourceId: string; isActive: boolean; isStaff: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={isActive ? "outline" : "default"}
      disabled={pending}
      className={isActive ? "text-destructive hover:text-destructive" : undefined}
      onClick={() => {
        const warning = isStaff
          ? "Deactivate this staff member? They won't get new bookings or be able to log in."
          : "Deactivate this resource? It won't get new bookings.";
        if (isActive && !confirm(warning)) return;
        startTransition(async () => {
          const result = await setResourceActive(resourceId, !isActive);
          if (result?.error) toast.error(result.error);
          else toast.success(result?.success ?? "Saved.");
        });
      }}
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
