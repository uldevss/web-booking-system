"use client";

import { Loader2, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const labels = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

export function ReviewForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!rating) {
      setError("Pick a rating from 1 to 5 stars.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Couldn't save your review.");
        return;
      }
      toast.success("Thanks for your review!");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const shown = hover || rating;

  return (
    <form onSubmit={submit} className="grid gap-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Your rating</legend>
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              aria-label={`${star} star${star === 1 ? "" : "s"}: ${labels[star]}`}
              aria-pressed={rating === star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHover(star)}
              className="rounded p-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Star
                aria-hidden
                className={cn(
                  "size-7 transition-colors",
                  star <= shown ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
                )}
              />
            </button>
          ))}
          <span className="ml-2 text-sm text-muted-foreground">{labels[shown]}</span>
        </div>
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor="review-comment">Comment (optional)</Label>
        <Textarea
          id="review-comment"
          value={comment}
          maxLength={1000}
          onChange={(event) => setComment(event.target.value)}
          placeholder="What did you like? What could be better?"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 aria-hidden className="animate-spin" /> : null}
          Submit review
        </Button>
      </div>
    </form>
  );
}
