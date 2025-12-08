import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { useLocalStorage } from '@uidotdev/usehooks';

interface RGBImagePreviewProps {
  isWasmLoaded: boolean;
  onSubmit: () => void;
  onQuickSubmit: (name: string) => void;
}

export interface RGBImagePreviewRef {
  showJPGImage: (jpgData: Uint8Array) => void;
  getImageData: () => ImageData | null;
}

const RGBImagePreview = forwardRef<RGBImagePreviewRef, RGBImagePreviewProps>(
  ({ isWasmLoaded, onSubmit, onQuickSubmit }, ref) => {
    const [name, setName] = useLocalStorage('upload_name', '');
    const imageRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const showJPGImage = (jpgData: Uint8Array) => {
      // Create blob from JPG data
      const blob = new Blob([jpgData], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);

      if (imageRef.current) {
        imageRef.current.onload = () => URL.revokeObjectURL(url);
        imageRef.current.src = url;
      }
    };

    const getImageData = (): ImageData | null => {
      if (!imageRef.current || !canvasRef.current) return null;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Draw the image to canvas to get ImageData
      canvas.width = imageRef.current.naturalWidth || 320;
      canvas.height = imageRef.current.naturalHeight || 240;
      ctx.drawImage(imageRef.current, 0, 0);

      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    };

    useImperativeHandle(ref, () => ({
      showJPGImage,
      getImageData,
    }));

    return (
      <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">RGB 320x240 Preview</h2>

        <div className="mb-6">
          <div className="bg-black p-4 rounded flex justify-center items-center">
            <img
              ref={imageRef}
              alt="RGB Display Preview"
              className="max-w-[320px] max-h-[240px] retina:max-w-[640px] retina:max-h-[480px] border border-gray-600"
            />
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
              Name (optional)
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter a name..."
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onQuickSubmit(name || 'Untitled')}
              disabled={!isWasmLoaded}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              Quick Submit
            </button>
            <button
              onClick={onSubmit}
              disabled={!isWasmLoaded}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              Submit with Details
            </button>
          </div>
        </div>
      </div>
    );
  },
);

RGBImagePreview.displayName = 'RGBImagePreview';

export default RGBImagePreview;
