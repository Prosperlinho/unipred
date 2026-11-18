import { BedDouble, CalendarHeart, Cpu, FileCheck2, GraduationCap, Landmark, Music, Newspaper, Shirt, Trophy, Volleyball } from "lucide-react";
import type { Category } from "@/lib/types";

const STYLES: Record<Category, { cls: string; Icon: typeof Landmark }> = {
  "Campus Politics": { cls: "bg-violet-500/10 text-violet-300 ring-violet-500/20", Icon: Landmark },
  Academics: { cls: "bg-sky-500/10 text-sky-300 ring-sky-500/20", Icon: GraduationCap },
  Sports: { cls: "bg-amber-500/10 text-amber-300 ring-amber-500/20", Icon: Trophy },
  "Events & Lifestyle": { cls: "bg-pink-500/10 text-pink-300 ring-pink-500/20", Icon: CalendarHeart },
  "Entertainment & Music": { cls: "bg-fuchsia-500/10 text-fuchsia-300 ring-fuchsia-500/20", Icon: Music },
  Football: { cls: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20", Icon: Volleyball },
  "Hostel Life": { cls: "bg-orange-500/10 text-orange-300 ring-orange-500/20", Icon: BedDouble },
  "Tech & Crypto": { cls: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/20", Icon: Cpu },
  "Fashion & Style": { cls: "bg-rose-500/10 text-rose-300 ring-rose-500/20", Icon: Shirt },
  "Politics & News": { cls: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/20", Icon: Newspaper },
  "Exams & Results": { cls: "bg-teal-500/10 text-teal-300 ring-teal-500/20", Icon: FileCheck2 },
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
