"use client";

import { Loader2 } from "lucide-react";
import { useTransition, type ComponentProps } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";

/** Runs a bound server action (optionally after a confirm prompt) and toasts the result. */
export function ActionButton({
  action,
  confirmText,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "action"> & {
  action: () => Promise<FormState>;
  confirmText?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      onClick={() => {
        if (confirmText && !confirm(confirmText)) return;
        startTransition(async () => {
          const result = await action();
          if (result?.error) toast.error(result.error);
          else if (result?.success) toast.success(result.success);
        });
      }}
    >
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
