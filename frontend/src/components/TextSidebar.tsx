'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import FlashcardModal from './FlashcardModal';
import { type Flashcard } from '@/lib/flashcards';
import { type FuriganaPair } from './FuriganaText';
import { useToast } from './Toast';
import FuriganaText, { type FuriganaData } from './FuriganaText';

interface TextEntry {
  id: string;
  text: string;
  timestamp: number;
  type: 'hover' | 'click';
}

interface Translation {
  success: boolean;
  translation?: string;
  provider: string;
  error?: string;
  detected_language?: string;
}

interface GrammarExplanation {
  success: boolean;
  explanation?: string;
  provider: string;
  error?: string;
  source_text?: string;
}

interface OpenAIModel {
  alias: string;
  label: string;
  api_name?: string;
  family?: string;
  tier?: string;
  pricing?: { input?: number; cached_input?: number; output?: number; training?: number };
  notes?: string;
}

interface TextSidebarProps {
  className?: string;
}

export default function TextSidebar({ className = '' }: TextSidebarProps) {
  const [currentText, setCurrentText] = useState<string>('');
  const [textHistory, setTextHistory] = useState<TextEntry[]>([]);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [interactionType, setInteractionType] = useState<'hover' | 'click' | null>(null);
  const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState<boolean>(false);
  const [flashcardText, setFlashcardText] = useState<string>('');
  const [flashcardBack, setFlashcardBack] = useState<string>('');
  const [flashcardFurigana, setFlashcardFurigana] = useState<FuriganaPair[] | undefined>(undefined);
  const [flashcardNotes, setFlashcardNotes] = useState<string>('');
  const [flashcardGrammar, setFlashcardGrammar] = useState<string>('');
  const [translations, setTranslations] = useState<{[key: string]: Translation}>({});
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationProvider, setTranslationProvider] = useState<'openai' | 'deepl'>('openai');
  const [grammarExplanations, setGrammarExplanations] = useState<{[key: string]: GrammarExplanation}>({});
  const [isExplainingGrammar, setIsExplainingGrammar] = useState<boolean>(false);
  const [openAIModels, setOpenAIModels] = useState<OpenAIModel[]>([]);
  const [selectedOpenAIModel, setSelectedOpenAIModel] = useState<string | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
  const [furiganaData, setFuriganaData] = useState<{[key: string]: FuriganaData}>({});
  const [isGeneratingFurigana, setIsGeneratingFurigana] = useState<boolean>(false);
  const [showFurigana, setShowFurigana] = useState<boolean>(false);
  const { addToast } = useToast();

  // Keep a ref of the latest furiganaData so callbacks can read current cache without being recreated
  const furiganaRef = useRef(furiganaData);
  useEffect(() => {
    furiganaRef.current = furiganaData;
  }, [furiganaData]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, text, timestamp } = event.data;

      switch (type) {
        case 'textHover':
          // Ignore hover events; only update on click
          break;

        case 'textLeave':
          // Ignore leave events; keep showing last clicked text
          break;

        case 'textClick':
          const newEntry: TextEntry = {
            id: `${timestamp}-${Math.random()}`,
            text,
            timestamp,
            type: 'click'
          };
          
          setTextHistory(prev => {
            // Avoid duplicates
            const filtered = prev.filter(entry => entry.text !== text);
            return [newEntry, ...filtered].slice(0, 20); // Keep only last 20 entries
          });
          setCurrentText(text);
          setIsVisible(true);
          
          setInteractionType('click');
          break;
        
        case 'textClear':
          setIsVisible(false);
          setInteractionType(null);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Load saved furigana preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('showFurigana');
      if (saved !== null) {
        setShowFurigana(saved === 'true');
      }
    } catch { /* ignore */ }
  }, []);

  // Persist furigana preference
  useEffect(() => {
    try {
      localStorage.setItem('showFurigana', String(showFurigana));
    } catch { /* ignore */ }
  }, [showFurigana]);

  // (moved below after function definitions)

  // Load available OpenAI models from backend
  useEffect(() => {
    const loadModels = async () => {
      setIsLoadingModels(true);
      try {
        // Use Next.js rewrite to avoid CORS: proxy to backend
        const res = await fetch('/api/translate/models');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const models: OpenAIModel[] = Array.isArray(data?.openai) ? data.openai : [];
        setOpenAIModels(models);
        const defAlias: string | undefined = data?.default_openai_model;
        if (defAlias && models.some(m => m.alias === defAlias)) {
          setSelectedOpenAIModel(defAlias);
        } else if (models.length > 0) {
          setSelectedOpenAIModel(models[0].alias);
        }
      } catch (e) {
        console.warn('Failed to load OpenAI models', e);
      } finally {
        setIsLoadingModels(false);
      }
    };
    loadModels();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addToast('Text copied to clipboard!', 'success', 2000);
    }).catch(() => {
      addToast('Failed to copy text', 'error', 2000);
    });
  };

  const clearHistory = () => {
    setTextHistory([]);
  };

  // Helper functions for external analysis
  const createSentenceAnalysisUrl = (text: string) => {
    const encodedText = encodeURIComponent(text);
    return `https://hanabira.org/sentence-analysis?sentence=${encodedText}&language=japanese`;
  };

  const createGrammarGraphUrl = (text: string) => {
    const encodedText = encodeURIComponent(text);
    return `https://hanabira.org/grammar-graph?sentence=${encodedText}&language=japanese`;
  };

  const openExternalAnalysis = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const createFlashcard = (text: string) => {
    setFlashcardText(text);
    const t = getCurrentTranslation(text);
    setFlashcardBack(t && t.success ? (t.translation ?? '') : '');
    const f = getCurrentFurigana(text);
    setFlashcardFurigana(f && f.success ? f.furigana : undefined);
    const g = getCurrentGrammarExplanation(text);
    setFlashcardNotes(''); // Keep notes separate
    setFlashcardGrammar(g && g.success ? (g.explanation ?? '') : '');
    setIsFlashcardModalOpen(true);
  };

  const handleFlashcardSaved = (flashcard: Flashcard) => {
    console.log('Flashcard saved:', flashcard);
    addToast('Flashcard created successfully!', 'success');
  };

  const translateText = async (text: string, provider: 'openai' | 'deepl' = translationProvider) => {
    if (!text.trim()) return;
    
    // Check if we already have a translation for this text
    const cacheKey = `${text}-${provider}${provider === 'openai' ? `-${selectedOpenAIModel ?? 'default'}` : ''}`;
    if (translations[cacheKey]) {
      return translations[cacheKey];
    }
    
    setIsTranslating(true);
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${baseUrl}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          provider: provider,
          openai_model: provider === 'openai' ? (selectedOpenAIModel ?? undefined) : undefined,
          source_lang: provider === 'deepl' ? 'JA' : 'Japanese',
          target_lang: provider === 'deepl' ? 'EN' : 'English'
        }),
      });
      
      const result: Translation = await response.json();
      
      // Cache the translation
      setTranslations(prev => ({
        ...prev,
        [cacheKey]: result
      }));
      
      if (result.success) {
        addToast(`Translation completed via ${result.provider}`, 'success', 2000);
      } else {
        addToast(`Translation failed: ${result.error}`, 'error', 3000);
      }
      
      return result;
      
    } catch (error) {
      const errorResult: Translation = {
        success: false,
        error: `Network error: ${error}`,
        provider: provider
      };
      
      addToast('Translation service unavailable', 'error', 3000);
      return errorResult;
      
    } finally {
      setIsTranslating(false);
    }
  };

  const explainGrammar = async (text: string) => {
    if (!text.trim()) return;
    
    // Check if we already have a grammar explanation for this text
    const cacheKey = `${text}-${selectedOpenAIModel ?? 'default'}`;
    if (grammarExplanations[cacheKey]) {
      return grammarExplanations[cacheKey];
    }
    
    setIsExplainingGrammar(true);
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${baseUrl}/grammar/explain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          openai_model: selectedOpenAIModel ?? undefined
        }),
      });
      
      const result: GrammarExplanation = await response.json();
      
      // Cache the grammar explanation
      setGrammarExplanations(prev => ({
        ...prev,
        [cacheKey]: result
      }));
      
      if (result.success) {
        addToast('Grammar explanation generated!', 'success', 2000);
      } else {
        addToast(`Grammar explanation failed: ${result.error}`, 'error', 3000);
      }
      
      return result;
      
    } catch (error) {
      const errorResult: GrammarExplanation = {
        success: false,
        error: `Network error: ${error}`,
        provider: 'openai'
      };
      
      addToast('Grammar explanation service unavailable', 'error', 3000);
      return errorResult;
      
    } finally {
      setIsExplainingGrammar(false);
    }
  };

  const getCurrentTranslation = (text: string): Translation | null => {
    const cacheKey = `${text}-${translationProvider}${translationProvider === 'openai' ? `-${selectedOpenAIModel ?? 'default'}` : ''}`;
    return translations[cacheKey] || null;
  };

  const getCurrentGrammarExplanation = (text: string): GrammarExplanation | null => {
    const cacheKey = `${text}-${selectedOpenAIModel ?? 'default'}`;
    return grammarExplanations[cacheKey] || null;
  };

  // If the flashcard modal is open and grammar explanation arrives later,
  // auto-fill the grammar once (don't override if user has already typed grammar)
  useEffect(() => {
    if (!isFlashcardModalOpen || !flashcardText) return;
    const g = getCurrentGrammarExplanation(flashcardText);
    if (g && g.success) {
      const expl = g.explanation ?? '';
      if ((flashcardGrammar ?? '').trim() === '' && expl.trim() !== '') {
        setFlashcardGrammar(expl);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFlashcardModalOpen, flashcardText, grammarExplanations]);

  const generateFurigana = useCallback(async (text: string) => {
    if (!text.trim()) return;
    
    // Check if we already have furigana for this text (use ref to avoid recreating this callback on state updates)
    if (furiganaRef.current && furiganaRef.current[text] && furiganaRef.current[text].success) {
      return furiganaRef.current[text];
    }
    
    setIsGeneratingFurigana(true);
    
    try {
      const response = await fetch('/api/furigana', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
        }),
      });
      
      const result: FuriganaData = await response.json();
      
      // Cache the furigana data
      setFuriganaData(prev => ({
        ...prev,
        [text]: result
      }));
      
      if (result.success) {
        addToast('Furigana generated successfully', 'success', 2000);
      } else {
        addToast(`Furigana generation failed: ${result.error}`, 'error', 3000);
      }
      
      return result;
      
    } catch (error) {
      const errorResult: FuriganaData = {
        success: false,
        error: `Network error: ${error}`
      };
      // Cache the failure as well to avoid repeated automatic retries
      setFuriganaData(prev => ({
        ...prev,
        [text]: errorResult
      }));
      addToast('Furigana service unavailable', 'error', 3000);
      return errorResult;
      
    } finally {
      setIsGeneratingFurigana(false);
    }
  }, [addToast]);

  const getCurrentFurigana = useCallback((text: string): FuriganaData | null => {
    return furiganaData[text] || null;
  }, [furiganaData]);

  // Auto-generate furigana when toggled on and text changes
  // This restores the previous UX: turning on the switch will fetch furigana
  // for the currently selected text if it's not already cached.
  useEffect(() => {
    const text = currentText?.trim();
    if (!showFurigana || !text) return;
    const current = getCurrentFurigana(text);
    // Auto-generate only once per text (when no cache exists).
    // Do not auto-retry on failures to prevent loops; user can click Generate to retry.
    if (!current && !isGeneratingFurigana) {
      void generateFurigana(text);
    }
  }, [showFurigana, currentText, getCurrentFurigana, generateFurigana, isGeneratingFurigana]);

  return (
    <div className={`bg-white border-l border-gray-200 flex flex-col min-h-0 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Japanese Text</h2>
          {interactionType && (
            <span className={`px-2 py-1 text-xs rounded-full ${
              interactionType === 'hover' 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-green-100 text-green-800'
            }`}>
              {interactionType === 'hover' ? 'Hovering' : 'Clicked'}
            </span>
          )}
        </div>
  <p className="text-sm text-gray-600">Click on text to display here</p>
      </div>

      {/* Current Text Display */}
      <div className="p-4 border-b border-gray-200">
        <div className="mb-2 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Current Text:</span>
          <div className="flex items-center space-x-2">
            <select
              value={translationProvider}
              onChange={(e) => setTranslationProvider(e.target.value as 'openai' | 'deepl')}
                className="text-xs px-2 py-1 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 force-light-menu"
              title="Select translation provider"
            >
              <option value="openai">ChatGPT</option>
              <option value="deepl">DeepL</option>
            </select>
            {translationProvider === 'openai' && (
              <select
                value={selectedOpenAIModel ?? ''}
                onChange={(e) => setSelectedOpenAIModel(e.target.value)}
                  className="text-xs px-2 py-1 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 force-light-menu"
                title="Select OpenAI model"
                disabled={isLoadingModels}
              >
                {isLoadingModels && <option value="">Loading models...</option>}
                {!isLoadingModels && openAIModels.length === 0 && (
                  <option value="">No models found</option>
                )}
                {!isLoadingModels && openAIModels.map((m) => (
                  <option key={m.alias} value={m.alias}>{m.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        
        {/* Furigana Controls */}
        {currentText && (
          <div className="mb-2 flex justify-between items-center">
            <span className="text-xs text-gray-600">Reading Aid:</span>
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={showFurigana}
                    onChange={(e) => setShowFurigana(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-8 h-4 rounded-full transition-colors duration-200 ${
                    showFurigana ? 'bg-blue-500' : 'bg-gray-300'
                  }`}>
                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                      showFurigana ? 'translate-x-4' : 'translate-x-0.5'
                    } translate-y-0.5`}></div>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-700 font-medium">Show Furigana</span>
                  {showFurigana && !getCurrentFurigana(currentText)?.success && (
                    <span className="text-xs text-gray-500">(Generate furigana first)</span>
                  )}
                </div>
              </label>
            </div>
          </div>
        )}
        <div className={`min-h-[100px] p-3 rounded border transition-all duration-200 ${
          isVisible ? 'border-blue-300 bg-white shadow-sm' : 'border-gray-300 bg-white'
        }`}>
          {currentText ? (
            <div>
              <div className="text-lg leading-relaxed text-gray-900 whitespace-pre-wrap font-medium">
                {getCurrentFurigana(currentText)?.success ? (
                  <FuriganaText 
                    furiganaPairs={getCurrentFurigana(currentText)?.furigana || []}
                    showFurigana={showFurigana}
                  />
                ) : (
                  <span className="font-japanese">{currentText.replace(/[\n\r\s]/g, '')}</span>
                )}
              </div>

              {/* External Analysis Links */}
              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => openExternalAnalysis(createSentenceAnalysisUrl(currentText))}
                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Analyze sentence on hanabira.org"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                    <path d="M8 11h6M11 8v6"/>
                  </svg>
                </button>
                <button
                  onClick={() => openExternalAnalysis(createGrammarGraphUrl(currentText))}
                  className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                  title="View grammar graph on hanabira.org"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18"/>
                    <path d="m19 9-5 5-4-4-3 3"/>
                    <circle cx="9" cy="9" r="2"/>
                    <circle cx="20" cy="4" r="2"/>
                  </svg>
                </button>
              </div>

              {/* Furigana helper when toggle is on but no data yet */}
              {showFurigana && currentText && (!getCurrentFurigana(currentText) || !getCurrentFurigana(currentText)?.success) && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-gray-600">Furigana not available yet.</span>
                  <button
                    className="px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                    onClick={() => generateFurigana(currentText)}
                    disabled={isGeneratingFurigana}
                    title="Generate furigana"
                  >
                    {isGeneratingFurigana ? 'Generating…' : 'Generate'}
                  </button>
                </div>
              )}
              
              {/* Translation Display */}
              {getCurrentTranslation(currentText) && (
                <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-800">
                      Translation ({getCurrentTranslation(currentText)?.provider}):
                    </span>
                  </div>
                  {getCurrentTranslation(currentText)?.success ? (
                    <p className="text-gray-800 leading-relaxed">
                      {getCurrentTranslation(currentText)?.translation}
                    </p>
                  ) : (
                    <p className="text-red-600 text-sm">
                      Error: {getCurrentTranslation(currentText)?.error}
                    </p>
                  )}
                </div>
              )}

              {/* Grammar Explanation Display */}
              {getCurrentGrammarExplanation(currentText) && (
                <div className="mt-3 p-3 bg-green-50 rounded border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-800">
                      Grammar Explanation:
                    </span>
                  </div>
                  {getCurrentGrammarExplanation(currentText)?.success ? (
                    <div className="max-h-64 overflow-y-auto">
                      <div className="prose prose-sm prose-green max-w-none text-gray-800 leading-relaxed">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h2: ({...props}) => <h2 className="text-lg font-bold mt-4 mb-2 text-green-800" {...props} />,
                            h3: ({...props}) => <h3 className="text-base font-semibold mt-3 mb-1 text-green-700" {...props} />,
                            p: ({...props}) => <p className="mb-2" {...props} />,
                            ul: ({...props}) => <ul className="list-disc pl-4 mb-2" {...props} />,
                            strong: ({...props}) => <strong className="font-semibold text-green-900" {...props} />,
                            code: ({...props}) => <code className="bg-green-100 px-1 py-0.5 rounded text-sm font-mono" {...props} />
                          }}
                        >
                          {getCurrentGrammarExplanation(currentText)?.explanation || ''}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <p className="text-red-600 text-sm">
                      Error: {getCurrentGrammarExplanation(currentText)?.error}
                    </p>
                  )}
                </div>
              )}
              
              {/* Action Buttons - Organized in logical groups */}
              <div className="mt-4 space-y-3">
                {/* Quick Actions Group */}
                <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg p-3 border border-gray-100">
                  <h4 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Quick Actions</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(currentText)}
                      className="flex-1 px-2 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors duration-200 flex items-center justify-center gap-1.5 font-medium"
                      title="Copy text to clipboard"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </button>
                    <button
                      onClick={() => createFlashcard(currentText)}
                      className="flex-1 px-2 py-1.5 text-xs bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200 transition-colors duration-200 flex items-center justify-center gap-1.5 font-medium"
                      title="Create flashcard"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Flashcard
                    </button>
                  </div>
                </div>

                {/* Language Tools Group */}
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-3 border border-purple-100">
                  <h4 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Language Tools</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => translateText(currentText)}
                      disabled={isTranslating}
                      className="px-2 py-1.5 text-xs bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-medium"
                      title="Translate text"
                    >
                      {isTranslating ? (
                        <>
                          <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="hidden sm:inline">...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                          </svg>
                          Translate
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => generateFurigana(currentText)}
                      disabled={isGeneratingFurigana}
                      className="px-2 py-1.5 text-xs bg-amber-100 text-amber-700 rounded-md hover:bg-amber-200 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-medium"
                      title="Generate furigana"
                    >
                      {isGeneratingFurigana ? (
                        <>
                          <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 814 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="hidden sm:inline">...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18m0 0l-4-4m4 4l4-4" />
                          </svg>
                          Furigana
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Grammar Analysis Group */}
                <div className="bg-gradient-to-r from-rose-50 to-pink-50 rounded-lg p-3 border border-rose-100">
                  <h4 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Grammar Analysis</h4>
                  <button
                    onClick={() => explainGrammar(currentText)}
                    disabled={isExplainingGrammar}
                    className="w-full px-2 py-1.5 text-xs bg-rose-100 text-rose-700 rounded-md hover:bg-rose-200 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-medium"
                    title="Explain grammar structure"
                  >
                    {isExplainingGrammar ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Analyzing Grammar...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Explain Grammar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-600 italic">No text selected</p>
          )}
        </div>
      </div>

      {/* Text History */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">
            History ({textHistory.length})
          </span>
          {textHistory.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-xs text-red-600 hover:text-red-800 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {textHistory.length === 0 ? (
            <p className="text-gray-600 italic text-center">No clicked text yet</p>
          ) : (
            textHistory.map((entry) => {
              const entryTranslation = getCurrentTranslation(entry.text);
              return (
                <div
                  key={entry.id}
                  className="p-3 bg-white rounded border border-gray-200 hover:bg-gray-50 hover:border-blue-200 transition-all cursor-pointer group shadow-sm"
                  onClick={() => {
                    setCurrentText(entry.text);
                    setIsVisible(true);
                  }}
                >
                  <div className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap font-medium">
                    {getCurrentFurigana(entry.text)?.success ? (
                      <FuriganaText 
                        furiganaPairs={getCurrentFurigana(entry.text)?.furigana || []}
                        showFurigana={showFurigana}
                      />
                    ) : (
                      <span className="font-japanese">{entry.text}</span>
                    )}
                  </div>
                  
                  {/* Show translation if available */}
                  {entryTranslation?.success && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                      <span className="text-blue-700 font-medium">Translation:</span>
                      <p className="text-gray-700 mt-1">{entryTranslation.translation}</p>
                    </div>
                  )}

                  {/* Show grammar explanation if available */}
                  {getCurrentGrammarExplanation(entry.text)?.success && (
                    <div className="mt-2 p-2 bg-green-50 rounded text-xs">
                      <span className="text-green-700 font-medium">Grammar:</span>
                      <div className="max-h-32 overflow-y-auto mt-1">
                        <div className="text-gray-700 prose prose-xs max-w-none">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h2: ({...props}) => <h4 className="text-sm font-semibold mt-2 mb-1 text-green-800" {...props} />,
                              h3: ({...props}) => <h5 className="text-xs font-medium mt-1 mb-1 text-green-700" {...props} />,
                              p: ({...props}) => <p className="text-xs mb-1" {...props} />,
                              ul: ({...props}) => <ul className="list-disc pl-3 mb-1 text-xs" {...props} />,
                              strong: ({...props}) => <strong className="font-medium text-green-900" {...props} />,
                              code: ({...props}) => <code className="bg-green-100 px-1 rounded text-xs font-mono" {...props} />
                            }}
                          >
                            {getCurrentGrammarExplanation(entry.text)?.explanation || ''}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-600">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(entry.text);
                        }}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors duration-200 font-medium"
                        title="Copy"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          translateText(entry.text);
                        }}
                        className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors duration-200 font-medium"
                        title="Translate"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          explainGrammar(entry.text);
                        }}
                        className="px-2 py-1 text-xs bg-rose-100 text-rose-700 rounded hover:bg-rose-200 transition-colors duration-200 font-medium"
                        title="Grammar"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          generateFurigana(entry.text);
                        }}
                        className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors duration-200 font-medium"
                        title="Furigana"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18m0 0l-4-4m4 4l4-4" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          createFlashcard(entry.text);
                        }}
                        className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors duration-200 font-medium"
                        title="Add Flashcard"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Flashcard Modal */}
      <FlashcardModal
        isOpen={isFlashcardModalOpen}
        onClose={() => setIsFlashcardModalOpen(false)}
        initialText={flashcardText}
        initialBack={flashcardBack}
        initialFurigana={flashcardFurigana}
        initialNotes={flashcardNotes}
        initialGrammar={flashcardGrammar}
        onFlashcardSaved={handleFlashcardSaved}
      />
    </div>
  );
}
