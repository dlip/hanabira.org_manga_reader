'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ContentManager } from '@/lib/content';

interface ChangeCoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  seriesId: string;
  initialImage?: string;
  onSaved?: () => void;
}

export default function ChangeCoverModal({ isOpen, onClose, seriesId, initialImage, onSaved }: ChangeCoverModalProps) {
  const [image, setImage] = useState<string | null>(initialImage ?? null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setImage(initialImage ?? null);
    setImageError(null);
  }, [initialImage, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onPaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items || []);
      const imageItem = items.find((it) => it.type.startsWith('image/'));
      if (!imageItem) return;
      const blob = imageItem.getAsFile();
      if (!blob) return;
      validateAndReadImage(new File([blob], 'pasted-image', { type: blob.type || 'image/png' }));
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [isOpen]);

  const validateAndReadImage = (file: File) => {
    setImageError(null);
    if (!file.type.startsWith('image/')) {
      setImageError('Unsupported file type. Please select an image.');
      return;
    }
    const maxBytes = 2 * 1024 * 1024; // 2MB
    if (file.size > maxBytes) {
      setImageError('Image is too large. Please choose an image under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.onerror = () => setImageError('Failed to read the image.');
    reader.readAsDataURL(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndReadImage(file);
    if (e.target) e.target.value = '';
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Pass null explicitly to remove the cover, not undefined
      const success = await ContentManager.updateSeries(seriesId, { coverImage: image ?? null });
      if (success) {
        onSaved?.();
        onClose();
      } else {
        setImageError('Failed to save cover image. Please try again.');
      }
    } catch (error) {
      console.error('Error saving cover image:', error);
      setImageError('An error occurred while saving. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = () => {
    setImage(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Change Cover Image</h2>
            <button onClick={onClose} className="text-gray-600 hover:text-gray-800 text-2xl">×</button>
          </div>

          <div className="space-y-4">
            <div className={`border-2 ${image ? 'border-green-300 bg-green-50/30' : 'border-dashed border-gray-300'} rounded-lg p-4 text-center`}>
              {image ? (
                <div className="space-y-2">
                  <div className="w-full max-w-xs mx-auto aspect-[2/3] overflow-hidden rounded-md bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="Cover preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 shadow-sm"
                      disabled={isLoading}
                    >
                      Replace Image
                    </button>
                    <button
                      type="button"
                      onClick={handleRemove}
                      className="px-3 py-2 text-sm font-medium text-red-700 border border-red-300 bg-white rounded-md hover:bg-red-50 shadow-sm"
                      disabled={isLoading}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-gray-700">
                  <p className="mb-2 font-medium">Drop an image, click to upload, or paste from clipboard (Ctrl/⌘+V).</p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 shadow-sm"
                      disabled={isLoading}
                    >
                      Choose File
                    </button>
                    <span className="text-xs font-medium text-gray-600">PNG, JPG, or WebP • Max 2MB</span>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
                disabled={isLoading}
                aria-label="Upload cover image"
                title="Upload cover image"
                placeholder=""
              />
            </div>
            {imageError && <p className="text-sm text-red-600">{imageError}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
