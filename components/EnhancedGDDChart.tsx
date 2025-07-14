import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface WeatherDataPoint {
  date: string;
  temp_high: number;
  temp_low: number;
  gdd: number;
  rainfall: number;
  cumulative_gdd?: number;
}

interface PhenologyEvent {
  id?: string;
  event_type: string;
  event_date: string;
  notes?: string;
}

interface EnhancedGDDChartProps {
  weatherData: WeatherDataPoint[];
  phenologyEvents: PhenologyEvent[];
  onAddPhenologyEvent?: (eventType: string, date: string, notes: string) => void;
}

const EnhancedGDDChart: React.FC<EnhancedGDDChartProps> = ({
  weatherData,
  phenologyEvents,
  onAddPhenologyEvent
}) => {
  const [showModal, setShowModal] = useState(false);
  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventNotes, setEventNotes] = useState('');

  console.log('📈 EnhancedGDDChart rendering with:', weatherData.length, 'data points');

  // Calculate cumulative GDD
  const chartData = weatherData.map((day, index) => {
    const cumulativeGDD = weatherData
      .slice(0, index + 1)
      .reduce((sum, d) => sum + d.gdd, 0);

    return {
      ...day,
      cumulative_gdd: cumulativeGDD,
      displayDate: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    };
  });

  const handleAddEvent = () => {
    if (eventType && eventDate && onAddPhenologyEvent) {
      onAddPhenologyEvent(eventType, eventDate, eventNotes);
      setShowModal(false);
      setEventType('');
      setEventDate('');
      setEventNotes('');
    }
  };

  const formatTooltip = (value: any, name: string) => {
    if (name === 'cumulative_gdd') {
      return [`${Math.round(value)}°F`, 'Cumulative GDD'];
    }
    return [value, name];
  };

  const formatXAxisLabel = (tickItem: string) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ width: '100%', height: '400px', position: 'relative' }}>
      {/* Add Phenology Event Button */}
      <div style={{ 
        position: 'absolute', 
        top: '10px', 
        right: '10px', 
        zIndex: 10 
      }}>
        <button
          onClick={() => setShowModal(true)}
          style={{
            backgroundColor: '#059669',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#047857'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#059669'}
        >
          📅 Add Phenology Event
        </button>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 50, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date"
            tickFormatter={formatXAxisLabel}
            interval="preserveStartEnd"
          />
          <YAxis />
          <Tooltip 
            formatter={formatTooltip}
            labelFormatter={(label) => `Date: ${formatXAxisLabel(label)}`}
          />
          <Line 
            type="monotone" 
            dataKey="cumulative_gdd" 
            stroke="#059669" 
            strokeWidth={3}
            dot={false}
            name="Cumulative GDD"
          />

          {/* Phenology Event Markers */}
          {phenologyEvents.map((event, index) => (
            <ReferenceLine 
              key={`event-${index}`}
              x={event.event_date} 
              stroke="#dc2626" 
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{ 
                value: event.event_type, 
                position: 'top',
                offset: 10,
                style: { 
                  fill: '#dc2626', 
                  fontWeight: 'bold',
                  fontSize: '12px'
                }
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Add Phenology Event Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
          }}>
            <h3 style={{ 
              margin: '0 0 1.5rem 0', 
              color: '#1f2937',
              fontSize: '1.25rem',
              fontWeight: '600'
            }}>
              📅 Add Phenology Event
            </h3>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem',
                fontWeight: '500',
                color: '#374151'
              }}>
                Event Type:
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '1rem'
                }}
              >
                <option value="">Select event type...</option>
                <option value="Bud Break">Bud Break</option>
                <option value="Flowering">Flowering</option>
                <option value="Fruit Set">Fruit Set</option>
                <option value="Veraison">Veraison</option>
                <option value="Harvest">Harvest</option>
                <option value="Leaf Fall">Leaf Fall</option>
                <option value="Dormancy">Dormancy</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem',
                fontWeight: '500',
                color: '#374151'
              }}>
                Date:
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '1rem'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem',
                fontWeight: '500',
                color: '#374151'
              }}>
                Notes (optional):
              </label>
              <textarea
                value={eventNotes}
                onChange={(e) => setEventNotes(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  resize: 'vertical'
                }}
                placeholder="Additional notes about this phenology event..."
              />
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '1rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#374151',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddEvent}
                disabled={!eventType || !eventDate}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: !eventType || !eventDate ? '#9ca3af' : '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: !eventType || !eventDate ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                Add Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedGDDChart;