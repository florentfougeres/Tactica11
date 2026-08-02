import { useState } from "react";

const ONBOARD_KEY = "tactica11.onboarded";

// First-launch walkthrough of the existing features (reopenable from the top
// bar). The flag lives in localStorage so it shows exactly once per device.
export function useOnboarding() {
  const [onboardOpen, setOnboardOpen] = useState(
    () => localStorage.getItem(ONBOARD_KEY) == null,
  );

  const openOnboarding = () => setOnboardOpen(true);

  const closeOnboarding = () => {
    setOnboardOpen(false);
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      // storage unavailable — the tour just shows again next time, harmless
    }
  };

  return { onboardOpen, openOnboarding, closeOnboarding };
}
