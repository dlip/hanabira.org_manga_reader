'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ContentManager } from '@/lib/content';
import ActivityTracker from './ActivityTracker';

interface MokuroViewerProps {
  className?: string;
  chapterId?: string;
}

type NightMode =
  | 'off'
  | 'soft'
  | 'standard'
  | 'dark'
  | 'warm'
  | 'darkila'
  | 'nord'
  | 'midnight'
  | 'graytones'
  | 'darktones'
  | 'sepia'
  | 'amber'
  | 'cream'
  | 'duskrose'
  | 'sage'
  | 'trueblack'
  | 'slate'
  | 'moonlight'
  | 'solarized'
  | 'eink'
  | 'highcontrast';

export default function MokuroViewer({ className = '', chapterId }: MokuroViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [src, setSrc] = useState('/test.html');
  const [nightMode, setNightMode] = useState<NightMode>('off');
  const [grayIntensity, setGrayIntensity] = useState<number>(50); // 0..100
  const [sepiaIntensity, setSepiaIntensity] = useState<number>(50); // 0..100
  const [darkToneIntensity, setDarkToneIntensity] = useState<number>(50); // 0..100
  // (Reverted) removed single-page mode state & helpers

  function toWebPath(filePath?: string): string {
    if (!filePath) return '/test.html';
    // If it already looks like a web path under public root
    if (filePath.startsWith('/')) {
      // If it's an absolute FS path, try to strip up to /public
      const idx = filePath.lastIndexOf('/public/');
      if (idx !== -1) return filePath.substring(idx + '/public'.length);
      const match = filePath.match(/\/mokuro-reader-enhanced\/public(\/.*)$/);
      if (match) return match[1];
      return filePath; // assume already a web path like /test_manga/test.html
    }
    // Relative paths
    if (filePath.startsWith('public/')) return filePath.replace(/^public/, '');
    return '/' + filePath;
  }

  // Inject fixes into same-origin iframe to ensure pages render with proper dimensions
  const injectFixes = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;

  const containers = doc.querySelectorAll<HTMLElement>('.pageContainer');
      containers.forEach((el) => {
        const original = el.getAttribute('style') || '';
        // Ensure px units and background sizing/positioning
        const fixed = original
          .replace(/width:\s*([0-9]+)\s*;/, 'width: $1px;')
          .replace(/height:\s*([0-9]+)\s*;/, 'height: $1px;')
          .replace(/background-image:\s*url\(([^)]+)\)\s*;/, 'background-image: url($1); background-size: contain; background-repeat: no-repeat; background-position: center;');
        if (fixed !== original) el.setAttribute('style', fixed);

        if (!el.style.width) el.style.width = '800px';
        if (!el.style.height) el.style.height = '1200px';
        if (!el.style.backgroundSize) el.style.backgroundSize = 'contain';
        if (!el.style.backgroundRepeat) el.style.backgroundRepeat = 'no-repeat';
        if (!el.style.backgroundPosition) el.style.backgroundPosition = 'center';
      });

      // Ensure at least first page visible if all are hidden (original behavior)
      const pages = Array.from(doc.querySelectorAll<HTMLElement>('.page'));
      const anyVisible = pages.some(p => (p.style.display && p.style.display !== 'none'));
      if (!anyVisible && pages.length > 0) pages[0].style.display = 'inline-block';
  // (Reverted) single-page caching removed

      // Wire text events -> parent window for sidebar, only once per document
  if (!doc.body.getAttribute('data-text-wired')) {
        const getBoxText = (el: Element): string => {
          const ps = Array.from(el.querySelectorAll('p')) as HTMLElement[];
          const txt = ps.length > 0 ? ps.map(p => (p.textContent || '')).join('\n') : (el.textContent || '');
          return (txt || '').trim();
        };
        type IframeEvent = { type: 'textHover' | 'textLeave' | 'textClick' | 'pageTurn' | 'textSelection'; [k: string]: unknown };
        const post = (payload: IframeEvent) => {
          try {
            // Use '*' to avoid missing messages due to origin mismatch during development/static hosting
            iframe.contentWindow?.parent?.postMessage(payload, '*');
          } catch {}
        };
        const boxes = Array.from(doc.querySelectorAll<HTMLElement>('.textBox'));
        boxes.forEach((box) => {
          // Avoid double-binding on individual nodes
          if (box.getAttribute('data-wired')) return;
          box.setAttribute('data-wired', '1');

          box.addEventListener('mouseenter', () => {
            const text = getBoxText(box);
            if (text) post({ type: 'textHover', text, timestamp: Date.now() });
          });
          box.addEventListener('mouseleave', () => {
            post({ type: 'textLeave', timestamp: Date.now() });
          });
          box.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = getBoxText(box);
            if (text) post({ type: 'textClick', text, timestamp: Date.now() });
          });
        });
        
        // Add page turn tracking
        if (!doc.body.getAttribute('data-page-tracking')) {
          let currentVisiblePages = new Set<string>();
          
          const trackPageVisibility = () => {
            // Single-page mode removed; always track visibility
            const pages = Array.from(doc.querySelectorAll<HTMLElement>('.page'));
            const newVisiblePages = new Set<string>();
            pages.forEach((page, index) => {
              const rect = page.getBoundingClientRect();
              const isVisible = rect.top < doc.documentElement.clientHeight && rect.bottom > 0;
              if (isVisible) newVisiblePages.add(String(index));
            });
            newVisiblePages.forEach(pageId => {
              if (!currentVisiblePages.has(pageId)) {
                post({ type: 'pageTurn', pageIndex: parseInt(pageId), timestamp: Date.now() });
              }
            });
            currentVisiblePages = newVisiblePages;
          };

          {
            setTimeout(trackPageVisibility, 100);
            doc.addEventListener('scroll', trackPageVisibility, { passive: true });
            iframe.contentWindow?.addEventListener('resize', trackPageVisibility, { passive: true });
          }

          doc.body.setAttribute('data-page-tracking', 'true');
        }

        // Add text selection tracking within iframe
        if (!doc.body.getAttribute('data-selection-tracking')) {
          const handleIframeTextSelection = () => {
            const selection = doc.getSelection();
            if (selection && selection.toString().trim().length > 0) {
              post({ type: 'textSelection', timestamp: Date.now() });
            }
          };

          // Track selections on change
          doc.addEventListener('selectionchange', handleIframeTextSelection, { passive: true });
          doc.addEventListener('selectstart', handleIframeTextSelection, { passive: true });
          
          // Track mouseup as an alternative for text selection
          doc.addEventListener('mouseup', () => {
            setTimeout(handleIframeTextSelection, 10); // Small delay to ensure selection is complete
          }, { passive: true });
          
          doc.body.setAttribute('data-selection-tracking', 'true');
        }

        doc.body.setAttribute('data-text-wired', 'true');
      }
    } catch (e) {
      console.warn('Unable to inject fixes into iframe:', e);
    }
  }, []);

  useEffect(() => {
    // Determine iframe src from chapter selection
    const loadChapter = async () => {
      if (chapterId) {
        try {
          const chapter = await ContentManager.getChapterById(chapterId);
          console.log('🔍 Chapter loaded:', { chapterId, chapter });
          if (chapter?.filePath) {
            const webPath = toWebPath(chapter.filePath);
            console.log('🔍 Path conversion:', { 
              originalFilePath: chapter.filePath, 
              convertedWebPath: webPath,
              finalSrc: webPath
            });
            setSrc(webPath);
            return;
          }
        } catch (e) {
          console.warn('Failed to load chapter for viewer:', e);
        }
      }
      // Fallback default
      console.log('🔍 Using fallback src: /test.html');
      setSrc('/test.html');
    };
    loadChapter();
  }, [chapterId]);

  useEffect(() => {
    // Load persisted night mode preference (supports legacy boolean)
    try {
      const savedNew = localStorage.getItem('manga:nightMode');
      const savedLegacy = localStorage.getItem('manga:invertMode');
      const savedGray = localStorage.getItem('manga:grayIntensity');
      const savedSepia = localStorage.getItem('manga:sepiaIntensity');
      if (savedNew) {
        const mRaw = savedNew as string;
        const migrated = mRaw === 'graytonesDeep' ? 'graytones' : mRaw;
  const allowed = ['off','soft','standard','dark','warm','darkila','nord','midnight','graytones','darktones','sepia','amber','cream','duskrose','sage','trueblack','slate','moonlight','solarized','eink','highcontrast'];
        setNightMode((allowed as string[]).includes(migrated) ? (migrated as NightMode) : 'standard');
        if (mRaw === 'graytonesDeep') {
          try { localStorage.setItem('manga:nightMode', 'graytones'); } catch {}
        }
      } else if (savedLegacy) {
        setNightMode(savedLegacy === 'true' ? 'standard' : 'off');
      }
      if (savedGray) {
        const n = Math.max(0, Math.min(100, parseInt(savedGray, 10)));
        if (!Number.isNaN(n)) setGrayIntensity(n);
      }
      if (savedSepia) {
        const n = Math.max(0, Math.min(100, parseInt(savedSepia, 10)));
        if (!Number.isNaN(n)) setSepiaIntensity(n);
      }
    } catch {}

    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      console.log('Mokuro iframe loaded successfully');
      setIsLoaded(true);
      injectFixes();
    };

    const handleError = () => {
      console.error('Mokuro iframe failed to load');
      setIsLoaded(true); // Show content anyway to see error
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);
    
    // Handle messages from iframe
    const handleMessage = (event: MessageEvent) => {
      // Accept messages regardless of origin (content is local/static); ensure only expected shapes are processed
      const { type } = (event.data || {}) as { type?: string };
      if (type === 'pageTurn') {
        // Import AnalyticsManager dynamically to avoid circular imports
        import('@/lib/analytics').then(({ AnalyticsManager }) => {
          AnalyticsManager.recordPageTurn();
        });
      } else if (type === 'textSelection') {
        // Track text selections within iframe
        import('@/lib/analytics').then(({ AnalyticsManager }) => {
          AnalyticsManager.recordTextSelection();
        });
      } else if (type === 'textClick') {
        // Track word lookups on text clicks
        import('@/lib/analytics').then(({ AnalyticsManager }) => {
          AnalyticsManager.recordWordLookup();
        });
      }
      // Note: textClick events are handled by TextSidebar for word lookup tracking
    };
    
    window.addEventListener('message', handleMessage);
    
    // Fallback timeout to ensure content shows even if load events don't fire
    const timeout = setTimeout(() => {
      console.log('Mokuro iframe load timeout - showing content anyway');
      setIsLoaded(true);
      injectFixes();
    }, 3000);
    
    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout);
    };
  }, [src, chapterId, injectFixes]);

  // (Reverted) single-page toggle effect removed

  // (Reverted) Removed single-page mode effect.

  // Apply gray tones intensity by setting CSS variables on the iframe element
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    // Only apply for graytones mode
    if (nightMode !== 'graytones') {
      iframe.style.removeProperty('--manga-gray-filter');
      iframe.style.removeProperty('--manga-gray-deep-filter');
      return;
    }
    // Map 0..100 to filter components
    const t = grayIntensity / 100; // 0..1
    // Base defaults
    // Interpolate toward softer end at 0 and darker at 100
    const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
    const softTarget = { gray: 0.05, bright: 0.95, contrast: 0.97, sat: 0.98 };
    const darkTarget = { gray: 0.25, bright: 0.80, contrast: 0.90, sat: 0.90 };

    const g1 = {
      gray: lerp(softTarget.gray, darkTarget.gray, t),
      bright: lerp(softTarget.bright, darkTarget.bright, t),
      contrast: lerp(softTarget.contrast, darkTarget.contrast, t),
      sat: lerp(softTarget.sat, darkTarget.sat, t),
    };
    const filter1 = `grayscale(${g1.gray.toFixed(3)}) brightness(${g1.bright.toFixed(3)}) contrast(${g1.contrast.toFixed(3)}) saturate(${g1.sat.toFixed(3)})`;
    iframe.style.setProperty('--manga-gray-filter', filter1);
    iframe.style.removeProperty('--manga-gray-deep-filter');
  }, [grayIntensity, nightMode]);

  // Apply dark tones intensity (non-invert, stronger dimming than graytones)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (nightMode !== 'darktones') {
      iframe.style.removeProperty('--manga-darktones-filter');
      return;
    }
    const t = darkToneIntensity / 100; // 0..1
    const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
    // Softer (lighter) end vs darker end
    const softTarget = { gray: 0.05, bright: 0.85, contrast: 0.95, sat: 0.95 };
    const darkTarget = { gray: 0.20, bright: 0.55, contrast: 1.05, sat: 0.85 };
    const v = {
      gray: lerp(softTarget.gray, darkTarget.gray, t),
      bright: lerp(softTarget.bright, darkTarget.bright, t),
      contrast: lerp(softTarget.contrast, darkTarget.contrast, t),
      sat: lerp(softTarget.sat, darkTarget.sat, t),
    };
    const filter = `grayscale(${v.gray.toFixed(3)}) brightness(${v.bright.toFixed(3)}) contrast(${v.contrast.toFixed(3)}) saturate(${v.sat.toFixed(3)})`;
    iframe.style.setProperty('--manga-darktones-filter', filter);
  }, [darkToneIntensity, nightMode]);

  // Apply sepia intensity by setting CSS variable on the iframe element
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (nightMode !== 'sepia') {
      iframe.style.removeProperty('--manga-sepia-filter');
      return;
    }
    const t = sepiaIntensity / 100; // 0..1
    const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
    const soft = { sep: 0.10, bright: 0.96, contrast: 0.97, sat: 1.00 };
    const dark = { sep: 0.40, bright: 0.88, contrast: 0.92, sat: 1.10 };
    const v = {
      sep: lerp(soft.sep, dark.sep, t),
      bright: lerp(soft.bright, dark.bright, t),
      contrast: lerp(soft.contrast, dark.contrast, t),
      sat: lerp(soft.sat, dark.sat, t),
    };
    const filter = `sepia(${v.sep.toFixed(3)}) brightness(${v.bright.toFixed(3)}) contrast(${v.contrast.toFixed(3)}) saturate(${v.sat.toFixed(3)})`;
    iframe.style.setProperty('--manga-sepia-filter', filter);
  }, [sepiaIntensity, nightMode]);

  return (
    <ActivityTracker isActive={isLoaded} idleTimeoutMs={3 * 60 * 1000}>
  <div className={`relative ${className}`}>
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading Mokuro Reader...</p>
            </div>
          </div>
        )}
        {/* Controls Overlay */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-black/60 text-white rounded-md px-2 py-1.5 shadow">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0  0 0 21 12.79z"></path>
          </svg>
          <label className="text-xs opacity-80">Night</label>
          <select
            className="bg-transparent text-white text-sm focus:outline-none cursor-pointer force-dark-menu"
            value={nightMode}
            onChange={(e) => {
              const v = (e.target.value || 'off') as NightMode;
              setNightMode(v);
              try { localStorage.setItem('manga:nightMode', v); } catch {}
            }}
            title="Night mode"
            aria-label="Night mode"
          >
            <option value="off">Off</option>
            <optgroup label="Basic Invert">
              <option value="soft">Soft</option>
              <option value="standard">Standard</option>
              <option value="dark">Dark</option>
              <option value="warm">Warm</option>
            </optgroup>
            <optgroup label="Themed Invert">
              <option value="darkila">Darkila</option>
              <option value="nord">Nord</option>
              <option value="midnight">Midnight</option>
            </optgroup>
            <optgroup label="Dark (Invert)">
              <option value="trueblack">True Black</option>
              <option value="slate">Slate</option>
              <option value="moonlight">Moonlight</option>
              <option value="solarized">Solarized Dark</option>
            </optgroup>
            <optgroup label="Warm / Tinted">
              <option value="sepia">Sepia</option>
              <option value="amber">Amber</option>
              <option value="cream">Cream Paper</option>
              <option value="duskrose">Dusk Rose</option>
              <option value="sage">Forest Sage</option>
            </optgroup>
            <optgroup label="Utility & Accessibility">
              <option value="graytones">Gray Tones</option>
            <option value="darktones">Dark Tones</option>
              <option value="eink">E-Ink</option>
              <option value="highcontrast">High Contrast</option>
            </optgroup>
          </select>
          {(nightMode === 'graytones' || nightMode === 'sepia' || nightMode === 'darktones') && (
            <>
              <span className="text-xs opacity-80 ml-2">Intensity</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                className="accent-white cursor-pointer"
                value={
                  nightMode === 'sepia' ? sepiaIntensity :
                  nightMode === 'graytones' ? grayIntensity :
                  darkToneIntensity
                }
                onChange={(e) => {
                  const n = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
                  if (nightMode === 'sepia') {
                    setSepiaIntensity(n);
                    try { localStorage.setItem('manga:sepiaIntensity', String(n)); } catch {}
                  } else if (nightMode === 'graytones') {
                    setGrayIntensity(n);
                    try { localStorage.setItem('manga:grayIntensity', String(n)); } catch {}
                  } else {
                    setDarkToneIntensity(n);
                    try { localStorage.setItem('manga:darkToneIntensity', String(n)); } catch {}
                  }
                }}
                aria-label="Night filter intensity"
              />
            </>
          )}
          {/* Single-page toggle removed (reverted) */}
        </div>
        {/* No overlay nav; navigation handled in toggle bar only */}
        
        <iframe
          ref={iframeRef}
          src={src}
          className={`w-full h-full min-h-screen border-0 ${
            nightMode === 'off' ? '' :
            nightMode === 'soft' ? 'manga-invert-soft' :
            nightMode === 'standard' ? 'manga-invert-standard' :
            nightMode === 'dark' ? 'manga-invert-dark' :
            nightMode === 'warm' ? 'manga-invert-warm' :
            nightMode === 'darkila' ? 'manga-invert-darkila' :
            nightMode === 'nord' ? 'manga-invert-nord' :
            nightMode === 'midnight' ? 'manga-invert-midnight' :
            nightMode === 'graytones' ? 'manga-invert-graytones' :
            nightMode === 'darktones' ? 'manga-invert-darktones' :
            nightMode === 'sepia' ? 'manga-invert-sepia' :
            nightMode === 'amber' ? 'manga-invert-amber' :
            nightMode === 'cream' ? 'manga-invert-cream' :
            nightMode === 'duskrose' ? 'manga-invert-duskrose' :
            nightMode === 'sage' ? 'manga-invert-sage' :
            nightMode === 'trueblack' ? 'manga-invert-trueblack' :
            nightMode === 'slate' ? 'manga-invert-slate' :
            nightMode === 'moonlight' ? 'manga-invert-moonlight' :
            nightMode === 'solarized' ? 'manga-invert-solarized' :
            nightMode === 'eink' ? 'manga-invert-eink' :
            'manga-invert-highcontrast'
          }`}
          title="Mokuro Manga Reader"
        />
      </div>
    </ActivityTracker>
  );
}
