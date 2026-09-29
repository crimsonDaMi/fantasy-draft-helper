import { useId, useState } from "react";

/** State for an ⓘ button that reveals an explanation on tap or click —
 * unlike a `title` tooltip, it works on touch screens. The button and
 * its panel (components/InfoTip.tsx) are separate so the panel can sit
 * below the row holding the button. */
export function useInfoTip() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return {
    open,
    panelId,
    buttonProps: {
      "aria-expanded": open,
      "aria-controls": panelId,
      onClick: () => setOpen((value) => !value),
    },
  };
}
