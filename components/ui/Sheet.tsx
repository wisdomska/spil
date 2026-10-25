"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { XIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

type SheetProps = {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Accessible name. Shown as the heading unless hideTitle. */
  title: React.ReactNode;
  hideTitle?: boolean;
  description?: React.ReactNode;
  /** Blocks Escape and scrim clicks (18+ confirmation must be answered). */
  dismissible?: boolean;
  closeButton?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Where focus starts when it opens (default: the first focusable element). */
  initialFocus?: React.RefObject<HTMLElement | null>;
};

/**
 * Bottom sheet below lg (slides from 100%, ease-drawer, 400 ms), centred 440 px modal at lg+
 * (scale .96 and fade, 200 ms). Radix Dialog gives focus trap and Escape.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  hideTitle,
  description,
  dismissible = true,
  closeButton,
  children,
  className,
  initialFocus,
}: SheetProps) {
  const t = useTranslations("common");
  return (
    <Dialog.Root open={open} onOpenChange={dismissible ? onOpenChange : undefined}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 animate-fade bg-scrim"
          style={{ zIndex: "var(--z-sheet)" }}
        />
        <Dialog.Content
          onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}
          onOpenAutoFocus={(e) => {
            if (!initialFocus?.current) return;
            e.preventDefault();
            initialFocus.current.focus();
          }}
          onPointerDownOutside={(e) => !dismissible && e.preventDefault()}
          className={cn(
            "fixed grid grid-cols-[minmax(0,1fr)] gap-4 overflow-y-auto bg-surface-raised text-text outline-none",
            "inset-x-0 bottom-0 max-h-[92dvh] animate-sheet-up rounded-t-card px-5 pt-2.5 pb-[max(24px,env(safe-area-inset-bottom))]",
            "lg:inset-x-auto lg:top-1/2 lg:bottom-auto lg:left-1/2 lg:max-h-[90dvh] lg:w-[440px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:animate-modal-pop lg:rounded-card lg:border lg:border-line lg:p-6",
            className,
          )}
          style={{ zIndex: "calc(var(--z-sheet) + 1)" }}
        >
          <span
            aria-hidden
            className="h-[5px] w-10 justify-self-center rounded-pill bg-line lg:hidden"
          />
          {closeButton ? (
            <div className="flex items-center justify-between">
              <Dialog.Title className="m-0 font-display text-[28px] leading-none font-extrabold tracking-[-0.02em]">
                {title}
              </Dialog.Title>
              <Dialog.Close
                aria-label={t("close")}
                className="grid size-12 place-items-center rounded-pill border border-line bg-transparent text-[20px] text-text hover:bg-surface-raised active:scale-[.92]"
              >
                <XIcon aria-hidden size={20} />
              </Dialog.Close>
            </div>
          ) : (
            <Dialog.Title
              className={cn(
                "m-0 font-display text-[28px] leading-[1.02] font-extrabold tracking-[-0.02em]",
                hideTitle && "sr-only",
              )}
            >
              {title}
            </Dialog.Title>
          )}
          {description ? (
            <Dialog.Description className="m-0 text-[16px] leading-[1.45] text-text-muted">
              {description}
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
