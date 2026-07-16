import { useState } from "react";
import { baseAsset, quoteAsset } from "../utils/format";
import styles from "./CoinIcon.module.css";

interface CoinIconProps {
  symbol: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function iconUrl(asset: string) {
  return `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${asset.toLowerCase()}.svg`;
}

function SingleCoin({
  asset,
  size,
  className,
}: {
  asset: string;
  size: "sm" | "md" | "lg";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`${styles.fallback} ${styles[size]} ${className ?? ""}`}
        aria-hidden="true"
        title={asset}
      >
        {asset.slice(0, 4)}
      </span>
    );
  }

  return (
    <img
      className={`${styles.icon} ${styles[size]} ${className ?? ""}`}
      src={iconUrl(asset)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function PairCoin({
  asset,
  role,
}: {
  asset: string;
  role: "base" | "quote";
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`${styles.pairFallback} ${styles[role]}`}
        aria-hidden="true"
        title={asset}
      >
        {asset.slice(0, 3)}
      </span>
    );
  }

  return (
    <img
      className={`${styles.pairIcon} ${styles[role]}`}
      src={iconUrl(asset)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export default function CoinIcon({
  symbol,
  size = "md",
  className,
}: CoinIconProps) {
  const base = baseAsset(symbol).toUpperCase();
  const quote = quoteAsset(symbol)?.toUpperCase() ?? null;

  if (!quote) {
    return <SingleCoin asset={base} size={size} className={className} />;
  }

  return (
    <span
      className={`${styles.pair} ${styles[`pair_${size}`]} ${className ?? ""}`}
      aria-hidden="true"
      title={`${base}/${quote}`}
    >
      <PairCoin asset={base} role="base" />
      <PairCoin asset={quote} role="quote" />
    </span>
  );
}
