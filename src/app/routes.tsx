import React from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { RepoDashboardPage } from "../ui/pages/RepoDashboard/RepoDashboardPage";

export function AppRoutes(): React.JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<RepoDashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

