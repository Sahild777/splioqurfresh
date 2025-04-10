import React, { useState, useEffect } from 'react';
import { useBar } from '../../context/BarContext';
import { supabase } from '../../lib/supabase';
import { Loader2, FileText, Printer, Download, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, parse } from 'date-fns';
import { PDFViewer, Document, Page, View, Text, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer';

interface CategorySale {
  category: string;
  amount: number;
  vat: number;
  total: number;
}

interface VatData {
  date: string;
  totalSale: number;
  vat: number;
  total: number;
  categorySales: CategorySale[];
}

interface BrandData {
  mrp: number;
  category: string;
}

interface SaleData {
  sale_date: string;
  qty: number;
  brands: {
    mrp: number;
    category: string;
  };
}

// PDF styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF'
  },
  headerContainer: {
    marginBottom: 20,
  },
  header: {
    padding: 15,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderBottomWidth: 3,
    borderBottomColor: '#3b82f6',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#1e3a8a'
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 10,
    color: '#3b82f6'
  },
  reportInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5
  },
  reportInfoItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  reportInfoLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
    marginRight: 4
  },
  reportInfoValue: {
    fontSize: 10,
    color: '#334155'
  },
  section: {
    marginBottom: 15
  },
  sectionHeader: {
    backgroundColor: '#f1f5f9',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
    textAlign: 'left'
  },
  table: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableHeader: {
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    padding: 8,
    fontSize: 9,
    textAlign: 'right',
    color: '#334155'
  },
  tableCellHeader: {
    fontWeight: 'bold',
    color: '#0f172a',
    backgroundColor: '#e2e8f0',
  },
  totalRow: {
    backgroundColor: '#f1f5f9',
  },
  totalCell: {
    fontWeight: 'bold', 
    color: '#0f172a'
  },
  summaryBox: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'flex-end',
    width: '50%'
  },
  summaryHeader: {
    backgroundColor: '#3b82f6',
    padding: 8,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center'
  },
  summaryContent: {
    padding: 10,
    backgroundColor: '#f8fafc'
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#334155'
  },
  summaryValue: {
    fontSize: 10,
    color: '#334155'
  },
  footerText: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    fontSize: 8,
    textAlign: 'center',
    color: '#94a3b8'
  }
});

// PDF Document Component
const PDFDocument: React.FC<{ data: VatData[]; barName: string; vatRate: number; dateRange: string }> = ({ 
  data, 
  barName, 
  vatRate,
  dateRange 
}) => {
  // Calculate category totals across all dates
  const categoryTotals = data.reduce((acc: { [key: string]: CategorySale }, day) => {
    day.categorySales.forEach(catSale => {
      if (!acc[catSale.category]) {
        acc[catSale.category] = {
          category: catSale.category,
          amount: 0,
          vat: 0,
          total: 0
        };
      }
      acc[catSale.category].amount += catSale.amount;
      acc[catSale.category].vat += catSale.vat;
      acc[catSale.category].total += catSale.total;
    });
    return acc;
  }, {});

  // Grand totals
  const grandTotal = {
    amount: Object.values(categoryTotals).reduce((sum, cat) => sum + cat.amount, 0),
    vat: Object.values(categoryTotals).reduce((sum, cat) => sum + cat.vat, 0),
    total: Object.values(categoryTotals).reduce((sum, cat) => sum + cat.total, 0)
  };

  // Sort categories alphabetically
  const sortedCategories = Object.values(categoryTotals).sort((a, b) => 
    a.category.localeCompare(b.category)
  );

  return (
  <Document>
    <Page size="A4" style={styles.page}>
        {/* Header with gradient background */}
        <View style={styles.headerContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>{barName}</Text>
        <Text style={styles.subtitle}>VAT Report</Text>
            <View style={styles.reportInfoContainer}>
              <View style={styles.reportInfoItem}>
                <Text style={styles.reportInfoLabel}>Period:</Text>
                <Text style={styles.reportInfoValue}>{dateRange}</Text>
              </View>
              <View style={styles.reportInfoItem}>
                <Text style={styles.reportInfoLabel}>VAT Rate:</Text>
                <Text style={styles.reportInfoValue}>{vatRate}%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Category Summary Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Category-wise Summary</Text>
      </View>

      <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.tableCellHeader, { width: '30%' }]}>Category</Text>
              <Text style={[styles.tableCell, styles.tableCellHeader, { width: '23%' }]}>Sale Amount</Text>
              <Text style={[styles.tableCell, styles.tableCellHeader, { width: '23%' }]}>VAT ({vatRate}%)</Text>
              <Text style={[styles.tableCell, styles.tableCellHeader, { width: '24%' }]}>Total</Text>
            </View>
            
            {sortedCategories.map((cat, index) => (
              <View key={index} style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? '#f9fafb' : '#ffffff' }]}>
                <Text style={[styles.tableCell, { width: '30%' }]}>{cat.category}</Text>
                <Text style={[styles.tableCell, { width: '23%' }]}>₹{cat.amount.toFixed(2)}</Text>
                <Text style={[styles.tableCell, { width: '23%' }]}>₹{cat.vat.toFixed(2)}</Text>
                <Text style={[styles.tableCell, { width: '24%' }]}>₹{cat.total.toFixed(2)}</Text>
              </View>
            ))}
            
            <View style={[styles.tableRow, styles.totalRow]}>
              <Text style={[styles.tableCell, styles.totalCell, { width: '30%' }]}>Category Total</Text>
              <Text style={[styles.tableCell, styles.totalCell, { width: '23%' }]}>₹{grandTotal.amount.toFixed(2)}</Text>
              <Text style={[styles.tableCell, styles.totalCell, { width: '23%' }]}>₹{grandTotal.vat.toFixed(2)}</Text>
              <Text style={[styles.tableCell, styles.totalCell, { width: '24%' }]}>₹{grandTotal.total.toFixed(2)}</Text>
            </View>
          </View>
        </View>
        
        {/* Daily Summary Section */}
        <View style={[styles.section, { marginTop: 20 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Daily Summary</Text>
          </View>
          
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.tableCellHeader, { width: '30%' }]}>Date</Text>
              <Text style={[styles.tableCell, styles.tableCellHeader, { width: '23%' }]}>Sale Amount</Text>
              <Text style={[styles.tableCell, styles.tableCellHeader, { width: '23%' }]}>VAT ({vatRate}%)</Text>
              <Text style={[styles.tableCell, styles.tableCellHeader, { width: '24%' }]}>Total</Text>
      </View>

            {data.map((row, index) => (
              <View key={index} style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? '#f9fafb' : '#ffffff' }]}>
                <Text style={[styles.tableCell, { width: '30%' }]}>{row.date}</Text>
                <Text style={[styles.tableCell, { width: '23%' }]}>₹{row.totalSale.toFixed(2)}</Text>
                <Text style={[styles.tableCell, { width: '23%' }]}>₹{row.vat.toFixed(2)}</Text>
                <Text style={[styles.tableCell, { width: '24%' }]}>₹{row.total.toFixed(2)}</Text>
              </View>
            ))}
            
            <View style={[styles.tableRow, styles.totalRow]}>
              <Text style={[styles.tableCell, styles.totalCell, { width: '30%' }]}>Grand Total</Text>
              <Text style={[styles.tableCell, styles.totalCell, { width: '23%' }]}>₹{data.reduce((sum, row) => sum + row.totalSale, 0).toFixed(2)}</Text>
              <Text style={[styles.tableCell, styles.totalCell, { width: '23%' }]}>₹{data.reduce((sum, row) => sum + row.vat, 0).toFixed(2)}</Text>
              <Text style={[styles.tableCell, styles.totalCell, { width: '24%' }]}>₹{data.reduce((sum, row) => sum + row.total, 0).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Summary Box */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>VAT Summary</Text>
          </View>
          <View style={styles.summaryContent}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Sales:</Text>
              <Text style={styles.summaryValue}>₹{grandTotal.amount.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total VAT:</Text>
              <Text style={[styles.summaryValue, { color: '#047857' }]}>₹{grandTotal.vat.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Grand Total:</Text>
              <Text style={[styles.summaryValue, { fontWeight: 'bold' }]}>₹{grandTotal.total.toFixed(2)}</Text>
            </View>
        </View>
      </View>
        
        {/* Footer */}
        <Text style={styles.footerText}>
          Generated on {format(new Date(), 'dd/MM/yyyy HH:mm')} • SPLIQOUR VAT Report
        </Text>
    </Page>
  </Document>
);
};

export default function VatReport() {
  const { selectedBar } = useBar();
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [vatRate, setVatRate] = useState(10); // Default VAT rate
  const [vatData, setVatData] = useState<VatData[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // Handle month selection
  useEffect(() => {
    if (selectedMonth) {
      const date = parse(selectedMonth, 'yyyy-MM', new Date());
      setStartDate(format(startOfMonth(date), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(date), 'yyyy-MM-dd'));
    }
  }, [selectedMonth]);

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  const getDateRange = () => {
    if (!startDate || !endDate) return '';
    try {
      return `${formatDateString(startDate)} to ${formatDateString(endDate)}`;
    } catch (error) {
      console.error('Error getting date range:', error);
      return '';
    }
  };

  const fetchVatData = async () => {
    if (!selectedBar || !startDate || !endDate) {
      toast.error('Please select bar and date range');
      return;
    }

    try {
      setIsLoading(true);

      // Fetch daily sales data with brand details including category
      const { data: rawData, error } = await supabase
        .from('daily_sales')
        .select(`
          sale_date,
          qty,
          brands (
            mrp,
            category
          )
        `)
        .eq('bar_id', selectedBar.id)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .order('sale_date', { ascending: true });

      if (error) throw error;

      // Transform raw data to ensure correct types
      const data: SaleData[] = (rawData as any[] || []).map(item => ({
        sale_date: item.sale_date,
        qty: item.qty || 0,
        brands: {
          mrp: item.brands?.mrp || 0,
          category: item.brands?.category || 'Uncategorized'
        }
      }));

      // Group sales by date and category
      const salesByDate = data.reduce((acc: { [key: string]: { total: number; categories: { [key: string]: number } } }, sale) => {
        const date = sale.sale_date;
        const amount = sale.qty * sale.brands.mrp;
        const category = sale.brands.category;
        
        if (!acc[date]) {
          acc[date] = { total: 0, categories: {} };
        }
        if (!acc[date].categories[category]) {
          acc[date].categories[category] = 0;
        }
        
        acc[date].categories[category] += amount;
        acc[date].total += amount;
        return acc;
      }, {});

      // Transform data for display
      const processedData: VatData[] = Object.entries(salesByDate).map(([date, { total, categories }]) => {
        const totalSale = total;
        const vat = totalSale * (vatRate / 100);
        
        // Calculate category-wise VAT
        const categorySales: CategorySale[] = Object.entries(categories).map(([category, amount]) => ({
          category,
          amount,
          vat: amount * (vatRate / 100),
          total: amount + (amount * (vatRate / 100))
        }));

        return {
          date: formatDateString(date),
          totalSale,
          vat,
          total: totalSale + vat,
          categorySales
        };
      });

      setVatData(processedData);
      setShowPreview(true);
    } catch (error: any) {
      console.error('Error fetching VAT data:', error);
      toast.error('Failed to fetch VAT data');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    if (!vatData.length) {
      toast.error('No data to print');
      return;
    }
    window.print();
  };

  if (!selectedBar) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500 dark:text-gray-400">Please select a bar first</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">VAT Report</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Generate VAT reports for {selectedBar.bar_name}
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        {/* Date Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Month Selection
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* VAT Rate Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            VAT Rate (%)
          </label>
          <input
            type="number"
            value={vatRate}
            onChange={(e) => setVatRate(Number(e.target.value))}
            min="0"
            max="100"
            step="0.1"
            className="w-full md:w-1/3 px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-6">
          <button
            onClick={fetchVatData}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Eye className="w-5 h-5" />
                <span>Preview Report</span>
              </>
            )}
          </button>
          {vatData.length > 0 && (
            <>
              <PDFDownloadLink
                document={<PDFDocument data={vatData} barName={selectedBar.bar_name} vatRate={vatRate} dateRange={getDateRange()} />}
                fileName={`vat-report-${startDate}-to-${endDate}.pdf`}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-5 h-5" />
                <span>Download PDF</span>
              </PDFDownloadLink>
              <button
                onClick={handlePrint}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Printer className="w-5 h-5" />
                <span>Print Report</span>
              </button>
            </>
          )}
        </div>

        {/* PDF Preview */}
        {showPreview && vatData.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Report Preview</h2>
            <div className="h-[800px] w-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <PDFViewer width="100%" height="100%">
                <PDFDocument 
                  data={vatData} 
                  barName={selectedBar.bar_name}
                  vatRate={vatRate}
                  dateRange={getDateRange()}
                />
              </PDFViewer>
            </div>
          </div>
        )}

        {/* No Data Message */}
        {showPreview && vatData.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No data found for the selected date range</p>
          </div>
        )}
      </div>
    </div>
  );
} 