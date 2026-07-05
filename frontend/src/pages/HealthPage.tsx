import { useEffect, useState } from "react";
import { getHealth } from "../api/health";
import type { HealthResponse } from "../types/health";
import styles from "./HealthPage.module.css";

type LoadState =
  | { status: "loading" }
  | { status: "success"; data: HealthResponse }
  | { status: "error"; message: string };

export default function HealthPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    getHealth()
      .then((data) => {
        if (!cancelled) {
          setState({ status: "success", data });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to reach backend";
          setState({ status: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>System Health</h1>
      <p className={styles.lead}>
        Live check against the backend <code>/health</code> endpoint.
      </p>

      {state.status === "loading" && (
        <p className={styles.status} role="status">
          Checking backend…
        </p>
      )}

      {state.status === "error" && (
        <div className={styles.error} role="alert">
          <strong>Connection failed</strong>
          <p>{state.message}</p>
        </div>
      )}

      {state.status === "success" && (
        <div className={styles.success}>
          <p className={styles.statusOk}>Backend is reachable</p>
          <pre className={styles.response}>
            {JSON.stringify(state.data, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}
