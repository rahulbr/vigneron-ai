// components/EnhancedGDDChart.tsx - Supabase Database Version
import { useState, useEffect, useCallback } from "react";
import { savePhenologyEvent, getPhenologyEvents, deletePhenologyEvent } from '../lib/supabase';
import { RefreshCw } from 'lucide-react';

interface WeatherDay {
  date: string;
  temp_high: number;
  temp_low: number;
  gdd: number;
  rainfall: number;
}

interface PhenologyEvent {
  id?: string;
  event_type: string; // Change to string to match database return type
  event_date: string; // For single dates or start date for ranges
  end_date?: string; // For date ranges (bud break, bloom, veraison)
  notes?: string;
  harvest_block?: string; // For harvest picks - which block/vineyard section
  created_at?: string;
}

interface EnhancedChartProps {
  weatherData: WeatherDay[];
  locationName: string;
  vineyardId?: string;
  onEventsChange?: () => void; // Callback to notify parent when events change
  vineyardName?: string;
  onEditEvent?: (event: PhenologyEvent) => void;
  onDeleteEvent?: (eventId: string, eventLabel: string) => void;
}

export function EnhancedGDDChart({
  weatherData,
  locationName,
  vineyardId,
  onEventsChange,
  vineyardName,
  onEditEvent,
  onDeleteEvent,
}: EnhancedChartProps) {
  const [phenologyEvents, setPhenologyEvents] = useState<PhenologyEvent[]>([]);
  const [showPhenologyForm, setShowPhenologyForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedEventType, setSelectedEventType] =
    useState<string>("bud_break");
  const [notes, setNotes] = useState("");
  const [harvestBlock, setHarvestBlock] = useState("");
  const [loading, setLoading] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState<string[]>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  console.log(
    "📈 EnhancedGDDChart rendering with:",
    weatherData.length,
    "data points",
  );

  // Load phenology events from database
  const loadPhenologyEvents = useCallback(async () => {
    if (!vineyardId) return;

    try {
      setLoading(true);
      console.log('🔄 Loading phenology events from database for vineyard:', vineyardId);

      const events = await getPhenologyEvents(vineyardId);

      console.log('✅ Loaded phenology events from database:', events?.length || 0);
      setPhenologyEvents(events || []);
    } catch (error) {
      console.error('❌ Failed to load phenology events:', error);
    } finally {
      setLoading(false);
    }
  }, [vineyardId]);

  // Load events when vineyard changes
  useEffect(() => {
    loadPhenologyEvents();
  }, [loadPhenologyEvents]);

  // Listen for external changes to phenology events
  useEffect(() => {
    const handlePhenologyEventsChanged = (event: CustomEvent) => {
      if (event.detail?.vineyardId === vineyardId) {
        console.log('🔄 Refreshing chart events due to external change');
        loadPhenologyEvents();
      }
    };

    window.addEventListener('phenologyEventsChanged', handlePhenologyEventsChanged as EventListener);
    return () => {
      window.removeEventListener('phenologyEventsChanged', handlePhenologyEventsChanged as EventListener);
    };
  }, [vineyardId, loadPhenologyEvents]);

  // Phenology prediction based on GDD accumulation
  const getPhenologyPredictions = () => {
    if (!weatherData.length || !phenologyEvents.length) return [];

    // Typical GDD requirements for phenology stages (rule of thumb)
    const typicalGDDRequirements = {
      bud_break: 150,   // Base - already occurred
      bloom: 900,       // From bud break
      veraison: 1800,   // From bud break
      harvest: 2400     // From bud break (varies by variety)
    };

    // Find recorded events
    const recordedEvents = {
      bud_break: phenologyEvents.find(e => e.event_type === 'bud_break'),
      bloom: phenologyEvents.find(e => e.event_type === 'bloom'),
      veraison: phenologyEvents.find(e => e.event_type === 'veraison'),
      harvest: phenologyEvents.find(e => e.event_type === 'harvest')
    };

    // Get current cumulative GDD
    const currentGDD = chartData[chartData.length - 1]?.cumulativeGDD || 0;
    const predictions = [];

    // Predict missing stages based on what we have
    if (recordedEvents.bud_break && !recordedEvents.bloom && currentGDD < typicalGDDRequirements.bloom) {
      const targetGDD = typicalGDDRequirements.bloom;
      const predictedDate = extrapolateDate(currentGDD, targetGDD);
      if (predictedDate) {
        predictions.push({
          event_type: 'bloom',
          predicted_date: predictedDate,
          predicted_gdd: targetGDD,
          confidence: 'medium'
        });
      }
    }

    if ((recordedEvents.bud_break || recordedEvents.bloom) && !recordedEvents.veraison) {
      const targetGDD = typicalGDDRequirements.veraison;
      const predictedDate = extrapolateDate(currentGDD, targetGDD);
      if (predictedDate) {
        predictions.push({
          event_type: 'veraison',
          predicted_date: predictedDate,
          predicted_gdd: targetGDD,
          confidence: currentGDD > 1000 ? 'high' : 'medium'
        });
      }
    }

    if ((recordedEvents.bud_break || recordedEvents.bloom) && !recordedEvents.harvest) {
      const targetGDD = typicalGDDRequirements.harvest;
      const predictedDate = extrapolateDate(currentGDD, targetGDD);
      if (predictedDate) {
        predictions.push({
          event_type: 'harvest',
          predicted_date: predictedDate,
          predicted_gdd: targetGDD,
          confidence: currentGDD > 1500 ? 'high' : 'low'
        });
      }
    }

    return predictions;
  };

  // Helper function to extrapolate date based on GDD accumulation rate
  const extrapolateDate = (currentGDD: number, targetGDD: number) => {
    if (currentGDD >= targetGDD || weatherData.length < 14) return null;

    // Calculate recent GDD accumulation rate (last 14 days)
    const recentData = weatherData.slice(-14);
    const recentGDDSum = recentData.reduce((sum, d) => sum + d.gdd, 0);
    const dailyGDDRate = recentGDDSum / recentData.length;

    if (dailyGDDRate <= 0) return null;

    // Calculate days needed to reach target
    const gddNeeded = targetGDD - currentGDD;
    const daysNeeded = Math.round(gddNeeded / dailyGDDRate);

    // Get last date and add days needed
    const lastDate = new Date(weatherData[weatherData.length - 1].date);
    const predictedDate = new Date(lastDate);
    predictedDate.setDate(lastDate.getDate() + daysNeeded);

    return predictedDate.toISOString().split('T')[0];
  };

  // Get displayed events (events within the chart date range) with GDD values
  const getDisplayedEvents = () => {
    if (!weatherData.length || !phenologyEvents.length) return [];

    const startDate = weatherData[0]?.date;
    
    // Calculate chart date range from weather data - ensure it includes today
    const chartStartDate = chartData.length > 0 ? chartData[0].date : '';
    const chartEndDate = chartData.length > 0 ? chartData[chartData.length - 1].date : '';
    const today = new Date().toISOString().split('T')[0];
    const actualEndDate = chartEndDate > today ? chartEndDate : today;

    console.log('📊 Chart date range:', { startDate: chartStartDate, endDate: chartEndDate, today, actualEndDate });

    return phenologyEvents
      .filter(event => {
        // Filter by date range - be more inclusive with date comparison
        const eventDate = event.event_date;
        const isInRange = eventDate >= chartStartDate && eventDate <= actualEndDate;
        console.log('📊 Event date check:', { eventDate, startDate: chartStartDate, endDate: actualEndDate, isInRange });
        return isInRange;

        // Apply event type filter if active
        if (eventTypeFilter.length > 0) {
          let eventType = event.event_type?.toLowerCase().replace(/\s+/g, '_') || 'other';

          // Handle any legacy mapping issues
          if (eventType === 'pest_observation') eventType = 'pest';
          if (eventType === 'scouting_activity') eventType = 'scouting';

          return isInRange && eventTypeFilter.includes(eventType);
        }

        return isInRange;
      })
      .map(event => {
        // Calculate cumulative GDD at event date
        const eventDate = event.event_date;
        const cumulativeGDD = weatherData
          .filter(d => d.date <= eventDate)
          .reduce((sum, d) => sum + d.gdd, 0);

        return {
          ...event,
          cumulativeGDD: Math.round(cumulativeGDD)
        };
      })
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
  };

  // Expose refresh function to parent and window for external calls
  useEffect(() => {
    if (window) {
      (window as any).refreshChartEvents = loadPhenologyEvents;
    }
  }, [loadPhenologyEvents]);

  // Clean up window reference on unmount
  useEffect(() => {
    return () => {
      if (window && (window as any).refreshChartEvents) {
        delete (window as any).refreshChartEvents;
      }
    };
  }, []);

  // Process data for chart
  let cumulativeGDD = 0;
  const chartData = weatherData.map((day) => {
    cumulativeGDD += day.gdd;
    return {
      date: day.date,
      cumulativeGDD: Math.round(cumulativeGDD * 10) / 10,
      dailyGDD: day.gdd,
    };
  });

  const maxGDD = Math.max(...chartData.map((d) => d.cumulativeGDD));
  const minGDD = Math.min(...chartData.map((d) => d.cumulativeGDD));
  const width = 800;
  const height = 350;
  const padding = 60;

  // Create SVG path for GDD line
  const pathData = chartData
    .map((point, index) => {
      const x =
        padding + (index / (chartData.length - 1)) * (width - 2 * padding);
      const y =
        height -
        padding -
        ((point.cumulativeGDD - minGDD) / (maxGDD - minGDD)) *
          (height - 2 * padding);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  // Handle chart click to add phenology events
  const handleChartClick = (event: React.MouseEvent<SVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;

    // Calculate which date was clicked
    const clickPosition = (x - padding) / (width - 2 * padding);
    const dataIndex = Math.round(clickPosition * (chartData.length - 1));

    if (dataIndex >= 0 && dataIndex < chartData.length) {
      const clickedDate = chartData[dataIndex].date;
      setSelectedDate(clickedDate);
      setEndDate(""); // Reset end date
      setHarvestBlock(""); // Reset harvest block
      setShowPhenologyForm(true);
    }
  };

  // Add phenology event - SAVE TO SUPABASE DATABASE
  const handleAddPhenologyEvent = async () => {
    console.log("🔍 DEBUG: Save button clicked");
    console.log("🔍 DEBUG selectedDate:", selectedDate);
    console.log("🔍 DEBUG vineyardId:", vineyardId);

    if (!selectedDate || !vineyardId) return;

    try {
      setLoading(true);
      console.log("💾 Saving phenology event to database...");

      // Save directly to Supabase database
      const savedEvent = await savePhenologyEvent(
        vineyardId,
        selectedEventType,
        selectedDate,
        notes || "",
        endDate || undefined,
        harvestBlock || undefined,
      );

      console.log("✅ Phenology event saved to database:", savedEvent);

      // Update local state with the saved event
      const updatedEvents = [...phenologyEvents, savedEvent];
      setPhenologyEvents(updatedEvents);

      // Notify parent component that events have changed
      if (onEventsChange) {
        onEventsChange();
      }

      // Dispatch custom event to notify other components
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('phenologyEventsChanged', { detail: { vineyardId } });
        window.dispatchEvent(event);
      }

      // Clear form
      setShowPhenologyForm(false);
      setNotes("");
      setEndDate("");
      setHarvestBlock("");

      alert("✅ Phenology event saved to database successfully!");
    } catch (error) {
      console.error("❌ Error saving phenology event to database:", error);
      alert("❌ Error saving phenology event: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhenologyEvent = async (eventId: string) => {
    if (!vineyardId || !eventId) {
      console.error("Vineyard ID or Event ID is missing.");
      return;
    }

    try {
      setLoading(true);
      console.log("🗑️ Deleting phenology event from database...");

      // Delete event from Supabase database
      await deletePhenologyEvent(eventId);

      console.log("✅ Phenology event deleted from database:", eventId);

      // Update local state by removing the deleted event
      const updatedEvents = phenologyEvents.filter((event) => event.id !== eventId);
      setPhenologyEvents(updatedEvents);

      // Notify parent component that events have changed
      if (onEventsChange) {
        onEventsChange();
      }

      // Dispatch custom event to notify other components
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('phenologyEventsChanged', { detail: { vineyardId } });
        window.dispatchEvent(event);
      }

      alert("✅ Phenology event deleted successfully!");
    } catch (error) {
      console.error("❌ Error deleting phenology event from database:", error);
      alert("❌ Error deleting phenology event: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Phenology event colors and labels
  const eventStyles: { [key: string]: { color: string, label: string, emoji: string } } = {
    bud_break: { color: "#22c55e", label: "Bud Break", emoji: "🌱" },
    bloom: { color: "#f59e0b", label: "Bloom", emoji: "🌸" },
    veraison: { color: "#8b5cf6", label: "Veraison", emoji: "🍇" },
    harvest: { color: "#ef4444", label: "Harvest", emoji: "🍷" },
    // Activity log types
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

  // Check if selected event type uses date ranges
  const isDateRangeEvent = ["bud_break", "bloom", "veraison"].includes(
    selectedEventType,
  );
  const isHarvestEvent = selectedEventType === "harvest";

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
            🍇 Growing Degree Days - {locationName}
          </h2>
          <p style={{ color: "#666", margin: "0" }}>
            Total GDD:{" "}
            <strong>
              {chartData[chartData.length - 1]?.cumulativeGDD || 0} GDDs
            </strong>
            {phenologyEvents.length > 0 && (
              <span style={{ marginLeft: "20px" }}>
                Events: <strong>{phenologyEvents.length}</strong>
              </span>
            )}
            {loading && (
              <span style={{ marginLeft: "20px", color: "#f59e0b" }}>
                🔄 Loading...
              </span>
            )}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {/* Event Type Filter */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              style={{
                padding: "8px 16px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}
            >
              🔍 Filter ({eventTypeFilter.length > 0 ? eventTypeFilter.length : 'All'})
            </button>

            {showFilterDropdown && (
              <div style={{
                position: "absolute",
                top: "100%",
                right: "0",
                backgroundColor: "white",
                border: "1px solid #ddd",
                borderRadius: "6px",
                boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                zIndex: 1000,
                minWidth: "200px",
                maxHeight: "300px",
                overflowY: "auto"
              }}>
                <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontWeight: "bold", fontSize: "12px" }}>
                  Filter by Event Type:
                </div>
                <div style={{ padding: "4px" }}>
                  <button
                    onClick={() => setEventTypeFilter([])}
                    style={{
                      width: "100%",
                      padding: "6px 12px",
                      backgroundColor: eventTypeFilter.length === 0 ? "#e0f2fe" : "transparent",
                      border: "none",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                  >
                    Show All Events
                  </button>
                  {Object.entries(eventStyles).map(([type, style]) => {
                    const isSelected = eventTypeFilter.includes(type);
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          if (isSelected) {
                            setEventTypeFilter(prev => prev.filter(t => t !== type));
                          } else {
                            setEventTypeFilter(prev => [...prev, type]);
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "6px 12px",
                          backgroundColor: isSelected ? "#e0f2fe" : "transparent",
                          border: "none",
                          textAlign: "left",
                          cursor: "pointer",
                          fontSize: "12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        <div
                          style={{
                            width: "8px",
                            height: "8px",
                            backgroundColor: style.color,
                            borderRadius: "50%"
                          }}
                        ></div>
                        {style.emoji} {style.label}
                        {isSelected && <span style={{ marginLeft: "auto", color: "#22c55e" }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowPhenologyForm(true)}
            disabled={loading}
            style={{
              padding: "8px 16px",
              backgroundColor: loading ? "#ccc" : "#22c55e",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px",
            }}
          >
            Add Event
          </button>
          <button
            onClick={loadPhenologyEvents}
            disabled={loading}
            style={{
              padding: "8px 16px",
              backgroundColor: loading ? "#ccc" : "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "15px",
          backgroundColor: "white",
          overflow: "auto",
        }}
      >
        <svg
          width={width}
          height={height}
          style={{ maxWidth: "100%", cursor: loading ? "wait" : "crosshair" }}
          onClick={loading ? undefined : handleChartClick}
        >
          {/* Grid */}
          <defs>
            <pattern
              id="grid"
              width="40"
              height="30"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 30"
                fill="none"
                stroke="#f0f0f0"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Axes */}
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="#333"
            strokeWidth="2"
          />
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={height - padding}
            stroke="#333"
            strokeWidth="2"
          />

          {/* Y-axis labels */}
          <text
            x={padding - 10}
            y={padding + 5}
            textAnchor="end"
            fontSize="12"
            fill="#666"
          >
            {maxGDD} GDDs
          </text>
          <text
            x={padding - 10}
            y={height - padding + 5}
            textAnchor="end"
            fontSize="12"
            fill="#666"
          >
            {minGDD} GDDs
          </text>

          {/* X-axis date labels (every 30 days) */}
          {chartData
            .filter((_, index) => index % 30 === 0)
            .map((point, index) => {
              const dataIndex = chartData.indexOf(point);
              const x =
                padding +
                (dataIndex / (chartData.length - 1)) * (width - 2 * padding);
              const date = new Date(point.date);
              const label = `${date.getMonth() + 1}/${date.getDate()}`;

              return (
                <text
                  key={index}
                  x={x}
                  y={height - padding + 15}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#666"
                >
                  {label}
                </text>
              );
            })}

          {/* Phenology Event Vertical Lines and Ranges */}
          {phenologyEvents.filter(event => {
            // First check if event is within chart date range
            const startDate = weatherData[0]?.date;
            const endDate = weatherData[weatherData.length - 1]?.date;
            const eventDate = event.event_date;
            const isInDateRange = eventDate >= startDate && eventDate <= endDate;

            if (!isInDateRange) return false;

            // Apply event type filter
            if (eventTypeFilter.length === 0) return true;
            let eventType = event.event_type?.toLowerCase().replace(/\s+/g, '_') || 'other';

            // Handle any legacy mapping issues
            if (eventType === 'pest_observation') eventType = 'pest';
            if (eventType === 'scouting_activity') eventType = 'scouting';

            return eventTypeFilter.includes(eventType);
          }).map((event, index) => {
            const startDataIndex = chartData.findIndex(
              (d) => d.date === event.event_date,
            );
            if (startDataIndex === -1) return null;

            const startX =
              padding +
              (startDataIndex / (chartData.length - 1)) * (width - 2 * padding);
            const style = eventStyles[event.event_type] || eventStyles.other;

            // If it's a date range event with end_date
            if (event.end_date && event.event_type !== "harvest") {
              const endDataIndex = chartData.findIndex(
                (d) => d.date === event.end_date,
              );
              if (endDataIndex !== -1) {
                const endX =
                  padding +
                  (endDataIndex / (chartData.length - 1)) *
                    (width - 2 * padding);

                return (
                  <g key={index}>
                    {/* Range rectangle */}
                    <rect
                      x={startX}
                      y={padding}
                      width={endX - startX}
                      height={height - 2 * padding}
                      fill={style.color}
                      fillOpacity="0.2"
                      stroke={style.color}
                      strokeWidth="2"
                      strokeDasharray="5,5"
                    />
                    {/* Start marker */}
                    <circle
                      cx={startX}
                      cy={padding - 15}
                      r="8"
                      fill={style.color}
                      stroke="white"
                      strokeWidth="2"
                    />
                    <text
                      x={startX}
                      y={padding - 10}
                      textAnchor="middle"
                      fontSize="12"
                    >
                      {style.emoji}
                    </text>
                    {/* End marker */}
                    <circle
                      cx={endX}
                      cy={padding - 15}
                      r="6"
                      fill={style.color}
                      stroke="white"
                      strokeWidth="2"
                    />
                  </g>
                );
              }
            }

            // Single date event (harvest picks or single-date development stages)
            return (
              <g key={index}>
                {/* Vertical line */}
                <line
                  x1={startX}
                  y1={padding}
                  x2={startX}
                  y2={height - padding}
                  stroke={style.color}
                  strokeWidth="3"
                  strokeDasharray={
                    event.event_type === "harvest" ? "3,3" : "5,5"
                  }
                />
                {/* Event marker */}
                <circle
                  cx={startX}
                  cy={padding - 15}
                  r="8"
                  fill={style.color}
                  stroke="white"
                  strokeWidth="2"
                />
                {/* Event emoji */}
                <text
                  x={startX}
                  y={padding - 10}
                  textAnchor="middle"
                  fontSize="12"
                >
                  {style.emoji}
                </text>
                {/* Harvest block label */}
                {event.event_type === "harvest" && event.harvest_block && (
                  <text
                    x={startX}
                    y={padding - 25}
                    textAnchor="middle"
                    fontSize="10"
                    fill={style.color}
                    fontWeight="bold"
                  >
                    {event.harvest_block}
                  </text>
                )}
              </g>
            );
          })}

          {/* GDD Accumulation Line */}
          <path d={pathData} fill="none" stroke="#2563eb" strokeWidth="3" />

          {/* Recent data points (real weather) */}
          {chartData.slice(-6).map((point, index) => {
            const dataIndex = chartData.indexOf(point);
            const x =
              padding +
              (dataIndex / (chartData.length - 1)) * (width - 2 * padding);
            const y =
              height -
              padding -
              ((point.cumulativeGDD - minGDD) / (maxGDD - minGDD)) *
                (height - 2 * padding);
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="4"
                fill="#10b981"
                stroke="white"
                strokeWidth="2"
              />
            );
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
            Cumulative Growing Degree Days (Click to add events)
          </text>
        </svg>
      </div>

      {/* Phenology Form Modal */}
      {showPhenologyForm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "30px",
              borderRadius: "12px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              minWidth: "450px",
              maxWidth: "90vw",
            }}
          >
            <h3 style={{ margin: "0 0 20px 0", fontSize: "20px" }}>
              Add Event - {vineyardName}
            </h3>

            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Event Type:
              </label>
              <select
                value={selectedEventType}
                onChange={(e) =>
                  setSelectedEventType(e.target.value)
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              >
                {Object.entries(eventStyles).map(([type, style]) => (
                  <option key={type} value={type}>
                    {style.emoji} {style.label}
                  </option>
                ))}
              </select>
            </div>

            {isDateRangeEvent ? (
              <>
                <div style={{ marginBottom: "15px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontWeight: "bold",
                    }}
                  >
                    Start Date:
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
```text
                  border: "1px solid #ddd",
                      borderRadius: "4px",
                    }}
                  />
                </div>
                <div style={{ marginBottom: "15px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontWeight: "bold",
                    }}
                  >
                    End Date (optional):
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={selectedDate}
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                    }}
                  />
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      marginTop: "2px",
                    }}
                  >
                    Leave empty for single date, or set range for gradual{" "}
                    {selectedEventType.replace("_", " ")}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ marginBottom: "15px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  {isHarvestEvent ? "Harvest Pick Date:" : "Date:"}
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
              </div>
            )}

            {isHarvestEvent && (
              <div style={{ marginBottom: "15px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  Block/Section:
                </label>
                <input
                  type="text"
                  value={harvestBlock}
                  onChange={(e) => setHarvestBlock(e.target.value)}
                  placeholder="e.g., Block A, North Field, Pinot Block..."
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Notes (optional):
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={`Add observations about this ${selectedEventType.replace("_", " ")}...`}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  minHeight: "60px",
                  resize: "vertical",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setShowPhenologyForm(false);
                  setNotes("");
                  setEndDate("");
                  setHarvestBlock("");
                }}
                disabled={loading}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#f3f4f6",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddPhenologyEvent}
                disabled={!selectedDate || loading}
                style={{
                  padding: "8px 16px",
                  backgroundColor:
                    !selectedDate || loading ? "#ccc" : "#22c55e",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: !selectedDate || loading ? "not-allowed" : "pointer",
                }}
              >
                {loading
                  ? "💾 Saving..."
                  : isHarvestEvent
                    ? "Add Pick"
                    : "Add Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Displayed Events - Shows only events visible on chart */}
      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h4 style={{ margin: '0', fontSize: '16px', color: '#374151' }}>
            📊 Displayed Events {getDisplayedEvents().length > 0 && `(${getDisplayedEvents().length})`}
          </h4>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            Events shown on chart
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
            <div>Loading events...</div>
          </div>
        ) : getDisplayedEvents().length === 0 ? (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>📈</div>
            <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>
              {eventTypeFilter.length > 0
                ? 'No events match current filter for this date range'
                : 'No events in current chart date range'
              }
            </p>
          </div>
        ) : (
          <div style={{
            maxHeight: '200px',
            overflowY: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: 'white'
          }}>
            {getDisplayedEvents().map((event, index) => {
              // Get event style with icon and color
              const displayEventStyles: { [key: string]: { color: string, label: string, emoji: string } } = {
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

              const eventType = event.event_type?.toLowerCase().replace(' ', '_') || 'other';
              const style = displayEventStyles[eventType] || displayEventStyles.other;

              return (
                <div
                  key={event.id || index}
                  style={{
                    padding: '12px 15px',
                    borderBottom: index < getDisplayedEvents().length - 1 ? '1px solid #f3f4f6' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: style.color,
                        borderRadius: '50%',
                      }}
                    ></div>
                    <span style={{ fontSize: '14px' }}>{style.emoji}</span>
                    <span style={{ fontWeight: '500', color: '#374151', fontSize: '14px' }}>
                      {style.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      padding: '2px 6px',
                      backgroundColor: '#f1f5f9',
                      borderRadius: '10px'
                    }}>
                      {new Date(event.event_date).toLocaleDateString()}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      color: '#059669',
                      padding: '2px 6px',
                      backgroundColor: '#ecfdf5',
                      borderRadius: '10px',
                      fontWeight: '500'
                    }}>
                      {event.cumulativeGDD} GDDs
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{
          fontSize: '11px',
          color: '#9ca3af',
          marginTop: '8px',
          textAlign: 'center',
          fontStyle: 'italic'
        }}>
          For editing or deleting events, use the main Event Log section below
        </div>
      </div>

      {/* Phenology Predictions */}
      {(() => {
        const predictions = getPhenologyPredictions();
        if (predictions.length === 0) return null;

        return (
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ margin: '0', fontSize: '16px', color: '#374151' }}>
                🔮 Predicted Phenology Stages
              </h4>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                Based on GDD accumulation
              </div>
            </div>

            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              backgroundColor: 'white'
            }}>
              {predictions.map((prediction, index) => {
                const style = eventStyles[prediction.event_type] || eventStyles.other;
                const confidenceColor = {
                  high: '#059669',
                  medium: '#d97706',
                  low: '#dc2626'
                }[prediction.confidence];

                return (
                  <div
                    key={index}
                    style={{
                      padding: '12px 15px',
                      borderBottom: index < predictions.length - 1 ? '1px solid #f3f4f6' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          backgroundColor: style.color,
                          borderRadius: '50%',
                          opacity: 0.7
                        }}
                      ></div>
                      <span style={{ fontSize: '14px' }}>{style.emoji}</span>
                      <span style={{ fontWeight: '500', color: '#374151', fontSize: '14px' }}>
                        {style.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        padding: '2px 6px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '10px'
                      }}>
                        ~{new Date(prediction.predicted_date).toLocaleDateString()}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: '#374151',
                        padding: '2px 6px',
                        backgroundColor: '#f1f5f9',
                        borderRadius: '10px'
                      }}>
                        {prediction.predicted_gdd} GDDs
                      </span>
                      <span style={{
                        fontSize: '11px',
                        color: confidenceColor,
                        padding: '2px 6px',
                        backgroundColor: `${confidenceColor}15`,
                        borderRadius: '10px',
                        fontWeight: '500',
                        textTransform: 'uppercase'
                      }}>
                        {prediction.confidence}
                      </span>
                    </div>
                  </div>
                );
              })}
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
        );
      })()}



      {/* Chart Instructions */}
      <div
        style={{
          marginTop: "15px",
          padding: "10px",
          backgroundColor: "#e0f2fe",
          borderRadius: "5px",
          fontSize: "12px",
        }}
      >
        <strong>Instructions:</strong> Click on the chart or use the button to
        add events. Development stages (bud break, bloom, veraison)
        can be date ranges. Harvest picks are individual dates with block
        labels.
        <br />
        <strong>🎉 NEW:</strong> Events are now saved to your personal database
        and will appear in the Events section below!
      </div>
    </div>
  );
}