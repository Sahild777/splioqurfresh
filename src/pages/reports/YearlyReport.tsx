import { useState } from 'react';
import { useBar } from '../../context/BarContext';
import { toast } from 'react-hot-toast';
import { FileText, Download, Printer, Eye } from 'lucide-react';
import { PDFViewer, PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';

// PDF styles
const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: 'Helvetica',
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
    borderColor: '#000',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    minHeight: 14,
  },
  tableHeader: {
    backgroundColor: '#f0f0f0',
  },
  tableCell: {
    padding: 2,
    fontSize: 7,
    borderRightWidth: 1,
    borderRightColor: '#000',
  },
  sectionTitle: {
    backgroundColor: '#e0e0e0',
    padding: 3,
    fontSize: 9,
    fontWeight: 'bold',
  },
});

// PDF Document component
const PDFDocument = ({ barName, year, reportData }: { barName: string, year: string, reportData: any[] }) => {
  return (
    <Document>
      <Page size="LEGAL" orientation="portrait" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{barName}</Text>
          <Text style={styles.subtitle}>Yearly Report</Text>
          <Text style={styles.subtitle}>Year: {year}</Text>
        </View>
        {/* Add your yearly report specific content here */}
      </Page>
    </Document>
  );
};

export default function YearlyReport() {
  const { selectedBar } = useBar();
  const [year, setYear] = useState(format(new Date(), 'yyyy'));
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      // Add your data fetching logic here
      
    } catch (error: any) {
      toast.error('Failed to fetch report data');
      console.error('Error fetching report data:', error);
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Yearly Report</h1>
        
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              {Array.from({ length: 5 }, (_, i) => {
                const yearNum = (new Date().getFullYear() - 2 + i).toString();
                return (
                  <option key={yearNum} value={yearNum}>
                    {yearNum}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setShowPreview(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              <Eye className="w-5 h-5" />
              Preview
            </button>

            <PDFDownloadLink
              document={<PDFDocument barName={selectedBar?.bar_name || ''} year={year} reportData={reportData} />}
              fileName={`yearly-report-${year}.pdf`}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {({ loading }: { loading: boolean }) => (
                <>
                  <Download className="w-5 h-5" />
                  {loading ? 'Generating...' : 'Download'}
                </>
              )}
            </PDFDownloadLink>

            <button
              onClick={handlePrint}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
            >
              <Printer className="w-5 h-5" />
              Print
            </button>
          </div>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Preview Report</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ×
              </button>
            </div>
            <div className="h-[calc(90vh-64px)]">
              <PDFViewer width="100%" height="100%">
                <PDFDocument barName={selectedBar?.bar_name || ''} year={year} reportData={reportData} />
              </PDFViewer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 