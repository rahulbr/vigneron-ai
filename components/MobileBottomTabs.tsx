
import React from 'react';

interface Tab {
  id: string;
  label: string;
  emoji: string;
}

interface MobileBottomTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function MobileBottomTabs({ tabs, activeTab, onTabChange }: MobileBottomTabsProps) {
  return (
    <>
      <style jsx>{`
        @media (max-width: 768px) {
          .mobile-bottom-tabs {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: white;
            border-top: 1px solid #e5e7eb;
            z-index: 1000;
            padding: 8px 4px 24px 4px; /* Extra padding for iOS safe area */
            box-shadow: 0 -2px 12px rgba(0,0,0,0.1);
          }
          
          .mobile-tab-button {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 8px 4px;
            background: none;
            border: none;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 10px;
            gap: 4px;
          }
          
          .mobile-tab-button.active {
            color: #22c55e;
          }
          
          .mobile-tab-button:not(.active) {
            color: #6b7280;
          }
          
          .mobile-tab-emoji {
            font-size: 20px;
            margin-bottom: 2px;
          }
          
          .mobile-content-padding {
            padding-bottom: 90px; /* Space for bottom tabs */
          }
        }
        
        @media (min-width: 769px) {
          .mobile-bottom-tabs {
            display: none;
          }
          .mobile-content-padding {
            padding-bottom: 0;
          }
        }
      `}</style>
      
      <div className="mobile-bottom-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`mobile-tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <div className="mobile-tab-emoji">{tab.emoji}</div>
            <div>{tab.label}</div>
          </button>
        ))}
      </div>
    </>
  );
}
