
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Vineyard {
  id: string;
  name: string;
  location?: string;
  latitude: number;
  longitude: number;
  created_at?: string;
  updated_at?: string;
}

interface VineyardContextType {
  currentVineyard: Vineyard | null;
  vineyards: Vineyard[];
  setCurrentVineyard: (vineyard: Vineyard | null) => void;
  setVineyards: (vineyards: Vineyard[]) => void;
  isLoading: boolean;
}

const VineyardContext = createContext<VineyardContextType | undefined>(undefined);

interface VineyardProviderProps {
  children: ReactNode;
}

export const VineyardProvider: React.FC<VineyardProviderProps> = ({ children }) => {
  const [currentVineyard, setCurrentVineyard] = useState<Vineyard | null>(null);
  const [vineyards, setVineyards] = useState<Vineyard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize vineyard data
    const loadVineyardData = async () => {
      try {
        // Load saved vineyard from localStorage if available
        if (typeof window !== 'undefined') {
          const savedVineyardId = localStorage.getItem('currentVineyardId');
          if (savedVineyardId) {
            // You can add logic here to load the specific vineyard
            console.log('Loading saved vineyard:', savedVineyardId);
          }
        }
      } catch (error) {
        console.error('Error loading vineyard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadVineyardData();
  }, []);

  const value: VineyardContextType = {
    currentVineyard,
    vineyards,
    setCurrentVineyard,
    setVineyards,
    isLoading
  };

  return (
    <VineyardContext.Provider value={value}>
      {children}
    </VineyardContext.Provider>
  );
};

export const useVineyard = (): VineyardContextType => {
  const context = useContext(VineyardContext);
  if (context === undefined) {
    throw new Error('useVineyard must be used within a VineyardProvider');
  }
  return context;
};

export default VineyardProvider;
