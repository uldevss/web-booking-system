"use client";

import { Loader2, Upload } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateGcashQr, updatePlatformSettings } from "@/app/admin/settings/actions";
import { FormMessage, SubmitButton, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";

export function PaymentSettingsForm({
  settings,
}: {
  settings: { gcashName: string; gcashNumber: string; commissionPercent: string };
}) {
  const [state, action] = useActionState(updatePlatformSettings, undefined);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <TextField name="gcashName" label="GCash account name" defaultValue={settings.gcashName} required state={state} />
      <TextField
        name="gcashNumber"
        label="GCash number"
        defaultValue={settings.gcashNumber}
        inputMode="tel"
        required
        hint="Guests send deposits and full payments to this number."
        state={state}
      />
      <TextField
        name="commissionPercent"
        label="Platform commission (%)"
        defaultValue={settings.commissionPercent}
        inputMode="decimal"
        required
        className="max-w-xs"
        hint="Kept by the platform from every confirmed payment. Businesses receive the rest."
        state={state}
      />
      <div>
        <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
      </div>
    </form>
  );
}

/** Reads a small image file as a data: URL without resizing (QR codes must stay crisp). */
function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function QrUpload({ qrUrl }: { qrUrl: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(qrUrl);
  const [pending, startTransition] = useTransition();

  function save(dataUrl: string) {
    startTransition(async () => {
      const result = await updateGcashQr(dataUrl);
      if (result?.error) {
        toast.error(result.error);
        setPreview(qrUrl);
      } else {
        toast.success(result?.success ?? "Saved.");
      }
    });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > 400_000) {
      toast.error("That image is too large (max 400 KB). Export the QR at a smaller size.");
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      setPreview(dataUrl);
      save(dataUrl);
    } catch {
      toast.error("Couldn't read that image.");
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex size-40 items-center justify-center rounded-lg border bg-white p-2">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="GCash QR code" className="max-h-full max-w-full" />
        ) : (
          <span className="text-center text-xs text-muted-foreground">No QR yet</span>
        )}
      </div>
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">
          Open the GCash app, go to <strong>QR</strong> → <strong>Generate QR</strong>, save the image and upload it here.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="sr-only"
            aria-label="Upload the GCash QR image"
            onChange={(event) => {
              void onFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button type="button" variant="outline" disabled={pending} onClick={() => input.current?.click()}>
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Upload aria-hidden />}
            Upload QR image
          </Button>
          {preview ? (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setPreview(null);
                save("");
              }}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
