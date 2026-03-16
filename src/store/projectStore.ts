import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, Plant } from '../types/project';

interface ProjectState {
  selectedProjectId: string | null;
  selectedPlantIds: string[];
  selectedYears: number[];
  locale: 'fr' | 'en';
  projects: Project[];
  plants: Plant[];
  tutorialActive: boolean;
  tutorialStep: number;
  setSelectedProject: (id: string | null) => void;
  setSelectedPlants: (ids: string[]) => void;
  setSelectedYears: (years: number[]) => void;
  setLocale: (locale: 'fr' | 'en') => void;
  setProjects: (projects: Project[]) => void;
  setPlants: (plants: Plant[]) => void;
  addProject: (project: Project) => void;
  addPlant: (plant: Plant) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  updatePlant: (id: string, updates: Partial<Plant>) => void;
  startTutorial: () => void;
  setTutorialActive: (active: boolean) => void;
  setTutorialStep: (step: number) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      selectedProjectId: null,
      selectedPlantIds: [],
      selectedYears: [2024, 2025, 2026, 2027, 2028],
      locale: 'fr',
      projects: [],
      plants: [],
      tutorialActive: false,
      tutorialStep: 0,
      setSelectedProject: (id) => set((state) => {
        const project = id ? state.projects.find(p => p.id === id) : null;
        return {
          selectedProjectId: id,
          selectedPlantIds: [],
          ...(project?.years?.length ? { selectedYears: project.years } : {}),
        };
      }),
      setSelectedPlants: (ids) => set({ selectedPlantIds: ids }),
      setSelectedYears: (years) => set({ selectedYears: years }),
      setLocale: (locale) => set({ locale }),
      setProjects: (projects) => set({ projects }),
      setPlants: (plants) => set({ plants }),
      addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
      addPlant: (plant) => set((state) => ({ plants: [...state.plants, plant] })),
      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p),
        })),
      updatePlant: (id, updates) =>
        set((state) => ({
          plants: state.plants.map(p => p.id === id ? { ...p, ...updates } : p),
        })),
      startTutorial: () => set({ tutorialActive: true, tutorialStep: 0 }),
      setTutorialActive: (active) => set({ tutorialActive: active }),
      setTutorialStep: (step) => set({ tutorialStep: step }),
    }),
    {
      name: 'bp-project-store',
      partialize: (state) => ({
        selectedProjectId: state.selectedProjectId,
        selectedYears: state.selectedYears,
        locale: state.locale,
      }),
    }
  )
);
