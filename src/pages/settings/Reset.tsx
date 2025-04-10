import { useState } from 'react';
import { useBar } from '../../context/BarContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';

export default function Reset() {
  const { selectedBar } = useBar();
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleReset = async () => {
    if (!selectedBar) return;

    setLoading(true);
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

      // Delete data in the correct order to handle foreign key constraints
      // 1. Delete daily sales first (no dependencies)
      const { error: salesError } = await supabase
        .from('daily_sales')
        .delete()
        .eq('bar_id', selectedBar.id);

      if (salesError) {
        console.error('Error deleting daily sales:', salesError);
        throw salesError;
      }

      // 2. First get all transport permit IDs for this bar
      const { data: transportPermits, error: tpError } = await supabase
        .from('transport_permits')
        .select('id')
        .eq('bar_id', selectedBar.id);

      if (tpError) {
        console.error('Error fetching transport permits:', tpError);
        throw tpError;
      }

      // 3. Delete tp_items for each transport permit
      if (transportPermits && transportPermits.length > 0) {
        const tpIds = transportPermits.map(tp => tp.id);
        const { error: tpItemsError } = await supabase
          .from('tp_items')
          .delete()
          .in('tp_id', tpIds);

        if (tpItemsError) {
          console.error('Error deleting tp_items:', tpItemsError);
          throw tpItemsError;
        }
      }

      // 4. Delete transport permits
      const { error: tpDeleteError } = await supabase
        .from('transport_permits')
        .delete()
        .eq('bar_id', selectedBar.id);

      if (tpDeleteError) {
        console.error('Error deleting transport permits:', tpDeleteError);
        throw tpDeleteError;
      }

      // 5. Delete inventory
      const { error: inventoryError } = await supabase
        .from('inventory')
        .delete()
        .eq('bar_id', selectedBar.id);

      if (inventoryError) {
        console.error('Error deleting inventory:', inventoryError);
        throw inventoryError;
      }

      // 6. Finally delete bar user access
      const { error: barUsersError } = await supabase
        .from('bar_users')
        .delete()
        .eq('bar_id', selectedBar.id);

      if (barUsersError) {
        console.error('Error deleting bar users:', barUsersError);
        throw barUsersError;
      }

      toast.success('All data has been reset successfully');
      setShowConfirmation(false);
      setConfirmText('');
    } catch (error) {
      console.error('Error resetting data:', error);
      toast.error('Failed to reset data');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedBar) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Please select a bar first</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Reset Data</h1>
        <p className="text-gray-600 dark:text-gray-400">Reset all data for the selected bar</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Warning: This action cannot be undone
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This will permanently delete all data for {selectedBar.bar_name}, including:
            </p>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-6 space-y-2">
              <li>All inventory records</li>
              <li>All daily sales data</li>
              <li>All transport permit entries</li>
              <li>All bar user access records</li>
            </ul>
          </div>
        </div>

        {!showConfirmation ? (
          <button
            onClick={() => setShowConfirmation(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Reset All Data
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="confirmText" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type <span className="font-semibold">RESET</span> to confirm
              </label>
              <input
                type="text"
                id="confirmText"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                placeholder="Type RESET to confirm"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                disabled={loading || confirmText !== 'RESET'}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                  loading || confirmText !== 'RESET'
                    ? 'bg-red-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Confirm Reset
              </button>
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  setConfirmText('');
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 