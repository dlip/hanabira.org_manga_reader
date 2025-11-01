// JMDict API integration for Japanese dictionary lookup
export interface JMDictEntry {
  word: string;
  reading: string;
  meanings: string[];
  jlpt?: number;
  frequency?: number;
  partOfSpeech?: string[];
}

export interface DictionaryResult {
  word: string;
  entries: JMDictEntry[];
}

export class DictionaryService {
  private static readonly JISHO_API = 'https://jisho.org/api/v1/search/words';
  private static readonly CACHE_KEY = 'dictionary_cache';
  private static cache = new Map<string, DictionaryResult>();

  static async lookupWord(word: string): Promise<DictionaryResult | null> {
    // Check cache first
    if (this.cache.has(word)) {
      console.log('Dictionary cache hit:', word);
      return this.cache.get(word)!;
    }

    console.log('Looking up word:', word);

    try {
      const url = `${this.JISHO_API}?keyword=${encodeURIComponent(word)}`;
      console.log('Fetching from URL:', url);
      
      const response = await fetch(url);
      if (!response.ok) {
        console.error('API request failed:', response.status, response.statusText);
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Jisho API response:', data);
      
      if (!data.data || data.data.length === 0) {
        console.log('No data found for word:', word);
        return null;
      }

      console.log('First result:', data.data[0]);

      const result: DictionaryResult = {
        word,
        entries: data.data.slice(0, 3).map((item: {
          slug?: string;
          japanese?: Array<{ word?: string; reading?: string }>;
          senses?: Array<{
            english_definitions?: string[];
            parts_of_speech?: string[];
          }>;
          tags?: string[];
        }) => {
          console.log('Processing item:', item);
          
          // Handle JLPT tags correctly
          const jlptTags = item.tags?.filter((tag: string) => tag.startsWith('jlpt-')) || [];
          console.log('JLPT tags:', jlptTags);
          
          return {
            word: item.slug || word,
            reading: item.japanese?.[0]?.reading || item.japanese?.[0]?.word || word,
            meanings: item.senses?.[0]?.english_definitions || [],
            jlpt: this.extractJLPTLevel(jlptTags),
            frequency: jlptTags.length > 0 ? this.getFrequencyFromJLPT(this.extractJLPTLevel(jlptTags)) : undefined,
            partOfSpeech: item.senses?.[0]?.parts_of_speech || []
          };
        })
      };

      console.log('Processed result:', result);

      // Cache the result
      this.cache.set(word, result);
      this.saveCache();

      return result;
    } catch (error) {
      console.error('Dictionary lookup error:', error);
      return null;
    }
  }

  private static extractJLPTLevel(jlptArray: string[]): number | undefined {
    if (!jlptArray || jlptArray.length === 0) return undefined;
    
    for (const level of jlptArray) {
      const match = level.match(/jlpt-n(\d)/);
      if (match) {
        return parseInt(match[1]);
      }
    }
    return undefined;
  }

  private static getFrequencyFromJLPT(jlptLevel?: number): number {
    if (!jlptLevel) return 0;
    // Convert JLPT level to frequency score (N5 = most common, N1 = least common)
    return 6 - jlptLevel;
  }

  static loadCache(): void {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        this.cache = new Map(Object.entries(data));
      }
    } catch (error) {
      console.error('Error loading dictionary cache:', error);
    }
  }

  private static saveCache(): void {
    try {
      const data = Object.fromEntries(this.cache.entries());
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving dictionary cache:', error);
    }
  }

  static clearCache(): void {
    this.cache.clear();
    localStorage.removeItem(this.CACHE_KEY);
  }

  // Initialize cache on service load
  static {
    this.loadCache();
  }
}
