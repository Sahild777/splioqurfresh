import React, { useState, useEffect } from 'react';
import { useBar } from '../../context/BarContext';
import { supabase } from '../../lib/supabase';
import { Loader2, Key, Eye, EyeOff, Copy, ExternalLink, Plus, Save, X, Shield, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PASSBOLT_CONFIG } from '../../config/passbolt';

interface Credential {
  id: string;
  bar_id: string;
  username: string;
  password: string;
  site_url: string;
  created_at: string;
  updated_at: string;
  passbolt_resource_id?: string;
}

interface CredentialForm {
  username: string;
  password: string;
}

interface PassboltResource {
  id: string;
  name: string;
  username: string;
  password: string;
  uri: string;
  description: string;
}

declare global {
  interface Window {
    passbolt?: {
      request: {
        resources: {
          find: (url: string) => Promise<PassboltResource[]>;
          create: (data: any) => Promise<PassboltResource>;
          update: (id: string, data: any) => Promise<PassboltResource>;
          get: (id: string) => Promise<PassboltResource>;
        };
      };
      current: {
        serverUrl: string;
        user: {
          username: string;
          firstname: string;
          lastname: string;
        };
      };
    };
  }
}

export default function PasswordManager() {
  const { selectedBar } = useBar();
  const [isLoading, setIsLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState<Credential | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<CredentialForm>({
    username: '',
    password: ''
  });
  const [isPassboltAvailable, setIsPassboltAvailable] = useState(false);
  const [isPassboltConnected, setIsPassboltConnected] = useState(false);
  const [passboltUser, setPassboltUser] = useState<{ username: string; name: string } | null>(null);

  useEffect(() => {
    checkPassboltStatus();
    if (selectedBar) {
      fetchCredentials();
    }
  }, [selectedBar]);

  const checkPassboltStatus = async () => {
    const available = !!window.passbolt;
    setIsPassboltAvailable(available);

    if (available) {
      try {
        const user = window.passbolt.current.user;
        setPassboltUser({
          username: user.username,
          name: `${user.firstname} ${user.lastname}`
        });
        setIsPassboltConnected(true);
      } catch (error) {
        console.error('Error checking Passbolt status:', error);
        setIsPassboltConnected(false);
      }
    }
  };

  const handlePassboltSync = async () => {
    if (!window.passbolt || !credentials) {
      toast.error('Passbolt extension not available');
      return;
    }

    try {
      setIsLoading(true);
      const resourceData = {
        name: `${selectedBar?.bar_name} - ${PASSBOLT_CONFIG.FIELDS.name}`,
        username: credentials.username,
        password: credentials.password,
        uri: PASSBOLT_CONFIG.FIELDS.uri,
        description: `${PASSBOLT_CONFIG.FIELDS.description} for ${selectedBar?.bar_name}`
      };

      let passboltResourceId = credentials.passbolt_resource_id;

      if (passboltResourceId) {
        // Update existing resource
        await window.passbolt.request.resources.update(passboltResourceId, resourceData);
        toast.success('Credentials updated in Passbolt');
      } else {
        // Create new resource
        const resource = await window.passbolt.request.resources.create(resourceData);
        passboltResourceId = resource.id;

        // Update local credentials with Passbolt resource ID
        const { error } = await supabase
          .from('bar_credentials')
          .update({ passbolt_resource_id: resource.id })
          .eq('id', credentials.id);

        if (error) throw error;
        toast.success('Credentials synced with Passbolt');
      }

      // Refresh credentials
      await fetchCredentials();
    } catch (error: any) {
      console.error('Error syncing with Passbolt:', error);
      toast.error('Failed to sync with Passbolt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoFill = async () => {
    if (!window.passbolt || !credentials) {
      toast.error('Passbolt extension not available');
      return;
    }

    try {
      // First sync with Passbolt to ensure latest credentials
      await handlePassboltSync();

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
      }, 2000); // Give the page 2 seconds to load

      toast.success('Opening portal with auto-fill...');
    } catch (error: any) {
      console.error('Error auto-filling credentials:', error);
      toast.error('Failed to auto-fill credentials');
    }
  };

  const fetchCredentials = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('bar_credentials')
        .select('*')
        .eq('bar_id', selectedBar?.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No credentials found - this is okay
          setCredentials(null);
        } else {
          throw error;
        }
      } else {
        setCredentials(data);
        setFormData({
          username: data.username,
          password: data.password
        });
      }
    } catch (error: any) {
      console.error('Error fetching credentials:', error.message);
      toast.error('Failed to load credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);

      if (credentials) {
        // Update existing credentials
        const { error } = await supabase
          .from('bar_credentials')
          .update({
            username: formData.username,
            password: formData.password,
            updated_at: new Date().toISOString()
          })
          .eq('id', credentials.id);

        if (error) throw error;
        toast.success('Credentials updated successfully');
      } else {
        // Insert new credentials
        const { error } = await supabase
          .from('bar_credentials')
          .insert({
            bar_id: selectedBar?.id,
            username: formData.username,
            password: formData.password,
            site_url: 'https://scmexcise.mahaonline.gov.in/retailer/'
          });

        if (error) throw error;
        toast.success('Credentials added successfully');
      }

      await fetchCredentials();
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error saving credentials:', error.message);
      toast.error('Failed to save credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'username' | 'password') => {
    navigator.clipboard.writeText(text);
    toast.success(`${type === 'username' ? 'Username' : 'Password'} copied to clipboard`);
  };

  const handleLoginClick = () => {
    window.open('https://scmexcise.mahaonline.gov.in/retailer/', '_blank');
  };

  if (!selectedBar) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500 dark:text-gray-400">Please select a bar first</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Password Manager</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your credentials for {selectedBar?.bar_name}
        </p>
        {isPassboltConnected && passboltUser && (
          <div className="mt-2 flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <Shield className="w-4 h-4" />
            <span>Connected to Passbolt as {passboltUser.name}</span>
          </div>
        )}
      </div>

      {/* Credentials Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              Excise Portal Credentials
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            {!isEditing && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>{credentials ? 'Edit' : 'Add'} Credentials</span>
                </button>
                {credentials && isPassboltConnected && (
                  <>
                    <button
                      onClick={handlePassboltSync}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      title="Sync with Passbolt"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Sync</span>
                    </button>
                    <button
                      onClick={handleAutoFill}
                      className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <span>Auto Login</span>
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Username
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter username"
              />
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <div className="flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="ml-2 p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-2 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  if (credentials) {
                    setFormData({
                      username: credentials.username,
                      password: credentials.password
                    });
                  }
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Save Credentials</span>
              </button>
            </div>
          </form>
        ) : credentials ? (
          <div className="space-y-6">
            {/* Username Display */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Username
              </label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={credentials.username}
                  readOnly
                  className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => copyToClipboard(credentials.username, 'username')}
                  className="ml-2 p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Password Display */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <div className="flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  readOnly
                  className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="ml-2 p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => copyToClipboard(credentials.password, 'password')}
                  className="ml-2 p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Last updated: {new Date(credentials.updated_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No credentials found for this bar</p>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Click the Add Credentials button to add them</p>
          </div>
        )}
      </div>

      {/* Passbolt Status */}
      {!isPassboltAvailable && (
        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Passbolt Not Available
              </h3>
              <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                Install the Passbolt browser extension to enable secure credential management and auto-fill features.
              </p>
              <a
                href="https://www.passbolt.com/download/browser-extension"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center space-x-1 text-sm text-yellow-800 dark:text-yellow-200 hover:underline"
              >
                <span>Install Passbolt</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      )}

      {isPassboltAvailable && !isPassboltConnected && (
        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Passbolt Not Connected
              </h3>
              <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                Please sign in to your Passbolt account to enable credential syncing and auto-fill features.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 