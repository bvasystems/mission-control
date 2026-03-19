import { create } from "zustand";

export type PanelType =
  | "agents"
  | "projects"
  | "kanban"
  | "incidents"
  | "crons"
  | "deploys"
  | "stats"
  | "agent-detail"
  | "meeting"
  | null;

interface OfficeState {
  // Panel
  activePanel: PanelType;
  panelData: Record<string, unknown> | null;
  openPanel: (panel: PanelType, data?: Record<string, unknown>) => void;
  closePanel: () => void;

  // Hover / Selection
  hoveredEntity: string | null;
  setHoveredEntity: (id: string | null) => void;
  selectedAgentId: string | null;
  selectAgent: (id: string | null) => void;

  // Tooltip
  tooltip: { x: number; y: number; text: string } | null;
  setTooltip: (t: { x: number; y: number; text: string } | null) => void;

  // Command draft
  commandDraft: string;
  setCommandDraft: (text: string) => void;

  // Meeting room
  meetingAgents: string[];
  callToMeeting: (agentIds: string[]) => void;
  addToMeeting: (agentId: string) => void;
  removeFromMeeting: (agentId: string) => void;
  dismissMeeting: () => void;
}

export const useOfficeStore = create<OfficeState>((set) => ({
  activePanel: null,
  panelData: null,
  openPanel: (panel, data) =>
    set({ activePanel: panel, panelData: data ?? null }),
  closePanel: () =>
    set({ activePanel: null, panelData: null, selectedAgentId: null, commandDraft: "" }),

  hoveredEntity: null,
  setHoveredEntity: (id) => set({ hoveredEntity: id }),

  selectedAgentId: null,
  selectAgent: (id) =>
    set({
      selectedAgentId: id,
      activePanel: id ? "agent-detail" : null,
      panelData: id ? { agentId: id } : null,
      commandDraft: "",
    }),

  tooltip: null,
  setTooltip: (t) => set({ tooltip: t }),

  commandDraft: "",
  setCommandDraft: (text) => set({ commandDraft: text }),

  // Meeting
  meetingAgents: [],
  callToMeeting: (agentIds) =>
    set({ meetingAgents: agentIds, activePanel: "meeting", panelData: null }),
  addToMeeting: (agentId) =>
    set((s) => ({
      meetingAgents: s.meetingAgents.includes(agentId)
        ? s.meetingAgents
        : [...s.meetingAgents, agentId],
    })),
  removeFromMeeting: (agentId) =>
    set((s) => ({
      meetingAgents: s.meetingAgents.filter((id) => id !== agentId),
    })),
  dismissMeeting: () =>
    set({ meetingAgents: [], activePanel: null, panelData: null }),
}));
