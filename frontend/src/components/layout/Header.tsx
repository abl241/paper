import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <span className={styles.logo}>Paper Trade</span>
        <span className={styles.tagline}>Simulated crypto trading</span>
      </div>
    </header>
  );
}
