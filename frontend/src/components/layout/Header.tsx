import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./Header.module.css";

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.logo}>Paper</span>
          <span className={styles.tagline}>Simulated crypto trading</span>
        </div>

        <div className={styles.actions}>
          {user ? (
            <>
              <span className={styles.userLabel}>@{user.username}</span>
              <button className={styles.button} type="button" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link className={styles.link} to="/login">
                Log in
              </Link>
              <Link className={`${styles.link} ${styles.linkPrimary}`} to="/register">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
