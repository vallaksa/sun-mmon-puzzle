# ☀ Sun & Moon Puzzle 🌙

A premium logic puzzle game built with **React**, **TypeScript**, and **Vite**. Inspired by LinkedIn's "Tango" puzzle — fill a grid with suns and moons following constraint-based rules. Every puzzle is solvable by pure deduction, no guessing required.

![Sun & Moon Puzzle](https://img.shields.io/badge/status-playable-brightgreen) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue) ![React](https://img.shields.io/badge/React-18.2-61dafb) ![Vite](https://img.shields.io/badge/Vite-4.5-646CFF)

---

## 🎮 How to Play

| Rule | Description |
|------|-------------|
| **Fill every cell** | Each cell must contain either a ☀ (sun) or a 🌙 (moon) |
| **No 3 in a row** | No more than 2 identical symbols may be adjacent horizontally or vertically |
| **Balance** | Each row and column must have an equal number of ☀ and 🌙 |
| **= constraint** | Cells separated by `=` must be the **same** type |
| **× constraint** | Cells separated by `×` must be **different** types |
| **Unique solution** | Each puzzle has exactly one correct answer |

---

## ✨ Features

- **Randomized puzzles** — Every "New Game" generates a fresh, uniquely solvable puzzle using constrained backtracking
- **Three difficulty levels** — Easy, Medium, Hard (controls how many cells are revealed)
- **Undo system** — Full move history with unlimited undo
- **Hint system** — Solution-backed hints that point to the next logical cell
- **Timer & move counter** — Track your performance
- **Auto-save** — Progress saves to `localStorage` automatically
- **Win celebration** — Animated modal with stats on completion
- **Dark mode** — Premium dark theme with ambient gradients and micro-animations
- **Responsive** — Works on desktop and mobile (down to 360px)
- **Accessible** — ARIA labels, keyboard-friendly, semantic HTML

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 18 |
| Language | TypeScript 5.0 |
| Bundler | Vite 4.5 |
| Styling | TailwindCSS 3.3 + Vanilla CSS |
| Build Tools | PostCSS, Autoprefixer |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 16
- **npm** ≥ 8

### Install & Run

```bash
# Clone the repository
git clone <your-repo-url>
cd sun-moon-puzzle

# Install dependencies
npm install

# Start development server (opens http://localhost:3000)
npm run dev
```

### Build for Production

```bash
npm run build
npm run preview
```

---

## 📁 Project Structure

```
sun-moon-puzzle/
├── index.html                    # Entry HTML with SEO meta
├── package.json                  # Dependencies & scripts
├── vite.config.ts                # Vite config (port 3000)
├── tailwind.config.js            # TailwindCSS config
├── postcss.config.js             # PostCSS config
├── tsconfig.json                 # TypeScript config
└── src/
    ├── main.tsx                  # React DOM mount point
    ├── tailwind.css              # Design system & theme
    ├── App.tsx                   # Root component
    ├── data/
    │   └── puzzleLevels.ts       # Puzzle generation engine
    └── components/
        ├── types.ts              # Type definitions
        ├── PuzzleGame.tsx        # Main game logic & state
        ├── Board.tsx             # Grid renderer with constraints
        ├── Cell.tsx              # Individual cell with SVG symbols
        └── ErrorBoundary.tsx     # Global error recovery
```

---

## 🧩 Puzzle Generation Algorithm

1. **Solution generation** — Constrained backtracking fills a valid N×N grid ensuring equal suns/moons per row/column and no 3-consecutive symbols
2. **Relationship placement** — Random adjacent cell pairs receive `=` (same) or `×` (opposite) constraints derived from the solution
3. **Cell removal** — Cells are removed one-by-one; after each removal, a deduction solver verifies the puzzle remains logically solvable with a unique solution
4. **Difficulty scaling** — Controls the number of revealed cells and constraint hints

---

## 📝 License

ISC
