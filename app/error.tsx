"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">Please try again. If it keeps happening, contact support.</p>
      {error.digest ? <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
