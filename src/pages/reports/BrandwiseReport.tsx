import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { useBar } from '../../context/BarContext';
import { toast } from 'react-hot-toast';
import { 
  FileText, 
  Download, 
  Printer, 
  Eye, 
  Calendar, 
  Package, 
  TrendingUp, 
  Truck, 
  X,
  Loader2,
  Tags
} from 'lucide-react';
import { PDFViewer, PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

type BrandReport = {
  brand_name: string;
  item_code: string;
  sizes: string;
  opening: {
    [key: string]: number; // size as key, quantity as value
  };
  received: {
    [key: string]: number;
  };
  sales: {
    [key: string]: number;
  };
  closing: {
    [key: string]: number;
  };
  category: string;
  tp_numbers: string[];
};

// Add new helper type and functions
type SizeQuantities = {
  [size: string]: number;
};

// Helper function to check if a brand has any non-zero quantities
const hasNonZeroQuantities = (brand: {
  quantities: {
    opening: SizeQuantities;
    received: SizeQuantities;
    sales: SizeQuantities;
    closing: SizeQuantities;
  };
}) => {
  return Object.values(brand.quantities).some(qtyObj =>
    Object.values(qtyObj).some(qty => qty > 0)
  );
};

// Helper function to get active sizes from data
const getActiveSizes = (data: Array<{
  quantities: {
    opening: SizeQuantities;
    received: SizeQuantities;
    sales: SizeQuantities;
    closing: SizeQuantities;
  };
}>) => {
  const activeSizes = new Set<string>();
  
  data.forEach(brand => {
    Object.entries(brand.quantities).forEach(([_, sizeQty]) => {
      Object.entries(sizeQty).forEach(([size, qty]) => {
        if (qty > 0) {
          activeSizes.add(size);
        }
      });
    });
  });

  return Array.from(activeSizes).sort((a, b) => Number(b) - Number(a));
};

// Update the styles
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
  srNoCell: {
    padding: 2,
    fontSize: 7,
    borderRightWidth: 1,
    borderRightColor: '#000000',
    width: '3%',
    textAlign: 'center',
  },
  tpCell: {
    padding: 2,
    fontSize: 7,
    borderRightWidth: 1,
    borderRightColor: '#000000',
    width: '6%',
    textAlign: 'center',
  },
  brandNameCell: {
    padding: 2,
    fontSize: 7,
    borderRightWidth: 1,
    borderRightColor: '#000000',
    width: '18%',
  },
  sectionTitle: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#000000',
    padding: 3,
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 0,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#000000',
    backgroundColor: '#ffffff',
  },
  totalCell: {
    fontWeight: 'bold',
  }
});

// PDF Document component
const PDFDocument = ({ barName, date, reportData }: { barName: string, date: string, reportData: BrandReport[] }) => {
  // Helper function to format brand name
  const formatBrandName = (name: string) => {
    if (!name) return '';
    return name.length > 30 ? name.substring(0, 30) + '...' : name;
  };

  // Update the groupBrandsByName function
  const groupBrandsByName = (data: BrandReport[]) => {
    const groups = new Map<string, {
      brand_name: string;
      quantities: {
        opening: { [key: string]: number };
        received: { [key: string]: number };
        sales: { [key: string]: number };
        closing: { [key: string]: number };
      };
      tp_numbers: string[];
    }>();

    data.forEach(item => {
      const existing = groups.get(item.brand_name) || {
        brand_name: formatBrandName(item.brand_name),
        quantities: {
          opening: {},
          received: {},
          sales: {},
          closing: {}
        },
        tp_numbers: []
      };

      const sizeValue = item.sizes.split(' ')[0];
      existing.quantities.opening[sizeValue] = Object.values(item.opening)[0] || 0;
      existing.quantities.received[sizeValue] = Object.values(item.received)[0] || 0;
      existing.quantities.sales[sizeValue] = Object.values(item.sales)[0] || 0;
      existing.quantities.closing[sizeValue] = Object.values(item.closing)[0] || 0;
      existing.tp_numbers = [...new Set([...existing.tp_numbers, ...item.tp_numbers])];

      groups.set(item.brand_name, existing);
    });

    return Array.from(groups.values()).filter(hasNonZeroQuantities);
  };

  // Update the data filtering for each category
  const spiritsData = groupBrandsByName(reportData.filter(item => item.category === 'Spirits'));
  const winesData = groupBrandsByName(reportData.filter(item => item.category === 'Wines'));
  const fermentedBeerData = groupBrandsByName(reportData.filter(item => item.category === 'Fermented Beer'));
  const mildBeerData = groupBrandsByName(reportData.filter(item => item.category === 'Mild Beer'));

  // Get active sizes for each section
  const spiritSizes = getActiveSizes(spiritsData);
  const wineSizes = getActiveSizes(winesData);
  const fermentedBeerSizes = getActiveSizes(fermentedBeerData);
  const mildBeerSizes = getActiveSizes(mildBeerData);

  const calculateTotals = (data: Array<{ quantities: { [key: string]: { [key: string]: number } } }>, activeSizes: string[]) => {
    const totals = {
      opening: {} as { [key: string]: number },
      received: {} as { [key: string]: number },
      sales: {} as { [key: string]: number },
      closing: {} as { [key: string]: number }
    };

    activeSizes.forEach(size => {
      totals.opening[size] = data.reduce((sum, brand) => sum + (brand.quantities.opening[size] || 0), 0);
      totals.received[size] = data.reduce((sum, brand) => sum + (brand.quantities.received[size] || 0), 0);
      totals.sales[size] = data.reduce((sum, brand) => sum + (brand.quantities.sales[size] || 0), 0);
      totals.closing[size] = data.reduce((sum, brand) => sum + (brand.quantities.closing[size] || 0), 0);
    });

    return totals;
  };

  const renderSizeColumns = (quantities: { [key: string]: number }, activeSizes: string[], type: string) => {
    return activeSizes.map(size => (
      <Text key={`${type}-${size}`} style={[styles.tableCell, { width: '35px', textAlign: 'center' }]}>
        {quantities[size] || '0'}
      </Text>
    ));
  };

  // Helper function to format serial number
  const formatSerialNumber = (num: number) => {
    return num.toString().padStart(3, '0');
  };

  // Update the renderSection function
  const renderSection = (title: string, data: ReturnType<typeof groupBrandsByName>, activeSizes: string[]) => {
    if (data.length === 0) return null;

    const totals = calculateTotals(data, activeSizes);

    // Helper function to format TP numbers
    const formatTpNumbers = (tpNumbers: string[]) => {
      if (tpNumbers.length === 0) return '-';
      const firstTp = tpNumbers[0];
      const shortTp = firstTp.substring(0, 6);
      return tpNumbers.length > 1 ? `${shortTp}...` : shortTp;
    };

    return (
      <View style={{ marginTop: title === 'Fermented Beer' ? 10 : 0 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.table}>
          {/* Header Row 1 - Column Labels */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.srNoCell, { borderBottomWidth: 1, borderBottomColor: '#000000' }]}></Text>
            <Text style={[styles.tpCell, { borderBottomWidth: 1, borderBottomColor: '#000000' }]}></Text>
            <Text style={[styles.brandNameCell, { borderBottomWidth: 1, borderBottomColor: '#000000' }]}></Text>
            <View style={[styles.tableCell, { width: '18.25%', borderBottomWidth: 1, borderBottomColor: '#000000' }]}>
              <Text style={[styles.tableHeaderText, { textAlign: 'center', flex: 1 }]}>Opening</Text>
            </View>
            <View style={[styles.tableCell, { width: '18.25%', borderBottomWidth: 1, borderBottomColor: '#000000' }]}>
              <Text style={[styles.tableHeaderText, { textAlign: 'center', flex: 1 }]}>Receipt</Text>
            </View>
            <View style={[styles.tableCell, { width: '18.25%', borderBottomWidth: 1, borderBottomColor: '#000000' }]}>
              <Text style={[styles.tableHeaderText, { textAlign: 'center', flex: 1 }]}>Sales</Text>
            </View>
            <View style={[styles.tableCell, { width: '18.25%', borderBottomWidth: 1, borderBottomColor: '#000000' }]}>
              <Text style={[styles.tableHeaderText, { textAlign: 'center', flex: 1 }]}>Closing</Text>
            </View>
          </View>

          {/* Header Row 2 - Column Names */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.srNoCell, styles.tableHeaderText]}>Sr</Text>
            <Text style={[styles.tpCell, styles.tableHeaderText]}>TP No</Text>
            <Text style={[styles.brandNameCell, styles.tableHeaderText]}>Item Name</Text>
            <View style={[styles.tableCell, { width: '18.25%', flexDirection: 'row' }]}>
              {activeSizes.map(size => (
                <Text key={`header-${size}`} style={[{ width: '35px', textAlign: 'center' }, styles.tableHeaderText]}>{size}</Text>
              ))}
            </View>
            <View style={[styles.tableCell, { width: '18.25%', flexDirection: 'row' }]}>
              {activeSizes.map(size => (
                <Text key={`header-${size}`} style={[{ width: '35px', textAlign: 'center' }, styles.tableHeaderText]}>{size}</Text>
              ))}
            </View>
            <View style={[styles.tableCell, { width: '18.25%', flexDirection: 'row' }]}>
              {activeSizes.map(size => (
                <Text key={`header-${size}`} style={[{ width: '35px', textAlign: 'center' }, styles.tableHeaderText]}>{size}</Text>
              ))}
            </View>
            <View style={[styles.tableCell, { width: '18.25%', flexDirection: 'row' }]}>
              {activeSizes.map(size => (
                <Text key={`header-${size}`} style={[{ width: '35px', textAlign: 'center' }, styles.tableHeaderText]}>{size}</Text>
              ))}
            </View>
          </View>

          {/* Data Rows */}
          {data.map((brand, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.srNoCell}>{formatSerialNumber(index + 1)}</Text>
              <Text style={styles.tpCell}>
                {formatTpNumbers(brand.tp_numbers)}
              </Text>
              <Text style={styles.brandNameCell}>{brand.brand_name}</Text>
              <View style={[styles.tableCell, { width: '18.25%', flexDirection: 'row' }]}>
                {renderSizeColumns(brand.quantities.opening, activeSizes, 'opening')}
              </View>
              <View style={[styles.tableCell, { width: '18.25%', flexDirection: 'row' }]}>
                {renderSizeColumns(brand.quantities.received, activeSizes, 'received')}
              </View>
              <View style={[styles.tableCell, { width: '18.25%', flexDirection: 'row' }]}>
                {renderSizeColumns(brand.quantities.sales, activeSizes, 'sales')}
              </View>
              <View style={[styles.tableCell, { width: '18.25%', flexDirection: 'row' }]}>
                {renderSizeColumns(brand.quantities.closing, activeSizes, 'closing')}
              </View>
            </View>
          ))}

          {/* Total Row */}
          <View style={[styles.tableRow, styles.totalRow]}>
            <Text style={styles.srNoCell}></Text>
            <Text style={styles.tpCell}></Text>
            <Text style={[styles.brandNameCell, styles.totalCell]}>Total</Text>
            <View style={[styles.tableCell, { width: '18.25%', flexDirection: 'row' }]}>
              {renderSizeColumns(totals.opening, activeSizes, 'total-opening')}
            </View>
            <View style={[styles.tableCell, { width: '18.25%', flexDirection: 'row' }]}>
              {renderSizeColumns(totals.received, activeSizes, 'total-received')}
            </View>
            <View style={[styles.tableCell, { width: '18.25%', flexDirection: 'row' }]}>
              {renderSizeColumns(totals.sales, activeSizes, 'total-sales')}
      </View>
            <View style={[styles.tableCell, { width: '18.25%', flexDirection: 'row' }]}>
              {renderSizeColumns(totals.closing, activeSizes, 'total-closing')}
      </View>
      </View>
      </View>
    </View>
  );
  };

  return (
    <Document>
      <Page size="LEGAL" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{barName}</Text>
          <Text style={styles.subtitle}>License No: {/* Add license number */}</Text>
          <Text style={styles.subtitle}>Address: {/* Add address */}</Text>
          <Text style={styles.subtitle}>Date: {format(new Date(date), 'dd/MM/yyyy')}</Text>
        </View>

        {/* Render sections only if they have data */}
        {spiritsData.length > 0 && renderSection('Spirits', spiritsData, spiritSizes)}
        {winesData.length > 0 && renderSection('Wines', winesData, wineSizes)}
        {fermentedBeerData.length > 0 && renderSection('Fermented Beer', fermentedBeerData, fermentedBeerSizes)}
        {mildBeerData.length > 0 && renderSection('Mild Beer', mildBeerData, mildBeerSizes)}
      </Page>
    </Document>
  );
};

export default function BrandwiseReport() {
  const { selectedBar } = useBar();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportData, setReportData] = useState<BrandReport[]>([]);
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

      // Fetch opening stock with category
      const { data: openingData, error: openingError } = await supabase
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

      if (openingError) {
        console.error('Opening stock error:', openingError);
        throw openingError;
      }

      // Fetch received stock (TP entries) with category and TP numbers
      const { data: receivedData, error: receivedError } = await supabase
        .from('tp_items')
        .select(`
          brand_id,
          qty,
          brands (
            id,
            category
          ),
          transport_permits (
            tp_no
          )
        `)
        .eq('transport_permits.bar_id', selectedBar?.id)
        .eq('transport_permits.tp_date', date);

      if (receivedError) {
        console.error('Received stock error:', receivedError);
        throw receivedError;
      }

      // Fetch sales with category
      const { data: salesData, error: salesError } = await supabase
        .from('daily_sales')
        .select(`
          brand_id,
          qty,
          brands (
            id,
            category
          )
        `)
        .eq('bar_id', selectedBar?.id)
        .eq('sale_date', date);

      if (salesError) {
        console.error('Sales error:', salesError);
        throw salesError;
      }

      // Process and combine the data
      const processedData: BrandReport[] = openingData.map((opening: any) => {
        const received = receivedData?.filter((r: any) => r.brand_id === opening.brand_id) || [];
        const sales = salesData?.filter((s: any) => s.brand_id === opening.brand_id) || [];

        const receivedQty = received.reduce((sum: number, item: any) => sum + (item.qty || 0), 0);
        const salesQty = sales.reduce((sum: number, item: any) => sum + (item.qty || 0), 0);

        // Get unique TP numbers for this brand
        const tpNumbers = [...new Set(received
          .map((r: any) => r.transport_permits?.tp_no)
          .filter((n: string | null) => n !== null && n !== undefined)
        )];

        return {
          brand_name: opening.brands?.brand_name || '',
          item_code: opening.brands?.item_code || '',
          sizes: opening.brands?.sizes || '',
          category: opening.brands?.category || '',
          opening: { [opening.brands?.sizes || '']: opening.opening_qty || 0 },
          received: { [opening.brands?.sizes || '']: receivedQty },
          sales: { [opening.brands?.sizes || '']: salesQty },
          closing: { [opening.brands?.sizes || '']: (opening.opening_qty || 0) + receivedQty - salesQty },
          tp_numbers: tpNumbers
        };
      });

      // Filter out any invalid entries
      const validData = processedData.filter(item => 
        item.brand_name && 
        item.sizes && 
        item.category
      );

      setReportData(validData);
    } catch (error: any) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to fetch report data: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    setShowPreview(true);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handlePreview = () => {
    setShowPreview(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Brandwise Report</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Generate detailed reports for your bar's inventory and sales
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Date Selection Card */}
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
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <Calendar className="w-5 h-5 text-gray-400" />
            </div>
          </div>
          </div>

        {/* Preview Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
            <button
            onClick={handlePreview}
              disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200"
            >
              <Eye className="w-5 h-5" />
            {loading ? 'Loading...' : 'Preview Report'}
            </button>
        </div>

        {/* Download Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
            <PDFDownloadLink
              document={<PDFDocument barName={selectedBar?.bar_name || ''} date={date} reportData={reportData} />}
              fileName={`brandwise-report-${date}.pdf`}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200"
            >
              {({ loading }: { loading: boolean }) => (
                <>
                  <Download className="w-5 h-5" />
                {loading ? 'Generating PDF...' : 'Download PDF'}
                </>
              )}
            </PDFDownloadLink>
        </div>

        {/* Print Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
            <button
              onClick={handlePrint}
              disabled={loading}
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

      {/* Data Summary Cards */}
      {!loading && reportData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Brands</span>
              <Package className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {new Set(reportData.map(item => item.brand_name)).size}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Categories</span>
              <Tags className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {new Set(reportData.map(item => item.category)).size}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Sales</span>
              <TrendingUp className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {reportData.reduce((sum, item) => sum + Object.values(item.sales).reduce((a, b) => a + b, 0), 0)}
            </p>
      </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Receipts</span>
              <Truck className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {reportData.reduce((sum, item) => sum + Object.values(item.received).reduce((a, b) => a + b, 0), 0)}
            </p>
          </div>
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
              <PDFViewer width="100%" height="100%">
                <PDFDocument barName={selectedBar?.bar_name || ''} date={date} reportData={reportData} />
              </PDFViewer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
