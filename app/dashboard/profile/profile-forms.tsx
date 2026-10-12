"use client";

import { Loader2, Upload } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { changePassword, updateAvatar, updateProfile } from "@/app/dashboard/profile/actions";
import { FormMessage, PasswordField, SubmitButton, TextField } from "@/components/form-fields";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { initials } from "@/lib/format";

export function ProfileForm({ user }: { user: { name: string; phone: string | null; emailNotifications: boolean } }) {
  const [state, action] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <TextField name="name" label="Full name" defaultValue={user.name} autoComplete="name" required state={state} />
      <TextField name="phone" label="Mobile number" type="tel" defaultValue={user.phone ?? ""} autoComplete="tel" state={state} />
      <div className="flex items-start gap-3">
        <Checkbox id="emailNotifications" name="emailNotifications" defaultChecked={user.emailNotifications} />
        <div className="grid gap-1">
          <Label htmlFor="emailNotifications">Email me about my bookings</Label>
          <p className="text-xs text-muted-foreground">
            Confirmations, reminders and changes. You&apos;ll always see them under Notifications.
          </p>
        </div>
      </div>
      <div>
        <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <PasswordField name="currentPassword" label="Current password" autoComplete="current-password" required state={state} />
      <PasswordField
        name="newPassword"
        label="New password"
        autoComplete="new-password"
        minLength={8}
        required
        hint="At least 8 characters."
        state={state}
      />
      <PasswordField name="confirmPassword" label="Confirm new password" autoComplete="new-password" required state={state} />
      <div>
        <SubmitButton pendingText="Saving…">Change password</SubmitButton>
      </div>
    </form>
  );
}

/** Crops the chosen image to a square and shrinks it to 160px JPEG before upload. */
async function resizeImage(file: File, size = 160): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas not supported");
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function AvatarUpload({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(avatarUrl);
  const [pending, startTransition] = useTransition();

  function save(dataUrl: string) {
    startTransition(async () => {
      const result = await updateAvatar(dataUrl);
      if (result?.error) {
        toast.error(result.error);
        setPreview(avatarUrl);
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
    try {
      const dataUrl = await resizeImage(file);
      setPreview(dataUrl);
      save(dataUrl);
    } catch {
      toast.error("Couldn't read that image. Try a JPEG or PNG.");
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        {preview ? <AvatarImage src={preview} alt="" /> : null}
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Upload a profile photo"
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <Button type="button" variant="outline" disabled={pending} onClick={() => input.current?.click()}>
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Upload aria-hidden />}
          Upload photo
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
  );
}
