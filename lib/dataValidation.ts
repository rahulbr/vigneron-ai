// lib/dataValidation.ts

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface WeatherDataPoint {
  date: string;
  temp_high: number;
  temp_low: number;
  gdd: number;
  rainfall: number;
}

export interface PhenologyEvent {
  id?: string;
  event_type: 'bud_break' | 'bloom' | 'veraison' | 'harvest';
  event_date: string;
  end_date?: string;
  notes?: string;
  harvest_block?: string;
}

export class DataValidator {

  /**
   * Validate coordinates
   */
  static validateCoordinates(latitude: number, longitude: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if coordinates are numbers
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      errors.push('Latitude and longitude must be numbers');
    }

    // Check coordinate ranges
    if (latitude < -90 || latitude > 90) {
      errors.push('Latitude must be between -90 and 90 degrees');
    }

    if (longitude < -180 || longitude > 180) {
      errors.push('Longitude must be between -180 and 180 degrees');
    }

    // Check for reasonable vineyard locations (most vineyards are between 30-50°N)
    if (latitude !== 0 && (latitude < 25 || latitude > 55)) {
      warnings.push('Coordinates appear to be outside typical wine-growing regions (25-55°N)');
    }

    // Check for null island (0,0)
    if (latitude === 0 && longitude === 0) {
      warnings.push('Coordinates (0,0) may indicate an error - this location is in the ocean');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate date string format and reasonableness
   */
  static validateDate(dateString: string, fieldName: string = 'Date'): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!dateString) {
      errors.push(`${fieldName} is required`);
      return { isValid: false, errors, warnings };
    }

    // Check date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      errors.push(`${fieldName} must be in YYYY-MM-DD format`);
      return { isValid: false, errors, warnings };
    }

    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      errors.push(`${fieldName} is not a valid date`);
      return { isValid: false, errors, warnings };
    }

    // Check if date is not too far in the past
    const currentYear = new Date().getFullYear();
    const dateYear = date.getFullYear();

    if (dateYear < 1950) {
      warnings.push(`${fieldName} is quite old (${dateYear}) - weather data may not be available`);
    }

    // Check if date is in the future
    if (date > new Date()) {
      warnings.push(`${fieldName} is in the future - only historical data is available`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate date range
   */
  static validateDateRange(startDate: string, endDate: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate individual dates first
    const startValidation = this.validateDate(startDate, 'Start date');
    const endValidation = this.validateDate(endDate, 'End date');

    errors.push(...startValidation.errors, ...endValidation.errors);
    warnings.push(...startValidation.warnings, ...endValidation.warnings);

    if (errors.length > 0) {
      return { isValid: false, errors, warnings };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Check if start is before end
    if (start >= end) {
      errors.push('Start date must be before end date');
    }

    // Check range duration
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 1095) { // 3 years
      warnings.push(`Date range is quite long (${diffDays} days) - this may affect performance`);
    }

    if (diffDays < 7) {
      warnings.push('Date range is very short - consider extending for better analysis');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate weather data array
   */
  static validateWeatherData(data: WeatherDataPoint[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(data)) {
      errors.push('Weather data must be an array');
      return { isValid: false, errors, warnings };
    }

    if (data.length === 0) {
      errors.push('Weather data array is empty');
      return { isValid: false, errors, warnings };
    }

    // Check each data point
    data.forEach((point, index) => {
      const pointErrors = this.validateWeatherDataPoint(point, index);
      errors.push(...pointErrors.errors);
      warnings.push(...pointErrors.warnings);
    });

    // Check for date continuity
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (let i = 1; i < sortedData.length; i++) {
      const currentDate = new Date(sortedData[i].date);
      const previousDate = new Date(sortedData[i - 1].date);
      const diffDays = Math.round((currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays > 1) {
        warnings.push(`Gap of ${diffDays} days between ${sortedData[i - 1].date} and ${sortedData[i].date}`);
      }
    }

    // Check for duplicate dates
    const dates = data.map(d => d.date);
    const uniqueDates = new Set(dates);
    if (dates.length !== uniqueDates.size) {
      warnings.push('Duplicate dates found in weather data');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate individual weather data point
   */
  static validateWeatherDataPoint(point: WeatherDataPoint, index?: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const prefix = index !== undefined ? `Point ${index}: ` : '';

    // Check required fields
    if (!point.date) {
      errors.push(`${prefix}Date is required`);
    } else {
      const dateValidation = this.validateDate(point.date);
      errors.push(...dateValidation.errors.map(e => `${prefix}${e}`));
      warnings.push(...dateValidation.warnings.map(w => `${prefix}${w}`));
    }

    // Validate temperature fields
    if (typeof point.temp_high !== 'number' || isNaN(point.temp_high)) {
      errors.push(`${prefix}High temperature must be a valid number`);
    } else if (point.temp_high < -50 || point.temp_high > 150) {
      warnings.push(`${prefix}High temperature (${point.temp_high}°F) seems extreme`);
    }

    if (typeof point.temp_low !== 'number' || isNaN(point.temp_low)) {
      errors.push(`${prefix}Low temperature must be a valid number`);
    } else if (point.temp_low < -50 || point.temp_low > 150) {
      warnings.push(`${prefix}Low temperature (${point.temp_low}°F) seems extreme`);
    }

    // Check temperature relationship
    if (typeof point.temp_high === 'number' && typeof point.temp_low === 'number' && 
        !isNaN(point.temp_high) && !isNaN(point.temp_low)) {
      if (point.temp_low > point.temp_high) {
        errors.push(`${prefix}Low temperature (${point.temp_low}°F) cannot be higher than high temperature (${point.temp_high}°F)`);
      }
    }

    // Validate GDD
    if (typeof point.gdd !== 'number' || isNaN(point.gdd)) {
      errors.push(`${prefix}GDD must be a valid number`);
    } else if (point.gdd < 0) {
      warnings.push(`${prefix}Negative GDD (${point.gdd}) - check base temperature calculation`);
    } else if (point.gdd > 50) {
      warnings.push(`${prefix}Very high GDD (${point.gdd}) - verify calculation`);
    }

    // Validate rainfall
    if (typeof point.rainfall !== 'number' || isNaN(point.rainfall)) {
      errors.push(`${prefix}Rainfall must be a valid number`);
    } else if (point.rainfall < 0) {
      errors.push(`${prefix}Rainfall cannot be negative`);
    } else if (point.rainfall > 10) {
      warnings.push(`${prefix}Very high rainfall (${point.rainfall}") recorded`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate phenology event
   */
  static validatePhenologyEvent(event: PhenologyEvent): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate event type
    const validEventTypes = ['bud_break', 'bloom', 'veraison', 'harvest'];
    if (!validEventTypes.includes(event.event_type)) {
      errors.push(`Invalid event type: ${event.event_type}`);
    }

    // Validate event date
    if (!event.event_date) {
      errors.push('Event date is required');
    } else {
      const dateValidation = this.validateDate(event.event_date, 'Event date');
      errors.push(...dateValidation.errors);
      warnings.push(...dateValidation.warnings);
    }

    // Validate end date if provided
    if (event.end_date) {
      const endDateValidation = this.validateDate(event.end_date, 'End date');
      errors.push(...endDateValidation.errors);
      warnings.push(...endDateValidation.warnings);

      // Check date order
      if (event.event_date && new Date(event.end_date) <= new Date(event.event_date)) {
        errors.push('End date must be after event date');
      }
    }

    // Validate harvest-specific fields
    if (event.event_type === 'harvest') {
      if (event.end_date) {
        warnings.push('Harvest events typically use single dates rather than date ranges');
      }

      if (event.harvest_block && event.harvest_block.length > 50) {
        warnings.push('Harvest block name is quite long - consider shortening');
      }
    }

    // Validate notes length
    if (event.notes && event.notes.length > 500) {
      warnings.push('Notes are quite long - consider summarizing');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate complete vineyard dataset
   */
  static validateVineyardData(data: {
    coordinates: { latitude: number; longitude: number };
    weatherData: WeatherDataPoint[];
    phenologyEvents: PhenologyEvent[];
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate coordinates
    const coordValidation = this.validateCoordinates(data.coordinates.latitude, data.coordinates.longitude);
    errors.push(...coordValidation.errors);
    warnings.push(...coordValidation.warnings);

    // Validate weather data
    const weatherValidation = this.validateWeatherData(data.weatherData);
    errors.push(...weatherValidation.errors);
    warnings.push(...weatherValidation.warnings);

    // Validate phenology events
    data.phenologyEvents.forEach((event, index) => {
      const eventValidation = this.validatePhenologyEvent(event);
      errors.push(...eventValidation.errors.map(e => `Phenology event ${index + 1}: ${e}`));
      warnings.push(...eventValidation.warnings.map(w => `Phenology event ${index + 1}: ${w}`));
    });

    // Cross-validate phenology events against weather data
    if (data.weatherData.length > 0 && data.phenologyEvents.length > 0) {
      const weatherDates = data.weatherData.map(d => d.date);
      const minWeatherDate = Math.min(...weatherDates.map(d => new Date(d).getTime()));
      const maxWeatherDate = Math.max(...weatherDates.map(d => new Date(d).getTime()));

      data.phenologyEvents.forEach((event, index) => {
        const eventTime = new Date(event.event_date).getTime();
        if (eventTime < minWeatherDate || eventTime > maxWeatherDate) {
          warnings.push(`Phenology event ${index + 1} (${event.event_date}) is outside weather data range`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Utility function to display validation results
export function formatValidationResults(result: ValidationResult): string {
  let message = '';

  if (result.errors.length > 0) {
    message += `❌ Errors:\n${result.errors.map(e => `  • ${e}`).join('\n')}\n\n`;
  }

  if (result.warnings.length > 0) {
    message += `⚠️ Warnings:\n${result.warnings.map(w => `  • ${w}`).join('\n')}\n\n`;
  }

  if (result.isValid && result.warnings.length === 0) {
    message = '✅ All data is valid!';
  }

  return message.trim();
}