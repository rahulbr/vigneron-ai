
// Report service for generating professional vineyard reports
export interface ReportData {
  vineyard: any;
  phenologyEvents: any[];
  weatherData: any[];
  dateRange: { start: string; end: string };
}

export class ReportService {
  
  static generateSprayComplianceReport(data: ReportData): string {
    const { vineyard, phenologyEvents, dateRange } = data;
    
    const sprayEvents = phenologyEvents.filter(event => 
      event.event_type === 'spray_application' && event.spray_product
    );
    
    const fertEvents = phenologyEvents.filter(event => 
      event.event_type === 'fertilization' && event.fertilizer_type
    );

    let report = `PESTICIDE & FERTILIZER APPLICATION RECORD\n`;
    report += `${'='.repeat(60)}\n\n`;
    
    // Header Information
    report += `VINEYARD INFORMATION:\n`;
    report += `Vineyard Name: ${vineyard?.name || 'Not specified'}\n`;
    report += `Location: ${vineyard?.location || 'Not specified'}\n`;
    report += `Coordinates: ${vineyard?.latitude?.toFixed(6) || 'N/A'}, ${vineyard?.longitude?.toFixed(6) || 'N/A'}\n`;
    report += `Report Period: ${dateRange.start} to ${dateRange.end}\n`;
    report += `Report Generated: ${new Date().toLocaleString()}\n\n`;

    // Pesticide Applications
    report += `PESTICIDE APPLICATIONS:\n`;
    report += `${'='.repeat(30)}\n\n`;
    
    if (sprayEvents.length === 0) {
      report += `No pesticide applications recorded for this period.\n\n`;
    } else {
      sprayEvents.forEach((event, index) => {
        report += `APPLICATION #${index + 1}\n`;
        report += `Date: ${new Date(event.event_date).toLocaleDateString()}\n`;
        report += `Product Name: ${event.spray_product || 'Not specified'}\n`;
        report += `Rate/Amount: ${event.spray_quantity || 'Not specified'} ${event.spray_unit || ''}\n`;
        report += `Target Pest/Disease: ${event.spray_target || 'Not specified'}\n`;
        report += `Application Method: ${event.spray_equipment || 'Not specified'}\n`;
        report += `Weather Conditions: ${event.spray_conditions || 'Not specified'}\n`;
        if (event.notes) {
          report += `Additional Notes: ${event.notes}\n`;
        }
        report += `\n`;
      });
    }

    // Fertilizer Applications
    report += `FERTILIZER APPLICATIONS:\n`;
    report += `${'='.repeat(30)}\n\n`;
    
    if (fertEvents.length === 0) {
      report += `No fertilizer applications recorded for this period.\n\n`;
    } else {
      fertEvents.forEach((event, index) => {
        report += `APPLICATION #${index + 1}\n`;
        report += `Date: ${new Date(event.event_date).toLocaleDateString()}\n`;
        report += `Fertilizer Type: ${event.fertilizer_type || 'Not specified'}\n`;
        report += `NPK Analysis: ${event.fertilizer_npk || 'Not specified'}\n`;
        report += `Application Rate: ${event.fertilizer_rate || 'Not specified'} ${event.fertilizer_unit || ''}\n`;
        report += `Application Method: ${event.fertilizer_method || 'Not specified'}\n`;
        if (event.notes) {
          report += `Additional Notes: ${event.notes}\n`;
        }
        report += `\n`;
      });
    }

    // Summary Section
    const uniqueProducts = [...new Set(sprayEvents.map(e => e.spray_product).filter(Boolean))];
    const uniqueFertilizers = [...new Set(fertEvents.map(e => e.fertilizer_type).filter(Boolean))];
    
    report += `SUMMARY:\n`;
    report += `${'='.repeat(15)}\n`;
    report += `Total Pesticide Applications: ${sprayEvents.length}\n`;
    report += `Unique Products Used: ${uniqueProducts.length}\n`;
    report += `Total Fertilizer Applications: ${fertEvents.length}\n`;
    report += `Unique Fertilizer Types: ${uniqueFertilizers.length}\n\n`;
    
    if (uniqueProducts.length > 0) {
      report += `Pesticide Products Used:\n`;
      uniqueProducts.forEach(product => {
        report += `  • ${product}\n`;
      });
      report += `\n`;
    }
    
    if (uniqueFertilizers.length > 0) {
      report += `Fertilizer Types Used:\n`;
      uniqueFertilizers.forEach(fert => {
        report += `  • ${fert}\n`;
      });
      report += `\n`;
    }

    // Compliance Footer
    report += `COMPLIANCE CERTIFICATION:\n`;
    report += `${'='.repeat(30)}\n`;
    report += `This record certifies that all applications were made in accordance with\n`;
    report += `label directions and applicable federal, state, and local regulations.\n\n`;
    report += `Prepared by: ___________________________ Date: _______________\n`;
    report += `Signature: _____________________________\n\n`;

    return report;
  }

  static generateSeasonSummaryReport(data: ReportData): string {
    const { vineyard, phenologyEvents, weatherData, dateRange } = data;
    
    let report = `VINEYARD SEASON SUMMARY REPORT\n`;
    report += `${'='.repeat(50)}\n\n`;
    
    // Header Information
    report += `Vineyard: ${vineyard?.name || 'Not specified'}\n`;
    report += `Location: ${vineyard?.location || 'Not specified'}\n`;
    report += `Season: ${dateRange.start} to ${dateRange.end}\n`;
    report += `Report Generated: ${new Date().toLocaleString()}\n\n`;

    // Weather Summary
    if (weatherData.length > 0) {
      const totalGDD = weatherData.reduce((sum, day) => sum + day.gdd, 0);
      const totalRainfall = weatherData.reduce((sum, day) => sum + day.rainfall, 0);
      const avgHigh = weatherData.reduce((sum, day) => sum + day.temp_high, 0) / weatherData.length;
      const avgLow = weatherData.reduce((sum, day) => sum + day.temp_low, 0) / weatherData.length;
      
      report += `WEATHER SUMMARY:\n`;
      report += `${'='.repeat(20)}\n`;
      report += `Total Growing Degree Days: ${totalGDD.toFixed(1)}\n`;
      report += `Total Rainfall: ${totalRainfall.toFixed(2)} inches\n`;
      report += `Average High Temperature: ${avgHigh.toFixed(1)}°F\n`;
      report += `Average Low Temperature: ${avgLow.toFixed(1)}°F\n`;
      report += `Weather Records: ${weatherData.length} days\n\n`;
    }

    // Phenological Events Timeline
    const phenologyStages = phenologyEvents.filter(e => 
      ['budbreak', 'bloom', 'fruit_set', 'veraison', 'harvest'].includes(e.event_type)
    ).sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
    
    if (phenologyStages.length > 0) {
      report += `PHENOLOGICAL TIMELINE:\n`;
      report += `${'='.repeat(25)}\n`;
      phenologyStages.forEach(event => {
        report += `${new Date(event.event_date).toLocaleDateString()}: ${event.event_type.toUpperCase().replace('_', ' ')}\n`;
        if (event.notes) {
          report += `  Notes: ${event.notes}\n`;
        }
      });
      report += `\n`;
    }

    // Management Activities Summary
    const managementActivities = {
      'Spray Applications': phenologyEvents.filter(e => e.event_type === 'spray_application').length,
      'Fertilizations': phenologyEvents.filter(e => e.event_type === 'fertilization').length,
      'Irrigation Events': phenologyEvents.filter(e => e.event_type === 'irrigation').length,
      'Canopy Management': phenologyEvents.filter(e => e.event_type === 'canopy_management').length,
      'Scouting Activities': phenologyEvents.filter(e => e.event_type === 'scouting').length,
      'Harvest Activities': phenologyEvents.filter(e => e.event_type === 'harvest').length
    };

    report += `MANAGEMENT ACTIVITIES:\n`;
    report += `${'='.repeat(25)}\n`;
    Object.entries(managementActivities).forEach(([activity, count]) => {
      if (count > 0) {
        report += `${activity}: ${count} events\n`;
      }
    });
    report += `\n`;

    // Harvest Summary
    const harvestEvents = phenologyEvents.filter(e => e.event_type === 'harvest' && e.harvest_yield);
    if (harvestEvents.length > 0) {
      report += `HARVEST SUMMARY:\n`;
      report += `${'='.repeat(20)}\n`;
      let totalYield = 0;
      let brixReadings = [];
      
      harvestEvents.forEach((event, index) => {
        report += `Harvest ${index + 1} - ${new Date(event.event_date).toLocaleDateString()}:\n`;
        if (event.harvest_yield) {
          report += `  Yield: ${event.harvest_yield} ${event.harvest_unit || ''}\n`;
          if (event.harvest_unit && event.harvest_unit.toLowerCase().includes('ton')) {
            totalYield += parseFloat(event.harvest_yield) || 0;
          }
        }
        if (event.harvest_brix) {
          report += `  Brix: ${event.harvest_brix}°\n`;
          brixReadings.push(parseFloat(event.harvest_brix));
        }
        if (event.harvest_ph) {
          report += `  pH: ${event.harvest_ph}\n`;
        }
        if (event.harvest_ta) {
          report += `  TA: ${event.harvest_ta}\n`;
        }
        if (event.harvest_block) {
          report += `  Block: ${event.harvest_block}\n`;
        }
        report += `\n`;
      });
      
      if (totalYield > 0) {
        report += `Total Estimated Yield: ${totalYield.toFixed(2)} tons\n`;
      }
      if (brixReadings.length > 0) {
        const avgBrix = brixReadings.reduce((sum, val) => sum + val, 0) / brixReadings.length;
        report += `Average Brix: ${avgBrix.toFixed(1)}°\n`;
      }
      report += `\n`;
    }

    return report;
  }

  static downloadReport(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static copyToClipboard(content: string): Promise<void> {
    return navigator.clipboard.writeText(content);
  }

  static generateCSVExport(data: ReportData): string {
    const { phenologyEvents } = data;
    
    let csv = 'Date,Event Type,Notes,Product/Type,Quantity,Unit,Target,Equipment,Conditions\n';
    
    phenologyEvents
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      .forEach(event => {
        const date = new Date(event.event_date).toLocaleDateString();
        const eventType = event.event_type.replace('_', ' ');
        const notes = (event.notes || '').replace(/"/g, '""');
        const product = event.spray_product || event.fertilizer_type || '';
        const quantity = event.spray_quantity || event.fertilizer_rate || event.irrigation_amount || '';
        const unit = event.spray_unit || event.fertilizer_unit || event.irrigation_unit || '';
        const target = event.spray_target || '';
        const equipment = event.spray_equipment || '';
        const conditions = event.spray_conditions || '';
        
        csv += `"${date}","${eventType}","${notes}","${product}","${quantity}","${unit}","${target}","${equipment}","${conditions}"\n`;
      });
    
    return csv;
  }
}
