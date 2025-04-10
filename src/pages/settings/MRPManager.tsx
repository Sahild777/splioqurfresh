import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useBar } from '../../context/BarContext';
import { toast } from 'react-hot-toast';
import { Package, Tags, History, Plus, X, Loader2, Search, ChevronLeft, ChevronRight, Calendar, Download, Upload, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Brand {
  id: number;
  brand_name: string;
  category: string;
  sizes: string;
  mrp: number | null;
}

interface PriceHistory {
  id: number;
  brand_id: number;
  mrp: number;
  created_at: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export default function MRPManager() {
  const { selectedBar } = useBar();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBrand, setEditingBrand] = useState<number | null>(null);
  const [newMRP, setNewMRP] = useState<string>('');
  
  // Price history modal state
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Bulk import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // Fetch brands with pagination and filters
  const fetchBrands = async () => {
    try {
      setLoading(true);
      
      // Build the query
      let query = supabase
        .from('brands')
        .select('id, brand_name, category, sizes, mrp', { count: 'exact' });
      
      // Apply search filter if search term exists
      if (searchTerm) {
        query = query.or(`brand_name.ilike.%${searchTerm}%,sizes.ilike.%${searchTerm}%`);
      }
      
      // Apply category filter if selected
      if (categoryFilter) {
        query = query.eq('category', categoryFilter);
      }
      
      // Apply pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to).order('brand_name');
      
      // Execute the query
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      setBrands(data || []);
      setTotalCount(count || 0);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    } catch (error) {
      console.error('Error fetching brands:', error);
      toast.error('Failed to fetch brands');
    } finally {
      setLoading(false);
    }
  };

  // Fetch brands when pagination, filters, or items per page changes
  useEffect(() => {
    fetchBrands();
  }, [currentPage, itemsPerPage, searchTerm, categoryFilter]);

  const handleUpdateMRP = async (brandId: number) => {
    if (!newMRP || isNaN(Number(newMRP))) {
      toast.error('Please enter a valid MRP');
      return;
    }

    try {
      const mrp = Number(newMRP);
      
      // Update brand's current MRP
      const { error: updateError } = await supabase
        .from('brands')
        .update({ mrp })
        .eq('id', brandId);

      if (updateError) throw updateError;
      
      // Add to price history
      const { error: historyError } = await supabase
        .from('price_history')
        .insert({ brand_id: brandId, mrp });
        
      if (historyError) {
        console.error('Error adding to price history:', historyError);
        // Continue even if history update fails
      }

      toast.success('MRP updated successfully');
      setEditingBrand(null);
      setNewMRP('');
      fetchBrands();
    } catch (error) {
      console.error('Error updating MRP:', error);
      toast.error('Failed to update MRP');
    }
  };
  
  // Fetch price history for a brand
  const fetchPriceHistory = async (brandId: number) => {
    try {
      setLoadingHistory(true);
      
      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      setPriceHistory(data || []);
    } catch (error) {
      console.error('Error fetching price history:', error);
      toast.error('Failed to fetch price history');
    } finally {
      setLoadingHistory(false);
    }
  };
  
  // Open price history modal
  const openPriceHistory = (brand: Brand) => {
    setSelectedBrand(brand);
    setShowPriceHistory(true);
    fetchPriceHistory(brand.id);
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Download template for bulk import
  const downloadTemplate = async () => {
    try {
      // First get the total count of brands
      const { count, error: countError } = await supabase
        .from('brands')
        .select('*', { count: 'exact', head: true });
        
      if (countError) throw countError;
      
      // Calculate how many queries we need (1000 items per query due to Supabase limits)
      const batchSize = 1000;
      const numberOfBatches = Math.ceil((count || 0) / batchSize);
      let allBrands: Brand[] = [];
      
      // Show loading toast
      toast.loading(`Fetching ${count} brands for template...`, { id: 'template-loading' });
      
      // Fetch all brands in batches
      for (let i = 0; i < numberOfBatches; i++) {
        const start = i * batchSize;
        const end = start + batchSize - 1;
        
        const { data, error } = await supabase
          .from('brands')
          .select('id, brand_name, category, sizes, mrp')
          .order('brand_name')
          .range(start, end);
          
        if (error) throw error;
        if (data) {
          allBrands = [...allBrands, ...data];
        }
        
        // Update progress
        const progress = Math.round(((i + 1) / numberOfBatches) * 100);
        toast.loading(`Fetching brands: ${progress}%`, { id: 'template-loading' });
      }
      
      // Prepare data for Excel
      const templateData = allBrands.map(brand => ({
        'Brand ID': brand.id,
        'Brand Name': brand.brand_name,
        'Category': brand.category,
        'Sizes': brand.sizes,
        'Current MRP': brand.mrp || '',
        'New MRP': '' // Empty column for users to fill
      }));
      
      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(templateData);
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'MRP Template');
      
      // Generate Excel file
      XLSX.writeFile(wb, 'MRP_Import_Template.xlsx');
      
      toast.success(`Template downloaded successfully with ${allBrands.length} brands`, { id: 'template-loading' });
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Failed to download template');
    }
  };
  
  // Handle file upload for bulk import
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      setImporting(true);
      setImportResult(null);
      
      // Read the Excel file
      const data = await readExcelFile(file);
      
      // Process the data and update MRPs
      const result = await processImportData(data);
      
      setImportResult(result);
      
      if (result.failed > 0) {
        toast.error(`Import completed with ${result.failed} errors`);
      } else {
        toast.success(`Successfully imported ${result.success} MRPs`);
        setShowImportModal(false);
        fetchBrands(); // Refresh the brands list
      }
    } catch (error) {
      console.error('Error importing MRPs:', error);
      toast.error('Failed to import MRPs');
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Read Excel file and convert to JSON
  const readExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  };
  
  // Process imported data and update MRPs
  const processImportData = async (data: any[]): Promise<ImportResult> => {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: []
    };
    
    for (const row of data) {
      try {
        const brandId = row['Brand ID'];
        const newMRP = row['New MRP'];
        
        // Skip if no brand ID or new MRP is empty
        if (!brandId || newMRP === undefined || newMRP === '') {
          continue;
        }
        
        // Convert MRP to number
        const mrp = Number(newMRP);
        
        // Validate MRP
        if (isNaN(mrp) || mrp <= 0) {
          result.failed++;
          result.errors.push(`Invalid MRP value for ${row['Brand Name']}: ${newMRP}`);
          continue;
        }
        
        // Update brand's current MRP
        const { error: updateError } = await supabase
          .from('brands')
          .update({ mrp })
          .eq('id', brandId);
          
        if (updateError) throw updateError;
        
        // Add to price history
        const { error: historyError } = await supabase
          .from('price_history')
          .insert({ brand_id: brandId, mrp });
          
        if (historyError) {
          console.error('Error adding to price history:', historyError);
          // Continue even if history update fails
        }
        
        result.success++;
      } catch (error: any) {
        console.error('Error processing row:', error);
        result.failed++;
        result.errors.push(`Error updating ${row['Brand Name']}: ${error.message || 'Unknown error'}`);
      }
    }
    
    return result;
  };
  
  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(parseInt(e.target.value));
    setCurrentPage(1); // Reset to first page when changing items per page
  };
  
  // Search and filter handlers
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };
  
  const handleCategoryFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryFilter(e.target.value);
    setCurrentPage(1); // Reset to first page when filtering
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Set MRP</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage Maximum Retail Price (MRP) for your brands
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Upload className="w-4 h-4" />
              <span>Bulk Import</span>
            </button>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {selectedBar?.bar_name}
              </span>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Search and Filter Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search brands..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:text-white"
              />
            </div>
          </div>
          
          <div className="w-full md:w-48">
            <select
              value={categoryFilter}
              onChange={handleCategoryFilterChange}
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Categories</option>
              <option value="Spirits">Spirits</option>
              <option value="Wines">Wines</option>
              <option value="Fermented Beer">Fermented Beer</option>
              <option value="Mild Beer">Mild Beer</option>
            </select>
          </div>
        </div>
      </div>

      {/* Brands Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Brand Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Sizes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Current MRP
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                      <span className="ml-2">Loading brands...</span>
                    </div>
                  </td>
                </tr>
              ) : brands.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No brands found
                  </td>
                </tr>
              ) : (
                brands.map((brand) => (
                  <tr key={brand.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => openPriceHistory(brand)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {brand.brand_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {brand.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {brand.sizes}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {brand.mrp ? `₹${brand.mrp}` : 'Not set'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        {editingBrand === brand.id ? (
                          <>
                            <input
                              type="number"
                              value={newMRP}
                              onChange={(e) => setNewMRP(e.target.value)}
                              className="w-24 px-2 py-1 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                              placeholder="Enter MRP"
                              onClick={(e) => e.stopPropagation()} // Prevent row click when editing
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent row click
                                handleUpdateMRP(brand.id);
                              }}
                              className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent row click
                                setEditingBrand(null);
                                setNewMRP('');
                              }}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row click
                              setEditingBrand(brand.id);
                            }}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <Tags className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Pagination */}
      {!loading && totalCount > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mt-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} brands
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`p-1 rounded-md ${
                  currentPage === 1
                    ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Show pages around current page
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
                      className={`w-8 h-8 flex items-center justify-center rounded-md ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`p-1 rounded-md ${
                  currentPage === totalPages
                    ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Show:</label>
              <select
                value={itemsPerPage}
                onChange={handleItemsPerPageChange}
                className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
              <span className="text-sm text-gray-600 dark:text-gray-400">per page</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Price History Modal */}
      {showPriceHistory && selectedBrand && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Price History: {selectedBrand.brand_name}
                </h2>
                <button 
                  onClick={() => setShowPriceHistory(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {selectedBrand.category} • {selectedBrand.sizes}
              </p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-grow">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="ml-2">Loading price history...</span>
                </div>
              ) : priceHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No price history available for this brand.</p>
                  <p className="text-sm mt-2">MRP changes will be recorded here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {priceHistory.map((history) => (
                    <div 
                      key={history.id} 
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 flex justify-between items-center"
                    >
                      <div className="flex items-center">
                        <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full mr-4">
                          <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            ₹{history.mrp}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(history.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {history.id === priceHistory[0].id && (
                          <span className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded-full text-xs">
                            Current
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Current MRP: {selectedBrand.mrp ? `₹${selectedBrand.mrp}` : 'Not set'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPriceHistory(false);
                    setEditingBrand(selectedBrand.id);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Update MRP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Bulk Import MRPs
                </h2>
                <button 
                  onClick={() => setShowImportModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Import MRPs for multiple brands at once
              </p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-grow">
              {importing ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                  <p className="text-gray-700 dark:text-gray-300">Importing MRPs...</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">This may take a moment depending on the file size.</p>
                </div>
              ) : importResult ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Import Results</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Successfully Updated</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{importResult.success}</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Failed</p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">{importResult.failed}</p>
                      </div>
                    </div>
                    
                    {importResult.errors.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Errors</h4>
                        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg max-h-40 overflow-y-auto">
                          <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                            {importResult.errors.map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setShowImportModal(false);
                        setImportResult(null);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h3 className="text-lg font-medium text-blue-800 dark:text-blue-300 mb-2">How to Import MRPs</h3>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-blue-700 dark:text-blue-300">
                      <li>Download the template file by clicking the button below</li>
                      <li>Fill in the "New MRP" column with the desired MRP values</li>
                      <li>Save the file and upload it using the form below</li>
                      <li>The system will update all MRPs and record the changes in price history</li>
                    </ol>
                  </div>
                  
                  <div className="flex justify-center">
                    <button
                      onClick={downloadTemplate}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Template</span>
                    </button>
                  </div>
                  
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Upload Filled Template</h3>
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                      <FileSpreadsheet className="w-12 h-12 text-gray-400 mb-4" />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Drag and drop your Excel file here, or click to browse
                      </p>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".xlsx,.xls"
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        Select File
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 