
import React, { useState, useEffect } from 'react';
import { X, Download, FileText, Calendar, Droplets, Sprout, Table } from 'lucide-react';
import { ReportService } from '../lib/reportService';

interface ReportData {
  vineyard: any;
  phenologyEvents: any[];
  weatherData: any[];
  dateRange: { start: string; end: string };
}

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: ReportData;
}

export const ReportsModal: React.FC<ReportsModalProps> = ({ isOpen, onClose, reportData }) => {
  const [activeReport, setActiveReport] = useState<'spray' | 'phenology'>('spray');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

  useEffect(() => {
    if (reportData.dateRange) {
      setDateFilter(reportData.dateRange);
    }
  }, [reportData.dateRange]);

  if (!isOpen) return null;

  const filterEventsByDate = (events: any[]) => {
    if (!dateFilter.start || !dateFilter.end) return events;
    return events.filter(event => {
      const eventDate = new Date(event.event_date);
      const startDate = new Date(dateFilter.start);
      const endDate = new Date(dateFilter.end);
      // Use inclusive date comparison and handle timezone issues
      const eventDateString = event.event_date; // Use string comparison for dates
      return eventDateString >= dateFilter.start && eventDateString <= dateFilter.end;
    });
  };

  const getSprayEvents = () => {
    const sprayEvents = reportData.phenologyEvents.filter(event => 
      event.event_type === 'spray_application' && event.spray_product
    );
    return filterEventsByDate(sprayEvents);
  };

  const getFertilizerEvents = () => {
    const fertEvents = reportData.phenologyEvents.filter(event => 
      event.event_type === 'fertilization' && event.fertilizer_type
    );
    return filterEventsByDate(fertEvents);
  };

  const getAllPhenologyEvents = () => {
    return filterEventsByDate(reportData.phenologyEvents);
  };

  const generateSprayReport = () => {
    // Use all events from reportData for comprehensive reporting
    const allEvents = reportData.phenologyEvents;
    const sprayEvents = allEvents.filter(event => 
      event.event_type === 'spray_application' && event.spray_product
    );
    const fertEvents = allEvents.filter(event => 
      event.event_type === 'fertilization' && event.fertilizer_type
    );
    
    let report = `SPRAY & FERTILIZER APPLICATION REPORT\n`;
    report += `=====================================\n\n`;
    report += `Vineyard: ${reportData.vineyard?.name || 'Unknown'}\n`;
    report += `Location: ${reportData.vineyard?.location || 'Unknown'}\n`;
    report += `Report Period: ${dateFilter.start} to ${dateFilter.end}\n`;
    report += `Generated: ${new Date().toLocaleDateString()}\n\n`;

    // Spray Applications Section
    report += `SPRAY APPLICATIONS (${sprayEvents.length} applications)\n`;
    report += `${'='.repeat(50)}\n\n`;
    
    if (sprayEvents.length === 0) {
      report += `No spray applications recorded for this period.\n\n`;
    } else {
      sprayEvents.forEach((event, index) => {
        report += `${index + 1}. APPLICATION DATE: ${new Date(event.event_date).toLocaleDateString()}\n`;
        report += `   Product: ${event.spray_product || 'Not specified'}\n`;
        report += `   Quantity: ${event.spray_quantity || 'Not specified'} ${event.spray_unit || ''}\n`;
        report += `   Target: ${event.spray_target || 'Not specified'}\n`;
        report += `   Equipment: ${event.spray_equipment || 'Not specified'}\n`;
        report += `   Conditions: ${event.spray_conditions || 'Not specified'}\n`;
        if (event.notes) {
          report += `   Notes: ${event.notes}\n`;
        }
        report += `\n`;
      });
    }

    // Fertilizer Applications Section
    report += `FERTILIZER APPLICATIONS (${fertEvents.length} applications)\n`;
    report += `${'='.repeat(50)}\n\n`;
    
    if (fertEvents.length === 0) {
      report += `No fertilizer applications recorded for this period.\n\n`;
    } else {
      fertEvents.forEach((event, index) => {
        report += `${index + 1}. APPLICATION DATE: ${new Date(event.event_date).toLocaleDateString()}\n`;
        report += `   Type: ${event.fertilizer_type || 'Not specified'}\n`;
        report += `   NPK: ${event.fertilizer_npk || 'Not specified'}\n`;
        report += `   Rate: ${event.fertilizer_rate || 'Not specified'} ${event.fertilizer_unit || ''}\n`;
        report += `   Method: ${event.fertilizer_method || 'Not specified'}\n`;
        if (event.notes) {
          report += `   Notes: ${event.notes}\n`;
        }
        report += `\n`;
      });
    }

    // Summary Section
    const uniqueSprayProducts = [...new Set(sprayEvents.map(e => e.spray_product).filter(Boolean))];
    const uniqueFertilizerTypes = [...new Set(fertEvents.map(e => e.fertilizer_type).filter(Boolean))];
    
    report += `SUMMARY\n`;
    report += `${'='.repeat(20)}\n`;
    report += `Total Spray Applications: ${sprayEvents.length}\n`;
    report += `Unique Products Used: ${uniqueSprayProducts.length}\n`;
    report += `Total Fertilizer Applications: ${fertEvents.length}\n`;
    report += `Unique Fertilizer Types: ${uniqueFertilizerTypes.length}\n\n`;
    
    if (uniqueSprayProducts.length > 0) {
      report += `Products Used: ${uniqueSprayProducts.join(', ')}\n`;
    }
    if (uniqueFertilizerTypes.length > 0) {
      report += `Fertilizers Used: ${uniqueFertilizerTypes.join(', ')}\n`;
    }

    return report;
  };

  const generatePhenologyReport = () => {
    // Use all events from reportData for comprehensive reporting
    const allEvents = reportData.phenologyEvents;
    const weatherSummary = reportData.weatherData.slice(0, 10); // Last 10 days sample
    
    let report = `VINEYARD PHENOLOGY & MANAGEMENT REPORT\n`;
    report += `=====================================\n\n`;
    report += `Vineyard: ${reportData.vineyard?.name || 'Unknown'}\n`;
    report += `Location: ${reportData.vineyard?.location || 'Unknown'}\n`;
    report += `Report Period: ${dateFilter.start} to ${dateFilter.end}\n`;
    report += `Generated: ${new Date().toLocaleDateString()}\n\n`;

    // Weather Summary
    if (weatherSummary.length > 0) {
      const avgHigh = weatherSummary.reduce((sum, day) => sum + day.temp_high, 0) / weatherSummary.length;
      const avgLow = weatherSummary.reduce((sum, day) => sum + day.temp_low, 0) / weatherSummary.length;
      const totalGDD = weatherSummary.reduce((sum, day) => sum + day.gdd, 0);
      const totalRainfall = weatherSummary.reduce((sum, day) => sum + day.rainfall, 0);

      report += `WEATHER SUMMARY (Last ${weatherSummary.length} days)\n`;
      report += `${'='.repeat(40)}\n`;
      report += `Average High Temperature: ${avgHigh.toFixed(1)}°F\n`;
      report += `Average Low Temperature: ${avgLow.toFixed(1)}°F\n`;
      report += `Total Growing Degree Days: ${totalGDD.toFixed(1)}\n`;
      report += `Total Rainfall: ${totalRainfall.toFixed(2)} inches\n\n`;
    }

    // Events by Category
    const eventCategories = {
      'Phenological Events': allEvents.filter(e => ['budbreak', 'bloom', 'fruit_set', 'veraison', 'harvest'].includes(e.event_type)),
      'Spray Applications': allEvents.filter(e => e.event_type === 'spray_application'),
      'Fertilizations': allEvents.filter(e => e.event_type === 'fertilization'),
      'Irrigation': allEvents.filter(e => e.event_type === 'irrigation'),
      'Canopy Management': allEvents.filter(e => e.event_type === 'canopy_management'),
      'Scouting': allEvents.filter(e => e.event_type === 'scouting'),
      'Harvest Activities': allEvents.filter(e => e.event_type === 'harvest')
    };

    Object.entries(eventCategories).forEach(([category, events]) => {
      if (events.length > 0) {
        report += `${category.toUpperCase()} (${events.length} events)\n`;
        report += `${'='.repeat(category.length + 10)}\n`;
        
        events.forEach((event, index) => {
          report += `${index + 1}. ${new Date(event.event_date).toLocaleDateString()}: ${event.event_type.replace('_', ' ').toUpperCase()}\n`;
          if (event.notes) {
            report += `   Notes: ${event.notes}\n`;
          }
          // Add specific details based on event type
          if (event.spray_product) report += `   Product: ${event.spray_product}\n`;
          if (event.fertilizer_type) report += `   Fertilizer: ${event.fertilizer_type}\n`;
          if (event.irrigation_amount) report += `   Amount: ${event.irrigation_amount} ${event.irrigation_unit || ''}\n`;
          if (event.harvest_yield) report += `   Yield: ${event.harvest_yield} ${event.harvest_unit || ''}\n`;
          if (event.harvest_brix) report += `   Brix: ${event.harvest_brix}\n`;
          report += `\n`;
        });
        report += `\n`;
      }
    });

    // Activity Summary
    report += `ACTIVITY SUMMARY\n`;
    report += `${'='.repeat(20)}\n`;
    Object.entries(eventCategories).forEach(([category, events]) => {
      if (events.length > 0) {
        report += `${category}: ${events.length} events\n`;
      }
    });

    return report;
  };

  const downloadReport = () => {
    // Create a filtered version of reportData based on current date filter
    const filteredReportData = {
      ...reportData,
      phenologyEvents: filterEventsByDate(reportData.phenologyEvents),
      dateRange: dateFilter
    };
    
    const reportContent = activeReport === 'spray' 
      ? ReportService.generateSprayComplianceReport(filteredReportData)
      : ReportService.generateSeasonSummaryReport(filteredReportData);
    
    const fileName = `${reportData.vineyard?.name || 'vineyard'}_${activeReport}_report_${new Date().toISOString().split('T')[0]}.txt`;
    ReportService.downloadReport(reportContent, fileName);
  };

  const downloadCSV = () => {
    const csvContent = ReportService.generateCSVExport(reportData);
    const fileName = `${reportData.vineyard?.name || 'vineyard'}_events_${new Date().toISOString().split('T')[0]}.csv`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    // Create a filtered version of reportData based on current date filter
    const filteredReportData = {
      ...reportData,
      phenologyEvents: filterEventsByDate(reportData.phenologyEvents),
      dateRange: dateFilter
    };
    
    const reportContent = activeReport === 'spray' 
      ? ReportService.generateSprayComplianceReport(filteredReportData)
      : ReportService.generateSeasonSummaryReport(filteredReportData);
    
    ReportService.copyToClipboard(reportContent).then(() => {
      alert('Report copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy to clipboard');
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '95%',
        maxWidth: '1000px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
            📊 Vineyard Reports
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Report Type Tabs */}
        <div style={{
          padding: '0 20px',
          display: 'flex',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <button
            onClick={() => setActiveReport('spray')}
            style={{
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeReport === 'spray' ? '2px solid #3b82f6' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeReport === 'spray' ? '600' : '400',
              color: activeReport === 'spray' ? '#3b82f6' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Droplets size={16} />
            Spray & Fertilizer Report
          </button>
          <button
            onClick={() => setActiveReport('phenology')}
            style={{
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeReport === 'phenology' ? '2px solid #3b82f6' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeReport === 'phenology' ? '600' : '400',
              color: activeReport === 'phenology' ? '#3b82f6' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Sprout size={16} />
            Phenology & Management Report
          </button>
        </div>

        {/* Date Filter */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <Calendar size={16} color="#6b7280" />
          <span style={{ fontSize: '14px', fontWeight: '500' }}>Report Period:</span>
          <input
            type="date"
            value={dateFilter.start}
            onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
            style={{
              padding: '6px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          <span>to</span>
          <input
            type="date"
            value={dateFilter.end}
            onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
            style={{
              padding: '6px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Report Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <pre style={{
              whiteSpace: 'pre-wrap',
              fontSize: '12px',
              lineHeight: '1.5',
              margin: 0,
              fontFamily: 'Monaco, Consolas, "Lucida Console", monospace'
            }}>
              {activeReport === 'spray' 
                ? ReportService.generateSprayComplianceReport(reportData)
                : ReportService.generateSeasonSummaryReport(reportData)
              }
            </pre>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={copyToClipboard}
            style={{
              padding: '10px 16px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileText size={16} />
            Copy Text
          </button>
          <button
            onClick={downloadCSV}
            style={{
              padding: '10px 16px',
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Table size={16} />
            Export CSV
          </button>
          <button
            onClick={downloadReport}
            style={{
              padding: '10px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={16} />
            Download Report
          </button>
        </div>
      </div>
    </div>
  );
};
