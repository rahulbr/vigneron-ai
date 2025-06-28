// lib/openaiService.ts - Enhanced OpenAI/ChatGPT integration service

export interface VineyardContext {
  locationName: string;
  latitude: number;
  longitude: number;
  currentGDD: number;
  totalRainfall: number;
  avgTempHigh: number;
  avgTempLow: number;
  dataPoints: number;
  dateRange: {
    start: string;
    end: string;
  };
  phenologyEvents: Array<{
    event_type: string;
    event_date: string;
    notes?: string;
  }>;
}

export interface AIInsight {
  id: string;
  type: 'recommendation' | 'warning' | 'insight' | 'action';
  title: string;
  message: string;
  confidence: number;
  timestamp: Date;
  category: 'viticulture' | 'weather' | 'phenology' | 'harvest' | 'disease';
}

export class OpenAIService {
  private static instance: OpenAIService;
  private apiKey: string;
  private baseURL = 'https://api.openai.com/v1/chat/completions';

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ OpenAI API key not found in environment variables');
    }
  }

  static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }


  /**
   * Generate AI recommendations based on vineyard data
   */
  async generateVineyardRecommendations(context: VineyardContext): Promise<AIInsight[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    try {
      console.log('🤖 Generating AI recommendations for:', context.locationName);
      console.log('📊 Context data:', {
        gdd: context.currentGDD,
        rainfall: context.totalRainfall,
        phenologyEvents: context.phenologyEvents?.length || 0
      });

      const prompt = this.buildVineyardPrompt(context);
      console.log('📝 Generated prompt:', prompt);

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are an expert viticulturist and enologist with 30+ years of experience in vineyard management worldwide. 
              You specialize in climate analysis, phenology tracking, and data-driven vineyard recommendations.

              IMPORTANT: Pay special attention to any phenology events provided. These are critical timing markers for vineyard operations.

              Always provide:
              1. Actionable, specific recommendations
              2. Scientific reasoning for your advice
              3. Risk assessments and confidence levels
              4. Timing considerations for vineyard operations
              5. Specific references to phenology events when they are provided

              Format your response as a JSON array of insights with this structure:
              [
                {
                  "type": "recommendation|warning|insight|action",
                  "title": "Brief descriptive title",
                  "message": "Detailed explanation with specific actionable advice",
                  "confidence": 0.8,
                  "category": "viticulture|weather|phenology|harvest|disease"
                }
              ]

              Ensure the response is valid JSON and contains 3-5 insights.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ OpenAI API error response:', errorText);
        throw new Error(`OpenAI API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from OpenAI API');
      }

      const aiResponse = data.choices[0].message.content;
      console.log('🤖 AI Response:', aiResponse);

      // Parse the JSON response
      const insights = this.parseAIResponse(aiResponse);

      console.log('✅ Generated', insights.length, 'AI insights');
      return insights;

    } catch (error) {
      console.error('❌ OpenAI API error:', error);
      throw error;
    }
  }

  /**
   * Get weather pattern analysis
   */
  async analyzeWeatherPatterns(context: VineyardContext): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const prompt = `Analyze the weather patterns for ${context.locationName}:

Location: ${context.locationName} (${context.latitude}, ${context.longitude})
Period: ${context.dateRange.start} to ${context.dateRange.end}
Total GDD: ${context.currentGDD}°F
Total Rainfall: ${context.totalRainfall}"
Avg High: ${context.avgTempHigh}°F
Avg Low: ${context.avgTempLow}°F

Provide a concise analysis of:
1. How this weather compares to typical patterns for this region
2. Implications for vine development and fruit quality
3. Any notable weather events or patterns
4. Recommendations for vineyard management

Keep response under 300 words and focus on actionable insights.`;

    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert viticulturist specializing in weather pattern analysis for wine production.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.6,
          max_tokens: 400
        })
      });

      const data = await response.json();
      return data.choices[0].message.content;

    } catch (error) {
      console.error('❌ Weather analysis error:', error);
      throw error;
    }
  }

  /**
   * Get phenology insights
   */
  async analyzePhenologyEvents(context: VineyardContext): Promise<string> {
    if (!context.phenologyEvents || context.phenologyEvents.length === 0) {
      return "No phenology events recorded yet. Start tracking bud break, bloom, veraison, and harvest dates to get AI insights about your vine development timing.";
    }

    const eventsText = context.phenologyEvents
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      .map(event => 
        `${event.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${event.event_date}${event.notes ? ` (${event.notes})` : ''}`
      ).join('\n');

    const prompt = `Analyze the phenology events for ${context.locationName}:

Location: ${context.locationName}
GDD Accumulation: ${context.currentGDD}°F
Period: ${context.dateRange.start} to ${context.dateRange.end}

Recorded Phenology Events:
${eventsText}

Provide insights on:
1. Timing of phenological stages relative to GDD accumulation
2. How the timing compares to typical patterns for this region
3. Implications for harvest timing and fruit quality
4. Recommendations for upcoming vineyard operations
5. Any timing concerns or advantages based on the recorded events

Keep response under 300 words and focus on actionable insights.`;

    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert viticulturist specializing in phenology and vine development timing. Focus on practical implications of phenological timing for vineyard management.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.6,
          max_tokens: 400
        })
      });

      const data = await response.json();
      return data.choices[0].message.content;

    } catch (error) {
      console.error('❌ Phenology analysis error:', error);
      throw error;
    }
  }

  /**
   * Build comprehensive vineyard analysis prompt
   */
  private buildVineyardPrompt(context: VineyardContext): string {
    // Enhanced phenology events formatting
    const eventsText = context.phenologyEvents && context.phenologyEvents.length > 0
      ? context.phenologyEvents
          .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
          .map(event => {
            const formattedType = event.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const formattedDate = new Date(event.event_date).toLocaleDateString();
            return `  • ${formattedType}: ${formattedDate}${event.notes ? ` (${event.notes})` : ''}`;
          }).join('\n')
      : '  • No phenology events recorded yet';

    const hasEvents = context.phenologyEvents && context.phenologyEvents.length > 0;

    return `Analyze this vineyard data and provide actionable recommendations:

VINEYARD OVERVIEW:
• Name: ${context.locationName}
• Location: ${context.latitude}°N, ${context.longitude}°W
• Analysis Period: ${context.dateRange.start} to ${context.dateRange.end} (${context.dataPoints} days)

WEATHER SUMMARY:
• Growing Degree Days: ${context.currentGDD}°F
• Total Rainfall: ${context.totalRainfall}"
• Average High Temperature: ${context.avgTempHigh}°F
• Average Low Temperature: ${context.avgTempLow}°F

PHENOLOGY TRACKING:
${eventsText}

${hasEvents ? 
`CRITICAL: The vineyard has recorded ${context.phenologyEvents.length} phenology events. Please analyze these carefully and provide specific recommendations based on the timing and progression of these events.` : 
'NOTE: No phenology events have been recorded yet. Please provide recommendations for starting phenology tracking.'}

Please provide 3-5 specific, actionable recommendations as a JSON array. Consider:
1. Current weather patterns and GDD accumulation rate
2. ${hasEvents ? 'Recorded phenology events and their timing implications' : 'Need to establish phenology tracking'}
3. Water management based on rainfall patterns
4. Disease pressure risks from weather conditions
5. Optimal timing for upcoming vineyard operations
6. Harvest timing predictions if applicable

Each recommendation should be specific, actionable, and include your confidence level (0.0-1.0).

Respond ONLY with valid JSON in this exact format:
[
  {
    "type": "recommendation",
    "title": "Brief title",
    "message": "Detailed actionable advice",
    "confidence": 0.8,
    "category": "phenology"
  }
]`;
  }

  /**
   * Parse AI response into structured insights
   */
  private parseAIResponse(response: string): AIInsight[] {
    try {
      // Clean up the response (remove any markdown formatting)
      let cleanResponse = response.trim();

      // Remove code block markers
      if (cleanResponse.includes('```json')) {
        cleanResponse = cleanResponse.split('```json')[1].split('```')[0].trim();
      } else if (cleanResponse.includes('```')) {
        cleanResponse = cleanResponse.split('```')[1].trim();
      }

      // Remove any leading/trailing whitespace or newlines
      cleanResponse = cleanResponse.replace(/^\s*\n|\n\s*$/g, '');

      console.log('🧹 Cleaned AI response for parsing:', cleanResponse);

      const parsed = JSON.parse(cleanResponse);
      const insights: AIInsight[] = [];

      const insightArray = Array.isArray(parsed) ? parsed : [parsed];

      insightArray.forEach((item: any, index: number) => {
        if (item.title && item.message) {
          insights.push({
            id: `ai-insight-${Date.now()}-${index}`,
            type: item.type || 'insight',
            title: item.title,
            message: item.message,
            confidence: typeof item.confidence === 'number' ? item.confidence : 0.8,
            timestamp: new Date(),
            category: item.category || 'viticulture'
          });
        }
      });

      return insights;

    } catch (error) {
      console.error('❌ Error parsing AI response:', error);
      console.log('🔍 Raw response that failed to parse:', response);

      // Enhanced fallback: try to extract useful information
      const fallbackInsight: AIInsight = {
        id: `ai-insight-fallback-${Date.now()}`,
        type: 'insight',
        title: 'AI Analysis (Parsing Error)',
        message: response.length > 500 ? response.substring(0, 500) + '...' : response,
        confidence: 0.7,
        timestamp: new Date(),
        category: 'viticulture'
      };

      return [fallbackInsight];
    }
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      console.warn('⚠️ Cannot test connection: API key not configured');
      return false;
    }

    try {
      console.log('🔄 Testing OpenAI connection...');

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: 'Hello, can you confirm you are working?'
            }
          ],
          max_tokens: 10
        })
      });

      const success = response.ok;
      console.log(success ? '✅ OpenAI connection successful' : '❌ OpenAI connection failed');

      return success;
    } catch (error) {
      console.error('❌ OpenAI connection test failed:', error);
      return false;
    }
  }

  /**
   * Debug method to validate context data
   */
  debugContext(context: VineyardContext): void {
    console.log('🔍 Debugging VineyardContext:');
    console.log('  Location:', context.locationName);
    console.log('  Coordinates:', context.latitude, context.longitude);
    console.log('  GDD:', context.currentGDD);
    console.log('  Rainfall:', context.totalRainfall);
    console.log('  Phenology Events:', context.phenologyEvents?.length || 0);

    if (context.phenologyEvents && context.phenologyEvents.length > 0) {
      console.log('  Events detail:');
      context.phenologyEvents.forEach((event, i) => {
        console.log(`    ${i + 1}. ${event.event_type} on ${event.event_date}`);
      });
    } else {
      console.log('  ⚠️ No phenology events found in context');
    }
  }
}

export const openaiService = OpenAIService.getInstance();