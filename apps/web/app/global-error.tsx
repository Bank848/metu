"use client";
import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

/**
 * Top-of-tree error boundary — catches errors that escape the regular
 * `app/error.tsx` (e.g. layout-level crashes that happen before the
 * route's own boundary mounts). Sentry recommends this dedicated file
 * so React rendering errors get reported even when the rest of the
 * app is unable to render.
 *
 * Sentry's `captureException` is a no-op if the SDK never initialised
 * (no DSN), so this file is safe in every environment.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        {/* The Next default error page — small, dependency-free, never
            crashes. Our branded `app/error.tsx` is preferred for normal
            errors; this one only renders if the layout itself blows up. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
