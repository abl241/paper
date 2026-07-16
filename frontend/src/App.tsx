import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/layout/Layout";
import HealthPage from "./pages/HealthPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import MarketsPage from "./pages/MarketsPage";
import MarketFocusPage from "./pages/MarketFocusPage";
import RegisterPage from "./pages/RegisterPage";
import SettingsPage from "./pages/SettingsPage";
import TradeRedirect from "./pages/TradeRedirect";
import HistorySection from "./pages/portfolio/HistorySection";
import OverviewSection from "./pages/portfolio/OverviewSection";
import PerformanceSection from "./pages/portfolio/PerformanceSection";
import PortfolioLayout from "./pages/portfolio/PortfolioLayout";
import SettingsSection from "./pages/portfolio/SettingsSection";
import TradeSection from "./pages/portfolio/TradeSection";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="markets" element={<MarketsPage />} />
        <Route path="markets/:symbol" element={<MarketFocusPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route
          path="portfolio"
          element={
            <ProtectedRoute>
              <PortfolioLayout />
            </ProtectedRoute>
          }
        />
        <Route
          path="portfolio/:portfolioId"
          element={
            <ProtectedRoute>
              <PortfolioLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<OverviewSection />} />
          <Route path="trade" element={<TradeSection />} />
          <Route path="history" element={<HistorySection />} />
          <Route path="performance" element={<PerformanceSection />} />
          <Route path="settings" element={<SettingsSection />} />
        </Route>
        <Route
          path="trade"
          element={
            <ProtectedRoute>
              <TradeRedirect />
            </ProtectedRoute>
          }
        />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
