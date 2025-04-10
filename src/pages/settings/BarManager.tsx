import React, { useState, useEffect } from 'react';
import { Plus, X, MapPin, User, FileText, Calendar, Loader2, Pencil, Trash2, Check, AlertCircle, Beer, Wine, Martini } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface Bar {
  id: string;
  bar_name: string;
  licensee_name: string;
  license_number: string;
  license_category: 'bar' | 'beer_shop' | 'wine_shop';
  address: string;
  financial_year_start: string;
  financial_year_end: string;
  created_at: string;
  updated_at: string;
}

export default function BarManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bars, setBars] = useState<Bar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingBar, setEditingBar] = useState<Bar | null>(null);
  const [formData, setFormData] = useState({
    bar_name: '',
    licensee_name: '',
    license_number: '',
    license_category: 'bar' as Bar['license_category'],
    address: '',
    financial_year_start: '',
  });

  // Fetch bars on component mount
  useEffect(() => {
    fetchBars();
  }, []);

  const fetchBars = async () => {
    try {
      const { data, error } = await supabase
        .from('bars')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setBars(data || []);
    } catch (error) {
      console.error('Error fetching bars:', error);
      toast.error('Failed to load bars');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateFinancialYearEnd = (startDate: string) => {
    if (!startDate) return '';
    const start = new Date(startDate);
    const end = new Date(start);
    
    // If start date is before April 1st, set end date to March 31st of the same year
    // If start date is on or after April 1st, set end date to March 31st of the next year
    if (start.getMonth() < 3) { // March is 2 (0-based)
      // Keep the same year
      end.setMonth(2); // March
      end.setDate(31);
    } else {
      // Set to next year
      end.setFullYear(start.getFullYear() + 1);
      end.setMonth(2); // March
      end.setDate(31);
    }
    
    return end.toISOString().split('T')[0];
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEdit = (bar: Bar) => {
    setEditingBar(bar);
    setFormData({
      bar_name: bar.bar_name,
      licensee_name: bar.licensee_name,
      license_number: bar.license_number,
      license_category: bar.license_category,
      address: bar.address,
      financial_year_start: bar.financial_year_start,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const financial_year_end = calculateFinancialYearEnd(formData.financial_year_start);
      
      if (editingBar) {
        const { data, error } = await supabase
          .from('bars')
          .update({
            ...formData,
            financial_year_end,
          })
          .eq('id', editingBar.id)
          .select()
          .single();

        if (error) throw error;

        setBars(prev => prev.map(bar => bar.id === editingBar.id ? data : bar));
        toast.success(`Bar "${formData.bar_name}" updated successfully`, {
          duration: 3000,
          position: 'top-center',
          icon: '🎉',
        });
      } else {
        const { data, error } = await supabase
          .from('bars')
          .insert([
            {
              ...formData,
              financial_year_end,
            }
          ])
          .select()
          .single();

        if (error) throw error;

        setBars(prev => [data, ...prev]);
        toast.success(`Bar "${formData.bar_name}" added successfully`, {
          duration: 3000,
          position: 'top-center',
          icon: '🎉',
        });
      }

      resetForm();
      setIsModalOpen(false);
      setEditingBar(null);
    } catch (error) {
      console.error('Error saving bar:', error);
      toast.error(editingBar ? 'Failed to update bar' : 'Failed to add bar');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      bar_name: '',
      licensee_name: '',
      license_number: '',
      license_category: 'bar',
      address: '',
      financial_year_start: '',
    });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBar(null);
    resetForm();
  };

  const getLicenseCategoryIcon = (category: string) => {
    switch (category) {
      case 'bar':
        return <Martini className="w-4 h-4" />;
      case 'beer_shop':
        return <Beer className="w-4 h-4" />;
      case 'wine_shop':
        return <Wine className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getLicenseCategoryColor = (category: string) => {
    switch (category) {
      case 'bar':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'beer_shop':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'wine_shop':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getLicenseCategoryLabel = (category: string) => {
    switch (category) {
      case 'bar':
        return 'Bar';
      case 'beer_shop':
        return 'Beer Shop';
      case 'wine_shop':
        return 'Wine Shop';
      default:
        return category;
    }
  };

  const handleLicenseCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value as Bar['license_category'];
    setFormData(prev => ({
      ...prev,
      license_category: category,
      // Reset any spirits-related fields if switching to beer_shop
      ...(category === 'beer_shop' && {
        // Add any spirits-related fields here that should be reset
      })
    }));
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this bar?')) return;

    try {
      const { error } = await supabase
        .from('bars')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setBars(prev => prev.filter(bar => bar.id !== id));
      toast.success('Bar deleted successfully');
    } catch (error) {
      console.error('Error deleting bar:', error);
      toast.error('Failed to delete bar');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Bar Manager</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your bars and their licenses</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Plus className="w-5 h-5" />
          )}
          <span>Add New Bar</span>
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-gray-500 dark:text-gray-400">Loading bars...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && bars.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No bars added yet. Click the button above to add one.</p>
        </div>
      )}

      {/* Card Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bars.filter(bar => bar !== null).map(bar => (
            <div 
              key={bar.id} 
              className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-700"
            >
              {/* Card Header */}
              <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-start">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                    {bar?.bar_name || 'Unnamed Bar'}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1.5 ${getLicenseCategoryColor(bar?.license_category || 'bar')}`}>
                    {getLicenseCategoryIcon(bar?.license_category || 'bar')}
                    {getLicenseCategoryLabel(bar?.license_category || 'bar')}
                  </span>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3 text-gray-600 dark:text-gray-300">
                  <User className="w-5 h-5 mt-0.5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Licensee</p>
                    <p>{bar?.licensee_name || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-gray-600 dark:text-gray-300">
                  <FileText className="w-5 h-5 mt-0.5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">License Number</p>
                    <p>{bar?.license_number || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-gray-600 dark:text-gray-300">
                  <MapPin className="w-5 h-5 mt-0.5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</p>
                    <p>{bar?.address || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-gray-600 dark:text-gray-300">
                  <Calendar className="w-5 h-5 mt-0.5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Financial Year</p>
                    <p>{bar?.financial_year_start ? new Date(bar.financial_year_start).toLocaleDateString() : 'N/A'} - {bar?.financial_year_end ? new Date(bar.financial_year_end).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
                <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => bar && handleEdit(bar)}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  <button 
                    onClick={() => bar?.id && handleDelete(bar.id)}
                    className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Bar Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div 
            className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-xl transform transition-all duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                {editingBar ? 'Edit Bar' : 'Add New Bar'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label htmlFor="bar_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bar Name
                </label>
                <input
                  type="text"
                  id="bar_name"
                  name="bar_name"
                  value={formData.bar_name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                  placeholder="Enter bar name"
                />
              </div>

              <div>
                <label htmlFor="license_category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  License Category
                </label>
                <div className="relative">
                  <select
                    id="license_category"
                    name="license_category"
                    value={formData.license_category}
                    onChange={handleLicenseCategoryChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200 appearance-none"
                  >
                    <option value="bar">Bar</option>
                    <option value="beer_shop">Beer Shop</option>
                    <option value="wine_shop">Wine Shop</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {getLicenseCategoryIcon(formData.license_category)}
                  </div>
                </div>
                {formData.license_category === 'beer_shop' && (
                  <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                    Note: Spirits-related options will be automatically disabled for Beer Shops
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="licensee_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Licensee Name
                </label>
                <input
                  type="text"
                  id="licensee_name"
                  name="licensee_name"
                  value={formData.licensee_name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                  placeholder="Enter licensee name"
                />
              </div>

              <div>
                <label htmlFor="license_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  License Number
                </label>
                <input
                  type="text"
                  id="license_number"
                  name="license_number"
                  value={formData.license_number}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                  placeholder="Enter license number"
                />
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
                  required
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                  placeholder="Enter complete address"
                />
              </div>

              <div>
                <label htmlFor="financial_year_start" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Financial Year Start Date
                </label>
                <input
                  type="date"
                  id="financial_year_start"
                  name="financial_year_start"
                  value={formData.financial_year_start}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                />
              </div>

              {formData.financial_year_start && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Financial Year End Date
                  </label>
                  <input
                    type="date"
                    value={calculateFinancialYearEnd(formData.financial_year_start)}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
                  />
                </div>
              )}

              <div className="flex justify-end gap-4 mt-8">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 transition-all duration-200"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{editingBar ? 'Updating...' : 'Adding...'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {editingBar ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Update Bar</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Add Bar</span>
                        </>
                      )}
                    </div>
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
