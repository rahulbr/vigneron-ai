
// Performance utilities for the AgTech app
export class PerformanceUtils {
  // Debounce function for API calls
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // Throttle function for scroll events
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Virtual scrolling for large lists
  static calculateVisibleItems(
    scrollTop: number,
    itemHeight: number,
    containerHeight: number,
    totalItems: number
  ) {
    const start = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(start + visibleCount + 2, totalItems); // +2 for buffer
    return { start: Math.max(0, start - 1), end }; // -1 for buffer
  }

  // Image lazy loading
  static createIntersectionObserver(callback: (entry: IntersectionObserverEntry) => void) {
    return new IntersectionObserver((entries) => {
      entries.forEach(callback);
    }, {
      rootMargin: '50px 0px',
      threshold: 0.1
    });
  }
}

// Service Worker registration for offline capability
export const registerServiceWorker = () => {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
};
