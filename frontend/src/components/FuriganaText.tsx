'use client';

import React from 'react';

export interface FuriganaPair {
  kanji?: string;
  reading?: string;
  text?: string;
}

interface FuriganaTextProps {
  furiganaPairs: FuriganaPair[];
  className?: string;
  showFurigana?: boolean;
}

export default function FuriganaText({ 
  furiganaPairs, 
  className = '', 
  showFurigana = true 
}: FuriganaTextProps) {
  return (
    <span className={`font-japanese ${className}`}>
      {furiganaPairs.map((pair, index) => {
        if (pair.kanji && pair.reading && showFurigana) {
          return (
            <ruby key={index} className="ruby-text">
              {pair.kanji}
              <rt className="furigana-reading text-xs text-gray-600">{pair.reading}</rt>
            </ruby>
          );
        } else if (pair.kanji && pair.reading && !showFurigana) {
          return <span key={index}>{pair.kanji}</span>;
        } else {
          return <span key={index}>{pair.text || ''}</span>;
        }
      })}
    </span>
  );
}

export interface FuriganaData {
  success: boolean;
  furigana?: FuriganaPair[];
  original_text?: string;
  error?: string;
}