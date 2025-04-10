import React, { useState, useEffect } from 'react';
import { Plus, Loader2, X, Edit2, Trash2, Upload, Download, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useBar } from '../../context/BarContext';
import * as XLSX from 'xlsx';

type Customer = {
  id: number;
  customer_name: string;
  license_number: string;
  bar_id: string;
  created_at: string;
};

export default function CustomerManager() {
  const { selectedBar } = useBar();
  const [isLoading, setIsLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentCustomerId, setCurrentCustomerId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    customer_name: '',
    license_number: '',
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  useEffect(() => {
    if (selectedBar) {
      fetchCustomers();
    } else {
      setIsLoading(false);
    }
  }, [selectedBar]);

  const fetchCustomers = async () => {
    try {
      if (!selectedBar?.id) {
        toast.error('Please select a bar first');
        return;
      }

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('bar_id', selectedBar.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCustomers(data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch customers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBar?.id) {
      toast.error('Please select a bar first');
      return;
    }

    setIsLoading(true);

    try {
      if (isEditMode && currentCustomerId) {
        const { error } = await supabase
          .from('customers')
          .update({
            ...formData,
            bar_id: selectedBar.id
          })
          .eq('id', currentCustomerId);

        if (error) throw error;

        setCustomers(prev =>
          prev.map(customer =>
            customer.id === currentCustomerId
              ? { ...customer, ...formData, bar_id: selectedBar.id.toString() }
              : customer
          )
        );
        toast.success('Customer updated successfully');
      } else {
        const { data, error } = await supabase
          .from('customers')
          .insert([{ ...formData, bar_id: selectedBar.id }])
          .select()
          .single();

        if (error) throw error;

        setCustomers(prev => [{ ...data, bar_id: data.bar_id.toString() }, ...prev]);
        toast.success('Customer added successfully');
      }

      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save customer');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setFormData({
      customer_name: customer.customer_name,
      license_number: customer.license_number,
    });
    setIsEditMode(true);
    setCurrentCustomerId(customer.id);
    setIsModalOpen(true);
  };

  const handleDeleteCustomer = async (customerId: number) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this customer?');
    if (!confirmDelete) return;

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId);

      if (error) throw error;

      setCustomers(prev => prev.filter(customer => customer.id !== customerId));
      toast.success('Customer deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete customer');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_name: '',
      license_number: '',
    });
    setIsEditMode(false);
    setCurrentCustomerId(null);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!selectedBar?.id) {
      toast.error('Please select a bar first');
      return;
    }

    try {
      setIsImporting(true);
      setImportProgress(0);

      // Read Excel file
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          // Validate and transform data
          const customers = jsonData.map((row: any) => ({
            customer_name: row['Customer Name'] || row['customer_name'],
            license_number: row['License Number'] || row['license_number'],
            bar_id: selectedBar.id
          })).filter(customer => customer.customer_name && customer.license_number);

          if (customers.length === 0) {
            toast.error('No valid customer data found in the Excel file');
            return;
          }

          // Insert customers in batches
          const batchSize = 50;
          const totalBatches = Math.ceil(customers.length / batchSize);
          let successCount = 0;

          for (let i = 0; i < customers.length; i += batchSize) {
            const batch = customers.slice(i, i + batchSize);
            const { error } = await supabase
              .from('customers')
              .insert(batch);

            if (error) throw error;
            successCount += batch.length;
            setImportProgress(Math.round((i + batch.length) / customers.length * 100));
          }

          toast.success(`Successfully imported ${successCount} customers`);
          fetchCustomers();
        } catch (error: any) {
          toast.error(error.message || 'Failed to import customers');
        } finally {
          setIsImporting(false);
          setImportProgress(0);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      toast.error('Failed to read file');
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const handleExport = () => {
    if (!selectedBar) {
      toast.error('Please select a bar first');
      return;
    }
    
    try {
      // Prepare data for export
      const exportData = customers.map(customer => ({
        'Customer Name': customer.customer_name,
        'License Number': customer.license_number,
        'Created At': new Date(customer.created_at).toLocaleDateString()
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, 'Customers');

      // Generate Excel file
      XLSX.writeFile(wb, `customers_${selectedBar.bar_name}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Customers exported successfully');
    } catch (error: any) {
      toast.error('Failed to export customers');
    }
  };

  const handleDownloadTemplate = () => {
    try {
      // Create template data with example rows
      const templateData = [
        {
          'Customer Name': 'John Doe',
          'License Number': 'LIC123456'
        },
        {
          'Customer Name': 'Jane Smith',
          'License Number': 'LIC789012'
        }
      ];

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(templateData);

      // Set column widths
      const colWidths = [
        { wch: 30 }, // Customer Name column width
        { wch: 15 }  // License Number column width
      ];
      ws['!cols'] = colWidths;

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Template');

      // Generate Excel file
      XLSX.writeFile(wb, 'customer_import_template.xlsx');
      toast.success('Template downloaded successfully');
    } catch (error: any) {
      toast.error('Failed to download template');
    }
  };

  // If no bar is selected, show a message
  if (!selectedBar) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Customer Manager</h1>
          <p className="text-gray-600 dark:text-gray-400">Please select a bar first to manage customers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Customer Manager</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your customers and their licenses</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Import Button */}
          <div className="relative">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="import-file"
              disabled={isImporting}
            />
            <label
              htmlFor="import-file"
              className={`flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all duration-200 cursor-pointer ${
                isImporting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Upload className="w-5 h-5" />
              <span>Import Excel</span>
            </label>
            {isImporting && (
              <div className="absolute -bottom-8 left-0 w-full">
                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">Importing... {importProgress}%</p>
              </div>
            )}
          </div>

          {/* Download Template Button */}
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-all duration-200"
          >
            <FileText className="w-5 h-5" />
            <span>Download Template</span>
          </button>

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-200"
          >
            <Download className="w-5 h-5" />
            <span>Export Excel</span>
          </button>

          {/* Add Customer Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-200"
          >
            <Plus className="w-5 h-5" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Customers List View */}
      {isLoading ? (
        <div className="flex justify-center items-center min-h-[200px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No customers added yet. Click the button above to add one.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Customer Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    License Number
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {customers.map((customer) => (
                  <tr 
                    key={customer.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {customer.customer_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-300">
                        {customer.license_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => handleEditCustomer(customer)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(customer.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                {isEditMode ? 'Edit Customer' : 'Add New Customer'}
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
                <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Customer Name
                </label>
                <input
                  type="text"
                  id="customer_name"
                  name="customer_name"
                  value={formData.customer_name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter customer name"
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter license number"
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
                    isEditMode ? 'Update Customer' : 'Add Customer'
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

