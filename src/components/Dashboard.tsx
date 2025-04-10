import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Wallet, TrendingUp, Package, Users, ArrowUp, ArrowDown, Calendar, Clock, Plus, Receipt, FileText, Printer, Settings, ChevronRight, ShoppingCart, BarChart3, Store, Command, UserPlus } from 'lucide-react';
import { useBar } from '../context/BarContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';

const salesData = [
  { name: 'Mon', sales: 4000 },
  { name: 'Tue', sales: 3000 },
  { name: 'Wed', sales: 5000 },
  { name: 'Thu', sales: 2780 },
  { name: 'Fri', sales: 6890 },
  { name: 'Sat', sales: 8390 },
  { name: 'Sun', sales: 7490 },
];

const inventoryData = [
  { name: 'Whiskey', stock: 124, color: '#3B82F6' },
  { name: 'Vodka', stock: 85, color: '#8B5CF6' },
  { name: 'Rum', stock: 65, color: '#EC4899' },
  { name: 'Beer', stock: 250, color: '#F59E0B' },
  { name: 'Wine', stock: 45, color: '#10B981' },
];

const pieData = [
  { name: 'Whiskey', value: 35, color: '#3B82F6' },
  { name: 'Vodka', value: 25, color: '#8B5CF6' },
  { name: 'Rum', value: 15, color: '#EC4899' },
  { name: 'Beer', value: 15, color: '#F59E0B' },
  { name: 'Wine', value: 10, color: '#10B981' },
];

const StatCard = ({ title, value, change, icon: Icon, trend, delay }: { 
  title: string; 
  value: string; 
  change: string;
  icon: React.ElementType;
  trend: 'up' | 'down';
  delay: number;
}) => (
  <div 
    className="group relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-500 transform hover:-translate-y-1 border border-gray-100/50 dark:border-gray-700/50 animate-fade-in overflow-hidden"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-300"
         style={{ 
           background: `linear-gradient(135deg, ${trend === 'up' ? '#10B981' : '#EF4444'}20, ${trend === 'up' ? '#10B981' : '#EF4444'}40)` 
         }} 
    />
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 rounded-xl transform transition-transform duration-300 group-hover:scale-110"
             style={{ backgroundColor: `${trend === 'up' ? '#10B981' : '#EF4444'}20` }}>
          <Icon className="w-6 h-6" style={{ color: trend === 'up' ? '#10B981' : '#EF4444' }} />
        </div>
        <span className={`flex items-center text-sm font-medium px-3 py-1 rounded-full transition-all duration-300 ${
          trend === 'up' 
            ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' 
            : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
        }`}>
          {trend === 'up' ? <ArrowUp className="w-3.5 h-3.5 mr-1" /> : <ArrowDown className="w-3.5 h-3.5 mr-1" />}
          {change}
        </span>
      </div>
      <h3 className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-1">{title}</h3>
      <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
    </div>
    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
  </div>
);

const CustomTooltip = ({ active, payload, label, dark }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={`p-3 rounded-lg shadow-lg ${dark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} border ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          {`${payload[0].dataKey}: ${payload[0].value}`}
        </p>
      </div>
    );
  }
  return null;
};

// Fix for window.__theme property
declare global {
  interface Window {
    __theme?: { theme: string };
  }
}

const FloatingActionButton = ({ isDark }: { isDark: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const shortcuts = [
    // Sales Section
    { 
      section: 'Sales',
      items: [
        { icon: Receipt, label: 'New TP Entry', path: '/tp-entry/enter', color: '#3B82F6' },
        { icon: FileText, label: 'Daily Sales', path: '/sales/daily', color: '#8B5CF6' },
        { icon: ShoppingCart, label: 'Generate Bill', path: '/sales/generate-bill', color: '#EC4899' },
      ]
    },
    // Reports Section
    {
      section: 'Reports',
      items: [
        { icon: FileText, label: 'Brandwise Report', path: '/reports/brandwise', color: '#10B981' },
        { icon: BarChart3, label: 'Monthly Report', path: '/reports/monthly', color: '#F59E0B' },
        { icon: Package, label: 'Stock Report', path: '/reports/stock', color: '#6366F1' },
      ]
    },
    // Settings Section
    {
      section: 'Settings',
      items: [
        { icon: Store, label: 'Bar Manager', path: '/settings/bar', color: '#EF4444' },
        { icon: Package, label: 'Brand Manager', path: '/settings/brand', color: '#14B8A6' },
        { icon: Command, label: 'Brand Shortcuts', path: '/settings/shortcut', color: '#8B5CF6' },
      ]
    }
  ];

  return (
    <div className="fixed bottom-8 right-8 z-50">
      {/* Shortcut Menu */}
      <div 
        className={`absolute bottom-16 right-0 mb-4 transform transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-2 w-64">
          {shortcuts.map((section, sectionIndex) => (
            <div key={section.section} className="mb-2 last:mb-0">
              <div className="px-3 py-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {section.section}
                </span>
              </div>
              <div className="space-y-1">
                {section.items.map((shortcut, index) => (
                  <button
                    key={shortcut.label}
                    onClick={() => {
                      navigate(shortcut.path);
                      setIsOpen(false);
                    }}
                    className="flex items-center w-full px-3 py-2 text-left rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200 group"
                    style={{ animationDelay: `${(sectionIndex * section.items.length + index) * 100}ms` }}
                  >
                    <div 
                      className="p-2 rounded-lg mr-3 transition-transform duration-200 group-hover:scale-110"
                      style={{ backgroundColor: `${shortcut.color}20` }}
                    >
                      <shortcut.icon className="w-5 h-5" style={{ color: shortcut.color }} />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{shortcut.label}</span>
                    <ChevronRight className="w-4 h-4 ml-auto text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 transform hover:scale-110 ${
          isOpen 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        <Plus className={`w-6 h-6 text-white transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`} />
      </button>

      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .animate-slide-in {
            animation: slideIn 0.3s ease-out forwards;
          }
        `}
      </style>
    </div>
  );
};

const ModernClock = () => {
  const [time, setTime] = useState(new Date());
  const { theme: contextTheme } = useTheme();
  const isDark = contextTheme === 'dark';

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="flex items-center space-x-2 backdrop-blur-sm bg-white/5 dark:bg-gray-800/5 rounded-xl p-4 shadow-lg border border-white/10 dark:border-gray-700/30">
      <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      <span className="text-2xl font-bold text-gray-900 dark:text-white font-mono tracking-wider">
        {formatTime(time)}
      </span>
    </div>
  );
};

const FloatingNav = ({ shortcuts, navigate }: { shortcuts: any[], navigate: any }) => (
  <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-full shadow-2xl border border-gray-100 dark:border-gray-700 px-6 py-3">
      <div className="flex items-center space-x-6">
        {shortcuts.map((shortcut, index) => (
          <button
            key={shortcut.title}
            onClick={() => navigate(shortcut.path)}
            className="group relative flex items-center space-x-3 px-4 py-2 rounded-full transition-all duration-300 hover:bg-white/50 dark:hover:bg-gray-700/50"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="relative">
              <div className="p-2 rounded-full transform transition-transform duration-300 group-hover:scale-110"
                   style={{ backgroundColor: `${shortcut.color}20` }}>
                <shortcut.icon className="w-5 h-5" style={{ color: shortcut.color }} />
              </div>
              <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse"
                   style={{ backgroundColor: shortcut.color }} />
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white whitespace-nowrap">
              {shortcut.title}
            </span>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r opacity-0 group-hover:opacity-10 transition-opacity duration-300"
                 style={{ 
                   background: `linear-gradient(90deg, ${shortcut.color}20, ${shortcut.color}40)` 
                 }} 
            />
          </button>
        ))}
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const { theme: contextTheme } = useTheme();
  const isDark = contextTheme === 'dark';
  const { selectedBar } = useBar();
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      setIsVisible(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const getDate = () => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date().toLocaleDateString(undefined, options);
  };

  const handleManageBar = () => {
    navigate('/bars');
  };

  const shortcuts = [
    {
      title: 'Enter TP',
      icon: FileText,
      path: '/tp-entry/enter',
      color: '#3B82F6',
      description: 'Add new TP entries'
    },
    {
      title: 'Daily Sale',
      icon: ShoppingCart,
      path: '/sales/daily',
      color: '#8B5CF6',
      description: 'Record daily sales'
    },
    {
      title: 'Brandwise Report',
      icon: BarChart3,
      path: '/reports/brandwise',
      color: '#10B981',
      description: 'View brandwise reports'
    },
    {
      title: 'Add Party',
      icon: UserPlus,
      path: '/settings/party',
      color: '#F59E0B',
      description: 'Add new party'
    }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-blue-200 dark:border-blue-900"></div>
          <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin absolute top-0 left-0"></div>
        </div>
      </div>
    );
  }

  if (!selectedBar) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-cyan-400 to-blue-600 flex flex-col items-center justify-center p-4 relative overflow-hidden animate-gradient">
        <div className="text-center mb-12 transform hover:scale-105 transition-transform duration-500">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 tracking-wide animate-fade-in">
            SPSOFTWARE PRESENT'S
          </h1>
          <div className="text-6xl md:text-8xl font-bold text-gray-900 tracking-[0.2em] font-display animate-slide-up">
            Spliqour
          </div>
        </div>
        
        <button
          onClick={handleManageBar}
          className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 text-white text-xl font-bold py-4 px-12 rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-500 hover:scale-105 animate-bounce"
        >
          MANAGE YOUR BAR
        </button>

        <div className="absolute bottom-8 text-center text-gray-900 animate-fade-in">
          <p className="text-sm mb-1">all rights are reserved to spsoftware</p>
          <p className="font-bold text-lg">SAHIL PETKAR</p>
        </div>

        <style>
          {`
            .animate-gradient {
              background-size: 200% 200%;
              animation: gradient 15s ease infinite;
            }
            @keyframes gradient {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            .font-display {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            .animate-fade-in {
              animation: fadeIn 1s ease-out forwards;
            }
            .animate-slide-up {
              animation: slideUp 1s ease-out forwards;
            }
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { 
                opacity: 0;
                transform: translateY(20px);
              }
              to { 
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}
        </style>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl pb-32">
      {/* Welcome Header */}
      <div className={`mb-8 transform transition-all duration-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent uppercase tracking-wider">
              {selectedBar.bar_name} DASHBOARD
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1 flex items-center uppercase tracking-wide">
              <Calendar className="w-4 h-4 mr-2" />
              {getDate()}
            </p>
          </div>
          <div className="hidden md:flex items-center px-4 py-2 rounded-xl transform hover:scale-105 transition-all duration-300">
            <ModernClock />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="TOTAL REVENUE"
          value="₹84,254"
          change="12%"
          icon={Wallet}
          trend="up"
          delay={100}
        />
        <StatCard
          title="SALES GROWTH"
          value="23.5%"
          change="4%"
          icon={TrendingUp}
          trend="up"
          delay={200}
        />
        <StatCard
          title="TOTAL STOCK"
          value="1,245"
          change="8%"
          icon={Package}
          trend="down"
          delay={300}
        />
        <StatCard
          title="ACTIVE CUSTOMERS"
          value="156"
          change="2%"
          icon={Users}
          trend="up"
          delay={400}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 mb-8">
        {/* Weekly Sales Chart */}
        <div className="lg:col-span-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 transform hover:-translate-y-1 border border-gray-100/50 dark:border-gray-700/50">
          <h3 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-6 uppercase tracking-wide">Weekly Sales Overview</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={salesData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#E5E7EB"} strokeOpacity={0.2} />
                <XAxis dataKey="name" stroke={isDark ? "#9CA3AF" : "#6B7280"} />
                <YAxis stroke={isDark ? "#9CA3AF" : "#6B7280"} />
                <Tooltip content={<CustomTooltip dark={isDark} />} />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#salesGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales Distribution Chart */}
        <div className="lg:col-span-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 transform hover:-translate-y-1 border border-gray-100/50 dark:border-gray-700/50">
          <h3 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-6 uppercase tracking-wide">Sales Distribution</h3>
          <div className="h-80 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip dark={isDark} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        {/* Inventory Chart */}
        <div className="lg:col-span-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 transform hover:-translate-y-1 border border-gray-100/50 dark:border-gray-700/50">
          <h3 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-6 uppercase tracking-wide">Current Inventory</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={inventoryData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#E5E7EB"} strokeOpacity={0.2} />
                <XAxis dataKey="name" stroke={isDark ? "#9CA3AF" : "#6B7280"} />
                <YAxis stroke={isDark ? "#9CA3AF" : "#6B7280"} />
                <Tooltip content={<CustomTooltip dark={isDark} />} />
                <Bar dataKey="stock" radius={[6, 6, 0, 0]}>
                  {inventoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-lg p-6 border border-gray-100/50 dark:border-gray-700/50 transition-all duration-500 hover:shadow-xl transform hover:-translate-y-1">
          <h3 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-6 uppercase tracking-wide">Recent Activity</h3>
          <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
            {[
              { time: '2 hours ago', action: 'New TP Entry added by John', type: 'TP Entry', details: 'TP#2024-089', color: '#3B82F6' },
              { time: '4 hours ago', action: 'Daily sales updated', type: 'Sales', details: '₹12,450', color: '#8B5CF6' },
              { time: '6 hours ago', action: 'New stock received', type: 'Inventory', details: '24 cases', color: '#EC4899' },
              { time: '1 day ago', action: 'Monthly report generated', type: 'Report', details: 'March 2024', color: '#F59E0B' },
              { time: '2 days ago', action: 'New customer added', type: 'Customer', details: 'Hotel Grand', color: '#10B981' },
            ].map((activity, index) => (
              <div 
                key={index} 
                className="group relative bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 transition-all duration-300 hover:bg-white/80 dark:hover:bg-gray-800/80 hover:shadow-md"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-xl"
                     style={{ 
                       background: `linear-gradient(90deg, ${activity.color}20, ${activity.color}40)` 
                     }} 
                />
                <div className="relative z-10">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center transform transition-transform duration-300 group-hover:scale-110"
                           style={{ backgroundColor: `${activity.color}20` }}>
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: activity.color }} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {activity.action}
                        </p>
                        <span className="ml-2 px-3 py-1 text-xs font-medium rounded-full transition-all duration-300 hover:scale-105" 
                              style={{ 
                                backgroundColor: `${activity.color}20`,
                                color: activity.color
                              }}>
                          {activity.details}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {activity.time}
                        </span>
                        <span className="mx-2 text-gray-300 dark:text-gray-600">•</span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{ 
                                backgroundColor: `${activity.color}10`,
                                color: activity.color
                              }}>
                          {activity.type}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Navigation Bar */}
      <FloatingNav shortcuts={shortcuts} navigate={navigate} />

      {/* CSS for animations */}
      <style>
        {`
          @keyframes fadeIn {
            from { 
              opacity: 0;
              transform: translateY(10px);
            }
            to { 
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .animate-fade-in {
            animation: fadeIn 0.6s ease-out forwards;
          }
          
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
          }
          
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: rgba(155, 155, 155, 0.5);
            border-radius: 20px;
          }

          .animate-bounce {
            animation: bounce 2s infinite;
          }

          @keyframes bounce {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-10px);
            }
          }
        `}
      </style>
    </div>
  );
}