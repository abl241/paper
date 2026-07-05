import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/layout/Layout";
import HealthPage from "./pages/HealthPage";
import HomePage from "./pages/HomePage";
import PlaceholderPage from "./pages/PlaceholderPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="markets" element={<PlaceholderPage title="Markets" />} />
        <Route path="portfolio" element={<PlaceholderPage title="Portfolio" />} />
        <Route path="trade" element={<PlaceholderPage title="Trade" />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
