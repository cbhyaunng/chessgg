import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { BillingPage } from "./pages/BillingPage";
import { GameDetailPage } from "./pages/GameDetailPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PlayerPage } from "./pages/PlayerPage";
import { PricingPage } from "./pages/PricingPage";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/player/:platform/:username" element={<PlayerPage />} />
        <Route path="/player/:platform/:username/game/:gameId" element={<GameDetailPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/account/billing" element={<BillingPage />} />
        <Route path="/auth/login" element={<Navigate to="/" replace />} />
        <Route path="/auth/register" element={<Navigate to="/" replace />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
