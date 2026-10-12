"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PaymentMethod, PaymentStatus } from "@/lib/generated/prisma/enums";

const methods: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "GCASH", label: "GCash" },
  { value: "CARD", label: "Card" },
  { value: "BANK", label: "Bank transfer" },
];

const statuses: { value: PaymentStatus; label: string }[] = [
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIAL", label: "Partially paid" },
  { value: "PAID", label: "Fully paid" },
  { value: "REFUNDED", label: "Refunded" },
];

/** Provider records a payment taken at the venue. Nothing is charged here. */
export function PaymentForm({
  bookingId,
  price,
  payment,
}: {
  bookingId: string;
  price: string;
  payment: {
    status: PaymentStatus;
    plan: "DEPOSIT" | "FULL";
    amountDue: string;
    amountPaid: string;
    method: PaymentMethod;
    reference: string | null;
  } | null;
}) {
  const router = useRouter();
  // Default to confirming what the guest reported: a deposit counts as a partial payment.
  const reported = payment?.status === "UNPAID" && Number(payment.amountDue) > 0;
  const [status, setStatus] = useState<PaymentStatus>(
    payment && payment.status !== "UNPAID" ? payment.status : reported && payment.plan === "DEPOSIT" ? "PARTIAL" : "PAID",
  );
  const [amount, setAmount] = useState(
    payment && payment.status !== "UNPAID" ? payment.amountPaid : reported ? payment.amountDue : price,
  );
  const [method, setMethod] = useState<PaymentMethod>(payment?.method ?? "CASH");
  const [reference, setReference] = useState(payment?.reference ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/payment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, amountPaid: status === "UNPAID" ? "0" : amount, method, reference }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Couldn't save the payment.");
        return;
      }
      toast.success("Payment saved.");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor="payment-status">Status</Label>
        <Select
          value={status}
          onValueChange={(value: PaymentStatus) => {
            setStatus(value);
            if (value === "PAID") setAmount(price);
          }}
        >
          <SelectTrigger id="payment-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="payment-method">Method</Label>
        <Select value={method} onValueChange={(value: PaymentMethod) => setMethod(value)}>
          <SelectTrigger id="payment-method" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {methods.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="payment-amount">Amount paid</Label>
        <Input
          id="payment-amount"
          inputMode="decimal"
          value={status === "UNPAID" ? "0" : amount}
          disabled={status === "UNPAID"}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="payment-reference">Reference no. (optional)</Label>
        <Input
          id="payment-reference"
          value={reference}
          maxLength={100}
          placeholder="GCash ref. or receipt no."
          onChange={(event) => setReference(event.target.value)}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {error}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 aria-hidden className="animate-spin" /> : null}
          Save payment
        </Button>
      </div>
    </form>
  );
}
