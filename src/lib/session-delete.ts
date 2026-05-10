import type { SessionListItem } from "@/lib/session-service";

export function buildSessionDeletePlan(params: {
  activeSessionId: string;
  deletingSessionId: string;
}) {
  const deletingActiveSession = params.activeSessionId === params.deletingSessionId;

  return {
    deletingActiveSession,
    hydrateNextSession: deletingActiveSession,
  };
}

export function removeSessionFromList(
  sessions: SessionListItem[],
  deletingSessionId: string,
) {
  return sessions.filter((session) => session.id !== deletingSessionId);
}
