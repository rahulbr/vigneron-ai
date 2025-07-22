
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
  type: 'harvest_timing' | 'action_required' | 'monitor' | 'opportunity';
  title: string;
  message: string;
  confidence: number;
  timestamp: Date;
  category: 'harvest' | 'quality' | 'timing' | 'risk' | 'preparation';
  urgency: 'high' | 'medium' | 'low';
  daysToAction?: number; // Days until this action should be taken
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
   * Generate harvest-focused AI recommendations
   */
  async generateVineyardRecommendations(context: VineyardContext): Promise<AIInsight[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    try {
      console.log('🤖 Generating harvest-focused AI recommendations for:', context.locationName);

      const prompt = this.buildHarvestFocusedPrompt(context);
      console.log('📝 Generated harvest-focused prompt');

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
              content: `You are an expert vineyard consultant specializing in harvest optimization and practical field operations. 

KEY PRIORITIES:
1. HARVEST TIMING - When to harvest for optimal quality
2. ACTIONABLE STEPS - What specific actions to take and when
3. QUALITY OPTIMIZATION - How to maximize fruit quality
4. RISK MITIGATION - What to monitor and prepare for

RESPONSE STYLE:
- Be concise and specific (max 50 words per insight)
- Focus on harvest implications and timing
- Consider the vineyard's specific location and climate
- Integrate phenology events when provided
- Avoid generic advice - make it location-specific
- Prioritize immediate actions and monitoring needs

LOCATION AWARENESS:
- California coastal regions: low rainfall is normal, focus on heat spikes
- Central Valley: irrigation timing, heat management critical
- Cool climates: ripening concerns, disease pressure
- Warm climates: sugar/acid balance, harvest window timing

Format response as JSON array with this structure:
[
  {
    "type": "harvest_timing|action_required|monitor|opportunity",
    "title": "Brief action-focused title",
    "message": "Specific actionable advice in 30-50 words",
    "confidence": 0.8,
    "category": "harvest|quality|timing|risk|preparation",
    "urgency": "high|medium|low",
    "daysToAction": 7
  }
]

Provide 3-4 focused insights, not generic recommendations.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.5, // Lower temperature for more focused responses
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ OpenAI API error response:', errorText);
        
        if (response.status === 429) {
          let errorMessage = 'OpenAI API rate limit exceeded. ';
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error?.code === 'insufficient_quota') {
              errorMessage = 'OpenAI API quota exceeded. Please check your OpenAI billing and add credits to your account.';
            } else {
              errorMessage = 'OpenAI API rate limit exceeded. Please wait a moment and try again.';
            }
          } catch (e) {
            errorMessage += 'Please check your OpenAI account billing or try again later.';
          }
          throw new Error(errorMessage);
        }
        
        throw new Error(`OpenAI API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;
      console.log('🤖 AI Response:', aiResponse);

      const insights = this.parseAIResponse(aiResponse);
      console.log('✅ Generated', insights.length, 'harvest-focused insights');
      return insights;

    } catch (error) {
      console.error('❌ OpenAI API error:', error);
      throw error;
    }
  }

  /**
   * Get weather pattern analysis focused on harvest implications
   */
  async analyzeWeatherPatterns(context: VineyardContext): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    // Determine regional context for more relevant analysis
    const isCaliforniaCoastal = context.latitude > 34 && context.latitude < 40 && context.longitude < -120;
    const isCentralValley = context.latitude > 35 && context.latitude < 40 && context.longitude > -121 && context.longitude < -119;
    const isWarmClimate = context.avgTempHigh > 85;

    let regionalContext = "";
    if (isCaliforniaCoastal) {
      regionalContext = "California coastal region - low rainfall normal, focus on fog patterns and heat spikes";
    } else if (isCentralValley) {
      regionalContext = "Central Valley - hot, dry climate, irrigation and heat management critical";
    } else if (isWarmClimate) {
      regionalContext = "Warm climate region - sugar/acid balance and harvest timing critical";
    }

    const prompt = `Analyze weather for harvest planning at ${context.locationName}:

LOCATION CONTEXT: ${regionalContext}
Period: ${context.dateRange.start} to ${context.dateRange.end}
GDD: ${context.currentGDD}°F | Rainfall: ${context.totalRainfall}" | Avg High: ${context.avgTempHigh}°F

FOCUS ON:
1. Harvest timing implications - are we on track for optimal harvest window?
2. Quality risks - what weather factors could impact fruit quality?
3. Immediate actions - what should be monitored or adjusted now?

Keep under 150 words. Be specific to this location and climate.`;

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
              content: 'You are a vineyard weather specialist focused on harvest planning and fruit quality optimization. Be concise and location-specific.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.4,
          max_tokens: 200
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
   * Get phenology insights focused on harvest timing
   */
  async analyzePhenologyEvents(context: VineyardContext): Promise<string> {
    if (!context.phenologyEvents || context.phenologyEvents.length === 0) {
      return "Start tracking phenology events (bud break, bloom, veraison) to get AI-powered harvest timing predictions and quality optimization recommendations.";
    }

    // Analyze the progression of events
    const events = context.phenologyEvents.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
    const hasVeraison = events.some(e => e.event_type.includes('veraison'));
    const hasBloom = events.some(e => e.event_type.includes('bloom'));
    const hasHarvest = events.some(e => e.event_type.includes('harvest'));

    let analysisType = "";
    if (hasHarvest) {
      analysisType = "POST-HARVEST: Review this season's timing for next year planning";
    } else if (hasVeraison) {
      analysisType = "PRE-HARVEST: Critical harvest timing and quality optimization phase";
    } else if (hasBloom) {
      analysisType = "MID-SEASON: Track progress toward harvest timing predictions";
    } else {
      analysisType = "EARLY SEASON: Monitor development for harvest planning";
    }

    const eventsText = events.map(event => {
      const gddAtEvent = this.estimateGDDAtDate(context, event.event_date);
      return `${event.event_type.replace(/_/g, ' ')}: ${event.event_date} (${gddAtEvent} GDD)`;
    }).join(' | ');

    const prompt = `Analyze phenology for HARVEST OPTIMIZATION at ${context.locationName}:

DEVELOPMENT STATUS: ${analysisType}
Current GDD: ${context.currentGDD}°F
Events: ${eventsText}

PROVIDE:
1. Harvest timing prediction based on phenology progression
2. Quality optimization actions for current stage
3. Key monitoring points for optimal harvest decision

Keep under 150 words. Focus on actionable harvest guidance.`;

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
              content: 'You are a phenology expert specializing in harvest timing optimization. Focus on practical harvest guidance based on vine development stages.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.4,
          max_tokens: 200
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
   * Build harvest-focused vineyard analysis prompt
   */
  private buildHarvestFocusedPrompt(context: VineyardContext): string {
    // Determine climate zone for context
    const isCaliforniaCoastal = context.latitude > 34 && context.latitude < 40 && context.longitude < -120;
    const isCentralValley = context.latitude > 35 && context.latitude < 40 && context.longitude > -121 && context.longitude < -119;
    const isDesert = context.totalRainfall < 5 && context.avgTempHigh > 90;
    const isCoolClimate = context.avgTempHigh < 75;

    let climateContext = "temperate wine region";
    let rainfallContext = "normal rainfall patterns";
    
    if (isCaliforniaCoastal) {
      climateContext = "California coastal wine region";
      rainfallContext = "naturally low rainfall (drought-adapted)";
    } else if (isCentralValley) {
      climateContext = "California Central Valley";
      rainfallContext = "irrigation-dependent region";
    } else if (isDesert) {
      climateContext = "arid desert wine region";
      rainfallContext = "minimal rainfall expected";
    } else if (isCoolClimate) {
      climateContext = "cool climate wine region";
      rainfallContext = "adequate moisture, disease pressure possible";
    }

    // Analyze phenology progression
    const events = context.phenologyEvents?.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()) || [];
    const hasVeraison = events.some(e => e.event_type.includes('veraison'));
    const hasBloom = events.some(e => e.event_type.includes('bloom'));
    const hasHarvest = events.some(e => e.event_type.includes('harvest'));

    let seasonStage = "early season development";
    let harvestFocus = "monitor early season development";
    
    if (hasHarvest) {
      seasonStage = "post-harvest";
      harvestFocus = "review season performance, plan for next year";
    } else if (hasVeraison) {
      seasonStage = "pre-harvest critical period";
      harvestFocus = "optimize harvest timing and fruit quality";
    } else if (hasBloom) {
      seasonStage = "mid-season development";
      harvestFocus = "track development toward harvest predictions";
    }

    const phenologyText = events.length > 0 
      ? events.map(e => `${e.event_type.replace(/_/g, ' ')}: ${e.event_date}`).join(', ')
      : 'No phenology events recorded';

    return `HARVEST OPTIMIZATION ANALYSIS for ${context.locationName}

VINEYARD PROFILE:
Location: ${climateContext} (${context.latitude}°N, ${context.longitude}°W)
Season Stage: ${seasonStage}
GDD Accumulation: ${context.currentGDD}°F (${context.dataPoints} days)
Rainfall: ${context.totalRainfall}" (${rainfallContext})
Temperature Pattern: ${context.avgTempHigh}°F high / ${context.avgTempLow}°F low

PHENOLOGY TRACKING:
${phenologyText}

HARVEST FOCUS: ${harvestFocus}

PROVIDE 3-4 SPECIFIC HARVEST-FOCUSED INSIGHTS:
1. Harvest timing guidance based on current GDD and phenology
2. Quality optimization actions for current season stage  
3. Risk monitoring priorities for optimal harvest
4. Preparation steps for harvest operations

Each insight must be:
- Specific to this vineyard's location and climate
- Actionable within the next 1-4 weeks
- Focused on harvest quality and timing
- Based on the actual phenology events recorded

Respond with JSON array only. No explanatory text.`;
  }

  /**
   * Parse AI response into structured insights with harvest focus
   */
  private parseAIResponse(response: string): AIInsight[] {
    try {
      let cleanResponse = response.trim();

      if (cleanResponse.includes('```json')) {
        cleanResponse = cleanResponse.split('```json')[1].split('```')[0].trim();
      } else if (cleanResponse.includes('```')) {
        cleanResponse = cleanResponse.split('```')[1].trim();
      }

      cleanResponse = cleanResponse.replace(/^\s*\n|\n\s*$/g, '');
      console.log('🧹 Cleaned AI response for parsing:', cleanResponse);

      const parsed = JSON.parse(cleanResponse);
      const insights: AIInsight[] = [];
      const insightArray = Array.isArray(parsed) ? parsed : [parsed];

      insightArray.forEach((item: any, index: number) => {
        if (item.title && item.message) {
          insights.push({
            id: `ai-insight-${Date.now()}-${index}`,
            type: item.type || 'monitor',
            title: item.title,
            message: item.message,
            confidence: typeof item.confidence === 'number' ? item.confidence : 0.8,
            timestamp: new Date(),
            category: item.category || 'harvest',
            urgency: item.urgency || 'medium',
            daysToAction: item.daysToAction || undefined
          });
        }
      });

      return insights;

    } catch (error) {
      console.error('❌ Error parsing AI response:', error);
      
      // Enhanced fallback with harvest focus
      const fallbackInsight: AIInsight = {
        id: `ai-insight-fallback-${Date.now()}`,
        type: 'monitor',
        title: 'AI Analysis Available',
        message: response.length > 200 ? response.substring(0, 200) + '...' : response,
        confidence: 0.6,
        timestamp: new Date(),
        category: 'harvest',
        urgency: 'medium'
      };

      return [fallbackInsight];
    }
  }

  /**
   * Estimate GDD accumulation at a specific date
   */
  private estimateGDDAtDate(context: VineyardContext, date: string): number {
    const startDate = new Date(context.dateRange.start);
    const targetDate = new Date(date);
    const endDate = new Date(context.dateRange.end);
    
    if (targetDate <= endDate && targetDate >= startDate) {
      // Estimate based on linear progression (simple approximation)
      const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      const daysSinceStart = (targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      return Math.round((context.currentGDD * daysSinceStart) / totalDays);
    }
    
    return context.currentGDD; // If date is outside range, return current total
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
}

export const openaiService = OpenAIService.getInstance();
