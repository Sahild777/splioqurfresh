import React, { useState, useEffect } from 'react';
import { Plus, Loader2, X, Edit2, Trash2, MapPin, User, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

type Party = {
  id: string;
  party_name: string;
  address: string;
  created_at: string;
  updated_at: string;
};

export default function PartyManager() {
  const [isLoading, setIsLoading] = useState(true);
  const [parties, setParties] = useState<Party[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentPartyId, setCurrentPartyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 9;
  const [formData, setFormData] = useState({
    party_name: '',
    address: '',
  });
  const [formErrors, setFormErrors] = useState({
    party_name: '',
    address: '',
  });

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1); // Reset to first page when searching
      fetchParties();
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch parties when page changes
  useEffect(() => {
    fetchParties();
  }, [currentPage]);

  const fetchParties = async () => {
    try {
      setIsLoading(true);
      
      // Build the query
      let query = supabase
        .from('parties')
        .select('*', { count: 'exact' });

      // Apply search filter if query exists
      if (searchQuery.trim()) {
        query = query.or(`party_name.ilike.%${searchQuery.trim()}%,address.ilike.%${searchQuery.trim()}%`);
      }

      // Apply pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      // Get total count first
      const { count } = await query;
      setTotalCount(count || 0);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));

      // Then get the paginated data
      const { data, error } = await query
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Validate and set the data
      const validParties = (data || []).filter((party): party is Party => {
        if (!party || typeof party !== 'object') return false;
        return (
          typeof party.id === 'string' &&
          typeof party.party_name === 'string' &&
          typeof party.address === 'string' &&
          typeof party.created_at === 'string' &&
          typeof party.updated_at === 'string'
        );
      });

      setParties(validParties);
    } catch (error: any) {
      console.error('Error fetching parties:', error);
      toast.error(error.message || 'Failed to fetch parties');
      setParties([]);
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {
      party_name: '',
      address: '',
    };
    let isValid = true;

    if (!formData.party_name.trim()) {
      errors.party_name = 'Party name is required';
      isValid = false;
    } else if (formData.party_name.length > 255) {
      errors.party_name = 'Party name must be less than 255 characters';
      isValid = false;
    }

    if (!formData.address.trim()) {
      errors.address = 'Address is required';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (formErrors[name as keyof typeof formErrors]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      let result;
      if (isEditMode && currentPartyId) {
        result = await supabase
          .from('parties')
          .update({
            party_name: formData.party_name.trim(),
            address: formData.address.trim(),
          })
          .eq('id', currentPartyId)
          .select()
          .single();
      } else {
        result = await supabase
          .from('parties')
          .insert([{
            party_name: formData.party_name.trim(),
            address: formData.address.trim(),
          }])
          .select()
          .single();
      }

      const { data, error } = result;

      if (error) throw error;

      // Refresh the data after successful operation
      await fetchParties();

      setIsModalOpen(false);
      resetForm();
      setIsEditMode(false);
      setCurrentPartyId(null);
      toast.success(isEditMode ? 'Party updated successfully' : 'Party added successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save party');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditParty = (party: Party) => {
    setFormData({
      party_name: party.party_name,
      address: party.address,
    });
    setIsEditMode(true);
    setCurrentPartyId(party.id);
    setIsModalOpen(true);
  };

  const handleDeleteParty = async (partyId: string) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this party?');
    if (!confirmDelete) return;

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('parties')
        .delete()
        .eq('id', partyId);

      if (error) throw error;

      // Refresh the data after successful deletion
      await fetchParties();
      
      toast.success('Party deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete party');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      party_name: '',
      address: '',
    });
    setFormErrors({
      party_name: '',
      address: '',
    });
    setIsEditMode(false);
    setCurrentPartyId(null);
  };

  const filteredParties = parties.filter(party => 
    party.party_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    party.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Party Manager</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your parties and their details</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          <Plus className="w-5 h-5" />
          <span>Add Party</span>
        </button>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search parties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <Filter className="w-5 h-5" />
          <span>Filter</span>
        </button>
      </div>

      {/* Parties Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : parties.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <p className="text-gray-500 dark:text-gray-400">No parties found. Click the button above to add one.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredParties.map((party) => (
              <div
                key={party.id}
                className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                        {party.party_name}
                      </h3>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEditParty(party)}
                        className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteParty(party.id)}
                        className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex items-start gap-3">
                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <MapPin className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 flex-1">{party.address}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center items-center gap-4">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1 || isLoading}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-500">
                  ({totalCount} total items)
                </span>
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || isLoading}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Party Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-xl transform transition-all">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                {isEditMode ? 'Edit Party' : 'Add New Party'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label htmlFor="party_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Party Name
                </label>
                <input
                  type="text"
                  id="party_name"
                  name="party_name"
                  value={formData.party_name}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors
                    ${formErrors.party_name 
                      ? 'border-red-500 dark:border-red-500' 
                      : 'border-gray-300 dark:border-gray-600'}`}
                  placeholder="Enter party name"
                />
                {formErrors.party_name && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.party_name}</p>
                )}
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Address
                </label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={3}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none transition-colors
                    ${formErrors.address 
                      ? 'border-red-500 dark:border-red-500' 
                      : 'border-gray-300 dark:border-gray-600'}`}
                  placeholder="Enter address"
                />
                {formErrors.address && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.address}</p>
                )}
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isEditMode ? 'Updating...' : 'Adding...'}</span>
                    </div>
                  ) : (
                    isEditMode ? 'Update Party' : 'Add Party'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

