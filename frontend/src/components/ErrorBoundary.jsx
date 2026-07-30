import { Component } from "react";

/**
 * Keeps a render failure contained.
 *
 * Without this, one malformed message would throw during render and React 19
 * would unmount the whole tree - the user loses the page, not just the reply.
 */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("Render error:", error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="boundary" role="alert">
        <p>Something went wrong displaying this.</p>
        <button onClick={() => this.setState({ failed: false })}>Try again</button>
      </div>
    );
  }
}
