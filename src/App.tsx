import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import BarManager from './pages/settings/BarManager';
import BrandManager from './pages/settings/BrandManager';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import AuthCallback from './pages/auth/AuthCallback';
import { ThemeProvider } from './context/ThemeContext';
import { BarProvider } from './context/BarContext';
import { supabase } from './lib/supabase';
import PartyManager from './pages/settings/PartyManager';
import CustomerManager from './pages/settings/CustomerManager';
import EnterTP from './pages/tp-entry/EnterTP';
import ScanTP from './pages/tp-entry/ScanTP';
import TPSummary from './pages/tp-entry/TPSummary';
import DailySales from './pages/sales/DailySales';
import SalesSummary from './pages/sales/SalesSummary';
import GenerateBill from './pages/sales/GenerateBill';
import SalesSCMFile from './pages/sales/SalesSCMFile';
import Inventory from './pages/inventory/Inventory';
import OpeningStock from './pages/settings/OpeningStock';
import Reset from './pages/settings/Reset';
import BrandwiseReport from './pages/reports/BrandwiseReport';
import MonthlyReport from './pages/reports/MonthlyReport';
import StockReport from './pages/reports/StockReport';
import YearlyReport from './pages/reports/YearlyReport';
import VATReport from './pages/reports/VATReport';
import PasswordManager from './pages/online/PasswordManager';
import Login from './pages/online/Login';
import VATLogin from './pages/online/VATLogin';
import Shortcut from './pages/settings/Shortcut';
import TransferBar from './pages/settings/TransferBar';
import StockSummary from './pages/inventory/StockSummary';
import PrintBill from './pages/reports/PrintBill';
import MRPManager from './pages/settings/MRPManager';

// PrivateRoute component to protect routes
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
      } catch (error) {
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/signin" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider>
      <BarProvider>
        <Router>
          <Routes>
            {/* Auth routes */}
            <Route path="/auth/signin" element={<SignIn />} />
            <Route path="/auth/signup" element={<SignUp />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="settings">
                <Route index element={<Navigate to="bar" replace />} />
                <Route path="bar" element={<BarManager />} />
                <Route path="brand" element={<BrandManager />} />
                <Route path="party" element={<PartyManager />} />
                <Route path="customer" element={<CustomerManager />} />
                <Route path="stock" element={<OpeningStock />} />
                <Route path="reset" element={<Reset />} />
                <Route path="shortcut" element={<Shortcut />} />
                <Route path="transfer" element={<TransferBar />} />
                <Route path="mrp" element={<MRPManager />} />
              </Route>
              <Route path="tp-entry">
                <Route path="enter" element={<EnterTP />} />
                <Route path="scan" element={<ScanTP />} />
                <Route path="summary" element={<TPSummary />} />
              </Route>
              <Route path="sales">
                <Route path="daily" element={<DailySales />} />
                <Route path="summary" element={<SalesSummary />} />
                <Route path="generate-bill" element={<GenerateBill />} />
                <Route path="scm-file" element={<SalesSCMFile />} />
              </Route>
              <Route path="inventory" element={<Inventory />} />
              <Route path="inventory/stock-summary" element={<StockSummary />} />
              <Route path="online">
                <Route path="password-manager" element={<PasswordManager />} />
                <Route path="login" element={<Login />} />
                <Route path="vat-login" element={<VATLogin />} />
              </Route>
              <Route path="reports">
                <Route path="brandwise" element={<BrandwiseReport />} />
                <Route path="monthly" element={<MonthlyReport />} />
                <Route path="stock" element={<StockReport />} />
                <Route path="yearly" element={<YearlyReport />} />
                <Route path="vat" element={<VATReport />} />
                <Route path="print-bill" element={<PrintBill />} />
              </Route>
              <Route path="reports/daily-sales" element={<DailySales />} />
              <Route path="reports/vat-report" element={<VATReport />} />
            </Route>
          </Routes>
          <Toaster position="top-right" />
        </Router>
      </BarProvider>
    </ThemeProvider>
  );
}

export default App;