import React from "react";
import { Button } from "@/components/ui/button";
import { exportLocalDbJson } from "@/lib/dashboard-aggregate";

type Props = {
  children: React.ReactNode;
  scope: string;
};

type State = {
  hasError: boolean;
  message: string;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? "Terjadi error tidak terduga." };
  }

  componentDidCatch(error: Error) {
    console.error(`[ErrorBoundary:${this.props.scope}]`, error);
  }

  private exportLocalDb = () => {
    const blob = new Blob([exportLocalDbJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "local-db-export.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <h2 className="text-xl font-bold">Terjadi Error</h2>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{this.state.message}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>Kembali Dashboard</Button>
          <Button variant="secondary" onClick={this.exportLocalDb}>Export Local DB JSON</Button>
        </div>
      </div>
    );
  }
}
