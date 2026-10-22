import { cn } from "@/lib/cn";

/** Loading block shaped like the final layout. Breathes; never a spinner. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div aria-hidden className={cn("bg-skeleton", className)} style={style} />;
}

export function SkeletonGroup({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-label={label} className={cn("grid animate-breathe", className)}>
      {children}
    </div>
  );
}
