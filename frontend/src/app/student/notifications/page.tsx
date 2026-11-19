"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RedirectStudentNotifications() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/student/maintenance");
  }, [router]);
  return null;
}
