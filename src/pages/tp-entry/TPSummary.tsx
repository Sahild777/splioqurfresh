import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { useBar } from '../../context/BarContext';
import { Search, ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight, Edit2, Trash2, X, Plus, Minus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

type TPItem = {
  qty: number;
};

type Party = {
  id: number;
  party_name: string;
};

type TPResponse = {
  id: number;
  tp_no: string;
  tp_date: string;
  created_at: string;
  party_id: number;
  tp_items: TPItem[];
};

type TP = {
  id: number;
  tp_no: string;
  party_name: string;
  tp_date: string;
  total_items: number;
  total_qty: number;
  created_at: string;
};

type SortField = 'tp_no' | 'party_name' | 'tp_date' | 'created_at';
type SortDirection = 'asc' | 'desc';

type Brand = {
  id: number;
  brand_name: string;
  item_code: string;
  sizes: string;
  mrp: number;
  category: string;
  shortform?: string;
};

type EditTPItem = {
  id?: number;
  brand_id: number;
  qty: number;
  brand?: Brand;
};

type EditTP = {
  id: number;
  tp_no: string;
  party_id: number;
  tp_date: string;
  items: EditTPItem[];
};

type SearchableBrandSelectProps = {
  value: number;
  onChange: (value: number) => void;
  brands: Brand[];
  selectedBrand?: Brand;
};

function SearchableBrandSelect({ value, onChange, brands, selectedBrand }: SearchableBrandSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredBrands = brands.filter(brand => {
    const searchLower = searchQuery.toLowerCase();
    
    // If the search is 2-3 characters, prioritize shortform matches
    if (searchLower.length >= 2 && searchLower.length <= 3 && brand.shortform) {
      if (brand.shortform.toLowerCase().startsWith(searchLower)) {
        return true;
      }
    }

    return (
      (brand.shortform && brand.shortform.toLowerCase().includes(searchLower)) ||
      brand.brand_name.toLowerCase().includes(searchLower) ||
      brand.item_code.toLowerCase().includes(searchLower) ||
      brand.sizes.toLowerCase().includes(searchLower)
    );
  }).sort((a, b) => {
    // Prioritize exact shortform matches
    if (a.shortform?.toLowerCase() === searchQuery.toLowerCase()) return -1;
    if (b.shortform?.toLowerCase() === searchQuery.toLowerCase()) return 1;
    
    // Then prioritize shortform starts with
    if (a.shortform?.toLowerCase().startsWith(searchQuery.toLowerCase())) return -1;
    if (b.shortform?.toLowerCase().startsWith(searchQuery.toLowerCase())) return 1;
    
    // Finally sort by brand name
    return a.brand_name.localeCompare(b.brand_name);
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredBrands.length > 0) {
      onChange(filteredBrands[0].id);
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div 
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer"
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        {selectedBrand ? (
          <div>
            <span className="font-medium">{selectedBrand.brand_name}</span>
            {selectedBrand.shortform && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                ({selectedBrand.shortform})
              </span>
            )}
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              - {selectedBrand.sizes}
            </span>
          </div>
        ) : (
          'Select Brand'
        )}
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
          <div className="p-2">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search brands or type shortcut..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredBrands.map(brand => (
              <div
                key={brand.id}
                className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${
                  brand.id === value ? 'bg-blue-50 dark:bg-blue-900' : ''
                }`}
                onClick={() => {
                  onChange(brand.id);
                  setIsOpen(false);
                  setSearchQuery('');
                }}
              >
                <div className="font-medium flex items-center justify-between">
                  <span>{brand.brand_name}</span>
                  {brand.shortform && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                      ({brand.shortform})
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {brand.item_code} - {brand.sizes}
                </div>
              </div>
            ))}
            {filteredBrands.length === 0 && (
              <div className="px-3 py-2 text-gray-500 dark:text-gray-400">
                No brands found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TPSummary() {
  const navigate = useNavigate();
  const { selectedBar } = useBar();
  const [tps, setTps] = useState<TP[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 10;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTP, setEditingTP] = useState<EditTP | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  useEffect(() => {
    if (selectedBar) {
      fetchTPs();
    }
  }, [selectedBar, currentPage, sortField, sortDirection]);

  const fetchTPs = async () => {
    try {
      setLoading(true);
      
      // Calculate offset for pagination
      const offset = (currentPage - 1) * itemsPerPage;

      // First get total count without pagination
      const { count: totalCount } = await supabase
        .from('transport_permits')
        .select('id', { count: 'exact' })
        .eq('bar_id', selectedBar?.id);

      setTotalItems(totalCount || 0);

      // Build the query
      let query = supabase
        .from('transport_permits')
        .select(`
          id,
          tp_no,
          tp_date,
          created_at,
          party_id,
          tp_items (
            qty
          )
        `)
        .eq('bar_id', selectedBar?.id);

      // Add search filter if query exists
      if (searchQuery) {
        query = query.or(`tp_no.ilike.%${searchQuery}%`);
      }

      // Add sorting
      query = query.order(sortField, { ascending: sortDirection === 'asc' });

      // Add pagination
      query = query.range(offset, offset + itemsPerPage - 1);

      const { data: tpData, error: tpError, count } = await query;

      if (tpError) {
        console.error('Error fetching TPs:', tpError);
        throw tpError;
      }

      // Fetch party names separately
      const partyIds = tpData?.map(tp => tp.party_id) || [];
      const { data: partyData, error: partyError } = await supabase
        .from('parties')
        .select('id, party_name')
        .in('id', partyIds);

      if (partyError) {
        console.error('Error fetching parties:', partyError);
        throw partyError;
      }

      // Create a map of party names
      const partyMap = new Map(partyData?.map(party => [party.id, party.party_name]) || []);

      // Transform the data
      const transformedData = (tpData as TPResponse[]).map(tp => ({
        id: tp.id,
        tp_no: tp.tp_no,
        party_name: partyMap.get(tp.party_id) || '',
        tp_date: tp.tp_date,
        total_items: tp.tp_items.length,
        total_qty: tp.tp_items.reduce((sum: number, item: TPItem) => sum + item.qty, 0),
        created_at: tp.created_at
      }));

      // Filter by party name if search query exists
      const filteredData = searchQuery
        ? transformedData.filter(tp => 
            tp.party_name.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : transformedData;

      setTps(filteredData);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    } catch (error: any) {
      console.error('Error fetching TPs:', error);
      toast.error('Failed to fetch TPs');
    } finally {
      setLoading(false);
    }
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

  const fetchParties = async () => {
    try {
      const { data, error } = await supabase
        .from('parties')
        .select('*')
        .order('party_name');

      if (error) throw error;
      setParties(data || []);
    } catch (error) {
      console.error('Error fetching parties:', error);
      toast.error('Failed to fetch parties');
    }
  };

  const fetchBrands = async () => {
    try {
      // First get the total count of brands
      const { count: totalCount } = await supabase
        .from('brands')
        .select('*', { count: 'exact', head: true });

      if (!totalCount) {
        toast.error('Failed to get total brand count');
        return;
      }

      // Calculate how many queries we need (1000 items per query)
      const batchSize = 1000;
      const numberOfBatches = Math.ceil(totalCount / batchSize);
      let allBrands: Brand[] = [];

      // Fetch all brands in batches
      for (let i = 0; i < numberOfBatches; i++) {
        const start = i * batchSize;
        const end = start + batchSize - 1;

        const { data: brandsData, error: brandsError } = await supabase
          .from('brands')
          .select('*')
          .order('brand_name')
          .range(start, end);

        if (brandsError) throw brandsError;
        if (brandsData) {
          allBrands = [...allBrands, ...brandsData];
        }

        // Show loading progress for large datasets
        if (numberOfBatches > 1) {
          toast.loading(`Loading brands: ${Math.round(((i + 1) / numberOfBatches) * 100)}%`, {
            id: 'brandLoading'
          });
        }
      }

      // Fetch all shortcuts
      const { data: shortcutsData, error: shortcutsError } = await supabase
        .from('shortcuts')
        .select('shortform, brand_id');

      if (shortcutsError) throw shortcutsError;

      // Create a map of brand_id to shortform
      const shortcutMap = new Map(shortcutsData?.map(s => [s.brand_id, s.shortform]) || []);

      // Combine brands with their shortcuts
      const brandsWithShortcuts = allBrands.map(brand => ({
        ...brand,
        shortform: shortcutMap.get(brand.id) || undefined
      }));

      console.log(`Loaded ${brandsWithShortcuts.length} brands with shortcuts`); // Debug log
      setBrands(brandsWithShortcuts);
      
      // Clear the loading toast
      toast.dismiss('brandLoading');
      
      if (allBrands.length < totalCount) {
        toast('Some brands could not be loaded', {
          icon: '⚠️',
          duration: 4000
        });
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
      toast.error('Failed to fetch brands');
      toast.dismiss('brandLoading');
    }
  };

  const handleEdit = async (tpId: number) => {
    try {
      setLoading(true);
      
      // Fetch TP details with brand information
      const { data: tp, error: tpError } = await supabase
        .from('transport_permits')
        .select(`
          id,
          tp_no,
          party_id,
          tp_date,
          tp_items!inner (
            id,
            brand_id,
            qty,
            brands!inner (
              id,
              brand_name,
              item_code,
              sizes,
              mrp,
              category
            )
          )
        `)
        .eq('id', tpId)
        .single();

      if (tpError) throw tpError;

      // Fetch shortcuts for the brands in the TP
      const brandIds = tp.tp_items.map((item: any) => item.brand_id);
      const { data: shortcuts, error: shortcutsError } = await supabase
        .from('shortcuts')
        .select('shortform, brand_id')
        .in('brand_id', brandIds);

      if (shortcutsError) throw shortcutsError;

      // Create a map of brand_id to shortform
      const shortcutMap = new Map(shortcuts?.map(s => [s.brand_id, s.shortform]) || []);

      // Transform the data and ensure brand information is properly mapped with shortcuts
      const editTP: EditTP = {
        id: tp.id,
        tp_no: tp.tp_no,
        party_id: tp.party_id,
        tp_date: tp.tp_date,
        items: tp.tp_items.map((item: any) => ({
          id: item.id,
          brand_id: item.brand_id,
          qty: item.qty,
          brand: {
            ...item.brands,
            shortform: shortcutMap.get(item.brand_id)
          }
        }))
      };

      console.log('Transformed TP data with shortcuts:', editTP); // Debug log

      // First set the editingTP
      setEditingTP(editTP);
      
      // Then fetch parties and brands with shortcuts
      const [partiesResult] = await Promise.all([
        supabase.from('parties').select('*').order('party_name')
      ]);

      if (partiesResult.error) throw partiesResult.error;

      setParties(partiesResult.data || []);
      await fetchBrands(); // This will now fetch brands with shortcuts
      setIsEditModalOpen(true);
    } catch (error) {
      console.error('Error fetching TP details:', error);
      toast.error('Failed to fetch TP details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTP = async () => {
    if (!editingTP) return;

    try {
      setLoading(true);

      // Update transport permit
      const { error: tpError } = await supabase
        .from('transport_permits')
        .update({
          party_id: editingTP.party_id,
          tp_date: editingTP.tp_date
        })
        .eq('id', editingTP.id);

      if (tpError) throw tpError;

      // Update tp_items
      for (const item of editingTP.items) {
        if (item.id) {
          // Update existing item
          const { error: itemError } = await supabase
            .from('tp_items')
            .update({
              brand_id: item.brand_id,
              qty: item.qty
            })
            .eq('id', item.id);

          if (itemError) throw itemError;
        } else {
          // Insert new item
          const { error: itemError } = await supabase
            .from('tp_items')
            .insert({
              transport_permit_id: editingTP.id,
              brand_id: item.brand_id,
              qty: item.qty,
              bar_id: selectedBar?.id
            });

          if (itemError) throw itemError;
        }
      }

      toast.success('TP updated successfully');
      setIsEditModalOpen(false);
      setEditingTP(null);
      fetchTPs();
    } catch (error) {
      console.error('Error updating TP:', error);
      toast.error('Failed to update TP');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    if (!editingTP) return;
    setEditingTP({
      ...editingTP,
      items: [...editingTP.items, { brand_id: 0, qty: 0, brand: undefined }]
    });
  };

  const handleRemoveItem = (index: number) => {
    if (!editingTP) return;
    const newItems = [...editingTP.items];
    newItems.splice(index, 1);
    setEditingTP({ ...editingTP, items: newItems });
  };

  const handleItemChange = (index: number, field: 'brand_id' | 'qty', value: number) => {
    if (!editingTP) return;
    
    const newItems = [...editingTP.items];
    if (field === 'brand_id') {
      const selectedBrand = brands.find(b => b.id === value);
      newItems[index] = {
        ...newItems[index],
        brand_id: value,
        brand: selectedBrand // Update the brand object when brand_id changes
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        [field]: value
      };
    }
    setEditingTP({ ...editingTP, items: newItems });
  };

  const handleDelete = async (tpId: number) => {
    if (!window.confirm('Are you sure you want to delete this TP?')) {
      return;
    }

    try {
      // First verify the TP exists and user has access
      const { data: tp, error: fetchError } = await supabase
        .from('transport_permits')
        .select('id')
        .eq('id', tpId)
        .single();

      if (fetchError) {
        console.error('Error fetching TP:', fetchError);
        throw fetchError;
      }

      if (!tp) {
        throw new Error('TP not found');
      }

      // Delete the TP - tp_items will be automatically deleted due to ON DELETE CASCADE
      const { error: deleteError } = await supabase
        .from('transport_permits')
        .delete()
        .eq('id', tpId);

      if (deleteError) {
        console.error('Error deleting TP:', deleteError);
        throw deleteError;
      }

      toast.success('TP deleted successfully');
      fetchTPs(); // Refresh the list
    } catch (error: any) {
      console.error('Error deleting TP:', error);
      toast.error('Failed to delete TP');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">TP Summary</h1>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by TP No or Party Name..."
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
                  onClick={() => handleSort('tp_no')}
                >
                  <div className="flex items-center gap-1">
                    TP No {getSortIcon('tp_no')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('party_name')}
                >
                  <div className="flex items-center gap-1">
                    Party Name {getSortIcon('party_name')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('tp_date')}
                >
                  <div className="flex items-center gap-1">
                    TP Date {getSortIcon('tp_date')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Total Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Total Qty
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center gap-1">
                    Created At {getSortIcon('created_at')}
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
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : tps.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No TPs found
                  </td>
                </tr>
              ) : (
                tps.map((tp, index) => (
                  <tr key={tp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {totalItems - ((currentPage - 1) * itemsPerPage + index)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {tp.tp_no}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {tp.party_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {format(new Date(tp.tp_date), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {tp.total_items}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {tp.total_qty}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {format(new Date(tp.created_at), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleEdit(tp.id)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Edit TP"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(tp.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete TP"
                        >
                          <Trash2 className="w-5 h-5" />
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

      {/* Edit Modal */}
      {isEditModalOpen && editingTP && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit TP</h2>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* TP Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      TP No
                    </label>
                    <input
                      type="text"
                      value={editingTP.tp_no}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Party
                    </label>
                    <select
                      value={editingTP.party_id}
                      onChange={(e) => setEditingTP({ ...editingTP, party_id: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select Party</option>
                      {parties.map(party => (
                        <option key={party.id} value={party.id}>
                          {party.party_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      TP Date
                    </label>
                    <input
                      type="date"
                      value={editingTP.tp_date}
                      onChange={(e) => setEditingTP({ ...editingTP, tp_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Items</h3>
                    <button
                      onClick={handleAddItem}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4" /> Add Item
                    </button>
                  </div>
                  <div className="space-y-4">
                    {editingTP.items.map((item, index) => (
                      <div key={index} className="flex items-start gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Brand
                          </label>
                          <SearchableBrandSelect
                            value={item.brand_id}
                            onChange={(value) => handleItemChange(index, 'brand_id', value)}
                            brands={brands}
                            selectedBrand={item.brand}
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) => handleItemChange(index, 'qty', Number(e.target.value))}
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="mt-6 p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-4 mt-6">
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateTP}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Updating...' : 'Update TP'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
