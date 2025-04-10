import React, { useState, useEffect } from 'react';
import { useBar } from '../../context/BarContext';
import { supabase } from '../../lib/supabase';
import { Loader2, Plus, Save, X, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Brand {
  id: number;
  brand_name: string;
}

interface DatabaseBrand {
  id: number;
  brand_name: string;
}

interface Shortcut {
  id: number;
  shortform: string;
  brand_id: number;
  brand_name: string;
}

interface GroupedShortcut {
  brand_name: string;
  shortcuts: Shortcut[];
}

interface SupabaseShortcut {
  id: number;
  shortform: string;
  brand_id: number;
  brands: {
    brand_name: string;
  };
}

export default function Shortcut() {
  const { selectedBar } = useBar();
  const [isLoading, setIsLoading] = useState(true);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    shortform: '',
    brand_id: '',
    brand_name: ''
  });
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; // Number of groups per page

  useEffect(() => {
    if (selectedBar) {
      fetchShortcuts();
      fetchBrands();
    }
  }, [selectedBar]);

  const fetchShortcuts = async () => {
    try {
      const { data, error } = await supabase
        .from('shortcuts')
        .select(`
          id,
          shortform,
          brand_id,
          brands (
            brand_name
          )
        `)
        .order('shortform');

      if (error) throw error;

      const transformedData = (data as unknown as SupabaseShortcut[]).map(item => ({
        id: item.id,
        shortform: item.shortform,
        brand_id: item.brand_id,
        brand_name: item.brands.brand_name
      }));

      setShortcuts(transformedData);
    } catch (error: any) {
      toast.error('Failed to fetch shortcuts');
      console.error('Error fetching shortcuts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBrands = async () => {
    try {
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
          .select('id, brand_name')
          .order('brand_name')
          .range(start, end);

        if (error) throw error;
        if (data) {
          allBrands = [...allBrands, ...data];
        }
      }

      setBrands(allBrands);
      
      if (allBrands.length < totalCount) {
        toast('Some brands could not be loaded', {
          icon: '⚠️',
          duration: 4000
        });
      }
    } catch (error: any) {
      toast.error('Failed to fetch brands');
      console.error('Error fetching brands:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);

      // Get the brand name of the selected brand
      const { data: selectedBrand } = await supabase
        .from('brands')
        .select('brand_name')
        .eq('id', formData.brand_id)
        .single();

      if (!selectedBrand) {
        toast.error('Selected brand not found');
        return;
      }

      // Find all brands with the same name
      const { data: similarBrands, error: brandsError } = await supabase
        .from('brands')
        .select('id, brand_name')
        .eq('brand_name', selectedBrand.brand_name) as { data: DatabaseBrand[] | null, error: any };

      if (brandsError || !similarBrands || similarBrands.length === 0) {
        toast.error('Failed to find brands');
        return;
      }

      // Check if any of these brands already have shortcuts
      const { data: existingBrandShortcuts } = await supabase
        .from('shortcuts')
        .select('brand_id')
        .in('brand_id', similarBrands.map(b => b.id));

      // Filter out brands that already have shortcuts
      const brandsToAdd = similarBrands.filter(brand => 
        !existingBrandShortcuts?.some(shortcut => shortcut.brand_id === brand.id)
      );

      if (brandsToAdd.length === 0) {
        toast.error('All brands with this name already have shortcuts');
        return;
      }

      // Insert shortcuts for all similar brands with numbered suffixes
      const baseShortform = formData.shortform.toUpperCase();
      const insertPromises = brandsToAdd.map(async (brand, index) => {
        const shortform = index === 0 ? baseShortform : `${baseShortform}${index + 1}`;
        
        // Check if this specific shortform exists
        const { data: existingShortform } = await supabase
          .from('shortcuts')
          .select('id')
          .eq('shortform', shortform)
          .single();

        if (existingShortform) {
          return { error: `Shortform ${shortform} already exists` };
        }

        // Insert the new shortform
        const { error } = await supabase
          .from('shortcuts')
          .insert({
            shortform: shortform,
            brand_id: brand.id
          });

        return { error };
      });

      const results = await Promise.all(insertPromises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        toast.error(`Some shortcuts could not be added: ${errors.map(e => e.error).join(', ')}`);
      } else {
        toast.success(`Shortcut added successfully for ${brandsToAdd.length} brand(s)`);
      }

      setFormData({ shortform: '', brand_id: '', brand_name: '' });
      setShowAddForm(false);
      fetchShortcuts();
    } catch (error: any) {
      toast.error('Failed to add shortcut');
      console.error('Error adding shortcut:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this shortcut?')) {
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('shortcuts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Shortcut deleted successfully');
      fetchShortcuts();
    } catch (error: any) {
      toast.error('Failed to delete shortcut');
      console.error('Error deleting shortcut:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add virtual scrolling for brand selection
  const filteredBrands = brands.filter(brand =>
    brand.brand_name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 100); // Show first 100 matching results

  // Group shortcuts by brand name
  const groupedShortcuts = shortcuts.reduce((acc: GroupedShortcut[], shortcut) => {
    const existingGroup = acc.find(group => group.brand_name === shortcut.brand_name);
    if (existingGroup) {
      existingGroup.shortcuts.push(shortcut);
    } else {
      acc.push({
        brand_name: shortcut.brand_name,
        shortcuts: [shortcut]
      });
    }
    return acc;
  }, []);

  // Sort grouped shortcuts by brand name
  groupedShortcuts.sort((a, b) => a.brand_name.localeCompare(b.brand_name));

  // Calculate pagination
  const totalPages = Math.ceil(groupedShortcuts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedShortcuts = groupedShortcuts.slice(startIndex, startIndex + itemsPerPage);

  const toggleGroup = (brandName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [brandName]: !prev[brandName]
    }));
  };

  if (!selectedBar) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500 dark:text-gray-400">Please select a bar first</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2 uppercase tracking-wider">Brand Shortcuts</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage brand name shortcuts for {selectedBar.bar_name}
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        {/* Add Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span>Add Shortcut</span>
          </button>
        </div>

        {/* Shortcuts Grid */}
        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : groupedShortcuts.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No shortcuts found
            </div>
          ) : (
            <>
              {paginatedShortcuts.map((group) => (
                <div 
                  key={group.brand_name}
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600 overflow-hidden transition-all duration-300 hover:shadow-lg"
                >
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.brand_name)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors duration-200"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {group.brand_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                          {group.brand_name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {group.shortcuts.length} shortcut{group.shortcuts.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium">
                        {group.shortcuts.length}
                      </span>
                      {expandedGroups[group.brand_name] ? (
                        <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Collapsible Content */}
                  <div className={`transition-all duration-500 ease-in-out ${
                    expandedGroups[group.brand_name] ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                  } overflow-hidden`}>
                    <div className="p-4 space-y-3">
                      {group.shortcuts.map((shortcut, index) => (
                        <div 
                          key={shortcut.id}
                          className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-300 group transform hover:scale-[1.02] hover:shadow-lg"
                          style={{
                            animation: expandedGroups[group.brand_name] 
                              ? `slideIn 0.3s ease-out ${index * 0.1}s forwards`
                              : 'none'
                          }}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm">
                              <span className="text-blue-600 dark:text-blue-400 font-mono font-medium text-lg">
                                {shortcut.shortform}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {shortcut.shortform}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Shortcut ID: {shortcut.id}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleDelete(shortcut.id)}
                              className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-all duration-200 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <style>
                    {`
                      @keyframes slideIn {
                        from {
                          opacity: 0;
                          transform: translateY(-10px);
                        }
                        to {
                          opacity: 1;
                          transform: translateY(0);
                        }
                      }
                    `}
                  </style>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, groupedShortcuts.length)} of {groupedShortcuts.length} groups
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                    >
                      <ChevronDown className="w-4 h-4 rotate-90" />
                      <span>Previous</span>
                    </button>
                    
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                            currentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                    >
                      <span>Next</span>
                      <ChevronDown className="w-4 h-4 -rotate-90" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 transform transition-all duration-300">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Add Shortcut</h2>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({ shortform: '', brand_id: '', brand_name: '' });
                  setSearchQuery('');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4">
              <div className="space-y-4">
                {/* Shortform Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                    Shortform
                  </label>
                  <input
                    type="text"
                    value={formData.shortform}
                    onChange={(e) => setFormData({ ...formData, shortform: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter shortform"
                    required
                  />
                </div>

                {/* Brand Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                    Search Brand
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Search brand name..."
                    />
                  </div>
                </div>

                {/* Brand Selection */}
                <div className="max-h-[300px] overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="sticky top-0 bg-white dark:bg-gray-800 p-2 border-b border-gray-200 dark:border-gray-600">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="Search brand name..."
                      />
                    </div>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-600">
                    {filteredBrands.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                        No brands found
                      </div>
                    ) : (
                      filteredBrands.map((brand) => (
                        <button
                          key={brand.id}
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              brand_id: brand.id.toString(),
                              brand_name: brand.brand_name
                            });
                            setSearchQuery('');
                          }}
                          className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 ${
                            formData.brand_id === brand.id.toString()
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {brand.brand_name}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Selected Brand Display */}
                {formData.brand_name && (
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                      Selected: {formData.brand_name}
                    </p>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={isLoading || !formData.shortform || !formData.brand_id}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 hover:shadow-lg"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        <span>Save Shortcut</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 