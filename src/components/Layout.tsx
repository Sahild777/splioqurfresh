import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Menu, X, Home, FileText, ShoppingCart, Globe, BarChart3, Package, Settings, Sun, Moon, LogOut, Store, ChevronDown, Calendar, Command, Users, RefreshCw, ScanLine, Tags, Key, FileSpreadsheet } from 'lucide-react';
import { MenuItem } from '../types';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { useBar } from '../context/BarContext';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";

// Add this CSS keyframes animation at the top of the file
const breatheAnimation = `
@keyframes breathe {
  0%, 100% {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }
  50% {
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }
}

@keyframes glow {
  0%, 100% {
    text-shadow: 0 0 5px rgba(59, 130, 246, 0.5);
  }
  50% {
    text-shadow: 0 0 20px rgba(59, 130, 246, 0.8);
  }
}

@keyframes float {
  0% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-3px) scale(1.02);
  }
  100% {
    transform: translateY(0) scale(1);
  }
}

@keyframes shine {
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

@keyframes menuBounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
}

@keyframes menuPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
}

@keyframes gradientMove {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@keyframes borderGlow {
  0%, 100% {
    border-color: rgba(59, 130, 246, 0.2);
  }
  50% {
    border-color: rgba(99, 102, 241, 0.4);
  }
}

@keyframes meshMove {
  0% {
    transform: rotate(0deg) scale(1);
  }
  50% {
    transform: rotate(180deg) scale(1.1);
  }
  100% {
    transform: rotate(360deg) scale(1);
  }
}

@keyframes scaleOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes menuSlideIn {
  from {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes menuSlideOut {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }
}

@keyframes menuFadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes menuFadeOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-5px);
  }
}
`;

const menuItems: MenuItem[] = [
  {
    name: 'HOME',
    path: '/',
    icon: 'Home'
  },
  {
    name: 'TP ENTRY',
    path: '/tp-entry',
    icon: 'FileText',
    subMenu: [
      { name: 'ENTER TP', path: '/tp-entry/enter', badge: 'A' },
      { name: 'SCAN TP', path: '/tp-entry/scan', badge: 'B', icon: 'ScanLine' },
      { name: 'TP SUMMARY', path: '/tp-entry/summary', badge: 'C' }
    ]
  },
  {
    name: 'SALES',
    path: '/sales',
    icon: 'ShoppingCart',
    subMenu: [
      { name: 'DAILY SALE', path: '/sales/daily', badge: 'A' },
      { name: 'SALE SUMMARY', path: '/sales/summary', badge: 'B' },
      { name: 'GENERATE BILL', path: '/sales/generate-bill', badge: 'C' },
      { name: 'SALES SCM FILE', path: '/sales/scm-file', badge: 'D', icon: 'FileSpreadsheet' }
    ]
  },
  {
    name: 'ONLINE',
    path: '/online',
    icon: 'Globe',
    subMenu: [
      { name: 'PASSWORD MANAGER', path: '/online/password-manager', badge: 'A' },
      { name: 'LOGIN TO SCM', path: '/online/login', badge: 'B' },
      { name: 'VAT LOGIN', path: '/online/vat-login', badge: 'C', icon: 'Key' }
    ]
  },
  {
    name: 'REPORTS',
    path: '/reports',
    icon: 'BarChart3',
    subMenu: [
      { name: 'BRANDWISE REPORT', path: '/reports/brandwise', badge: 'A' },
      { name: 'MONTHLY REPORT', path: '/reports/monthly', badge: 'B' },
      { name: 'STOCK REPORT', path: '/reports/stock', badge: 'C' },
      { name: 'YEARLY REPORT', path: '/reports/yearly', badge: 'D' },
      { name: 'VAT REPORT', path: '/reports/vat', badge: 'E' },
      { name: 'PRINT BILL', path: '/reports/print-bill', badge: 'F' }
    ]
  },
  {
    name: 'INVENTORY',
    path: '/inventory',
    icon: 'Package',
    subMenu: [
      { name: 'INVENTORY', path: '/inventory', badge: 'A' },
      { name: 'STOCK SUMMARY', path: '/inventory/stock-summary', badge: 'B' }
    ]
  },
  {
    name: 'SETTINGS',
    path: '/settings',
    icon: 'Settings',
    subMenu: [
      { name: 'BAR MANAGER', path: '/settings/bar', icon: 'Store', badge: 'A' },
      { name: 'BRAND MANAGER', path: '/settings/brand', icon: 'Package', badge: 'B' },
      { name: 'BRAND SHORTCUTS', path: '/settings/shortcut', icon: 'Command', badge: 'C' },
      { name: 'PARTY MANAGER', path: '/settings/party', icon: 'Users', badge: 'D' },
      { name: 'CUSTOMER MANAGER', path: '/settings/customer', icon: 'Users', badge: 'E' },
      { name: 'OPENING STOCK', path: '/settings/stock', icon: 'Package', badge: 'F' },
      { name: 'RESET DATA', path: '/settings/reset', icon: 'RefreshCw', badge: 'G' },
      { name: 'TRANSFER BAR', path: '/settings/transfer', icon: 'Calendar', badge: 'H' },
      { name: 'SET MRP', path: '/settings/mrp', icon: 'Tags', badge: 'I' }
    ]
  }
];

const IconMap: Record<string, React.ComponentType> = {
  Home,
  FileText,
  ShoppingCart,
  Globe,
  BarChart3,
  Package,
  Settings,
  Menu,
  X,
  Store,
  Calendar,
  Command,
  Users,
  RefreshCw,
  ScanLine,
  Tags,
  Key,
  FileSpreadsheet
};

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeMenu, setActiveMenu] = React.useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { theme, toggleTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { selectedBar, setSelectedBar, bars } = useBar();
  const [showBarDialog, setShowBarDialog] = useState(false);
  
  // Add refs and states for the sliding indicator
  const menuItemsRef = useRef<{ [key: string]: HTMLElement | null }>({});
  const [indicatorStyle, setIndicatorStyle] = useState({
    left: 0,
    width: 0,
    opacity: 0
  });
  
  // Add effect to show dialog on page load or refresh
  useEffect(() => {
    const storedBarId = localStorage.getItem('selectedBarId');
    if (bars && bars.length > 0) {
      if (!storedBarId) {
        // First time user - show dialog
        setShowBarDialog(true);
      } else {
        // User has selected a bar before - restore it
        const storedBar = bars.find(bar => bar.id === parseInt(storedBarId));
        if (storedBar) {
          setSelectedBar(storedBar);
        } else {
          // If stored bar not found, show dialog
          setShowBarDialog(true);
        }
      }
    }
  }, [bars, setSelectedBar]);

  // Find current menu item based on path
  React.useEffect(() => {
    const currentPath = location.pathname;
    const currentMenuItem = menuItems.find(item => {
      if (item.path === currentPath) return true;
      if (item.subMenu?.some(subItem => subItem.path === currentPath)) {
        return true;
      }
      // Handle nested routes
      if (currentPath.startsWith(item.path + '/')) {
        return true;
      }
      return false;
    });
    if (currentMenuItem) {
      setActiveMenu(currentMenuItem.name);
    }
  }, [location.pathname]);
  
  // Update the indicator position when activeMenu changes
  useEffect(() => {
    if (activeMenu) {
      const menuId = activeMenu.replace(/\s+/g, '-').toLowerCase();
      const activeElement = menuItemsRef.current[menuId];
      
      if (activeElement) {
        setIndicatorStyle({
          left: activeElement.offsetLeft,
          width: activeElement.offsetWidth,
          opacity: 1
        });
      }
    }
  }, [activeMenu]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const IconComponent = (iconName: string) => {
    const Icon = IconMap[iconName];
    return Icon ? <div className="w-5 h-5"><Icon /></div> : null;
  };

  const handleMenuClick = (item: MenuItem) => {
    if (item.subMenu) {
      if (activeMenu === item.name) {
        setActiveMenu('');
      } else {
        setActiveMenu(item.name);
      }
    } else {
      setActiveMenu(item.name);
      navigate(item.path);
    }
  };

  const handleSubMenuClick = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
    setTimeout(() => {
      setActiveMenu('');
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-200">
      {/* Bar Selection Dialog */}
      <Dialog open={showBarDialog} onOpenChange={setShowBarDialog}>
        <DialogContent className="sm:max-w-[425px] bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-2xl backdrop-blur-xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Select a Bar
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-300 text-base">
              Choose a bar to continue using the application
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {bars?.map((bar) => (
              <button
                key={bar.id}
                onClick={() => {
                  setSelectedBar(bar);
                  localStorage.setItem('selectedBarId', bar.id.toString());
                  setShowBarDialog(false);
                  toast.success(`Selected ${bar.bar_name}`, {
                    duration: 2000,
                    position: 'top-right',
                    style: {
                      background: '#10B981',
                      color: 'white',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    },
                    iconTheme: {
                      primary: 'white',
                      secondary: '#10B981',
                    },
                  });
                }}
                className={`w-full px-4 py-3 text-left rounded-xl transition-all duration-200 hover:scale-[1.02] flex items-center space-x-3 relative overflow-hidden group
                  ${selectedBar?.id === bar.id
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-600 dark:text-blue-400 font-medium shadow-md'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 shadow-sm hover:shadow-md'
                  }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-r from-blue-500/0 to-indigo-500/0 opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                <Store className={`w-5 h-5 ${selectedBar?.id === bar.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400'}`} />
                <span className="relative z-10">{bar.bar_name}</span>
                {selectedBar?.id === bar.id && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modern Glassmorphism Topbar */}
      <nav className="sticky top-0 z-50 bg-gradient-to-r from-white/90 via-white/95 to-white/90 dark:from-gray-800/90 dark:via-gray-800/95 dark:to-gray-800/90 backdrop-blur-xl border-b border-gray-200/30 dark:border-gray-700/30 shadow-lg transition-all duration-300">
        <style>
          {`
            @font-face {
              font-family: 'Foda';
              src: url('/fonts/Foda.ttf') format('truetype');
              font-weight: normal;
              font-style: normal;
              font-display: swap;
            }
            
            .font-foda {
              font-family: 'Foda', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }

            .logo-container {
              position: relative;
              overflow: hidden;
              z-index: 1;
            }

            .logo-background {
              position: absolute;
              inset: -50%;
              background: radial-gradient(circle at center, 
                rgba(59, 130, 246, 0.1), 
                rgba(99, 102, 241, 0.1),
                rgba(139, 92, 246, 0.1)
              );
              filter: blur(20px);
              transform-origin: center;
              opacity: 0;
              transform: rotate(0deg) scale(0.95);
              transition: all 0.5s ease-out;
            }

            .logo-container:hover .logo-background {
              opacity: 1;
              transform: rotate(180deg) scale(1.1);
              animation: meshMove 10s linear infinite;
            }

            .logo-gradient {
              position: relative;
              background: linear-gradient(
                90deg,
                #3b82f6,
                #6366f1,
                #8b5cf6,
                #3b82f6
              );
              background-size: 300% 100%;
              transition: all 0.3s ease-out;
            }

            .logo-container:hover .logo-gradient {
              animation: gradientMove 4s linear infinite;
            }

            .logo-border {
              border-color: rgba(59, 130, 246, 0.2);
              transition: all 0.3s ease-out;
            }

            .logo-container:hover .logo-border {
              border-color: rgba(99, 102, 241, 0.4);
              animation: borderGlow 2s ease-in-out infinite;
            }

            .logo-shine {
              position: absolute;
              inset: 0;
              background: linear-gradient(
                90deg,
                transparent,
                rgba(255, 255, 255, 0.8),
                transparent
              );
              background-size: 200% auto;
              opacity: 0;
              transition: opacity 0.3s ease-out;
            }

            .logo-container:hover .logo-shine {
              opacity: 1;
              animation: shine 2s linear infinite;
            }

            .logo-text {
              transform-origin: center;
              transition: all 0.3s ease-out;
            }

            .logo-container:hover .logo-text {
              animation: float 2s ease-in-out infinite;
            }
            
            ${breatheAnimation}
          `}
        </style>
        <div className="max-w-full mx-auto px-4">
          <div className="flex justify-between h-16">
            {/* Logo and Mobile menu button */}
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0 flex items-center">
                <div 
                  onClick={() => navigate('/')}
                  className="logo-container relative px-6 py-1.5 rounded-xl border-2 logo-border bg-white/10 dark:bg-gray-800/10 backdrop-blur-md hover:scale-105 transition-all duration-300 cursor-pointer"
                >
                  <div className="logo-background"></div>
                  <div className="relative z-10">
                    <div className="logo-gradient p-0.5 rounded-lg">
                      <div className="px-4 py-1 bg-white/95 dark:bg-gray-800/95 rounded-lg backdrop-blur-sm">
                        <div className="relative overflow-hidden">
                          <div className="logo-shine"></div>
                          <h1 className="logo-text relative text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 transition-all duration-300 font-foda tracking-wider">
                    SPLIQOUR
                  </h1>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden inline-flex items-center justify-center p-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 focus:outline-none transition-all duration-200 hover:scale-110"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>

            {/* Bar Selector */}
            <div className="hidden md:flex items-center">
              <div className="relative group">
                <button
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-white/80 via-white/90 to-white/80 dark:from-gray-700/80 dark:via-gray-700/90 dark:to-gray-700/80 hover:from-white hover:to-white dark:hover:from-gray-700 dark:hover:to-gray-700 border border-gray-200/30 dark:border-gray-600/30 shadow-sm transition-all duration-300 hover:scale-105 group"
                >
                  <Store className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:animate-bounce" />
                  <span className="text-sm font-medium bg-gradient-to-r from-gray-700 to-gray-900 dark:from-gray-200 dark:to-white bg-clip-text text-transparent">
                    {selectedBar?.bar_name || 'Select Bar'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:rotate-180 transition-transform duration-300" />
                </button>
                <div className="absolute right-0 mt-2 w-64 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/30 dark:border-gray-700/30 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform origin-top-right scale-95 group-hover:scale-100">
                  <div className="py-1">
                    {bars?.map((bar) => (
                      <button
                        key={bar.id}
                        onClick={() => {
                          setSelectedBar(bar);
                          // Save to localStorage immediately
                          localStorage.setItem('selectedBarId', bar.id.toString());
                          toast.success(`Switched to ${bar.bar_name}`, {
                            duration: 2000,
                            position: 'top-right',
                            style: {
                              background: '#10B981',
                              color: 'white',
                              borderRadius: '12px',
                              padding: '12px 16px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                            },
                            iconTheme: {
                              primary: 'white',
                              secondary: '#10B981',
                            },
                          });
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm flex items-center space-x-2 transition-all duration-200 hover:scale-105 rounded-lg
                          ${selectedBar?.id === bar.id
                            ? 'bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-600 dark:text-blue-400 font-medium'
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-gray-700/80'
                          }`}
                      >
                        <Store className={`w-4 h-4 ${selectedBar?.id === bar.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
                        <span>{bar.bar_name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {/* Sliding Indicator */}
              <div
                className="absolute bottom-0 h-0.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 transition-all duration-300"
                style={{
                  left: `${indicatorStyle.left}px`,
                  width: `${indicatorStyle.width}px`,
                  opacity: indicatorStyle.opacity
                }}
              />

              {menuItems.map((item) => (
                <div key={item.path} className="relative group z-10">
                  <button
                    ref={(el) => menuItemsRef.current[item.name.replace(/\s+/g, '-').toLowerCase()] = el}
                    onClick={() => handleMenuClick(item)}
                    onMouseEnter={() => item.subMenu && setActiveMenu(item.name)}
                    onMouseLeave={() => item.subMenu && setActiveMenu('')}
                    className={`relative px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-2 transition-all duration-300 ease-in-out hover:scale-105 uppercase tracking-wider
                      ${(activeMenu === item.name || (item.subMenu?.some(subItem => subItem.path === location.pathname)))
                        ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg animate-menuBounce' 
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gradient-to-r hover:from-blue-500/10 hover:via-indigo-500/10 hover:to-purple-500/10 dark:hover:from-blue-400/10 dark:hover:via-indigo-400/10 dark:hover:to-purple-400/10 hover:text-blue-600 dark:hover:text-blue-400'}
                    `}
                  >
                    {item.icon && (
                      <span className={`transition-all duration-300 transform 
                        ${(activeMenu === item.name || (item.subMenu?.some(subItem => subItem.path === location.pathname)))
                          ? 'scale-110 text-white' 
                          : 'group-hover:scale-110 group-hover:text-blue-500 dark:group-hover:text-blue-300'}`
                      }>
                        {IconComponent(item.icon)}
                      </span>
                    )}
                    <span className={`font-medium transition-all duration-300 
                      ${(activeMenu === item.name || (item.subMenu?.some(subItem => subItem.path === location.pathname)))
                        ? 'animate-menuPulse' 
                        : 'group-hover:tracking-wide'}`
                    }>{item.name}</span>
                    {item.subMenu && (
                      <ChevronDown 
                        className={`w-4 h-4 transition-transform duration-300 
                          ${(activeMenu === item.name || (item.subMenu?.some(subItem => subItem.path === location.pathname)))
                            ? 'rotate-180 text-white' 
                            : 'text-gray-500 dark:text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-300'}`}
                      />
                    )}
                  </button>

                  {/* Desktop Dropdown */}
                  {item.subMenu && (
                    <div 
                      onMouseEnter={() => setActiveMenu(item.name)}
                      onMouseLeave={() => setActiveMenu('')}
                      className={`absolute left-0 mt-1 w-48 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-xl shadow-xl border border-gray-100/50 dark:border-gray-700/50 
                        ${activeMenu === item.name 
                          ? 'opacity-100 visible animate-menuSlideIn' 
                          : 'opacity-0 invisible animate-menuSlideOut'} 
                        transition-all duration-300 ease-out transform origin-top-left`}
                    >
                      <div className="py-1">
                        {item.subMenu?.map((subItem, index) => (
                          <div key={subItem.path} className={`${activeMenu === item.name ? 'animate-menuFadeIn' : 'animate-menuFadeOut'}`}>
                            <button
                              onClick={() => handleSubMenuClick(subItem.path)}
                              className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-all duration-200 hover:scale-[1.02] uppercase tracking-wider group
                                ${location.pathname === subItem.path
                                  ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-600 dark:text-blue-400 font-medium'
                                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                              <span className={`transition-all duration-200 ${
                                location.pathname === subItem.path
                                  ? 'font-medium'
                                  : 'group-hover:font-medium'
                              }`}>
                                {subItem.name}
                              </span>
                              {subItem.badge && (
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full transition-all duration-200
                                  ${location.pathname === subItem.path
                                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                                    : 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-600 group-hover:text-gray-700 dark:group-hover:text-gray-200'
                                  }`}
                                >
                                  {subItem.badge}
                                </span>
                              )}
                            </button>
                            {index < (item.subMenu?.length ?? 0) - 1 && (
                              <div className="mx-4 border-t border-gray-100/50 dark:border-gray-700/50"></div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Theme Toggle and Sign Out */}
              <div className="flex items-center space-x-2 ml-4 border-l border-gray-200/30 dark:border-gray-700/30 pl-4">
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-full text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-all duration-200 hover:scale-110"
                >
                  {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>

                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-full text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-all duration-200 hover:scale-110"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200/30 dark:border-gray-700/30">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Menu</h2>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-full text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-700/50"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {menuItems.map((item) => (
                <div key={item.path} className="mb-2">
                  <button
                    onClick={() => handleMenuClick(item)}
                    onMouseEnter={() => item.subMenu && setActiveMenu(item.name)}
                    onMouseLeave={() => item.subMenu && setActiveMenu('')}
                    className={`w-full px-4 py-2.5 rounded-full text-left flex items-center space-x-2 transition-all duration-200 uppercase tracking-wider
                      ${(activeMenu === item.name || (item.subMenu?.some(subItem => subItem.path === location.pathname)))
                        ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg animate-menuBounce'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gradient-to-r hover:from-blue-500/10 hover:via-indigo-500/10 hover:to-purple-500/10 dark:hover:from-blue-400/10 dark:hover:via-indigo-400/10 dark:hover:to-purple-400/10 hover:text-blue-600 dark:hover:text-blue-400'
                      }`}
                  >
                    {item.icon && (
                      <span className={`transition-all duration-300 transform
                        ${(activeMenu === item.name || (item.subMenu?.some(subItem => subItem.path === location.pathname)))
                          ? 'text-white' 
                          : 'group-hover:text-blue-500 dark:group-hover:text-blue-300'}`
                      }>
                        {IconComponent(item.icon)}
                      </span>
                    )}
                    <span className={(activeMenu === item.name || (item.subMenu?.some(subItem => subItem.path === location.pathname)))
                      ? 'animate-menuPulse' 
                      : 'group-hover:tracking-wide'}>
                      {item.name}
                    </span>
                  </button>
                  {item.subMenu && activeMenu === item.name && (
                    <div 
                      onMouseEnter={() => setActiveMenu(item.name)}
                      onMouseLeave={() => setActiveMenu('')}
                      className="ml-4 mt-2 space-y-1"
                    >
                      {item.subMenu?.map((subItem, index) => (
                        <div key={subItem.path} className={`${activeMenu === item.name ? 'animate-menuFadeIn' : 'animate-menuFadeOut'}`}>
                          <button
                            onClick={() => handleSubMenuClick(subItem.path)}
                            className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-all duration-200 hover:scale-[1.02] uppercase tracking-wider group
                              ${location.pathname === subItem.path
                                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-600 dark:text-blue-400 font-medium'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
                              }`}
                          >
                            <span className={`transition-all duration-200 ${
                              location.pathname === subItem.path
                                ? 'font-medium'
                                : 'group-hover:font-medium'
                            }`}>
                              {subItem.name}
                            </span>
                            {subItem.badge && (
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full transition-all duration-200
                                ${location.pathname === subItem.path
                                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                                  : 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-600 group-hover:text-gray-700 dark:group-hover:text-gray-200'
                                }`}
                              >
                                {subItem.badge}
                              </span>
                            )}
                          </button>
                          {index < (item.subMenu?.length ?? 0) - 1 && (
                            <div className="mx-4 border-t border-gray-100/50 dark:border-gray-700/50"></div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-200/30 dark:border-gray-700/30">
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-2.5 rounded-lg text-left flex items-center space-x-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-all duration-200"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}