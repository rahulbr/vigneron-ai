// components/EnhancedGDDChart.tsx - Supabase Database Version
import { useState, useEffect } from "react";
import { savePhenologyEvent, getPhenologyEvents, supabase } from '../lib/supabase';

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
}

interface EnhancedChartProps {
  weatherData: WeatherDay[];
  locationName: string;
  vineyardId?: string;
  onEventsChange?: () => void; // Callback to notify parent when events change
}

export function EnhancedGDDChart({
  weatherData,
  locationName,
  vineyardId,
  onEventsChange,
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

  // Load existing phenology events from SUPABASE DATABASE
  const loadPhenologyEvents = async () => {
    if (vineyardId) {
      try {
        setLoading(true);
        console.log(
          "🔄 Loading phenology events from database for vineyard:",
          vineyardId,
        );

        const events = await getPhenologyEvents(vineyardId);
        setPhenologyEvents(events || []);
        console.log(
          "✅ Loaded phenology events from database:",
          events?.length || 0,
        );
      } catch (error) {
        console.error(
          "❌ Error loading phenology events from database:",
          error,
        );
        // Fallback to empty array if database fails
        setPhenologyEvents([]);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadPhenologyEvents();
  }, [vineyardId]);

  // Expose refresh function to parent
  useEffect(() => {
    if (window) {
      (window as any).refreshChartEvents = loadPhenologyEvents;
    }
  }, [vineyardId]);

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
            // Apply event type filter
            if (eventTypeFilter.length === 0) return true;
            return eventTypeFilter.includes(event.event_type);
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
              Add Event
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

      {/* Events Section */}
      {phenologyEvents.length > 0 && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            backgroundColor: "#f8fafc",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>
            Displayed Events:
          </h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "15px" }}>
            {phenologyEvents.filter(event => {
              // Apply event type filter
              if (eventTypeFilter.length === 0) return true;
              return eventTypeFilter.includes(event.event_type);
            }).map((event, index) => {
              const style = eventStyles[event.event_type] || eventStyles.other;
              const gddAtEvent =
                chartData.find((d) => d.date === event.event_date)
                  ?.cumulativeGDD || 0;

              return (
                <div
                  key={index}
                  style={{ display: "flex", alignItems: "center", gap: "5px" }}
                >
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      backgroundColor: style.color,
                      borderRadius: "50%",
                    }}
                  ></div>
                  <span style={{ fontSize: "14px" }}>
                    {style.emoji} {style.label}: {event.event_date}
                    {event.end_date && ` - ${event.end_date}`}
                    {event.harvest_block && ` (${event.harvest_block})`}
                    {` (${gddAtEvent} GDDs)`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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