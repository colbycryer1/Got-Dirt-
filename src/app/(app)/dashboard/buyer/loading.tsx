import { SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 h-14" />
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonTable rows={5} />
      </div>
    </div>
  );
}
