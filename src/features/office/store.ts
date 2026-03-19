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
  | null;

interface OfficeState {
  // Active panel
  activePanel: PanelType;
  panelData: Record<string, unknown> | null;
  openPanel: (panel: PanelType, data?: Record<string, unknown>) => void;
  closePanel: () => void;

  // Hovered entity
  hoveredEntity: string | null;
  setHoveredEntity: (id: string | null) => void;

  // Selected agent (for detail view)
  selectedAgentId: string | null;
  selectAgent: (id: string | null) => void;

  // Tooltip
  tooltip: { x: number; y: number; text: string } | null;
  setTooltip: (t: { x: number; y: number; text: string } | null) => void;
}

export const useOfficeStore = create<OfficeState>((set) => ({
  activePanel: null,
  panelData: null,
  openPanel: (panel, data) =>
    set({ activePanel: panel, panelData: data ?? null }),
  closePanel: () => set({ activePanel: null, panelData: null }),

  hoveredEntity: null,
  setHoveredEntity: (id) => set({ hoveredEntity: id }),

  selectedAgentId: null,
  selectAgent: (id) =>
    set({
      selectedAgentId: id,
      activePanel: id ? "agent-detail" : null,
      panelData: id ? { agentId: id } : null,
    }),

  tooltip: null,
  setTooltip: (t) => set({ tooltip: t }),
}));
