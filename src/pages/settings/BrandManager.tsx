import React, { useState, useEffect } from 'react';
import { Plus, Upload, Trash2, Edit2, Loader2, X, Download, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

type Brand = {
  id: number;
  brand_name: string;
  item_code: string;
  sizes: string;
  category: 'Spirits' | 'Wines' | 'Fermented Beer' | 'Mild Beer';
  mrp: number;
  created_at: string;
};

// Add ExcelRow type definition
type ExcelRow = {
  'Item Code': string;
  'Brand Name': string;
  'Size': string;
  'Category': string;
  'MRP': number;
};

const CATEGORIES = ['Spirits', 'Wines', 'Fermented Beer', 'Mild Beer'] as const;

export default function BrandManager() {
  const [isLoading, setIsLoading] = useState(true);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [filteredBrands, setFilteredBrands] = useState<Brand[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentBrandId, setCurrentBrandId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    brand_name: '',
    item_code: '',
    category: 'Spirits' as Brand['category'],
    sizes: '',
    mrp: '',
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  const [importLoading, setImportLoading] = useState(false);

  useEffect(() => {
    fetchBrands();
  }, []);
  
  // Effect to handle filtering and pagination
  useEffect(() => {
    let result = [...brands];
    
    // Apply search
    if (searchTerm) {
      const lowercaseSearch = searchTerm.toLowerCase();
      result = result.filter(brand => 
        brand.brand_name.toLowerCase().includes(lowercaseSearch) ||
        brand.item_code.toLowerCase().includes(lowercaseSearch) ||
        brand.sizes.toLowerCase().includes(lowercaseSearch)
      );
    }
    
    // Apply category filter
    if (categoryFilter) {
      result = result.filter(brand => brand.category === categoryFilter);
    }
    
    // Update filtered brands
    setFilteredBrands(result);
    
    // Calculate total pages
    setTotalPages(Math.ceil(result.length / itemsPerPage));
    
    // Reset to first page when filters change
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [brands, searchTerm, categoryFilter, itemsPerPage]);

  const fetchBrands = async () => {
    try {
      setIsLoading(true);
      
      // Fetch total count first
      const { count: totalCount } = await supabase
        .from('brands')
        .select('*', { count: 'exact', head: true });

      if (!totalCount) {
        toast.error('Failed to get total brand count');
        return;
      }

      // Calculate how many queries we need (1000 items per query due to Supabase limits)
      const batchSize = 1000;
      const numberOfBatches = Math.ceil(totalCount / batchSize);
      let allBrands: Brand[] = [];

      // Fetch all brands in batches
      for (let i = 0; i < numberOfBatches; i++) {
        const start = i * batchSize;
        const end = start + batchSize - 1;

        const { data, error } = await supabase
          .from('brands')
          .select('*')
          .order('brand_name')
          .range(start, end);

        if (error) throw error;
        if (data) {
          allBrands = [...allBrands, ...data];
        }
      }

      // Update state with all brands
      setBrands(allBrands);
      setFilteredBrands(allBrands);
      setTotalPages(Math.ceil(allBrands.length / itemsPerPage));
      
      if (allBrands.length < totalCount) {
        toast('Some brands could not be loaded', {
          icon: '⚠️',
          duration: 4000
        });
      } else {
        toast.success(`Loaded ${allBrands.length} brands successfully`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch brands');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sizes.trim()) {
      toast.error('Please add sizes');
      return;
    }

    // Validate MRP
    const mrp = parseFloat(formData.mrp);
    if (isNaN(mrp) || mrp < 0) {
      toast.error('Please enter a valid MRP');
      return;
    }

    setIsLoading(true);

    try {
      let result;
      if (isEditMode && currentBrandId) {
        // Update existing brand
        result = await supabase
          .from('brands')
          .update({
            brand_name: formData.brand_name,
            item_code: formData.item_code,
            sizes: formData.sizes,
            category: formData.category,
            mrp: mrp,
          })
          .eq('id', currentBrandId)
          .select()
          .single();
      } else {
        // Add new brand
        result = await supabase
          .from('brands')
          .insert([
            {
              brand_name: formData.brand_name,
              item_code: formData.item_code,
              sizes: formData.sizes,
              category: formData.category,
              mrp: mrp,
            },
          ])
          .select()
          .single();
      }

      const { data, error } = result;

      if (error) throw error;

      // Update brands list
      if (isEditMode && currentBrandId) {
        setBrands(prev => 
          prev.map(brand => 
            brand.id === currentBrandId ? data : brand
          )
        );
      } else {
        setBrands(prev => [data, ...prev]);
      }

      // Reset form and modal
      setIsModalOpen(false);
      resetForm();
      setIsEditMode(false);
      setCurrentBrandId(null);

      toast.success(isEditMode ? 'Brand updated successfully' : 'Brand added successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save brand');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditBrand = (brand: Brand) => {
    // Populate form with existing brand data
    setFormData({
      brand_name: brand.brand_name,
      item_code: brand.item_code,
      category: brand.category,
      sizes: brand.sizes,
      mrp: brand.mrp.toString(),
    });
    
    // Set edit mode and current brand ID
    setIsEditMode(true);
    setCurrentBrandId(brand.id);
    setIsModalOpen(true);
  };

  const handleDeleteBrand = async (brandId: number) => {
    // Confirm deletion
    const confirmDelete = window.confirm('Are you sure you want to delete this brand?');
    if (!confirmDelete) return;

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', brandId);

      if (error) throw error;

      // Remove brand from local state
      setBrands(prev => prev.filter(brand => brand.id !== brandId));

      toast.success('Brand deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete brand');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csvData = event.target?.result as string;
        // Split by newlines and filter out empty lines
        const rows = csvData
          .split('\n')
          .filter(line => line.trim() !== '') // Remove empty lines
          .map(row => row.split(',').map(cell => cell.trim()));
        
        // Validate header row
        const headerRow = rows[0];
        if (!headerRow || headerRow.length !== 5) {
          throw new Error('Invalid CSV format. Please use the template provided.');
        }

        // Skip header row and filter out empty rows
        const brands = rows.slice(1)
          .filter(row => row.length === 5 && row.some(cell => cell.trim() !== ''))
          .map(row => {
            // Validate category
            const category = row[3]?.trim();
            if (!category || !CATEGORIES.includes(category as any)) {
              throw new Error(`Invalid category: "${category}". Must be one of: ${CATEGORIES.join(', ')}`);
            }

            // Validate MRP
            const mrp = parseFloat(row[4]?.trim() || '0');
            if (isNaN(mrp) || mrp < 0) {
              throw new Error(`Invalid MRP: "${row[4]}". Must be a non-negative number.`);
            }

            return {
              brand_name: row[0]?.trim() || '',
              item_code: row[1]?.trim() || '',
              sizes: row[2]?.trim() || '',
              category: category,
              mrp: mrp,
            };
          });

        if (brands.length === 0) {
          throw new Error('No valid data found in CSV file. Please check the format and try again.');
        }

        // Validate required fields
        const invalidRows = brands.map((brand, index) => ({
          index: index + 2, // Add 2 to account for 0-based index and header row
          errors: [
            !brand.brand_name && 'Brand Name is required',
            !brand.item_code && 'Item Code is required',
            !brand.sizes && 'Sizes is required',
            !brand.category && 'Category is required',
            brand.mrp < 0 && 'MRP must be a non-negative number',
          ].filter(Boolean)
        })).filter(row => row.errors.length > 0);

        if (invalidRows.length > 0) {
          throw new Error(
            'Invalid data in CSV file:\n' +
            invalidRows.map(row => `Row ${row.index}: ${row.errors.join(', ')}`).join('\n')
          );
        }

        // Get existing brands to check for duplicates
        const { data: existingBrands, error: existingError } = await supabase
          .from('brands')
          .select('item_code');

        if (existingError) throw existingError;

        // Create a Set of existing item codes for faster lookup
        const existingItemCodes = new Set(existingBrands?.map(brand => brand.item_code) || []);

        // Track duplicates and new brands
        const duplicates: string[] = [];
        const newBrands: any[] = [];

        // First pass: identify duplicates and new brands
        brands.forEach(brand => {
          if (existingItemCodes.has(brand.item_code)) {
            duplicates.push(brand.item_code);
          } else {
            newBrands.push(brand);
          }
        });

        // Process new brands in batches
        const batchSize = 100;
        const batches = Math.ceil(newBrands.length / batchSize);
        let processedCount = 0;
        let errors: string[] = [];

        for (let i = 0; i < batches; i++) {
          const start = i * batchSize;
          const end = Math.min(start + batchSize, newBrands.length);
          const batch = newBrands.slice(start, end);

          if (batch.length > 0) {
            // Use upsert with onConflict to skip duplicates
            const { error: insertError } = await supabase
              .from('brands')
              .upsert(batch, {
                onConflict: 'item_code',
                ignoreDuplicates: true
              });

            if (insertError) {
              errors.push(`Error inserting batch ${i + 1}: ${insertError.message}`);
            } else {
              processedCount += batch.length;
            }
          }

          // Update progress
          const progress = Math.round(((i + 1) / batches) * 100);
          toast.loading(`Processed ${progress}% (${processedCount} new, ${duplicates.length} duplicates)`, { id: 'import-status' });
        }

        // Show detailed status
        const statusMessage = (
          <div className="flex flex-col gap-2">
            <div className="font-medium">Import Status:</div>
            <div className="text-sm">
              <div className="text-green-600">✓ Successfully imported: {processedCount}</div>
              {duplicates.length > 0 && (
                <div className="text-yellow-600">⚠ Skipped (duplicates): {duplicates.length}</div>
              )}
            </div>
            {duplicates.length > 0 && (
              <div className="mt-2">
                <div className="text-sm font-medium text-yellow-600">Duplicate Item Codes:</div>
                <div className="text-xs text-yellow-500 max-h-32 overflow-y-auto">
                  {duplicates.map((code, index) => (
                    <div key={index}>{code}</div>
                  ))}
                </div>
              </div>
            )}
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
          // Refresh brands list
          fetchBrands();
        } else {
          toast.error(statusMessage, { 
            id: 'import-status',
            duration: 5000 
          });
        }

        setIsBulkImportModalOpen(false);
      } catch (error: any) {
        toast.error(error.message || 'Failed to import brands', { id: 'import-status' });
      }
    };

    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    // Create CSV content with exact category values
    const headers = ['Brand Name', 'Item Code', 'Sizes', 'Category', 'MRP'];
    const sampleData = [
      ['Sample Brand 1', 'CODE001', '750ml', CATEGORIES[0], '500.50'], // Spirits
      ['Sample Brand 2', 'CODE002', '330ml, 500ml', CATEGORIES[2], '750.75'], // Fermented Beer
    ];
    
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'brand_import_template.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setFormData({
      brand_name: '',
      item_code: '',
      category: 'Spirits',
      sizes: '',
      mrp: '',
    });
    setIsEditMode(false);
    setCurrentBrandId(null);
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
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredBrands.slice(startIndex, startIndex + itemsPerPage);
  };

  // Add pagination info display
  const getPaginationInfo = () => {
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredBrands.length);
    return {
      startItem,
      endItem,
      totalItems: filteredBrands.length
    };
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0]) return;
    
    try {
      setImportLoading(true);
      const file = event.target.files[0];
      
      // Show initial loading toast
      toast.loading('Reading Excel file...', { id: 'import-status' });
      
      // Read the Excel file
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            throw new Error('Failed to read file data');
          }

          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

          // Update loading message
          toast.loading(`Processing ${jsonData.length} brands...`, { id: 'import-status' });

          // Get existing brands to check for duplicates
          const { data: existingBrands, error: existingError } = await supabase
            .from('brands')
            .select('item_code');

          if (existingError) throw existingError;

          // Create a Set of existing item codes for faster lookup
          const existingItemCodes = new Set(existingBrands?.map(brand => brand.item_code) || []);

          // Track duplicates and new brands
          const duplicates: string[] = [];
          const newBrands: any[] = [];

          // First pass: identify duplicates and new brands
          jsonData.forEach(brand => {
            if (existingItemCodes.has(brand['Item Code'])) {
              duplicates.push(brand['Item Code']);
            } else {
              newBrands.push({
                brand_name: brand['Brand Name'],
                item_code: brand['Item Code'],
                sizes: brand['Size'],
                mrp: brand['MRP'],
                category: brand['Category']
              });
            }
          });

          // Process new brands in batches
          const batchSize = 100;
          const batches = Math.ceil(newBrands.length / batchSize);
          let processedCount = 0;
          let errors: string[] = [];

          for (let i = 0; i < batches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, newBrands.length);
            const batch = newBrands.slice(start, end);

            if (batch.length > 0) {
              const { error: insertError } = await supabase
                .from('brands')
                .insert(batch);

              if (insertError) {
                errors.push(`Error inserting batch ${i + 1}: ${insertError.message}`);
              } else {
                processedCount += batch.length;
              }
            }

            // Update progress
            const progress = Math.round(((i + 1) / batches) * 100);
            toast.loading(`Processed ${progress}% (${processedCount} new, ${duplicates.length} duplicates)`, { id: 'import-status' });
          }

          // Show detailed status
          const statusMessage = (
            <div className="flex flex-col gap-2">
              <div className="font-medium">Import Status:</div>
              <div className="text-sm">
                <div className="text-green-600">✓ Successfully imported: {processedCount}</div>
                {duplicates.length > 0 && (
                  <div className="text-yellow-600">⚠ Skipped (duplicates): {duplicates.length}</div>
                )}
              </div>
              {duplicates.length > 0 && (
                <div className="mt-2">
                  <div className="text-sm font-medium text-yellow-600">Duplicate Item Codes:</div>
                  <div className="text-xs text-yellow-500 max-h-32 overflow-y-auto">
                    {duplicates.map((code, index) => (
                      <div key={index}>{code}</div>
                    ))}
                  </div>
                </div>
              )}
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
            // Refresh brands list
            fetchBrands();
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
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Brand Manager</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your product brands and their prices</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setIsBulkImportModalOpen(true)}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Bulk Import</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Brand</span>
          </button>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search brands..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          
          {/* Items Per Page */}
          <div className="flex items-center justify-end gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">Show:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
            <span className="text-sm text-gray-600 dark:text-gray-400">per page</span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center min-h-[200px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredBrands.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {brands.length === 0
              ? "No brands added yet. Click the 'Add Brand' button to add one."
              : "No brands match your search criteria."}
          </p>
          {brands.length > 0 && filteredBrands.length === 0 && (
            <button
              onClick={() => { setSearchTerm(''); setCategoryFilter(''); }}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Brands Table */}
      {!isLoading && filteredBrands.length > 0 && (
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
                    Sizes
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Category
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    MRP (₹)
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                    </td>
                  </tr>
                ) : getCurrentItems().length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      No brands found
                    </td>
                  </tr>
                ) : (
                  getCurrentItems().map((brand) => (
                    <tr key={brand.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {brand.item_code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {brand.brand_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {brand.sizes}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium 
                          ${brand.category === 'Spirits' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' : ''}
                          ${brand.category === 'Wines' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : ''}
                          ${brand.category === 'Fermented Beer' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300' : ''}
                          ${brand.category === 'Mild Beer' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : ''}
                        `}>
                          {brand.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {brand.mrp.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditBrand(brand)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteBrand(brand.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Info and Controls */}
          {!isLoading && filteredBrands.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Showing <span className="font-medium">{getPaginationInfo().startItem}</span> to{' '}
                <span className="font-medium">{getPaginationInfo().endItem}</span> of{' '}
                <span className="font-medium">{getPaginationInfo().totalItems}</span> brands
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded ${
                    currentPage === 1
                      ? 'bg-gray-200 text-gray-400 dark:bg-gray-600 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {/* Pagination Numbers */}
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
                      onClick={() => setCurrentPage(pageNum)}
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
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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
          )}
        </div>
      )}

      {/* Add/Edit Brand Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                {isEditMode ? 'Edit Brand' : 'Add New Brand'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label htmlFor="brand_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Brand Name
                </label>
                <input
                  type="text"
                  id="brand_name"
                  name="brand_name"
                  value={formData.brand_name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter brand name"
                />
              </div>

              <div>
                <label htmlFor="item_code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Item Code
                </label>
                <input
                  type="text"
                  id="item_code"
                  name="item_code"
                  value={formData.item_code}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter item code"
                />
              </div>

              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="sizes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sizes (comma-separated, e.g., "750ml, 500ml")
                </label>
                <input
                  type="text"
                  id="sizes"
                  name="sizes"
                  value={formData.sizes}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter sizes (e.g., 750ml, 500ml)"
                />
              </div>

              <div>
                <label htmlFor="mrp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  MRP (Maximum Retail Price)
                </label>
                <input
                  type="number"
                  id="mrp"
                  name="mrp"
                  value={formData.mrp}
                  onChange={handleInputChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter MRP"
                />
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isEditMode ? 'Updating...' : 'Adding...'}</span>
                    </div>
                  ) : (
                    isEditMode ? 'Update Brand' : 'Add Brand'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {isBulkImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Bulk Import Brands</h2>
              <button
                onClick={() => setIsBulkImportModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Follow these steps to import brands:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li>Download the template CSV file</li>
                  <li>Fill in your brand details following the format</li>
                  <li>Save the file and upload it here</li>
                </ol>
              </div>

              <div className="mb-6">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 w-full justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Template</span>
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Template Format:
                </p>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                    <li><span className="font-medium">Brand Name:</span> Text (e.g., "Brand Name")</li>
                    <li><span className="font-medium">Item Code:</span> Unique identifier (e.g., "CODE001")</li>
                    <li><span className="font-medium">Sizes:</span> Comma-separated text (e.g., "750ml, 500ml")</li>
                    <li><span className="font-medium">Category:</span> One of: Spirits, Wines, Fermented Beer, Mild Beer</li>
                    <li><span className="font-medium">MRP:</span> Decimal number (e.g., "500.50")</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upload CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleBulkImport}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    dark:file:bg-blue-900 dark:file:text-blue-200
                    hover:file:bg-blue-100 dark:hover:file:bg-blue-800"
                />
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsBulkImportModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
