import React, { useState, useEffect, useRef } from 'react';
import { Save, Loader2, X, Check, AlertCircle, Package, Wallet, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useParams } from 'react-router-dom';
import { useBar } from '../../context/BarContext';

type Brand = {
  id: string;
  brand_name: string;
  item_code: string;
  sizes: string;
  mrp: number;
  shortform?: string;
  category: string;
};

type Party = {
  id: string;
  party_name: string;
};

type TPItem = {
  sr_no: number;
  brand_id: string | null;
  brand_name: string;
  item_code: string;
  size: string;
  mrp: number;
  qty: number;
};

type Bar = {
  id: string;
  bar_name: string;
  license_category: string;
};

type SelectedBrand = Brand & {
  isSelected: boolean;
  qty: number;
};

// Add new types for pagination
type PaginationState = {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
};

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

const CustomCheckbox: React.FC<CheckboxProps> = ({ checked, onCheckedChange, disabled }) => {
  return (
    <button
      type="button"
      onClick={() => !disabled && onCheckedChange(!checked)}
      disabled={disabled}
      className={`w-5 h-5 rounded border ${
        checked 
          ? 'bg-blue-600 border-blue-600 text-white' 
          : 'bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600'
      } flex items-center justify-center transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-500'
      }`}
    >
      {checked && <Check className="w-3 h-3" />}
    </button>
  );
};

export default function EnterTP() {
  const [isLoading, setIsLoading] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [filteredBrands, setFilteredBrands] = useState<Brand[]>([]);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [tpNo, setTpNo] = useState('');
  const [tpDate, setTpDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [currentSrNo, setCurrentSrNo] = useState(1);
  const [items, setItems] = useState<TPItem[]>([]);
  const [currentRow, setCurrentRow] = useState(0);
  const [currentInput, setCurrentInput] = useState('brand_name');
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { selectedBar } = useBar();
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null);
  const [shortcuts, setShortcuts] = useState<{ [key: string]: string }>({});
  const [selectedBrands, setSelectedBrands] = useState<SelectedBrand[]>([]);
  const [paginationState, setPaginationState] = useState<PaginationState>({
    currentPage: 1,
    itemsPerPage: 50,
    totalItems: 0
  });
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedBar) {
      fetchLastSrNo();
      fetchBrands();
      fetchParties();
    }
  }, [selectedBar]);

  // Update selectedBarId when selectedBar changes
  useEffect(() => {
    if (selectedBar) {
      setSelectedBarId(selectedBar.id.toString());
    }
  }, [selectedBar]);

  // Remove fetchBars function since it's now managed by the context

  const fetchLastSrNo = async () => {
    try {
      // Get the count of all TPs for the selected bar
      const { count, error: countError } = await supabase
        .from('transport_permits')
        .select('*', { count: 'exact', head: true })
        .eq('bar_id', selectedBar?.id);

      if (countError) throw countError;

      // The next sr_no will be count + 1
      const nextSrNo = (count || 0) + 1;
      setCurrentSrNo(nextSrNo);
      setItems([{ sr_no: nextSrNo, brand_id: null, brand_name: '', item_code: '', size: '', mrp: 0, qty: 0 }]);
    } catch (error) {
      console.error('Error fetching last sr_no:', error);
      toast.error('Failed to fetch last sr_no');
      // Default to 1 if there's an error
      setCurrentSrNo(1);
      setItems([{ sr_no: 1, brand_id: null, brand_name: '', item_code: '', size: '', mrp: 0, qty: 0 }]);
    }
  };

  const fetchBrands = async () => {
    try {
      setIsLoading(true);
      
      // First, get all shortcuts
      const { data: shortcutData, error: shortcutError } = await supabase
        .from('shortcuts')
        .select('brand_id, shortform');

      if (shortcutError) throw shortcutError;

      // Create shortcuts map
      const shortcutsMap: { [key: string]: string } = {};
      shortcutData?.forEach(item => {
        shortcutsMap[item.brand_id] = item.shortform;
      });

      // Get total count of brands
      const { count, error: countError } = await supabase
        .from('brands')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      // Fetch all brands in chunks
      let allBrands: any[] = [];
      const pageSize = 1000; // Supabase limit per request
      const totalPages = Math.ceil((count || 0) / pageSize);

      for (let page = 0; page < totalPages; page++) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data: brandsPage, error: brandsError } = await supabase
          .from('brands')
          .select('*')
          .order('brand_name')
          .range(from, to);

        if (brandsError) throw brandsError;
        allBrands = [...allBrands, ...(brandsPage || [])];

        // Update loading message
        toast.loading(
          `Loading brands... ${Math.min((page + 1) * pageSize, count || 0)} of ${count}`,
          { id: 'loading-brands' }
        );
      }

      // Add shortcuts to brands
      const brandsWithShortcuts = allBrands.map(brand => ({
        ...brand,
        shortform: shortcutsMap[brand.id] || ''
      }));

      setBrands(brandsWithShortcuts);
      setShortcuts(shortcutsMap);
      toast.success(`Loaded ${brandsWithShortcuts.length} brands successfully`, {
        id: 'loading-brands'
      });
    } catch (error: any) {
      console.error('Error fetching brands:', error);
      toast.error('Failed to fetch brands', { id: 'loading-brands' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchParties = async () => {
    try {
      const { data, error } = await supabase
        .from('parties')
        .select('*')
        .order('party_name');

      if (error) throw error;
      setParties(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch parties');
    }
  };

  // Add pagination calculation
  const getPaginatedBrands = () => {
    const startIndex = (paginationState.currentPage - 1) * paginationState.itemsPerPage;
    return filteredBrands.slice(startIndex, startIndex + paginationState.itemsPerPage);
  };

  // Add keyboard navigation handler
  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (!showBrandModal) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < getPaginatedBrands().length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          const selectedBrand = getPaginatedBrands()[selectedIndex];
          if (selectedBrand) {
            handleBrandSelect(selectedBrand);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowBrandModal(false);
        setSearchQuery('');
        setSelectedBrands([]);
        break;
    }
  };

  // Update useEffect to scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && tableRef.current) {
      const selectedRow = tableRef.current.querySelector(`[data-row-index="${selectedIndex}"]`);
      if (selectedRow) {
        selectedRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // Update brand search to include pagination
  const handleBrandSearch = (value: string, rowIndex: number) => {
    const searchTerm = value.toLowerCase();
    setSearchQuery(value);
    setSelectedRowIndex(rowIndex);
    setShowBrandModal(true);
    setSelectedIndex(-1);

    // Filter brands by name, item code, shortcut, or initial letters of shortcut
    let filtered = brands.filter(brand => {
      const nameMatch = brand.brand_name.toLowerCase().includes(searchTerm);
      const itemCodeMatch = brand.item_code.toLowerCase().includes(searchTerm);
      const exactShortcutMatch = brand.shortform?.toLowerCase().includes(searchTerm);
      const shortcutInitialsMatch = brand.shortform?.split(' ').some(word => {
        const initials = word.split('').map(char => char.toLowerCase());
        return searchTerm.split('').every((char, index) => {
          return index < initials.length && char === initials[index];
        });
      });

      return nameMatch || itemCodeMatch || exactShortcutMatch || shortcutInitialsMatch;
    });

    // Filter out spirits for beer shops
    if (selectedBar?.license_category === 'beer_shop') {
      filtered = filtered.filter(brand => brand.category !== 'Spirits');
    }

    // Sort results to prioritize shortcut matches
    const sortedResults = filtered.sort((a, b) => {
      const aShortcut = a.shortform?.toLowerCase() || '';
      const bShortcut = b.shortform?.toLowerCase() || '';
      
      const aStartsWithSearch = aShortcut.startsWith(searchTerm);
      const bStartsWithSearch = bShortcut.startsWith(searchTerm);
      
      if (aStartsWithSearch && !bStartsWithSearch) return -1;
      if (!aStartsWithSearch && bStartsWithSearch) return 1;
      
      if (aShortcut && bShortcut) {
        return aShortcut.length - bShortcut.length;
      }
      
      return 0;
    });

    setFilteredBrands(sortedResults);
    setPaginationState(prev => ({
      ...prev,
      currentPage: 1,
      totalItems: sortedResults.length
    }));
  };

  const handleBrandSelect = (brand: Brand) => {
    if (selectedRowIndex === null) return;

    const newItems = [...items];
    newItems[selectedRowIndex] = {
      ...newItems[selectedRowIndex],
      brand_id: brand.id,
      brand_name: brand.brand_name,
      item_code: brand.item_code,
      size: brand.sizes,
      mrp: brand.mrp
    };
    setItems(newItems);
    setShowBrandModal(false);
    setSearchQuery('');
    
    // Move focus to qty input
    setCurrentInput('qty');
    setTimeout(() => {
      inputRefs.current[`qty_${selectedRowIndex}`]?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (currentInput === 'qty') {
        // If it's the last row, add a new row
        if (rowIndex === items.length - 1) {
          const newItems = [...items, {
            sr_no: currentSrNo + items.length,
            brand_id: null,
            brand_name: '',
            item_code: '',
            size: '',
            mrp: 0,
            qty: 0
          }];
          setItems(newItems);
          setCurrentRow(rowIndex + 1);
          setCurrentInput('brand_name');
          setTimeout(() => {
            inputRefs.current[`brand_name_${rowIndex + 1}`]?.focus();
          }, 0);
        }
      }
    }
  };

  const handleSaveTP = async () => {
    if (!selectedBar) {
      toast.error('Please select a bar');
      return;
    }

    if (!selectedParty) {
      toast.error('Please select a party');
      return;
    }

    if (!tpNo) {
      toast.error('Please enter TP number');
      return;
    }

    if (!items.some(item => item.brand_id && item.qty > 0)) {
      toast.error('Please add at least one item');
      return;
    }

    // Check for spirits in beer shop
    if (selectedBar.license_category === 'beer_shop') {
      const hasSpirits = items.some(item => {
        const brand = brands.find(b => b.id === item.brand_id);
        return brand?.category === 'Spirits' && item.qty > 0;
      });

      if (hasSpirits) {
        toast.error('Beer shops cannot have spirits in their TP entries');
        return;
      }
    }

    setIsLoading(true);

    try {
      // Get the current user's ID
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not authenticated');

      console.log('User authenticated:', user.id);

      // Check if TP number already exists for this bar
      const { data: existingTP, error: checkError } = await supabase
        .from('transport_permits')
        .select('id')
        .eq('tp_no', tpNo)
        .eq('bar_id', selectedBar.id)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking for existing TP:', checkError);
        throw new Error(`Failed to check for existing TP: ${checkError.message}`);
      }

      if (existingTP) {
        toast.error('A TP with this number already exists for this bar');
        setIsLoading(false);
        return;
      }

      // Validate items before saving
      const validItems = items.filter(item => item.brand_id && item.qty > 0);
      if (validItems.length === 0) {
        toast.error('Please add at least one valid item');
        setIsLoading(false);
        return;
      }

      console.log('Saving TP with data:', {
        tp_no: tpNo,
        party_id: selectedParty.id,
        tp_date: tpDate,
        bar_id: selectedBar.id,
        created_by: user.id
      });

      // First attempt to insert TP without requiring the data back
      const { data: insertedTP, error: insertError } = await supabase
        .from('transport_permits')
        .insert([
          {
            tp_no: tpNo,
            party_id: selectedParty.id,
            tp_date: tpDate,
            bar_id: selectedBar.id,
            created_by: user.id
          }
        ])
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting transport permit:', insertError);
        throw new Error(`Failed to create transport permit: ${insertError.message}`);
      }

      // Now fetch the inserted TP using the TP number and bar_id
      const { data: fetchedTP, error: fetchError } = await supabase
        .from('transport_permits')
        .select('id')
        .eq('tp_no', tpNo)
        .eq('bar_id', selectedBar.id)
        .single();

      if (fetchError) {
        console.error('Error fetching inserted transport permit:', fetchError);
        throw new Error(`Failed to retrieve the created transport permit: ${fetchError.message}`);
      }

      if (!fetchedTP) {
        throw new Error('Transport permit was created but could not be retrieved');
      }

      console.log('Transport permit created successfully:', fetchedTP);

      // Prepare TP items with the required fields
      const tpItems = validItems.map(item => ({
        tp_id: Number(fetchedTP.id),
        brand_id: Number(item.brand_id),
        qty: Number(item.qty),
        bar_id: selectedBar.id  // Include bar_id
      }));

      console.log('Saving TP items (with bar_id):', tpItems);

      // Insert TP items
      const { error: itemsError } = await supabase
        .from('tp_items')
        .insert(tpItems);

      if (itemsError) {
        console.error('Error inserting TP items:', itemsError);
        // Try to delete the TP if items couldn't be saved
        await supabase.from('transport_permits').delete().eq('id', fetchedTP.id);
        throw new Error(`Failed to save TP items: ${itemsError.message}`);
      }

      // Now fetch the inserted items to confirm
      const { data: savedItems, error: fetchItemsError } = await supabase
        .from('tp_items')
        .select('*')
        .eq('tp_id', fetchedTP.id);

      if (fetchItemsError) {
        console.error('Error fetching inserted items:', fetchItemsError);
        // This is not critical, so we won't throw an error
      } else {
        console.log('TP items saved successfully:', savedItems);
      }

      toast.success('TP saved successfully');
      // Reset form
      setTpNo('');
      setSelectedParty(null);
      setItems([{ sr_no: 1, brand_id: null, brand_name: '', item_code: '', size: '', mrp: 0, qty: 0 }]);
    } catch (error: any) {
      console.error('Error saving TP:', error);
      toast.error(error.message || 'Failed to save TP');
    } finally {
      setIsLoading(false);
    }
  };

  // Add pagination controls component
  const PaginationControls = () => {
    const totalPages = Math.ceil(paginationState.totalItems / paginationState.itemsPerPage);
    const startItem = (paginationState.currentPage - 1) * paginationState.itemsPerPage + 1;
    const endItem = Math.min(startItem + paginationState.itemsPerPage - 1, paginationState.totalItems);

    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
          Showing {startItem} to {endItem} of {paginationState.totalItems} results
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setPaginationState(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
            disabled={paginationState.currentPage === 1}
            className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
            Page {paginationState.currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setPaginationState(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
            disabled={paginationState.currentPage === totalPages}
            className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  // Update the renderBrandSelectionModal function
  const renderBrandSelectionModal = () => {
    if (!showBrandModal) return null;

    const paginatedBrands = getPaginatedBrands();

    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onKeyDown={handleModalKeyDown}
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] flex flex-col">
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Select Brands</h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {filteredBrands.length} brands found
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const selectedItems = selectedBrands
                    .filter(brand => brand.isSelected && brand.qty > 0)
                    .map(brand => ({
                      sr_no: items.length + 1,
                      brand_id: brand.id,
                      brand_name: brand.brand_name,
                      item_code: brand.item_code,
                      size: brand.sizes,
                      mrp: brand.mrp,
                      qty: brand.qty
                    }));

                  if (selectedItems.length > 0) {
                    const newItems = [...items];
                    if (newItems[newItems.length - 1].brand_id === null) {
                      newItems.pop();
                    }
                    selectedItems.forEach((item, index) => {
                      newItems.push({
                        ...item,
                        sr_no: newItems.length + 1
                      });
                    });
                    setItems(newItems);
                  }
                  setShowBrandModal(false);
                  setSearchQuery('');
                  setSelectedBrands([]);
                }}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Add Selected ({selectedBrands.filter(b => b.isSelected && b.qty > 0).length})
              </button>
              <button
                onClick={() => {
                  setShowBrandModal(false);
                  setSearchQuery('');
                  setSelectedBrands([]);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="p-3 flex-1 flex flex-col min-h-0">
            <div className="mb-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleBrandSearch(e.target.value, selectedRowIndex || 0)}
                className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Search by brand name, item code or shortcut..."
                autoFocus
              />
            </div>
            
            <div className="flex-1 overflow-hidden min-h-0">
              <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-12">
                        Select
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-20">
                        Shortcut
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Brand Name & Item Code
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-24">
                        Category
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-20">
                        Size
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-20">
                        MRP
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-24">
                        Quantity
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {paginatedBrands.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-2 text-center text-xs text-gray-500 dark:text-gray-400">
                          No brands found
                        </td>
                      </tr>
                    ) : (
                      paginatedBrands.map((brand, index) => {
                        const selectedBrand = selectedBrands.find(b => b.id === brand.id);
                        const isSelected = selectedIndex === index;
                        const isSpirits = brand.category === 'Spirits';
                        const isDisabled = selectedBar?.license_category === 'beer_shop' && isSpirits;

                        return (
                          <tr
                            key={brand.id}
                            data-row-index={index}
                            className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                              isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                            } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => !isDisabled && setSelectedIndex(index)}
                          >
                            <td className="px-3 py-2 whitespace-nowrap">
                              <CustomCheckbox
                                checked={selectedBrand?.isSelected || false}
                                onCheckedChange={(checked) => {
                                  if (isDisabled) return;
                                  const newSelectedBrands = [...selectedBrands];
                                  const index = newSelectedBrands.findIndex(b => b.id === brand.id);
                                  if (index === -1) {
                                    newSelectedBrands.push({
                                      ...brand,
                                      isSelected: checked,
                                      qty: 0
                                    });
                                  } else {
                                    newSelectedBrands[index].isSelected = checked;
                                  }
                                  setSelectedBrands(newSelectedBrands);
                                }}
                                disabled={isDisabled}
                              />
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-white">
                              {brand.shortform || '-'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 dark:text-white">
                              <div className="flex items-center">
                                <span className="font-medium">{brand.brand_name}</span>
                                <span className="ml-2 px-2 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium border border-green-100 dark:border-green-800">
                                  {brand.item_code}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium 
                                ${isSpirits ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' : ''}
                                ${brand.category === 'Wines' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' : ''}
                                ${brand.category === 'Fermented Beer' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' : ''}
                                ${brand.category === 'Mild Beer' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : ''}
                              `}>
                                {brand.category}
                              </span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                              {brand.sizes}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                              ₹{brand.mrp}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <input
                                type="number"
                                min="0"
                                value={selectedBrand?.qty || ''}
                                onChange={(e) => {
                                  if (isDisabled) return;
                                  const newSelectedBrands = [...selectedBrands];
                                  const index = newSelectedBrands.findIndex(b => b.id === brand.id);
                                  if (index === -1) {
                                    newSelectedBrands.push({
                                      ...brand,
                                      isSelected: true,
                                      qty: Number(e.target.value)
                                    });
                                  } else {
                                    newSelectedBrands[index].qty = Number(e.target.value);
                                    newSelectedBrands[index].isSelected = true;
                                  }
                                  setSelectedBrands(newSelectedBrands);
                                }}
                                className={`w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                                  isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                                disabled={isDisabled || !selectedBrand?.isSelected}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <PaginationControls />
          </div>
        </div>
      </div>
    );
  };

  // Replace the existing renderBeerShopWarning with a new corner warning indicator
  const renderBeerShopWarning = () => {
    if (selectedBar?.license_category === 'beer_shop') {
      return (
        <div className="fixed bottom-4 left-4 z-50">
          <div className="relative group">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center shadow-lg">
              <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 shadow-lg w-64">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Beer shops cannot add spirits to TP entries. Only beer and wine items are available.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Bar
            </label>
            <input
              type="text"
              value={selectedBar?.bar_name || ''}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sr. No
            </label>
            <input
              type="text"
              value={currentSrNo}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              TP No
            </label>
            <input
              type="text"
              value={tpNo}
              onChange={(e) => setTpNo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="Enter TP No"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Party Name
            </label>
            <select
              value={selectedParty?.id || ''}
              onChange={(e) => {
                const party = parties.find(p => p.id === e.target.value);
                setSelectedParty(party || null);
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date
            </label>
            <input
              type="date"
              value={tpDate}
              onChange={(e) => setTpDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Remove the old warning message and add the new corner warning */}
      {renderBeerShopWarning()}

      {/* Items Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Sr. No
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  MRP
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Qty
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {items.map((item, index) => (
                <tr key={item.sr_no}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {item.sr_no}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="relative">
                      <input
                        ref={el => inputRefs.current[`brand_name_${index}`] = el}
                        type="text"
                        value={item.brand_name}
                        onChange={(e) => handleBrandSearch(e.target.value.slice(0, 25), index)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        maxLength={25}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        {item.brand_name.length}/25
                      </div>
                      {showBrandModal && selectedRowIndex === index && (
                        renderBrandSelectionModal()
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {item.item_code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {item.size}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    ₹{item.mrp.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      ref={el => inputRefs.current[`qty_${index}`] = el}
                      type="number"
                      value={item.qty || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index] = {
                          ...newItems[index],
                          qty: Number(e.target.value)
                        };
                        setItems(newItems);
                      }}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      min="0"
                      className="w-24 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const newItems = [...items];
                          newItems.splice(index + 1, 0, {
                            sr_no: currentSrNo + index + 1,
                            brand_id: null,
                            brand_name: '',
                            item_code: '',
                            size: '',
                            mrp: 0,
                            qty: 0
                          });
                          // Update sr_no for all subsequent items
                          for (let i = index + 2; i < newItems.length; i++) {
                            newItems[i].sr_no = currentSrNo + i;
                          }
                          setItems(newItems);
                          setCurrentRow(index + 1);
                          setCurrentInput('brand_name');
                          setTimeout(() => {
                            inputRefs.current[`brand_name_${index + 1}`]?.focus();
                          }, 0);
                        }}
                        className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        title="Add row below"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (items.length > 1) {
                            const newItems = items.filter((_, i) => i !== index);
                            // Update sr_no for remaining items
                            newItems.forEach((item, i) => {
                              item.sr_no = currentSrNo + i;
                            });
                            setItems(newItems);
                            if (currentRow === index) {
                              setCurrentRow(Math.max(0, index - 1));
                            } else if (currentRow > index) {
                              setCurrentRow(currentRow - 1);
                            }
                          }
                        }}
                        className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete row"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Minimal Summary Line */}
      <div className="mt-4 flex items-center justify-end gap-4 text-sm text-gray-600 dark:text-gray-400">
        <span>Total Quantity: <span className="font-semibold text-gray-900 dark:text-white">{items.reduce((sum, item) => sum + (item.qty || 0), 0)}</span></span>
        <span>|</span>
        <span>Total MRP: <span className="font-semibold text-gray-900 dark:text-white">₹{items.reduce((sum, item) => sum + ((item.mrp || 0) * (item.qty || 0)), 0).toLocaleString()}</span></span>
      </div>

      {renderBrandSelectionModal()}

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSaveTP}
          disabled={isLoading}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>Save TP</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
