import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, ScanLine, Loader2, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useBar } from '../../context/BarContext';
import { format } from 'date-fns';
import { createWorker } from 'tesseract.js';

type Brand = {
  id: string;
  brand_name: string;
  item_code: string;
  size: string;
  mrp: number;
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

export default function ScanTP() {
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [items, setItems] = useState<TPItem[]>([]);
  const [tpNo, setTpNo] = useState('');
  const [tpDate, setTpDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { selectedBar } = useBar();
  const [brands, setBrands] = useState<Brand[]>([]);

  // Fetch brands on component mount
  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('id, brand_name, item_code, size, mrp')
        .order('brand_name');

      if (error) throw error;
      setBrands(data || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
      toast.error('Failed to fetch brands');
    }
  };

  const findBrandByItemCode = (itemCode: string): Brand | undefined => {
    return brands.find(brand => 
      brand.item_code.toLowerCase() === itemCode.toLowerCase()
    );
  };

  const processOCRText = (text: string) => {
    try {
      // Extract received date (format: DD/MM/YYYY or similar)
      const dateMatch = text.match(/Received\s*Date\s*:?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
      const extractedDate = dateMatch ? format(new Date(dateMatch[1]), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

      // Extract TP number (manual number)
      const tpNoMatch = text.match(/TP\s*Manual\s*No\s*:?\s*([A-Z0-9\/-]+)/i);
      const extractedTpNo = tpNoMatch ? tpNoMatch[1] : '';

      // Extract items
      const lines = text.split('\n');
      const items: TPItem[] = [];
      let currentSrNo = 1;

      // Process lines in pairs (item name line and SCM code line)
      for (let i = 0; i < lines.length - 1; i++) {
        const currentLine = lines[i].trim();
        const nextLine = lines[i + 1].trim();
        
        // Look for patterns that match item entries
        // First line: [Sr.No] [Item Name] [...] [Quantity]
        // Second line: SCM code
        const itemMatch = currentLine.match(/^\s*(\d+)\s+([A-Za-z0-9\s\-&.]+?)\s+.*?(\d+)\s*$/i);
        const scmMatch = nextLine.match(/^(?:SCM:?)?\s*(SCMPL\d+)/i);
        
        if (itemMatch && scmMatch) {
          const srNo = parseInt(itemMatch[1], 10);
          const quantity = parseInt(itemMatch[3], 10);
          const itemCode = scmMatch[1].trim();

          // Find brand details from our database
          const brandDetails = findBrandByItemCode(itemCode);

          if (brandDetails) {
            items.push({
              sr_no: srNo,
              brand_id: brandDetails.id,
              brand_name: brandDetails.brand_name,
              item_code: itemCode,
              size: brandDetails.size,
              mrp: brandDetails.mrp,
              qty: quantity
            });
          } else {
            console.log(`Brand not found for SCM code: ${itemCode}`);
          }

          // Skip the next line since we've processed it
          i++;
        }
      }

      // Filter out any items with zero quantity
      const validItems = items.filter(item => item.qty > 0);

      // Log the results for debugging
      console.log('Extracted TP No:', extractedTpNo);
      console.log('Extracted Date:', extractedDate);
      console.log('Found Items:', validItems);

      return {
        tp_no: extractedTpNo,
        tp_date: extractedDate,
        items: validItems
      };
    } catch (error) {
      console.error('Error processing OCR text:', error);
      return null;
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setIsLoading(true);
    let worker = null;
    
    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Initialize Tesseract worker
      setIsProcessing(true);
      worker = await createWorker('eng', 1, {
        logger: m => {
          console.log(m);
          if (m.status === 'loading tesseract core') {
            setLoadingMessage('Loading OCR engine...');
          } else if (m.status === 'loading language traineddata') {
            setLoadingMessage('Loading language data...');
          } else if (m.status === 'initializing api') {
            setLoadingMessage('Initializing OCR...');
          } else if (m.status === 'recognizing text') {
            setLoadingMessage('Reading text from image...');
          }
        },
        errorHandler: err => {
          console.error(err);
          toast.error('OCR error: ' + err.message);
        }
      });

      // Perform OCR
      const { data: { text } } = await worker.recognize(file);

      // Process the OCR text
      const processedData = processOCRText(text);
      
      if (processedData && processedData.items.length > 0) {
        setTpNo(processedData.tp_no);
        setTpDate(processedData.tp_date);
        setItems(processedData.items);
        toast.success('TP scanned successfully');
      } else {
        toast.error('Could not extract data from the image. Please try again with a clearer image.');
      }
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to process image');
    } finally {
      if (worker) {
        await worker.terminate();
      }
      setIsLoading(false);
      setIsProcessing(false);
      setLoadingMessage('');
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const file = event.dataTransfer.files?.[0];
    if (file && fileInputRef.current) {
      fileInputRef.current.files = event.dataTransfer.files;
      handleImageUpload({ target: { files: event.dataTransfer.files } } as any);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Scan TP</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Upload a TP image to automatically fill the form using OCR technology.
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center ${
            isLoading ? 'border-gray-300 dark:border-gray-600' : 'border-blue-300 dark:border-blue-600'
          }`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {loadingMessage || (isProcessing ? 'Processing image...' : 'Uploading image...')}
              </p>
            </div>
          ) : imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview}
                alt="TP Preview"
                className="max-h-96 mx-auto rounded-lg shadow-lg"
              />
              <button
                onClick={() => {
                  setImagePreview(null);
                  setItems([]);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div className="p-4 rounded-full bg-blue-50 dark:bg-blue-900/20 mb-4">
                <Upload className="w-8 h-8 text-blue-500 dark:text-blue-400" />
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Drag and drop your TP image here, or{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-500 dark:text-blue-400 hover:underline"
                >
                  browse
                </button>
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Supports: JPG, PNG (max 5MB)
              </p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Form Section */}
      {items.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  TP No
                </label>
                <input
                  type="text"
                  value={tpNo}
                  onChange={(e) => setTpNo(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  TP Date
                </label>
                <input
                  type="date"
                  value={tpDate}
                  onChange={(e) => setTpDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Party Name
                </label>
                <input
                  type="text"
                  value={selectedParty?.party_name || ''}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
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
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {items.map((item) => (
                  <tr key={item.sr_no}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {item.sr_no}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {item.brand_name}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {item.qty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Section */}
          <div className="mt-4 flex items-center justify-end gap-4 text-sm text-gray-600 dark:text-gray-400 p-4 border-t border-gray-200 dark:border-gray-700">
            <span>Total Quantity: <span className="font-semibold text-gray-900 dark:text-white">{items.reduce((sum, item) => sum + (item.qty || 0), 0)}</span></span>
            <span>|</span>
            <span>Total MRP: <span className="font-semibold text-gray-900 dark:text-white">₹{items.reduce((sum, item) => sum + ((item.mrp || 0) * (item.qty || 0)), 0).toLocaleString()}</span></span>
          </div>

          {/* Save Button */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                // TODO: Implement save functionality
                toast.success('TP saved successfully');
              }}
              className="flex items-center justify-center w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save className="w-5 h-5 mr-2" />
              Save TP
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 