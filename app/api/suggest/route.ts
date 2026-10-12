import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { categories, categoryLabel } from "@/lib/catalog";
import { AppError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// GET /api/suggest?scope=catalog|bookings|users&q=...
// Autocomplete for the search boxes. Each scope only reveals what the caller
// may already see: the catalog is public, bookings are scoped to the signed-in
// business (or everything for admins), and users are admin-only.

export type Suggestion = {
  /** Main text shown in the list; also what the box fills in when there's no href. */
  label: string;
  hint?: string;
  /** Jump straight to a page instead of searching for the label. */
  href?: string;
  /** Group heading. */
  kind: string;
};

const querySchema = z.object({
  scope: z.enum(["catalog", "bookings", "users"]),
  q: z.string().trim().min(1).max(100),
});

const LIMIT = 8;
const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });

async function catalog(q: string): Promise<Suggestion[]> {
  const [services, providers] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true, provider: { isApproved: true }, resources: { some: { isActive: true } }, name: contains(q) },
      select: { id: true, name: true, provider: { select: { businessName: true } } },
      orderBy: { name: "asc" },
      take: 5,
    }),
    prisma.provider.findMany({
      where: { isApproved: true, businessName: contains(q) },
      select: { id: true, businessName: true, category: true },
      orderBy: { businessName: "asc" },
      take: 4,
    }),
  ]);
  const lower = q.toLowerCase();
  const matchedCategories = categories.filter(
    (c) => c.label.toLowerCase().includes(lower) || c.singular.toLowerCase().includes(lower) || c.blurb.toLowerCase().includes(lower),
  );
  return [
    ...matchedCategories.slice(0, 2).map((c) => ({ kind: "Categories", label: c.label, hint: c.blurb, href: `/services?category=${c.key}` })),
    ...services.map((s) => ({ kind: "Booking options", label: s.name, hint: s.provider.businessName, href: `/book/${s.id}` })),
    ...providers.map((p) => ({ kind: "Businesses", label: p.businessName, hint: categoryLabel(p.category), href: `/providers/${p.id}` })),
  ].slice(0, LIMIT);
}

async function bookings(q: string): Promise<Suggestion[]> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "PROVIDER" && user.role !== "ADMIN")) throw new AppError("FORBIDDEN", "Not allowed.");
  const provider = user.role === "PROVIDER" ? await prisma.provider.findUnique({ where: { ownerId: user.id }, select: { id: true } }) : null;
  if (user.role === "PROVIDER" && !provider) throw new AppError("FORBIDDEN", "Not allowed.");
  const scope = provider ? { providerId: provider.id } : {};
  const base = user.role === "PROVIDER" ? "/provider/bookings" : "/admin/bookings";

  const [guests, byCode] = await Promise.all([
    prisma.user.findMany({
      where: { bookings: { some: scope }, OR: [{ name: contains(q) }, { email: contains(q) }] },
      select: { name: true, email: true },
      orderBy: { name: "asc" },
      take: 5,
    }),
    q.length >= 4
      ? prisma.booking.findMany({
          where: { ...scope, id: { endsWith: q.toLowerCase() } },
          select: { id: true, startAt: true, service: { select: { name: true } }, customer: { select: { name: true } } },
          take: 3,
        })
      : [],
  ]);
  return [
    ...guests.map((g) => ({ kind: "Guests", label: g.name, hint: g.email })),
    ...byCode.map((b) => ({
      kind: "Bookings",
      label: `Booking ${b.id.slice(-8).toUpperCase()}`,
      hint: `${b.customer.name} · ${b.service.name} · ${formatDate(b.startAt)}`,
      href: `${base}/${b.id}`,
    })),
  ].slice(0, LIMIT);
}

async function users(q: string): Promise<Suggestion[]> {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") throw new AppError("FORBIDDEN", "Not allowed.");
  const rows = await prisma.user.findMany({
    where: { OR: [{ name: contains(q) }, { email: contains(q) }, { phone: contains(q) }] },
    select: { name: true, email: true, role: true },
    orderBy: { name: "asc" },
    take: LIMIT,
  });
  return rows.map((u) => ({ kind: "People", label: u.name, hint: `${u.email} · ${u.role.toLowerCase()}` }));
}

export const GET = handle(async (request: Request) => {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ scope: url.searchParams.get("scope"), q: url.searchParams.get("q") ?? "" });
  if (!parsed.success) return NextResponse.json({ suggestions: [] });
  const { scope, q } = parsed.data;
  const suggestions = scope === "catalog" ? await catalog(q) : scope === "bookings" ? await bookings(q) : await users(q);
  return NextResponse.json({ suggestions });
});
