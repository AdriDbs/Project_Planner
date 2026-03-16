import { create } from 'zustand';

interface WorkshopStoreState {
  isLauncherOpen: boolean;
  setLauncherOpen: (open: boolean) => void;
}

export const useWorkshopStore = create<WorkshopStoreState>((set) => ({
  isLauncherOpen: false,
  setLauncherOpen: (open) => set({ isLauncherOpen: open }),
}));
