"use client";

import { CategoryGlyph } from "@/components/category";
import { FieldNote } from "@/components/form-fields";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { categories } from "@/lib/catalog";
import type { FormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

/** Business category picker for server-action forms; submits as `category`. */
export function CategorySelect({
  state,
  defaultValue,
  hint,
  className,
}: {
  state?: FormState;
  defaultValue?: string;
  hint?: string;
  className?: string;
}) {
  const name = "category";
  const id = `field-${name}`;
  const error = state?.fields?.[name];
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>Business type</Label>
      <Select name={name} required defaultValue={state?.values?.[name] ?? defaultValue}>
        <SelectTrigger
          id={id}
          className="w-full"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        >
          <SelectValue placeholder="Choose a type" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((category) => (
            <SelectItem key={category.key} value={category.key}>
              <CategoryGlyph category={category.key} className="text-muted-foreground" />
              {category.singular}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldNote id={id} error={error} hint={hint} />
    </div>
  );
}
