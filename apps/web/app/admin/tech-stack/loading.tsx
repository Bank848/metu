import { Skeleton } from "@/components/Skeleton";

/**
 * skeleton for /admin/tech-stack. The live page paints a
 * flowchart with brand logos; we approximate with a wide canvas
 * placeholder + a category legend to reserve viewport height.
 */
export default function AdminTechStackLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="rounded-2xl glass-morphism p-5">
        <Skeleton className="h-[460px] w-full rounded-xl" />
      </div>
      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
