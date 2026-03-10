/**
 * App.tsx
 *
 * Root component of the Sun & Moon Puzzle application.
 * Wraps the game in an error boundary and provides the page layout.
 */
import PuzzleGame from "./components/PuzzleGame";
import ErrorBoundary from "./components/ErrorBoundary";

const App: React.FC = () => {
  return (
    <div className="app-root">
      <ErrorBoundary>
        <PuzzleGame />
      </ErrorBoundary>
    </div>
  );
};

export default App;
