import { useState, useEffect } from 'react';
import { useBar } from '../../context/BarContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Calendar, Save, Loader2, Search, AlertCircle, Filter, ChevronLeft, ChevronRight, ListFilter, Download, Upload } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

interface Brand {
  id: number;
  brand_name: string;
  item_code: string;
  sizes: string;
  mrp: number;
  category: string;
}

interface OpeningStockItem {
  brand_id: number;
  brand_name: string;
  item_code: string;
  sizes: string;
  mrp: number;
  category: string;
  opening_qty: number;
  saved_qty?: number;
}

const CATEGORIES = ['Spirits', 'Wines', 'Fermented Beer', 'Mild Beer'];

interface ExcelRow {
  'Item Code': string;
  'Brand Name': string;
  'Size': string;
  'Category': string;
  'MRP': number;
  'Opening Quantity': number;
}

// Add new type for SCM-only import
interface SCMImportRow {
  'SCM Code': string;
  'Opening Quantity': number;
}

const ensureBarAccess = async (barId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user found');

    // Use upsert to handle both insert and update cases
    const { error: upsertError } = await supabase
      .from('bar_users')
      .upsert({
        bar_id: barId,
        user_id: user.id
      }, {
        onConflict: 'user_id,bar_id'
      });

    if (upsertError) throw upsertError;

    return true;
  } catch (error) {
    console.error('Error ensuring bar access:', error);
    return false;
  }
};

export default function OpeningStock() {
  const { selectedBar } = useBar();
  const [activeTab, setActiveTab] = useState<'add' | 'view'>('add');
  const [date, setDate] = useState<string>('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingBrands, setSavingBrands] = useState<{ [key: number]: boolean }>({});
  const [brands, setBrands] = useState<Brand[]>([]);
  const [openingStock, setOpeningStock] = useState<OpeningStockItem[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [filteredStock, setFilteredStock] = useState<OpeningStockItem[]>([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Add new state for saved opening stock
  const [savedOpeningStock, setSavedOpeningStock] = useState<OpeningStockItem[]>([]);
  const [filteredSavedStock, setFilteredSavedStock] = useState<OpeningStockItem[]>([]);
  const [importLoading, setImportLoading] = useState(false);

  // Add new state for filtered categories based on bar type
  const [availableCategories, setAvailableCategories] = useState<string[]>(CATEGORIES);

  // Update available categories when bar changes
  useEffect(() => {
    if (selectedBar) {
      if (selectedBar.license_category === 'beer_shop') {
        setAvailableCategories(CATEGORIES.filter(cat => cat !== 'Spirits'));
      } else {
        setAvailableCategories(CATEGORIES);
      }
    }
  }, [selectedBar]);

  useEffect(() => {
    if (selectedBar) {
      // Set the date to the bar's financial year start date
      setDate(format(new Date(selectedBar.financial_year_start), 'yyyy-MM-dd'));
      
      const initializeData = async () => {
        setInitialLoading(true);
        setLoadingProgress(0);
        
        const hasAccess = await ensureBarAccess(selectedBar.id.toString());
        if (!hasAccess) {
          toast.error('Failed to set up bar access');
          setInitialLoading(false);
          return;
        }

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

          // Calculate number of pages needed (1000 items per page - Supabase limit)
          const pageSize = 1000;
          const totalPages = Math.ceil(count / pageSize);
          let allBrands: Brand[] = [];

          // Show initial loading toast
          toast.loading(`Loading brands...`, { id: 'loading-brands' });

          // Fetch all brands in chunks
          for (let page = 0; page < totalPages; page++) {
            const from = page * pageSize;
            const to = from + pageSize - 1;

            const { data: brandsPage, error: brandsError } = await supabase
              .from('brands')
              .select('*')
              .range(from, to);

            if (brandsError) {
              toast.error(`Error loading brands`, { id: 'loading-brands' });
              throw brandsError;
            }

            if (brandsPage) {
              allBrands = [...allBrands, ...brandsPage];
              // Update progress
              const progress = Math.round(((page + 1) / totalPages) * 100);
              setLoadingProgress(progress);
            }
          }

          // Sort all brands by name
          allBrands.sort((a, b) => a.brand_name.localeCompare(b.brand_name));
          setBrands(allBrands);

          // Fetch opening stock data
          const { data: existingStock, error: stockError } = await supabase
            .from('opening_stock')
            .select('*')
            .eq('bar_id', selectedBar.id)
            .eq('financial_year_start', date);

          if (stockError) throw stockError;

          // Create a map of existing opening stock quantities
          const existingStockMap = new Map(
            existingStock?.map(item => [item.brand_id, item.opening_qty]) || []
          );

          // Create the opening stock array with saved quantities
          const stockItems = allBrands.map((brand) => ({
            brand_id: brand.id,
            brand_name: brand.brand_name,
            item_code: brand.item_code,
            sizes: brand.sizes,
            mrp: brand.mrp,
            category: brand.category,
            opening_qty: 0,
            saved_qty: existingStockMap.get(brand.id) || 0,
          }));

          // Filter items with saved quantities for the saved stock view
          const savedItems = stockItems.filter(item => item.saved_qty > 0);

          setOpeningStock(stockItems);
          setSavedOpeningStock(savedItems);
          toast.success('Successfully loaded all brands', { id: 'loading-brands' });

        } catch (error) {
          console.error('Error initializing data:', error);
          toast.error('Failed to load brands and opening stock');
        } finally {
          setInitialLoading(false);
        }
      };

      initializeData();
    }
  }, [selectedBar, date]);
  
  // Effect for filtering and pagination
  useEffect(() => {
    let result = [...openingStock];
    
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

    // Filter out spirits for beer shops
    if (selectedBar?.license_category === 'beer_shop') {
      result = result.filter(item => item.category !== 'Spirits');
    }
    
    // Update filtered stock
    setFilteredStock(result);
    
    // Calculate total pages
    setTotalPages(Math.ceil(result.length / itemsPerPage));
    
    // Reset to first page when filters change
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [openingStock, searchQuery, categoryFilter, itemsPerPage, selectedBar]);

  // Add effect for filtering saved stock
  useEffect(() => {
    let result = [...savedOpeningStock];
    
    if (searchQuery) {
      const lowercaseSearch = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.brand_name.toLowerCase().includes(lowercaseSearch) ||
        item.item_code.toLowerCase().includes(lowercaseSearch) ||
        item.sizes.toLowerCase().includes(lowercaseSearch)
      );
    }
    
    if (categoryFilter) {
      result = result.filter(item => item.category === categoryFilter);
    }
    
    setFilteredSavedStock(result);
    setTotalPages(Math.ceil(result.length / itemsPerPage));
    
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [savedOpeningStock, searchQuery, categoryFilter, itemsPerPage]);

  const handleOpeningQtyChange = (brandId: number, value: string) => {
    const newQty = parseInt(value) || 0;
    setOpeningStock((prev) =>
      prev.map((item) =>
        item.brand_id === brandId
          ? { ...item, opening_qty: newQty }
          : item
      )
    );
  };

  const handleSaveBrand = async (brandId?: number | React.MouseEvent<HTMLButtonElement>) => {
    if (!selectedBar || !date) return;

    // If brandId is provided, it's a single brand save
    // If not, it's a bulk save of all brands
    const isBulkSave = !brandId;

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

      setSaving(true);

      if (isBulkSave) {
        // Bulk save all brands
        const stockItems = openingStock.filter(item => item.opening_qty > 0);
        
        if (stockItems.length === 0) {
          toast.error('No opening quantities to save');
          return;
        }

        // Create array of opening stock records
        const openingStockRecords = stockItems.map(item => ({
          bar_id: selectedBar.id,
          brand_id: item.brand_id,
          financial_year_start: date,
          opening_qty: item.opening_qty,
          created_by: user.id
        }));

        // Bulk insert/update opening stock
        const { error: bulkError } = await supabase
          .from('opening_stock')
          .upsert(openingStockRecords, {
            onConflict: 'bar_id,brand_id,financial_year_start'
          });

        if (bulkError) throw bulkError;

        // Update the saved quantities in the state
        setOpeningStock(prev =>
          prev.map(item => ({
            ...item,
            saved_qty: item.opening_qty
          }))
        );

        toast.success(`Successfully saved opening stock for ${stockItems.length} brands`);
      } else {
        // Single brand save
        const actualBrandId = typeof brandId === 'number' ? brandId : Number((brandId as React.MouseEvent<HTMLButtonElement>).currentTarget.dataset.brandId);
        const stockItem = openingStock.find(item => item.brand_id === actualBrandId);
        if (!stockItem) return;

        setSavingBrands(prev => ({ ...prev, [actualBrandId]: true }));

        // Insert or update opening stock
        const { error: upsertError } = await supabase
          .from('opening_stock')
          .upsert({
            bar_id: selectedBar.id,
            brand_id: actualBrandId,
            financial_year_start: date,
            opening_qty: stockItem.opening_qty,
            created_by: user.id
          }, {
            onConflict: 'bar_id,brand_id,financial_year_start'
          });

        if (upsertError) throw upsertError;

        // Update the saved quantity in the state
        setOpeningStock(prev =>
          prev.map(item =>
            item.brand_id === actualBrandId
              ? { ...item, saved_qty: item.opening_qty }
              : item
          )
        );

        toast.success(`Saved opening stock for ${stockItem.brand_name}`);
      }
    } catch (error) {
      console.error('Error saving opening stock:', error);
      toast.error('Failed to save opening stock');
    } finally {
      setSaving(false);
      if (!isBulkSave) {
        const actualBrandId = typeof brandId === 'number' ? brandId : Number((brandId as React.MouseEvent<HTMLButtonElement>).currentTarget.dataset.brandId);
        setSavingBrands(prev => ({ ...prev, [actualBrandId]: false }));
      }
    }
  };

  // Check if the selected date is the bar's financial year start date
  const isStartDate = selectedBar && date === format(new Date(selectedBar.financial_year_start), 'yyyy-MM-dd');

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(parseInt(e.target.value));
  };
  
  // Get current items based on active tab
  const getCurrentItems = () => {
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return activeTab === 'add' 
      ? filteredStock.slice(indexOfFirstItem, indexOfLastItem)
      : filteredSavedStock.slice(indexOfFirstItem, indexOfLastItem);
  };

  // Add new function for downloading SCM template
  const downloadSCMTemplate = async () => {
    try {
      setImportLoading(true);
      
      // Create worksheet data with just SCM codes
      const wsData = brands.map(brand => ({
        'SCM Code': brand.item_code,
        'Opening Quantity': 0
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(wsData);

      // Add column widths
      const colWidths = [
        { wch: 15 }, // SCM Code
        { wch: 15 }  // Opening Quantity
      ];
      ws['!cols'] = colWidths;

      // Add the worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'SCM Opening Stock Template');

      // Generate file name with date
      const fileName = `scm_opening_stock_template_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;

      // Save the file
      XLSX.writeFile(wb, fileName);
      toast.success('SCM template downloaded successfully');
    } catch (error) {
      console.error('Error downloading SCM template:', error);
      toast.error('Failed to download SCM template');
    } finally {
      setImportLoading(false);
    }
  };

  // Add downloadTemplate function
  const downloadTemplate = async () => {
    try {
      setImportLoading(true);
      
      // Create worksheet data
      const wsData = brands.map(brand => ({
        'Item Code': brand.item_code,
        'Brand Name': brand.brand_name,
        'Size': brand.sizes,
        'Category': brand.category,
        'MRP': brand.mrp,
        'Opening Quantity': 0
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(wsData);

      // Add column widths
      const colWidths = [
        { wch: 15 }, // Item Code
        { wch: 40 }, // Brand Name
        { wch: 15 }, // Size
        { wch: 20 }, // Category
        { wch: 15 }, // MRP
        { wch: 15 }  // Opening Quantity
      ];
      ws['!cols'] = colWidths;

      // Add the worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Opening Stock Template');

      // Generate file name with date
      const fileName = `opening_stock_template_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;

      // Save the file
      XLSX.writeFile(wb, fileName);
      toast.success('Template downloaded successfully');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Failed to download template');
    } finally {
      setImportLoading(false);
    }
  };

  // Update handleFileImport to handle both full and SCM-only imports
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0]) return;
    
    try {
      setImportLoading(true);
      const file = event.target.files[0];
      
      // Show initial loading toast
      const loadingToast = toast.loading('Reading Excel file...', { id: 'import-status' });
      
      // Read the Excel file
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Check if it's a SCM-only import by looking for 'SCM Code' column
          const isSCMImport = worksheet['A1']?.v === 'SCM Code';
          
          let jsonData: ExcelRow[] | SCMImportRow[];
          if (isSCMImport) {
            jsonData = XLSX.utils.sheet_to_json<SCMImportRow>(worksheet);
          } else {
            jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);
          }

          // Update loading message
          toast.loading(`Processing ${jsonData.length} rows...`, { id: 'import-status' });

          // Validate and process the data
          const updatedStock = [...openingStock];
          const errors: string[] = [];
          let processedCount = 0;
          let skippedCount = 0;
          let invalidCount = 0;

          for (const row of jsonData) {
            let brand;
            let qty;

            if (isSCMImport) {
              const scmRow = row as SCMImportRow;
              brand = brands.find(b => b.item_code === scmRow['SCM Code']);
              qty = Number(scmRow['Opening Quantity']);
            } else {
              const fullRow = row as ExcelRow;
              brand = brands.find(b => b.item_code === fullRow['Item Code']);
              qty = Number(fullRow['Opening Quantity']);
            }

            if (brand) {
              if (isNaN(qty) || qty < 0) {
                errors.push(`Invalid quantity for ${brand.brand_name} (${brand.item_code})`);
                invalidCount++;
                continue;
              }

              const stockIndex = updatedStock.findIndex(s => s.brand_id === brand.id);
              if (stockIndex !== -1) {
                updatedStock[stockIndex].opening_qty = qty;
                processedCount++;
              } else {
                skippedCount++;
              }
            } else {
              errors.push(`Brand not found: ${isSCMImport ? (row as SCMImportRow)['SCM Code'] : (row as ExcelRow)['Item Code']}`);
              skippedCount++;
            }
          }

          // Update state with new quantities
          setOpeningStock(updatedStock);

          // Show detailed status
          const statusMessage = (
            <div className="flex flex-col gap-2">
              <div className="font-medium">Import Status:</div>
              <div className="text-sm">
                <div className="text-green-600">✓ Successfully processed: {processedCount}</div>
                <div className="text-yellow-600">⚠ Skipped/Not found: {skippedCount}</div>
                <div className="text-red-600">✗ Invalid quantities: {invalidCount}</div>
              </div>
              {errors.length > 0 && (
                <div className="mt-2">
                  <div className="text-sm font-medium text-red-600">Errors ({errors.length}):</div>
                  <div className="text-xs text-red-500 max-h-32 overflow-y-auto">
                    {errors.map((error, index) => (
                      <div key={index}>{error}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );

          if (processedCount > 0) {
            toast.success(statusMessage, { 
              id: 'import-status',
              duration: 5000 
            });
          } else {
            toast.error(statusMessage, { 
              id: 'import-status',
              duration: 5000 
            });
          }

        } catch (error) {
          console.error('Error processing file:', error);
          toast.error('Failed to process Excel file', { id: 'import-status' });
        }
      };

      reader.onerror = () => {
        toast.error('Failed to read file', { id: 'import-status' });
      };

      reader.readAsBinaryString(file);
    } catch (error) {
      console.error('Error importing file:', error);
      toast.error('Failed to import file', { id: 'import-status' });
    } finally {
      setImportLoading(false);
      // Reset file input
      event.target.value = '';
    }
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
              <div className="text-lg font-semibold text-gray-700 dark:text-gray-200">Loading Brands</div>
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
                Please wait while we load all brands and opening stock data...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Opening Stock</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage opening stock for the financial year</p>
      </div>

          <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setActiveTab('add')}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'add'
                  ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Add Opening Stock
        </button>
        <button
          onClick={() => setActiveTab('view')}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'view'
                  ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          View Opening Stock
        </button>
          </div>
      </div>

        {/* Show date selection, warning, and import/export buttons in Add tab */}
      {activeTab === 'add' && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Financial Year Start Date
                </label>
                <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                    className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg w-full pl-10 p-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
              </div>
              
              {/* Import/Export Buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={downloadTemplate}
                  disabled={importLoading || loading || !isStartDate}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    importLoading || loading || !isStartDate
                      ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30'
                  }`}
                >
                  <Download className="h-4 w-4" />
                  <span>Download Full Template</span>
                </button>

                <button
                  onClick={downloadSCMTemplate}
                  disabled={importLoading || loading || !isStartDate}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    importLoading || loading || !isStartDate
                      ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30'
                  }`}
                >
                  <Download className="h-4 w-4" />
                  <span>Download SCM Template</span>
                </button>

                <label className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  importLoading || loading || !isStartDate
                    ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 cursor-pointer'
                }`}>
                  <Upload className="h-4 w-4" />
                  <span>Import Excel</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileImport}
                    disabled={importLoading || loading || !isStartDate}
                    className="hidden"
                  />
                </label>

            <button
              onClick={() => handleSaveBrand()}
              disabled={saving || loading || !isStartDate}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-white transition-all duration-200 ${
                saving || loading || !isStartDate
                  ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
              }`}
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              <span>Save All Opening Stock</span>
            </button>
              </div>
          </div>
          
          {!isStartDate && (
              <div className="mt-4 flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-200">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Warning</p>
                  <p className="text-sm mt-1">
                  Opening stock can only be added on the bar's financial year start date ({format(new Date(selectedBar.financial_year_start), 'dd/MM/yyyy')}).
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search and Filter Controls */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Brands
              </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
                  placeholder="Search by name, code, or size..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg pl-10 py-2.5 w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
            />
              </div>
          </div>
          
          {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Filter by Category
              </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <ListFilter className="h-4 w-4 text-gray-400" />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg pl-10 py-2.5 w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white appearance-none"
            >
              <option value="">All Categories</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
              </div>
          </div>
          
          {/* Items Per Page */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Items Per Page
              </label>
            <select
              value={itemsPerPage}
              onChange={handleItemsPerPageChange}
                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
              >
                <option value={5}>5 items</option>
                <option value={10}>10 items</option>
                <option value={25}>25 items</option>
                <option value={50}>50 items</option>
                <option value={100}>100 items</option>
            </select>
            </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
          <div className="flex flex-col items-center justify-center min-h-[400px] bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading brands...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && (activeTab === 'add' ? filteredStock : filteredSavedStock).length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <div className="flex flex-col items-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">
            {activeTab === 'add'
              ? openingStock.length === 0
                ? "No brands available for opening stock."
                : "No brands match your search criteria."
              : savedOpeningStock.length === 0
                ? "No brands have saved opening stock."
                : "No saved opening stock matches your search criteria."}
          </p>
          {((activeTab === 'add' && openingStock.length > 0 && filteredStock.length === 0) ||
            (activeTab === 'view' && savedOpeningStock.length > 0 && filteredSavedStock.length === 0)) && (
            <button
              onClick={() => { setSearchQuery(''); setCategoryFilter(''); }}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              Clear filters
            </button>
          )}
            </div>
        </div>
      )}

      {/* Add warning message for beer shops */}
      {selectedBar?.license_category === 'beer_shop' && (
        <div className="mt-4 flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Beer Shop Restrictions</p>
            <p className="text-sm mt-1">
              Spirits category items are not available for beer shops. Only beer and wine items can be added to opening stock.
            </p>
          </div>
        </div>
      )}

      {/* Stock Table */}
      {!loading && (activeTab === 'add' ? filteredStock : filteredSavedStock).length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
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
                    MRP
                  </th>
                  {activeTab === 'add' ? (
                    <>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Opening Qty
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Saved Qty
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </>
                  ) : (
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Opening Qty
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {getCurrentItems().map((item) => (
                    <tr key={item.brand_id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      selectedBar?.license_category === 'beer_shop' && item.category === 'Spirits' ? 'opacity-50' : ''
                    }`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {item.item_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {item.brand_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {item.sizes}
                    </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium 
                          ${item.category === 'Spirits' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' : ''}
                          ${item.category === 'Wines' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' : ''}
                          ${item.category === 'Fermented Beer' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' : ''}
                          ${item.category === 'Mild Beer' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : ''}
                      `}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ₹{item.mrp.toFixed(2)}
                    </td>
                    {activeTab === 'add' ? (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            min="0"
                            value={item.opening_qty}
                            onChange={(e) => handleOpeningQtyChange(item.brand_id, e.target.value)}
                            disabled={!isStartDate || saving || savingBrands[item.brand_id] || 
                              (selectedBar?.license_category === 'beer_shop' && item.category === 'Spirits')}
                              className={`w-28 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 px-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                              !isStartDate || saving || savingBrands[item.brand_id] || 
                              (selectedBar?.license_category === 'beer_shop' && item.category === 'Spirits') 
                                ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {item.saved_qty || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={handleSaveBrand}
                            data-brand-id={item.brand_id}
                            disabled={!isStartDate || saving || savingBrands[item.brand_id] || 
                              item.opening_qty === item.saved_qty || 
                              (selectedBar?.license_category === 'beer_shop' && item.category === 'Spirits')}
                              className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                              !isStartDate || saving || savingBrands[item.brand_id] || 
                              item.opening_qty === item.saved_qty || 
                              (selectedBar?.license_category === 'beer_shop' && item.category === 'Spirits')
                                ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                                : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 shadow-sm hover:shadow'
                            }`}
                          >
                            {savingBrands[item.brand_id] ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Save className="h-4 w-4 mr-2" />
                            )}
                            <span>Save</span>
                          </button>
                        </td>
                      </>
                    ) : (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {item.saved_qty}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, (activeTab === 'add' ? filteredStock : filteredSavedStock).length)}</span> to{' '}
              <span className="font-medium">{Math.min(currentPage * itemsPerPage, (activeTab === 'add' ? filteredStock : filteredSavedStock).length)}</span> of{' '}
              <span className="font-medium">{(activeTab === 'add' ? filteredStock : filteredSavedStock).length}</span> brands
            </div>
                <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-lg transition-all duration-200 ${
                  currentPage === 1
                        ? 'bg-gray-100 text-gray-400 dark:bg-gray-600 dark:text-gray-500 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 shadow-sm hover:shadow'
                    }`}
              >
                    <ChevronLeft className="w-5 h-5" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                        className={`px-4 py-1 rounded-lg transition-all duration-200 ${
                      currentPage === pageNum
                            ? 'bg-blue-600 text-white shadow'
                            : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 shadow-sm hover:shadow'
                        }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-lg transition-all duration-200 ${
                  currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 dark:bg-gray-600 dark:text-gray-500 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 shadow-sm hover:shadow'
                }`}
              >
                    <ChevronRight className="w-5 h-5" />
              </button>
                </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
