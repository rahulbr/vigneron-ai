// lib/googleGeocodingService.ts - Google Maps Geocoding API service

export interface GeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  country: string;
  state?: string;
  city?: string;
  placeId: string;
}

export class GoogleGeocodingService {
  private static instance: GoogleGeocodingService;
  private apiKey: string;
  private baseURL = 'https://maps.googleapis.com/maps/api/geocode/json';

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ Google Maps API key not found in environment variables');
    }
  }

  static getInstance(): GoogleGeocodingService {
    if (!GoogleGeocodingService.instance) {
      GoogleGeocodingService.instance = new GoogleGeocodingService();
    }
    return GoogleGeocodingService.instance;
  }

  /**
   * Geocode a location string to coordinates using Google Maps API
   */
  async geocodeLocation(location: string): Promise<GeocodeResult[]> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key is not configured');
    }

    if (!location || location.trim().length < 2) {
      throw new Error('Location must be at least 2 characters long');
    }

    try {
      console.log('🌍 Geocoding with Google Maps API:', location);

      const params = new URLSearchParams({
        address: location.trim(),
        key: this.apiKey,
        // Optional: restrict to specific countries if needed
        // components: 'country:US|country:CA|country:FR|country:IT|country:ES|country:DE|country:AU|country:NZ|country:CL|country:AR|country:ZA'
      });

      const url = `${this.baseURL}?${params.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Google Maps API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        if (data.status === 'ZERO_RESULTS') {
          throw new Error('No locations found for that search');
        } else if (data.status === 'REQUEST_DENIED') {
          throw new Error('API request denied - check your API key and permissions');
        } else if (data.status === 'OVER_QUERY_LIMIT') {
          throw new Error('API quota exceeded - please try again later');
        } else {
          throw new Error(`Geocoding failed: ${data.status} - ${data.error_message || 'Unknown error'}`);
        }
      }

      if (!data.results || data.results.length === 0) {
        throw new Error('No locations found for that search');
      }

      const results: GeocodeResult[] = data.results.map((result: any) => ({
        name: this.formatLocationName(result),
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
        country: this.extractAddressComponent(result, 'country'),
        state: this.extractAddressComponent(result, 'administrative_area_level_1'),
        city: this.extractAddressComponent(result, 'locality') || 
              this.extractAddressComponent(result, 'administrative_area_level_2'),
        placeId: result.place_id
      }));

      console.log('✅ Google Maps geocoding results:', results.length);
      return results;

    } catch (error) {
      console.error('❌ Google Maps geocoding error:', error);
      throw error;
    }
  }

  /**
   * Get La Honda, CA coordinates as fallback
   */
  getLaHondaFallback(): GeocodeResult {
    return {
      name: 'La Honda, CA (Fallback)',
      latitude: 37.3272,
      longitude: -122.2813,
      formattedAddress: 'La Honda, CA 94020, USA',
      country: 'United States',
      state: 'California',
      city: 'La Honda',
      placeId: 'fallback-la-honda'
    };
  }

  /**
   * Format location name for display
   */
  private formatLocationName(result: any): string {
    // Try to get a meaningful name from the result
    const addressComponents = result.address_components || [];

    // Look for locality, administrative areas, or use formatted address
    const locality = this.extractAddressComponent(result, 'locality');
    const adminArea1 = this.extractAddressComponent(result, 'administrative_area_level_1');
    const adminArea2 = this.extractAddressComponent(result, 'administrative_area_level_2');
    const country = this.extractAddressComponent(result, 'country');

    const parts = [];

    if (locality) {
      parts.push(locality);
    } else if (adminArea2) {
      parts.push(adminArea2);
    }

    if (adminArea1) {
      parts.push(adminArea1);
    }

    if (country && country !== 'United States') {
      parts.push(country);
    }

    return parts.length > 0 ? parts.join(', ') : result.formatted_address;
  }

  /**
   * Extract specific component from Google Maps result
   */
  private extractAddressComponent(result: any, componentType: string): string {
    const components = result.address_components || [];
    const component = components.find((comp: any) => comp.types.includes(componentType));
    return component?.long_name || '';
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test with a simple, well-known location
      await this.geocodeLocation('San Francisco, CA');
      return true;
    } catch (error) {
      console.error('Google Maps API connection test failed:', error);
      return false;
    }
  }
}

export const googleGeocodingService = GoogleGeocodingService.getInstance();