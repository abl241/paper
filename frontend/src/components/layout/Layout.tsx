import { Outlet, useLocation } from "react-router-dom";
import styles from "./Layout.module.css";
import Header from "./Header";
import Nav from "./Nav";

export default function Layout() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const isLab = pathname.startsWith("/strategy-lab");
  const fullBleed = isHome || isLab;

  const mainClass = fullBleed ? `${styles.main} ${styles.mainWide}` : styles.main;
  const workspaceClass = isHome
    ? styles.workspaceHome
    : isLab
      ? `${styles.workspace} ${styles.workspaceLab}`
      : styles.workspace;

  return (
    <div className={styles.layout}>
      <Header />
      <Nav />
      <main className={mainClass}>
        <div className={workspaceClass}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
