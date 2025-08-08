
import React, { useState } from 'react';
import { FileText, Download, Calendar, BarChart3, TrendingUp, Activity } from 'lucide-react';

interface ReportsTabProps {
  currentVineyard: any;
  activities: any[];
  weatherData: any[];
}

export function ReportsTab({ currentVineyard, activities, weatherData }: ReportsTabProps) {
  const [selectedReportType, setSelectedReportType] = useState<string>('');
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const reportTypes = [
    {
      id: 'activity_summary',
      name: 'Activity Summary Report',
      description: 'Complete log of all vineyard activities and events',
      icon: Activity,
      color: '#22c55e'
    },
    {
      id: 'weather_summary',
      name: 'Weather Summary Report',
      description: 'Temperature, rainfall, and GDD analysis',
      icon: TrendingUp,
      color: '#3b82f6'
    },
    {
      id: 'phenology_report',
      name: 'Phenology Timeline Report',
      description: 'Key growth stages and timing analysis',
      icon: BarChart3,
      color: '#8b5cf6'
    },
    {
      id: 'compliance_report',
      name: 'Spray Compliance Report',
      description: 'Chemical applications and safety intervals',
      icon: FileText,
      color: '#f59e0b'
    }
  ];

  const generateReport = async (reportType: string) => {
    if (!currentVineyard) {
      alert('Please select a vineyard first');
      return;
    }

    try {
      // This would be expanded to generate actual reports
      console.log('Generating report:', reportType, 'for vineyard:', currentVineyard.name);
      
      // Mock report generation
      const reportData = {
        vineyard: currentVineyard,
        activities: activities,
        weatherData: weatherData,
        dateRange: dateRange,
        reportType: reportType,
        generatedAt: new Date().toISOString()
      };

      // For now, just download as JSON
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentVineyard.name}_${reportType}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('Report generated and downloaded successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report: ' + (error as Error).message);
    }
  };

  const calculateSummaryStats = () => {
    const totalActivities = activities.length;
    const uniqueActivityTypes = new Set(activities.map(a => a.event_type)).size;
    const totalWeatherDays = weatherData.length;
    const totalGDD = weatherData.reduce((sum, day) => sum + (day.gdd || 0), 0);
    
    return {
      totalActivities,
      uniqueActivityTypes,
      totalWeatherDays,
      totalGDD: Math.round(totalGDD)
    };
  };

  const stats = calculateSummaryStats();

  if (!currentVineyard) {
    return (
      <div style={{ padding: '1rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#374151' }}>
          📋 Reports & Analytics
        </h3>
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '2px dashed #cbd5e1'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>📊</div>
          <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>No Vineyard Selected</h4>
          <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>
            Please select a vineyard to generate reports and view analytics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0', fontSize: '1.25rem', color: '#374151' }}>
          📋 Reports & Analytics
        </h3>
        <div style={{ fontSize: '14px', color: '#6b7280' }}>
          {currentVineyard.name}
        </div>
      </div>

      {/* Summary Statistics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Activity size={20} style={{ color: '#22c55e' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Total Activities</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#22c55e' }}>
            {stats.totalActivities}
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
            {stats.uniqueActivityTypes} unique types
          </div>
        </div>

        <div style={{
          padding: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <TrendingUp size={20} style={{ color: '#3b82f6' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Weather Data</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>
            {stats.totalWeatherDays}
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
            days recorded
          </div>
        </div>

        <div style={{
          padding: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <BarChart3 size={20} style={{ color: '#8b5cf6' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Total GDD</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#8b5cf6' }}>
            {stats.totalGDD}
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
            growing degree days
          </div>
        </div>
      </div>

      {/* Date Range Selector */}
      <div style={{
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        marginBottom: '2rem'
      }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>
          Report Date Range
        </h4>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '4px', color: '#6b7280' }}>
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              style={{
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '4px', color: '#6b7280' }}>
              End Date
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              style={{
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>
      </div>

      {/* Available Reports */}
      <div>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>
          Available Reports
        </h4>
        <div style={{ display: 'grid', gap: '16px' }}>
          {reportTypes.map((report) => {
            const IconComponent = report.icon;
            return (
              <div
                key={report.id}
                style={{
                  padding: '20px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <div style={{
                        padding: '8px',
                        backgroundColor: `${report.color}15`,
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <IconComponent size={20} style={{ color: report.color }} />
                      </div>
                      <h5 style={{ margin: '0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>
                        {report.name}
                      </h5>
                    </div>
                    <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
                      {report.description}
                    </p>
                  </div>
                  <button
                    onClick={() => generateReport(report.id)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: report.color,
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginLeft: '16px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                  >
                    <Download size={14} />
                    Generate
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Coming Soon Features */}
      <div style={{ marginTop: '2rem' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>
          Coming Soon
        </h4>
        <div style={{
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '2px dashed #cbd5e1'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.6' }}>
            <div style={{ marginBottom: '8px' }}>📊 <strong>Interactive Dashboards:</strong> Visual analytics and trend analysis</div>
            <div style={{ marginBottom: '8px' }}>📈 <strong>Comparative Analysis:</strong> Year-over-year and block-by-block comparisons</div>
            <div style={{ marginBottom: '8px' }}>📋 <strong>Custom Reports:</strong> Build your own report templates</div>
            <div style={{ marginBottom: '8px' }}>📧 <strong>Automated Reports:</strong> Scheduled email delivery</div>
            <div>🔗 <strong>Export Formats:</strong> PDF, Excel, and CSV export options</div>
          </div>
        </div>
      </div>
    </div>
  );
}
