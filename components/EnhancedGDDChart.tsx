
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Calendar, Plus, Activity, X, Save } from 'lucide-react';

interface WeatherDay {
  date: string;
  temp_high: number;
  temp_low: number;
  gdd: number;
  rainfall: number;
}

interface PhenologyEvent {
  id?: string;
  vineyard_id: string;
  event_type: string;
  event_date: string;
  end_date?: string;
  notes?: string;
  harvest_block?: string;
  is_actual?: boolean;
  created_at?: string;
}

interface ActivityLog {
  id?: string;
  vineyard_id: string;
  activity_type: string;
  activity_date: string;
  notes?: string;
  created_at?: string;
}

interface EnhancedGDDChartProps {
  weatherData: WeatherDay[];
  locationName?: string;
  vineyardId: string;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  dailyGDD: number;
  cumulativeGDD: number;
  tempHigh: number;
  tempLow: number;
  rainfall: number;
}

const PHENOLOGY_EVENT_TYPES = [
  'Bud Break',
  'Bloom',
  'Fruit Set',
  'Veraison',
  'Harvest',
  'Leaf Fall',
  'Dormancy'
];

const ACTIVITY_TYPES = [
  'Prune',
  'Spray',
  'Thin',
  'Weed', 
  'Mow',
  'Fertilize',
  'Irrigate',
  'Canopy Management',
  'Soil Work',
  'Other'
];

export function EnhancedGDDChart({ weatherData, locationName = "Vineyard", vineyardId }: EnhancedGDDChartProps) {
  const [showPhenologyModal, setShowPhenologyModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [phenologyEvents, setPhenologyEvents] = useState<PhenologyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Phenology event form state
  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [harvestBlock, setHarvestBlock] = useState('');

  // Activity log form state
  const [activityType, setActivityType] = useState('');
  const [activityDate, setActivityDate] = useState('');
  const [activityNotes, setActivityNotes] = useState('');

  console.log('📈 EnhancedGDDChart rendering with:', weatherData.length, 'data points');

  // Load phenology events from database
  useEffect(() => {
    const loadPhenologyEvents = async () => {
      if (!vineyardId) return;
      
      try {
        console.log('🔄 Loading phenology events from database for vineyard:', vineyardId);
        const { getPhenologyEvents } = await import('../lib/supabase');
        const events = await getPhenologyEvents(vineyardId);
        setPhenologyEvents(events || []);
        console.log('✅ Loaded phenology events from database:', events?.length || 0);
      } catch (error) {
        console.error('❌ Error loading phenology events:', error);
        setPhenologyEvents([]);
      }
    };

    loadPhenologyEvents();
  }, [vineyardId]);

  // Process weather data into chart format
  const chartData: ChartDataPoint[] = [];
  let cumulativeGDD = 0;

  weatherData.forEach((day, index) => {
    // Validate the data point
    if (!day || typeof day.gdd !== 'number' || isNaN(day.gdd)) {
      console.warn('⚠️ Invalid data point at index', index, ', skipping');
      return;
    }

    cumulativeGDD += day.gdd;

    const date = new Date(day.date);
    const displayDate = `${date.getMonth() + 1}/${date.getDate()}`;

    chartData.push({
      date: day.date,
      displayDate,
      dailyGDD: Math.round(day.gdd * 10) / 10,
      cumulativeGDD: Math.round(cumulativeGDD * 10) / 10,
      tempHigh: day.temp_high,
      tempLow: day.temp_low,
      rainfall: day.rainfall || 0
    });
  });

  console.log('✅ Successfully processed', chartData.length, 'weather data points');

  const totalGDD = chartData[chartData.length - 1]?.cumulativeGDD || 0;

  // Handle chart click to add phenology event
  const handleChartClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const clickedDate = data.activePayload[0].payload.date;
      setSelectedDate(clickedDate);
      setEventDate(clickedDate);
      setActivityDate(clickedDate);
    }
  };

  // Open phenology modal
  const openPhenologyModal = () => {
    if (!selectedDate) {
      const today = new Date().toISOString().split('T')[0];
      setEventDate(today);
      setSelectedDate(today);
    }
    setShowPhenologyModal(true);
  };

  // Open activity modal
  const openActivityModal = () => {
    if (!selectedDate) {
      const today = new Date().toISOString().split('T')[0];
      setActivityDate(today);
      setSelectedDate(today);
    }
    setShowActivityModal(true);
  };

  // Save phenology event
  const savePhenologyEvent = async () => {
    if (!eventType || !eventDate) {
      alert('Please fill in event type and date');
      return;
    }

    setIsLoading(true);
    try {
      console.log('💾 Saving phenology event:', { vineyard: vineyardId, type: eventType, date: eventDate });
      
      const { savePhenologyEvent } = await import('../lib/supabase');
      const savedEvent = await savePhenologyEvent(
        vineyardId,
        eventType,
        eventDate,
        eventNotes,
        undefined,
        harvestBlock || undefined
      );

      // Add to local state
      setPhenologyEvents(prev => [...prev, savedEvent]);
      
      // Reset form
      setEventType('');
      setEventDate('');
      setEventNotes('');
      setHarvestBlock('');
      setShowPhenologyModal(false);
      setSelectedDate('');

      console.log('✅ Phenology event saved successfully');
      
      // Force reload of activity log in parent component
      window.location.reload();
      
    } catch (error) {
      console.error('❌ Error saving phenology event:', error);
      alert('Failed to save phenology event: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Save activity log
  const saveActivity = async () => {
    if (!activityType || !activityDate) {
      alert('Please fill in activity type and date');
      return;
    }

    setIsLoading(true);
    try {
      console.log('💾 Saving activity:', { vineyard: vineyardId, type: activityType, date: activityDate });
      
      // Save as a phenology event with activity_ prefix to distinguish
      const { savePhenologyEvent } = await import('../lib/supabase');
      await savePhenologyEvent(
        vineyardId,
        `activity_${activityType}`,
        activityDate,
        activityNotes
      );

      // Reset form
      setActivityType('');
      setActivityDate('');
      setActivityNotes('');
      setShowActivityModal(false);
      setSelectedDate('');

      console.log('✅ Activity saved successfully');
      
      // Force reload to update activity log
      window.location.reload();
      
    } catch (error) {
      console.error('❌ Error saving activity:', error);
      alert('Failed to save activity: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card section-spacing">
      {/* Header with action buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📈 Growing Degree Days - {locationName}
          </h3>
          <div style={{ display: 'flex', gap: '20px', fontSize: '14px', color: '#6b7280' }}>
            <span><strong>Total GDD:</strong> {Math.round(totalGDD)}°F</span>
            <span><strong>Data Points:</strong> {chartData.length}</span>
            <span><strong>Phenology Events:</strong> {phenologyEvents.length}</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={openPhenologyModal}
            style={{
              padding: '8px 12px',
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <Plus size={16} />
            Add Phenology Event
          </button>
          
          <button
            onClick={openActivityModal}
            style={{
              padding: '8px 12px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <Activity size={16} />
            Log Activity
          </button>
        </div>
      </div>

      {/* Instruction */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '12px', 
        backgroundColor: '#f0f9ff', 
        borderRadius: '6px',
        fontSize: '14px',
        color: '#0369a1',
        border: '1px solid #bae6fd'
      }}>
        💡 <strong>Tip:</strong> Click anywhere on the chart to select a date, then use the buttons above to add phenology events or log activities for that specific date.
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height: '400px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            onClick={handleChartClick}
            style={{ cursor: 'crosshair' }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey="displayDate"
              interval="preserveStartEnd"
              fontSize={12}
              tick={{ fill: '#6b7280' }}
            />
            <YAxis 
              label={{ value: 'Cumulative GDD (°F)', angle: -90, position: 'insideLeft' }}
              fontSize={12}
              tick={{ fill: '#6b7280' }}
            />
            <Tooltip 
              formatter={(value: any, name: string) => [
                `${value}°F`, 
                name === 'cumulativeGDD' ? 'Cumulative GDD' : name
              ]}
              labelFormatter={(label) => `Date: ${label}`}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '12px'
              }}
            />
            
            {/* Main GDD line */}
            <Line
              type="monotone"
              dataKey="cumulativeGDD"
              stroke="#059669"
              strokeWidth={3}
              dot={false}
              name="Cumulative GDD"
            />

            {/* Phenology event markers */}
            {phenologyEvents.map((event) => {
              const chartPoint = chartData.find(d => d.date === event.event_date);
              if (chartPoint) {
                return (
                  <ReferenceLine
                    key={event.id || event.event_date}
                    x={chartPoint.displayDate}
                    stroke="#dc2626"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    label={{
                      value: event.event_type,
                      position: 'topRight',
                      fontSize: 10,
                      fill: '#dc2626'
                    }}
                  />
                );
              }
              return null;
            })}

            {/* Selected date marker */}
            {selectedDate && chartData.find(d => d.date === selectedDate) && (
              <ReferenceLine
                x={chartData.find(d => d.date === selectedDate)?.displayDate}
                stroke="#3b82f6"
                strokeWidth={2}
                label={{
                  value: "Selected",
                  position: 'top',
                  fontSize: 10,
                  fill: '#3b82f6'
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Phenology Events Summary */}
      {phenologyEvents.length > 0 && (
        <div style={{ 
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#f0fdf4',
          borderRadius: '8px',
          border: '1px solid #bbf7d0'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#065f46', fontSize: '14px', fontWeight: '600' }}>
            📅 Recorded Phenology Events:
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {phenologyEvents.map((event) => (
              <span
                key={event.id || event.event_date}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}
              >
                {event.event_type} ({new Date(event.event_date).toLocaleDateString()})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Phenology Event Modal */}
      {showPhenologyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#374151' }}>🌱 Add Phenology Event</h3>
              <button
                onClick={() => setShowPhenologyModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} style={{ color: '#6b7280' }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Event Type:
                </label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select event type...</option>
                  {PHENOLOGY_EVENT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Event Date:
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Harvest Block (optional):
                </label>
                <input
                  type="text"
                  value={harvestBlock}
                  onChange={(e) => setHarvestBlock(e.target.value)}
                  placeholder="e.g., Block A, North Field..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Notes (optional):
                </label>
                <textarea
                  value={eventNotes}
                  onChange={(e) => setEventNotes(e.target.value)}
                  placeholder="Additional observations or notes..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowPhenologyModal(false)}
                  disabled={isLoading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    color: '#6b7280',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={savePhenologyEvent}
                  disabled={isLoading || !eventType || !eventDate}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: isLoading || !eventType || !eventDate ? '#9ca3af' : '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isLoading || !eventType || !eventDate ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Save size={16} />
                  {isLoading ? 'Saving...' : 'Save Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Log Modal */}
      {showActivityModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#374151' }}>🔧 Log Activity</h3>
              <button
                onClick={() => setShowActivityModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} style={{ color: '#6b7280' }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Activity Type:
                </label>
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select activity type...</option>
                  {ACTIVITY_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Activity Date:
                </label>
                <input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Notes (optional):
                </label>
                <textarea
                  value={activityNotes}
                  onChange={(e) => setActivityNotes(e.target.value)}
                  placeholder="Details about the activity performed..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowActivityModal(false)}
                  disabled={isLoading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    color: '#6b7280',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveActivity}
                  disabled={isLoading || !activityType || !activityDate}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: isLoading || !activityType || !activityDate ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isLoading || !activityType || !activityDate ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Save size={16} />
                  {isLoading ? 'Saving...' : 'Log Activity'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
