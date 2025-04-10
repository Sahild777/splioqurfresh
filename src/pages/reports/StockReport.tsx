import { useState, useEffect } from 'react';
import { useBar } from '../../context/BarContext';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { 
  FileText, 
  Download, 
  Printer, 
  Eye, 
  Calendar,
  Package,
  Loader2,
  X
} from 'lucide-react';
import { PDFViewer, PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Types
type StockReport = {
  brand_name: string;
  item_code: string;
  sizes: string;
  category: string;
  closing_qty: number;
};

type Brand = {
  id: number;
  brand_name: string;
  item_code: string;
  sizes: string;
  category: string;
};

type SupabaseInventoryResponse = {
  brand_id: number;
  opening_qty: number;
  brands: Brand[];
}

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 10,
    textAlign: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 10,
    marginBottom: 2,
  },
  table: {
    display: 'flex',
    width: 'auto',
    marginTop: 5,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#000000',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    minHeight: 14,
  },
  tableHeader: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  tableHeaderText: {
    fontWeight: 'bold',
  },
  tableCell: {
    padding: 2,
    fontSize: 7,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  brandNameCell: {
    width: '30%',
    padding: 2,
    fontSize: 7,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  categoryCell: {
    width: '20%',
    padding: 2,
    fontSize: 7,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  sizeCell: {
    width: '15%',
    padding: 2,
    fontSize: 7,
    borderRightWidth: 1,
    borderRightColor: '#000000',
    textAlign: 'center',
  },
  qtyCell: {
    width: '15%',
    padding: 2,
    fontSize: 7,
    borderRightWidth: 1,
    borderRightColor: '#000000',
    textAlign: 'right',
  },
  sectionTitle: {
    backgroundColor: '#ffffff',
    padding: 3,
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#000000',
  }
});

// PDF Document Component
const PDFDocument = ({ barName, date, reportData }: { barName: string, date: string, reportData: StockReport[] }) => {
  // Ensure reportData is always an array
  const safeReportData = Array.isArray(reportData) ? reportData : [];
  
  // Group data by category
  const groupedData = safeReportData.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as { [key: string]: StockReport[] });

  // Sort categories
  const categories = Object.keys(groupedData).sort();

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{barName || 'Stock Report'}</Text>
          <Text style={styles.subtitle}>Stock Report</Text>
          <Text style={styles.subtitle}>Date: {format(new Date(date), 'dd/MM/yyyy')}</Text>
        </View>

        {safeReportData.length === 0 ? (
          <View style={{ marginTop: 20, padding: 10 }}>
            <Text style={{ fontSize: 12, textAlign: 'center' }}>No stock data available for this date.</Text>
          </View>
        ) : (
          categories.map((category) => (
            <View key={category} wrap={false}>
              <Text style={styles.sectionTitle}>{category}</Text>
              <View style={styles.table}>
                {/* Header Row */}
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.brandNameCell, styles.tableHeaderText]}>Brand Name</Text>
                  <Text style={[styles.sizeCell, styles.tableHeaderText]}>Size</Text>
                  <Text style={[styles.qtyCell, styles.tableHeaderText]}>Closing Stock</Text>
                </View>

                {/* Data Rows */}
                {groupedData[category]
                  .sort((a, b) => a.brand_name.localeCompare(b.brand_name))
                  .map((item, index) => (
                    <View key={`${category}-${index}`} style={styles.tableRow}>
                      <Text style={styles.brandNameCell}>{item.brand_name}</Text>
                      <Text style={styles.sizeCell}>{item.sizes}</Text>
                      <Text style={styles.qtyCell}>{item.closing_qty}</Text>
                    </View>
                  ))}
              </View>
            </View>
          ))
        )}
      </Page>
    </Document>
  );
};

export default function StockReport() {
  const { selectedBar } = useBar();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportData, setReportData] = useState<StockReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (selectedBar && date) {
      fetchReportData();
    }
  }, [selectedBar, date]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      // Fetch brands with their closing stock
      const { data, error: stockError } = await supabase
        .from('inventory')
        .select(`
          brand_id,
          opening_qty,
          brands (
            id,
            brand_name,
            item_code,
            sizes,
            category
          )
        `)
        .eq('bar_id', selectedBar?.id)
        .eq('date', date);

      if (stockError) {
        console.error('Stock error:', stockError);
        throw stockError;
      }

      console.log('Raw response:', data); // Debug log

      const stockData = data as unknown as SupabaseInventoryResponse[];

      if (!stockData?.length) {
        setReportData([]);
        return;
      }

      // Process and combine the data
      const processedData: StockReport[] = stockData
        .filter(item => item.opening_qty > 0 && item.brands?.[0])
        .map((item) => ({
          brand_name: item.brands[0].brand_name,
          item_code: item.brands[0].item_code,
          sizes: item.brands[0].sizes,
          category: item.brands[0].category,
          closing_qty: item.opening_qty
        }));

      // Sort by category and brand name
      processedData.sort((a, b) => {
        if (a.category === b.category) {
          return a.brand_name.localeCompare(b.brand_name);
        }
        return a.category.localeCompare(b.category);
      });

      setReportData(processedData);
      toast.success('Report data fetched successfully');
    } catch (error: any) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to fetch report data: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Stock Report</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View current stock levels for all brands
            </p>
      </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {selectedBar?.bar_name}
            </span>
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
          </div>
        </div>
            </div>

      {/* Controls Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        {/* Date Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Date
              </label>
          <div className="relative">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
            <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>

        {/* Preview Button */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
          <button
            onClick={() => setShowPreview(true)}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200"
          >
            <Eye className="w-5 h-5" />
            {loading ? 'Loading...' : 'Preview Report'}
          </button>
        </div>

        {/* Download Button */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
          <PDFDownloadLink
            document={<PDFDocument barName={selectedBar?.bar_name || ''} date={date} reportData={reportData} />}
            fileName={`stock-report-${date}.pdf`}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200"
          >
            {({ loading }) => (
              <>
                <Download className="w-5 h-5" />
                {loading ? 'Generating PDF...' : 'Download PDF'}
              </>
            )}
          </PDFDownloadLink>
        </div>

        {/* Print Button */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
          <button
            onClick={() => {
              setShowPreview(true);
              setTimeout(() => window.print(), 500);
            }}
            disabled={loading || reportData.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200"
          >
            <Printer className="w-5 h-5" />
            {loading ? 'Processing...' : 'Print Report'}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-gray-700 dark:text-gray-300">Loading report data...</span>
          </div>
        </div>
      )}

      {/* Data Summary */}
      {!loading && reportData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Brands</span>
            <Package className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {reportData.length}
          </p>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-6xl h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Preview Report</h2>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="h-[calc(90vh-4rem)]">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : (
                <PDFViewer width="100%" height="100%" className="border-0">
                  <PDFDocument 
                    barName={selectedBar?.bar_name || ''} 
                    date={date} 
                    reportData={reportData || []} 
                  />
                </PDFViewer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 