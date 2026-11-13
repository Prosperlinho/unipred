import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  /** Narrow column for forms and single-topic pages. */
  narrow?: boolean;
}

export function Container({ children, className = "", narrow = false }: Props) {
  return (
    <div className={`mx-auto w-full px-4 py-4 sm:py-6 ${narrow ? "max-w-2xl" : "max-w-6xl"} ${className}`}>
      {children}
    </div>
  );
}
