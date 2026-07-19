import { Outlet, useLocation } from "react-router-dom";
import styles from "./Layout.module.css";
import Header from "./Header";
import Nav from "./Nav";

export default function Layout() {
  const { pathname } = useLocation();
  const fullBleed = pathname.startsWith("/strategy-lab");

  return (
    <div className={styles.layout}>
      <Header />
      <Nav />
      <main className={fullBleed ? `${styles.main} ${styles.mainWide}` : styles.main}>
        <div className={fullBleed ? `${styles.workspace} ${styles.workspaceLab}` : styles.workspace}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
