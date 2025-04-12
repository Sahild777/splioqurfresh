import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import BarManager from './pages/settings/BarManager';
import BrandManager from './pages/settings/BrandManager';
import { ThemeProvider } from './context/ThemeContext';
import { BarProvider } from './context/BarContext';
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

function App() {
  return (
    <ThemeProvider>
      <BarProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Layout />}>
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
              <Route path="inventory">
                <Route index element={<Inventory />} />
                <Route path="stock-summary" element={<StockSummary />} />
              </Route>
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