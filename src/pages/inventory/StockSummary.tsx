import { useState, useEffect } from 'react';
import { useBar } from '../../context/BarContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Download, Search, Filter, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import InventoryHistoryModal from '../../components/InventoryHistoryModal';
import { format, subDays } from 'date-fns';

interface Brand {
  id: number;
  brand_name: string;
  item_code: string;
  sizes: string;
  mrp: number;
  category: string;
}

interface StockItem {
  brand_id: number;
  brand_name: string;
  item_code: string;
  sizes: string;
  mrp: number;
  category: string;
  current_stock: number;
}

interface InventoryResponse {
  brand_id: number;
  closing_qty: number;
  brands: {
    brand_name: string;
    item_code: string;
    sizes: string;
    mrp: number;
    category: string;
  };
}

export default function StockSummary() {
  const { selectedBar } = useBar();
  const [loading, setLoading] = useState(false);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [displayedItems, setDisplayedItems] = useState<StockItem[]>([]);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // History modal state
  const [historyModal, setHistoryModal] = useState<{
    isOpen: boolean;
    brandId: number | null;
    brandName: string;
  }>({
    isOpen: false,
    brandId: null,
    brandName: '',
  });

  useEffect(() => {
    if (selectedBar) {
      fetchStockSummary();
    }
  }, [selectedBar]);

  // Effect for filtering and pagination
  useEffect(() => {
    let result = [...stockItems];
    
    // Apply search
    if (searchQuery) {
      const lowercaseSearch = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.brand_name.toLowerCase().includes(lowercaseSearch) ||
        item.item_code.toLowerCase().includes(lowercaseSearch) ||
        item.sizes.toLowerCase().includes(lowercaseSearch)
      );
    }
    
    // Apply category filter
    if (categoryFilter) {
      result = result.filter(item => item.category === categoryFilter);
    }
    
    setDisplayedItems(result);
    
    // Calculate total pages
    setTotalPages(Math.ceil(result.length / itemsPerPage));
    
    // Reset to first page when filters change
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [stockItems, searchQuery, categoryFilter, itemsPerPage]);

  const fetchStockSummary = async () => {
    if (!selectedBar) return;

    setLoading(true);
    try {
      // Get today's date
      const today = new Date().toISOString().split('T')[0];

      // Fetch latest inventory for each brand
      const { data: inventory, error } = await supabase
        .from('inventory')
        .select(`
          brand_id,
          closing_qty,
          brands (
            brand_name,
            item_code,
            sizes,
            mrp,
            category
          )
        `)
        .eq('bar_id', selectedBar.id)
        .eq('date', today);

      if (error) throw error;

      // Transform the data
      const stockData = (inventory || []).map((item: any) => ({
        brand_id: item.brand_id,
        brand_name: item.brands.brand_name,
        item_code: item.brands.item_code,
        sizes: item.brands.sizes,
        mrp: item.brands.mrp,
        category: item.brands.category,
        current_stock: item.closing_qty
      }));

      setStockItems(stockData);
    } catch (error) {
      console.error('Error fetching stock summary:', error);
      toast.error('Failed to fetch stock summary');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text('Stock Summary Report', 14, 15);
    doc.setFontSize(12);
    doc.text(`Bar: ${selectedBar?.bar_name}`, 14, 25);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 32);
    
    // Add table
    const tableData = displayedItems.map(item => [
      item.item_code,
      item.brand_name,
      item.sizes,
      item.category,
      item.current_stock.toString(),
      `₹${item.mrp.toFixed(2)}`
    ]);

    (doc as any).autoTable({
      startY: 40,
      head: [['Item Code', 'Brand Name', 'Size', 'Category', 'Current Stock', 'MRP']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 2,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      }
    });

    // Save the PDF
    doc.save(`stock-summary-${selectedBar?.bar_name}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleShowHistory = (brandId: number, brandName: string) => {
    setHistoryModal({
      isOpen: true,
      brandId,
      brandName,
    });
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(parseInt(e.target.value));
  };
  
  // Get current items for pagination
  const getCurrentItems = () => {
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return displayedItems.slice(indexOfFirstItem, indexOfLastItem);
  };

  if (!selectedBar) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Please select a bar first</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Stock Summary</h1>
        <p className="text-gray-600 dark:text-gray-400">Current stock levels for all brands</p>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-10 py-2 w-full focus:ring-blue-500 focus:border-blue-500 dark:text-white"
            />
          </div>
          
          {/* Category Filter */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-gray-400" />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-10 py-2 w-full focus:ring-blue-500 focus:border-blue-500 dark:text-white"
            >
              <option value="">All Categories</option>
              <option value="Spirits">Spirits</option>
              <option value="Wines">Wines</option>
              <option value="Fermented Beer">Fermented Beer</option>
              <option value="Mild Beer">Mild Beer</option>
            </select>
          </div>

          {/* Items Per Page */}
          <div className="flex items-center justify-end gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">Show:</label>
            <select
              value={itemsPerPage}
              onChange={handleItemsPerPageChange}
              className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-sm text-gray-600 dark:text-gray-400">per page</span>
          </div>

          {/* Export Button */}
          <div className="flex justify-end">
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center min-h-[200px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Empty State */}
      {!loading && displayedItems.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            {stockItems.length === 0
              ? "No stock data available."
              : "No items match your current filters."}
          </p>
        </div>
      )}

      {/* Stock Table */}
      {!loading && displayedItems.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Item Code
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Brand Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Size
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Category
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Current Stock
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    MRP
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {getCurrentItems().map((item) => (
                  <tr key={item.brand_id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {item.item_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      <button
                        onClick={() => handleShowHistory(item.brand_id, item.brand_name)}
                        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {item.brand_name}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {item.sizes}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium 
                        ${item.category === 'Spirits' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' : ''}
                        ${item.category === 'Wines' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : ''}
                        ${item.category === 'Fermented Beer' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300' : ''}
                        ${item.category === 'Mild Beer' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : ''}
                      `}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <span className={`${item.current_stock < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {item.current_stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      ₹{item.mrp.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, displayedItems.length)}</span> to{' '}
              <span className="font-medium">{Math.min(currentPage * itemsPerPage, displayedItems.length)}</span> of{' '}
              <span className="font-medium">{displayedItems.length}</span> items
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded ${
                  currentPage === 1
                    ? 'bg-gray-200 text-gray-400 dark:bg-gray-600 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // For simplicity, show at most 5 page numbers
                let pageNum;
                if (totalPages <= 5) {
                  // If 5 or fewer pages, show all
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  // If near the start, show first 5
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  // If near the end, show last 5
                  pageNum = totalPages - 4 + i;
                } else {
                  // Otherwise show current page and 2 on either side
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1 rounded ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-3 py-1 rounded ${
                  currentPage === totalPages
                    ? 'bg-gray-200 text-gray-400 dark:bg-gray-600 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      <InventoryHistoryModal
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal(prev => ({ ...prev, isOpen: false }))}
        brandId={historyModal.brandId || 0}
        brandName={historyModal.brandName}
        startDate={format(subDays(new Date(), 30), 'yyyy-MM-dd')}
        endDate={format(new Date(), 'yyyy-MM-dd')}
      />
    </div>
  );
} 