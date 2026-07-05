import { Outlet } from "react-router-dom";
import styles from "./Layout.module.css";
import Header from "./Header";
import Nav from "./Nav";

export default function Layout() {
  return (
    <div className={styles.layout}>
      <Header />
      <Nav />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
