"use client";

import { Copy, Loader2, Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveSchedule } from "@/app/provider/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findScheduleProblem, toWorkingRanges } from "@/lib/slots";

type Shift = { dayOfWeek: number; startTime: string; endTime: string };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Monday first, as most schedules are written.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Order-independent fingerprint, to tell whether there are unsaved changes. */
const fingerprint = (shifts: Shift[]) =>
  shifts
    .map((s) => `${s.dayOfWeek}-${s.startTime}-${s.endTime}`)
    .sort()
    .join("|");

/** Weekly opening hours with any number of periods per day (e.g. lunch and dinner service). */
export function ScheduleEditor({ resourceId, initial }: { resourceId: string; initial: Shift[] }) {
  const [shifts, setShifts] = useState<Shift[]>(initial);
  const [saved, setSaved] = useState(() => fingerprint(initial));
  const [pending, startTransition] = useTransition();
  const problem = findScheduleProblem(toWorkingRanges(shifts));
  const dirty = fingerprint(shifts) !== saved;

  const update = (index: number, patch: Partial<Shift>) =>
    setShifts((all) => all.map((shift, i) => (i === index ? { ...shift, ...patch } : shift)));
  const remove = (index: number) => setShifts((all) => all.filter((_, i) => i !== index));
  const add = (dayOfWeek: number) => setShifts((all) => [...all, { dayOfWeek, startTime: "09:00", endTime: "17:00" }]);
  const copyToWeekdays = (dayOfWeek: number) =>
    setShifts((all) => {
      const template = all.filter((shift) => shift.dayOfWeek === dayOfWeek);
      const others = all.filter((shift) => shift.dayOfWeek === 0 || shift.dayOfWeek === 6 || shift.dayOfWeek === dayOfWeek);
      const copies = [1, 2, 3, 4, 5]
        .filter((day) => day !== dayOfWeek)
        .flatMap((day) => template.map((shift) => ({ ...shift, dayOfWeek: day })));
      return [...others, ...copies];
    });

  function save() {
    startTransition(async () => {
      const result = await saveSchedule(resourceId, shifts);
      if (result?.error) {
        toast.error(result.error);
      } else {
        setSaved(fingerprint(shifts));
        toast.success(result?.success ?? "Saved.");
      }
    });
  }

  return (
    <div className="grid gap-4">
      <ul className="divide-y rounded-lg border">
        {ORDER.map((day) => {
          const dayShifts = shifts.map((shift, index) => ({ shift, index })).filter(({ shift }) => shift.dayOfWeek === day);
          return (
            <li key={day} className="grid gap-2 p-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start">
              <p className="pt-2 text-sm font-medium">{DAYS[day]}</p>
              <div className="grid gap-2">
                {dayShifts.length === 0 ? <p className="pt-2 text-sm text-muted-foreground">Closed</p> : null}
                {dayShifts.map(({ shift, index }) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <Input
                      type="time"
                      step={900}
                      value={shift.startTime}
                      aria-label={`${DAYS[day]} start`}
                      onChange={(event) => update(index, { startTime: event.target.value })}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      type="time"
                      step={900}
                      value={shift.endTime}
                      aria-label={`${DAYS[day]} end`}
                      onChange={(event) => update(index, { endTime: event.target.value })}
                      className="w-32"
                    />
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove period" onClick={() => remove(index)}>
                      <X aria-hidden />
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => add(day)}>
                    <Plus aria-hidden />
                    {dayShifts.length ? "Add another period" : "Add hours"}
                  </Button>
                  {dayShifts.length && day >= 1 && day <= 5 ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => copyToWeekdays(day)}>
                      <Copy aria-hidden />
                      Copy to Mon–Fri
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {problem ? (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending || !!problem || !dirty}>
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
          Save hours
        </Button>
        {dirty ? <span className="text-sm text-muted-foreground">Unsaved changes</span> : null}
      </div>
    </div>
  );
}
