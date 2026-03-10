/**
 * Cell.tsx
 *
 * Individual cell in the puzzle grid. Handles rendering of sun/moon symbols,
 * pre-filled vs editable states, and error highlighting with smooth animations.
 */
import React from "react";
import { CellValue } from "./types";

interface CellProps {
  /** Row index in the grid. */
  row: number;
  /** Column index in the grid. */
  col: number;
  /** Current cell value: "sun", "moon", or null. */
  value: CellValue;
  /** Callback fired when cell is clicked. */
  onClick: (row: number, col: number) => void;
  /** Whether this cell was pre-filled and cannot be changed. */
  isPreFilled?: boolean;
  /** Whether this cell is in an error state. */
  hasError?: boolean;
}

const Cell: React.FC<CellProps> = ({
  row,
  col,
  value,
  onClick,
  isPreFilled = false,
  hasError = false,
}) => {
  const handleClick = () => {
    if (!isPreFilled) {
      onClick(row, col);
    }
  };

  /**
   * Renders the sun or moon symbol with appropriate styling.
   */
  const renderSymbol = () => {
    if (!value) return null;

    if (value === "sun") {
      return (
        <div className={`cell-symbol sun-symbol ${hasError ? "error" : ""}`}>
          <svg viewBox="0 0 36 36" width="28" height="28" fill="none">
            <circle
              cx="18"
              cy="18"
              r="9"
              fill={hasError ? "#ef4444" : "#f59e0b"}
            />
            {/* Sun rays */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <line
                key={angle}
                x1="18"
                y1="18"
                x2={18 + 14 * Math.cos((angle * Math.PI) / 180)}
                y2={18 + 14 * Math.sin((angle * Math.PI) / 180)}
                stroke={hasError ? "#ef4444" : "#f59e0b"}
                strokeWidth="2"
                strokeLinecap="round"
              />
            ))}
          </svg>
        </div>
      );
    }

    return (
      <div className={`cell-symbol moon-symbol ${hasError ? "error" : ""}`}>
        <svg viewBox="0 0 36 36" width="28" height="28" fill="none">
          <path
            d="M22 8a12 12 0 1 0 0 20 10 10 0 0 1 0-20z"
            fill={hasError ? "#ef4444" : "#6366f1"}
          />
        </svg>
      </div>
    );
  };

  return (
    <button
      className={[
        "puzzle-cell",
        isPreFilled ? "pre-filled" : "editable",
        hasError ? "has-error" : "",
        value ? `has-${value}` : "empty",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleClick}
      aria-label={`Cell ${row + 1},${col + 1}: ${value ?? "empty"}${isPreFilled ? " (locked)" : ""}`}
      disabled={isPreFilled}
      type="button"
    >
      {renderSymbol()}
    </button>
  );
};

export default React.memo(Cell);
