
import React, { useState, useEffect } from 'react';
import { X, Send, MessageSquare, Mail, Printer, Clock, MapPin, AlertTriangle } from 'lucide-react';

interface SprayNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sprayEvent: {
    id: string;
    event_date: string;
    spray_product: string;
    spray_quantity?: string;
    spray_unit?: string;
    spray_target?: string;
    location_name?: string;
    harvest_block?: string;
    notes?: string;
  };
  vineyard: {
    name: string;
    location?: string;
  };
  sprayDatabase: any;
}

export const SprayNotificationModal: React.FC<SprayNotificationModalProps> = ({
  isOpen,
  onClose,
  sprayEvent,
  vineyard,
  sprayDatabase
}) => {
  const [notification, setNotification] = useState({
    method: 'sms', // sms, email, print
    recipients: '',
    customMessage: '',
    includeReentryTime: true,
    includeLocation: true,
    includeProduct: true,
    urgencyLevel: 'high'
  });

  const [reentryInfo, setReentryInfo] = useState<{
    hours: number;
    safeEntryTime: string;
    riskLevel: string;
  } | null>(null);

  useEffect(() => {
    if (sprayEvent.spray_product && sprayDatabase[sprayEvent.spray_product]) {
      const productInfo = sprayDatabase[sprayEvent.spray_product];
      const sprayTime = new Date(`${sprayEvent.event_date}T${new Date().toTimeString().split(' ')[0]}`);
      const safeEntryTime = new Date(sprayTime.getTime() + (productInfo.reentryHours * 60 * 60 * 1000));
      
      setReentryInfo({
        hours: productInfo.reentryHours,
        safeEntryTime: safeEntryTime.toLocaleString(),
        riskLevel: productInfo.reentryHours >= 48 ? 'high' : productInfo.reentryHours >= 24 ? 'medium' : 'low'
      });
    }
  }, [sprayEvent, sprayDatabase]);

  if (!isOpen) return null;

  const generateNotificationMessage = () => {
    let message = `🚨 SPRAY APPLICATION ALERT 🚨\n\n`;
    
    if (notification.urgencyLevel === 'high') {
      message += `⚠️ IMMEDIATE ATTENTION REQUIRED ⚠️\n\n`;
    }

    message += `Vineyard: ${vineyard.name}\n`;
    
    if (notification.includeLocation && (sprayEvent.location_name || sprayEvent.harvest_block)) {
      message += `Location: ${sprayEvent.location_name || 'Main vineyard'}`;
      if (sprayEvent.harvest_block) {
        message += ` - Block ${sprayEvent.harvest_block}`;
      }
      message += `\n`;
    }

    message += `Application Date: ${new Date(sprayEvent.event_date).toLocaleDateString()}\n`;

    if (notification.includeProduct) {
      message += `Product Applied: ${sprayEvent.spray_product}\n`;
      if (sprayEvent.spray_quantity && sprayEvent.spray_unit) {
        message += `Rate: ${sprayEvent.spray_quantity} ${sprayEvent.spray_unit}\n`;
      }
      if (sprayEvent.spray_target) {
        message += `Target: ${sprayEvent.spray_target}\n`;
      }
    }

    if (notification.includeReentryTime && reentryInfo) {
      message += `\n🚫 RE-ENTRY RESTRICTION ACTIVE 🚫\n`;
      message += `Restriction Period: ${reentryInfo.hours} hours\n`;
      message += `Safe to Enter After: ${reentryInfo.safeEntryTime}\n`;
      
      if (reentryInfo.riskLevel === 'high') {
        message += `⚠️ HIGH RISK - AVOID AREA COMPLETELY\n`;
      } else if (reentryInfo.riskLevel === 'medium') {
        message += `⚠️ MEDIUM RISK - USE CAUTION\n`;
      }
    }

    if (sprayEvent.notes) {
      message += `\nAdditional Notes: ${sprayEvent.notes}\n`;
    }

    if (notification.customMessage) {
      message += `\nManager Notes: ${notification.customMessage}\n`;
    }

    message += `\n🛡️ FOR YOUR SAFETY: Do not enter the treated area until the re-entry period has expired.\n`;
    message += `\nQuestions? Contact farm management immediately.\n`;
    message += `Sent: ${new Date().toLocaleString()}`;

    return message;
  };

  const sendNotification = () => {
    const message = generateNotificationMessage();
    
    if (notification.method === 'sms') {
      // In a real implementation, this would integrate with an SMS service
      const smsUrl = `sms:${notification.recipients}?body=${encodeURIComponent(message)}`;
      window.open(smsUrl);
    } else if (notification.method === 'email') {
      const subject = `SPRAY ALERT: Re-entry Restriction - ${vineyard.name}`;
      const emailUrl = `mailto:${notification.recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      window.open(emailUrl);
    } else if (notification.method === 'print') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Spray Application Notice</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
                .header { background: #ef4444; color: white; padding: 15px; text-align: center; font-weight: bold; }
                .warning { background: #fef2f2; border: 2px solid #ef4444; padding: 15px; margin: 15px 0; }
                .info { background: #f0f9ff; border: 1px solid #0ea5e9; padding: 10px; margin: 10px 0; }
                pre { white-space: pre-wrap; font-family: Arial, sans-serif; }
              </style>
            </head>
            <body>
              <div class="header">SPRAY APPLICATION SAFETY NOTICE</div>
              <div class="warning">
                <pre>${message}</pre>
              </div>
              <div class="info">
                <strong>Post this notice at all entry points to the treated area.</strong>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }

    alert(`Notification sent via ${notification.method.toUpperCase()}!`);
    onClose();
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
        maxWidth: '600px',
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
          alignItems: 'center',
          backgroundColor: '#fef2f2'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#dc2626' }}>
              🚨 Notify Employees - Spray Application
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#7f1d1d' }}>
              Alert workers about re-entry restrictions
            </p>
          </div>
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

        {/* Re-entry Info Display */}
        {reentryInfo && (
          <div style={{
            padding: '16px 20px',
            backgroundColor: reentryInfo.riskLevel === 'high' ? '#fef2f2' : 
                           reentryInfo.riskLevel === 'medium' ? '#fffbeb' : '#f0fdf4',
            border: `2px solid ${reentryInfo.riskLevel === 'high' ? '#ef4444' : 
                                reentryInfo.riskLevel === 'medium' ? '#f59e0b' : '#22c55e'}`,
            margin: '0 20px 20px 20px',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Clock size={16} />
              <span style={{ fontWeight: '600', fontSize: '14px' }}>
                Re-entry Restriction: {reentryInfo.hours} hours
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>
              Safe to enter after: <strong>{reentryInfo.safeEntryTime}</strong>
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
          {/* Notification Method */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
              Notification Method
            </label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {[
                { value: 'sms', label: 'Text Message', icon: MessageSquare },
                { value: 'email', label: 'Email', icon: Mail },
                { value: 'print', label: 'Print Notice', icon: Printer }
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setNotification(prev => ({ ...prev, method: value }))}
                  style={{
                    padding: '10px 14px',
                    border: notification.method === value ? '2px solid #3b82f6' : '1px solid #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: notification.method === value ? '#eff6ff' : 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Recipients */}
          {(notification.method === 'sms' || notification.method === 'email') && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
                {notification.method === 'sms' ? 'Phone Numbers' : 'Email Addresses'}
              </label>
              <input
                type="text"
                value={notification.recipients}
                onChange={(e) => setNotification(prev => ({ ...prev, recipients: e.target.value }))}
                placeholder={notification.method === 'sms' ? 
                  '+1234567890, +1987654321' : 
                  'worker1@farm.com, worker2@farm.com'
                }
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
          )}

          {/* Urgency Level */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
              Urgency Level
            </label>
            <select
              value={notification.urgencyLevel}
              onChange={(e) => setNotification(prev => ({ ...prev, urgencyLevel: e.target.value }))}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: 'white',
                fontSize: '14px'
              }}
            >
              <option value="high">🚨 High - Immediate Attention</option>
              <option value="medium">⚠️ Medium - Important Notice</option>
              <option value="low">ℹ️ Low - Standard Alert</option>
            </select>
          </div>

          {/* Include Options */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
              Include in Message
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { key: 'includeReentryTime', label: 'Re-entry restriction time' },
                { key: 'includeLocation', label: 'Specific location/block' },
                { key: 'includeProduct', label: 'Product details' }
              ].map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={notification[key as keyof typeof notification] as boolean}
                    onChange={(e) => setNotification(prev => ({ ...prev, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Custom Message */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
              Additional Manager Notes (Optional)
            </label>
            <textarea
              value={notification.customMessage}
              onChange={(e) => setNotification(prev => ({ ...prev, customMessage: e.target.value }))}
              placeholder="Add any specific instructions or additional safety notes..."
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                resize: 'vertical',
                fontSize: '13px'
              }}
            />
          </div>

          {/* Message Preview */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
              Message Preview
            </label>
            <div style={{
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              padding: '12px',
              maxHeight: '200px',
              overflow: 'auto'
            }}>
              <pre style={{
                whiteSpace: 'pre-wrap',
                fontSize: '11px',
                lineHeight: '1.4',
                margin: 0,
                fontFamily: 'Monaco, Consolas, monospace'
              }}>
                {generateNotificationMessage()}
              </pre>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Cancel
          </button>
          <button
            onClick={sendNotification}
            disabled={!notification.recipients && notification.method !== 'print'}
            style={{
              padding: '10px 16px',
              backgroundColor: notification.method !== 'print' && !notification.recipients ? 
                '#9ca3af' : '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: notification.method !== 'print' && !notification.recipients ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Send size={16} />
            Send Alert
          </button>
        </div>
      </div>
    </div>
  );
};
