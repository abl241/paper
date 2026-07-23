import { useEffect, useMemo, useRef, useState } from "react";
import {
  API_CATEGORIES,
  filterCatalog,
  getApiEntry,
  type ApiCatalogEntry,
  type ApiCategory,
} from "../../strategy/apiCatalog";
import styles from "./ApiExplorerPanel.module.css";

interface ApiExplorerPanelProps {
  activeApiId: string | null;
  onSelectApi: (id: string) => void;
  onClose: () => void;
  onInsertExample: (example: string) => void;
}

export default function ApiExplorerPanel({
  activeApiId,
  onSelectApi,
  onClose,
  onInsertExample,
}: ApiExplorerPanelProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    activeApiId ?? "ctx.buy",
  );
  const detailRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeApiId) {
      setSelectedId(activeApiId);
    }
  }, [activeApiId]);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId, query]);

  const filtered = useMemo(() => filterCatalog(query), [query]);

  const byCategory = useMemo(() => {
    const map = new Map<ApiCategory, ApiCatalogEntry[]>();
    for (const category of API_CATEGORIES) {
      map.set(category, []);
    }
    for (const entry of filtered) {
      map.get(entry.category)?.push(entry);
    }
    return map;
  }, [filtered]);

  const selected = selectedId ? getApiEntry(selectedId) : undefined;

  function select(id: string) {
    setSelectedId(id);
    onSelectApi(id);
  }

  return (
    <div className={styles.panel} role="complementary" aria-label="API Explorer">
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h2>API Explorer</h2>
          <span className={styles.hint}>Ctrl/⌘⇧D</span>
        </div>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close API Explorer"
        >
          ×
        </button>
      </div>

      <div className={styles.searchRow}>
        <input
          className={styles.search}
          type="search"
          placeholder="Search API…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />
      </div>

      <div className={styles.body}>
        <div className={styles.listPane}>
          {filtered.length === 0 ? (
            <p className={styles.muted}>No matches.</p>
          ) : (
            API_CATEGORIES.map((category) => {
              const entries = byCategory.get(category) ?? [];
              if (entries.length === 0) return null;
              return (
                <div key={category} className={styles.category}>
                  <div className={styles.categoryLabel}>{category}</div>
                  <ul className={styles.list}>
                    {entries.map((entry) => {
                      const isActive = entry.id === selectedId;
                      return (
                        <li key={entry.id}>
                          <button
                            type="button"
                            ref={isActive ? activeItemRef : undefined}
                            className={
                              isActive
                                ? `${styles.listItem} ${styles.listItemActive}`
                                : styles.listItem
                            }
                            onClick={() => select(entry.id)}
                          >
                            {entry.name}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </div>

        <div className={styles.detailPane} ref={detailRef}>
          {!selected ? (
            <p className={styles.muted}>Select an API entry.</p>
          ) : (
            <article className={styles.detail}>
              <header className={styles.detailHeader}>
                <h3>{selected.name}</h3>
                <span className={styles.categoryPill}>{selected.category}</span>
              </header>

              <p className={styles.description}>{selected.description}</p>

              <section className={styles.section}>
                <h4>Signature</h4>
                <pre className={styles.signature}>{selected.signature}</pre>
              </section>

              {selected.params.length > 0 ? (
                <section className={styles.section}>
                  <h4>Parameters</h4>
                  <ul className={styles.paramList}>
                    {selected.params.map((param) => (
                      <li key={param.name}>
                        <code>
                          {param.name}
                          {param.optional ? "?" : ""}
                        </code>
                        <span className={styles.paramType}>{param.type}</span>
                        <span className={styles.paramDesc}>
                          {param.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className={styles.section}>
                <h4>Returns</h4>
                <code className={styles.returns}>{selected.returns}</code>
              </section>

              {selected.notes ? (
                <section className={styles.section}>
                  <h4>Notes</h4>
                  <p className={styles.notes}>{selected.notes}</p>
                </section>
              ) : null}

              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h4>Example</h4>
                  <button
                    type="button"
                    className={styles.insertButton}
                    onClick={() => onInsertExample(selected.example)}
                  >
                    Insert Example
                  </button>
                </div>
                <pre className={styles.example}>{selected.example}</pre>
              </section>

              {selected.related.length > 0 ? (
                <section className={styles.section}>
                  <h4>Related</h4>
                  <div className={styles.related}>
                    {selected.related.map((id) => {
                      const related = getApiEntry(id);
                      if (!related) return null;
                      return (
                        <button
                          key={id}
                          type="button"
                          className={styles.relatedChip}
                          onClick={() => select(id)}
                        >
                          {related.name}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
