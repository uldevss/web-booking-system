"use client";

import { CheckCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function MarkAllRead() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ all: true }),
          });
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : <CheckCheck aria-hidden />}
      Mark all as read
    </Button>
  );
}
