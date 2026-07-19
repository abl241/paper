import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createStrategy,
  deleteStrategy,
  duplicateStrategy,
  getStrategy,
  listStrategies,
  listStrategyTemplates,
  updateStrategy,
  validateStrategy,
} from "../../api/strategies";
import StrategyCodeEditor from "../../components/strategy/StrategyCodeEditor";
import { useAuth } from "../../contexts/AuthContext";
import type {
  StrategyDetail,
  StrategyMessage,
  StrategySummary,
  StrategyTemplate,
  StrategyTimeframe,
} from "../../types/strategy";
import { STRATEGY_TAGS, STRATEGY_TIMEFRAMES } from "../../types/strategy";
import styles from "./StrategyLabPage.module.css";

type ConsoleEntry = {
  id: string;
  level: "error" | "warning" | "info" | "log";
  text: string;
};

function statusLabel(status: StrategySummary["validationStatus"]) {
  if (status === "valid") return "Valid";
  if (status === "invalid") return "Invalid";
  return "Draft";
}

export default function StrategyLabPage() {
  const { isAuthenticated } = useAuth();
  const [templates, setTemplates] = useState<StrategyTemplate[]>([]);
  const [strategies, setStrategies] = useState<StrategySummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StrategyDetail | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [filter, setFilter] = useState("");

  const pushConsole = useCallback(
    (level: ConsoleEntry["level"], text: string) => {
      setConsoleEntries((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          level,
          text,
        },
        ...prev,
      ].slice(0, 200));
    },
    [],
  );

  const refreshList = useCallback(async () => {
    const [nextTemplates, nextStrategies] = await Promise.all([
      listStrategyTemplates(),
      listStrategies(),
    ]);
    setTemplates(nextTemplates);
    setStrategies(nextStrategies);
    return nextStrategies;
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await refreshList();
        if (cancelled) return;
        if (list.length > 0) {
          setSelectedId(list[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load strategies");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, refreshList]);

  useEffect(() => {
    if (!selectedId) {
      setDraft(null);
      setDirty(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const strategy = await getStrategy(selectedId);
        if (cancelled) return;
        setDraft(strategy);
        setDirty(false);
        setConsoleEntries([]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load strategy");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filteredStrategies = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return strategies;
    return strategies.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        item.symbols.some((symbol) => symbol.toLowerCase().includes(q)),
    );
  }, [filter, strategies]);

  function patchDraft(patch: Partial<StrategyDetail>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  }

  async function handleCreateFromTemplate(template?: StrategyTemplate) {
    setBusy(true);
    setError(null);
    try {
      const created = await createStrategy(
        template
          ? { name: template.name, templateId: template.id }
          : { name: "New Strategy" },
      );
      await refreshList();
      setSelectedId(created.id);
      setDraft(created);
      setDirty(false);
      pushConsole("info", `Created “${created.name}”`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await updateStrategy(draft.id, {
        name: draft.name,
        description: draft.description,
        sourceCode: draft.sourceCode,
        tags: draft.tags,
        isFavorite: draft.isFavorite,
        symbols: draft.symbols,
        exchange: draft.exchange,
        timeframe: draft.timeframe,
        startingCapital: draft.startingCapital,
        params: draft.params,
        risk: draft.risk,
        notes: draft.notes,
      });
      setDraft(saved);
      setDirty(false);
      await refreshList();
      pushConsole("info", `Saved “${saved.name}”`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleValidate() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      let strategyId = draft.id;
      if (dirty) {
        const saved = await updateStrategy(draft.id, {
          name: draft.name,
          description: draft.description,
          sourceCode: draft.sourceCode,
          tags: draft.tags,
          isFavorite: draft.isFavorite,
          symbols: draft.symbols,
          exchange: draft.exchange,
          timeframe: draft.timeframe,
          startingCapital: draft.startingCapital,
          params: draft.params,
          risk: draft.risk,
          notes: draft.notes,
        });
        setDraft(saved);
        setDirty(false);
        strategyId = saved.id;
      }

      const result = await validateStrategy(strategyId);
      setDraft(result.strategy);
      await refreshList();

      const nextEntries: ConsoleEntry[] = [];
      const push = (level: ConsoleEntry["level"], text: string) => {
        nextEntries.push({
          id: `${Date.now()}-${nextEntries.length}`,
          level,
          text,
        });
      };

      for (const message of result.messages) {
        push(
          message.level === "error"
            ? "error"
            : message.level === "warning"
              ? "warning"
              : "info",
          formatMessage(message),
        );
      }
      for (const log of result.logs) {
        push("log", log);
      }
      push(
        result.status === "valid" ? "info" : "error",
        result.status === "valid"
          ? "Validation passed"
          : "Validation failed",
      );
      setConsoleEntries(nextEntries.reverse());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validate failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate() {
    if (!draft) return;
    setBusy(true);
    try {
      const copy = await duplicateStrategy(draft.id);
      await refreshList();
      setSelectedId(copy.id);
      pushConsole("info", `Duplicated as “${copy.name}”`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Duplicate failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!draft) return;
    if (!window.confirm(`Delete “${draft.name}”? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    try {
      await deleteStrategy(draft.id);
      const list = await refreshList();
      setSelectedId(list[0]?.id ?? null);
      pushConsole("info", `Deleted “${draft.name}”`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleFavorite() {
    if (!draft) return;
    patchDraft({ isFavorite: !draft.isFavorite });
    try {
      const saved = await updateStrategy(draft.id, {
        isFavorite: !draft.isFavorite,
      });
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              isFavorite: saved.isFavorite,
              updatedAt: saved.updatedAt,
            }
          : prev,
      );
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Favorite update failed");
    }
  }

  function updateParam(key: string, raw: string) {
    if (!draft) return;
    const next = { ...draft.params };
    if (raw.trim() === "") {
      delete next[key];
    } else if (raw === "true" || raw === "false") {
      next[key] = raw === "true";
    } else if (!Number.isNaN(Number(raw)) && raw.trim() !== "") {
      next[key] = Number(raw);
    } else {
      next[key] = raw;
    }
    patchDraft({ params: next });
  }

  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <section className={styles.lab}>
        <p className={styles.muted}>Loading Strategy Lab…</p>
      </section>
    );
  }

  return (
    <section className={styles.lab}>
      <header className={styles.toolbar}>
        <div className={styles.toolbarTitle}>
          <h1>Strategy Lab</h1>
          <p>Author and validate strategies. Backtests run in Research.</p>
        </div>
        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={styles.button}
            disabled={busy}
            onClick={() => handleCreateFromTemplate()}
          >
            New
          </button>
          <button
            type="button"
            className={styles.button}
            disabled={busy || !draft}
            onClick={handleDuplicate}
          >
            Duplicate
          </button>
          <button
            type="button"
            className={styles.button}
            disabled={busy || !draft || !dirty}
            onClick={handleSave}
          >
            Save{dirty ? " *" : ""}
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonPrimary}`}
            disabled={busy || !draft}
            onClick={handleValidate}
          >
            Validate
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonDanger}`}
            disabled={busy || !draft}
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      </header>

      {error ? (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      ) : null}

      <div className={styles.grid}>
        <aside className={styles.library}>
          <div className={styles.panelHeader}>
            <h2>Library</h2>
            <input
              className={styles.search}
              type="search"
              placeholder="Filter…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>

          <div className={styles.sectionLabel}>Templates</div>
          <ul className={styles.list}>
            {templates.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  className={styles.listItem}
                  disabled={busy}
                  onClick={() => handleCreateFromTemplate(template)}
                >
                  <span className={styles.itemName}>{template.name}</span>
                  <span className={styles.itemMeta}>
                    {template.tags.join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className={styles.sectionLabel}>Your strategies</div>
          {filteredStrategies.length === 0 ? (
            <p className={styles.muted}>No strategies yet. Start from a template.</p>
          ) : (
            <ul className={styles.list}>
              {filteredStrategies.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={
                      item.id === selectedId
                        ? `${styles.listItem} ${styles.listItemActive}`
                        : styles.listItem
                    }
                    onClick={() => {
                      if (dirty && !window.confirm("Discard unsaved changes?")) {
                        return;
                      }
                      setSelectedId(item.id);
                    }}
                  >
                    <span className={styles.itemName}>
                      {item.isFavorite ? "★ " : ""}
                      {item.name}
                    </span>
                    <span className={styles.itemMeta}>
                      <span
                        className={
                          item.validationStatus === "valid"
                            ? styles.badgeValid
                            : item.validationStatus === "invalid"
                              ? styles.badgeInvalid
                              : styles.badgeDraft
                        }
                      >
                        {statusLabel(item.validationStatus)}
                      </span>
                      {item.timeframe}
                      {item.symbols[0] ? ` · ${item.symbols[0]}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className={styles.editorPane}>
          <div className={styles.panelHeader}>
            <h2>{draft?.name ?? "Editor"}</h2>
            {draft ? (
              <span
                className={
                  draft.validationStatus === "valid"
                    ? styles.badgeValid
                    : draft.validationStatus === "invalid"
                      ? styles.badgeInvalid
                      : styles.badgeDraft
                }
              >
                {statusLabel(draft.validationStatus)}
              </span>
            ) : null}
          </div>
          <div className={styles.editorShell}>
            {draft ? (
              <StrategyCodeEditor
                value={draft.sourceCode}
                onChange={(sourceCode) => patchDraft({ sourceCode })}
              />
            ) : (
              <div className={styles.emptyEditor}>
                <p>Select a strategy or create one from a template.</p>
              </div>
            )}
          </div>
        </div>

        <aside className={styles.properties}>
          <div className={styles.panelHeader}>
            <h2>Properties</h2>
            {draft ? (
              <button
                type="button"
                className={styles.iconButton}
                onClick={toggleFavorite}
                aria-label={draft.isFavorite ? "Unfavorite" : "Favorite"}
              >
                {draft.isFavorite ? "★" : "☆"}
              </button>
            ) : null}
          </div>

          {!draft ? (
            <p className={styles.muted}>No strategy selected.</p>
          ) : (
            <div className={styles.form}>
              <label className={styles.field}>
                <span>Name</span>
                <input
                  value={draft.name}
                  onChange={(event) => patchDraft({ name: event.target.value })}
                />
              </label>

              <label className={styles.field}>
                <span>Description</span>
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(event) =>
                    patchDraft({ description: event.target.value })
                  }
                />
              </label>

              <label className={styles.field}>
                <span>Symbols (comma-separated)</span>
                <input
                  value={draft.symbols.join(", ")}
                  onChange={(event) =>
                    patchDraft({
                      symbols: event.target.value
                        .split(",")
                        .map((part) => part.trim().toUpperCase())
                        .filter(Boolean),
                    })
                  }
                />
              </label>

              <label className={styles.field}>
                <span>Exchange</span>
                <select
                  value={draft.exchange ?? ""}
                  onChange={(event) =>
                    patchDraft({
                      exchange:
                        event.target.value === ""
                          ? null
                          : (event.target.value as "gemini" | "coinbase"),
                    })
                  }
                >
                  <option value="">Default</option>
                  <option value="gemini">Gemini</option>
                  <option value="coinbase">Coinbase</option>
                </select>
              </label>

              <label className={styles.field}>
                <span>Timeframe</span>
                <select
                  value={draft.timeframe}
                  onChange={(event) =>
                    patchDraft({
                      timeframe: event.target.value as StrategyTimeframe,
                    })
                  }
                >
                  {STRATEGY_TIMEFRAMES.map((tf) => (
                    <option key={tf} value={tf}>
                      {tf}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>Starting capital</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={draft.startingCapital}
                  onChange={(event) =>
                    patchDraft({
                      startingCapital: Number(event.target.value) || 0,
                    })
                  }
                />
              </label>

              <fieldset className={styles.fieldset}>
                <legend>Tags</legend>
                <div className={styles.tagGrid}>
                  {STRATEGY_TAGS.map((tag) => {
                    const checked = draft.tags.includes(tag);
                    return (
                      <label key={tag} className={styles.tagChip}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const tags = checked
                              ? draft.tags.filter((item) => item !== tag)
                              : [...draft.tags, tag];
                            patchDraft({ tags });
                          }}
                        />
                        {tag}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className={styles.fieldset}>
                <legend>Parameters</legend>
                {Object.keys(draft.params).length === 0 ? (
                  <p className={styles.muted}>No parameters declared.</p>
                ) : (
                  Object.entries(draft.params).map(([key, value]) => (
                    <label key={key} className={styles.field}>
                      <span>{key}</span>
                      <input
                        value={String(value)}
                        onChange={(event) =>
                          updateParam(key, event.target.value)
                        }
                      />
                    </label>
                  ))
                )}
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => {
                    const key = window.prompt("Parameter name");
                    if (!key?.trim()) return;
                    patchDraft({
                      params: { ...draft.params, [key.trim()]: 0 },
                    });
                  }}
                >
                  Add parameter
                </button>
              </fieldset>

              <fieldset className={styles.fieldset}>
                <legend>Risk</legend>
                <label className={styles.field}>
                  <span>Max position %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.risk.maxPositionPct ?? ""}
                    onChange={(event) =>
                      patchDraft({
                        risk: {
                          ...draft.risk,
                          maxPositionPct: event.target.value
                            ? Number(event.target.value)
                            : undefined,
                        },
                      })
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Stop loss %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.risk.stopLossPct ?? ""}
                    onChange={(event) =>
                      patchDraft({
                        risk: {
                          ...draft.risk,
                          stopLossPct: event.target.value
                            ? Number(event.target.value)
                            : undefined,
                        },
                      })
                    }
                  />
                </label>
              </fieldset>

              <label className={styles.field}>
                <span>Notes</span>
                <textarea
                  rows={4}
                  value={draft.notes}
                  onChange={(event) => patchDraft({ notes: event.target.value })}
                />
              </label>
            </div>
          )}
        </aside>

        <div className={styles.console}>
          <div className={styles.panelHeader}>
            <h2>Console</h2>
            <button
              type="button"
              className={styles.button}
              onClick={() => setConsoleEntries([])}
            >
              Clear
            </button>
          </div>
          <div className={styles.consoleBody}>
            {consoleEntries.length === 0 ? (
              <p className={styles.muted}>
                Validation messages and dry-run logs appear here.
              </p>
            ) : (
              <ul className={styles.consoleList}>
                {consoleEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className={`${styles.consoleLine} ${styles[`level_${entry.level}`]}`}
                  >
                    <span className={styles.consoleLevel}>{entry.level}</span>
                    {entry.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function formatMessage(message: StrategyMessage): string {
  return message.line
    ? `Line ${message.line}: ${message.message}`
    : message.message;
}
