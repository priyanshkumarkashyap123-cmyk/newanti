import { useEffect, useRef } from "react";

export function useForceCloudTrigger(
  onForceCloudRun: () => Promise<void>,
): React.MutableRefObject<boolean> {
  const forceCloudRequestedRef = useRef(false);

  useEffect(() => {
    const handler = (event: Event) => {
      try {
        const cloudEvent = event as CustomEvent<{ forceCloud?: boolean }>;
        if (!cloudEvent.detail?.forceCloud) {
          return;
        }

        forceCloudRequestedRef.current = true;
        void onForceCloudRun();
      } catch {
        // non-critical
      }
    };

    window.addEventListener("beamlab:run-cloud-analysis", handler as EventListener);
    return () => {
      window.removeEventListener("beamlab:run-cloud-analysis", handler as EventListener);
    };
  }, [onForceCloudRun]);

  return forceCloudRequestedRef;
}
