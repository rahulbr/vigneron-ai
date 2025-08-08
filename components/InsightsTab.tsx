import React, { useState, useEffect } from 'react';
import { Brain, RefreshCw, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import { EnhancedGDDChart } from './EnhancedGDDChart';
import { openaiService, VineyardContext, AIInsight } from '../lib/openaiService';
import { MobileRefresh } from './MobileRefresh';

interface InsightsTabProps {
  data: any[];
  loading: boolean;
  vineyardId: string;
  currentVineyard: any;
  customLocation: string;
  activities: any[];
  onActivitiesChange: () => void;
  dateRange: { start: string; end: string };
  fetchData: () => void; // Added for pull-to-refresh
}

export function InsightsTab({
  data,
  loading,
  vineyardId,
  currentVineyard,
  customLocation,
  activities,
  onActivitiesChange,
  dateRange,
  fetchData // Added for pull-to-refresh
}: InsightsTabProps) {
  // AI-related state
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [weatherAnalysis, setWeatherAnalysis] = useState<string>('');
  const [phenologyAnalysis, setPhenologyAnalysis] = useState<string>('');
  const [showAIPanel, setShowAIPanel] = useState(false);

  // Generate AI insights based on current vineyard data
  const generateAIInsights = async () => {
    if (!data || data.length === 0) {
      alert('⚠️ No weather data available. Please ensure weather data is loaded before generating AI insights.');
      return;
    }

    // Check if OpenAI API key is available
    const hasApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY && process.env.NEXT_PUBLIC_OPENAI_API_KEY.length > 0;
    if (!hasApiKey) {
      alert('❌ OpenAI API Key Missing\n\nTo use AI insights, you need to:\n1. Get an OpenAI API key from https://platform.openai.com/api-keys\n2. Add it to your environment variables as NEXT_PUBLIC_OPENAI_API_KEY\n3. Restart your application');
      return;
    }

    setIsGeneratingInsights(true);
    try {
      console.log('🤖 Generating AI insights...');

      // Get phenology events from database
      let phenologyEvents = [];
      try {
        if (vineyardId) {
          console.log('🔍 Loading phenology events from database for AI analysis:', vineyardId);
          const { getPhenologyEvents } = await import('../lib/supabase');
          const dbEvents = await getPhenologyEvents(vineyardId);
          phenologyEvents = dbEvents || [];
          console.log('📅 Loaded phenology events for AI:', phenologyEvents.length);
        }
      } catch (error) {
        console.warn('Error loading phenology events for AI:', error);
        phenologyEvents = [];
      }

      // Calculate summary statistics
      const totalGDD = data.reduce((sum, day) => sum + day.gdd, 0);
      const totalRainfall = data.reduce((sum, day) => sum + day.rainfall, 0);
      const avgTempHigh = data.length > 0 ? data.reduce((sum, day) => sum + day.temp_high, 0) / data.length : 0;
      const avgTempLow = data.length > 0 ? data.reduce((sum, day) => sum + day.temp_low, 0) / data.length : 0;

      const context: VineyardContext = {
        locationName: customLocation,
        latitude: currentVineyard?.latitude || 0,
        longitude: currentVineyard?.longitude || 0,
        currentGDD: totalGDD,
        totalRainfall,
        avgTempHigh,
        avgTempLow,
        dataPoints: data.length,
        dateRange,
        phenologyEvents: phenologyEvents.map((event: any) => ({
          event_type: event.event_type,
          event_date: event.event_date,
          notes: event.notes
        }))
      };

      console.log('🔍 AI Context:', {
        location: context.locationName,
        gdd: context.currentGDD,
        rainfall: context.totalRainfall,
        phenologyEventsCount: context.phenologyEvents.length
      });

      // Generate recommendations
      const insights = await openaiService.generateVineyardRecommendations(context);
      setAiInsights(insights);

      // Generate weather analysis
      const weatherAnalysisText = await openaiService.analyzeWeatherPatterns(context);
      setWeatherAnalysis(weatherAnalysisText);

      // Generate phenology analysis
      const phenologyAnalysisText = await openaiService.analyzePhenologyEvents(context);
      setPhenologyAnalysis(phenologyAnalysisText);

      setShowAIPanel(true);
      console.log('✅ AI insights generated successfully');

    } catch (error) {
      console.error('❌ Failed to generate AI insights:', error);

      // Show more user-friendly error message
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('quota exceeded')) {
        alert('❌ OpenAI API Quota Exceeded\n\nYour OpenAI account has exceeded its usage quota. Please:\n1. Check your OpenAI billing dashboard\n2. Add credits to your account\n3. Try again after adding credits\n\nVisit: https://platform.openai.com/account/billing');
      } else if (errorMessage.includes('rate limit')) {
        alert('❌ OpenAI API Rate Limit\n\nToo many requests to OpenAI API. Please wait a moment and try again.');
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        alert('❌ Network Error\n\nPlease check your internet connection and try again.');
      } else {
        alert('❌ Failed to generate AI insights\n\nPlease try again in a moment. If the problem persists, contact support.');
      }
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  // Get icon for insight type
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'harvest_timing': return <span style={{ fontSize: '16px' }}>🍇</span>;
      case 'action_required': return <AlertTriangle size={16} style={{ color: '#dc2626' }} />;
      case 'monitor': return <span style={{ fontSize: '16px' }}>👁️</span>;
      case 'opportunity': return <span style={{ fontSize: '16px' }}>⭐</span>;
      default: return <Info size={16} style={{ color: '#6b7280' }} />;
    }
  };

  // Get color for insight type
  const getInsightColor = (type: string) => {
    switch (type) {
      case 'harvest_timing': return { bg: '#fef3c7', border: '#fbbf24', text: '#92400e' };
      case 'action_required': return { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' };
      case 'monitor': return { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' };
      case 'opportunity': return { bg: '#f0fdf4', border: '#bbf7d0', text: '#065f46' };
      default: return { bg: '#f8fafc', border: '#e2e8f0', text: '#374151' };
    }
  };

  // Get urgency styling
  const getUrgencyStyle = (urgency: string) => {
    switch (urgency) {
      case 'high': return {
        badge: { backgroundColor: '#dc2626', color: 'white' },
        border: '2px solid #dc2626'
      };
      case 'medium': return {
        badge: { backgroundColor: '#f59e0b', color: 'white' },
        border: '1px solid #f59e0b'
      };
      case 'low': return {
        badge: { backgroundColor: '#6b7280', color: 'white' },
        border: '1px solid #e5e7eb'
      };
      default: return {
        badge: { backgroundColor: '#6b7280', color: 'white' },
        border: '1px solid #e5e7eb'
      };
    }
  };

  const handleRefresh = () => {
    fetchData(); // Call the passed fetchData function
    // Optionally, you could also re-trigger AI insights if needed after data refresh
    // generateAIInsights();
  };

  return (
    <div style={{ padding: '1rem', minHeight: '200px' }}>
      {loading && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '2px dashed #cbd5e1',
          marginBottom: '20px'
        }}>
          <RefreshCw size={32} style={{ color: '#64748b', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#475569' }}>Loading Analytics</h3>
          <p style={{ margin: '0', color: '#64748b' }}>
            Generating insights for {customLocation}...
          </p>
        </div>
      )}

      <MobileRefresh onRefresh={handleRefresh}>
        <>
          {/* Enhanced GDD Chart */}
          {data.length > 0 && !loading && vineyardId && (
            <div style={{ marginBottom: '20px' }}>
              <EnhancedGDDChart
                weatherData={data}
                locationName={customLocation}
                vineyardId={vineyardId}
                onEventsChange={onActivitiesChange}
              />
            </div>
          )}

          {/* Generate AI Insights Button */}
          {data.length > 0 && !isGeneratingInsights && (
            <div style={{
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              <button
                onClick={generateAIInsights}
                disabled={!process.env.NEXT_PUBLIC_OPENAI_API_KEY}
                style={{
                  padding: '12px 24px',
                  backgroundColor: !process.env.NEXT_PUBLIC_OPENAI_API_KEY ? '#9ca3af' : '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: !process.env.NEXT_PUBLIC_OPENAI_API_KEY ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '0 auto'
                }}
              >
                <Brain size={20} />
                {!process.env.NEXT_PUBLIC_OPENAI_API_KEY ? 'AI Insights (API Key Required)' : 'Generate AI Insights'}
              </button>
              {!process.env.NEXT_PUBLIC_OPENAI_API_KEY && (
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                  Add NEXT_PUBLIC_OPENAI_API_KEY to enable AI features
                </p>
              )}
            </div>
          )}

          {/* AI Insights Panel */}
          {showAIPanel && (
            <div style={{
              marginBottom: '20px',
              padding: '20px',
              backgroundColor: '#fefce8',
              borderRadius: '12px',
              border: '1px solid #fde68a'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: '0', fontSize: '18px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Brain size={20} />
                  AI Vineyard Insights
                </h3>
                {isGeneratingInsights ? (
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', color: '#92400e' }} />
                ) : (
                  <button
                    onClick={generateAIInsights}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#eab308',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <RefreshCw size={12} />
                    Refresh
                  </button>
                )}
              </div>

              {isGeneratingInsights ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{ marginBottom: '10px' }}>🤖 AI is analyzing your vineyard data...</div>
                  <div style={{ fontSize: '14px', color: '#92400e' }}>
                    This may take a few seconds
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* AI Recommendations */}
                  {aiInsights.length > 0 && (
                    <div>
                      <h4 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🍇 Recommendations
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {aiInsights
                          .sort((a, b) => {
                            const urgencyOrder = { high: 3, medium: 2, low: 1 };
                            const typeOrder = { harvest_timing: 4, action_required: 3, opportunity: 2, monitor: 1 };

                            const urgencyDiff = (urgencyOrder[b.urgency as keyof typeof urgencyOrder] || 1) -
                                              (urgencyOrder[a.urgency as keyof typeof urgencyOrder] || 1);
                            if (urgencyDiff !== 0) return urgencyDiff;

                            return (typeOrder[b.type as keyof typeof typeOrder] || 1) -
                                   (typeOrder[a.type as keyof typeof typeOrder] || 1);
                          })
                          .map((insight) => {
                            const colors = getInsightColor(insight.type);
                            const urgencyStyle = getUrgencyStyle(insight.urgency);

                            return (
                              <div
                                key={insight.id}
                                style={{
                                  padding: '16px',
                                  backgroundColor: colors.bg,
                                  border: urgencyStyle.border,
                                  borderRadius: '8px',
                                  position: 'relative'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                  <div style={{ marginTop: '2px' }}>
                                    {getInsightIcon(insight.type)}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                      <div style={{ fontWeight: '600', fontSize: '15px', color: colors.text }}>
                                        {insight.title}
                                      </div>
                                      <div style={{
                                        ...urgencyStyle.badge,
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        textTransform: 'uppercase'
                                      }}>
                                        {insight.urgency}
                                      </div>
                                      {insight.daysToAction && (
                                        <div style={{
                                          padding: '2px 8px',
                                          backgroundColor: '#f3f4f6',
                                          borderRadius: '12px',
                                          fontSize: '11px',
                                          color: '#374151',
                                          fontWeight: '500'
                                        }}>
                                          {insight.daysToAction} days
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '14px', color: colors.text, lineHeight: '1.4', marginBottom: '6px' }}>
                                      {insight.message}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span>📊 {(insight.confidence * 100).toFixed(0)}% confidence</span>
                                      <span>•</span>
                                      <span style={{ textTransform: 'capitalize' }}>{insight.category}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Additional Analysis Sections */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
                    {/* Weather Analysis */}
                    {weatherAnalysis && (
                      <div>
                        <h4 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          🌤️ Weather Impact
                        </h4>
                        <div style={{
                          padding: '14px',
                          backgroundColor: '#f0f9ff',
                          border: '1px solid #bae6fd',
                          borderRadius: '8px',
                          fontSize: '14px',
                          lineHeight: '1.5',
                          color: '#0c4a6e'
                        }}>
                          {weatherAnalysis}
                        </div>
                      </div>
                    )}

                    {/* Phenology Analysis */}
                    {phenologyAnalysis && (
                      <div>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          📈 Development & Timing
                        </h4>
                        <div style={{
                          padding: '14px',
                          backgroundColor: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          borderRadius: '8px',
                          fontSize: '14px',
                          lineHeight: '1.5',
                          color: '#065f46'
                        }}>
                          {phenologyAnalysis}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No data state */}
          {(!data || data.length === 0) && !loading && (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '2px dashed #cbd5e1'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>📈</div>
              <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>No Weather Data Available</h4>
              <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>
                Load weather data to view the growth curve and generate AI insights.
              </p>
            </div>
          )}
        </>
      </MobileRefresh>
    </div>
  );
}