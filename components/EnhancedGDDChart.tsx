
// components/EnhancedGDDChart.tsx - FIXED VERSION
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

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
  notes?: string;
  end_date?: string;
}

interface EnhancedGDDChartProps {
  weatherData: WeatherDay[];
  locationName?: string;
  vineyardId?: string;
  onEventsChange?: () => void;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  dailyGDD: number;
  cumulativeGDD: number;
  tempHigh: number;
  tempLow: number;
  rainfall: number;
  hasData: boolean;
}

interface PhenologyPrediction {
  stage: string;
  predictedDate: string;
  gddRequired: number;
  confidence: string;
  emoji: string;
}

export function EnhancedGDDChart({ 
  weatherData, 
  locationName = "Vineyard", 
  vineyardId,
  onEventsChange 
}: EnhancedGDDChartProps) {
  const [phenologyEvents, setPhenologyEvents] = useState<PhenologyEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  console.log('📈 EnhancedGDDChart rendering with:', weatherData.length, 'data points');

  // Load phenology events from database
  const loadPhenologyEvents = async () => {
    if (!vineyardId) return;

    setIsLoadingEvents(true);
    try {
      console.log('🔄 Loading phenology events from database for vineyard:', vineyardId);
      
      const { getPhenologyEvents } = await import('../lib/supabase');
      const events = await getPhenologyEvents(vineyardId);
      
      console.log('✅ Loaded phenology events from database:', events.length);
      setPhenologyEvents(events || []);
    } catch (error) {
      console.error('❌ Error loading phenology events:', error);
      setPhenologyEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  // Load events on mount and when vineyard changes
  useEffect(() => {
    loadPhenologyEvents();
  }, [vineyardId]);

  // Listen for events change from parent component
  useEffect(() => {
    const handleEventsChanged = () => {
      console.log('🔄 Phenology events changed, reloading...');
      loadPhenologyEvents();
    };

    window.addEventListener('phenologyEventsChanged', handleEventsChanged);
    return () => {
      window.removeEventListener('phenologyEventsChanged', handleEventsChanged);
    };
  }, [vineyardId]);

  // Process weather data into chart format
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!weatherData || weatherData.length === 0) {
      console.log('⚠️ No weather data provided to chart');
      return [];
    }

    console.log('📊 Processing weather data for chart:', {
      dataLength: weatherData.length,
      firstDate: weatherData[0]?.date,
      lastDate: weatherData[weatherData.length - 1]?.date
    });

    // Sort weather data by date
    const sortedData = [...weatherData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const processed: ChartDataPoint[] = [];
    let cumulativeGDD = 0;

    sortedData.forEach((day, index) => {
      // Validate data
      const dailyGDD = typeof day.gdd === 'number' && !isNaN(day.gdd) ? day.gdd : 0;
      const tempHigh = typeof day.temp_high === 'number' && !isNaN(day.temp_high) ? day.temp_high : 0;
      const tempLow = typeof day.temp_low === 'number' && !isNaN(day.temp_low) ? day.temp_low : 0;
      const rainfall = typeof day.rainfall === 'number' && !isNaN(day.rainfall) ? day.rainfall : 0;

      cumulativeGDD += dailyGDD;

      // Format date for display
      const date = new Date(day.date);
      const displayDate = `${date.getMonth() + 1}/${date.getDate()}`;

      processed.push({
        date: day.date,
        displayDate,
        dailyGDD: Math.round(dailyGDD * 10) / 10,
        cumulativeGDD: Math.round(cumulativeGDD * 10) / 10,
        tempHigh: Math.round(tempHigh * 10) / 10,
        tempLow: Math.round(tempLow * 10) / 10,
        rainfall: Math.round(rainfall * 100) / 100,
        hasData: true
      });
    });

    console.log('📊 Processed chart data:', {
      pointsProcessed: processed.length,
      finalCumulativeGDD: processed[processed.length - 1]?.cumulativeGDD || 0,
      dateRange: {
        start: processed[0]?.date,
        end: processed[processed.length - 1]?.date
      }
    });

    return processed;
  }, [weatherData]);

  // Generate predictions based on accumulated GDD
  const predictions: PhenologyPrediction[] = useMemo(() => {
    if (chartData.length === 0) return [];

    const currentGDD = chartData[chartData.length - 1]?.cumulativeGDD || 0;
    const predictions: PhenologyPrediction[] = [];

    // Standard GDD requirements for wine grapes (base 50°F)
    const stages = [
      { stage: "Bud Break", gdd: 200, emoji: "🌱" },
      { stage: "Bloom", gdd: 1000, emoji: "🌸" },
      { stage: "Fruit Set", gdd: 1300, emoji: "🫐" },
      { stage: "Veraison", gdd: 2200, emoji: "🍇" },
      { stage: "Harvest", gdd: 2800, emoji: "🍷" }
    ];

    // Check if we have events for these stages already
    const completedStages = new Set(
      phenologyEvents
        .filter(event => event.event_date)
        .map(event => {
          const eventType = event.event_type?.toLowerCase().replace(/\s+/g, '_');
          const stageMapping: { [key: string]: string } = {
            'bud_break': 'Bud Break',
            'bloom': 'Bloom',
            'fruit_set': 'Fruit Set',
            'veraison': 'Veraison',
            'harvest': 'Harvest'
          };
          return stageMapping[eventType];
        })
        .filter(Boolean)
    );

    stages.forEach(({ stage, gdd, emoji }) => {
      if (completedStages.has(stage)) return; // Skip if already recorded

      if (currentGDD < gdd) {
        // Calculate estimated date based on recent GDD accumulation rate
        const recentDays = Math.min(14, chartData.length);
        const recentData = chartData.slice(-recentDays);
        const avgDailyGDD = recentData.length > 1 
          ? (recentData[recentData.length - 1].cumulativeGDD - recentData[0].cumulativeGDD) / (recentData.length - 1)
          : 10; // fallback

        const gddNeeded = gdd - currentGDD;
        const daysNeeded = Math.ceil(gddNeeded / Math.max(avgDailyGDD, 1));
        
        const lastDate = new Date(chartData[chartData.length - 1].date);
        const predictedDate = new Date(lastDate);
        predictedDate.setDate(predictedDate.getDate() + daysNeeded);

        let confidence = "Medium";
        if (daysNeeded <= 7) confidence = "High";
        else if (daysNeeded > 30) confidence = "Low";

        predictions.push({
          stage,
          predictedDate: predictedDate.toLocaleDateString(),
          gddRequired: gdd,
          confidence,
          emoji
        });
      }
    });

    return predictions;
  }, [chartData, phenologyEvents]);

  // Get events that fall within the chart date range
  const getDisplayedEvents = () => {
    if (chartData.length === 0) return [];

    const startDate = chartData[0].date;
    const endDate = chartData[chartData.length - 1].date;

    return phenologyEvents.filter(event => {
      const eventDate = event.event_date;
      const isInRange = eventDate >= startDate && eventDate <= endDate;
      
      console.log('📊 Event date check:', {
        eventDate,
        startDate,
        endDate,
        isInRange
      });
      
      return isInRange;
    });
  };

  const displayedEvents = getDisplayedEvents();

  // Handle chart click - scroll to event log
  const handleChartClick = (date?: string) => {
    console.log('📅 Chart clicked, scrolling to event log', date ? `with date ${date}` : '');
    
    // Dispatch custom event with date if provided
    if (date && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chartDateClicked', { 
        detail: { date } 
      }));
    }

    // Scroll to event log section
    const eventLogSection = document.querySelector('[data-event-log-section]');
    if (eventLogSection) {
      eventLogSection.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    } else {
      // Fallback: scroll to add button
      const addButton = document.querySelector('[data-event-log-add-button]');
      if (addButton) {
        addButton.scrollIntoView({ 
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  };

  if (chartData.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '2px dashed #cbd5e1',
        marginTop: '20px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
        <h3 style={{ margin: '0 0 8px 0', color: '#475569' }}>No Chart Data Available</h3>
        <p style={{ margin: '0', color: '#64748b' }}>
          Weather data is required to display the growth curve.
        </p>
      </div>
    );
  }

  // Chart dimensions
  const width = 800;
  const height = 400;
  const margin = { top: 60, right: 60, bottom: 80, left: 80 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Scales
  const maxGDD = Math.max(...chartData.map(d => d.cumulativeGDD));
  const xScale = (index: number) => (index / (chartData.length - 1)) * chartWidth;
  const yScale = (gdd: number) => chartHeight - (gdd / maxGDD) * chartHeight;

  // Event type styling
  const eventStyles: { [key: string]: { color: string, label: string, emoji: string } } = {
    bud_break: { color: "#22c55e", label: "Bud Break", emoji: "🌱" },
    bloom: { color: "#f59e0b", label: "Bloom", emoji: "🌸" },
    veraison: { color: "#8b5cf6", label: "Veraison", emoji: "🍇" },
    harvest: { color: "#ef4444", label: "Harvest", emoji: "🍷" },
    pruning: { color: "#6366f1", label: "Pruning", emoji: "✂️" },
    irrigation: { color: "#06b6d4", label: "Irrigation", emoji: "💧" },
    spray_application: { color: "#f97316", label: "Spray Application", emoji: "🌿" },
    fertilization: { color: "#84cc16", label: "Fertilization", emoji: "🌱" },
    canopy_management: { color: "#10b981", label: "Canopy Management", emoji: "🍃" },
    soil_work: { color: "#8b5cf6", label: "Soil Work", emoji: "🌍" },
    equipment_maintenance: { color: "#6b7280", label: "Equipment Maintenance", emoji: "🔧" },
    fruit_set: { color: "#f59e0b", label: "Fruit Set", emoji: "🫐" },
    pest: { color: "#dc2626", label: "Pest Observation", emoji: "🐞" },
    scouting: { color: "#059669", label: "Scouting", emoji: "🔍" },
    other: { color: "#9ca3af", label: "Other", emoji: "📝" },
  };

  console.log('📊 Chart date range:', {
    startDate: chartData[0]?.date,
    endDate: chartData[chartData.length - 1]?.date,
    actualEndDate: chartData[chartData.length - 1]?.date
  });

  return (
    <div style={{ marginTop: "30px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "15px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              margin: "0 0 5px 0",
            }}
          >
            📈 Growth Curve - {locationName}
          </h2>
          <p style={{ color: "#666", margin: "0" }}>
            Current GDD:{" "}
            <strong>
              {chartData[chartData.length - 1]?.cumulativeGDD || 0} GDDs
            </strong>
            {chartData.length > 0 && (
              <>
                {" • "}
                Data points: {chartData.length}
                {" • "}
                Events shown: {displayedEvents.length}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Interactive Chart */}
      <div
        style={{
          width: "100%",
          backgroundColor: "white",
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "20px",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onClick={() => handleChartClick()}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#f8fafc";
          e.currentTarget.style.borderColor = "#3b82f6";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "white";
          e.currentTarget.style.borderColor = "#ddd";
        }}
      >
        <svg width={width} height={height} style={{ overflow: "visible" }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = margin.top + ratio * chartHeight;
            const gddValue = Math.round(maxGDD * (1 - ratio));
            return (
              <g key={ratio}>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={margin.left + chartWidth}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <text
                  x={margin.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill="#64748b"
                >
                  {gddValue}
                </text>
              </g>
            );
          })}

          {/* Main GDD curve */}
          <path
            d={`M ${chartData
              .map((point, index) => {
                const x = margin.left + xScale(index);
                const y = margin.top + yScale(point.cumulativeGDD);
                return `${index === 0 ? "M" : "L"} ${x} ${y}`;
              })
              .join(" ")}`}
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
          />

          {/* Data points */}
          {chartData.map((point, index) => {
            if (index % Math.max(1, Math.floor(chartData.length / 20)) === 0) {
              const x = margin.left + xScale(index);
              const y = margin.top + yScale(point.cumulativeGDD);
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="3"
                  fill="#2563eb"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChartClick(point.date);
                  }}
                />
              );
            }
            return null;
          })}

          {/* Event markers */}
          {displayedEvents.map((event, index) => {
            const eventDateObj = new Date(event.event_date);
            const chartDateIndex = chartData.findIndex(
              (d) => d.date === event.event_date
            );

            if (chartDateIndex === -1) return null;

            const x = margin.left + xScale(chartDateIndex);
            const gddAtEvent = chartData[chartDateIndex].cumulativeGDD;
            const y = margin.top + yScale(gddAtEvent);

            const eventType = event.event_type?.toLowerCase().replace(/\s+/g, '_') || 'other';
            const style = eventStyles[eventType] || eventStyles.other;

            return (
              <g key={`${event.id}-${index}`}>
                {/* Event line */}
                <line
                  x1={x}
                  y1={margin.top}
                  x2={x}
                  y2={margin.top + chartHeight}
                  stroke={style.color}
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
                {/* Event point */}
                <circle
                  cx={x}
                  cy={y}
                  r="6"
                  fill={style.color}
                  stroke="white"
                  strokeWidth="2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChartClick(event.event_date);
                  }}
                />
                {/* Event label */}
                <text
                  x={x}
                  y={margin.top - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fill={style.color}
                  fontWeight="bold"
                >
                  {style.emoji} {eventDateObj.getMonth() + 1}/{eventDateObj.getDate()}
                </text>
              </g>
            );
          })}

          {/* X-axis */}
          <line
            x1={margin.left}
            y1={margin.top + chartHeight}
            x2={margin.left + chartWidth}
            y2={margin.top + chartHeight}
            stroke="#374151"
            strokeWidth="2"
          />

          {/* Y-axis */}
          <line
            x1={margin.left}
            y1={margin.top}
            x2={margin.left}
            y2={margin.top + chartHeight}
            stroke="#374151"
            strokeWidth="2"
          />

          {/* Axis labels */}
          <text
            x={margin.left + chartWidth / 2}
            y={height - 20}
            textAnchor="middle"
            fontSize="14"
            fontWeight="bold"
            fill="#374151"
          >
            Date
          </text>

          <text
            x={20}
            y={margin.top + chartHeight / 2}
            textAnchor="middle"
            fontSize="14"
            fontWeight="bold"
            fill="#374151"
            transform={`rotate(-90, 20, ${margin.top + chartHeight / 2})`}
          >
            Cumulative GDD (°F)
          </text>

          {/* Date labels on x-axis */}
          {chartData.map((point, index) => {
            if (index % Math.max(1, Math.floor(chartData.length / 6)) === 0) {
              const x = margin.left + xScale(index);
              return (
                <text
                  key={index}
                  x={x}
                  y={margin.top + chartHeight + 20}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#64748b"
                >
                  {point.displayDate}
                </text>
              );
            }
            return null;
          })}

          {/* Chart Title */}
          <text
            x={width / 2}
            y={25}
            textAnchor="middle"
            fontSize="16"
            fontWeight="bold"
            fill="#333"
          >
            Growth Curve - Cumulative GDDs (Click to add events)
          </text>
        </svg>
      </div>

      {/* Displayed Events - Shows only events visible on chart */}
      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h4 style={{ margin: '0', fontSize: '16px', color: '#374151' }}>
            📊 Displayed Events {displayedEvents.length > 0 && `(${displayedEvents.length})`}
          </h4>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {isLoadingEvents ? 'Loading events...' : `Showing events from ${chartData[0]?.displayDate} to ${chartData[chartData.length - 1]?.displayDate}`}
          </div>
        </div>

        {displayedEvents.length > 0 ? (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '10px',
            marginBottom: '20px'
          }}>
            {displayedEvents.map((event, index) => {
              const eventType = event.event_type?.toLowerCase().replace(/\s+/g, '_') || 'other';
              const style = eventStyles[eventType] || eventStyles.other;
              const eventDate = new Date(event.event_date);
              const gddAtEvent = chartData.find(d => d.date === event.event_date)?.cumulativeGDD || 0;

              return (
                <div
                  key={`${event.id}-${index}`}
                  style={{
                    padding: '12px',
                    backgroundColor: 'white',
                    border: `2px solid ${style.color}`,
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleChartClick(event.event_date)}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    marginBottom: '6px'
                  }}>
                    <span style={{ fontSize: '16px' }}>{style.emoji}</span>
                    <span style={{ 
                      fontWeight: '600', 
                      color: style.color,
                      fontSize: '14px'
                    }}>
                      {style.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    📅 {eventDate.toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    📈 {Math.round(gddAtEvent)} GDDs
                  </div>
                  {event.notes && (
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#9ca3af',
                      marginTop: '4px',
                      fontStyle: 'italic',
                      maxHeight: '2.4em',
                      overflow: 'hidden'
                    }}>
                      {event.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '2px dashed #cbd5e1'
          }}>
            <span style={{ fontSize: '24px', marginBottom: '8px', display: 'block' }}>📅</span>
            <p style={{ margin: '0', color: '#64748b', fontSize: '14px' }}>
              No events recorded for this time period
            </p>
          </div>
        )}
      </div>

      {/* Predictions */}
      {predictions.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ 
            margin: '0 0 15px 0', 
            fontSize: '16px', 
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🔮 Phenology Predictions
          </h4>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '12px'
          }}>
            {predictions.map((prediction, index) => (
              <div
                key={index}
                style={{
                  padding: '12px',
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '8px'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  marginBottom: '6px'
                }}>
                  <span style={{ fontSize: '14px' }}>{prediction.emoji}</span>
                  <span style={{ 
                    fontWeight: '600', 
                    color: '#0369a1',
                    fontSize: '13px'
                  }}>
                    {prediction.stage}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#0284c7', marginBottom: '2px' }}>
                  📅 Est: {prediction.predictedDate}
                </div>
                <div style={{ fontSize: '11px', color: '#0284c7', marginBottom: '2px' }}>
                  📈 {prediction.gddRequired} GDDs needed
                </div>
                <div style={{ 
                  fontSize: '10px',
                  padding: '2px 6px',
                  backgroundColor: prediction.confidence === 'High' ? '#dcfce7' : 
                                  prediction.confidence === 'Medium' ? '#fef3c7' : '#fef2f2',
                  color: prediction.confidence === 'High' ? '#166534' : 
                         prediction.confidence === 'Medium' ? '#92400e' : '#991b1b',
                  borderRadius: '4px',
                  display: 'inline-block',
                  marginTop: '4px'
                }}>
                  {prediction.confidence} confidence
                </div>
              </div>
            ))}
          </div>

          <div style={{
            fontSize: '11px',
            color: '#9ca3af',
            marginTop: '8px',
            textAlign: 'center',
            fontStyle: 'italic'
          }}>
            Predictions based on typical GDD requirements and recent accumulation rates
          </div>
        </div>
      )}

      {/* Chart Instructions */}
      <div
        style={{
          marginTop: "15px",
          padding: "12px",
          backgroundColor: "#f0f9ff",
          borderRadius: "8px",
          fontSize: "13px",
          lineHeight: "1.4"
        }}
      >
        <strong>📈 Growth Curve Guide:</strong> Click anywhere on the curve or the "Add Event" button to scroll down to the Event Log section where you can add vineyard events.
        <br />
        <strong>🎯 Event Markers:</strong> Colored dots and lines show recorded events on the timeline.
        <br />
        <strong>🔮 Predictions:</strong> Estimated dates for upcoming phenology stages based on GDD accumulation.
      </div>
    </div>
  );
}
