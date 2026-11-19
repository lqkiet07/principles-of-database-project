"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RoomTransfersRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/rooms?tab=transfers");
  }, [router]);
  return null;
}
