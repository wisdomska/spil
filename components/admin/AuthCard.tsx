import { ThemeMenu } from "@/components/ui/ThemeToggle";

/** Centred 400 px card on the page background (design admin login frame). */
export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-[100dvh] place-items-center bg-bg p-4 text-text sm:p-6">
      <div className="absolute top-4 right-4">
        <ThemeMenu />
      </div>
      <div className="box-border grid w-full max-w-[400px] gap-[18px] rounded-card border border-line bg-surface p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}

export function AuthTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="m-0 font-display text-[30px] leading-none font-extrabold tracking-[-0.02em]">
      {children}
    </h1>
  );
}
