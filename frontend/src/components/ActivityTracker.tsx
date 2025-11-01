'use client';

import { useEffect, useRef, useCallback } from 'react';
import { AnalyticsManager } from '@/lib/analytics';

interface ActivityTrackerProps {
  isActive?: boolean;
  idleTimeoutMs?: number;
  children?: React.ReactNode;
}

export default function ActivityTracker({ 
  isActive = true, 
  idleTimeoutMs = 5 * 60 * 1000, // 5 minutes default
  children 
}: ActivityTrackerProps) {
  const idleCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Record user activity
  const recordActivity = useCallback(() => {
    if (!isActive) return;
    
    lastActivityRef.current = Date.now();
    AnalyticsManager.recordActivity();
  }, [isActive]);

  // Handle window focus/blur
  const handleVisibilityChange = useCallback(() => {
    if (!isActive) return;

    if (document.hidden || !document.hasFocus()) {
      // Window lost focus or became hidden
      AnalyticsManager.pauseCurrentSession();
    } else {
      // Window gained focus or became visible
      recordActivity();
    }
  }, [isActive, recordActivity]);

  // Activity event listeners
  useEffect(() => {
    if (!isActive) return;

    const activityEvents = [
      'mousedown',
      'mousemove', 
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'contextmenu'
    ];

    // Text selection tracking is now handled within the MokuroViewer iframe

    // Throttle activity recording to avoid excessive calls
    let activityTimeout: NodeJS.Timeout | null = null;
    const throttledRecordActivity = () => {
      if (activityTimeout) return;
      
      activityTimeout = setTimeout(() => {
        recordActivity();
        activityTimeout = null;
      }, 1000); // Throttle to once per second
    };

    // Add activity listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, throttledRecordActivity, { passive: true });
    });

    // Text selection tracking is now handled within the MokuroViewer iframe
    // to avoid conflicts and ensure proper cross-frame selection detection
    // document.addEventListener('selectionchange', handleTextSelection, { passive: true });
    // document.addEventListener('selectstart', handleTextSelection, { passive: true });

    // Add visibility change listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('blur', handleVisibilityChange);

    // Add beforeunload listener for proper session cleanup
    const handleBeforeUnload = () => {
      AnalyticsManager.endReadingSession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, throttledRecordActivity);
      });
      
      // Selection listeners are now handled in MokuroViewer iframe
      // document.removeEventListener('selectionchange', handleTextSelection);
      // document.removeEventListener('selectstart', handleTextSelection);
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('blur', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
    };
  }, [isActive, recordActivity, handleVisibilityChange]);

  // Idle timeout checker
  useEffect(() => {
    if (!isActive) return;

    // Check for idle timeout every 30 seconds
    idleCheckIntervalRef.current = setInterval(() => {
      AnalyticsManager.checkForIdleTimeout(idleTimeoutMs);
    }, 30000);

    return () => {
      if (idleCheckIntervalRef.current) {
        clearInterval(idleCheckIntervalRef.current);
      }
    };
  }, [isActive, idleTimeoutMs]);

  // Initialize session when tracker becomes active
  useEffect(() => {
    if (isActive) {
      // Start session if none exists
      const currentSession = AnalyticsManager.getCurrentSession();
      if (!currentSession) {
        AnalyticsManager.startReadingSession();
      }
      // Record initial activity
      recordActivity();
    } else {
      // End session when tracker becomes inactive
      AnalyticsManager.endReadingSession();
    }
  }, [isActive, recordActivity]);

  return <>{children}</>;
}