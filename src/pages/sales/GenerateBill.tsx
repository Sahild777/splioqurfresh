import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { useBar } from '../../context/BarContext';
import { PDFViewer, PDFDownloadLink, Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { toast } from 'react-hot-toast';
import { FileText, Download, Printer, Eye } from 'lucide-react';
import JSZip from 'jszip';

type Customer = {
  id: number;
  customer_name: string;
  license_number: string;
  bar_id: string;
  created_at?: string;
};

type SaleItem = {
  brand_name: string;
  item_code: string;
  sizes: string;
  mrp: number;
  qty: number;
  total: number;
};

type BillData = {
  customer: Customer;
  items: SaleItem[];
  totalAmount: number;
  billDate: string;
  billNumber: string;
  serviceTaxPercent: number;
};

type Bill = {
  billNumber: string;
  customer: Customer;
  items: SaleItem[];
  total: number;
  serviceTax: number;
  finalTotal: number;
};

// PDF styles
const styles = StyleSheet.create({
  page: {
    padding: 15,
    fontFamily: 'Helvetica',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bill: {
    width: '32%',
    height: '48%',
    marginBottom: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#000',
    fontSize: 8,
  },
  header: {
    marginBottom: 4,
    textAlign: 'center',
  },
  title: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 7,
    marginBottom: 1,
  },
  customerInfo: {
    marginBottom: 4,
    padding: 4,
    borderWidth: 1,
    borderColor: '#000',
  },
  customerTitle: {
    fontSize: 7,
    fontWeight: 'bold',
    marginBottom: 1,
  },
  customerText: {
    fontSize: 6,
    marginBottom: 1,
  },
  table: {
    display: 'flex',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableHeader: {
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
  },
  tableCell: {
    width: '16.66%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 2,
    fontSize: 6,
  },
  total: {
    marginTop: 4,
    textAlign: 'right',
    fontSize: 7,
    fontWeight: 'bold',
  },
});

// PDF Document component
const PDFDocument = ({ data, customers }: { data: BillData; customers: Customer[] }) => {
  const getRandomCustomer = () => {
    const randomIndex = Math.floor(Math.random() * customers.length);
    return customers[randomIndex];
  };

  // Split items into groups of 5 and calculate bills
  const generateBills = () => {
    const bills: Bill[] = [];
    const items = [...data.items];
    
    // For each item, create bills with quantities of 5 or less
    items.forEach(item => {
      let remainingQty = item.qty;
      while (remainingQty > 0) {
        const qtyForBill = Math.min(5, remainingQty);
        const billItem: SaleItem = {
          ...item,
          qty: qtyForBill,
          total: qtyForBill * item.mrp
        };

        // Find an existing bill with space or create a new one
        let currentBill = bills.find(b => b.items.length < 5);
        if (!currentBill) {
          currentBill = {
            billNumber: (bills.length + 1).toString().padStart(6, '0'),
            customer: getRandomCustomer(),
            items: [],
            total: 0,
            serviceTax: 0,
            finalTotal: 0
          };
          bills.push(currentBill);
        }

        currentBill.items.push(billItem);
        currentBill.total += billItem.total;
        currentBill.serviceTax = (currentBill.total * data.serviceTaxPercent) / 100;
        currentBill.finalTotal = currentBill.total + currentBill.serviceTax;
        remainingQty -= qtyForBill;
      }
    });

    return bills;
  };

  const allBills = generateBills();

  // Split bills into pages of 12
  const pages = [];
  for (let i = 0; i < allBills.length; i += 12) {
    pages.push(allBills.slice(i, i + 12));
  }

  return (
    <Document>
      {pages.map((pageBills, pageIndex) => (
        <Page 
          key={pageIndex} 
          size="LEGAL" 
          orientation="landscape" 
          style={styles.page}
        >
          {pageBills.map((bill, index) => (
            <View key={index} style={styles.bill}>
              <View style={styles.header}>
                <Text style={styles.title}>Sales Bill</Text>
                <Text style={styles.subtitle}>Bill No: {bill.billNumber}</Text>
                <Text style={styles.subtitle}>Date: {format(new Date(data.billDate), 'dd/MM/yyyy')}</Text>
              </View>

              <View style={styles.customerInfo}>
                <Text style={styles.customerTitle}>Customer Details:</Text>
                <Text style={styles.customerText}>Name: {bill.customer.customer_name}</Text>
                <Text style={styles.customerText}>License No: {bill.customer.license_number}</Text>
              </View>

              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={styles.tableCell}>Sr</Text>
                  <Text style={styles.tableCell}>Item</Text>
                  <Text style={styles.tableCell}>Size</Text>
                  <Text style={styles.tableCell}>MRP</Text>
                  <Text style={styles.tableCell}>Qty</Text>
                  <Text style={styles.tableCell}>Total</Text>
                </View>
                {bill.items.map((item, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={styles.tableCell}>{idx + 1}</Text>
                    <Text style={styles.tableCell}>{item.brand_name}</Text>
                    <Text style={styles.tableCell}>{item.sizes}</Text>
                    <Text style={styles.tableCell}>₹{item.mrp}</Text>
                    <Text style={styles.tableCell}>{item.qty}</Text>
                    <Text style={styles.tableCell}>₹{item.total}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.total}>
                <Text>Sub Total: ₹{bill.total}</Text>
                <Text>Service Tax ({data.serviceTaxPercent}%): ₹{bill.serviceTax.toFixed(2)}</Text>
                <Text style={{ fontWeight: 'bold' }}>Final Total: ₹{bill.finalTotal.toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </Page>
      ))}
    </Document>
  );
};

export default function GenerateBill() {
  const { selectedBar } = useBar();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [billData, setBillData] = useState<BillData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastBillNumber, setLastBillNumber] = useState(0);
  const [serviceTaxPercent, setServiceTaxPercent] = useState(5);
  const [generatedBills, setGeneratedBills] = useState<BillData[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (selectedBar) {
      fetchCustomers();
      fetchLastBillNumber();
    }
  }, [selectedBar]);

  const fetchCustomers = async () => {
    try {
      if (!selectedBar?.id) {
        toast.error('Please select a bar first');
        return;
      }

      const { data, error } = await supabase
        .from('customers')
        .select('id, customer_name, license_number, bar_id, created_at')
        .eq('bar_id', selectedBar.id)
        .order('customer_name');

      if (error) throw error;

      if (!data || data.length === 0) {
        toast('No customers found. Please add customers in Customer Manager first.', {
          icon: '⚠️'
        });
        return;
      }

      setCustomers(data.map(customer => ({
        ...customer,
        bar_id: customer.bar_id.toString()
      })));
    } catch (error: any) {
      toast.error('Failed to fetch customers');
      console.error('Error fetching customers:', error);
    }
  };

  const fetchLastBillNumber = async () => {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('bill_number')
        .order('bill_number', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"

      setLastBillNumber(data?.bill_number || 0);
    } catch (error: any) {
      console.error('Error fetching last bill number:', error);
    }
  };

  const generateBillNumber = () => {
    const nextBillNumber = lastBillNumber + 1;
    return nextBillNumber.toString().padStart(6, '0');
  };

  const generateBillsForDateRange = async () => {
    try {
      setLoading(true);
      setProgress(0);
      const bills: BillData[] = [];
      const skippedDates: string[] = [];
      
      // Get all dates between start and end date
      const start = new Date(startDate);
      const end = new Date(endDate);
      const dates: Date[] = [];
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }

      // Process each date
      for (let i = 0; i < dates.length; i++) {
        const currentDate = format(dates[i], 'yyyy-MM-dd');
        
        // Fetch sales data for the current date
        const { data: salesData, error: salesError } = await supabase
          .from('daily_sales')
          .select(`
            brand_id,
            qty,
            brands (
              brand_name,
              item_code,
              sizes,
              mrp
            )
          `)
          .eq('bar_id', selectedBar?.id)
          .eq('sale_date', currentDate)
          .order('brand_id');

        if (salesError) throw salesError;

        if (salesData && salesData.length > 0) {
          // Transform sales data
          const items: SaleItem[] = salesData.map((sale: any) => ({
            brand_name: sale.brands.brand_name,
            item_code: sale.brands.item_code,
            sizes: sale.brands.sizes,
            mrp: sale.brands.mrp,
            qty: sale.qty,
            total: sale.brands.mrp * sale.qty
          }));

          // Calculate total amount
          const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

          // Only add bill if there are items and total amount is greater than 0
          if (items.length > 0 && totalAmount > 0) {
            // Create bill data
            const billData: BillData = {
              customer: customers[0], // Placeholder customer, will be randomized in PDFDocument
              items,
              totalAmount,
              billDate: currentDate,
              billNumber: generateBillNumber(),
              serviceTaxPercent
            };

            bills.push(billData);
          } else {
            skippedDates.push(currentDate);
          }
        } else {
          skippedDates.push(currentDate);
        }

        // Update progress
        setProgress(((i + 1) / dates.length) * 100);
      }

      setGeneratedBills(bills);
      
      // Show feedback about skipped dates
      if (skippedDates.length > 0) {
        toast(
          `Skipped ${skippedDates.length} dates with no sales data: ${skippedDates.join(', ')}`,
          { duration: 5000 }
        );
      }

      if (bills.length > 0) {
        setBillData(bills[0]); // Set first bill for preview
        setShowPreview(true);
      } else {
        toast.error('No bills generated. No sales data found for the selected date range.');
      }
    } catch (error: any) {
      toast.error('Failed to generate bills');
      console.error('Error generating bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadAllBills = async () => {
    try {
      setLoading(true);
      const zip = new JSZip();
      
      // Generate PDFs for each bill
      for (let i = 0; i < generatedBills.length; i++) {
        const bill = generatedBills[i];
        const pdfDoc = <PDFDocument data={bill} customers={customers} />;
        
        // Convert PDF to blob
        const blob = await pdf(pdfDoc).toBlob();
        zip.file(`bill_${bill.billDate}_${i + 1}.pdf`, blob);
        
        // Update progress
        setProgress(((i + 1) / generatedBills.length) * 100);
      }

      // Generate and download zip file
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bills_${startDate}_to_${endDate}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating bills:', error);
      toast.error('Failed to generate bills');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Generate Bills</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Service Tax (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={serviceTaxPercent}
              onChange={(e) => setServiceTaxPercent(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <button
            onClick={generateBillsForDateRange}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            <Eye className="w-5 h-5 inline-block mr-2" />
            Generate Bills
          </button>

          {generatedBills.length > 0 && (
            <>
              <button
                onClick={downloadAllBills}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                <Download className="w-5 h-5 inline-block mr-2" />
                Download All Bills
              </button>

              <button
                onClick={() => setShowPreview(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              >
                <Printer className="w-5 h-5 inline-block mr-2" />
                Preview Bills
              </button>
            </>
          )}
        </div>

        {loading && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Generating bills... {Math.round(progress)}%
            </p>
          </div>
        )}
      </div>

      {showPreview && billData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Preview Bills</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="h-[calc(90vh-64px)]">
              <PDFViewer width="100%" height="100%">
                <PDFDocument data={billData} customers={customers} />
              </PDFViewer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 