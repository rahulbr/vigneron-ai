
import React, { useState } from 'react';
import { Activity, TrendingUp, BarChart3, FileText, Download } from 'lucide-react';

interface ReportsTabProps {
  currentVineyard: any;
  activities: any[];
  weatherData: any[];
}

export function ReportsTab({ currentVineyard, activities, weatherData }: ReportsTabProps) {
  const [selectedReportType, setSelectedReportType] = useState<string>('');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 3, 1).toISOString().split('T')[0], // April 1st
    end: new Date().toISOString().split('T')[0]
  });
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);

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

    setGeneratingReport(reportType);
    
    try {
      // Simulate report generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create CSV content based on report type
      let csvContent = '';
      let filename = '';

      switch (reportType) {
        case 'activity_summary':
          filename = `${currentVineyard.name}_Activity_Summary_${new Date().toISOString().split('T')[0]}.csv`;
          csvContent = generateActivityReport();
          break;
        case 'weather_summary':
          filename = `${currentVineyard.name}_Weather_Summary_${new Date().toISOString().split('T')[0]}.csv`;
          csvContent = generateWeatherReport();
          break;
        case 'phenology_report':
          filename = `${currentVineyard.name}_Phenology_Report_${new Date().toISOString().split('T')[0]}.csv`;
          csvContent = generatePhenologyReport();
          break;
        case 'compliance_report':
          filename = `${currentVineyard.name}_Compliance_Report_${new Date().toISOString().split('T')[0]}.csv`;
          csvContent = generateComplianceReport();
          break;
        default:
          throw new Error('Unknown report type');
      }

      // Download the report
      downloadReport(csvContent, filename);

    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report: ' + (error as Error).message);
    } finally {
      setGeneratingReport(null);
    }
  };

  const generateActivityReport = () => {
    const headers = ['Date', 'Event Type', 'Notes', 'Location', 'Blocks'];
    const rows = activities.map(activity => [
      activity.event_date,
      activity.event_type?.replace(/_/g, ' ') || '',
      activity.notes || '',
      activity.location_name || '',
      activity.blocks?.map((b: any) => b.name).join('; ') || ''
    ]);
    
    return [headers, ...rows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
  };

  const generateWeatherReport = () => {
    const headers = ['Date', 'High Temp (°F)', 'Low Temp (°F)', 'Rainfall (in)', 'GDD'];
    const rows = weatherData.map(day => [
      day.date,
      day.temp_high?.toFixed(1) || '',
      day.temp_low?.toFixed(1) || '',
      day.rainfall?.toFixed(2) || '',
      day.gdd?.toFixed(1) || ''
    ]);
    
    return [headers, ...rows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
  };

  const generatePhenologyReport = () => {
    const phenologyEvents = activities.filter(a => 
      ['bud_break', 'bloom', 'fruit_set', 'veraison', 'harvest'].includes(a.event_type)
    );
    
    const headers = ['Stage', 'Date', 'Notes', 'Days from Start'];
    const startDate = new Date(Math.min(...phenologyEvents.map(e => new Date(e.event_date).getTime())));
    
    const rows = phenologyEvents.map(event => {
      const eventDate = new Date(event.event_date);
      const daysFromStart = Math.floor((eventDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      return [
        event.event_type?.replace(/_/g, ' ') || '',
        event.event_date,
        event.notes || '',
        daysFromStart.toString()
      ];
    });
    
    return [headers, ...rows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
  };

  const generateComplianceReport = () => {
    const sprayEvents = activities.filter(a => a.event_type === 'spray_application');
    
    const headers = ['Date', 'Product', 'Quantity', 'Unit', 'Target', 'Re-entry Hours', 'Pre-harvest Days'];
    const rows = sprayEvents.map(spray => [
      spray.event_date,
      spray.spray_product || '',
      spray.spray_quantity || '',
      spray.spray_unit || '',
      spray.spray_target || '',
      '', // Re-entry hours would come from spray database
      ''  // Pre-harvest days would come from spray database
    ]);
    
    return [headers, ...rows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
  };

  const downloadReport = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Total GDD</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>
            {stats.totalGDD}
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
            {stats.totalWeatherDays} days tracked
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
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Data Period</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#8b5cf6' }}>
            {dateRange.start} to {dateRange.end}
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
            Current season
          </div>
        </div>
      </div>

      {/* Date Range Selector */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <h4 style={{ margin: '0 0 1rem 0', fontSize: '16px', color: '#374151' }}>
          Report Date Range
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
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
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              End Date
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>
      </div>

      {/* Report Types */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ padding: '1.5rem 1.5rem 1rem 1.5rem' }}>
          <h4 style={{ margin: '0 0 1rem 0', fontSize: '16px', color: '#374151' }}>
            Available Reports
          </h4>
        </div>

        <div style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
          {reportTypes.map((report) => {
            const IconComponent = report.icon;
            const isGenerating = generatingReport === report.id;

            return (
              <div
                key={report.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '1rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <IconComponent size={20} style={{ color: report.color }} />
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
                  disabled={isGenerating}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: isGenerating ? '#9ca3af' : report.color,
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isGenerating ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginLeft: '16px',
                    minWidth: '120px',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    if (!isGenerating) {
                      e.currentTarget.style.opacity = '0.9';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isGenerating) {
                      e.currentTarget.style.opacity = '1';
                    }
                  }}
                >
                  {isGenerating ? (
                    <>
                      <div style={{
                        width: '14px',
                        height: '14px',
                        border: '2px solid transparent',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      Generate
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
