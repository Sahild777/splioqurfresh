import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useBar } from '../../context/BarContext';
import { Save, Loader2, Key, LogIn, Copy, Check, ExternalLink, Globe, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

type VATCredential = {
  id: string;
  bar_id: string;
  username: string;
  password: string;
  created_at: string;
};

const VAT_PORTAL_URL = 'https://eservices.mahagst.gov.in/mstd/dealer/login';

export default function VATLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [credentials, setCredentials] = useState<VATCredential | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [portalOpened, setPortalOpened] = useState(false);
  const { selectedBar } = useBar();

  useEffect(() => {
    if (selectedBar) {
      fetchCredentials();
    }
  }, [selectedBar]);

  const fetchCredentials = async () => {
    if (!selectedBar) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('vat_credentials')
        .select('*')
        .eq('bar_id', selectedBar.id)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Not found error
          throw error;
        }
      }

      if (data) {
        setCredentials(data);
        setUsername(data.username);
        setPassword(data.password);
      }
    } catch (error: any) {
      console.error('Error fetching VAT credentials:', error);
      toast.error('Failed to fetch VAT credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedBar) {
      toast.error('Please select a bar');
      return;
    }

    if (!username || !password) {
      toast.error('Please enter both username and password');
      return;
    }

    try {
      setIsSaving(true);
      const newCredentials = {
        bar_id: selectedBar.id,
        username,
        password,
      };

      if (credentials) {
        // Update existing credentials
        const { error } = await supabase
          .from('vat_credentials')
          .update(newCredentials)
          .eq('id', credentials.id);

        if (error) throw error;
      } else {
        // Insert new credentials
        const { error } = await supabase
          .from('vat_credentials')
          .insert([newCredentials]);

        if (error) throw error;
      }

      toast.success('VAT credentials saved successfully');
      await fetchCredentials();
    } catch (error: any) {
      console.error('Error saving VAT credentials:', error);
      toast.error('Failed to save VAT credentials');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenVATPortal = () => {
    window.open(VAT_PORTAL_URL, '_blank', 'noopener,noreferrer');
    setPortalOpened(true);
  };

  const handleCopy = async (text: string, type: 'username' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'username') {
        setCopiedUsername(true);
        setTimeout(() => setCopiedUsername(false), 2000);
      } else {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      }
      toast.success(`${type === 'username' ? 'Username' : 'Password'} copied to clipboard`);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Modern Topbar - Visible after portal is opened */}
      {portalOpened && (
        <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-4 shadow-lg z-50 animate-slideDown">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Globe className="w-6 h-6 animate-pulse" />
              <div>
                <h3 className="font-semibold">VAT Portal Active</h3>
                <p className="text-sm text-blue-100">Portal opened in a new tab</p>
              </div>
            </div>
            <a
              href={VAT_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Reopen Portal</span>
            </a>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Modern Card Design */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
            {/* Card Header */}
            <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 dark:from-blue-500/5 dark:via-indigo-500/5 dark:to-purple-500/5 p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <ShieldCheck className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    VAT Login Credentials
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Securely manage your VAT portal access
                  </p>
                </div>
              </div>
            </div>

            {/* Card Content */}
            <div className="p-6 space-y-6">
              {/* Bar Selection */}
              <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Selected Bar
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={selectedBar?.bar_name || ''}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  />
                </div>
              </div>

              {/* Credentials Section */}
              <div className="space-y-4">
                {/* Username Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username
                  </label>
                  <div className="relative flex items-center group">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white pr-10 transition-all duration-200 group-hover:border-blue-500 dark:group-hover:border-blue-400"
                      placeholder="Enter VAT portal username"
                    />
                    {username && (
                      <button
                        onClick={() => handleCopy(username, 'username')}
                        className="absolute right-2 p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-200"
                        title="Copy username"
                      >
                        {copiedUsername ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <div className="relative flex items-center group">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white pr-10 transition-all duration-200 group-hover:border-blue-500 dark:group-hover:border-blue-400"
                      placeholder="Enter VAT portal password"
                    />
                    {password && (
                      <button
                        onClick={() => handleCopy(password, 'password')}
                        className="absolute right-2 p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-200"
                        title="Copy password"
                      >
                        {copiedPassword ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Card Footer */}
            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-end gap-4">
                <button
                  onClick={handleOpenVATPortal}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  <LogIn className="w-4 h-4" />
                  Open VAT Portal
                </button>

                <button
                  onClick={handleSave}
                  disabled={isSaving || isLoading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Credentials
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 