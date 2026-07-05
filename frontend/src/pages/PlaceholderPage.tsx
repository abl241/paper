import styles from "./PlaceholderPage.module.css";

interface PlaceholderPageProps {
  title: string;
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.message}>Coming soon.</p>
    </section>
  );
}
