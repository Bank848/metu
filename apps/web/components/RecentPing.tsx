"use client";
import { useEffect } from "react";
import { recordVisit } from "@/lib/recentlyViewed";

/**
 * Mounted once on the product detail page — records a localStorage entry
 * so /browse can show a "Recently viewed" strip. Renders nothing.
 */
export function RecentPing({ productId }: { productId: number }) {
  useEffect(() => {
    recordVisit(productId);
  }, [productId]);
  return null;
}
