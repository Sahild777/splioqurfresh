import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { format, startOfMonth, endOfMonth } from 'date-fns';
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

// Define types for the report data
type SizeData = {
  [key: string]: number;
};

type CategoryData = {
  opening: SizeData;
  received: SizeData;
  total_stock: SizeData;
  received_from_april: SizeData;
  sold_per_holder: SizeData;
  sold_per_holder_from_april: SizeData;
  breakage: SizeData;
  closing: SizeData;
};

type BulkData = {
  [key: string]: {
    opening: number;
    received: number;
    sales: number;
    closing: number;
  };
};

type ReportData = {
  spirits: CategoryData;
  wines: CategoryData;
  fermented_beer: CategoryData;
  mild_beer: CategoryData;
  bulk: BulkData;
  bulk_liter: CategoryData;
};

// Add types for sale items
type SaleItem = {
  id: string;
  daily_sale_id: string;
  brand_id: string;
  quantity: number;
  brand: {
    category: string;
    sizes: string;
  };
};

type DailySale = {
  id: string;
  bar_id: string;
  date: string;
  sale_items: SaleItem[];
};

// Helper function to create empty category data
const createEmptyCategoryData = (): CategoryData => ({
  opening: {},
  received: {},
  total_stock: {},
  received_from_april: {},
  sold_per_holder: {},
  sold_per_holder_from_april: {},
  breakage: {},
  closing: {}
});

// Update the styles with proper type definitions
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
  formTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  licenseeInfo: {
    fontSize: 11,
    marginBottom: 15,
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
  tableHeaderText: {
    fontWeight: 'bold',
  },
  tableCell: {
    padding: 4,
    fontSize: 9,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  sectionTitle: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#000000',
    padding: 4,
    fontSize: 11,
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
  },
  footer: {
    marginTop: 25,
    fontSize: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 20
  },
  summaryContainer: {
    width: '340px'
  },
  signatureContainer: {
    flex: 1,
    marginTop: 35
  },
  signature: {
    marginTop: 35,
    fontSize: 11,
  },
  categoryContainer: {
    flex: 1,
    marginHorizontal: 2,
  },
  horizontalLayout: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 10,
  }
});

// Update the PDFDocument component props type
type PDFDocumentProps = {
  barName: string;
  month: string;
  year: string;
  reportData: ReportData;
};

// Add helper function to get active sizes from data
const getActiveSizes = (categoryData: CategoryData) => {
  const activeSizes = new Set<string>();
  
  Object.entries(categoryData).forEach(([_, sizeQty]) => {
    Object.entries(sizeQty).forEach(([size, qty]) => {
      if (qty > 0) {
        activeSizes.add(size);
      }
    });
  });

  return Array.from(activeSizes).sort((a, b) => Number(b.replace(/\D/g, '')) - Number(a.replace(/\D/g, '')));
};

// Add helper function to convert ml to liters and calculate total
const calculateBulkLiters = (data: SizeData, sizes: string[]): number => {
  return sizes.reduce((total, size) => {
    const quantity = data[size] || 0;
    // Extract numeric value from size (e.g., '750ml' -> 750)
    const mlValue = parseInt(size.replace(/\D/g, ''));
    // Convert to liters: (ml * quantity) / 1000
    return total + (mlValue * quantity / 1000);
  }, 0);
};

// Add helper function to check if a category has any non-zero quantities
const hasNonZeroQuantities = (categoryData: CategoryData): boolean => {
  return Object.values(categoryData).some(sizeData => 
    Object.values(sizeData).some(qty => qty > 0)
  );
};

const PDFDocument = ({ barName, month, year, reportData }: PDFDocumentProps) => {
  const formatMonthYear = (month: string, year: string) => {
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return format(date, 'MMMM yyyy');
  };

  // Get active categories (categories with non-zero quantities)
  const activeCategories = {
    spirits: hasNonZeroQuantities(reportData.spirits),
    wines: hasNonZeroQuantities(reportData.wines),
    fermented_beer: hasNonZeroQuantities(reportData.fermented_beer),
    mild_beer: hasNonZeroQuantities(reportData.mild_beer)
  };

  // Get active sizes only for active categories
  const sizes = {
    spirits: activeCategories.spirits ? getActiveSizes(reportData.spirits) : [],
    wines: activeCategories.wines ? getActiveSizes(reportData.wines) : [],
    fermented_beer: activeCategories.fermented_beer ? getActiveSizes(reportData.fermented_beer) : [],
    mild_beer: activeCategories.mild_beer ? getActiveSizes(reportData.mild_beer) : []
  };

  const renderSizeColumns = (data: SizeData, categoryKey: keyof typeof activeCategories) => {
    if (!activeCategories[categoryKey]) return null;
    return sizes[categoryKey].map(size => (
      <Text key={size} style={[styles.tableCell, { width: '45px', textAlign: 'center' }]}>
        {data[size] || '0'}
      </Text>
    ));
  };

  const renderSizeHeaders = (categoryKey: keyof typeof activeCategories) => {
    if (!activeCategories[categoryKey]) return null;
    return sizes[categoryKey].map(size => (
      <Text key={size} style={[styles.tableCell, { width: '45px', textAlign: 'center', fontWeight: 'bold' }]}>
        {size}
      </Text>
    ));
  };

  const renderDataRow = (label: string, data: { [key: string]: SizeData }, sizes: { [key: string]: string[] }) => {
    // Calculate bulk liters only for active categories
    const spiritsBulk = activeCategories.spirits ? calculateBulkLiters(data.spirits, sizes.spirits) : 0;
    const winesBulk = activeCategories.wines ? calculateBulkLiters(data.wines, sizes.wines) : 0;
    const fermentedBeerBulk = activeCategories.fermented_beer ? calculateBulkLiters(data.fermented_beer, sizes.fermented_beer) : 0;
    const mildBeerBulk = activeCategories.mild_beer ? calculateBulkLiters(data.mild_beer, sizes.mild_beer) : 0;
    const totalBulkLiters = spiritsBulk + winesBulk + fermentedBeerBulk + mildBeerBulk;

    // Check if this is one of the rows that should be bold
    const isBoldRow = label.includes('Received During') || label.includes('Sold During');

    const cellStyle = {
      ...styles.tableCell,
      textAlign: 'center' as const,
      ...(isBoldRow && { fontWeight: 'bold' as const }),
      width: '45px'
    };

    const bulkCellStyle = {
      ...styles.tableCell,
      textAlign: 'center' as const,
      ...(isBoldRow && { fontWeight: 'bold' as const }),
      width: '60px'
    };

    return (
      <View style={styles.tableRow}>
        <Text style={[styles.tableCell, { width: '150px', fontWeight: 'bold' }]}>{label}</Text>
        {activeCategories.spirits && (
          sizes.spirits.map(size => (
            <Text key={size} style={cellStyle}>
              {data.spirits[size] || '0'}
            </Text>
          ))
        )}
        {activeCategories.wines && (
          sizes.wines.map(size => (
            <Text key={size} style={cellStyle}>
              {data.wines[size] || '0'}
            </Text>
          ))
        )}
        {activeCategories.fermented_beer && (
          sizes.fermented_beer.map(size => (
            <Text key={size} style={cellStyle}>
              {data.fermented_beer[size] || '0'}
            </Text>
          ))
        )}
        {activeCategories.mild_beer && (
          sizes.mild_beer.map(size => (
            <Text key={size} style={cellStyle}>
              {data.mild_beer[size] || '0'}
            </Text>
          ))
        )}
        <Text style={bulkCellStyle}>
          {totalBulkLiters.toFixed(2)}
        </Text>
      </View>
    );
  };

  // Calculate total width for category headers
  const getCategoryWidth = (categoryKey: keyof typeof activeCategories) => {
    if (!activeCategories[categoryKey]) return 0;
    return sizes[categoryKey].length * 45;
  };

  // Add helper function to calculate category totals
  const calculateCategoryTotals = (categoryData: CategoryData) => {
    const totals = {
      opening: 0,
      received: 0,
      sales: 0,
      closing: 0
    };

    // Get all unique sizes
    const allSizes = getActiveSizes(categoryData);
    
    // Calculate bulk liters for each type
    allSizes.forEach(size => {
      const mlValue = parseInt(size.replace(/\D/g, ''));
      totals.opening += (categoryData.opening[size] || 0) * mlValue / 1000;
      totals.received += (categoryData.received[size] || 0) * mlValue / 1000;
      totals.sales += (categoryData.sold_per_holder[size] || 0) * mlValue / 1000;
      totals.closing += (categoryData.closing[size] || 0) * mlValue / 1000;
    });

    return totals;
  };

  // Calculate totals for each active category
  const summaryTotals = {
    spirits: activeCategories.spirits ? calculateCategoryTotals(reportData.spirits) : null,
    wines: activeCategories.wines ? calculateCategoryTotals(reportData.wines) : null,
    fermented_beer: activeCategories.fermented_beer ? calculateCategoryTotals(reportData.fermented_beer) : null,
    mild_beer: activeCategories.mild_beer ? calculateCategoryTotals(reportData.mild_beer) : null
  };

  const renderSummaryRow = (category: string, totals: { opening: number; received: number; sales: number; closing: number } | null) => {
    if (!totals) return null;
    return (
      <View style={[styles.tableRow, { minHeight: 20 }]}>
        <Text style={[styles.tableCell, { width: '100px', fontWeight: 'bold' }]}>{category}</Text>
        <Text style={[styles.tableCell, { width: '60px', textAlign: 'center' }]}>{totals.opening.toFixed(2)}</Text>
        <Text style={[styles.tableCell, { width: '60px', textAlign: 'center' }]}>{totals.received.toFixed(2)}</Text>
        <Text style={[styles.tableCell, { width: '60px', textAlign: 'center' }]}>{totals.sales.toFixed(2)}</Text>
        <Text style={[styles.tableCell, { width: '60px', textAlign: 'center' }]}>{totals.closing.toFixed(2)}</Text>
      </View>
    );
  };

  // Calculate grand totals for summary box
  const grandTotals = {
    opening: 0,
    received: 0,
    sales: 0,
    closing: 0
  };

  // Sum up all category totals
  Object.values(summaryTotals).forEach(categoryTotal => {
    if (categoryTotal) {
      grandTotals.opening += categoryTotal.opening;
      grandTotals.received += categoryTotal.received;
      grandTotals.sales += categoryTotal.sales;
      grandTotals.closing += categoryTotal.closing;
    }
  });

  return (
    <Document>
      <Page size="LEGAL" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>FORM F.L.R.-4</Text>
          <Text style={styles.subtitle}>[See Rule 15 (II)]</Text>
          <Text style={styles.formTitle}>Monthly return of Transactions of Foreign Liquor effected by Vendors, Hotels, Clubs Licensee</Text>
        </View>

        <View style={styles.licenseeInfo}>
          <Text>Licensee Name: {barName}</Text>
          <Text>Month of: {formatMonthYear(month, year)}</Text>
        </View>

        <View style={styles.table}>
          {/* Category Headers */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, { width: '150px', fontWeight: 'bold' }]}>Categories</Text>
            {activeCategories.spirits && (
              <Text style={[styles.tableCell, { width: `${getCategoryWidth('spirits')}px`, textAlign: 'center', fontWeight: 'bold' }]}>
                Spirits
              </Text>
            )}
            {activeCategories.wines && (
              <Text style={[styles.tableCell, { width: `${getCategoryWidth('wines')}px`, textAlign: 'center', fontWeight: 'bold' }]}>
                Wines
              </Text>
            )}
            {activeCategories.fermented_beer && (
              <Text style={[styles.tableCell, { width: `${getCategoryWidth('fermented_beer')}px`, textAlign: 'center', fontWeight: 'bold' }]}>
                Fermented Beer
              </Text>
            )}
            {activeCategories.mild_beer && (
              <Text style={[styles.tableCell, { width: `${getCategoryWidth('mild_beer')}px`, textAlign: 'center', fontWeight: 'bold' }]}>
                Mild Beer
              </Text>
            )}
            <Text style={[styles.tableCell, { width: '60px', textAlign: 'center', fontWeight: 'bold' }]}>
              Bulk Liter
            </Text>
          </View>

          {/* Size Headers */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, { width: '150px', fontWeight: 'bold' }]}>Sizes</Text>
            {activeCategories.spirits && renderSizeHeaders('spirits')}
            {activeCategories.wines && renderSizeHeaders('wines')}
            {activeCategories.fermented_beer && renderSizeHeaders('fermented_beer')}
            {activeCategories.mild_beer && renderSizeHeaders('mild_beer')}
            <Text style={[styles.tableCell, { width: '60px', textAlign: 'center', fontWeight: 'bold' }]}>Liters</Text>
          </View>

          {/* Data Rows */}
          {renderDataRow('Opening Bal. of the\nBegin of the Month', {
            spirits: reportData.spirits.opening,
            wines: reportData.wines.opening,
            fermented_beer: reportData.fermented_beer.opening,
            mild_beer: reportData.mild_beer.opening,
            bulk_liter: reportData.bulk_liter.opening
          }, sizes)}

          {renderDataRow('Received During\nthe Month', {
            spirits: reportData.spirits.received,
            wines: reportData.wines.received,
            fermented_beer: reportData.fermented_beer.received,
            mild_beer: reportData.mild_beer.received,
            bulk_liter: reportData.bulk_liter.received
          }, sizes)}

          {renderDataRow('Total Stock', {
            spirits: reportData.spirits.total_stock,
            wines: reportData.wines.total_stock,
            fermented_beer: reportData.fermented_beer.total_stock,
            mild_beer: reportData.mild_beer.total_stock,
            bulk_liter: reportData.bulk_liter.total_stock
          }, sizes)}

          {renderDataRow('Received Stock From\nBeginning of 1st April', {
            spirits: reportData.spirits.received_from_april,
            wines: reportData.wines.received_from_april,
            fermented_beer: reportData.fermented_beer.received_from_april,
            mild_beer: reportData.mild_beer.received_from_april,
            bulk_liter: reportData.bulk_liter.received_from_april
          }, sizes)}

          {renderDataRow('Sold During\nthe Month', {
            spirits: reportData.spirits.sold_per_holder,
            wines: reportData.wines.sold_per_holder,
            fermented_beer: reportData.fermented_beer.sold_per_holder,
            mild_beer: reportData.mild_beer.sold_per_holder,
            bulk_liter: reportData.bulk_liter.sold_per_holder
          }, sizes)}

          {renderDataRow('Sold From 1st April\nto This Month End', {
            spirits: reportData.spirits.sold_per_holder_from_april,
            wines: reportData.wines.sold_per_holder_from_april,
            fermented_beer: reportData.fermented_beer.sold_per_holder_from_april,
            mild_beer: reportData.mild_beer.sold_per_holder_from_april,
            bulk_liter: reportData.bulk_liter.sold_per_holder_from_april
          }, sizes)}

          {renderDataRow('Breakage', {
            spirits: reportData.spirits.breakage,
            wines: reportData.wines.breakage,
            fermented_beer: reportData.fermented_beer.breakage,
            mild_beer: reportData.mild_beer.breakage,
            bulk_liter: reportData.bulk_liter.breakage
          }, sizes)}

          {renderDataRow('Closing Balance at\nEnd of the Month', {
            spirits: reportData.spirits.closing,
            wines: reportData.wines.closing,
            fermented_beer: reportData.fermented_beer.closing,
            mild_beer: reportData.mild_beer.closing,
            bulk_liter: reportData.bulk_liter.closing
          }, sizes)}
        </View>

        <View style={styles.footer}>
          <View style={styles.summaryContainer}>
          <Text>Total Summary of Transactions:</Text>
            
            {/* Summary Box */}
            <View style={[styles.table, { marginTop: 10 }]}>
              {/* Header Row */}
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, { width: '100px', fontWeight: 'bold' }]}>Category</Text>
                <Text style={[styles.tableCell, { width: '60px', textAlign: 'center', fontWeight: 'bold' }]}>Opening</Text>
                <Text style={[styles.tableCell, { width: '60px', textAlign: 'center', fontWeight: 'bold' }]}>Receipt</Text>
                <Text style={[styles.tableCell, { width: '60px', textAlign: 'center', fontWeight: 'bold' }]}>Sales</Text>
                <Text style={[styles.tableCell, { width: '60px', textAlign: 'center', fontWeight: 'bold' }]}>Closing</Text>
              </View>

              {/* Data Rows */}
              {renderSummaryRow('Spirits', summaryTotals.spirits)}
              {renderSummaryRow('Wines', summaryTotals.wines)}
              {renderSummaryRow('F. Beer', summaryTotals.fermented_beer)}
              {renderSummaryRow('M. Beer', summaryTotals.mild_beer)}

              {/* Total Row */}
              <View style={[styles.tableRow, { minHeight: 20, backgroundColor: '#f0f0f0' }]}>
                <Text style={[styles.tableCell, { width: '100px', fontWeight: 'bold' }]}>Total</Text>
                <Text style={[styles.tableCell, { width: '60px', textAlign: 'center', fontWeight: 'bold' }]}>
                  {grandTotals.opening.toFixed(2)}
                </Text>
                <Text style={[styles.tableCell, { width: '60px', textAlign: 'center', fontWeight: 'bold' }]}>
                  {grandTotals.received.toFixed(2)}
                </Text>
                <Text style={[styles.tableCell, { width: '60px', textAlign: 'center', fontWeight: 'bold' }]}>
                  {grandTotals.sales.toFixed(2)}
                </Text>
                <Text style={[styles.tableCell, { width: '60px', textAlign: 'center', fontWeight: 'bold' }]}>
                  {grandTotals.closing.toFixed(2)}
                </Text>
              </View>
            </View>
        </View>

          <View style={styles.signatureContainer}>
          <Text>Signature of the Licensee or Authorized Agent:</Text>
            <Text style={{ marginTop: 5 }}>Date: {format(new Date(), 'dd/MM/yyyy')}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default function MonthlyReport() {
  const { selectedBar } = useBar();
  const [month, setMonth] = useState(format(new Date(), 'MM'));
  const [year, setYear] = useState(format(new Date(), 'yyyy'));
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const fetchReportData = async () => {
    if (!selectedBar) {
      toast.error('Please select a bar first');
      return;
    }

    try {
      setLoading(true);
      
      // Get the date range for the selected month
      const currentYear = parseInt(year);
      const currentMonth = parseInt(month) - 1; // 0-based month
      
      // Ensure we're not using future dates
      const now = new Date();
      const selectedDate = new Date(currentYear, currentMonth);
      
      if (selectedDate > now) {
        toast.error('Cannot generate report for future dates');
        return;
      }

      const startDate = startOfMonth(selectedDate);
      const endDate = endOfMonth(startDate);
      const aprilStart = new Date(currentYear, 3, 1); // April 1st

      // Calculate the last day of previous month for opening balance
      const lastDayPrevMonth = new Date(currentYear, currentMonth, 0);

      // Fetch opening stock with category (similar to BrandwiseReport)
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
        .eq('bar_id', selectedBar.id)
        .eq('date', format(lastDayPrevMonth, 'yyyy-MM-dd'));

      if (openingError) {
        console.error('Opening stock error:', openingError);
        throw openingError;
      }

      // Process opening balance data using BrandwiseReport's approach
      const processedData: ReportData = {
        spirits: createEmptyCategoryData(),
        wines: createEmptyCategoryData(),
        fermented_beer: createEmptyCategoryData(),
        mild_beer: createEmptyCategoryData(),
        bulk_liter: createEmptyCategoryData(),
        bulk: {
          Whisky: { opening: 0, received: 0, sales: 0, closing: 0 },
          Wine: { opening: 0, received: 0, sales: 0, closing: 0 },
          'Mild Beer': { opening: 0, received: 0, sales: 0, closing: 0 },
          'Fermented Beer': { opening: 0, received: 0, sales: 0, closing: 0 }
        }
      };

      // Group brands by category and size for opening balance
      const openingBalances = new Map<string, Map<string, number>>();

      openingData?.forEach((item: any) => {
        if (!item.brands?.category || !item.brands?.sizes) return;

        const category = item.brands.category.toLowerCase().replace(/[_\s]/g, '');
        const size = item.brands.sizes.split(' ')[0]; // Get the size value (e.g., '750ml')
        const qty = item.opening_qty || 0;

        if (!openingBalances.has(category)) {
          openingBalances.set(category, new Map<string, number>());
        }

        const sizeMap = openingBalances.get(category)!;
        sizeMap.set(size, (sizeMap.get(size) || 0) + qty);
      });

      // Update processed data with opening balances
      openingBalances.forEach((sizeMap, category) => {
        sizeMap.forEach((qty, size) => {
          if (category === 'spirits') {
            processedData.spirits.opening[size] = qty;
          } else if (category === 'wines') {
            processedData.wines.opening[size] = qty;
          } else if (category === 'fermentedbeer') {
            processedData.fermented_beer.opening[size] = qty;
          } else if (category === 'mildbeer') {
            processedData.mild_beer.opening[size] = qty;
          } else if (category === 'bulkliter') {
            processedData.bulk_liter.opening[size] = qty;
          }
        });
      });

      // Fetch inventory data for the current month (received stock)
      const { data: receivedData, error: receivedError } = await supabase
        .from('tp_items')
        .select(`
          brand_id,
          qty,
          brands (
            id,
            category,
            sizes
          ),
          transport_permits (
            tp_no,
            tp_date
          )
        `)
        .eq('transport_permits.bar_id', selectedBar.id)
        .gte('transport_permits.tp_date', startDate.toISOString())
        .lte('transport_permits.tp_date', endDate.toISOString());

      if (receivedError) {
        console.error('Received stock error:', receivedError);
        throw receivedError;
      }

      // Process received data
      receivedData?.forEach((item: any) => {
        if (!item.brands?.category || !item.brands?.sizes) return;

        const category = item.brands.category.toLowerCase().replace(/[_\s]/g, '');
        const size = item.brands.sizes.split(' ')[0];
        const qty = item.qty || 0;

        if (category === 'spirits') {
          processedData.spirits.received[size] = (processedData.spirits.received[size] || 0) + qty;
        } else if (category === 'wines') {
          processedData.wines.received[size] = (processedData.wines.received[size] || 0) + qty;
        } else if (category === 'fermentedbeer') {
          processedData.fermented_beer.received[size] = (processedData.fermented_beer.received[size] || 0) + qty;
        } else if (category === 'mildbeer') {
          processedData.mild_beer.received[size] = (processedData.mild_beer.received[size] || 0) + qty;
        } else if (category === 'bulkliter') {
          processedData.bulk_liter.received[size] = (processedData.bulk_liter.received[size] || 0) + qty;
        }
      });

      // Fetch sales data
      const { data: salesData, error: salesError } = await supabase
        .from('daily_sales')
        .select(`
          id,
          brand_id,
          qty,
          brands (
            category,
            sizes
          )
        `)
        .eq('bar_id', selectedBar.id)
        .gte('sale_date', startDate.toISOString())
        .lte('sale_date', endDate.toISOString());

      if (salesError) {
        console.error('Sales error:', salesError);
        throw salesError;
      }

      // Process sales data
      salesData?.forEach((sale: any) => {
        if (!sale.brands?.category || !sale.brands?.sizes) return;

        const category = sale.brands.category.toLowerCase().replace(/[_\s]/g, '');
        const size = sale.brands.sizes.split(' ')[0];
        const qty = sale.qty || 0;

        if (category === 'spirits') {
          processedData.spirits.sold_per_holder[size] = (processedData.spirits.sold_per_holder[size] || 0) + qty;
        } else if (category === 'wines') {
          processedData.wines.sold_per_holder[size] = (processedData.wines.sold_per_holder[size] || 0) + qty;
        } else if (category === 'fermentedbeer') {
          processedData.fermented_beer.sold_per_holder[size] = (processedData.fermented_beer.sold_per_holder[size] || 0) + qty;
        } else if (category === 'mildbeer') {
          processedData.mild_beer.sold_per_holder[size] = (processedData.mild_beer.sold_per_holder[size] || 0) + qty;
        } else if (category === 'bulkliter') {
          processedData.bulk_liter.sold_per_holder[size] = (processedData.bulk_liter.sold_per_holder[size] || 0) + qty;
        }
      });

      // Calculate totals and closing balances
      ['spirits', 'wines', 'fermented_beer', 'mild_beer', 'bulk_liter'].forEach(category => {
        const categoryData = processedData[category as keyof ReportData] as CategoryData;
        Object.keys({ ...categoryData.opening, ...categoryData.received }).forEach(size => {
          const opening = categoryData.opening[size] || 0;
          const received = categoryData.received[size] || 0;
          const sold = categoryData.sold_per_holder[size] || 0;
          
          categoryData.total_stock[size] = opening + received;
          categoryData.closing[size] = opening + received - sold;
        });
      });

      // Calculate April 1st onwards data
      if (selectedDate >= aprilStart) {
        // Fetch data from April 1st to current month
        const { data: aprilToCurrentData, error: aprilError } = await supabase
          .from('tp_items')
          .select(`
            brand_id,
            qty,
            brands (
              category,
              sizes
            ),
            transport_permits (
              tp_date
            )
          `)
          .eq('transport_permits.bar_id', selectedBar.id)
          .gte('transport_permits.tp_date', aprilStart.toISOString())
          .lte('transport_permits.tp_date', endDate.toISOString());

        if (aprilError) {
          console.error('April to current data error:', aprilError);
          throw aprilError;
        }

        // Process April to current data
        aprilToCurrentData?.forEach((item: any) => {
          if (!item.brands?.category || !item.brands?.sizes) return;

          const category = item.brands.category.toLowerCase().replace(/[_\s]/g, '');
          const size = item.brands.sizes.split(' ')[0];
          const qty = item.qty || 0;

          if (category === 'spirits') {
            processedData.spirits.received_from_april[size] = (processedData.spirits.received_from_april[size] || 0) + qty;
          } else if (category === 'wines') {
            processedData.wines.received_from_april[size] = (processedData.wines.received_from_april[size] || 0) + qty;
          } else if (category === 'fermentedbeer') {
            processedData.fermented_beer.received_from_april[size] = (processedData.fermented_beer.received_from_april[size] || 0) + qty;
          } else if (category === 'mildbeer') {
            processedData.mild_beer.received_from_april[size] = (processedData.mild_beer.received_from_april[size] || 0) + qty;
          } else if (category === 'bulkliter') {
            processedData.bulk_liter.received_from_april[size] = (processedData.bulk_liter.received_from_april[size] || 0) + qty;
          }
        });

        // Fetch sales data from April 1st
        const { data: aprilSalesData, error: aprilSalesError } = await supabase
          .from('daily_sales')
          .select(`
            id,
            brand_id,
            qty,
            brands (
              category,
              sizes
            )
          `)
          .eq('bar_id', selectedBar.id)
          .gte('sale_date', aprilStart.toISOString())
          .lte('sale_date', endDate.toISOString());

        if (aprilSalesError) {
          console.error('April sales error:', aprilSalesError);
          throw aprilSalesError;
        }

        // Process April sales data
        aprilSalesData?.forEach((sale: any) => {
          if (!sale.brands?.category || !sale.brands?.sizes) return;

          const category = sale.brands.category.toLowerCase().replace(/[_\s]/g, '');
          const size = sale.brands.sizes.split(' ')[0];
          const qty = sale.qty || 0;

          if (category === 'spirits') {
            processedData.spirits.sold_per_holder_from_april[size] = (processedData.spirits.sold_per_holder_from_april[size] || 0) + qty;
          } else if (category === 'wines') {
            processedData.wines.sold_per_holder_from_april[size] = (processedData.wines.sold_per_holder_from_april[size] || 0) + qty;
          } else if (category === 'fermentedbeer') {
            processedData.fermented_beer.sold_per_holder_from_april[size] = (processedData.fermented_beer.sold_per_holder_from_april[size] || 0) + qty;
          } else if (category === 'mildbeer') {
            processedData.mild_beer.sold_per_holder_from_april[size] = (processedData.mild_beer.sold_per_holder_from_april[size] || 0) + qty;
          } else if (category === 'bulkliter') {
            processedData.bulk_liter.sold_per_holder_from_april[size] = (processedData.bulk_liter.sold_per_holder_from_april[size] || 0) + qty;
          }
        });
      }

      setReportData(processedData);
      toast.success('Report data fetched successfully');
    } catch (error: any) {
      console.error('Error fetching report data:', error);
      toast.error(error.message || 'Failed to fetch report data');
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Monthly Report</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Generate monthly reports for your bar's inventory and sales
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
        {/* Month Selection Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Month
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const monthNum = (i + 1).toString().padStart(2, '0');
                  return (
                    <option key={monthNum} value={monthNum}>
                      {format(new Date(2024, i, 1), 'MMMM')}
                    </option>
                  );
                })}
              </select>
            </div>

        {/* Year Selection Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
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

        {/* Preview Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
            <button
              onClick={() => {
                setShowPreview(true);
                fetchReportData();
              }}
              disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200"
            >
              <Eye className="w-5 h-5" />
            {loading ? 'Loading...' : 'Preview Report'}
            </button>
        </div>

        {/* Download Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
            {reportData && (
            <PDFDownloadLink
                document={
                  <PDFDocument
                    barName={selectedBar?.bar_name || ''}
                    month={month}
                    year={year}
                    reportData={reportData}
                  />
                }
              fileName={`monthly-report-${month}-${year}.pdf`}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200"
            >
              {({ loading }: { loading: boolean }) => (
                <>
                  <Download className="w-5 h-5" />
                  {loading ? 'Generating PDF...' : 'Download PDF'}
                </>
              )}
            </PDFDownloadLink>
            )}
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

      {/* Preview Modal */}
      {showPreview && reportData && (
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
                <PDFDocument barName={selectedBar?.bar_name || ''} month={month} year={year} reportData={reportData} />
              </PDFViewer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 