// components/WeatherDashboard.tsx - Final version with Google Maps Geocoding & 3 date range buttons

import React, { useState, useEffect } from "react";
import { useWeather, useWeatherConnection } from "../hooks/useWeather";
import { EnhancedGDDChart } from "./EnhancedGDDChart";
import {
  googleGeocodingService,
  GeocodeResult,
} from "../lib/googleGeocodingService";
import {
  AlertCircle,
  RefreshCw,
  MapPin,
  Calendar,
  Thermometer,
  CloudRain,
  TrendingUp,
  Search,
} from "lucide-react";

interface WeatherDashboardProps {
  vineyardId?: string;
  initialLatitude?: number;
  initialLongitude?: number;
  locationName?: string;
}

export function WeatherDashboard({
  vineyardId,
  initialLatitude = 37.3272, // La Honda, CA fallback
  initialLongitude = -122.2813,
  locationName = "La Honda, CA",
}: WeatherDashboardProps) {
  const [latitude, setLatitude] = useState(initialLatitude);
  const [longitude, setLongitude] = useState(initialLongitude);
  const [customLocation, setCustomLocation] = useState(locationName);
  const [locationSearch, setLocationSearch] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: "",
    end: "",
  });
  const [dateRangeMode, setDateRangeMode] = useState<
    "current" | "previous" | "custom"
  >("current");
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [savedLocations, setSavedLocations] = useState<GeocodeResult[]>([]);

  const { isConnected, testing, testConnection } = useWeatherConnection();

  const weatherOptions = {
    latitude,
    longitude,
    startDate: dateRange.start || undefined,
    endDate: dateRange.end || undefined,
    autoFetch: false,
  };

  const { data, loading, error, lastUpdated, refetch, retry, clearError } =
    useWeather(weatherOptions);

  // Load saved locations from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("saved_vineyard_locations");
    if (stored) {
      try {
        setSavedLocations(JSON.parse(stored));
      } catch (error) {
        console.warn("Error loading saved locations:", error);
      }
    }
  }, []);

  // Initialize date range for current calendar year
  useEffect(() => {
    const currentYear = new Date().getFullYear();

    // Default to current year (2025): Jan 1 - Dec 31
    const startDate = `${currentYear}-01-01`;
    const endDate = `${currentYear}-12-31`;

    console.log("📅 Setting current calendar year:", {
      startDate,
      endDate,
      year: currentYear,
    });

    setDateRange({
      start: startDate,
      end: endDate,
    });

    setDateRangeMode("current");
    setIsInitialized(true);
  }, []);

  // Auto-fetch weather data once dates are initialized
  useEffect(() => {
    if (
      isInitialized &&
      dateRange.start &&
      dateRange.end &&
      latitude &&
      longitude
    ) {
      console.log("🌤️ Auto-fetching weather data with:", {
        latitude,
        longitude,
        dateRange,
      });
      refetch();
    }
  }, [
    isInitialized,
    dateRange.start,
    dateRange.end,
    latitude,
    longitude,
    refetch,
  ]);

  // Search for locations using Google Maps API
  const handleLocationSearch = async () => {
    if (!locationSearch.trim()) return;

    setIsSearching(true);
    try {
      const results =
        await googleGeocodingService.geocodeLocation(locationSearch);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch (error) {
      console.error("Google Maps search error:", error);
      alert(
        "Search failed: " +
          (error as Error).message +
          "\n\nFalling back to La Honda, CA",
      );

      // Use La Honda fallback if search fails
      const fallback = googleGeocodingService.getLaHondaFallback();
      selectLocation(fallback);
    } finally {
      setIsSearching(false);
    }
  };

  // Select a location from search results
  const selectLocation = (location: GeocodeResult) => {
    setLatitude(location.latitude);
    setLongitude(location.longitude);
    setCustomLocation(location.name);
    setShowSearchResults(false);
    setLocationSearch("");

    // Save to local storage (keep recent 10 locations)
    const newSavedLocations = [
      location,
      ...savedLocations.filter((l) => l.placeId !== location.placeId),
    ].slice(0, 10);
    setSavedLocations(newSavedLocations);
    localStorage.setItem(
      "saved_vineyard_locations",
      JSON.stringify(newSavedLocations),
    );

    console.log("📍 Selected location:", location);

    // Clear error and refetch if dates are ready
    clearError();
    if (isInitialized && dateRange.start && dateRange.end) {
      refetch();
    }
  };

  // Handle manual coordinate update
  const handleManualLocationUpdate = () => {
    console.log("📍 Manual coordinate update:", {
      latitude,
      longitude,
      customLocation,
    });
    clearError();
    if (isInitialized && dateRange.start && dateRange.end) {
      refetch();
    }
  };

  // Date range button handlers
  // const setCurrentYear = () => {
  //   const currentYear = new Date().getFullYear();
  //   const newDateRange = {
  //     start: `${currentYear}-01-01`,
  //     end: `${currentYear}-12-31`
  //   };
  const setCurrentYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const today = now.toISOString().split("T")[0];

    const newDateRange = {
      start: `${currentYear}-01-01`,
      end: today, // Only up to today
    };

    console.log("📅 Setting current year (up to today):", newDateRange);
    setDateRange(newDateRange);
    setDateRangeMode("current");
    setShowCustomRange(false);
  };

  //   console.log('📅 Setting current year:', newDateRange);
  //   setDateRange(newDateRange);
  //   setDateRangeMode('current');
  //   setShowCustomRange(false);
  // };

  const setPreviousYear = () => {
    const previousYear = new Date().getFullYear() - 1;
    const newDateRange = {
      start: `${previousYear}-01-01`,
      end: `${previousYear}-12-31`,
    };

    console.log("📅 Setting previous year:", newDateRange);
    setDateRange(newDateRange);
    setDateRangeMode("previous");
    setShowCustomRange(false);
  };

  const setCustomDateRange = () => {
    setDateRangeMode("custom");
    setShowCustomRange(true);
  };

  const handleCustomDateRangeUpdate = () => {
    console.log("📅 Updating custom date range:", dateRange);
    clearError();
    if (dateRange.start && dateRange.end) {
      refetch();
    }
  };

  // Calculate summary statistics
  const totalGDD = data.reduce((sum, day) => sum + day.gdd, 0);
  const totalRainfall = data.reduce((sum, day) => sum + day.rainfall, 0);
  const avgTempHigh =
    data.length > 0
      ? data.reduce((sum, day) => sum + day.temp_high, 0) / data.length
      : 0;
  const avgTempLow =
    data.length > 0
      ? data.reduce((sum, day) => sum + day.temp_low, 0) / data.length
      : 0;

  // Don't render until initialized
  if (!isInitialized) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <div
          style={{
            width: "30px",
            height: "30px",
            border: "3px solid #f3f3f3",
            borderTop: "3px solid #3498db",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 10px",
          }}
        ></div>
        <p>Initializing weather dashboard...</p>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "30px" }}>
        <h1
          style={{
            fontSize: "32px",
            fontWeight: "bold",
            margin: "0 0 10px 0",
            color: "#1f2937",
          }}
        >
          🍇 Vineyard Weather Dashboard
        </h1>
        <p style={{ color: "#6b7280", margin: "0" }}>
          Track growing degree days, precipitation, and phenology events for
          your vineyard
        </p>
      </div>

      {/* Connection Status */}
      <div
        style={{
          marginBottom: "20px",
          padding: "12px 16px",
          borderRadius: "8px",
          backgroundColor:
            isConnected === true
              ? "#f0fdf4"
              : isConnected === false
                ? "#fef2f2"
                : "#fefce8",
          border: `1px solid ${isConnected === true ? "#bbf7d0" : isConnected === false ? "#fecaca" : "#fde68a"}`,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {testing ? (
          <>
            <RefreshCw
              size={16}
              style={{ animation: "spin 1s linear infinite" }}
            />
            <span>Testing weather API connection...</span>
          </>
        ) : isConnected === true ? (
          <>
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#22c55e",
              }}
            ></div>
            <span style={{ color: "#065f46" }}>Weather API Connected</span>
          </>
        ) : isConnected === false ? (
          <>
            <AlertCircle size={16} style={{ color: "#dc2626" }} />
            <span style={{ color: "#991b1b" }}>
              Weather API Connection Failed
            </span>
            <button
              onClick={testConnection}
              style={{
                marginLeft: "auto",
                padding: "4px 8px",
                fontSize: "12px",
                backgroundColor: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Retry Connection
            </button>
          </>
        ) : (
          <>
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#eab308",
              }}
            ></div>
            <span style={{ color: "#92400e" }}>Checking connection...</span>
          </>
        )}
      </div>

      {/* Location Controls */}
      <div
        style={{
          marginBottom: "20px",
          padding: "20px",
          backgroundColor: "#f8fafc",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
        }}
      >
        <h3
          style={{
            margin: "0 0 15px 0",
            fontSize: "18px",
            color: "#374151",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <MapPin size={20} />
          Location Settings
        </h3>

        {/* Location Search */}
        <div style={{ marginBottom: "15px" }}>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}
          >
            Search for Location (Google Maps):
          </label>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleLocationSearch()}
              placeholder="e.g., Napa Valley CA, Bordeaux France, Tuscany Italy..."
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
              }}
            />
            <button
              onClick={handleLocationSearch}
              disabled={isSearching || !locationSearch.trim()}
              style={{
                padding: "8px 16px",
                backgroundColor: isSearching ? "#9ca3af" : "#4285f4",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: isSearching ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {isSearching ? (
                <RefreshCw
                  size={16}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <Search size={16} />
              )}
              Search
            </button>
          </div>
        </div>

        {/* Search Results */}
        {showSearchResults && searchResults.length > 0 && (
          <div
            style={{
              marginBottom: "15px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              backgroundColor: "white",
              maxHeight: "200px",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid #e5e7eb",
                fontWeight: "500",
                fontSize: "14px",
                backgroundColor: "#f9fafb",
              }}
            >
              Google Maps Results:
            </div>
            {searchResults.map((result, index) => (
              <div
                key={result.placeId}
                onClick={() => selectLocation(result)}
                style={{
                  padding: "12px",
                  cursor: "pointer",
                  borderBottom:
                    index < searchResults.length - 1
                      ? "1px solid #f3f4f6"
                      : "none",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#f8fafc")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "white")
                }
              >
                <div style={{ fontWeight: "500", marginBottom: "2px" }}>
                  {result.name}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    marginBottom: "2px",
                  }}
                >
                  {result.formattedAddress}
                </div>
                <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                  {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Saved Locations */}
        {savedLocations.length > 0 && (
          <div style={{ marginBottom: "15px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "500",
              }}
            >
              Recent Locations:
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {savedLocations.slice(0, 5).map((location, index) => (
                <button
                  key={location.placeId}
                  onClick={() => selectLocation(location)}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#e0f2fe",
                    color: "#0369a1",
                    border: "1px solid #7dd3fc",
                    borderRadius: "20px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  {location.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Manual Coordinates */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "15px",
            marginBottom: "15px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "500",
              }}
            >
              Location Name:
            </label>
            <input
              type="text"
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
              }}
              placeholder="Vineyard Name or Location"
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "500",
              }}
            >
              Latitude:
            </label>
            <input
              type="number"
              value={latitude}
              onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
              step="0.0001"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
              }}
              placeholder="37.3272"
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "500",
              }}
            >
              Longitude:
            </label>
            <input
              type="number"
              value={longitude}
              onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
              step="0.0001"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
              }}
              placeholder="-122.2813"
            />
          </div>
        </div>

        <button
          onClick={handleManualLocationUpdate}
          disabled={loading}
          style={{
            padding: "8px 16px",
            backgroundColor: loading ? "#9ca3af" : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {loading ? (
            <RefreshCw
              size={16}
              style={{ animation: "spin 1s linear infinite" }}
            />
          ) : (
            <MapPin size={16} />
          )}
          Update Location
        </button>
      </div>

      {/* Date Range Controls - 3 Buttons */}
      <div
        style={{
          marginBottom: "20px",
          padding: "20px",
          backgroundColor: "#f8fafc",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
        }}
      >
        <h3
          style={{
            margin: "0 0 15px 0",
            fontSize: "18px",
            color: "#374151",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Calendar size={20} />
          Date Range Settings
        </h3>

        {/* Three Date Range Buttons */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "15px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={setCurrentYear}
            style={{
              padding: "8px 16px",
              backgroundColor:
                dateRangeMode === "current" ? "#22c55e" : "#f3f4f6",
              color: dateRangeMode === "current" ? "white" : "#374151",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: dateRangeMode === "current" ? "600" : "400",
            }}
          >
            Current Year ({currentYear}) - YTD
          </button>

          <button
            onClick={setPreviousYear}
            style={{
              padding: "8px 16px",
              backgroundColor:
                dateRangeMode === "previous" ? "#22c55e" : "#f3f4f6",
              color: dateRangeMode === "previous" ? "white" : "#374151",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: dateRangeMode === "previous" ? "600" : "400",
            }}
          >
            Previous Year ({previousYear})
          </button>

          <button
            onClick={setCustomDateRange}
            style={{
              padding: "8px 16px",
              backgroundColor:
                dateRangeMode === "custom" ? "#22c55e" : "#f3f4f6",
              color: dateRangeMode === "custom" ? "white" : "#374151",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: dateRangeMode === "custom" ? "600" : "400",
            }}
          >
            Custom Date Range
          </button>
        </div>

        {/* Custom Date Range Inputs */}
        {showCustomRange && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "15px",
              marginBottom: "15px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "500",
                }}
              >
                Start Date:
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                }}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "500",
                }}
              >
                End Date:
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                }}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div style={{ display: "flex", alignItems: "end" }}>
              <button
                onClick={handleCustomDateRangeUpdate}
                disabled={loading}
                style={{
                  padding: "8px 16px",
                  backgroundColor: loading ? "#9ca3af" : "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {loading ? (
                  <RefreshCw
                    size={16}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                ) : (
                  <Calendar size={16} />
                )}
                Update Range
              </button>
            </div>
          </div>
        )}

        {/* Show current date range */}
        <div
          style={{
            padding: "10px",
            backgroundColor: "#e0f2fe",
            borderRadius: "6px",
            fontSize: "14px",
            color: "#0369a1",
          }}
        >
          <strong>Current Range:</strong> {dateRange.start} to {dateRange.end}
          {dateRange.start && dateRange.end && (
            <span style={{ marginLeft: "10px" }}>
              (
              {Math.ceil(
                (new Date(dateRange.end).getTime() -
                  new Date(dateRange.start).getTime()) /
                  (1000 * 60 * 60 * 24),
              )}{" "}
              days)
            </span>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div
          style={{
            marginBottom: "20px",
            padding: "16px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <AlertCircle
            size={20}
            style={{ color: "#dc2626", marginTop: "2px" }}
          />
          <div style={{ flex: 1 }}>
            <h4
              style={{
                margin: "0 0 8px 0",
                color: "#991b1b",
                fontSize: "16px",
              }}
            >
              Weather Data Error ({error.code})
            </h4>
            <p style={{ margin: "0 0 12px 0", color: "#7f1d1d" }}>
              {error.message}
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={retry}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#dc2626",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Retry
              </button>
              <button
                onClick={clearError}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "transparent",
                  color: "#dc2626",
                  border: "1px solid #dc2626",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weather Summary Stats */}
      {data.length > 0 && (
        <div
          style={{
            marginBottom: "30px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "20px",
          }}
        >
          <div
            style={{
              padding: "20px",
              backgroundColor: "white",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <TrendingUp size={20} style={{ color: "#059669" }} />
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#6b7280",
                }}
              >
                Total GDD
              </span>
            </div>
            <div
              style={{ fontSize: "28px", fontWeight: "bold", color: "#059669" }}
            >
              {Math.round(totalGDD)}°F
            </div>
            <div
              style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}
            >
              {data.length} days
            </div>
          </div>

          <div
            style={{
              padding: "20px",
              backgroundColor: "white",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <CloudRain size={20} style={{ color: "#3b82f6" }} />
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#6b7280",
                }}
              >
                Total Rainfall
              </span>
            </div>
            <div
              style={{ fontSize: "28px", fontWeight: "bold", color: "#3b82f6" }}
            >
              {totalRainfall.toFixed(2)}"
            </div>
            <div
              style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}
            >
              Precipitation
            </div>
          </div>

          <div
            style={{
              padding: "20px",
              backgroundColor: "white",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <Thermometer size={20} style={{ color: "#ef4444" }} />
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#6b7280",
                }}
              >
                Avg High Temp
              </span>
            </div>
            <div
              style={{ fontSize: "28px", fontWeight: "bold", color: "#ef4444" }}
            >
              {avgTempHigh.toFixed(1)}°F
            </div>
            <div
              style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}
            >
              Daily average
            </div>
          </div>

          <div
            style={{
              padding: "20px",
              backgroundColor: "white",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <Thermometer size={20} style={{ color: "#8b5cf6" }} />
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#6b7280",
                }}
              >
                Avg Low Temp
              </span>
            </div>
            <div
              style={{ fontSize: "28px", fontWeight: "bold", color: "#8b5cf6" }}
            >
              {avgTempLow.toFixed(1)}°F
            </div>
            <div
              style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}
            >
              Daily average
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            backgroundColor: "#f8fafc",
            borderRadius: "12px",
            border: "2px dashed #cbd5e1",
            marginBottom: "20px",
          }}
        >
          <RefreshCw
            size={32}
            style={{
              color: "#64748b",
              animation: "spin 1s linear infinite",
              marginBottom: "16px",
            }}
          />
          <h3 style={{ margin: "0 0 8px 0", color: "#475569" }}>
            Loading Weather Data
          </h3>
          <p style={{ margin: "0", color: "#64748b" }}>
            Fetching weather data for {customLocation}...
          </p>
        </div>
      )}

      {/* Enhanced GDD Chart */}
      {data.length > 0 && !loading && (
        <div style={{ marginBottom: "20px" }}>
          <EnhancedGDDChart
            weatherData={data}
            locationName={customLocation}
            vineyardId={vineyardId}
          />
        </div>
      )}

      {/* Data Status Footer */}
      {lastUpdated && (
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#f1f5f9",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            textAlign: "center",
            fontSize: "14px",
            color: "#64748b",
          }}
        >
          <span>Last updated: {lastUpdated.toLocaleString()}</span>
          <span style={{ margin: "0 12px", color: "#cbd5e1" }}>•</span>
          <span>{data.length} data points loaded</span>
          {dateRange.start && dateRange.end && (
            <>
              <span style={{ margin: "0 12px", color: "#cbd5e1" }}>•</span>
              <span>
                Period: {dateRange.start} to {dateRange.end}
              </span>
            </>
          )}
        </div>
      )}

      {/* Help Section */}
      <div
        style={{
          marginTop: "30px",
          padding: "20px",
          backgroundColor: "#fefce8",
          borderRadius: "12px",
          border: "1px solid #fde68a",
        }}
      >
        <h4
          style={{ margin: "0 0 12px 0", color: "#92400e", fontSize: "16px" }}
        >
          💡 How to Use This Dashboard
        </h4>
        <ul
          style={{
            margin: "0",
            paddingLeft: "20px",
            color: "#92400e",
            fontSize: "14px",
          }}
        >
          <li style={{ marginBottom: "4px" }}>
            Search for any location worldwide using Google Maps
          </li>
          <li style={{ marginBottom: "4px" }}>
            Select current year (2025), previous year (2024), or custom date
            range
          </li>
          <li style={{ marginBottom: "4px" }}>
            View growing degree days accumulation on the interactive chart
          </li>
          <li style={{ marginBottom: "4px" }}>
            Click on the chart to add phenology events (bud break, bloom, etc.)
          </li>
          <li>Track rainfall and temperature patterns throughout the season</li>
        </ul>

        <div
          style={{
            marginTop: "15px",
            padding: "10px",
            backgroundColor: "#fef3cd",
            borderRadius: "6px",
            fontSize: "13px",
            color: "#92400e",
          }}
        >
          <strong>Global Coverage:</strong> This app can get real weather data
          for any location on Earth using Google Maps geocoding and historical
          weather APIs. Recent locations are saved for quick access.
        </div>
      </div>
    </div>
  );
}
