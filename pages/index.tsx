
import { useState, useEffect, useCallback } from 'react';
import { WeatherDashboard } from '../components/WeatherDashboard';
import { VineyardsTab } from '../components/VineyardsTab';
import { supabase } from '../lib/supabase';
import { MobileBottomTabs } from '../components/MobileBottomTabs';
import { TabNavigation } from '../components/TabNavigation';

interface Vineyard {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export default function Home() {
  const [vineyard, setVineyard] = useState<Vineyard | null>(null);
  const [userVineyards, setUserVineyards] = useState<Vineyard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('vineyards'); // Start with vineyard selection
  const [isLoadingVineyards, setIsLoadingVineyards] = useState(true);

  // Load user's vineyards on initialization
  const loadUserVineyards = useCallback(async () => {
    setIsLoadingVineyards(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('👤 No authenticated user');
        setLoading(false);
        setIsLoadingVineyards(false);
        return;
      }

      // Load user's vineyards
      const { getUserVineyards } = await import('../lib/supabase');
      const vineyards = await getUserVineyards();
      
      console.log('🍇 Loaded vineyards:', vineyards);
      setUserVineyards(vineyards);

      // Try to restore previously selected vineyard
      const storedVineyardId = localStorage.getItem('current_vineyard_id');
      if (storedVineyardId && vineyards.length > 0) {
        const savedVineyard = vineyards.find(v => v.id === storedVineyardId);
        if (savedVineyard) {
          setVineyard(savedVineyard);
          setActiveTab('weather'); // Switch to dashboard if vineyard found
        }
      } else if (vineyards.length === 1) {
        // If only one vineyard, auto-select it
        setVineyard(vineyards[0]);
        localStorage.setItem('current_vineyard_id', vineyards[0].id);
        setActiveTab('weather');
      }

    } catch (error) {
      console.error('❌ Error loading vineyards:', error);
    } finally {
      setLoading(false);
      setIsLoadingVineyards(false);
    }
  }, []);

  // Handle vineyard selection
  const handleVineyardChange = (selectedVineyard: Vineyard | null) => {
    setVineyard(selectedVineyard);
    if (selectedVineyard) {
      localStorage.setItem('current_vineyard_id', selectedVineyard.id);
      // Auto-switch to weather dashboard when vineyard is selected
      setActiveTab('weather');
    }
  };

  // Handle vineyard updates (after creation/editing)
  const handleVineyardsUpdate = () => {
    loadUserVineyards();
  };

  useEffect(() => {
    loadUserVineyards();
  }, [loadUserVineyards]);

  // Define tabs for navigation
  const tabs = [
    { id: 'weather', label: 'Dashboard', emoji: '📊' },
    { id: 'insights', label: 'Insights', emoji: '📈' },
    { id: 'activities', label: 'Activities', emoji: '🌱' },
    { id: 'reports', label: 'Reports', emoji: '📋' },
    { id: 'vineyards', label: 'Vineyards', emoji: '🍇' }
  ];

  const renderTabContent = () => {
    // Always show vineyard tab regardless of selection
    if (activeTab === 'vineyards') {
      return (
        <VineyardsTab
          userVineyards={userVineyards}
          currentVineyard={vineyard}
          onVineyardChange={handleVineyardChange}
          onVineyardsUpdate={handleVineyardsUpdate}
        />
      );
    }

    // For other tabs, require vineyard selection
    if (!vineyard) {
      return (
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '2px dashed #cbd5e1',
          margin: '2rem'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '1rem' }}>🍇</div>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#374151', fontSize: '1.5rem' }}>
            Welcome to Vigneron.AI
          </h3>
          <p style={{ margin: '0 0 1.5rem 0', color: '#6b7280', fontSize: '1rem' }}>
            Please select or create a vineyard to get started
          </p>
          <button
            onClick={() => setActiveTab('vineyards')}
            style={{
              padding: '12px 24px',
              backgroundColor: '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            🍇 Manage Vineyards
          </button>
        </div>
      );
    }

    // Render content for selected tab with vineyard context
    switch (activeTab) {
      case 'weather':
        return (
          <WeatherDashboard
            vineyardId={vineyard.id}
            initialLatitude={vineyard.latitude}
            initialLongitude={vineyard.longitude}
            locationName={vineyard.location}
          />
        );
      case 'insights':
        return (
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: '0', fontSize: '1.5rem', color: '#374151' }}>📈 Vineyard Insights</h2>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>{vineyard.name}</div>
            </div>
            <div style={{ 
              padding: '2rem', 
              backgroundColor: '#f8fafc', 
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <p style={{ color: '#6b7280' }}>Analytics and trends for {vineyard.name} coming soon...</p>
            </div>
          </div>
        );
      case 'activities':
        return (
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: '0', fontSize: '1.5rem', color: '#374151' }}>🌱 Activities</h2>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>{vineyard.name}</div>
            </div>
            <div style={{ 
              padding: '2rem', 
              backgroundColor: '#f8fafc', 
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <p style={{ color: '#6b7280' }}>Field activities for {vineyard.name} coming soon...</p>
            </div>
          </div>
        );
      case 'reports':
        return (
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: '0', fontSize: '1.5rem', color: '#374151' }}>📋 Reports</h2>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>{vineyard.name}</div>
            </div>
            <div style={{ 
              padding: '2rem', 
              backgroundColor: '#f8fafc', 
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <p style={{ color: '#6b7280' }}>Generated reports for {vineyard.name} coming soon...</p>
            </div>
          </div>
        );
      default:
        return <p>Select a tab</p>;
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #22c55e',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ color: '#6b7280' }}>Loading your vineyard data...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Desktop Tab Navigation */}
      <div className="desktop-tabs" style={{ 
        display: 'block',
        '@media (max-width: 768px)': { display: 'none' }
      }}>
        <TabNavigation 
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* Main Content */}
      <div className="mobile-content-padding" style={{ 
        padding: '0',
        paddingBottom: '100px',
        minHeight: 'calc(100vh - 100px)'
      }}>
        {renderTabContent()}
      </div>

      {/* Mobile Bottom Tab Navigation */}
      <MobileBottomTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
          .desktop-tabs {
            display: none !important;
          }
        }
        
        @media (min-width: 769px) {
          .mobile-content-padding {
            padding-bottom: 20px !important;
          }
        }
      `}</style>
    </div>
  );
}
