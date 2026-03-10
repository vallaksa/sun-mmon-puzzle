/**
 * PuzzleGame.tsx
 *
 * Main game component orchestrating all puzzle logic:
 *  - Grid state management with undo stack
 *  - Cell click handling (null → sun → moon → null cycle)
 *  - Grid size selector (4×4 / 6×6)
 *  - Difficulty selector (Easy / Medium / Hard) with auto-regeneration
 *  - Rule validation (3-consecutive, row/col balance, relationships)
 *  - Hint system backed by the actual solution
 *  - Win detection with celebration modal
 *  - Timer & move counter
 *  - Auto-save to localStorage
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import Board from "./Board";
import { getRandomizedPuzzle } from "../data/puzzleLevels";
import type { GridSize, Difficulty } from "../data/puzzleLevels";
import { CellValue, GridSnapshot, PuzzleLevel } from "./types";

// ─── Constants ──────────────────────────────────────────
const STORAGE_KEY = "SUN_MOON_PROGRESS";

// ─── Helpers ────────────────────────────────────────────

/** Deep-clones a 2D grid. */
function cloneGrid(grid: CellValue[][]): CellValue[][] {
  return grid.map((row) => [...row]);
}

/** Builds the initial grid from a puzzle's pre-filled cells. */
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

/** Formats seconds as MM:SS. */
function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// ─── Component ──────────────────────────────────────────
const PuzzleGame: React.FC = () => {
  // ── Config state ──
  const [gridSize, setGridSize] = useState<GridSize>(4);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  // ── Puzzle state ──
  const [puzzle, setPuzzle] = useState<PuzzleLevel>(() =>
    getRandomizedPuzzle(4, "easy")
  );
  const [grid, setGrid] = useState<CellValue[][]>(() => buildInitialGrid(puzzle));
  const [undoStack, setUndoStack] = useState<GridSnapshot[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [moveCount, setMoveCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSettingsConfirm, setShowSettingsConfirm] = useState<{
    type: "gridSize" | "difficulty";
    value: GridSize | Difficulty;
  } | null>(null);

  // ── Timer ──
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // ── Start a new game with given settings ──
  const startNewGame = useCallback(
    (size: GridSize, diff: Difficulty) => {
      const newPuzzle = getRandomizedPuzzle(size, diff);
      setPuzzle(newPuzzle);
      setGrid(buildInitialGrid(newPuzzle));
      setUndoStack([]);
      setErrors([]);
      setMoveCount(0);
      setIsComplete(false);
      setElapsedSeconds(0);
    },
    []
  );

  // ── Handle grid size change ──
  const handleGridSizeChange = useCallback(
    (newSize: GridSize) => {
      if (newSize === gridSize) return;

      if (moveCount > 0) {
        setShowSettingsConfirm({ type: "gridSize", value: newSize });
      } else {
        setGridSize(newSize);
        startNewGame(newSize, difficulty);
      }
    },
    [gridSize, moveCount, difficulty, startNewGame]
  );

  // ── Handle difficulty change ──
  const handleDifficultyChange = useCallback(
    (newDiff: Difficulty) => {
      if (newDiff === difficulty) return;

      if (moveCount > 0) {
        setShowSettingsConfirm({ type: "difficulty", value: newDiff });
      } else {
        setDifficulty(newDiff);
        startNewGame(gridSize, newDiff);
      }
    },
    [difficulty, moveCount, gridSize, startNewGame]
  );

  // ── Confirm settings change (discards progress) ──
  const confirmSettingsChange = useCallback(() => {
    if (!showSettingsConfirm) return;

    if (showSettingsConfirm.type === "gridSize") {
      const newSize = showSettingsConfirm.value as GridSize;
      setGridSize(newSize);
      startNewGame(newSize, difficulty);
    } else {
      const newDiff = showSettingsConfirm.value as Difficulty;
      setDifficulty(newDiff);
      startNewGame(gridSize, newDiff);
    }
    setShowSettingsConfirm(null);
  }, [showSettingsConfirm, gridSize, difficulty, startNewGame]);

  // ── Validation ──
  const validateGrid = useCallback(
    (currentGrid: CellValue[][], currentPuzzle: PuzzleLevel): string[] => {
      const violations: string[] = [];
      const { rows, cols } = currentPuzzle;
      const half = cols / 2;

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

      // Row balance (fully-filled rows only)
      for (let r = 0; r < rows; r++) {
        const filled = currentGrid[r].filter((v) => v !== null);
        if (filled.length === cols) {
          const sunCount = filled.filter((v) => v === "sun").length;
          if (sunCount !== half) {
            violations.push(`Row ${r + 1}: Must have ${half} suns and ${half} moons`);
          }
        }
      }

      // Column balance (fully-filled columns only)
      for (let c = 0; c < cols; c++) {
        const colVals = Array.from({ length: rows }, (_, r) => currentGrid[r][c]);
        const filled = colVals.filter((v) => v !== null);
        if (filled.length === rows) {
          const sunCount = filled.filter((v) => v === "sun").length;
          if (sunCount !== half) {
            violations.push(`Col ${c + 1}: Must have ${half} suns and ${half} moons`);
          }
        }
      }

      // Relationship constraints
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

  // Re-validate on grid change
  useEffect(() => {
    if (!isComplete) {
      setErrors(validateGrid(grid, puzzle));
    }
  }, [grid, puzzle, isComplete, validateGrid]);

  // ── Cell Click ──
  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (isComplete) return;
      if (puzzle.preFilledCells?.[`${r}-${c}`] != null) return;

      setUndoStack((prev) => [...prev, cloneGrid(grid)]);

      setGrid((prev) => {
        const newGrid = cloneGrid(prev);
        const current = newGrid[r][c];
        if (current === null) newGrid[r][c] = "sun";
        else if (current === "sun") newGrid[r][c] = "moon";
        else newGrid[r][c] = null;
        return newGrid;
      });

      setMoveCount((prev) => prev + 1);
    },
    [grid, puzzle, isComplete]
  );

  // ── Submit ──
  const handleSubmit = useCallback(() => {
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c] === null) {
          setErrors(["Please fill all cells before submitting"]);
          return;
        }
      }
    }

    const violations = validateGrid(grid, puzzle);
    if (violations.length > 0) {
      setErrors(violations);
      return;
    }

    // Verify against solution
    let correct = true;
    for (let r = 0; r < puzzle.rows && correct; r++) {
      for (let c = 0; c < puzzle.cols && correct; c++) {
        if (grid[r][c] !== puzzle.solution[r][c]) correct = false;
      }
    }

    if (correct) {
      setIsComplete(true);
      setErrors([]);
    } else {
      setErrors(["The solution is not correct. Keep trying!"]);
    }
  }, [grid, puzzle, validateGrid]);

  // ── Undo ──
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || isComplete) return;
    setGrid(undoStack[undoStack.length - 1]);
    setUndoStack((prev) => prev.slice(0, -1));
    setMoveCount((prev) => Math.max(0, prev - 1));
  }, [undoStack, isComplete]);

  // ── Clear ──
  const confirmClear = useCallback(() => {
    setUndoStack((prev) => [...prev, cloneGrid(grid)]);
    setGrid(buildInitialGrid(puzzle));
    setErrors([]);
    setShowClearConfirm(false);
  }, [grid, puzzle]);

  // ── New Game ──
  const handleNewGame = useCallback(() => {
    startNewGame(gridSize, difficulty);
  }, [gridSize, difficulty, startNewGame]);

  // ── Hint ──
  const getHint = useCallback(() => {
    const { rows, cols, solution } = puzzle;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === null) {
          const answer = solution[r][c];
          setErrors([
            `💡 Hint: Cell (${r + 1}, ${c + 1}) should be ${answer === "sun" ? "☀ sun" : "🌙 moon"}`,
          ]);
          return;
        }
        if (grid[r][c] !== solution[r][c]) {
          setErrors([
            `💡 Hint: Cell (${r + 1}, ${c + 1}) is incorrect — it should be ${solution[r][c] === "sun" ? "☀ sun" : "🌙 moon"}`,
          ]);
          return;
        }
      }
    }
    setErrors(["No hints needed — everything looks correct! Try submitting."]);
  }, [grid, puzzle]);

  // ── Auto-save ──
  const saveProgress = useCallback(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ grid, moveCount, elapsedSeconds, undoStack })
      );
    } catch (e) {
      console.error("Error saving progress:", e);
    }
  }, [grid, moveCount, elapsedSeconds, undoStack]);

  useEffect(() => {
    if (!isComplete && moveCount > 0) saveProgress();
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

      {/* Stats */}
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

      {/* Grid Size Selector */}
      <div className="selector-group">
        <span className="selector-label">Grid</span>
        <div className="selector-buttons">
          {([4, 6] as GridSize[]).map((size) => (
            <button
              key={size}
              className={`sel-btn ${gridSize === size ? "active" : ""}`}
              onClick={() => handleGridSizeChange(size)}
              type="button"
            >
              {size}×{size}
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty Selector */}
      <div className="selector-group">
        <span className="selector-label">Difficulty</span>
        <div className="selector-buttons">
          {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
            <button
              key={d}
              className={`sel-btn ${difficulty === d ? "active" : ""}`}
              onClick={() => handleDifficultyChange(d)}
              type="button"
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Board */}
      <div className="board-area">
        <Board puzzle={puzzle} grid={grid} onCellClick={handleCellClick} />

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
        <button className="control-btn secondary" onClick={handleNewGame} type="button" id="new-game-btn">
          🔄 New Game
        </button>
        <button className="control-btn secondary" onClick={() => setShowClearConfirm(true)} type="button" id="clear-btn">
          🗑️ Clear
        </button>
        <button className="control-btn secondary" onClick={handleUndo} disabled={undoStack.length === 0 || isComplete} type="button" id="undo-btn">
          ↩ Undo
        </button>
        <button className="control-btn secondary" onClick={getHint} type="button" id="hint-btn">
          💡 Hint
        </button>
        <button className="control-btn primary" onClick={handleSubmit} disabled={isComplete} type="button" id="submit-btn">
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
              <button className="control-btn secondary" onClick={() => setShowClearConfirm(false)} type="button">
                Cancel
              </button>
              <button className="control-btn danger" onClick={confirmClear} type="button">
                Clear Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Change Confirmation Dialog */}
      {showSettingsConfirm && (
        <div className="modal-overlay" onClick={() => setShowSettingsConfirm(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Start a new puzzle?</h3>
            <p className="modal-text">
              Changing {showSettingsConfirm.type === "gridSize" ? "grid size" : "difficulty"} to{" "}
              <strong>
                {showSettingsConfirm.type === "gridSize"
                  ? `${showSettingsConfirm.value}×${showSettingsConfirm.value}`
                  : String(showSettingsConfirm.value)}
              </strong>{" "}
              will discard your current progress.
            </p>
            <div className="modal-actions">
              <button className="control-btn secondary" onClick={() => setShowSettingsConfirm(null)} type="button">
                Cancel
              </button>
              <button className="control-btn primary" onClick={confirmSettingsChange} type="button">
                New Puzzle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Win Celebration */}
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
              <div className="win-stat">
                <span className="win-stat-label">Grid</span>
                <span className="win-stat-value">{puzzle.rows}×{puzzle.cols}</span>
              </div>
              <div className="win-stat">
                <span className="win-stat-label">Difficulty</span>
                <span className="win-stat-value capitalize">{difficulty}</span>
              </div>
            </div>
            <button className="control-btn primary win-btn" onClick={handleNewGame} type="button">
              Play Again 🔄
            </button>
          </div>
        </div>
      )}

      {/* How to Play */}
      <details className="how-to-play">
        <summary>How to play</summary>
        <ul className="rules-list">
          <li>Fill the {gridSize}×{gridSize} grid so every cell contains either a ☀ or a 🌙</li>
          <li>No more than 2 identical symbols may be adjacent horizontally or vertically</li>
          <li>Each row and column must have exactly {gridSize / 2} ☀ and {gridSize / 2} 🌙</li>
          <li>Cells separated by <strong>=</strong> must be the <strong>same</strong> type</li>
          <li>Cells separated by <strong>×</strong> must be <strong>different</strong> types</li>
          <li>Each puzzle has exactly one solution — no guessing needed!</li>
        </ul>
      </details>
    </div>
  );
};

export default PuzzleGame;
