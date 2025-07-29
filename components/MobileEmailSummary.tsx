
import React, { useState } from 'react';

interface MobileEmailSummaryProps {
  vineyard: any;
  weatherData: any[];
  phenologyEvents: any[];
  userEmail?: string;
}

export const MobileEmailSummary: React.FC<MobileEmailSummaryProps> = ({
  vineyard,
  weatherData,
  phenologyEvents,
  userEmail
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const generateSummary = () => {
    const recentWeather = weatherData.slice(-7);
    const recentEvents = phenologyEvents.slice(-5);
    
    return {
      vineyard: vineyard?.name || 'Your Vineyard',
      averageTemp: recentWeather.reduce((acc, day) => acc + (day.temp_high + day.temp_low) / 2, 0) / recentWeather.length,
      totalGDD: recentWeather.reduce((acc, day) => acc + day.gdd, 0),
      recentRainfall: recentWeather.reduce((acc, day) => acc + day.rainfall, 0),
      recentEvents: recentEvents.map(event => ({
        type: event.event_type,
        date: event.event_date,
        notes: event.notes
      }))
    };
  };

  const handleSendEmail = async () => {
    setIsLoading(true);
    try {
      const summary = generateSummary();
      
      // This would typically call an API endpoint
      const response = await fetch('/api/send-summary-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          summary: summary
        })
      });

      if (response.ok) {
        setEmailSent(true);
        setTimeout(() => setEmailSent(false), 3000);
      }
    } catch (error) {
      console.error('Failed to send email:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="card mobile-full-width"
      style={{
        position: 'sticky',
        bottom: '16px',
        zIndex: 50,
        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        color: 'white',
        border: 'none',
        boxShadow: '0 8px 24px rgba(34, 197, 94, 0.3)'
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 12px 0', color: 'white' }}>
          📧 Quick Summary Email
        </h4>
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', opacity: 0.9 }}>
          Get current trends sent to your email instantly
        </p>
        
        {emailSent ? (
          <div 
            className="status-success"
            style={{ 
              background: 'rgba(255, 255, 255, 0.2)', 
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}
          >
            ✅ Summary email sent successfully!
          </div>
        ) : (
          <button
            onClick={handleSendEmail}
            disabled={isLoading}
            className="btn-primary"
            style={{
              background: 'white',
              color: '#16a34a',
              border: 'none',
              padding: '16px 24px',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '16px',
              width: '100%',
              minHeight: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isLoading ? (
              <>
                <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
                Sending...
              </>
            ) : (
              <>
                📧 Send Summary Email
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default MobileEmailSummary;
