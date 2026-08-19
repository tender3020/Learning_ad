import type { OutlineDifficulty } from "./outlinePhases";

export type { OutlineDifficulty };

export interface OutlineItem {
  dayNumber: number;
  title: string;
  goal: string;
  keywords: string;
  estimatedMinutes: number;
  phaseName?: string;
  phaseOrder?: number;
  phaseGoal?: string;
  difficulty?: OutlineDifficulty;
  prerequisites?: string;
  learningObjective?: string;
}

export interface SyllabusPhase {
  order: number;
  name: string;
  goal: string;
  dayCount: number;
  startDay: number;
  endDay: number;
  difficulty: OutlineDifficulty;
  topics: string[];
}
