import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import CoinIcon from "./CoinIcon";
import { CloseIcon, FocusIcon, SearchIcon } from "./icons";
import styles from "./MarketSearchModal.module.css";

interface MarketSearchModalProps {
  open: boolean;
  symbols: string[];
  onClose: () => void;
  /** When set, selecting a symbol calls this instead of navigating to Focus. */
  onSelect?: (symbol: string) => void;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
}

const RESULT_LIMIT = 25;

export default function MarketSearchModal({
  open,
  symbols,
  onClose,
  onSelect,
  title = "Find a market",
  subtitle = "Open a focused view for any pair",
  actionLabel = "Focus",
}: MarketSearchModalProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery("");
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const results = useMemo(() => {
    const normalized = query.trim().toUpperCase();
    if (!normalized) {
      return symbols.slice(0, RESULT_LIMIT);
    }

    return symbols
      .filter((symbol) => symbol.includes(normalized))
      .slice(0, RESULT_LIMIT);
  }, [symbols, query]);

  if (!open) {
    return null;
  }

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Close search"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <label className={styles.searchField}>
          <SearchIcon className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            type="search"
            placeholder="Try BTC, ETH-USD, SOL…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <ul className={styles.results}>
          {results.length === 0 ? (
            <li className={styles.empty}>No markets match that search.</li>
          ) : (
            results.map((symbol) => (
              <li key={symbol}>
                <button
                  type="button"
                  className={styles.resultButton}
                  onClick={() => {
                    onClose();
                    if (onSelect) {
                      onSelect(symbol);
                      return;
                    }
                    navigate(`/markets/${encodeURIComponent(symbol)}`);
                  }}
                >
                  <span className={styles.resultAsset}>
                    <CoinIcon symbol={symbol} size="sm" />
                  </span>
                  <span className={styles.resultSymbol}>{symbol}</span>
                  <span className={styles.resultAction}>
                    {!onSelect && <FocusIcon />}
                    {actionLabel}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
