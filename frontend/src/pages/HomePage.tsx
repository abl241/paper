import styles from "./HomePage.module.css";

export default function HomePage() {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Paper Trading Platform</h1>
      <p className={styles.lead}>
        Simulate cryptocurrency trading with live market data. No real money,
        no real orders.
      </p>
      <p className={styles.note}>
        Milestone 1 foundation — market data and trading features coming soon.
      </p>
    </section>
  );
}
