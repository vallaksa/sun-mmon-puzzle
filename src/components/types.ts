/**
 * Core type definitions for the Sun & Moon puzzle game.
 */

/** A cell can hold a sun, a moon, or be empty (null). */
export type CellValue = "sun" | "moon" | null;

/** Relationship type: "A" = same (=), "O" = opposite (×). */
export type RelationshipType = "A" | "O";

/** Supported grid dimensions. */
export type GridSize = 4 | 6;

/** Supported difficulty levels. */
export type Difficulty = "easy" | "medium" | "hard";

/** A constraint relationship between two adjacent cells. */
export interface Relationship {
  cellA: string; // "row-col" format, e.g. "0-1"
  cellB: string; // "row-col" format, e.g. "0-2"
  type: RelationshipType;
}

/** Defines a full puzzle configuration. */
export interface PuzzleLevel {
  level: number;
  rows: number;
  cols: number;
  difficulty: Difficulty;
  gridSize: GridSize;
  preFilledCells: Record<string, CellValue>;
  relationships: Relationship[];
  solution: CellValue[][];
}

/** A snapshot of the grid for the undo stack. */
export type GridSnapshot = CellValue[][];

/** Overall game state. */
export interface GameState {
  currentLevel: number;
  grid: CellValue[][];
  errors: string[];
  moveCount: number;
  isComplete: boolean;
}
