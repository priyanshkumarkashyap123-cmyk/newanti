/**
 * MultiplayerUI — Renders collaborative user avatars.
 * Extracted from ModernModeler.tsx to avoid re-creation every render.
 */
import { FC, memo } from "react";
import { useMultiplayerContextSafe } from "../collaboration/MultiplayerContext";
import { Collaborators } from "../collaboration/Collaborators";

export const MultiplayerUI: FC = memo(() => {
  const mp = useMultiplayerContextSafe();
  if (!mp) return null;
  return (
    <Collaborators
      users={mp.remoteUsers}
      currentUserColor={mp.userColor}
      isConnected={mp.isConnected}
    />
  );
});
MultiplayerUI.displayName = "MultiplayerUI";
