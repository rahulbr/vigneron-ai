// pages/debug.tsx
import { useState } from "react";

export default function Debug() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (step: string, data: any) => {
    setResults((prev) => [
      ...prev,
      { step, data, timestamp: new Date().toISOString() },
    ]);
  };

  const testGeocoding = async () => {
    setLoading(true);
    setResults([]);

    const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;

    addResult("🔍 API Key Check", {
      hasKey: !!API_KEY,
      keyLength: API_KEY?.length || 0,
      keyPreview: API_KEY ? `${API_KEY.substring(0, 8)}...` : "none",
    });

    if (!API_KEY) {
      addResult("❌ Error", "No API key found");
      setLoading(false);
      return;
    }

    try {
      // Test 1: Geocoding for Port Huron, Michigan
      addResult("🌍 Testing Geocoding", "Port Huron, Michigan, USA");

      const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=Port Huron,Michigan,US&limit=1&appid=${API_KEY}`;
      addResult("📡 Geocoding URL", geoUrl.replace(API_KEY, "API_KEY_HIDDEN"));

      const geoResponse = await fetch(geoUrl);
      addResult("📡 Geocoding Response Status", geoResponse.status);

      if (!geoResponse.ok) {
        const errorText = await geoResponse.text();
        addResult("❌ Geocoding Error", {
          status: geoResponse.status,
          error: errorText,
        });
        setLoading(false);
        return;
      }

      const geoData = await geoResponse.json();
      addResult("✅ Geocoding Success", geoData);

      if (geoData.length === 0) {
        addResult("❌ No Location Found", "Try a different location");
        setLoading(false);
        return;
      }

      const { lat, lon, name, state, country } = geoData[0];
      addResult("📍 Coordinates Found", { lat, lon, name, state, country });

      // Test 2: Current Weather
      addResult("🌤️ Testing Current Weather", `${lat}, ${lon}`);

      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=imperial`;
      addResult(
        "📡 Weather URL",
        weatherUrl.replace(API_KEY, "API_KEY_HIDDEN"),
      );

      const weatherResponse = await fetch(weatherUrl);
      addResult("📡 Weather Response Status", weatherResponse.status);

      if (!weatherResponse.ok) {
        const errorText = await weatherResponse.text();
        addResult("❌ Weather Error", {
          status: weatherResponse.status,
          error: errorText,
        });
        setLoading(false);
        return;
      }

      const weatherData = await weatherResponse.json();
      addResult("✅ Weather Success", {
        location: `${weatherData.name}, ${weatherData.sys.country}`,
        temperature: `${weatherData.main.temp}°F`,
        description: weatherData.weather[0].description,
        humidity: `${weatherData.main.humidity}%`,
        tempHigh: weatherData.main.temp_max,
        tempLow: weatherData.main.temp_min,
      });

      // Test 3: Calculate GDD
      const tempHigh = weatherData.main.temp_max;
      const tempLow = weatherData.main.temp_min;
      const avgTemp = (tempHigh + tempLow) / 2;
      const gdd = Math.max(0, avgTemp - 50); // Base temp 50°F for grapes

      addResult("🌡️ GDD Calculation", {
        tempHigh: `${tempHigh}°F`,
        tempLow: `${tempLow}°F`,
        avgTemp: `${avgTemp.toFixed(1)}°F`,
        gdd: `${gdd.toFixed(1)}°F`,
        calculation: `max(0, ${avgTemp.toFixed(1)} - 50) = ${gdd.toFixed(1)}`,
      });
    } catch (error) {
      addResult("💥 Exception", {
        message: (error as Error).message,
        stack: (error as Error).stack,
      });
    } finally {
      setLoading(false);
    }
  };

  const testEnvironment = () => {
    addResult("🔧 Environment Check", {
      userAgent: navigator.userAgent,
      url: window.location.href,
      isReplit: window.location.hostname.includes("replit"),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        hasNextPublicKey: !!process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY,
        hasPrivateKey: !!process.env.OPENWEATHER_API_KEY,
      },
    });
  };

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>🐛 OpenWeather API Debug Tool</h1>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={testEnvironment}
          style={{
            marginRight: "10px",
            padding: "10px",
            backgroundColor: "#333",
            color: "white",
          }}
        >
          Check Environment
        </button>
        <button
          onClick={testGeocoding}
          disabled={loading}
          style={{
            padding: "10px",
            backgroundColor: "#007acc",
            color: "white",
          }}
        >
          {loading ? "Testing..." : "Test Port Huron, MI Weather"}
        </button>
      </div>

      <div
        style={{
          backgroundColor: "#f5f5f5",
          padding: "15px",
          borderRadius: "5px",
          maxHeight: "600px",
          overflow: "auto",
        }}
      >
        {results.length === 0 && (
          <p style={{ color: "#666" }}>
            Click &quot;Test Port Huron, MI Weather&quot; to start debugging...
          </p>
        )}

        {results.map((result, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: "15px",
              borderBottom: "1px solid #ddd",
              paddingBottom: "10px",
            }}
          >
            <div style={{ fontWeight: "bold", color: "#333" }}>
              {result.step}
            </div>
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}
            >
              {result.timestamp}
            </div>
            <pre
              style={{
                backgroundColor: "#fff",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "3px",
                overflow: "auto",
              }}
            >
            {typeof result.data === 'object' ? JSON.stringify(result.data, null, 2) : result.data}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
