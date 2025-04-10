import { useState } from 'react';
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

// Define styles for PDF
const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 15,
    textAlign: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 3,
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
    minHeight: 25,
  },
  tableHeader: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  tableCell: {
    padding: 4,
    fontSize: 9,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  footer: {
    marginTop: 25,
    fontSize: 11,
  }
});

// PDF Document Component
const PDFDocument = ({ barName, date, billData }: any) => {
  return (
    <Document>
      <Page size="LEGAL" orientation="portrait" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Bill</Text>
          <Text style={styles.subtitle}>Bar Name: {barName}</Text>
          <Text style={styles.subtitle}>Date: {date}</Text>
        </View>
        
        {/* Add bill content here */}
        <View style={styles.table}>
          {/* Table headers */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, { width: '40px', fontWeight: 'bold' }]}>Sr.</Text>
            <Text style={[styles.tableCell, { width: '200px', fontWeight: 'bold' }]}>Brand</Text>
            <Text style={[styles.tableCell, { width: '80px', fontWeight: 'bold' }]}>Size</Text>
            <Text style={[styles.tableCell, { width: '80px', fontWeight: 'bold' }]}>Quantity</Text>
            <Text style={[styles.tableCell, { width: '100px', fontWeight: 'bold' }]}>Amount</Text>
          </View>
          
          {/* Table data will be added here */}
        </View>

        <View style={styles.footer}>
          <Text>Signature:</Text>
        </View>
      </Page>
    </Document>
  );
};

export default function PrintBill() {
  const { selectedBar } = useBar();
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [billData, setBillData] = useState(null);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Print Bill</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Generate and print bills for your transactions
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {/* Date Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Date
          </label>
          <input
            type="date"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* Preview Button */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
          <button
            onClick={() => setShowPreview(true)}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200"
          >
            <Eye className="w-5 h-5" />
            {loading ? 'Loading...' : 'Preview Bill'}
          </button>
        </div>

        {/* Print Button */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
          <button
            disabled={!billData || loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200"
          >
            <Printer className="w-5 h-5" />
            Print Bill
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-gray-700 dark:text-gray-300">Loading bill data...</span>
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
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Preview Bill</h2>
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
                <PDFDocument 
                  barName={selectedBar?.bar_name || ''} 
                  date={new Date().toLocaleDateString()} 
                  billData={billData}
                />
              </PDFViewer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 