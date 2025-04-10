import React from 'react';
import { X, Calendar, ArrowRight, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface InventoryHistory {
  date: string;
  opening_qty: number;
  receipt_qty: number;
  sale_qty: number;
  closing_qty: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  brandId: number;
  brandName: string;
  startDate: string;
  endDate: string;
}

export default function InventoryHistoryModal({ isOpen, onClose, brandId, brandName, startDate, endDate }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [history, setHistory] = React.useState<InventoryHistory[]>([]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage] = React.useState(10);
  const [totalPages, setTotalPages] = React.useState(1);

  React.useEffect(() => {
    if (isOpen && brandId) {
      fetchInventoryHistory();
    }
  }, [isOpen, brandId, startDate, endDate]);

  React.useEffect(() => {
    if (history.length > 0) {
      setTotalPages(Math.ceil(history.length / itemsPerPage));
    }
  }, [history, itemsPerPage]);

  const fetchInventoryHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory')
        .select('date, opening_qty, receipt_qty, sale_qty, closing_qty')
        .eq('brand_id', brandId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;

      setHistory(data || []);
      setCurrentPage(1); // Reset to first page when new data is loaded
    } catch (error) {
      console.error('Error fetching inventory history:', error);
      toast.error('Failed to fetch inventory history');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentItems = () => {
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return history.slice(indexOfFirstItem, indexOfLastItem);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleExcelDownload = () => {
    try {
      // Prepare data for Excel
      const excelData = history.map(item => ({
        'Date': format(new Date(item.date), 'dd/MM/yyyy'),
        'Opening Stock': item.opening_qty,
        'Receipt (TP)': item.receipt_qty,
        'Sale': item.sale_qty,
        'Closing Stock': item.closing_qty
      }));

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, // Date
        { wch: 12 }, // Opening Stock
        { wch: 12 }, // Receipt
        { wch: 12 }, // Sale
        { wch: 12 }, // Closing Stock
      ];
      ws['!cols'] = colWidths;

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory History');

      // Generate filename with brand name and date range
      const fileName = `${brandName}_Inventory_History_${format(new Date(startDate), 'dd-MM-yyyy')}_to_${format(new Date(endDate), 'dd-MM-yyyy')}.xlsx`;

      // Save file
      XLSX.writeFile(wb, fileName);
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      console.error('Error downloading Excel:', error);
      toast.error('Failed to download Excel file');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl shadow-xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              Inventory History
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {brandName}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleExcelDownload}
              disabled={loading || history.length === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${loading || history.length === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                  : 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700'
                }`}
            >
              <Download className="w-4 h-4" />
              Download Excel
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-hidden">
          <div className="p-6 h-full">
            {loading ? (
              <div className="flex justify-center items-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No history found for this period</p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="overflow-y-auto flex-1 rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Opening
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Receipt
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Sale
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Closing
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {getCurrentItems().map((item) => (
                        <tr key={item.date} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {format(new Date(item.date), 'dd/MM/yyyy')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {item.opening_qty}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {item.receipt_qty}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {item.sale_qty}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <span className={`${item.closing_qty < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                              {item.closing_qty}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="mt-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Showing <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, history.length)}</span> to{' '}
                    <span className="font-medium">{Math.min(currentPage * itemsPerPage, history.length)}</span> of{' '}
                    <span className="font-medium">{history.length}</span> entries
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`p-2 rounded-lg ${
                        currentPage === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
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
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1 rounded-lg ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`p-2 rounded-lg ${
                        currentPage === totalPages
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 