
import React, { useRef, useEffect } from 'react';

interface Tab {
  id: string;
  label: string;
  emoji: string;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const handleTouchStart = (e: TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startTimeRef.current = Date.now();
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const endTime = Date.now();
    const deltaX = endX - startXRef.current;
    const deltaTime = endTime - startTimeRef.current;

    // Swipe gesture detection (fast swipe, > 50px distance, < 300ms)
    if (Math.abs(deltaX) > 50 && deltaTime < 300) {
      const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
      
      if (deltaX > 0 && currentIndex > 0) {
        // Swipe right - go to previous tab
        onTabChange(tabs[currentIndex - 1].id);
      } else if (deltaX < 0 && currentIndex < tabs.length - 1) {
        // Swipe left - go to next tab
        onTabChange(tabs[currentIndex + 1].id);
      }
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [activeTab, tabs, onTabChange]);

  return (
    <div 
      ref={containerRef}
      className="tab-navigation"
      style={{
        display: 'flex',
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginBottom: '20px',
        overflowX: 'auto',
        minHeight: '48px',
        position: 'sticky',
        top: '0',
        zIndex: 100,
        scrollSnapType: 'x mandatory'
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            flex: 1,
            minWidth: '120px',
            padding: '12px 16px',
            backgroundColor: activeTab === tab.id ? '#22c55e' : 'transparent',
            color: activeTab === tab.id ? 'white' : '#6b7280',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === tab.id ? '600' : '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
            scrollSnapAlign: 'center'
          }}
          onMouseEnter={(e) => {
            if (activeTab !== tab.id) {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.color = '#374151';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== tab.id) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#6b7280';
            }
          }}
        >
          <span style={{ fontSize: '18px' }}>{tab.emoji}</span>
          <span className="hide-mobile">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
