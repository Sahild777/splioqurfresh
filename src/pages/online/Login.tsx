import React, { useEffect, useState } from 'react';
import { useBar } from '../../context/BarContext';
import { supabase } from '../../lib/supabase';
import { Loader2, ExternalLink, Globe, ShieldCheck, Copy, Check, Key } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PASSBOLT_CONFIG } from '../../config/passbolt';

export default function Login() {
  const { selectedBar } = useBar();
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [portalOpened, setPortalOpened] = useState(false);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  useEffect(() => {
    if (selectedBar) {
      fetchCredentials();
    }
  }, [selectedBar]);

  const fetchCredentials = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('bar_credentials')
        .select('*')
        .eq('bar_id', selectedBar?.id)
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setCredentials(data);
      }
    } catch (error: any) {
      console.error('Error fetching credentials:', error.message);
      toast.error('Failed to fetch credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoLogin = async () => {
    try {
      if (!credentials) {
        toast.error('No credentials found');
        return;
      }

      setIsRedirecting(true);
      setPortalOpened(true);
      
      // Open the portal in a new window
      const portalWindow = window.open(PASSBOLT_CONFIG.FIELDS.uri, '_blank');
      if (!portalWindow) {
        throw new Error('Popup blocked');
      }

      // Wait for the page to load and send credentials
      setTimeout(() => {
        portalWindow.postMessage({
          type: 'PASSBOLT_AUTOFILL',
          data: {
            username: credentials.username,
            password: credentials.password
          }
        }, '*');
      }, 2000);

      toast.success('Opening portal with auto-fill...');
    } catch (error: any) {
      console.error('Error during auto-login:', error.message);
      toast.error('Failed to auto-login');
      setIsRedirecting(false);
    }
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

  if (!selectedBar) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500 dark:text-gray-400">Please select a bar first</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Portal Active Notification - Centered and Smaller */}
      {portalOpened && (
        <div className="fixed inset-x-0 top-24 flex justify-center z-50">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-3 animate-fadeIn hover:scale-105 transition-transform">
            <Globe className="w-4 h-4 animate-pulse" />
            <span className="text-sm font-medium">Portal Active</span>
            <div className="h-4 w-[1px] bg-white/20" />
            <a
              href={PASSBOLT_CONFIG.FIELDS.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-100 hover:text-white transition-colors flex items-center gap-1"
            >
              <span>Reopen</span>
              <ExternalLink className="w-3 h-3" />
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
                    Portal Login
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Securely access your portal with auto-fill
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

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">Loading credentials...</p>
                </div>
              ) : credentials ? (
                <div className="space-y-4">
                  {/* Username Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Username
                    </label>
                    <div className="relative flex items-center group">
                      <input
                        type="text"
                        value={credentials.username}
                        readOnly
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 pr-10"
                      />
                      <button
                        onClick={() => handleCopy(credentials.username, 'username')}
                        className="absolute right-2 p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-200"
                        title="Copy username"
                      >
                        {copiedUsername ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
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
                        value={credentials.password}
                        readOnly
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 pr-10"
                      />
                      <button
                        onClick={() => handleCopy(credentials.password, 'password')}
                        className="absolute right-2 p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-200"
                        title="Copy password"
                      >
                        {copiedPassword ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No credentials found for this bar</p>
                </div>
              )}
            </div>

            {/* Card Footer */}
            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-end">
                <button
                  onClick={handleAutoLogin}
                  disabled={isLoading || !credentials || isRedirecting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isRedirecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Opening Portal...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      Login to Portal
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