import React, { useState } from 'react';
import { useBar } from '../../context/BarContext';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertCircle, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TransferBar() {
  const { selectedBar } = useBar();
  const [isLoading, setIsLoading] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [transferStatus, setTransferStatus] = useState<{
    inventory: boolean;
    brands: boolean;
    customers: boolean;
    party: boolean;
  }>({
    inventory: false,
    brands: false,
    customers: false,
    party: false
  });

  const handleTransfer = async () => {
    if (!selectedBar?.id) {
      toast.error('Please select a bar first');
      return;
    }

    setIsLoading(true);
    try {
      // Step 1: Get closing inventory
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .select('*')
        .eq('bar_id', selectedBar.id)
        .order('created_at', { ascending: false });

      if (inventoryError) throw inventoryError;

      // Get unique brand IDs from inventory
      const brandIds = [...new Set(inventoryData?.map(item => item.brand_id))];

      // Step 2: Get brand details
      const { data: brandsData, error: brandsError } = await supabase
        .from('brands')
        .select('*')
        .in('id', brandIds);

      if (brandsError) throw brandsError;
      setTransferStatus(prev => ({ ...prev, brands: true }));

      // Step 3: Get customer data
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('bar_id', selectedBar.id);

      if (customersError) throw customersError;
      setTransferStatus(prev => ({ ...prev, customers: true }));

      // Step 4: Get party data
      const { data: partyData, error: partyError } = await supabase
        .from('party')
        .select('*')
        .eq('bar_id', selectedBar.id);

      if (partyError) throw partyError;
      setTransferStatus(prev => ({ ...prev, party: true }));

      // Step 5: Create new inventory entries for next year
      const newInventoryData = inventoryData?.map(item => ({
        bar_id: selectedBar.id,
        brand_id: item.brand_id,
        opening_stock: item.closing_stock || 0,
        closing_stock: item.closing_stock || 0,
        created_at: new Date(currentYear + 1, 3, 1).toISOString(), // April 1st of next year
      }));

      const { error: newInventoryError } = await supabase
        .from('inventory')
        .insert(newInventoryData || []);

      if (newInventoryError) throw newInventoryError;
      setTransferStatus(prev => ({ ...prev, inventory: true }));

      toast.success('Successfully transferred data to next financial year');
      setShowConfirmation(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to transfer data');
    } finally {
      setIsLoading(false);
    }
  };

  const ConfirmationDialog = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 transform transition-all duration-300 scale-100">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Confirm Transfer
              </h3>
            </div>
            <button
              onClick={() => setShowConfirmation(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                You are about to transfer data to the next financial year:
              </p>
              <ul className="mt-2 space-y-1 text-yellow-700 dark:text-yellow-300 text-sm">
                <li>• Current Year: {currentYear} - {currentYear + 1}</li>
                <li>• Bar: {selectedBar?.bar_name}</li>
                <li>• All closing stock will become opening stock</li>
                <li>• Customer and party data will be carried forward</li>
              </ul>
            </div>

            <p className="text-gray-600 dark:text-gray-400">
              This action cannot be undone. Are you sure you want to proceed?
            </p>

            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    <span>Confirm Transfer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Transfer Bar to Next Year</h1>
        
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-2">Important Information</h2>
            <ul className="list-disc list-inside space-y-2 text-blue-600 dark:text-blue-400">
              <li>This will transfer your bar data to the next financial year</li>
              <li>Closing stock will become opening stock for next year</li>
              <li>All customer and party information will be carried forward</li>
              <li>Previous year's data will be preserved</li>
            </ul>
          </div>

          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Current Financial Year
              </label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {currentYear} - {currentYear + 1}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transfer Status:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(transferStatus).map(([key, status]) => (
                <div 
                  key={key}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                >
                  {status ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="text-gray-700 dark:text-gray-300 capitalize">{key}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowConfirmation(true)}
            disabled={isLoading}
            className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Transferring...</span>
              </>
            ) : (
              <span>Transfer to Next Year</span>
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && <ConfirmationDialog />}
    </div>
  );
} 