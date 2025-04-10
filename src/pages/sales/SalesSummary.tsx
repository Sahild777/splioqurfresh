import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { format, parseISO } from 'date-fns';
import { useBar } from '../../context/BarContext';
import { Search, ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight, Edit2, Trash2, Eye, Plus, X, Check, Minus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';

type Brand = {
  id: number;
  brand_name: string;
  item_code: string;
  sizes: string;
  mrp: number;
  closing_qty: number;
};

type SaleResponse = {
  id: number;
  sale_date: string;
  created_at: string;
  qty: number;
  brands: Brand;
};

type Sale = {
  id: number;
  sale_date: string;
  brand_name: string;
  item_code: string;
  sizes: string;
  mrp: number;
  qty: number;
  total_amount: number;
  created_at: string;
};

// New type for grouped sales by date
type DateGroupedSale = {
  sale_date: string;
  total_items: number;
  total_qty: number;
  total_amount: number;
  created_at: string;
  items: Sale[];
};

type SortField = 'sale_date' | 'total_items' | 'total_qty' | 'total_amount' | 'created_at';
type SortDirection = 'asc' | 'desc';

// Add new type for edit modal state
type EditModalState = {
  isOpen: boolean;
  saleDate: string | null;
  items: SaleItem[];
};

type SaleItem = {
  sr_no: number;
  brand_id: number | null;
  brand_name: string;
  item_code: string;
  sizes: string;
  mrp: number;
  qty: number;
  available_stock: number;
};

type SelectedBrandWithQty = Brand & {
  selectedQty: number;
};

type InventoryResponse = {
  closing_qty: number;
  brands: {
    id: number;
    brand_name: string;
    item_code: string;
    sizes: string;
    mrp: number;
  };
};

// Add new type definitions at the top with other types
type SaleDataResponse = {
  id: number;
  brand_id: number;
  qty: number;
  brands: {
    id: number;
    brand_name: string;
    item_code: string;
    sizes: string;
    mrp: number;
  };
};

type InventoryDataResponse = {
  closing_qty: number;
  brands: {
    id: number;
    brand_name: string;
    item_code: string;
    sizes: string;
    mrp: number;
  };
};

// Add new type definition for Excel export data
type SaleExportResponse = {
  qty: number;
  brands: {
    brand_name: string;
    item_code: string;
    sizes: string;
  };
};

export default function SalesSummary() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedBar } = useBar();
  const [sales, setSales] = useState<Sale[]>([]);
  const [groupedSales, setGroupedSales] = useState<DateGroupedSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('sale_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewSaleDetails, setViewSaleDetails] = useState<DateGroupedSale | null>(null);
  const [fromDate, setFromDate] = useState<string>(format(new Date().setDate(1), 'yyyy-MM-dd')); // First day of current month
  const [toDate, setToDate] = useState<string>(format(new Date(), 'yyyy-MM-dd')); // Today

  // Add new state for edit modal
  const [editModal, setEditModal] = useState<EditModalState>({
    isOpen: false,
    saleDate: null,
    items: []
  });
  const [selectedBrands, setSelectedBrands] = useState<SelectedBrandWithQty[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [showBrandSearch, setShowBrandSearch] = useState(false);
  const [filteredBrands, setFilteredBrands] = useState<Brand[]>([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);

  useEffect(() => {
    if (selectedBar) {
      fetchSales();
    }
  }, [selectedBar, currentPage, sortField, sortDirection, fromDate, toDate]);

  useEffect(() => {
    // Group sales by date when raw sales data changes
    if (sales.length > 0) {
      groupSalesByDate();
    }
  }, [sales]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      
      // Build the query to get all sales within date range
      let query = supabase
        .from('daily_sales')
        .select(`
          id,
          sale_date,
          created_at,
          qty,
          brands (
            brand_name,
            item_code,
            sizes,
            mrp
          )
        `)
        .eq('bar_id', selectedBar?.id)
        .gte('sale_date', fromDate)
        .lte('sale_date', toDate)
        .order('sale_date', { ascending: false });

      // Add search filter if query exists
      if (searchQuery) {
        query = query.or(`brands.brand_name.ilike.%${searchQuery}%,brands.item_code.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform the data - use a type assertion to help TypeScript understand the structure
      const rawData = data as unknown as Array<{
        id: number;
        sale_date: string;
        created_at: string;
        qty: number;
        brands: Brand;
      }>;

      const transformedData = rawData.map(sale => ({
        id: sale.id,
        sale_date: sale.sale_date,
        brand_name: sale.brands?.brand_name || '',
        item_code: sale.brands?.item_code || '',
        sizes: sale.brands?.sizes || '',
        mrp: sale.brands?.mrp || 0,
        qty: sale.qty,
        total_amount: (sale.brands?.mrp || 0) * sale.qty,
        created_at: sale.created_at
      }));

      setSales(transformedData);
    } catch (error: any) {
      toast.error('Failed to fetch sales');
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupSalesByDate = () => {
    // Group sales by date
    const grouped: Record<string, DateGroupedSale> = {};

    sales.forEach(sale => {
      if (!grouped[sale.sale_date]) {
        grouped[sale.sale_date] = {
          sale_date: sale.sale_date,
          total_items: 0,
          total_qty: 0,
          total_amount: 0,
          created_at: sale.created_at,
          items: []
        };
      }

      // Update group metrics
      grouped[sale.sale_date].total_items += 1;
      grouped[sale.sale_date].total_qty += sale.qty;
      grouped[sale.sale_date].total_amount += sale.total_amount;
      
      // Keep the most recent created_at date
      if (new Date(sale.created_at) > new Date(grouped[sale.sale_date].created_at)) {
        grouped[sale.sale_date].created_at = sale.created_at;
      }
      
      // Add item to the group
      grouped[sale.sale_date].items.push(sale);
    });

    // Convert the grouped object to an array
    let groupedArray = Object.values(grouped);

    // Sort the array based on the current sort field and direction
    groupedArray = sortGroupedSales(groupedArray);

    // Apply pagination
    const totalItems = groupedArray.length;
    setTotalPages(Math.ceil(totalItems / itemsPerPage));

    // Get only the items for the current page
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = groupedArray.slice(startIndex, endIndex);

    setGroupedSales(paginatedItems);
  };

  const sortGroupedSales = (sales: DateGroupedSale[]) => {
    return [...sales].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'sale_date':
          comparison = new Date(a.sale_date).getTime() - new Date(b.sale_date).getTime();
          break;
        case 'total_items':
          comparison = a.total_items - b.total_items;
          break;
        case 'total_qty':
          comparison = a.total_qty - b.total_qty;
          break;
        case 'total_amount':
          comparison = a.total_amount - b.total_amount;
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        default:
          comparison = new Date(a.sale_date).getTime() - new Date(b.sale_date).getTime();
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ChevronsUpDown className="w-4 h-4" />;
    return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  const handleViewSaleDetails = (sale: DateGroupedSale) => {
    setViewSaleDetails(sale);
  };

  const handleEdit = async (saleDate: string) => {
    try {
      setEditLoading(true);
      
      // Fetch existing sales for the date
      const { data: salesData, error: salesError } = await supabase
        .from('daily_sales')
        .select(`
          id,
          brand_id,
          qty,
          brands (
            id,
            brand_name,
            item_code,
            sizes,
            mrp
          )
        `)
        .eq('bar_id', selectedBar?.id)
        .eq('sale_date', saleDate);

      if (salesError) throw salesError;

      // Get the latest inventory date
      const { data: latestInventory, error: latestError } = await supabase
        .from('inventory')
        .select('date')
        .eq('bar_id', selectedBar?.id)
        .order('date', { ascending: false })
        .limit(1);

      if (latestError) throw latestError;

      const inventoryDate = latestInventory?.[0]?.date || format(new Date(), 'yyyy-MM-dd');

      // Fetch current inventory for all brands
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .select(`
          closing_qty,
          brands!inner (
            id,
            brand_name,
            item_code,
            sizes,
            mrp
          )
        `)
        .eq('bar_id', selectedBar?.id)
        .eq('date', inventoryDate);

      if (inventoryError) throw inventoryError;

      // Create a map of brand_id to available stock
      const stockMap = new Map();
      (inventoryData || []).forEach(item => {
        if (item.brands && item.closing_qty !== null) {
          stockMap.set(item.brands.id, item.closing_qty);
        }
      });

      // Transform the sales data into SaleItem format with correct available stock
      const saleItems: SaleItem[] = ((salesData || []) as unknown as SaleDataResponse[]).map((sale, index) => ({
        sr_no: index + 1,
        brand_id: sale.brand_id,
        brand_name: sale.brands?.brand_name || '',
        item_code: sale.brands?.item_code || '',
        sizes: sale.brands?.sizes || '',
        mrp: sale.brands?.mrp || 0,
        qty: sale.qty,
        available_stock: stockMap.get(sale.brand_id) || 0
      }));

      // Open edit modal with the fetched data
      setEditModal({
        isOpen: true,
        saleDate,
        items: saleItems
      });

      // Store all brands with their stock for the brand search
      const transformedBrands: Brand[] = ((inventoryData || []) as unknown as InventoryDataResponse[]).map(item => ({
        id: item.brands.id,
        brand_name: item.brands.brand_name,
        item_code: item.brands.item_code,
        sizes: item.brands.sizes,
        mrp: item.brands.mrp,
        closing_qty: item.closing_qty
      }));

      setBrands(transformedBrands);
      setFilteredBrands([]);

    } catch (error: any) {
      console.error('Error fetching sales for edit:', error);
      toast.error('Failed to load sales for editing');
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      setEditLoading(true);

      // Validate data
      const invalidItems = editModal.items.filter(item => !item.brand_id || item.qty <= 0);
      if (invalidItems.length > 0) {
        toast.error('Please fill all required fields and ensure quantities are greater than 0');
        return;
      }

      // Get the current user's ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Delete existing sales for the date
      const { error: deleteError } = await supabase
        .from('daily_sales')
        .delete()
        .eq('bar_id', selectedBar?.id)
        .eq('sale_date', editModal.saleDate);

      if (deleteError) throw deleteError;

      // Save updated sales
      const { error } = await supabase
        .from('daily_sales')
        .insert(
          editModal.items.map(item => ({
            bar_id: selectedBar?.id,
            sale_date: editModal.saleDate,
            brand_id: item.brand_id,
            qty: item.qty,
            created_by: user.id,
            created_at: new Date().toISOString()
          }))
        );

      if (error) throw error;

      toast.success('Sales updated successfully');
      setEditModal({ isOpen: false, saleDate: null, items: [] });
      fetchSales(); // Refresh the sales list

    } catch (error: any) {
      console.error('Error updating sales:', error);
      toast.error('Failed to update sales');
    } finally {
      setEditLoading(false);
    }
  };

  const handleAddNewSale = () => {
    navigate('/sales/daily');
  };

  const handleDeleteSalesByDate = async (saleDate: string) => {
    if (!window.confirm(`Are you sure you want to delete all sales for ${format(new Date(saleDate), 'dd/MM/yyyy')}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('daily_sales')
        .delete()
        .eq('bar_id', selectedBar?.id)
        .eq('sale_date', saleDate);

      if (error) throw error;

      toast.success('Sales deleted successfully');
      fetchSales(); // Refresh the list
    } catch (error: any) {
      toast.error('Failed to delete sales');
      console.error('Error deleting sales:', error);
    }
  };

  const fetchBrandsWithStock = async () => {
    try {
      // Get the latest inventory date
      const { data: latestInventory, error: latestError } = await supabase
        .from('inventory')
        .select('date')
        .eq('bar_id', selectedBar?.id)
        .order('date', { ascending: false })
        .limit(1);

      if (latestError) throw latestError;

      const inventoryDate = latestInventory?.[0]?.date || format(new Date(), 'yyyy-MM-dd');

      // Get all inventory items with stock
      const { data, error: inventoryError } = await supabase
        .from('inventory')
        .select(`
          closing_qty,
          brands!inner (
            id,
            brand_name,
            item_code,
            sizes,
            mrp
          )
        `)
        .eq('bar_id', selectedBar?.id)
        .eq('date', inventoryDate)
        .gt('closing_qty', 0);

      if (inventoryError) throw inventoryError;

      if (!data || data.length === 0) {
        toast.error('No brands with stock found');
        setBrands([]);
        setFilteredBrands([]);
        return;
      }

      // Transform the data into Brand type with proper typing
      const inventoryData = data as unknown as InventoryResponse[];
      const transformedData: Brand[] = inventoryData.map(item => ({
        id: item.brands.id,
        brand_name: item.brands.brand_name,
        item_code: item.brands.item_code,
        sizes: item.brands.sizes,
        mrp: item.brands.mrp,
        closing_qty: item.closing_qty
      }));

      setBrands(transformedData);
      setFilteredBrands([]);

    } catch (error: any) {
      console.error('Error fetching brands with stock:', error);
      toast.error('Failed to fetch brands with stock');
    }
  };

  const handleExportToExcel = async (saleDate: string) => {
    try {
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

      toast.success('Excel file generated successfully');
    } catch (error: any) {
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to generate Excel file');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Summary</h1>
          <button
            onClick={handleAddNewSale}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mt-2 md:mt-0"
          >
            <Plus className="w-5 h-5 inline-block mr-1" />
            Add New Sale
          </button>
        </div>
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="md:w-1/4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="md:w-1/4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="md:w-1/2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by Brand Name or Item Code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Sr. No
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('sale_date')}
                >
                  <div className="flex items-center gap-1">
                    Sale Date {getSortIcon('sale_date')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('total_items')}
                >
                  <div className="flex items-center gap-1">
                    Total Items {getSortIcon('total_items')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('total_qty')}
                >
                  <div className="flex items-center gap-1">
                    Total Qty {getSortIcon('total_qty')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('total_amount')}
                >
                  <div className="flex items-center gap-1">
                    Total Amount {getSortIcon('total_amount')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center gap-1">
                    Last Updated {getSortIcon('created_at')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : groupedSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No sales found
                  </td>
                </tr>
              ) : (
                groupedSales.map((groupedSale, index) => (
                  <tr key={groupedSale.sale_date} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {format(new Date(groupedSale.sale_date), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {groupedSale.total_items}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {groupedSale.total_qty}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-semibold">
                      ₹{groupedSale.total_amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {format(new Date(groupedSale.created_at), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleViewSaleDetails(groupedSale)}
                          className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEdit(groupedSale.sale_date)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Edit Sales"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSalesByDate(groupedSale.sale_date)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete All Sales for this Date"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleExportToExcel(groupedSale.sale_date)}
                          className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300"
                          title="Export to Excel"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                            <polyline points="14 2 14 8 20 8" />
                            <path d="M8 13h8" />
                            <path d="M8 17h8" />
                            <path d="M8 9h8" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Showing page <span className="font-medium">{currentPage}</span> of{' '}
                <span className="font-medium">{totalPages}</span>
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Sale Details Modal */}
      {viewSaleDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Sales Details - {format(new Date(viewSaleDetails.sale_date), 'dd/MM/yyyy')}
              </h2>
              <button
                onClick={() => setViewSaleDetails(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-grow">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Items</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{viewSaleDetails.total_items}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Quantity</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{viewSaleDetails.total_qty}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Amount</div>
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">₹{viewSaleDetails.total_amount.toFixed(2)}</div>
                </div>
              </div>
              
              <h3 className="text-md font-semibold text-gray-900 dark:text-white mt-4 mb-2">Item Details</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Item Name
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Item Code
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        MRP
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {viewSaleDetails.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.brand_name}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.item_code}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.sizes}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          ₹{item.mrp.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.qty}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          ₹{item.total_amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setViewSaleDetails(null)}
                className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Sales Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit Sales - {editModal.saleDate && format(new Date(editModal.saleDate), 'dd/MM/yyyy')}
              </h2>
              <button
                onClick={() => setEditModal({ isOpen: false, saleDate: null, items: [] })}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-grow">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Sr. No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Item Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Item Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      MRP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Available Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Sale Qty
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {editModal.items.map((item, index) => (
                    <tr key={item.sr_no}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.sr_no}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        <div className="relative">
                          <input
                            type="text"
                            value={item.brand_name}
                            readOnly
                            onClick={() => {
                              setSelectedRowIndex(index);
                              setShowBrandSearch(true);
                            }}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-pointer"
                            placeholder="Click to search brand..."
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.item_code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.sizes}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        ₹{item.mrp}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.available_stock}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              const newItems = [...editModal.items];
                              if (newItems[index].qty > 0) {
                                newItems[index].qty--;
                                setEditModal({ ...editModal, items: newItems });
                              }
                            }}
                            className="p-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            value={item.qty}
                            min="0"
                            max={item.available_stock}
                            onChange={(e) => {
                              const newQty = parseInt(e.target.value) || 0;
                              const newItems = [...editModal.items];
                              newItems[index].qty = Math.min(Math.max(0, newQty), item.available_stock);
                              setEditModal({ ...editModal, items: newItems });
                            }}
                            className="w-20 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded-md"
                          />
                          <button
                            onClick={() => {
                              const newItems = [...editModal.items];
                              if (newItems[index].qty < item.available_stock) {
                                newItems[index].qty++;
                                setEditModal({ ...editModal, items: newItems });
                              }
                            }}
                            className="p-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        <button
                          onClick={() => {
                            const newItems = editModal.items.filter((_, i) => i !== index);
                            setEditModal({ ...editModal, items: newItems });
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={() => {
                  const newItems = [...editModal.items];
                  newItems.push({
                    sr_no: newItems.length + 1,
                    brand_id: null,
                    brand_name: '',
                    item_code: '',
                    sizes: '',
                    mrp: 0,
                    qty: 0,
                    available_stock: 0
                  });
                  setEditModal({ ...editModal, items: newItems });
                }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-5 h-5 inline-block mr-1" />
                Add Item
              </button>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
              <button
                onClick={() => setEditModal({ isOpen: false, saleDate: null, items: [] })}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Brand Search Modal */}
      {showBrandSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl mx-4">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Search Brand
              </h2>
              <button
                onClick={() => {
                  setShowBrandSearch(false);
                  setSearchQuery('');
                  setFilteredBrands([]);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    const filtered = brands.filter(brand =>
                      brand.brand_name.toLowerCase().includes(e.target.value.toLowerCase()) ||
                      brand.item_code.toLowerCase().includes(e.target.value.toLowerCase())
                    );
                    setFilteredBrands(filtered);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Search brand name or item code..."
                />
              </div>
              <div className="mt-4 max-h-96 overflow-y-auto">
                {(searchQuery ? filteredBrands : brands).map((brand, index) => (
                  <div
                    key={brand.id}
                    onClick={() => {
                      const newItems = [...editModal.items];
                      newItems[selectedRowIndex] = {
                        ...newItems[selectedRowIndex],
                        brand_id: brand.id,
                        brand_name: brand.brand_name,
                        item_code: brand.item_code,
                        sizes: brand.sizes,
                        mrp: brand.mrp,
                        available_stock: brand.closing_qty,
                        qty: 1
                      };
                      setEditModal({ ...editModal, items: newItems });
                      setShowBrandSearch(false);
                      setSearchQuery('');
                      setFilteredBrands([]);
                    }}
                    className="flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{brand.brand_name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {brand.item_code} - {brand.sizes} - ₹{brand.mrp} (Stock: {brand.closing_qty})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 