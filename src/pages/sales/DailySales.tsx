import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { useBar } from '../../context/BarContext';
import { Search, X, Check, Plus, Minus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSearchParams, useNavigate } from 'react-router-dom';

type Brand = {
  id: number;
  brand_name: string;
  item_code: string;
  sizes: string;
  mrp: number;
  closing_qty: number;
  shortform?: string;
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

interface InventoryBrand {
  id: number;
  brand_name: string;
  item_code: string;
  sizes: string;
  mrp: number;
}

interface InventoryResponse {
  brand_id: number;
  closing_qty: number;
  brands: InventoryBrand;
}

type BrandWithStock = {
  id: number;
  brand_name: string;
  item_code: string;
  sizes: string;
  mrp: number;
  closing_qty: number;
};

interface InventoryItem {
  closing_qty: number;
  brands: {
    id: number;
    brand_name: string;
    item_code: string;
    sizes: string;
    mrp: number;
  };
}

interface RawInventoryData {
  closing_qty: number;
  brands: InventoryBrand;
}

// Add a new type to track selected brands with quantities
type SelectedBrandWithQty = Brand & { selectedQty: number };

export default function DailySales() {
  const { selectedBar } = useBar();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Check if we're in edit mode (date parameter provided)
  const dateParam = searchParams.get('date');
  const isEditMode = !!dateParam;
  
  const [saleDate, setSaleDate] = useState(dateParam || format(new Date(), 'yyyy-MM-dd'));
  const [brands, setBrands] = useState<Brand[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([{ sr_no: 1, brand_id: null, brand_name: '', item_code: '', sizes: '', mrp: 0, qty: 0, available_stock: 0 }]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBrandSearch, setShowBrandSearch] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);
  const [filteredBrands, setFilteredBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingExistingSales, setIsFetchingExistingSales] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedBrandIndex, setSelectedBrandIndex] = useState(0);
  const brandListRef = useRef<HTMLDivElement>(null);
  const [selectedBrands, setSelectedBrands] = useState<SelectedBrandWithQty[]>([]);

  // Add refs for quantity input fields
  const qtyInputRefs = useRef<{[key: number]: HTMLInputElement | null}>({});

  // Add shortcuts state
  const [shortcuts, setShortcuts] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (selectedBar) {
      fetchBrandsWithStock();
      fetchShortcuts();
      
      // If we're in edit mode, fetch existing sales for the date
      if (isEditMode) {
        fetchExistingSalesForDate();
      }
    }
  }, [selectedBar, saleDate, isEditMode]);

  useEffect(() => {
    if (showBrandSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showBrandSearch]);

  useEffect(() => {
    // Reset selectedBrandIndex when search results change
    setSelectedBrandIndex(0);
  }, [filteredBrands, searchQuery]);

  // Add effect to focus quantity input when a brand is selected
  useEffect(() => {
    // Focus the quantity input of the most recently added item
    if (selectedBrands.length > 0) {
      const lastAddedBrand = selectedBrands[selectedBrands.length - 1];
      setTimeout(() => {
        const inputRef = qtyInputRefs.current[lastAddedBrand.id];
        if (inputRef) {
          inputRef.focus();
          inputRef.select(); // Select the existing text for easy replacement
        }
      }, 50); // Small delay to ensure the DOM is updated
    }
  }, [selectedBrands.length]);

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

      const inventoryDate = latestInventory?.[0]?.date || saleDate;
      console.log('Using inventory date:', inventoryDate); // Debug log

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

      if (inventoryError) {
        console.error('Inventory fetch error:', inventoryError);
        throw inventoryError;
      }

      if (!data || data.length === 0) {
        console.log('No inventory data found for date:', inventoryDate);
        toast.error('No brands with stock found');
        setBrands([]);
        setFilteredBrands([]);
        return;
      }

      // Log raw data for debugging
      console.log('Raw inventory data:', data);

      // Transform the data into the required format
      // Using type assertion to help TypeScript understand the structure
      const inventoryData = data as unknown as RawInventoryData[];
      
      const transformedData: Brand[] = inventoryData
        .filter(item => item.brands && item.closing_qty > 0)
        .map(item => ({
          id: item.brands.id,
          brand_name: item.brands.brand_name,
          item_code: item.brands.item_code,
          sizes: item.brands.sizes,
          mrp: item.brands.mrp,
          closing_qty: item.closing_qty
        }))
        .sort((a, b) => a.brand_name.localeCompare(b.brand_name));

      console.log(`Found ${transformedData.length} brands with stock for date ${inventoryDate}`);
      console.log('All brands with stock:', transformedData); // Debug log

      setBrands(transformedData);
      setFilteredBrands([]);

    } catch (error: any) {
      console.error('Error fetching brands with stock:', error.message || error);
      toast.error('Failed to fetch brands with stock');
    }
  };

  const fetchExistingSalesForDate = async () => {
    if (!dateParam || !selectedBar) return;
    
    try {
      setIsFetchingExistingSales(true);
      
      const { data, error } = await supabase
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
        .eq('bar_id', selectedBar.id)
        .eq('sale_date', dateParam);
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error(`No sales found for ${format(new Date(dateParam), 'dd/MM/yyyy')}`);
        return;
      }
      
      // Get current inventory to set available stock correctly
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .select(`
          closing_qty,
          brands!inner (
            id
          )
        `)
        .eq('bar_id', selectedBar.id)
        .order('date', { ascending: false })
        .limit(1);
      
      if (inventoryError) throw inventoryError;
      
      // Create a map of brand_id -> closing_qty for quick lookup
      const inventoryMap = new Map();
      if (inventoryData && inventoryData.length > 0) {
        (inventoryData as any[]).forEach(item => {
          if (item.brands && item.closing_qty) {
            inventoryMap.set(item.brands.id, item.closing_qty);
          }
        });
      }
      
      // Transform the existing sales into SaleItem format
      const existingSales: SaleItem[] = (data as any[]).map((sale, index) => ({
        sr_no: index + 1,
        brand_id: sale.brand_id,
        brand_name: sale.brands?.brand_name || '',
        item_code: sale.brands?.item_code || '',
        sizes: sale.brands?.sizes || '',
        mrp: sale.brands?.mrp || 0,
        qty: sale.qty,
        available_stock: inventoryMap.get(sale.brand_id) || 0
      }));
      
      setSaleItems(existingSales);
      toast.success(`Loaded ${existingSales.length} items for ${format(new Date(dateParam), 'dd/MM/yyyy')}`);
      
    } catch (error: any) {
      console.error('Error fetching existing sales:', error);
      toast.error('Failed to load existing sales');
    } finally {
      setIsFetchingExistingSales(false);
    }
  };

  const fetchShortcuts = async () => {
    try {
      const { data: shortcutData, error: shortcutError } = await supabase
        .from('shortcuts')
        .select('brand_id, shortform');

      if (shortcutError) throw shortcutError;

      // Create shortcuts map
      const shortcutsMap: { [key: string]: string } = {};
      shortcutData?.forEach(item => {
        shortcutsMap[item.brand_id] = item.shortform;
      });

      setShortcuts(shortcutsMap);
    } catch (error) {
      console.error('Error fetching shortcuts:', error);
    }
  };

  const handleBrandSearch = (value: string) => {
    setSearchQuery(value);
    if (value.trim()) {
      const searchTerm = value.toLowerCase();
      const filtered = brands.filter(brand => 
        brand.brand_name.toLowerCase().includes(searchTerm) ||
        brand.item_code.toLowerCase().includes(searchTerm) ||
        (shortcuts[brand.id] && shortcuts[brand.id].toLowerCase().includes(searchTerm))
      );
      console.log(`Search term "${searchTerm}" matched ${filtered.length} brands`);
      setFilteredBrands(filtered);
    } else {
      setFilteredBrands([]);
    }
  };

  const handleBrandSelect = (brand: Brand) => {
    // Single item selection flow
    const newSaleItems = [...saleItems];
    newSaleItems[selectedRowIndex] = {
      ...newSaleItems[selectedRowIndex],
      brand_id: brand.id,
      brand_name: brand.brand_name,
      item_code: brand.item_code,
      sizes: brand.sizes,
      mrp: brand.mrp,
      available_stock: brand.closing_qty
    };
    setSaleItems(newSaleItems);
    setShowBrandSearch(false);
    setSearchQuery('');
    setFilteredBrands([]);
    setSelectedBrands([]);
  };

  const toggleBrandSelection = (brand: Brand) => {
    setSelectedBrands(prev => {
      // Check if brand is already selected
      const isSelected = prev.some(item => item.id === brand.id);
      
      if (isSelected) {
        // Remove from selection
        return prev.filter(item => item.id !== brand.id);
      } else {
        // Add to selection with default quantity of 1
        return [...prev, {...brand, selectedQty: 1}];
      }
    });
  };

  const updateSelectedBrandQty = (brandId: number, qty: number) => {
    setSelectedBrands(prev => 
      prev.map(brand => {
        if (brand.id === brandId) {
          // Ensure qty is within allowed limits (min 1, max available stock)
          const newQty = Math.max(1, Math.min(qty, brand.closing_qty));
          return {...brand, selectedQty: newQty};
        }
        return brand;
      })
    );
  };

  const incrementQty = (brandId: number) => {
    setSelectedBrands(prev => 
      prev.map(brand => {
        if (brand.id === brandId && brand.selectedQty < brand.closing_qty) {
          return {...brand, selectedQty: brand.selectedQty + 1};
        }
        return brand;
      })
    );
  };

  const decrementQty = (brandId: number) => {
    setSelectedBrands(prev => 
      prev.map(brand => {
        if (brand.id === brandId && brand.selectedQty > 1) {
          return {...brand, selectedQty: brand.selectedQty - 1};
        }
        return brand;
      })
    );
  };

  const applyMultiSelection = () => {
    if (selectedBrands.length === 0) {
      toast.error('No brands selected');
      return;
    }

    // Create new sale items for each selected brand starting from the current row
    const newSaleItems = [...saleItems];
    
    // First update the current row with the first selected brand
    const firstBrand = selectedBrands[0];
    newSaleItems[selectedRowIndex] = {
      ...newSaleItems[selectedRowIndex],
      brand_id: firstBrand.id,
      brand_name: firstBrand.brand_name,
      item_code: firstBrand.item_code,
      sizes: firstBrand.sizes,
      mrp: firstBrand.mrp,
      available_stock: firstBrand.closing_qty,
      qty: firstBrand.selectedQty
    };
    
    // Then add the rest as new rows
    if (selectedBrands.length > 1) {
      const remainingBrands = selectedBrands.slice(1);
      const newRows = remainingBrands.map((brand, index) => ({
        sr_no: saleItems.length + index + 1,
        brand_id: brand.id,
        brand_name: brand.brand_name,
        item_code: brand.item_code,
        sizes: brand.sizes,
        mrp: brand.mrp,
        qty: brand.selectedQty,
        available_stock: brand.closing_qty
      }));
      
      setSaleItems([...newSaleItems, ...newRows]);
    } else {
      setSaleItems(newSaleItems);
    }
    
    // Close the modal and reset selections
    setShowBrandSearch(false);
    setSearchQuery('');
    setFilteredBrands([]);
    setSelectedBrands([]);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const currentBrands = searchQuery.trim() === '' ? brands : filteredBrands;
    
    if (currentBrands.length === 0) return;

    // Arrow down - move selection down
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedBrandIndex(prev => Math.min(prev + 1, currentBrands.length - 1));
      
      // Scroll into view if needed
      const selectedElement = document.getElementById(`brand-item-${selectedBrandIndex + 1}`);
      if (selectedElement && brandListRef.current) {
        if (selectedElement.offsetTop + selectedElement.clientHeight > 
            brandListRef.current.scrollTop + brandListRef.current.clientHeight) {
          brandListRef.current.scrollTop = selectedElement.offsetTop - brandListRef.current.clientHeight + selectedElement.clientHeight;
        }
      }
    }
    
    // Arrow up - move selection up
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedBrandIndex(prev => Math.max(prev - 1, 0));
      
      // Scroll into view if needed
      const selectedElement = document.getElementById(`brand-item-${selectedBrandIndex - 1}`);
      if (selectedElement && brandListRef.current) {
        if (selectedElement.offsetTop < brandListRef.current.scrollTop) {
          brandListRef.current.scrollTop = selectedElement.offsetTop;
        }
      }
    }
    
    // Enter - select the current item or toggle selection
    else if (e.key === 'Enter' && selectedBrandIndex >= 0 && selectedBrandIndex < currentBrands.length) {
      e.preventDefault();
      toggleBrandSelection(currentBrands[selectedBrandIndex]);
    }
    
    // Space - toggle selection for current item
    else if (e.key === ' ' && selectedBrandIndex >= 0 && selectedBrandIndex < currentBrands.length) {
      e.preventDefault();
      toggleBrandSelection(currentBrands[selectedBrandIndex]);
    }
    
    // Escape - close the modal
    else if (e.key === 'Escape') {
      e.preventDefault();
      setShowBrandSearch(false);
      setSearchQuery('');
      setFilteredBrands([]);
      setSelectedBrands([]);
    }
  };

  const handleQtyChange = (value: string, rowIndex: number) => {
    const newQty = parseInt(value) || 0;
    const item = saleItems[rowIndex];
    
    if (newQty > item.available_stock) {
      toast.error(`Cannot sell more than available stock (${item.available_stock})`);
      return;
    }

    const newSaleItems = [...saleItems];
    newSaleItems[rowIndex] = {
      ...newSaleItems[rowIndex],
      qty: newQty
    };
    setSaleItems(newSaleItems);
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIndex === saleItems.length - 1) {
        // Add new row
        setSaleItems([
          ...saleItems,
          {
            sr_no: saleItems.length + 1,
            brand_id: null,
            brand_name: '',
            item_code: '',
            sizes: '',
            mrp: 0,
            qty: 0,
            available_stock: 0
          }
        ]);
        setSelectedRowIndex(rowIndex + 1);
      } else {
        // Move to next row
        setSelectedRowIndex(rowIndex + 1);
      }
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      
      // Validate data
      const invalidItems = saleItems.filter(item => !item.brand_id || item.qty <= 0);
      if (invalidItems.length > 0) {
        toast.error('Please fill all required fields and ensure quantities are greater than 0');
        return;
      }

      // Get the current user's ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // If in edit mode, first delete existing sales for the date
      if (isEditMode) {
        const { error: deleteError } = await supabase
          .from('daily_sales')
          .delete()
          .eq('bar_id', selectedBar?.id)
          .eq('sale_date', saleDate);
        
        if (deleteError) throw deleteError;
      }

      // Save sale items
      const { error } = await supabase
        .from('daily_sales')
        .insert(
          saleItems.map(item => ({
            bar_id: selectedBar?.id,
            sale_date: saleDate,
            brand_id: item.brand_id,
            qty: item.qty,
            created_by: user.id,
            created_at: new Date().toISOString()
          }))
        );

      if (error) throw error;

      toast.success('Sales saved successfully');
      
      if (isEditMode) {
        // Return to the sales summary page after successful edit
        navigate('/sales/summary');
      } else {
        // Reset form for new entry
      setSaleItems([{ sr_no: 1, brand_id: null, brand_name: '', item_code: '', sizes: '', mrp: 0, qty: 0, available_stock: 0 }]);
      setSelectedRowIndex(0);
      // Refresh brands with updated stock
      fetchBrandsWithStock();
      }
    } catch (error: any) {
      toast.error('Failed to save sales');
      console.error('Error saving sales:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrandDoubleClick = (brand: Brand) => {
    // Single item selection on double-click with default qty of 1
    const newSaleItems = [...saleItems];
    newSaleItems[selectedRowIndex] = {
      ...newSaleItems[selectedRowIndex],
      brand_id: brand.id,
      brand_name: brand.brand_name,
      item_code: brand.item_code,
      sizes: brand.sizes,
      mrp: brand.mrp,
      available_stock: brand.closing_qty,
      qty: 1
    };
    setSaleItems(newSaleItems);
    setShowBrandSearch(false);
    setSearchQuery('');
    setFilteredBrands([]);
    setSelectedBrands([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {isEditMode ? 'Edit Sales Entry' : 'Daily Sales Entry'}
              </h1>
              <div className="mt-2 flex items-center text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center">
                  <span className="font-medium mr-2">Bar:</span>
                  <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full">
                    {selectedBar?.bar_name}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-full sm:w-auto">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sale Date
                </label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  disabled={isEditMode}
                  className={`w-full sm:w-auto px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white transition-colors ${
                    isEditMode ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                />
              </div>
              <div className="flex gap-3 sm:mt-6">
                {isEditMode && (
                  <button
                    onClick={() => navigate('/sales/summary')}
                    className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={isLoading || isFetchingExistingSales}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    'Save Sales'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isFetchingExistingSales && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 text-blue-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-gray-600 dark:text-gray-400">Loading existing sales data...</span>
            </div>
          </div>
        )}

        {/* Sales Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">
                    Sr. No
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Item Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Item Code
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    MRP
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                    Sale Qty
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {saleItems.map((item, index) => (
                  <tr 
                    key={item.sr_no}
                    className={`group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      selectedRowIndex === index ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">
                      {item.sr_no}
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => {
                          setSelectedRowIndex(index);
                          setShowBrandSearch(true);
                        }}
                        className="w-full text-left px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors group-hover:border-blue-500 dark:group-hover:border-blue-400"
                      >
                        {item.brand_name || 'Click to search brand...'}
                      </button>
                    </td>
                    <td className="px-6 py-3">
                      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">
                        {item.item_code || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">
                        {item.sizes || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">
                        ₹{item.mrp || '0'}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">
                        {item.available_stock}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) => handleQtyChange(e.target.value, index)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white transition-colors"
                        min="1"
                        max={item.available_stock}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Brand Search Modal */}
        {showBrandSearch && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl mx-4 overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    Search Brand
                    {selectedBrands.length > 0 && (
                      <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm rounded-full">
                        {selectedBrands.length} selected
                      </span>
                    )}
                  </h2>
                  <button
                    onClick={() => {
                      setShowBrandSearch(false);
                      setSearchQuery('');
                      setFilteredBrands([]);
                      setSelectedBrands([]);
                    }}
                    className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleBrandSearch(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white transition-colors"
                      placeholder="Search by brand name, code or shortcut..."
                    />
                  </div>
                </div>
              </div>

              {selectedBrands.length > 0 && (
                <div className="px-6 pt-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700/50">
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Selected Item
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Available
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Quantity
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">
                            
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {selectedBrands.map((brand) => (
                          <tr key={`selected-${brand.id}`} className="group">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {brand.brand_name}
                                {shortcuts[brand.id] && (
                                  <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                                    {shortcuts[brand.id]}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {brand.item_code} - {brand.sizes}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                              {brand.closing_qty}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center">
                                <button
                                  onClick={() => decrementQty(brand.id)}
                                  disabled={brand.selectedQty <= 1}
                                  className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <input
                                  ref={el => qtyInputRefs.current[brand.id] = el}
                                  type="number"
                                  min="1"
                                  max={brand.closing_qty}
                                  value={brand.selectedQty}
                                  onChange={(e) => updateSelectedBrandQty(brand.id, parseInt(e.target.value) || 1)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (brand.id === selectedBrands[selectedBrands.length - 1].id) {
                                        applyMultiSelection();
                                      } else {
                                        const currentIndex = selectedBrands.findIndex(b => b.id === brand.id);
                                        const nextBrand = selectedBrands[currentIndex + 1];
                                        if (nextBrand) {
                                          const nextInput = qtyInputRefs.current[nextBrand.id];
                                          if (nextInput) {
                                            nextInput.focus();
                                            nextInput.select();
                                          }
                                        }
                                      }
                                    }
                                  }}
                                  className="w-16 mx-2 text-center px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors"
                                />
                                <button
                                  onClick={() => incrementQty(brand.id)}
                                  disabled={brand.selectedQty >= brand.closing_qty}
                                  className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setSelectedBrands(prev => prev.filter(item => item.id !== brand.id))}
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="p-6">
                <div ref={brandListRef} className="max-h-96 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                  {(searchQuery.trim() === '' ? brands : filteredBrands).map((brand, index) => (
                    <div
                      id={`brand-item-${index}`}
                      key={brand.id}
                      onClick={() => toggleBrandSelection(brand)}
                      onDoubleClick={() => handleBrandDoubleClick(brand)}
                      className={`flex items-center w-full text-left px-4 py-3 cursor-pointer transition-colors ${
                        selectedBrandIndex === index 
                          ? 'bg-blue-50 dark:bg-blue-900/20' 
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className={`w-5 h-5 mr-3 flex-shrink-0 border rounded-md transition-colors ${
                        selectedBrands.some(item => item.id === brand.id)
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {selectedBrands.some(item => item.id === brand.id) && (
                          <Check className="w-4 h-4 m-0.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {brand.brand_name}
                          {shortcuts[brand.id] && (
                            <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                              {shortcuts[brand.id]}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {brand.item_code} - {brand.sizes} - ₹{brand.mrp}
                          <span className="ml-2 px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full text-xs">
                            Stock: {brand.closing_qty}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md">↑↓ Navigate</span>
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md">Space Select</span>
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md">Double-click Quick Add</span>
                    </div>
                  </div>
                  <div className="flex gap-3 self-end sm:self-auto">
                    <button 
                      onClick={() => setSelectedBrands([])}
                      className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                    >
                      Clear All
                    </button>
                    <button 
                      onClick={applyMultiSelection}
                      disabled={selectedBrands.length === 0}
                      className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center gap-2"
                    >
                      <span>Add Selected</span>
                      {selectedBrands.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-white/20 rounded-md text-xs">
                          {selectedBrands.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 