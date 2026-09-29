import type { ReactNode } from "react";

import type { useInfoTip } from "../hooks/useInfoTip";

/** The ⓘ toggle; pass it `buttonProps` from useInfoTip. */
export function InfoTipButton({
  label,
  ...buttonProps
}: { label: string } & ReturnType<typeof useInfoTip>["buttonProps"]) {
  return (
    <button
      type="button"
      className="info-tip__button"
      aria-label={label}
      {...buttonProps}
    >
      ⓘ
    </button>
  );
}

/** The explanation, shown while its button is expanded. */
export function InfoTipPanel({
  id,
  open,
  children,
}: {
  id: string;
  open: boolean;
  children: ReactNode;
}) {
  return (
    open && (
      <div id={id} className="info-tip__panel">
        {children}
      </div>
    )
  );
}
