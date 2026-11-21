import React from "react";
import { CheckoutSession, QrCheckoutClient } from "./checkout-client";

export const dynamic = "force-dynamic";

export default async function QrPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ sig?: string | string[] }>;
}) {
  const { sessionId } = await params;
  const resolvedSearch = await searchParams;
  const rawSig = resolvedSearch?.sig;
  const sig = Array.isArray(rawSig) ? rawSig[0] || "" : rawSig || "";

  if (!sessionId || !sig) {
    return (
      <QrCheckoutClient
        sessionId={sessionId || ""}
        sig={sig}
        initialSession={null}
        initialError="Liên kết thanh toán không hợp lệ."
      />
    );
  }

  const backendBase = process.env.INTERNAL_API_URL || "http://127.0.0.1:8000";
  let initialSession: CheckoutSession | null = null;
  let initialError = "";

  try {
    const res = await fetch(
      `${backendBase}/api/payments/qr/${encodeURIComponent(sessionId)}?sig=${encodeURIComponent(sig)}`,
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      initialError = data?.detail || "Không tìm thấy phiên thanh toán.";
    } else {
      initialSession = data as CheckoutSession;
    }
  } catch {
    initialError = "Không thể kết nối đến máy chủ thanh toán.";
  }

  return (
    <QrCheckoutClient
      sessionId={sessionId}
      sig={sig}
      initialSession={initialSession}
      initialError={initialError}
    />
  );
}
