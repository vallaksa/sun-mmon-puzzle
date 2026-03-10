/**
 * puzzleLevels.ts
 *
 * Complete puzzle generation engine for the Sun & Moon puzzle.
 * Generates valid NxN grids (starting with 4×4) with:
 *  - Equal suns/moons per row and column
 *  - No more than 2 consecutive same symbols
 *  - Strategic relationship constraints (= / ×)
 *  - Verified logical solvability (no guessing needed)
 */

// ─── Types ──────────────────────────────────────────────

export type CellValue = "sun" | "moon" | null;
export type RelationshipType = "A" | "O"; // "A" => same (=), "O" => opposite (×)

export interface Relationship {
  cellA: string; // e.g. "0-1"
  cellB: string; // e.g. "0-2"
  type: RelationshipType;
}

export interface PuzzleLevel {
  level: number;
  rows: number;
  cols: number;
  difficulty: "easy" | "medium" | "hard";
  preFilledCells: Record<string, CellValue>;
  relationships: Relationship[];
  solution: CellValue[][]; // Keep solution for hint/validation
}

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
 * @param size - Grid dimension (must be even). Default: 4
 * @returns A fully-filled CellValue[][] grid
 */
function generateSolution(size: number = 4): CellValue[][] {
  const half = size / 2;
  const grid: CellValue[][] = Array.from({ length: size }, () =>
    Array(size).fill(null)
  );

  /**
   * Checks whether placing `value` at (r, c) violates
   * the "no 3 consecutive" constraint.
   */
  function isPlacementValid(
    r: number,
    c: number,
    value: CellValue
  ): boolean {
    // Check horizontal: no 3 in a row
    if (c >= 2 && grid[r][c - 1] === value && grid[r][c - 2] === value) {
      return false;
    }
    // Check vertical: no 3 in a column
    if (r >= 2 && grid[r - 1][c] === value && grid[r - 2][c] === value) {
      return false;
    }
    return true;
  }

  /**
   * Recursive backtracker that fills cells left-to-right, top-to-bottom.
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

    // Try both values in random order to produce varied puzzles
    const candidates: CellValue[] = shuffle(["sun", "moon"]);

    for (const val of candidates) {
      // Balance check: can't exceed half for either symbol
      if (val === "sun" && (rowSun >= half || colSun >= half)) continue;
      if (val === "moon" && (rowMoon >= half || colMoon >= half)) continue;

      // Adjacency check
      if (!isPlacementValid(r, c, val)) continue;

      grid[r][c] = val;
      if (solve(pos + 1)) return true;
      grid[r][c] = null;
    }

    return false;
  }

  if (!solve(0)) {
    throw new Error("Failed to generate a valid solution");
  }

  return grid;
}

// ─── Logical Solver ─────────────────────────────────────

/**
 * Attempts to solve the puzzle using only logical deduction (no guessing).
 * Returns the solved state if solvable, or null if stuck.
 */
function solveByDeduction(
  size: number,
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
      const rowVals = rowKeys.map((k) => state[k]);
      const rowSun = rowVals.filter((v) => v === "sun").length;
      const rowMoon = rowVals.filter((v) => v === "moon").length;

      if (rowSun === half) {
        for (const k of rowKeys) {
          if (!state[k]) { state[k] = "moon"; madeProgress = true; }
        }
      }
      if (rowMoon === half) {
        for (const k of rowKeys) {
          if (!state[k]) { state[k] = "sun"; madeProgress = true; }
        }
      }

      // Column balance
      const colKeys = Array.from({ length: size }, (_, r) => cellKey(r, i));
      const colVals = colKeys.map((k) => state[k]);
      const colSun = colVals.filter((v) => v === "sun").length;
      const colMoon = colVals.filter((v) => v === "moon").length;

      if (colSun === half) {
        for (const k of colKeys) {
          if (!state[k]) { state[k] = "moon"; madeProgress = true; }
        }
      }
      if (colMoon === half) {
        for (const k of colKeys) {
          if (!state[k]) { state[k] = "sun"; madeProgress = true; }
        }
      }
    }

    // ── Rule 3: No 3 consecutive — fill gaps ──
    // If two same adjacent and the cell next to them is empty, fill opposite
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const val = state[cellKey(r, c)];
        if (!val) continue;
        const opposite: CellValue = val === "sun" ? "moon" : "sun";

        // Horizontal: val val _ => _ must be opposite
        if (c < size - 2 && state[cellKey(r, c + 1)] === val && !state[cellKey(r, c + 2)]) {
          state[cellKey(r, c + 2)] = opposite;
          madeProgress = true;
        }
        // Horizontal: _ val val => _ must be opposite
        if (c >= 2 && state[cellKey(r, c - 1)] === val && !state[cellKey(r, c - 2)]) {
          state[cellKey(r, c - 2)] = opposite;
          madeProgress = true;
        }
        // Horizontal: val _ val => middle must be opposite
        if (c < size - 2 && !state[cellKey(r, c + 1)] && state[cellKey(r, c + 2)] === val) {
          state[cellKey(r, c + 1)] = opposite;
          madeProgress = true;
        }

        // Vertical: val val _ => _ must be opposite
        if (r < size - 2 && state[cellKey(r + 1, c)] === val && !state[cellKey(r + 2, c)]) {
          state[cellKey(r + 2, c)] = opposite;
          madeProgress = true;
        }
        // Vertical: _ val val => _ must be opposite
        if (r >= 2 && state[cellKey(r - 1, c)] === val && !state[cellKey(r - 2, c)]) {
          state[cellKey(r - 2, c)] = opposite;
          madeProgress = true;
        }
        // Vertical: val _ val => middle must be opposite
        if (r < size - 2 && !state[cellKey(r + 1, c)] && state[cellKey(r + 2, c)] === val) {
          state[cellKey(r + 1, c)] = opposite;
          madeProgress = true;
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
 * Generates a complete puzzle:
 *  1. Creates a valid solution
 *  2. Adds relationship constraints between adjacent cells
 *  3. Removes cells one by one, verifying the puzzle remains
 *     logically solvable after each removal
 *
 * @param difficulty - Controls how many cells are revealed
 */
export function generatePuzzle(
  difficulty: "easy" | "medium" | "hard" = "easy"
): PuzzleLevel {
  const size = 4;
  const solution = generateSolution(size);

  // ── Build relationship constraints ──
  // Collect all adjacent pairs (horizontal + vertical)
  const adjacentPairs: Array<{ r1: number; c1: number; r2: number; c2: number }> = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (c < size - 1) adjacentPairs.push({ r1: r, c1: c, r2: r, c2: c + 1 });
      if (r < size - 1) adjacentPairs.push({ r1: r, c1: c, r2: r + 1, c2: c });
    }
  }

  // Pick a subset of relationships
  const relationshipCount = difficulty === "easy" ? 5 : difficulty === "medium" ? 4 : 3;
  shuffle(adjacentPairs);
  const relationships: Relationship[] = adjacentPairs
    .slice(0, relationshipCount)
    .map(({ r1, c1, r2, c2 }) => {
      const valA = solution[r1][c1];
      const valB = solution[r2][c2];
      return {
        cellA: cellKey(r1, c1),
        cellB: cellKey(r2, c2),
        type: (valA === valB ? "A" : "O") as RelationshipType,
      };
    });

  // ── Initialize all cells as pre-filled ──
  const preFilledCells: Record<string, CellValue> = {};
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      preFilledCells[cellKey(r, c)] = solution[r][c];
    }
  }

  // ── Remove cells while maintaining solvability ──
  // How many to remove based on difficulty
  const targetBlanks = difficulty === "easy" ? 8 : difficulty === "medium" ? 10 : 12;

  // Create a shuffled list of all cell positions
  const allPositions = shuffle(
    Array.from({ length: size * size }, (_, i) => ({
      r: Math.floor(i / size),
      c: i % size,
    }))
  );

  let blanksCreated = 0;

  for (const { r, c } of allPositions) {
    if (blanksCreated >= targetBlanks) break;

    const key = cellKey(r, c);
    const originalValue = preFilledCells[key];

    // Tentatively remove this cell
    preFilledCells[key] = null;

    // Check if still solvable
    const result = solveByDeduction(size, preFilledCells, relationships);

    if (result) {
      // Verify solution matches original
      let matchesSolution = true;
      for (let rr = 0; rr < size; rr++) {
        for (let cc = 0; cc < size; cc++) {
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
        // Restore — different solution found, puzzle isn't unique
        preFilledCells[key] = originalValue;
      }
    } else {
      // Restore — puzzle isn't solvable without guessing
      preFilledCells[key] = originalValue;
    }
  }

  return {
    level: 1,
    rows: size,
    cols: size,
    difficulty,
    preFilledCells,
    relationships,
    solution,
  };
}

// ─── Exports ────────────────────────────────────────────

/** Generates a fresh randomized puzzle. */
export function getRandomizedPuzzle(
  difficulty: "easy" | "medium" | "hard" = "easy"
): PuzzleLevel {
  return generatePuzzle(difficulty);
}

const puzzleLevels: PuzzleLevel[] = [generatePuzzle("easy")];
export default puzzleLevels;
