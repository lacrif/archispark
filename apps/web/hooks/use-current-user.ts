"use client";

import { useState } from "react";
import { getCurrentUser, type CurrentUser } from "@/lib/api";

export function useCurrentUser(): CurrentUser | null {
  const [user] = useState<CurrentUser | null>(getCurrentUser);
  return user;
}

export function useIsAdmin(): boolean {
  const user = useCurrentUser();
  return user?.role === "admin";
}
