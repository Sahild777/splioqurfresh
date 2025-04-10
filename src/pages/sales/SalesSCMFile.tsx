import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { format, parseISO, subDays } from 'date-fns';
import { useBar } from '../../context/BarContext';
import { Calendar, Download, FileSpreadsheet, Loader2, RefreshCw, Search, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

type SaleExportResponse = {
  qty: number;
  brands: {
    brand_name: string;
    item_code: string;
    sizes: string;
    mrp: number;
  };
};

export default function SalesSCMFile() {
  const { selectedBar } = useBar();
  const [fromDate, setFromDate] = useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd')); // Last 7 days
  const [toDate, setToDate] = useState<string>(format(new Date(), 'yyyy-MM-dd')); // Today
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingDates, setFetchingDates] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [exportedDates, setExportedDates] = useState<Set<string>>(new Set());

  // Filter dates based on search query
  const filteredDates = searchQuery.trim() === '' 
    ? availableDates 
    : availableDates.filter(date => 
        format(new Date(date), 'dd/MM/yyyy EEEE').toLowerCase().includes(searchQuery.toLowerCase())
      );

  useEffect(() => {
    if (selectedBar) {
      fetchAvailableDates();
    }
  }, [selectedBar, fromDate, toDate]);

  const fetchAvailableDates = async () => {
    try {
      setFetchingDates(true);
      
      // Fetch all distinct sale dates within date range
      const { data, error } = await supabase
        .from('daily_sales')
        .select('sale_date')
        .eq('bar_id', selectedBar?.id)
        .gte('sale_date', fromDate)
        .lte('sale_date', toDate)
        .order('sale_date', { ascending: false });

      if (error) throw error;

      // Extract unique dates
      const uniqueDates = Array.from(new Set(data.map(item => item.sale_date)));
      setAvailableDates(uniqueDates);
    } catch (error: any) {
      console.error('Error fetching available dates:', error);
      toast.error('Failed to fetch available dates');
    } finally {
      setFetchingDates(false);
    }
  };

  const handleExportToExcel = async (saleDate: string) => {
    try {
      setLoading(true);
      toast.loading(`Generating Excel for ${format(new Date(saleDate), 'dd/MM/yyyy')}...`);
      
      // Fetch detailed sales data for the date
      const { data: salesData, error } = await supabase
        .from('daily_sales')
        .select(`
          qty,
          brands (
            brand_name,
            item_code,
            sizes
          )
        `)
        .eq('bar_id', selectedBar?.id)
        .eq('sale_date', saleDate);

      if (error) throw error;

      // Transform data for Excel with proper typing
      const typedSalesData = salesData as unknown as SaleExportResponse[];
      const excelData = typedSalesData.map(sale => ({
        'Date': format(new Date(saleDate), 'MM/dd/yyyy'),
        'Item Code': sale.brands?.item_code || '',
        'Item Name': sale.brands?.brand_name || '',
        'Sizes': sale.brands?.sizes || '',
        'Qty Case': 0,
        'Qty Bottle': sale.qty || 0
      }));

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sales Data');

      // Generate Excel file
      XLSX.writeFile(wb, `sales_${format(new Date(saleDate), 'MM-dd-yyyy')}.xlsx`);

      toast.dismiss();
      toast.success('Excel file generated successfully');
      
      // Add to exported dates
      setExportedDates(prev => new Set([...prev, saleDate]));
    } catch (error: any) {
      toast.dismiss();
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to generate Excel file');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-2 rounded-lg">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales SCM File</h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Generate and export date-wise sales data for SCM reporting
            </p>
          </div>
          <button
            onClick={fetchAvailableDates}
            disabled={fetchingDates}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-lg hover:from-blue-600 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200 mt-2 md:mt-0 shadow-md hover:shadow-lg"
          >
            <RefreshCw className={`w-4 h-4 ${fetchingDates ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl mb-5">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal className="w-4 h-4 text-blue-500" />
            <h3 className="font-medium text-gray-700 dark:text-gray-300">Date Range</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                From Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all duration-200"
                />
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                To Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all duration-200"
                />
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search for a date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all duration-200"
          />
        </div>
      </div>

      {/* Available Dates List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Available Dates</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Found {filteredDates.length} date{filteredDates.length !== 1 ? 's' : ''} within selected range
              </p>
            </div>
            {!fetchingDates && availableDates.length > 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center">
                  <span className="w-3 h-3 rounded-full bg-green-400 mr-1"></span>
                  Exported: {exportedDates.size}
                </span>
              </div>
            )}
          </div>
        </div>

        {fetchingDates ? (
          <div className="p-12 flex justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
              <span className="text-gray-600 dark:text-gray-300 font-medium">Loading available dates...</span>
            </div>
          </div>
        ) : filteredDates.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No sales data found</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              {searchQuery.trim() !== '' 
                ? 'Try adjusting your search query or date range to find more results.'
                : 'No sales data available for the selected date range. Try selecting a different time period.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
            {filteredDates.map((date) => {
              const isExported = exportedDates.has(date);
              return (
                <div 
                  key={date} 
                  className={`relative bg-gray-50 dark:bg-gray-700 rounded-xl p-5 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-650 transition-all duration-200 border border-gray-200 dark:border-gray-600 ${isExported ? 'ring-2 ring-green-400 ring-opacity-50' : ''}`}
                >
                  {isExported && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-blue-900 dark:to-indigo-900 flex items-center justify-center shadow-sm">
                      <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white text-lg">{formatDate(date)}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{format(new Date(date), 'EEEE')}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleExportToExcel(date)}
                    disabled={loading}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200 shadow-sm ${
                      isExported 
                        ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 focus:ring-green-500 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/50' 
                        : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 focus:ring-green-500'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span className="hidden md:inline">{isExported ? 'Re-export' : 'Export'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
        
        {filteredDates.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 border-t border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400">
            Tip: The exports contain item-wise sales data formatted for SCM compliance
          </div>
        )}
      </div>
    </div>
  );
} 