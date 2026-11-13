import { CalendarHeart, GraduationCap, Landmark, Trophy } from "lucide-react";
import type { Category } from "@/lib/types";

const STYLES: Record<Category, { cls: string; Icon: typeof Landmark }> = {
  "Campus Politics": { cls: "bg-violet-500/10 text-violet-300 ring-violet-500/20", Icon: Landmark },
  Academics: { cls: "bg-sky-500/10 text-sky-300 ring-sky-500/20", Icon: GraduationCap },
  Sports: { cls: "bg-amber-500/10 text-amber-300 ring-amber-500/20", Icon: Trophy },
  "Events & Lifestyle": { cls: "bg-pink-500/10 text-pink-300 ring-pink-500/20", Icon: CalendarHeart },
};

export function CategoryBadge({ category }: { category: Category }) {
  const { cls, Icon } = STYLES[category];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${cls}`}
    >
      <Icon className="size-3" aria-hidden />
      {category}
    </span>
  );
}
