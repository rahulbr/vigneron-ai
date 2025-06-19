// pages/index.tsx - Super robust version that always works

import { useState, useEffect } from 'react';
import { WeatherDashboard } from '../components/WeatherDashboard';

export default function Home() {
  const [vineyardData, setVineyardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vineyardId, setVineyardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generate vineyard ID only on client side
  useEffect(() => {
    const generateVineyardId = () => {
      // Try to get from localStorage first
      const stored = localStorage.getItem('demo-vineyard-id');
      if (stored) {
        console.log('🔍 Using stored vineyard ID:', stored);
        return stored;
      }

      // Generate a new UUID
      let newId;
      if (crypto && crypto.randomUUID) {
        newId = crypto.randomUUID();
      } else {
        // Fallback UUID generation
        newId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }

      console.log('🆕 Generated new vineyard ID:', newId);
      localStorage.setItem('demo-vineyard-id', newId);
      return newId;
    };

    const id = generateVineyardId();
    setVineyardId(id);
  }, []);

  // Load vineyard data when ID is available
  useEffect(() => {
    if (vineyardId) {
      loadVineyardData();
    }
  }, [vineyardId]);

  const loadVineyardData = async () => {
    if (!vineyardId) return;

    setLoading(true);
    setError(null);

    console.log('🏗️ Creating demo vineyard data locally (bypassing database for now)');

    // For now, let's just use local data to get the app working
    // We can integrate database later once the app is stable
    const demoVineyard = {
      id: vineyardId,
      name: 'Demo Vineyard - Napa Valley',
      location: 'Napa Valley, CA',
      latitude: 38.2975,
      longitude: -122.2869,
      created_at: new Date().toISOString()
    };

    // Simulate a small delay to show loading
    setTimeout(() => {
      console.log('✅ Demo vineyard data loaded:', demoVineyard);
      setVineyardData(demoVineyard);
      setLoading(false);
    }, 500);
  };

  // Show loading until vineyard ID is generated and data is loaded
  if (loading || !vineyardId) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
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
        <p style={{ color: '#666', fontSize: '18px' }}>
          {!vineyardId ? 'Initializing...' : 'Loading vineyard data...'}
        </p>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <header style={{ 
        backgroundColor: 'white', 
        borderBottom: '1px solid #e2e8f0',
        padding: '20px 0'
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ 
              margin: '0', 
              fontSize: '28px', 
              fontWeight: 'bold',
              color: '#1f2937'
            }}>
              🍇 Vigneron.AI
            </h1>
            <p style={{ 
              margin: '5px 0 0 0', 
              color: '#6b7280',
              fontSize: '16px'
            }}>
              AI-Powered Vineyard Management
            </p>
          </div>

          <div style={{ 
            padding: '8px 16px',
            backgroundColor: '#f0fdf4',
            color: '#166534',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '500',
            border: '1px solid #bbf7d0'
          }}>
            Sprint 1 - Day 2 Complete ✅
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div style={{
          backgroundColor: '#fef3cd',
          color: '#856404',
          padding: '12px 20px',
          textAlign: 'center',
          fontSize: '14px',
          borderBottom: '1px solid #faeaa7'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Status Banner */}
      <div style={{
        backgroundColor: '#e0f2fe',
        color: '#0369a1',
        padding: '12px 20px',
        textAlign: 'center',
        fontSize: '14px',
        borderBottom: '1px solid #7dd3fc'
      }}>
        🚧 Running in demo mode - database integration temporarily disabled for testing
      </div>

      {/* Main Content */}
      <main>
        {vineyardData && (
          <WeatherDashboard
            vineyardId={vineyardData.id}
            initialLatitude={vineyardData.latitude}
            initialLongitude={vineyardData.longitude}
            locationName={vineyardData.name}
          />
        )}
      </main>

      {/* Debug Info (only in development) */}
      {process.env.NODE_ENV === 'development' && vineyardData && (
        <div style={{
          margin: '20px auto',
          maxWidth: '1200px',
          padding: '15px 20px',
          backgroundColor: '#f1f5f9',
          borderRadius: '8px',
          fontSize: '12px',
          fontFamily: 'monospace',
          color: '#475569'
        }}>
          <strong>Debug Info:</strong><br/>
          Vineyard ID: {vineyardId}<br/>
          Name: {vineyardData.name}<br/>
          Location: {vineyardData.latitude}, {vineyardData.longitude}<br/>
          Created: {vineyardData.created_at}<br/>
          Mode: Local Demo (No Database)
        </div>
      )}

      {/* Footer */}
      <footer style={{ 
        backgroundColor: 'white', 
        borderTop: '1px solid #e2e8f0',
        padding: '40px 0',
        marginTop: '60px'
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '0 20px',
          textAlign: 'center'
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '30px',
            marginBottom: '30px'
          }}>
            <div>
              <h3 style={{ margin: '0 0 10px 0', color: '#374151' }}>✨ Features Working</h3>
              <ul style={{ 
                listStyle: 'none', 
                padding: '0', 
                margin: '0',
                color: '#6b7280',
                fontSize: '14px'
              }}>
                <li style={{ padding: '2px 0' }}>📊 Interactive GDD Chart</li>
                <li style={{ padding: '2px 0' }}>🌤️ Weather API Integration</li>
                <li style={{ padding: '2px 0' }}>📍 Location Updates</li>
                <li style={{ padding: '2px 0' }}>📅 Date Range Selection</li>
              </ul>
            </div>

            <div>
              <h3 style={{ margin: '0 0 10px 0', color: '#374151' }}>🚀 Coming Next</h3>
              <ul style={{ 
                listStyle: 'none', 
                padding: '0', 
                margin: '0',
                color: '#6b7280',
                fontSize: '14px'
              }}>
                <li style={{ padding: '2px 0' }}>💾 Database Integration</li>
                <li style={{ padding: '2px 0' }}>🌱 Phenology Event Saving</li>
                <li style={{ padding: '2px 0' }}>🤖 AI Recommendations</li>
                <li style={{ padding: '2px 0' }}>💬 ChatGPT Integration</li>
              </ul>
            </div>

            <div>
              <h3 style={{ margin: '0 0 10px 0', color: '#374151' }}>🎯 How to Use</h3>
              <ul style={{ 
                listStyle: 'none', 
                padding: '0', 
                margin: '0',
                color: '#6b7280',
                fontSize: '14px'
              }}>
                <li style={{ padding: '2px 0' }}>1. Set vineyard coordinates</li>
                <li style={{ padding: '2px 0' }}>2. Select date range</li>
                <li style={{ padding: '2px 0' }}>3. View GDD accumulation</li>
                <li style={{ padding: '2px 0' }}>4. Track weather patterns</li>
              </ul>
            </div>
          </div>

          <div style={{ 
            padding: '20px 0',
            borderTop: '1px solid #e2e8f0',
            color: '#9ca3af',
            fontSize: '14px'
          }}>
            <p style={{ margin: '0' }}>
              Vigneron.AI - Built with React, TypeScript, and Next.js
            </p>
            {vineyardId && (
              <p style={{ margin: '5px 0 0 0' }}>
                Weather data provided by Open-Meteo API • Vineyard ID: {vineyardId.slice(0, 8)}...
              </p>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}