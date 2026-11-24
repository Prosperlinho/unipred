import { BrandLoader } from "@/components/BrandLoader";

/** Shown while a page loads: the UniPred logo animation. */
export default function Loading() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3">
      <BrandLoader size={56} />
    </div>
  );
}
