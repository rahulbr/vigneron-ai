// pages/test.tsx - Fresh start to avoid caching
import { useState } from "react";

export default function Test() {
  const [result, setResult] = useState<string>("");

  const testEnvironment = () => {
    const nextPublicKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
    const privateKey = process.env.OPENWEATHER_API_KEY;

    const report = `
🔧 ENVIRONMENT TEST RESULTS:
=================================

NEXT_PUBLIC_OPENWEATHER_API_KEY: ${nextPublicKey ? `✅ FOUND (${nextPublicKey.length} chars)` : "❌ NOT FOUND"}
OPENWEATHER_API_KEY: ${privateKey ? `✅ FOUND (${privateKey.length} chars)` : "❌ NOT FOUND"}

First 8 chars of NEXT_PUBLIC: ${nextPublicKey ? nextPublicKey.substring(0, 8) + "..." : "N/A"}
First 8 chars of PRIVATE: ${privateKey ? privateKey.substring(0, 8) + "..." : "N/A"}

Keys match: ${nextPublicKey && privateKey ? (nextPublicKey === privateKey ? "✅ YES" : "❌ NO") : "N/A"}

Browser info:
- URL: ${window.location.href}
- Is Replit: ${window.location.hostname.includes("replit") ? "YES" : "NO"}
    `;

    setResult(report);
  };

  const testDirectAPI = async () => {
    const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;

    if (!API_KEY) {
      setResult("❌ No API key found - cannot test API");
      return;
    }

    try {
      // Test direct geocoding
      const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=Port%20Huron,Michigan,US&limit=1&appid=${API_KEY}`;
      const geoResponse = await fetch(geoUrl);
      const geoData = await geoResponse.json();

      const report = `
🌍 DIRECT API TEST RESULTS:
============================

Geocoding API:
- Status: ${geoResponse.status}
- Response: ${JSON.stringify(geoData, null, 2)}
      `;

      setResult(report);
    } catch (error) {
      setResult(`❌ API Test Error: ${error}`);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>🧪 Fresh Environment Test</h1>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={testEnvironment}
          style={{
            padding: "10px",
            marginRight: "10px",
            backgroundColor: "#007acc",
            color: "white",
          }}
        >
          Test Environment Variables
        </button>

        <button
          onClick={testDirectAPI}
          style={{
            padding: "10px",
            backgroundColor: "#28a745",
            color: "white",
          }}
        >
          Test Direct API Call
        </button>
      </div>

      <div
        style={{
          backgroundColor: "#f8f9fa",
          padding: "15px",
          border: "1px solid #dee2e6",
          borderRadius: "5px",
          whiteSpace: "pre-wrap",
          minHeight: "200px",
        }}
      >
        {result || "Click a button to run tests..."}
      </div>

      <div style={{ marginTop: "20px", fontSize: "12px", color: "#666" }}>
        <p>This is a fresh file to avoid any Replit caching issues.</p>
      </div>
    </div>
  );
}
