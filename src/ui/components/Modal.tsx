import { useEffect, useId, useRef, type ReactNode } from 'react';

/** Everything the browser would stop on with Tab; `[disabled]` is filtered out separately. */
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute('disabled'));
}

/**
 * The one dialog shell. Every overlay goes through it so the focus trap, the initial focus
 * and the Escape key behave the same everywhere.
 *
 * `onClose` is what makes a dialog dismissable: a ceremony (the Audit stamp, the Cosmic
 * restructuring) deliberately passes none, so neither Escape nor a backdrop click can skip
 * past the one button that acknowledges it.
 */
export function Modal({
  open,
  title,
  label,
  header,
  className,
  backdropClassName,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  /** Accessible name when it differs from the visible title; otherwise the title names the dialog. */
  label?: string;
  /** Rendered above the title — a ceremony stamp, say. */
  header?: ReactNode;
  className?: string;
  backdropClassName?: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // The first button, not the first focusable: a settings toggle at the top of the sheet
  // should not be one stray keypress away from being flipped by someone who only opened it.
  useEffect(() => {
    if (!open) return;
    const root = ref.current;
    if (!root) return;
    const target = root.querySelector<HTMLElement>('button:not([disabled])') ?? root;
    target.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = ref.current;
      if (!root) return;
      const items = focusables(root);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const outside = !active || !root.contains(active);
      if (e.shiftKey && (outside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (outside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={'modal-backdrop' + (backdropClassName ? ' ' + backdropClassName : '')} onClick={onClose}>
      <div
        ref={ref}
        className={'modal card' + (className ? ' ' + className : '')}
        role="dialog"
        aria-modal="true"
        {...(label ? { 'aria-label': label } : { 'aria-labelledby': titleId })}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {header}
        <h2 className="modal-title" id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
