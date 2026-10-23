"use client";

import { useEffect, useState } from "react";

/**
 * Busy flag for forms that navigate away on success. Next keeps a left page's state alive and
 * shows it again on Back or a later visit, so the flag clears when the page is hidden; otherwise
 * the submit button would come back stuck in its loading state.
 */
export function useBusy() {
  const [busy, setBusy] = useState(false);
  useEffect(() => () => setBusy(false), []);
  return [busy, setBusy] as const;
}
