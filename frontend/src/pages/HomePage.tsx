import surfaces from "../styles/surfaces.module.css";
import styles from "./HomePage.module.css";

export default function HomePage() {
  return (
    <section className={styles.page}>
      <p className={`${surfaces.stamp} ${styles.stamp}`}>Draft · MVP</p>
      <h1 className={styles.title}>Paper Trading Platform</h1>
      <p className={styles.lead}>
        Simulate cryptocurrency trading with live market data. No real money,
        no real orders.
      </p>
      <hr className={surfaces.inkRule} />
      <p className={`${surfaces.annotation} ${styles.note}`}>
        Design foundation
      </p>
    </section>
  );
}
