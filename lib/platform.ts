import "server-only";
import { prisma } from "./prisma";

// Platform-wide settings: the GCash account guests pay into and the commission
// the platform keeps from each confirmed payment. One row, id "default".

export async function getPlatformSettings() {
  return prisma.platformSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
}

export type PlatformSettings = Awaited<ReturnType<typeof getPlatformSettings>>;

/** What guests see at checkout. */
export function gcashDetails(settings: PlatformSettings) {
  return { name: settings.gcashName, number: settings.gcashNumber, qrUrl: settings.gcashQrUrl };
}

/** Commission on an amount at the given percent, rounded to centavos. */
export function commissionOn(amount: number, percent: number) {
  return Math.round(amount * percent) / 100;
}
