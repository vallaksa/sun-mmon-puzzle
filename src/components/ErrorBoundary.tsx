/**
 * ErrorBoundary.tsx
 *
 * Catches uncaught rendering errors in child components.
 * Displays a recovery UI instead of crashing the entire app.
 */
import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: "",
  };

  /** Updates state when a child component throws during rendering. */
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  /** Logs error details for debugging. */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-card">
            <h2>Something went wrong</h2>
            <p>{this.state.errorMessage || "An unexpected error occurred."}</p>
            <button
              className="control-btn primary"
              onClick={() => this.setState({ hasError: false, errorMessage: "" })}
              type="button"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;