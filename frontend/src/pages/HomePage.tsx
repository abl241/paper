import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import styles from "./HomePage.module.css";

const features = [
  {
    label: "01",
    title: "Markets",
    body: "Follow live crypto prices, spreads, and volume across major pairs.",
    to: "/markets",
  },
  {
    label: "02",
    title: "Portfolio",
    body: "Place simulated buys and sells, then track positions, fills, and equity.",
    to: "/portfolio",
  },
  {
    label: "03",
    title: "Strategy Lab",
    body: "Write and validate trading logic against templates and your own drafts.",
    to: "/strategy-lab",
  },
  {
    label: "04",
    title: "Research",
    body: "Backtest strategies on historical ranges and compare equity curves.",
    to: "/research",
  },
] as const;

const steps = [
  {
    title: "Watch the tape",
    body: "Open Markets and study live quotes the same way you would on a real desk.",
  },
  {
    title: "Trade on paper",
    body: "Fund a simulated portfolio and execute orders without touching real capital.",
  },
  {
    title: "Test the idea",
    body: "Move from discretionary trades into Strategy Lab and Research when you want evidence.",
  },
] as const;

function HeroSketch() {
  return (
    <svg
      className={styles.heroSketch}
      viewBox="0 0 720 420"
      role="img"
      aria-label="Draft sketch of a paper trading workspace"
    >
      <defs>
        <pattern id="heroGrid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="720" height="420" fill="url(#heroGrid)" opacity="0.35" />
      <rect x="36" y="40" width="648" height="340" rx="8" className={styles.sketchPanel} />
      <text x="56" y="78" className={styles.sketchLabel}>
        BTC-USD · live
      </text>
      <polyline
        className={styles.sketchLine}
        points="56,250 110,220 160,235 210,180 270,195 320,150 380,165 440,120 500,140 560,100 640,115"
      />
      <line x1="56" y1="300" x2="640" y2="300" className={styles.sketchRule} />
      <rect x="56" y="318" width="120" height="36" rx="4" className={styles.sketchBar} />
      <rect x="188" y="318" width="120" height="36" rx="4" className={styles.sketchBarMuted} />
      <text x="520" y="78" className={styles.sketchMeta}>
        equity ↑
      </text>
    </svg>
  );
}

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const primaryTo = isAuthenticated ? "/markets" : "/register";
  const primaryLabel = isAuthenticated ? "Open markets" : "Create account";
  const secondaryTo = isAuthenticated ? "/portfolio" : "/markets";
  const secondaryLabel = isAuthenticated ? "View portfolio" : "Browse markets";

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="home-brand">
        <div className={styles.heroVisual} aria-hidden="true">
          <HeroSketch />
        </div>
        <div className={styles.heroContent}>
          <p className={styles.brand} id="home-brand">
            Paper
          </p>
          <h1 className={styles.headline}>Simulated crypto trading with live market data.</h1>
          <p className={styles.lead}>
            Practice execution and research strategies without real money or real orders.
          </p>
          <div className={styles.ctaGroup}>
            <Link className={styles.ctaPrimary} to={primaryTo}>
              {primaryLabel}
            </Link>
            <Link className={styles.ctaSecondary} to={secondaryTo}>
              {secondaryLabel}
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="what-heading">
        <div className={styles.sectionInner}>
          <p className={styles.sectionIndex}>What it is</p>
          <h2 className={styles.sectionTitle} id="what-heading">
            A desk for practicing crypto trades
          </h2>
          <p className={styles.sectionLead}>
            Paper is a simulation environment built around live prices. You can watch markets, trade
            with paper capital, write strategy logic, and backtest ideas in one place.
          </p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="features-heading">
        <div className={styles.sectionInner}>
          <p className={styles.sectionIndex}>Capabilities</p>
          <h2 className={styles.sectionTitle} id="features-heading">
            Four tools, one workflow
          </h2>
          <ul className={styles.featureList}>
            {features.map((feature) => (
              <li key={feature.title} className={styles.featureItem}>
                <span className={styles.featureLabel}>{feature.label}</span>
                <div className={styles.featureCopy}>
                  <h3 className={styles.featureTitle}>
                    <Link className={styles.featureLink} to={feature.to}>
                      {feature.title}
                    </Link>
                  </h3>
                  <p className={styles.featureBody}>{feature.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionBand}`} aria-labelledby="how-heading">
        <div className={styles.sectionInner}>
          <p className={styles.sectionIndex}>How it works</p>
          <h2 className={styles.sectionTitle} id="how-heading">
            Start simple. Add research when you need it.
          </h2>
          <ol className={styles.stepList}>
            {steps.map((step, index) => (
              <li key={step.title} className={styles.stepItem}>
                <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepBody}>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.closing} aria-labelledby="closing-heading">
        <div className={styles.sectionInner}>
          <h2 className={styles.closingTitle} id="closing-heading">
            Ready to draft a trade?
          </h2>
          <p className={styles.closingLead}>
            No real money. No exchange account required. Just live markets and a portfolio you can
            afford to be wrong with.
          </p>
          <div className={styles.ctaGroup}>
            <Link className={styles.ctaPrimary} to={primaryTo}>
              {primaryLabel}
            </Link>
            <Link className={styles.ctaSecondary} to="/markets">
              Explore markets
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
