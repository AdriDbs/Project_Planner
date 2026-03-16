import { create } from 'zustand';

interface WorkshopStoreState {
  // Workshop launcher (legacy modal)
  isLauncherOpen: boolean;
  setLauncherOpen: (open: boolean) => void;

  // Co-construction fullscreen mode
  isCoConstructionMode: boolean;
  activeWorkshopId: string | null;
  setCoConstructionMode: (active: boolean, workshopId?: string) => void;
  closeCoConstruction: () => void;
}

export const useWorkshopStore = create<WorkshopStoreState>((set) => ({
  isLauncherOpen: false,
  setLauncherOpen: (open) => set({ isLauncherOpen: open }),

  isCoConstructionMode: false,
  activeWorkshopId: null,
  setCoConstructionMode: (active, workshopId) =>
    set({ isCoConstructionMode: active, activeWorkshopId: workshopId ?? null }),
  closeCoConstruction: () =>
    set({ isCoConstructionMode: false, activeWorkshopId: null }),
}));
