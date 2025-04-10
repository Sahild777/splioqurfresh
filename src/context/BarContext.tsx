import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type Bar = {
  id: number;
  bar_name: string;
  financial_year_start: string;
  license_category: 'bar' | 'beer_shop' | 'wine_shop';
};

type BarContextType = {
  selectedBar: Bar | null;
  setSelectedBar: (bar: Bar | null) => void;
  bars: Bar[];
};

const BarContext = createContext<BarContextType | undefined>(undefined);

export function BarProvider({ children }: { children: React.ReactNode }) {
  const [bars, setBars] = useState<Bar[]>([]);
  const [selectedBar, setSelectedBar] = useState<Bar | null>(null);

  useEffect(() => {
    fetchBars();
  }, []);

  const fetchBars = async () => {
    try {
      const { data, error } = await supabase
        .from('bars')
        .select('*')
        .order('bar_name');

      if (error) throw error;
      setBars(data || []);
      
      // Get the selected bar from localStorage
      const savedBarId = localStorage.getItem('selectedBarId');
      if (savedBarId && data) {
        const bar = data.find(b => b.id === Number(savedBarId));
        if (bar) {
          setSelectedBar(bar);
        } else if (data.length > 0) {
          // If saved bar not found, select first bar
          setSelectedBar(data[0]);
        }
      } else if (data && data.length > 0) {
        // If no saved bar, select first bar
        setSelectedBar(data[0]);
      }
    } catch (error: any) {
      console.error('Error fetching bars:', error.message);
    }
  };

  const handleSetSelectedBar = (bar: Bar | null) => {
    setSelectedBar(bar);
    if (bar) {
      localStorage.setItem('selectedBarId', bar.id.toString());
    } else {
      localStorage.removeItem('selectedBarId');
    }
  };

  return (
    <BarContext.Provider value={{ selectedBar, setSelectedBar: handleSetSelectedBar, bars }}>
      {children}
    </BarContext.Provider>
  );
}

export function useBar() {
  const context = useContext(BarContext);
  if (context === undefined) {
    throw new Error('useBar must be used within a BarProvider');
  }
  return context;
} 