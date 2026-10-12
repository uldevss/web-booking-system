// Generates a demo GCash QR image (SVG data URL) for the platform settings.
// Real GCash QR codes are issued by GCash; the admin uploads theirs in
// /admin/settings. Used by the seed.

import QRCode from "qrcode";

/** A QR encoding a placeholder payload, as a data: URL that <img> can show. */
export async function demoGcashQr(name: string, number: string) {
  const payload = `DEMO GCASH QR | ${name} | ${number.replaceAll(" ", "")}`;
  const svg = await QRCode.toString(payload, { type: "svg", margin: 1, width: 320, color: { dark: "#0a2a5e", light: "#ffffff" } });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
