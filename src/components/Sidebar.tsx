import { FileText, BarChart, Settings, Package, FileSpreadsheet, Key } from 'lucide-react';

const menuItems = [
  {
    title: 'VAT',
    icon: FileSpreadsheet,
    submenu: [
      {
        title: 'VAT Report',
        path: '/reports/vat-report',
        icon: BarChart
      },
      {
        title: 'VAT Login',
        path: '/vat-login',
        icon: Key
      }
    ]
  },
]; 