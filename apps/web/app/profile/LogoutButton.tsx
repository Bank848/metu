"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch(`/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    router.push("/");
    router.refresh();
  }
  return (
    <Button onClick={logout} variant="danger" size="sm">
      <LogOut className="h-4 w-4" />
      Log out
    </Button>
  );
}
