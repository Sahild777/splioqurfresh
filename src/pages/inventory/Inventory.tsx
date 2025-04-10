import { useState, useEffect, useCallback } from 'react';
import { useBar } from '../../context/BarContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Calendar, Save, Loader2, Play, Search, Filter, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { format, addDays, isBefore, parseISO, subDays } from 'date-fns';
import InventoryHistoryModal from '../../components/InventoryHistoryModal';

interface Brand {
  id: number;
  brand_name: string;
  item_code: string;
  sizes: string;
  mrp: number;
  category: string;
}

type TPItem = {
  brand_id: number;
  qty: number;
  transport_permits: {
    bar_id: string;
    tp_date: string;
  };
};

type DailySale = {
  brand_id: number;
  qty: number;
};

interface InventoryItem {
  id?: number;
  brand_id: number;
  brand_name: string;
  item_code: string;
  sizes: string;
  mrp: number;
  category: string;
  opening_qty: number;
  receipt_qty: number;
  sale_qty: number;
  closing_qty: number;
}

export default function Inventory() {
  const { selectedBar } = useBar();
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [autoSaving, setAutoSaving] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [displayedInventory, setDisplayedInventory] = useState<InventoryItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showZeroStock, setShowZeroStock] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [historyModal, setHistoryModal] = useState<{
    isOpen: boolean;
    brandId: number | null;
    brandName: string;
  }>({
    isOpen: false,
    brandId: null,
    brandName: '',
  });

  const initializeData = useCallback(async () => {
    if (!selectedBar || !date) return;
    
    setInitialLoading(true);
    setLoadingProgress(0);
    
    try {
      // First get the total count of brands
      const { count, error: countError } = await supabase
        .from('brands')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;
      if (!count) {
        toast.error('No brands found');
        setInitialLoading(false);
        return;
      }

      // Show initial loading toast
      toast.loading('Loading inventory data...', { id: 'loading-inventory' });
      setLoadingProgress(10);

      // Calculate previous day's date
      const previousDay = format(addDays(new Date(date), -1), 'yyyy-MM-dd');

      // Fetch previous day's inventory to get closing quantities
      const { data: previousInventory, error: previousError } = await supabase
        .from('inventory')
        .select('brand_id, closing_qty')
        .eq('bar_id', selectedBar.id)
        .eq('date', previousDay);

      if (previousError && previousError.code !== 'PGRST116') {
        throw previousError;
      }

      setLoadingProgress(30);

      // Create a map of previous day's closing quantities
      const previousClosingQtys = new Map(
        (previousInventory || []).map(item => [item.brand_id, item.closing_qty])
      );

      // Fetch TP entries and daily sales for the current date
      const [receiptQtys, saleQtys] = await Promise.all([
        fetchTPEntries(date),
        fetchDailySales(date)
      ]);

      setLoadingProgress(50);

      // Get all brand IDs that have activity
      const activeBrandIds = new Set([
        ...(previousInventory || []).map(item => item.brand_id),
        ...Array.from(receiptQtys.keys()),
        ...Array.from(saleQtys.keys())
      ]);

      // Fetch existing inventory for the selected date
      const { data: existingInventory, error: inventoryError } = await supabase
        .from('inventory')
        .select(`
          *,
          brands (
            brand_name,
            item_code,
            sizes,
            mrp,
            category
          )
        `)
        .eq('bar_id', selectedBar.id)
        .eq('date', date);

      if (inventoryError) throw inventoryError;

      setLoadingProgress(70);

      // Process inventory data
      if (existingInventory && existingInventory.length > 0) {
        const updatedInventory = existingInventory.map((item) => {
          const receipt_qty = receiptQtys.get(item.brand_id) || 0;
          const sale_qty = saleQtys.get(item.brand_id) || 0;
          return {
            id: item.id,
            brand_id: item.brand_id,
            brand_name: item.brands.brand_name,
            item_code: item.brands.item_code,
            sizes: item.brands.sizes,
            mrp: item.brands.mrp,
            category: item.brands.category,
            opening_qty: item.opening_qty,
            receipt_qty,
            sale_qty,
            closing_qty: item.opening_qty + receipt_qty - sale_qty,
          };
        });

        // Fetch brands that have TP entries but no existing inventory
        const newBrandIds = Array.from(receiptQtys.keys()).filter(
          brandId => !existingInventory.some(item => item.brand_id === brandId)
        );

        setLoadingProgress(85);

        if (newBrandIds.length > 0) {
          const { data: newBrands } = await supabase
            .from('brands')
            .select('*')
            .in('id', newBrandIds);

          if (newBrands) {
            const newInventoryItems = newBrands.map(brand => ({
              brand_id: brand.id,
              brand_name: brand.brand_name,
              item_code: brand.item_code,
              sizes: brand.sizes,
              mrp: brand.mrp,
              category: brand.category,
              opening_qty: previousClosingQtys.get(brand.id) || 0,
              receipt_qty: receiptQtys.get(brand.id) || 0,
              sale_qty: saleQtys.get(brand.id) || 0,
              closing_qty: (previousClosingQtys.get(brand.id) || 0) + (receiptQtys.get(brand.id) || 0) - (saleQtys.get(brand.id) || 0)
            }));

            setInventory([...updatedInventory, ...newInventoryItems]);
          }
        } else {
          setInventory(updatedInventory);
        }
      } else {
        // Fetch all brands that have activity
        const { data: activeBrands } = await supabase
          .from('brands')
          .select('*')
          .in('id', Array.from(activeBrandIds));

        setLoadingProgress(95);

        if (activeBrands) {
          const newInventory = activeBrands.map(brand => ({
            brand_id: brand.id,
            brand_name: brand.brand_name,
            item_code: brand.item_code,
            sizes: brand.sizes,
            mrp: brand.mrp,
            category: brand.category,
            opening_qty: previousClosingQtys.get(brand.id) || 0,
            receipt_qty: receiptQtys.get(brand.id) || 0,
            sale_qty: saleQtys.get(brand.id) || 0,
            closing_qty: (previousClosingQtys.get(brand.id) || 0) + (receiptQtys.get(brand.id) || 0) - (saleQtys.get(brand.id) || 0)
          }));

          setInventory(newInventory);
        }
      }

      setLoadingProgress(100);
      toast.success('Successfully loaded inventory data', { id: 'loading-inventory' });

    } catch (error) {
      console.error('Error initializing inventory:', error);
      toast.error('Failed to load inventory data');
    } finally {
      setInitialLoading(false);
    }
  }, [selectedBar, date]);

  useEffect(() => {
    if (selectedBar) {
      initializeData();
    }
  }, [selectedBar, date, initializeData]);

  // Effect for filtering and pagination
  useEffect(() => {
    let result = [...inventory];
    
    // Filter out zero stock items if needed
    if (!showZeroStock) {
      result = result.filter(item => 
        item.opening_qty > 0 || item.receipt_qty > 0 || item.closing_qty > 0
      );
    }
    
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
    
    // Update displayed inventory
    setDisplayedInventory(result);
    
    // Calculate total pages
    setTotalPages(Math.ceil(result.length / itemsPerPage));
    
    // Reset to first page when filters change
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [inventory, searchQuery, categoryFilter, showZeroStock, itemsPerPage]);

  // Add debounced auto-save
  useEffect(() => {
    if (!selectedBar || !date || loading) return;

    const saveTimeout = setTimeout(async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('User not authenticated');
          return;
        }

        // Check user access
        const { data: barAccess, error: accessError } = await supabase
          .from('bar_users')
          .select('id')
          .eq('bar_id', selectedBar.id)
          .eq('user_id', user.id)
          .single();

        if (accessError || !barAccess) {
          console.error('No bar access');
          return;
        }

        // Delete existing inventory for the date
        await supabase
          .from('inventory')
          .delete()
          .eq('bar_id', selectedBar.id)
          .eq('date', date);

        // Insert new inventory entries
        await supabase.from('inventory').insert(
          inventory.map((item) => ({
            bar_id: selectedBar.id,
            brand_id: item.brand_id,
            date,
            opening_qty: item.opening_qty,
            receipt_qty: item.receipt_qty,
            sale_qty: item.sale_qty,
            closing_qty: item.closing_qty,
            created_by: user.id
          }))
        );

        // Calculate next day's date
        const nextDay = format(addDays(new Date(date), 1), 'yyyy-MM-dd');

        // Create next day's inventory entries
        const nextDayInventory = inventory.map(item => ({
          bar_id: selectedBar.id,
          brand_id: item.brand_id,
          date: nextDay,
          opening_qty: item.closing_qty,
          receipt_qty: 0,
          sale_qty: 0,
          closing_qty: item.closing_qty,
          created_by: user.id
        }));

        // Delete any existing next day inventory
        await supabase
          .from('inventory')
          .delete()
          .eq('bar_id', selectedBar.id)
          .eq('date', nextDay);

        // Insert next day's inventory entries
        await supabase
          .from('inventory')
          .insert(nextDayInventory);

      } catch (error) {
        console.error('Error auto-saving inventory:', error);
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(saveTimeout);
  }, [inventory, selectedBar, date]);

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('brand_name');

      if (error) throw error;
      setBrands(data || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
      toast.error('Failed to fetch brands');
    }
  };

  const fetchTPEntries = async (date: string) => {
    try {
      const { data, error } = await supabase
        .from('tp_items')
        .select(`
          brand_id,
          qty,
          bar_id,
          transport_permits (
            tp_date
          )
        `)
        .eq('bar_id', selectedBar?.id)
        .eq('transport_permits.tp_date', date);

      if (error) throw error;

      // Sum up quantities for each brand
      const receiptQtys = new Map<number, number>();
      data?.forEach(entry => {
        if (entry.transport_permits) {
          const current = receiptQtys.get(entry.brand_id) || 0;
          receiptQtys.set(entry.brand_id, current + entry.qty);
        }
      });

      console.log('Fetched TP entries for date:', date, 'Data:', data, 'Mapped quantities:', Object.fromEntries(receiptQtys));
      return receiptQtys;
    } catch (error) {
      console.error('Error fetching TP entries:', error);
      toast.error('Failed to fetch TP entries');
      return new Map<number, number>();
    }
  };

  const fetchDailySales = async (date: string) => {
    try {
      const { data, error } = await supabase
        .from('daily_sales')
        .select('brand_id, qty')
        .eq('bar_id', selectedBar?.id)
        .eq('sale_date', date);

      if (error) throw error;

      // Sum up quantities for each brand
      const saleQtys = new Map<number, number>();
      (data as DailySale[])?.forEach(sale => {
        const current = saleQtys.get(sale.brand_id) || 0;
        saleQtys.set(sale.brand_id, current + sale.qty);
      });

      return saleQtys;
    } catch (error) {
      console.error('Error fetching daily sales:', error);
      toast.error('Failed to fetch daily sales');
      return new Map<number, number>();
    }
  };

  const autoSaveInventory = async () => {
    if (!selectedBar || !date) return;

    setAutoSaving(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('User not authenticated');
        return;
      }

      // Check user access
      const { data: barAccess, error: accessError } = await supabase
        .from('bar_users')
        .select('id')
        .eq('bar_id', selectedBar.id)
        .eq('user_id', user.id)
        .single();

      if (accessError || !barAccess) {
        toast.error('You do not have access to this bar');
        return;
      }

      const startDate = parseISO(date);
      const currentDate = new Date();

      // Get all unique brand IDs that have any activity
      const { data: activeBrands, error: activeBrandsError } = await supabase
        .from('inventory')
        .select('brand_id')
        .eq('bar_id', selectedBar.id)
        .not('closing_qty', 'eq', 0);

      if (activeBrandsError) throw activeBrandsError;

      const activeBrandIds = new Set(activeBrands?.map(item => item.brand_id) || []);

      // If no active brands, stop here
      if (activeBrandIds.size === 0) {
        toast.success('No active inventory items to update');
        return;
      }

      let currentDateToProcess = startDate;
      while (isBefore(currentDateToProcess, currentDate)) {
        const currentDateStr = format(currentDateToProcess, 'yyyy-MM-dd');
        const previousDay = format(addDays(currentDateToProcess, -1), 'yyyy-MM-dd');

        // Fetch previous day's inventory for active brands
        const { data: previousInventory, error: previousError } = await supabase
          .from('inventory')
          .select('brand_id, closing_qty')
          .eq('bar_id', selectedBar.id)
          .eq('date', previousDay)
          .in('brand_id', Array.from(activeBrandIds));

        if (previousError && previousError.code !== 'PGRST116') {
          throw previousError;
        }

        // Create a map of previous day's closing quantities
        const previousClosingQtys = new Map(
          (previousInventory || []).map(item => [item.brand_id, item.closing_qty])
        );

        // Fetch TP entries and daily sales for active brands
        const [receiptQtys, saleQtys] = await Promise.all([
          fetchTPEntries(currentDateStr),
          fetchDailySales(currentDateStr)
        ]);

        // Prepare inventory entries for active brands
        const inventoryEntries = Array.from(activeBrandIds).map(brandId => {
          const opening_qty = previousClosingQtys.get(brandId) || 0;
          const receipt_qty = receiptQtys.get(brandId) || 0;
          const sale_qty = saleQtys.get(brandId) || 0;
          return {
          bar_id: selectedBar.id,
            brand_id: brandId,
          date: currentDateStr,
            opening_qty,
            receipt_qty,
            sale_qty,
            closing_qty: opening_qty + receipt_qty - sale_qty,
          created_by: user.id
          };
        });

        // Upsert inventory entries
        const { error: upsertError } = await supabase
          .from('inventory')
          .upsert(inventoryEntries, {
            onConflict: 'bar_id,brand_id,date'
          });

        if (upsertError) throw upsertError;

        // Move to next day
        currentDateToProcess = addDays(currentDateToProcess, 1);
      }

      toast.success('Inventory auto-filled successfully');
      await initializeData();
    } catch (error) {
      console.error('Error auto-saving inventory:', error);
      toast.error('Failed to auto-save inventory');
    } finally {
      setAutoSaving(false);
    }
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
    return displayedInventory.slice(indexOfFirstItem, indexOfLastItem);
  };
  
  const toggleShowZeroStock = () => {
    setShowZeroStock(prev => !prev);
  };

  // Update input handlers
  const handleQtyChange = async (brandId: number, field: 'receipt_qty' | 'sale_qty' | 'opening_qty', value: string) => {
    if (!selectedBar) return;

    const qty = parseInt(value) || 0;
    setLoading(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated');
        return;
      }

      const startDate = parseISO(date);
      const currentDate = new Date();
      let currentDateToProcess = startDate;

      // Get the brand details
      const brand = inventory.find(item => item.brand_id === brandId);
      if (!brand) return;

      // Update the current day's inventory first
      let updatedInventory = inventory.map(item => 
        item.brand_id === brandId 
          ? { 
              ...item, 
              [field]: qty,
              closing_qty: calculateClosingQty(item, field, qty)
            } 
          : item
      );
      setInventory(updatedInventory);

      // Get the updated brand data
      const updatedBrand = updatedInventory.find(item => item.brand_id === brandId);
      if (!updatedBrand) return;

      // Initialize with the current day's values
      let currentOpeningQty = updatedBrand.opening_qty;
      let currentClosingQty = updatedBrand.closing_qty;
      let hasError = false;

      // Process updates in batches of 30 days
      const batchSize = 30;
      let processedDates = 0;

      // First, update the selected date
      const { error: initialError } = await supabase
        .from('inventory')
        .upsert({
          bar_id: selectedBar.id,
          brand_id: brandId,
          date: format(currentDateToProcess, 'yyyy-MM-dd'),
          opening_qty: currentOpeningQty,
          receipt_qty: updatedBrand.receipt_qty,
          sale_qty: updatedBrand.sale_qty,
          closing_qty: currentClosingQty,
          created_by: user.id
        }, {
          onConflict: 'bar_id,brand_id,date'
        });

      if (initialError) {
        console.error('Error updating initial inventory:', initialError);
        hasError = true;
      }

      // Move to next day for future updates
      currentDateToProcess = addDays(currentDateToProcess, 1);
      currentOpeningQty = currentClosingQty;

      // Update all future dates until current date
      while (isBefore(currentDateToProcess, currentDate) && !hasError) {
        const batchUpdates = [];
        let batchEndDate = currentDateToProcess;

        // Process a batch of dates
        for (let i = 0; i < batchSize && isBefore(batchEndDate, currentDate); i++) {
          const currentDateStr = format(batchEndDate, 'yyyy-MM-dd');
          
          // Fetch TP entries and daily sales for this brand on current date
          const [receiptQtys, saleQtys] = await Promise.all([
            fetchTPEntries(currentDateStr),
            fetchDailySales(currentDateStr)
          ]);

          const receipt_qty = receiptQtys.get(brandId) || 0;
          const sale_qty = saleQtys.get(brandId) || 0;
          const closing_qty = currentOpeningQty + receipt_qty - sale_qty;

          console.log(`Updating ${brand.brand_name} for ${currentDateStr}:`, {
            opening: currentOpeningQty,
            receipt: receipt_qty,
            sale: sale_qty,
            closing: closing_qty
          });

          // Add to batch updates
          batchUpdates.push({
            bar_id: selectedBar.id,
            brand_id: brandId,
            date: currentDateStr,
            opening_qty: currentOpeningQty,
            receipt_qty,
            sale_qty,
            closing_qty,
            created_by: user.id
          });

          // Set next day's opening qty to today's closing qty
          currentOpeningQty = closing_qty;
          batchEndDate = addDays(batchEndDate, 1);
          processedDates++;
        }

        // Upsert batch of inventory entries
        if (batchUpdates.length > 0) {
          const { error: batchError } = await supabase
            .from('inventory')
            .upsert(batchUpdates, {
              onConflict: 'bar_id,brand_id,date'
            });

          if (batchError) {
            console.error(`Error updating inventory batch:`, batchError);
            hasError = true;
            break;
          }
        }

        // Update currentDateToProcess for next batch
        currentDateToProcess = batchEndDate;

        // Show progress
        toast.success(`Updated ${processedDates} days of inventory for ${brand.brand_name}`, {
          duration: 2000
        });
      }

      // Also update the current date with the final opening quantity
      if (!hasError) {
        const currentDateStr = format(currentDate, 'yyyy-MM-dd');
        await supabase
          .from('inventory')
          .upsert({
            bar_id: selectedBar.id,
            brand_id: brandId,
            date: currentDateStr,
            opening_qty: currentOpeningQty,
            receipt_qty: 0,
            sale_qty: 0,
            closing_qty: currentOpeningQty,
            created_by: user.id
          }, {
            onConflict: 'bar_id,brand_id,date'
          });
      }

      // Refresh the inventory display
      await initializeData();

      if (!hasError) {
        toast.success(`Completed inventory update for ${brand.brand_name}`);
      }
    } catch (error) {
      console.error('Error updating inventory:', error);
      toast.error('Failed to update inventory');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to calculate closing quantity
  const calculateClosingQty = (
    item: InventoryItem, 
    field: 'receipt_qty' | 'sale_qty' | 'opening_qty', 
    newValue: number
  ): number => {
    switch (field) {
      case 'opening_qty':
        return newValue + item.receipt_qty - item.sale_qty;
      case 'receipt_qty':
        return item.opening_qty + newValue - item.sale_qty;
      case 'sale_qty':
        return item.opening_qty + item.receipt_qty - newValue;
      default:
        return item.closing_qty;
    }
  };

  const handleShowHistory = (brandId: number, brandName: string) => {
    setHistoryModal({
      isOpen: true,
      brandId,
      brandName,
    });
  };

  if (!selectedBar) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Please select a bar first</p>
      </div>
    );
  }

  if (initialLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold text-gray-700 dark:text-gray-200">Loading Inventory</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{loadingProgress}%</div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-6">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please wait while we load your inventory data...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Inventory Management</h1>
        <p className="text-gray-600 dark:text-gray-400">Track and manage your stock levels</p>
      </div>

      {/* Date Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative w-full md:w-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-5 w-5 text-gray-400" />
        </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg w-full md:w-auto pl-10 p-2.5 text-gray-900 dark:text-white"
            />
          </div>
          
          <div className="flex gap-3">
          <button
            onClick={autoSaveInventory}
              disabled={autoSaving || loading}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white ${
                autoSaving || loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
          >
            {autoSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span>Auto-Fill</span>
            </button>
          </div>
        </div>
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
          
          {/* Show Zero Stock Toggle */}
          <div>
            <button
              onClick={toggleShowZeroStock}
              className={`flex items-center justify-between w-full px-4 py-2 rounded-lg border ${
                showZeroStock 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="flex items-center gap-2">
                {showZeroStock ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                <span>{showZeroStock ? 'Showing All Stock' : 'Hiding Zero Stock'}</span>
              </span>
          </button>
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
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center min-h-[200px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Empty State */}
      {!loading && displayedInventory.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {inventory.length === 0
              ? "No inventory found for the selected date."
              : "No items match your current filters."}
          </p>
          {inventory.length > 0 && displayedInventory.length === 0 && (
            <div className="flex justify-center">
              <button
                onClick={() => { 
                  setSearchQuery(''); 
                  setCategoryFilter(''); 
                  setShowZeroStock(true);
                }}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Clear filters or show zero stock items
              </button>
            </div>
          )}
        </div>
      )}

      {/* Inventory Table */}
      {!loading && displayedInventory.length > 0 && (
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
                    Opening
                </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Receipt (TP)
                </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Sale
                </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Closing
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        min="0"
                        value={item.opening_qty}
                        onChange={(e) => handleQtyChange(item.brand_id, 'opening_qty', e.target.value)}
                        className="w-24 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 py-2 px-3 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {item.receipt_qty}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {item.sale_qty}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <span className={`${item.closing_qty < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {item.closing_qty}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, displayedInventory.length)}</span> to{' '}
              <span className="font-medium">{Math.min(currentPage * itemsPerPage, displayedInventory.length)}</span> of{' '}
              <span className="font-medium">{displayedInventory.length}</span> items
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
        startDate={format(subDays(new Date(date), 30), 'yyyy-MM-dd')}
        endDate={date}
      />
    </div>
  );
} 