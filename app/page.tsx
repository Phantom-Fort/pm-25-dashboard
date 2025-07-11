"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

export default function HomeRedirectPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
    } else if (!user.displayName) {
      router.replace("/profile");
    } else {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  return (
    <div className="p-6 text-center text-lg font-semibold">
      Olotu Opeyemi Master Thesis Project. M.ENG FUTA...
    </div>
  );
}
