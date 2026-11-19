"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RedirectStudentContract() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/student/room");
  }, [router]);
  return null;
}
