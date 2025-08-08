import { useState, useEffect, useCallback } from 'react';
import { WeatherDashboard } from '../components/WeatherDashboard';
import { supabase } from '../lib/supabase';
import { MobileBottomTabs } from '../components/MobileBottomTabs';
import { TabNavigation } from '../components/TabNavigation'; // Ensure this import is also present if not already

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
  const [vineyardId, setVineyardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('weather'); // State to manage active tab

  const renderTabContent = () => {
    if (!vineyard) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>Please select a vineyard to continue</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'weather':
        return (
          <div style={{ padding: '20px' }}>
            <WeatherDashboard
              vineyardId={vineyard?.id}
              initialLatitude={vineyard?.latitude}
              initialLongitude={vineyard?.longitude}
              locationName={vineyard?.location}
            />
          </div>
        );
      case 'insights':
        return (
          <div style={{ padding: '20px' }}>
            <h2>📈 Vineyard Insights</h2>
            <p>Analytics and trends for {vineyard.name}</p>
            {/* InsightsTab component would go here */}
          </div>
        );
      case 'activities':
        return (
          <div style={{ padding: '20px' }}>
            <h2>🌱 Activities</h2>
            <p>Field activities for {vineyard.name}</p>
            {/* ActivitiesTab component would go here */}
          </div>
        );
      case 'reports':
        return (
          <div style={{ padding: '20px' }}>
            <h2>📋 Reports</h2>
            <p>Generated reports for {vineyard.name}</p>
            {/* ReportsTab component would go here */}
          </div>
        );
      case 'vineyards':
        return (
          <div style={{ padding: '20px' }}>
            <h2>🍇 Vineyard Management</h2>
            <div style={{
              padding: '16px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <h3>Current Vineyard</h3>
              <p><strong>Name:</strong> {vineyard.name}</p>
              <p><strong>Location:</strong> {vineyard.location}</p>
              <p><strong>Coordinates:</strong> {vineyard.latitude}, {vineyard.longitude}</p>
            </div>
            {/* VineyardsTab component would go here */}
          </div>
        );
      default:
        return <p>Select a tab</p>;
    }
  };

  // Define tabs for TabNavigation and MobileBottomTabs
  const tabs = [
    { id: 'weather', label: 'Dashboard', emoji: '📊' },
    { id: 'insights', label: 'Insights', emoji: '📈' },
    { id: 'activities', label: 'Activities', emoji: '🌱' },
    { id: 'reports', label: 'Reports', emoji: '📋' },
    { id: 'vineyards', label: 'Vineyards', emoji: '🍇' }
  ];

  const loadVineyardData = useCallback(async () => {
    console.log('🔍 Using stored vineyard ID:', vineyardId);

    if (!vineyardId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('vineyards')
        .select('*')
        .eq('id', vineyardId)
        .maybeSingle();

      if (error) {
        console.error('❌ Database error:', error);
        setLoading(false);
        return;
      }

      if (data) {
        setVineyard(data);
        console.log('✅ Vineyard data loaded:', data);
      }
    } catch (error) {
      console.error('❌ Error loading vineyard:', error);
    } finally {
      setLoading(false);
    }
  }, [vineyardId]);

  useEffect(() => {
    const storedVineyardId = localStorage.getItem('current_vineyard_id') || 
                            '8a7802ad-566f-417a-ad24-3df7d006ecf4';
    setVineyardId(storedVineyardId);
  }, []);

  useEffect(() => {
    if (vineyardId) {
      loadVineyardData();
    }
  }, [vineyardId, loadVineyardData]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3498db',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p>Loading vineyard data...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Desktop Tab Navigation - Hidden on Mobile */}
      <div style={{ display: 'none' }} className="desktop-tabs">
        <TabNavigation 
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* Main Content with Mobile Padding */}
      <div className="mobile-content-padding" style={{ 
        padding: '1rem',
        paddingBottom: '100px', // Space for mobile bottom tabs
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
    </div>
  );
}