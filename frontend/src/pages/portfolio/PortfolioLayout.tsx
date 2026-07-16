import { NavLink, Navigate, Outlet, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { createPortfolio } from "../../api/portfolios";
import { useActivePortfolio } from "../../contexts/ActivePortfolioContext";
import { formatMoney } from "./format";
import styles from "./PortfolioHub.module.css";

const SECTIONS = [
  { path: "", label: "Overview" },
  { path: "trade", label: "Trade" },
  { path: "history", label: "History" },
  { path: "performance", label: "Performance" },
  { path: "settings", label: "Settings" },
] as const;

export default function PortfolioLayout() {
  const { portfolioId } = useParams();
  const navigate = useNavigate();
  const {
    portfolios,
    activePortfolioId,
    activePortfolio,
    isLoading,
    error,
    setActivePortfolioId,
    refreshPortfolios,
  } = useActivePortfolio();
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Portfolio</h1>
        <p className={styles.message}>Loading portfolios…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Portfolio</h1>
        <div className={styles.error} role="alert">
          {error}
        </div>
      </section>
    );
  }

  if (!portfolioId) {
    if (!activePortfolioId) {
      return (
        <section className={styles.page}>
          <h1 className={styles.title}>Portfolio</h1>
          <p className={styles.message}>No portfolios yet.</p>
        </section>
      );
    }
    const search = window.location.search;
    const params = new URLSearchParams(search);
    const symbol = params.get("symbol") ?? undefined;
    const side =
      params.get("side") === "buy" || params.get("side") === "sell"
        ? (params.get("side") as "buy" | "sell")
        : undefined;

    if (symbol) {
      return (
        <Navigate
          to={`/portfolio/${activePortfolioId}/trade?symbol=${encodeURIComponent(symbol)}${side ? `&side=${side}` : ""}`}
          replace
        />
      );
    }

    return <Navigate to={`/portfolio/${activePortfolioId}${search}`} replace />;
  }

  const current =
    portfolios.find((item) => item.id === portfolioId) ?? activePortfolio;

  if (!current) {
    if (activePortfolioId && activePortfolioId !== portfolioId) {
      return <Navigate to={`/portfolio/${activePortfolioId}`} replace />;
    }
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Portfolio</h1>
        <div className={styles.error} role="alert">
          Portfolio not found.
        </div>
      </section>
    );
  }

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createPortfolio({
        name: newName.trim() || "New portfolio",
      });
      await refreshPortfolios();
      setActivePortfolioId(created.id);
      setShowCreate(false);
      setNewName("");
      navigate(`/portfolio/${created.id}`);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create portfolio",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{current.name}</h1>
          <p className={styles.meta}>
            Cash {formatMoney(current.cashBalance)}
            {current.archivedAt ? " · Archived" : ""}
          </p>
        </div>
        <div className={styles.switcher}>
          <label>
            <span className="sr-only">Switch portfolio</span>
            <select
              className={styles.select}
              value={portfolioId}
              onChange={(event) => {
                const id = event.target.value;
                setActivePortfolioId(id);
                navigate(`/portfolio/${id}`);
              }}
            >
              {portfolios.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={() => setShowCreate(true)}
          >
            New portfolio
          </button>
        </div>
      </div>

      <nav className={styles.sectionNav} aria-label="Portfolio sections">
        {SECTIONS.map((section) => {
          const to =
            section.path === ""
              ? `/portfolio/${portfolioId}`
              : `/portfolio/${portfolioId}/${section.path}`;

          return (
            <NavLink
              key={section.path || "overview"}
              to={to}
              end={section.path === ""}
              className={({ isActive }) =>
                isActive
                  ? `${styles.sectionLink} ${styles.sectionLinkActive}`
                  : styles.sectionLink
              }
            >
              {section.label}
            </NavLink>
          );
        })}
      </nav>

      <Outlet />

      {showCreate && (
        <div className={styles.modalBackdrop} role="presentation">
          <div
            className={styles.modal}
            role="dialog"
            aria-labelledby="create-portfolio-title"
          >
            <h2 id="create-portfolio-title">New portfolio</h2>
            <label className={styles.field}>
              <span className={styles.label}>Name</span>
              <input
                className={styles.input}
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="e.g. Aggressive"
                autoFocus
              />
            </label>
            {createError && (
              <div className={styles.error} role="alert">
                {createError}
              </div>
            )}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => setShowCreate(false)}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void handleCreate()}
                disabled={creating}
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
