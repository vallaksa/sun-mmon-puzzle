/**
 * Board.tsx
 *
 * Renders the puzzle grid with cells and relationship indicators.
 * Handles layout, relationship symbol positioning, and error detection.
 */
import React from "react";
import Cell from "./Cell";
import { CellValue, PuzzleLevel } from "./types";

interface BoardProps {
  /** The current puzzle configuration. */
  puzzle: PuzzleLevel;
  /** The current grid state. */
  grid: CellValue[][];
  /** Callback when a cell is clicked. */
  onCellClick: (row: number, col: number) => void;
}

const Board: React.FC<BoardProps> = ({ puzzle, grid, onCellClick }) => {
  const { rows, cols, preFilledCells, relationships } = puzzle;

  /**
   * Checks if a cell is in a rule-violating state.
   * Checks:
   *  - Three consecutive same symbols (horizontal + vertical)
   *  - Relationship constraint violations
   */
  const checkCellError = (r: number, c: number): boolean => {
    const value = grid[r]?.[c];
    if (!value) return false;

    // Check 3-in-a-row horizontally (this cell in left, middle, or right position)
    if (c >= 2 && grid[r][c - 1] === value && grid[r][c - 2] === value) return true;
    if (c >= 1 && c < cols - 1 && grid[r][c - 1] === value && grid[r][c + 1] === value) return true;
    if (c < cols - 2 && grid[r][c + 1] === value && grid[r][c + 2] === value) return true;

    // Check 3-in-a-row vertically
    if (r >= 2 && grid[r - 1]?.[c] === value && grid[r - 2]?.[c] === value) return true;
    if (r >= 1 && r < rows - 1 && grid[r - 1]?.[c] === value && grid[r + 1]?.[c] === value) return true;
    if (r < rows - 2 && grid[r + 1]?.[c] === value && grid[r + 2]?.[c] === value) return true;

    // Check relationship violations
    if (relationships) {
      for (const rel of relationships) {
        const key = `${r}-${c}`;
        if (rel.cellA === key || rel.cellB === key) {
          const otherKey = rel.cellA === key ? rel.cellB : rel.cellA;
          const [otherR, otherC] = otherKey.split("-").map(Number);
          const otherVal = grid[otherR]?.[otherC];
          if (otherVal) {
            if (rel.type === "O" && value === otherVal) return true;
            if (rel.type === "A" && value !== otherVal) return true;
          }
        }
      }
    }

    return false;
  };

  /**
   * Returns the relationship symbol between two adjacent cells, if one exists.
   */
  const getRelationship = (
    r1: number,
    c1: number,
    r2: number,
    c2: number
  ): { symbol: string; type: "same" | "opposite" } | null => {
    if (!relationships) return null;

    const rel = relationships.find((rel) => {
      const [ar, ac] = rel.cellA.split("-").map(Number);
      const [br, bc] = rel.cellB.split("-").map(Number);
      return (
        (ar === r1 && ac === c1 && br === r2 && bc === c2) ||
        (ar === r2 && ac === c2 && br === r1 && bc === c1)
      );
    });

    if (!rel) return null;
    return {
      symbol: rel.type === "A" ? "=" : "×",
      type: rel.type === "A" ? "same" : "opposite",
    };
  };

  if (!grid || grid.length === 0) {
    return (
      <div className="board-loading">
        <div className="loading-spinner" />
        <span>Loading puzzle...</span>
      </div>
    );
  }

  return (
    <div className="puzzle-board" role="grid" aria-label="Puzzle board">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="board-row" role="row">
          {Array.from({ length: cols }).map((_, c) => {
            const key = `${r}-${c}`;
            const isPreFilled = preFilledCells?.[key] != null;
            const hasError = checkCellError(r, c);

            // Horizontal relationship (between c and c+1)
            const hRel = c < cols - 1 ? getRelationship(r, c, r, c + 1) : null;
            // Vertical relationship (between r and r+1)
            const vRel = r < rows - 1 ? getRelationship(r, c, r + 1, c) : null;

            return (
              <div key={key} className="cell-wrapper">
                <Cell
                  row={r}
                  col={c}
                  value={grid[r][c]}
                  onClick={onCellClick}
                  isPreFilled={isPreFilled}
                  hasError={hasError}
                />
                {/* Horizontal constraint indicator */}
                {hRel && (
                  <div
                    className={`constraint-badge horizontal ${hRel.type}`}
                    title={`Cells must be ${hRel.type === "same" ? "the same" : "different"}`}
                  >
                    {hRel.symbol}
                  </div>
                )}
                {/* Vertical constraint indicator */}
                {vRel && (
                  <div
                    className={`constraint-badge vertical ${vRel.type}`}
                    title={`Cells must be ${vRel.type === "same" ? "the same" : "different"}`}
                  >
                    {vRel.symbol}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default React.memo(Board);
