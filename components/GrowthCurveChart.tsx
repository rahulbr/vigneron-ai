// components/GrowthCurveChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface WeatherDay {
  date: string;
  temp_high: number;
  temp_low: number;
  gdd: number;
  rainfall: number;
}

interface GrowthCurveChartProps {
  weatherData: WeatherDay[];
  locationName?: string;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  dailyGDD: number;
  cumulativeGDD: number;
  tempHigh: number;
  tempLow: number;
}

export function GrowthCurveChart({ weatherData, locationName = "Vineyard" }: GrowthCurveChartProps) {
  console.log('🔍 GrowthCurveChart rendering with:', { 
    dataLength: weatherData.length, 
    locationName,
    firstDay: weatherData[0],
    lastDay: weatherData[weatherData.length - 1]
  });

  // Process weather data into chart format
  const chartData: ChartDataPoint[] = [];
  let cumulativeGDD = 0;

  weatherData.forEach((day, index) => {
    cumulativeGDD += day.gdd;

    // Simple date formatting for now
    const date = new Date(day.date);
    const displayDate = `${date.getMonth() + 1}/${date.getDate()}`;

    chartData.push({
      date: day.date,
      displayDate,
      dailyGDD: Math.round(day.gdd * 10) / 10,
      cumulativeGDD: Math.round(cumulativeGDD * 10) / 10,
      tempHigh: day.temp_high,
      tempLow: day.temp_low,
    });
  });

  console.log('📊 Chart data processed:', { 
    chartDataLength: chartData.length,
    finalGDD: chartData[chartData.length - 1]?.cumulativeGDD,
    samplePoints: chartData.slice(0, 3)
  });

  const totalGDD = chartData[chartData.length - 1]?.cumulativeGDD || 0;

  return (
    <div style={{ width: '100%', marginTop: '20px' }}>
      {/* Simple Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
          🍇 Growing Degree Days - {locationName}
        </h2>
        <p style={{ color: '#666', marginBottom: '10px' }}>
          Total GDD: <strong>{totalGDD}°F</strong> • Data points: {chartData.length}
        </p>
      </div>

      {/* Chart Container */}
      <div style={{ 
        width: '100%', 
        height: '400px', 
        backgroundColor: 'white', 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        padding: '20px' 
      }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="displayDate"
              interval="preserveStartEnd"
            />
            <YAxis 
              label={{ value: 'Cumulative GDD (°F)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={(value: any, name: string) => [
                `${value}°F`, 
                name === 'cumulativeGDD' ? 'Cumulative GDD' : name
              ]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="cumulativeGDD"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Debug Info */}
      <div style={{ 
        marginTop: '15px', 
        padding: '10px', 
        backgroundColor: '#f0f0f0', 
        borderRadius: '5px',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}>
        <strong>Debug Info:</strong> {chartData.length} data points, 
        GDD range: {chartData[0]?.cumulativeGDD || 0}°F → {totalGDD}°F
      </div>
    </div>
  );
}