import { TranslationData } from '../types';

export interface TranslateParams {
  text: string;
  targetLanguage: string;
  mode?: 'translate' | 'enhance' | 'both';
  tone?: 'conversational' | 'professional' | 'casual';
}

export async function requestAITranslation({
  text,
  targetLanguage,
  mode = 'translate',
  tone = 'conversational',
}: TranslateParams): Promise<TranslationData> {
  try {
    const response = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        targetLanguage,
        mode,
        tone,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Server returned ${response.status}`);
    }

    const data = await response.json();
    return {
      translatedText: data.translatedText || text,
      detectedLanguage: data.detectedLanguage || 'Auto',
      targetLanguage: data.targetLanguage || targetLanguage,
      grammarNotes: data.grammarNotes,
      isEnhanced: true,
    };
  } catch (error: any) {
    console.warn('AI Translation request failed:', error);
    return {
      translatedText: text,
      detectedLanguage: 'Original',
      targetLanguage,
      grammarNotes: 'AI service unavailable. Showing original message.',
      isEnhanced: false,
    };
  }
}
