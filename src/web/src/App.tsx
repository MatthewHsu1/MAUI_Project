import { Navigate, Route, Routes } from "react-router-dom";
import { BondsPage } from "./features/bonds";

export default function App() {
  return (
    <Routes>
      <Route path="/bonds" element={<BondsPage />} />
      <Route path="*" element={<Navigate to="/bonds" replace />} />
    </Routes>
  );
}
