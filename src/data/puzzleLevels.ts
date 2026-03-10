/**
 * puzzleLevels.ts
 *
 * Puzzle generation engine for the Sun & Moon puzzle.
 * Supports 4×4 and 6×6 grids with three difficulty tiers.
 *
 * Generation pipeline:
 *  1. Build a valid solution via constrained backtracking
 *  2. Derive relationship constraints from the solution
 *  3. Remove cells iteratively, verifying logical solvability after each removal
 *  4. Return a guaranteed-unique, deduction-only-solvable puzzle
 */

// ─── Types ──────────────────────────────────────────────

export type CellValue = "sun" | "moon" | null;
export type RelationshipType = "A" | "O"; // "A" => same (=), "O" => opposite (×)
export type GridSize = 4 | 6;
export type Difficulty = "easy" | "medium" | "hard";

export interface Relationship {
  cellA: string; // e.g. "0-1"
  cellB: string; // e.g. "0-2"
  type: RelationshipType;
}

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

// ─── Configuration ──────────────────────────────────────

/**
 * Tuning knobs per (gridSize, difficulty) combination.
 *  - revealedCells: how many cells remain visible after blanking
 *  - relationshipCount: how many = / × constraints to place
 */
interface DifficultyConfig {
  revealedCells: number;
  relationshipCount: number;
}

const CONFIG: Record<GridSize, Record<Difficulty, DifficultyConfig>> = {
  4: {
    easy: { revealedCells: 8, relationshipCount: 5 },
    medium: { revealedCells: 6, relationshipCount: 4 },
    hard: { revealedCells: 4, relationshipCount: 3 },
  },
  6: {
    easy: { revealedCells: 18, relationshipCount: 8 },
    medium: { revealedCells: 12, relationshipCount: 6 },
    hard: { revealedCells: 8, relationshipCount: 4 },
  },
};

// ─── Utility Helpers ────────────────────────────────────

/** Shuffles an array in-place using Fisher-Yates. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Creates a cell key string from row and column indices. */
function cellKey(r: number, c: number): string {
  return `${r}-${c}`;
}

// ─── Solution Generator ────────────────────────────────

/**
 * Generates a valid N×N solution using constrained backtracking.
 * Ensures:
 *  - Exactly N/2 suns and N/2 moons in every row and column
 *  - No 3+ consecutive identical symbols in any row or column
 *
 * @param size - Grid dimension (must be even: 4 or 6)
 * @returns A fully-filled CellValue[][] grid
 */
function generateSolution(size: GridSize): CellValue[][] {
  const half = size / 2;
  const grid: CellValue[][] = Array.from({ length: size }, () =>
    Array(size).fill(null)
  );

  /**
   * Checks whether placing `value` at (r, c) violates
   * the "no 3 consecutive" constraint.
   */
  function isPlacementValid(r: number, c: number, value: CellValue): boolean {
    if (c >= 2 && grid[r][c - 1] === value && grid[r][c - 2] === value) return false;
    if (r >= 2 && grid[r - 1][c] === value && grid[r - 2][c] === value) return false;
    return true;
  }

  /**
   * Recursive backtracker filling cells left-to-right, top-to-bottom.
   */
  function solve(pos: number): boolean {
    if (pos === size * size) return true;

    const r = Math.floor(pos / size);
    const c = pos % size;

    // Count existing values in current row and column
    let rowSun = 0, rowMoon = 0, colSun = 0, colMoon = 0;
    for (let i = 0; i < c; i++) {
      if (grid[r][i] === "sun") rowSun++;
      else if (grid[r][i] === "moon") rowMoon++;
    }
    for (let i = 0; i < r; i++) {
      if (grid[i][c] === "sun") colSun++;
      else if (grid[i][c] === "moon") colMoon++;
    }

    // Try both values in random order for variety
    const candidates: CellValue[] = shuffle(["sun", "moon"]);

    for (const val of candidates) {
      if (val === "sun" && (rowSun >= half || colSun >= half)) continue;
      if (val === "moon" && (rowMoon >= half || colMoon >= half)) continue;
      if (!isPlacementValid(r, c, val)) continue;

      grid[r][c] = val;
      if (solve(pos + 1)) return true;
      grid[r][c] = null;
    }

    return false;
  }

  if (!solve(0)) {
    throw new Error(`Failed to generate a valid ${size}×${size} solution`);
  }

  return grid;
}

// ─── Logical Solver ─────────────────────────────────────

/**
 * Attempts to solve the puzzle using only logical deduction (no guessing).
 * Applies three rule categories iteratively until no further progress:
 *  1. Relationship constraints (= and ×)
 *  2. Row/column balance (if one symbol has reached its max, fill the rest)
 *  3. No-three-consecutive gaps (e.g. sun-_-sun → middle must be moon)
 *
 * @returns The solved state if fully deducible, or null if stuck.
 */
function solveByDeduction(
  size: GridSize,
  initial: Record<string, CellValue>,
  relationships: Relationship[]
): Record<string, CellValue> | null {
  const half = size / 2;
  const state: Record<string, CellValue> = { ...initial };
  let madeProgress = true;

  while (madeProgress) {
    madeProgress = false;

    // ── Rule 1: Relationship constraints ──
    for (const rel of relationships) {
      const a = state[rel.cellA];
      const b = state[rel.cellB];

      if (a && !b) {
        state[rel.cellB] = rel.type === "A" ? a : (a === "sun" ? "moon" : "sun");
        madeProgress = true;
      } else if (!a && b) {
        state[rel.cellA] = rel.type === "A" ? b : (b === "sun" ? "moon" : "sun");
        madeProgress = true;
      }
    }

    // ── Rule 2: Row/column balance ──
    for (let i = 0; i < size; i++) {
      // Row balance
      const rowKeys = Array.from({ length: size }, (_, c) => cellKey(i, c));
      let rSun = 0, rMoon = 0;
      for (const k of rowKeys) {
        if (state[k] === "sun") rSun++;
        else if (state[k] === "moon") rMoon++;
      }
      if (rSun === half) {
        for (const k of rowKeys) {
          if (!state[k]) { state[k] = "moon"; madeProgress = true; }
        }
      }
      if (rMoon === half) {
        for (const k of rowKeys) {
          if (!state[k]) { state[k] = "sun"; madeProgress = true; }
        }
      }

      // Column balance
      const colKeys = Array.from({ length: size }, (_, r) => cellKey(r, i));
      let cSun = 0, cMoon = 0;
      for (const k of colKeys) {
        if (state[k] === "sun") cSun++;
        else if (state[k] === "moon") cMoon++;
      }
      if (cSun === half) {
        for (const k of colKeys) {
          if (!state[k]) { state[k] = "moon"; madeProgress = true; }
        }
      }
      if (cMoon === half) {
        for (const k of colKeys) {
          if (!state[k]) { state[k] = "sun"; madeProgress = true; }
        }
      }
    }

    // ── Rule 3: No 3 consecutive — fill gaps ──
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const val = state[cellKey(r, c)];
        if (!val) continue;
        const opposite: CellValue = val === "sun" ? "moon" : "sun";

        // Horizontal: val val _ → _ must be opposite
        if (c < size - 2 && state[cellKey(r, c + 1)] === val && !state[cellKey(r, c + 2)]) {
          state[cellKey(r, c + 2)] = opposite; madeProgress = true;
        }
        // Horizontal: _ val val → _ must be opposite
        if (c >= 2 && state[cellKey(r, c - 1)] === val && !state[cellKey(r, c - 2)]) {
          state[cellKey(r, c - 2)] = opposite; madeProgress = true;
        }
        // Horizontal: val _ val → middle must be opposite
        if (c < size - 2 && !state[cellKey(r, c + 1)] && state[cellKey(r, c + 2)] === val) {
          state[cellKey(r, c + 1)] = opposite; madeProgress = true;
        }

        // Vertical: val val _ → _ must be opposite
        if (r < size - 2 && state[cellKey(r + 1, c)] === val && !state[cellKey(r + 2, c)]) {
          state[cellKey(r + 2, c)] = opposite; madeProgress = true;
        }
        // Vertical: _ val val → _ must be opposite
        if (r >= 2 && state[cellKey(r - 1, c)] === val && !state[cellKey(r - 2, c)]) {
          state[cellKey(r - 2, c)] = opposite; madeProgress = true;
        }
        // Vertical: val _ val → middle must be opposite
        if (r < size - 2 && !state[cellKey(r + 1, c)] && state[cellKey(r + 2, c)] === val) {
          state[cellKey(r + 1, c)] = opposite; madeProgress = true;
        }
      }
    }

    // Check if solved
    const allFilled = Object.values(state).every((v) => v !== null);
    if (allFilled) return state;
  }

  // Stuck — couldn't solve without guessing
  const allFilled = Object.values(state).every((v) => v !== null);
  return allFilled ? state : null;
}

// ─── Puzzle Generator ───────────────────────────────────

/**
 * Generates a complete puzzle for the given grid size and difficulty.
 *
 * Pipeline:
 *  1. Generate a valid NxN solution
 *  2. Add relationship constraints (= and ×) between random adjacent pairs
 *  3. Remove cells one-by-one, verifying the puzzle remains logically
 *     solvable with a unique solution after each removal
 *
 * @param gridSize  - 4 or 6
 * @param difficulty - easy, medium, or hard
 * @returns A complete PuzzleLevel ready for gameplay
 */
export function generatePuzzle(
  gridSize: GridSize = 4,
  difficulty: Difficulty = "easy"
): PuzzleLevel {
  const config = CONFIG[gridSize][difficulty];
  const solution = generateSolution(gridSize);

  // ── Build relationship constraints ──
  const adjacentPairs: Array<{ r1: number; c1: number; r2: number; c2: number }> = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (c < gridSize - 1) adjacentPairs.push({ r1: r, c1: c, r2: r, c2: c + 1 });
      if (r < gridSize - 1) adjacentPairs.push({ r1: r, c1: c, r2: r + 1, c2: c });
    }
  }

  shuffle(adjacentPairs);
  const relationships: Relationship[] = adjacentPairs
    .slice(0, config.relationshipCount)
    .map(({ r1, c1, r2, c2 }) => ({
      cellA: cellKey(r1, c1),
      cellB: cellKey(r2, c2),
      type: (solution[r1][c1] === solution[r2][c2] ? "A" : "O") as RelationshipType,
    }));

  // ── Initialize all cells as pre-filled ──
  const preFilledCells: Record<string, CellValue> = {};
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      preFilledCells[cellKey(r, c)] = solution[r][c];
    }
  }

  // ── Remove cells while maintaining solvability ──
  const totalCells = gridSize * gridSize;
  const targetBlanks = totalCells - config.revealedCells;

  const allPositions = shuffle(
    Array.from({ length: totalCells }, (_, i) => ({
      r: Math.floor(i / gridSize),
      c: i % gridSize,
    }))
  );

  let blanksCreated = 0;

  for (const { r, c } of allPositions) {
    if (blanksCreated >= targetBlanks) break;

    const key = cellKey(r, c);
    const originalValue = preFilledCells[key];

    // Tentatively remove
    preFilledCells[key] = null;

    // Check if still solvable with unique solution
    const result = solveByDeduction(gridSize, preFilledCells, relationships);

    if (result) {
      // Verify the deduced solution matches the original
      let matchesSolution = true;
      for (let rr = 0; rr < gridSize; rr++) {
        for (let cc = 0; cc < gridSize; cc++) {
          if (result[cellKey(rr, cc)] !== solution[rr][cc]) {
            matchesSolution = false;
            break;
          }
        }
        if (!matchesSolution) break;
      }

      if (matchesSolution) {
        blanksCreated++;
      } else {
        preFilledCells[key] = originalValue; // Different solution — restore
      }
    } else {
      preFilledCells[key] = originalValue; // Not solvable — restore
    }
  }

  return {
    level: 1,
    rows: gridSize,
    cols: gridSize,
    difficulty,
    gridSize,
    preFilledCells,
    relationships,
    solution,
  };
}

// ─── Exports ────────────────────────────────────────────

/** Generates a fresh randomized puzzle. */
export function getRandomizedPuzzle(
  gridSize: GridSize = 4,
  difficulty: Difficulty = "easy"
): PuzzleLevel {
  return generatePuzzle(gridSize, difficulty);
}

const puzzleLevels: PuzzleLevel[] = [generatePuzzle(4, "easy")];
export default puzzleLevels;
