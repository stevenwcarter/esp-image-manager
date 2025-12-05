import { useRef, useImperativeHandle, forwardRef } from 'react';

interface DisplayPreviewProps {
  isWasmLoaded: boolean;
  onSubmit: () => void;
  onQuickSubmit: () => void;
}

export interface DisplayPreviewRef {
  drawPackedImage: (packedData: Uint8Array) => void;
  getImageData: () => ImageData | null;
}

// Constants
const DISPLAY_WIDTH = 128;
const DISPLAY_HEIGHT = 64;

const DisplayPreview = forwardRef<DisplayPreviewRef, DisplayPreviewProps>(
  ({ isWasmLoaded, onSubmit, onQuickSubmit }, ref) => {
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);

    // Helper: Unpack 1-bit data to RGBA for Canvas
    const drawPackedImage = (packedData: Uint8Array) => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const imageData = ctx.createImageData(DISPLAY_WIDTH, DISPLAY_HEIGHT);

      let pixelIndex = 0;

      // Iterate through every byte in the packed buffer
      for (const byte of packedData) {
        // Iterate through 8 bits per byte (from MSB to LSB)
        for (let bit = 7; bit >= 0; bit--) {
          // Stop if we exceed expected pixels
          if (pixelIndex >= DISPLAY_WIDTH * DISPLAY_HEIGHT) break;

          // Check if the specific bit is set
          const isWhite = (byte >> bit) & 1;

          // Calculate position in the Canvas ImageData (4 bytes per pixel: R, G, B, A)
          const dataIndex = pixelIndex * 4;

          // Set pixel color based on bit (0 = Black, 1 = White)
          const color = isWhite ? 0 : 255;

          imageData.data[dataIndex] = color; // R
          imageData.data[dataIndex + 1] = color; // G
          imageData.data[dataIndex + 2] = color; // B
          imageData.data[dataIndex + 3] = 255; // Alpha (Opaque)

          pixelIndex++;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    };

    const getImageData = (): ImageData | null => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return null;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      return ctx.getImageData(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
    };

    useImperativeHandle(ref, () => ({
      drawPackedImage,
      getImageData,
    }));

    return (
      <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6 sticky top-6">
        <h3 className="text-lg font-semibold text-white mb-4">OLED Display Preview</h3>
        <p className="text-gray-300 text-sm mb-4">
          This shows how your image will appear on the 128x64 monochrome OLED display.
        </p>

        <div className="flex justify-center">
          <div className="bg-black p-4 rounded-lg">
            <canvas
              ref={previewCanvasRef}
              width={DISPLAY_WIDTH}
              height={DISPLAY_HEIGHT}
              className="border border-gray-600 bg-black"
              style={{
                imageRendering: 'pixelated',
                width: '256px',
                height: '128px',
              }}
            />
          </div>
        </div>

        <div className="mt-4 text-center">
          <span className="text-xs text-gray-400">128 × 64 pixels</span>
        </div>

        {/* Submit Button */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <button
            onClick={onQuickSubmit}
            className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isWasmLoaded}
          >
            Quick Submit
          </button>
        </div>
        <div className="mt-6 pt-4 border-t border-gray-700">
          <button
            onClick={onSubmit}
            className="w-full px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isWasmLoaded}
          >
            Submit with Message
          </button>
        </div>
      </div>
    );
  },
);

DisplayPreview.displayName = 'DisplayPreview';

export default DisplayPreview;
