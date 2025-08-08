
import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface MobileRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export function MobileRefresh({ onRefresh, children }: MobileRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [startY, setStartY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      setStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (startY === 0 || containerRef.current?.scrollTop !== 0) return;

    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - startY);
    
    if (distance > 0 && distance < 120) {
      setPullDistance(distance);
      e.preventDefault();
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 60) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
    setStartY(0);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, startY]);

  return (
    <div ref={containerRef} style={{ 
      height: '100%', 
      overflowY: 'auto',
      position: 'relative'
    }}>
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div style={{
          position: 'absolute',
          top: Math.min(pullDistance - 60, 20),
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          backgroundColor: 'white',
          borderRadius: '50%',
          padding: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          opacity: pullDistance > 30 || isRefreshing ? 1 : pullDistance / 30
        }}>
          <RefreshCw 
            size={20} 
            style={{ 
              color: pullDistance > 60 || isRefreshing ? '#22c55e' : '#6b7280',
              animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              transform: `rotate(${Math.min(pullDistance * 3, 180)}deg)`
            }} 
          />
        </div>
      )}
      
      <div style={{ paddingTop: pullDistance > 0 ? Math.min(pullDistance, 60) : 0 }}>
        {children}
      </div>
    </div>
  );
}
