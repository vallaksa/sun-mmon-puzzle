/**
 * PuzzleGame.tsx
 *
 * Main game component orchestrating all puzzle logic:
 *  - Grid state management with undo stack
 *  - Cell click handling (null → sun → moon → null cycle)
 *  - Rule validation (3-consecutive, row/col balance, relationships)
 *  - Hint system
 *  - Win detection
 *  - Timer
 *  - New game / clear / undo controls
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import Board from "./Board";
import { getRandomizedPuzzle } from "../data/puzzleLevels";
import { CellValue, GridSnapshot, PuzzleLevel } from "./types";

// ─── Storage Key ────────────────────────────────────────
const STORAGE_KEY = "SUN_MOON_PROGRESS";

// ─── Helper: deep-clone a grid ──────────────────────────
function cloneGrid(grid: CellValue[][]): CellValue[][] {
  return grid.map((row) => [...row]);
}

// ─── Helper: build initial grid from puzzle ─────────────
function buildInitialGrid(puzzle: PuzzleLevel): CellValue[][] {
  const grid: CellValue[][] = Array.from({ length: puzzle.rows }, () =>
    Array.from({ length: puzzle.cols }, () => null)
  );

  if (puzzle.preFilledCells) {
    for (const [key, value] of Object.entries(puzzle.preFilledCells)) {
      if (value !== null) {
        const [r, c] = key.split("-").map(Number);
        grid[r][c] = value;
      }
    }
  }

  return grid;
}

// ─── Helper: format seconds as MM:SS ────────────────────
function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// ─── Component ──────────────────────────────────────────
const PuzzleGame: React.FC = () => {
  // ── Puzzle state ──
  const [puzzle, setPuzzle] = useState<PuzzleLevel>(() => getRandomizedPuzzle("easy"));
  const [grid, setGrid] = useState<CellValue[][]>(() => buildInitialGrid(puzzle));
  const [undoStack, setUndoStack] = useState<GridSnapshot[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [moveCount, setMoveCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // ── Timer ──
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start/stop timer
  useEffect(() => {
    if (!isComplete) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isComplete]);

  // ── Difficulty state ──
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");

  // ── Validation: runs after every grid change ──
  const validateGrid = useCallback(
    (currentGrid: CellValue[][], currentPuzzle: PuzzleLevel): string[] => {
      const violations: string[] = [];
      const { rows, cols } = currentPuzzle;
      const half = cols / 2; // For a 4×4 grid, half = 2

      // Check 3-consecutive horizontally
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c <= cols - 3; c++) {
          const a = currentGrid[r][c];
          const b = currentGrid[r][c + 1];
          const cc = currentGrid[r][c + 2];
          if (a && a === b && b === cc) {
            violations.push(
              `Row ${r + 1}: No more than 2 same symbols may be adjacent horizontally`
            );
          }
        }
      }

      // Check 3-consecutive vertically
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r <= rows - 3; r++) {
          const a = currentGrid[r][c];
          const b = currentGrid[r + 1][c];
          const cc = currentGrid[r + 2][c];
          if (a && a === b && b === cc) {
            violations.push(
              `Col ${c + 1}: No more than 2 same symbols may be adjacent vertically`
            );
          }
        }
      }

      // Check row balance (only for fully-filled rows)
      for (let r = 0; r < rows; r++) {
        const rowVals = currentGrid[r];
        const filled = rowVals.filter((v) => v !== null);
        if (filled.length === cols) {
          const sunCount = filled.filter((v) => v === "sun").length;
          const moonCount = filled.filter((v) => v === "moon").length;
          if (sunCount !== half || moonCount !== half) {
            violations.push(
              `Row ${r + 1}: Must have ${half} suns and ${half} moons`
            );
          }
        }
      }

      // Check column balance (only for fully-filled columns)
      for (let c = 0; c < cols; c++) {
        const colVals = Array.from({ length: rows }, (_, r) => currentGrid[r][c]);
        const filled = colVals.filter((v) => v !== null);
        if (filled.length === rows) {
          const sunCount = filled.filter((v) => v === "sun").length;
          const moonCount = filled.filter((v) => v === "moon").length;
          if (sunCount !== half || moonCount !== half) {
            violations.push(
              `Col ${c + 1}: Must have ${half} suns and ${half} moons`
            );
          }
        }
      }

      // Check relationship constraints
      if (currentPuzzle.relationships) {
        for (const rel of currentPuzzle.relationships) {
          const [rA, cA] = rel.cellA.split("-").map(Number);
          const [rB, cB] = rel.cellB.split("-").map(Number);
          const valA = currentGrid[rA]?.[cA];
          const valB = currentGrid[rB]?.[cB];

          if (valA && valB) {
            if (rel.type === "A" && valA !== valB) {
              violations.push("= constraint violated: cells must be the same");
            }
            if (rel.type === "O" && valA === valB) {
              violations.push("× constraint violated: cells must be different");
            }
          }
        }
      }

      return [...new Set(violations)];
    },
    []
  );

  // Re-validate when grid changes
  useEffect(() => {
    if (!isComplete) {
      const newErrors = validateGrid(grid, puzzle);
      setErrors(newErrors);
    }
  }, [grid, puzzle, isComplete, validateGrid]);

  // ── Cell Click Handler ──
  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (isComplete) return;

      // Don't allow changing pre-filled cells
      const key = `${r}-${c}`;
      if (puzzle.preFilledCells?.[key] != null) return;

      // Save current state to undo stack
      setUndoStack((prev) => [...prev, cloneGrid(grid)]);

      setGrid((prev) => {
        const newGrid = cloneGrid(prev);
        const current = newGrid[r][c];

        // Cycle: null → sun → moon → null
        if (current === null) newGrid[r][c] = "sun";
        else if (current === "sun") newGrid[r][c] = "moon";
        else newGrid[r][c] = null;

        return newGrid;
      });

      setMoveCount((prev) => prev + 1);
    },
    [grid, puzzle, isComplete]
  );

  // ── Submit: check for completion ──
  const handleSubmit = useCallback(() => {
    // Check all cells are filled
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c] === null) {
          setErrors(["Please fill all cells before submitting"]);
          return;
        }
      }
    }

    // Full validation
    const violations = validateGrid(grid, puzzle);
    if (violations.length > 0) {
      setErrors(violations);
      return;
    }

    // Verify against solution
    let matchesSolution = true;
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        if (grid[r][c] !== puzzle.solution[r][c]) {
          matchesSolution = false;
          break;
        }
      }
      if (!matchesSolution) break;
    }

    if (matchesSolution) {
      setIsComplete(true);
      setErrors([]);
    } else {
      setErrors(["The solution is not correct. Keep trying!"]);
    }
  }, [grid, puzzle, validateGrid]);

  // ── Undo ──
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || isComplete) return;

    const previousState = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setGrid(previousState);
    setMoveCount((prev) => Math.max(0, prev - 1));
  }, [undoStack, isComplete]);

  // ── Clear Board ──
  const handleClear = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const confirmClear = useCallback(() => {
    // Save current state to undo stack before clearing
    setUndoStack((prev) => [...prev, cloneGrid(grid)]);
    setGrid(buildInitialGrid(puzzle));
    setErrors([]);
    setShowClearConfirm(false);
  }, [grid, puzzle]);

  // ── New Game ──
  const handleNewGame = useCallback(() => {
    const newPuzzle = getRandomizedPuzzle(difficulty);
    setPuzzle(newPuzzle);
    setGrid(buildInitialGrid(newPuzzle));
    setUndoStack([]);
    setErrors([]);
    setMoveCount(0);
    setIsComplete(false);
    setElapsedSeconds(0);
  }, [difficulty]);

  // ── Hint System ──
  const getHint = useCallback(() => {
    const { rows, cols, solution } = puzzle;

    // Find the first empty cell where we can reveal the answer
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === null) {
          const answer = solution[r][c];
          setErrors([
            `💡 Hint: Cell (${r + 1}, ${c + 1}) should be ${answer === "sun" ? "☀ sun" : "🌙 moon"}`,
          ]);
          return;
        }
        // Also hint if the cell has a wrong value
        if (grid[r][c] !== null && grid[r][c] !== solution[r][c]) {
          setErrors([
            `💡 Hint: Cell (${r + 1}, ${c + 1}) is incorrect — it should be ${solution[r][c] === "sun" ? "☀ sun" : "🌙 moon"}`,
          ]);
          return;
        }
      }
    }

    setErrors(["No hints needed — everything looks correct! Try submitting."]);
  }, [grid, puzzle]);

  // ── Save/Load Progress ──
  const saveProgress = useCallback(() => {
    try {
      const data = {
        grid,
        moveCount,
        elapsedSeconds,
        undoStack,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Error saving progress:", e);
    }
  }, [grid, moveCount, elapsedSeconds, undoStack]);

  // Auto-save on grid change
  useEffect(() => {
    if (!isComplete && moveCount > 0) {
      saveProgress();
    }
  }, [grid, isComplete, moveCount, saveProgress]);

  // ── Render ────────────────────────────────────────────
  return (
    <div className="game-container">
      {/* Header */}
      <header className="game-header">
        <h1 className="game-title">
          <span className="title-sun">☀</span>
          Sun & Moon
          <span className="title-moon">🌙</span>
        </h1>
        <div className="game-meta">
          <span className="meta-badge difficulty">{difficulty}</span>
          <span className="meta-badge">
            {puzzle.rows}×{puzzle.cols}
          </span>
        </div>
      </header>

      {/* Stats Row */}
      <div className="game-stats">
        <div className="stat">
          <span className="stat-label">Time</span>
          <span className="stat-value">{formatTime(elapsedSeconds)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Moves</span>
          <span className="stat-value">{moveCount}</span>
        </div>
      </div>

      {/* Difficulty Selector */}
      <div className="difficulty-selector">
        {(["easy", "medium", "hard"] as const).map((d) => (
          <button
            key={d}
            className={`diff-btn ${difficulty === d ? "active" : ""}`}
            onClick={() => setDifficulty(d)}
            type="button"
          >
            {d}
          </button>
        ))}
      </div>

      {/* Board Area */}
      <div className="board-area">
        <Board puzzle={puzzle} grid={grid} onCellClick={handleCellClick} />

        {/* Error Messages */}
        {errors.length > 0 && !isComplete && (
          <div className="error-panel" role="alert">
            {errors.map((error, index) => (
              <div key={index} className="error-item">
                {error.startsWith("💡") ? "" : "⚠ "}
                {error}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="game-controls">
        <button
          className="control-btn secondary"
          onClick={handleNewGame}
          type="button"
          id="new-game-btn"
        >
          🔄 New Game
        </button>
        <button
          className="control-btn secondary"
          onClick={handleClear}
          type="button"
          id="clear-btn"
        >
          🗑️ Clear
        </button>
        <button
          className="control-btn secondary"
          onClick={handleUndo}
          disabled={undoStack.length === 0 || isComplete}
          type="button"
          id="undo-btn"
        >
          ↩ Undo
        </button>
        <button
          className="control-btn secondary"
          onClick={getHint}
          type="button"
          id="hint-btn"
        >
          💡 Hint
        </button>
        <button
          className="control-btn primary"
          onClick={handleSubmit}
          disabled={isComplete}
          type="button"
          id="submit-btn"
        >
          ✓ Submit
        </button>
      </div>

      {/* Clear Confirmation Dialog */}
      {showClearConfirm && (
        <div className="modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Clear the board?</h3>
            <p className="modal-text">
              This will remove all your placements. Pre-filled cells will remain.
            </p>
            <div className="modal-actions">
              <button
                className="control-btn secondary"
                onClick={() => setShowClearConfirm(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="control-btn danger"
                onClick={confirmClear}
                type="button"
              >
                Clear Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Win Celebration Modal */}
      {isComplete && (
        <div className="modal-overlay celebration" onClick={handleNewGame}>
          <div className="modal-content win-modal" onClick={(e) => e.stopPropagation()}>
            <div className="win-emoji">🎉</div>
            <h2 className="win-title">Puzzle Complete!</h2>
            <div className="win-stats">
              <div className="win-stat">
                <span className="win-stat-label">Time</span>
                <span className="win-stat-value">{formatTime(elapsedSeconds)}</span>
              </div>
              <div className="win-stat">
                <span className="win-stat-label">Moves</span>
                <span className="win-stat-value">{moveCount}</span>
              </div>
            </div>
            <button
              className="control-btn primary win-btn"
              onClick={handleNewGame}
              type="button"
            >
              Play Again 🔄
            </button>
          </div>
        </div>
      )}

      {/* How to Play */}
      <details className="how-to-play">
        <summary>How to play</summary>
        <ul className="rules-list">
          <li>Fill the grid so that each cell contains either a ☀ or a 🌙</li>
          <li>No more than 2 ☀ or 🌙 may be next to each other, either vertically or horizontally</li>
          <li>Each row (and column) must contain the same number of ☀ and 🌙</li>
          <li>Cells separated by an <strong>=</strong> sign must be of the same type</li>
          <li>Cells separated by an <strong>×</strong> sign must be of the opposite type</li>
          <li>Each puzzle has one right answer and can be solved via deduction (you should never have to make a guess)</li>
        </ul>
      </details>
    </div>
  );
};

export default PuzzleGame;
