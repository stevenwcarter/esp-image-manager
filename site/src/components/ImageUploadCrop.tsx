import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageUploadCropProps {
  onImageProcessed: (packedData: Uint8Array) => void;
  isWasmLoaded: boolean;
  preview: (bytes: Uint8Array) => Uint8Array;
}

const ImageUploadCrop = ({ onImageProcessed, isWasmLoaded, preview }: ImageUploadCropProps) => {
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);

  // Constants
  const DISPLAY_WIDTH = 128;
  const DISPLAY_HEIGHT = 64;

  // Throttle preview updates to at most once per 100ms
  const lastUpdateTime = useRef<number>(0);

  const processCroppedImage = useCallback(async () => {
    if (!uploadedImage || !cropArea || !isWasmLoaded) return;

    const canvas = imageCanvasRef.current;
    if (!canvas) return;

    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Get the cropped image data
      const grabX = cropArea.width < 0 ? cropArea.x + cropArea.width : cropArea.x;
      const grabY = cropArea.height < 0 ? cropArea.y + cropArea.height : cropArea.y;
      const grabWidth = Math.abs(cropArea.width);
      const grabHeight = Math.abs(cropArea.height);
      const imageData = ctx.getImageData(grabX, grabY, grabWidth, grabHeight);

      // Determine if this is a portrait or landscape crop based on aspect ratio
      const isPortrait = grabHeight > grabWidth;

      // Create a temporary canvas for the cropped area with correct orientation
      const tempCanvas = document.createElement('canvas');
      if (isPortrait) {
        // Portrait: 64x128 (will be rotated by the previewer)
        tempCanvas.width = DISPLAY_HEIGHT; // 64
        tempCanvas.height = DISPLAY_WIDTH; // 128
      } else {
        // Landscape: 128x64
        tempCanvas.width = DISPLAY_WIDTH; // 128
        tempCanvas.height = DISPLAY_HEIGHT; // 64
      }
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      // Draw the cropped data to temp canvas, scaled to display dimensions
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = grabWidth;
      croppedCanvas.height = grabHeight;
      const croppedCtx = croppedCanvas.getContext('2d');
      if (!croppedCtx) return;

      croppedCtx.putImageData(imageData, 0, 0);
      tempCtx.drawImage(croppedCanvas, 0, 0, tempCanvas.width, tempCanvas.height);

      // Convert canvas to PNG blob, then to array buffer for WASM
      tempCanvas.toBlob(async (blob) => {
        if (!blob) return;

        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Process through WASM with actual PNG data
        const packedResult = preview(uint8Array);
        onImageProcessed(packedResult);
      }, 'image/png');
    } catch (err) {
      console.error('Error processing cropped image:', err);
      setError('Error processing cropped image');
    }
  }, [uploadedImage, cropArea, isWasmLoaded, preview, onImageProcessed]);

  // Throttled preview update function
  const throttledProcessCrop = useCallback(() => {
    const now = Date.now();
    if (now - lastUpdateTime.current >= 100) {
      lastUpdateTime.current = now;
      if (cropArea && cropArea.width !== 0 && cropArea.height !== 0) {
        processCroppedImage();
      }
    }
  }, [cropArea, processCroppedImage]);

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      setUploadedImage(img);
      setCropArea(null);
      setError(null);
    };

    img.onerror = (imgError) => {
      console.error('Image failed to load:', imgError);
      setError('Failed to load image');
    };

    img.src = URL.createObjectURL(file);
  }, []);

  // Draw uploaded image on canvas when it changes
  useEffect(() => {
    if (uploadedImage && imageCanvasRef.current) {
      const canvas = imageCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Calculate dimensions to fit the image in the canvas while maintaining aspect ratio
        const canvasAspect = canvas.width / canvas.height;
        const imgAspect = uploadedImage.width / uploadedImage.height;

        let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;

        if (imgAspect > canvasAspect) {
          drawWidth = canvas.width;
          drawHeight = canvas.width / imgAspect;
          offsetX = 0;
          offsetY = (canvas.height - drawHeight) / 2;
        } else {
          drawHeight = canvas.height;
          drawWidth = canvas.height * imgAspect;
          offsetX = (canvas.width - drawWidth) / 2;
          offsetY = 0;
        }

        // Clear canvas first
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(uploadedImage, offsetX, offsetY, drawWidth, drawHeight);
      }
    }
  }, [uploadedImage]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.bmp', '.webp'],
    },
    multiple: false,
  });

  // Helper function to get coordinates from mouse or touch event
  const getEventCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const canvas = imageCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      // Touch event
      if (e.touches.length > 0) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        };
      }
      return { x: 0, y: 0 };
    } else {
      // Mouse event
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  // Unified handler for starting crop area selection (mouse and touch)
  const handleCropStart = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const canvas = imageCanvasRef.current;
    if (!canvas || !uploadedImage) return;

    // Prevent default touch behavior (scrolling, zooming)
    if ('touches' in e) {
      e.preventDefault();
    }

    const { x, y } = getEventCoordinates(e);

    // Check if clicking inside existing crop rectangle
    if (cropArea && cropArea.width !== 0 && cropArea.height !== 0) {
      const cropLeft = cropArea.width < 0 ? cropArea.x + cropArea.width : cropArea.x;
      const cropTop = cropArea.height < 0 ? cropArea.y + cropArea.height : cropArea.y;
      const cropRight = cropLeft + Math.abs(cropArea.width);
      const cropBottom = cropTop + Math.abs(cropArea.height);

      if (x >= cropLeft && x <= cropRight && y >= cropTop && y <= cropBottom) {
        // Start dragging existing crop rectangle
        setIsDragging(true);
        setDragOffset({ x: x - cropArea.x, y: y - cropArea.y });
        return;
      }
    }

    // Start creating new crop rectangle
    setIsDrawing(true);
    setCropArea({ x, y, width: 0, height: 0 });
  };

  // Unified handler for crop area movement (mouse and touch)
  const handleCropMove = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const canvas = imageCanvasRef.current;
    if (!canvas) return;

    // Prevent default touch behavior (scrolling, zooming)
    if ('touches' in e) {
      e.preventDefault();
    }

    const { x: currentX, y: currentY } = getEventCoordinates(e);

    if (isDragging && cropArea) {
      // Dragging existing crop rectangle
      const newX = currentX - dragOffset.x;
      const newY = currentY - dragOffset.y;
      setCropArea({ ...cropArea, x: newX, y: newY });
      throttledProcessCrop();
      return;
    }

    if (!isDrawing || !cropArea) return;

    const width = currentX - cropArea.x;
    const height = currentY - cropArea.y;

    // Determine if we should use 2:1 or 1:2 aspect ratio based on drag direction
    // Use absolute values to determine aspect ratio, then preserve individual signs
    const absWidth = Math.abs(width);
    const absHeight = Math.abs(height);
    const widthSign = Math.sign(width);
    const heightSign = Math.sign(height);

    let newWidth: number, newHeight: number;
    if (absWidth > absHeight) {
      // Landscape: maintain 2:1 ratio (width is dominant)
      newWidth = widthSign * absWidth;
      newHeight = heightSign * (absWidth / 2);
    } else {
      // Portrait: maintain 1:2 ratio (height is dominant)
      newHeight = heightSign * absHeight;
      newWidth = widthSign * (absHeight / 2);
    }
    setCropArea({ ...cropArea, width: newWidth, height: newHeight });
    throttledProcessCrop();
  };

  // Unified handler for ending crop area selection (mouse and touch)
  const handleCropEnd = () => {
    setIsDrawing(false);
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });

    // Ensure final state is processed
    if (cropArea && cropArea.width !== 0 && cropArea.height !== 0) {
      processCroppedImage();
    }
  };

  // Mouse event handlers (delegate to unified handlers)
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleCropStart(e);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleCropMove(e);
  };

  const handleCanvasMouseUp = () => {
    handleCropEnd();
  };

  // Touch event handlers (delegate to unified handlers)
  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    handleCropStart(e);
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    handleCropMove(e);
  };

  const handleCanvasTouchEnd = () => {
    handleCropEnd();
  };

  const style = {} as React.CSSProperties;
  if (cropArea) {
    style.width = Math.abs(cropArea.width);
    style.height = Math.abs(cropArea.height);

    // Calculate the top-left corner of the rectangle
    const rectLeft = cropArea.width < 0 ? cropArea.x + cropArea.width : cropArea.x;
    const rectTop = cropArea.height < 0 ? cropArea.y + cropArea.height : cropArea.y;

    style.left = rectLeft + 8; // 8px offset for the canvas padding
    style.top = rectTop + 8;
  }

  return (
    <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6">
      <h2 className="text-xl font-semibold text-white mb-4">Upload & Crop Image</h2>

      {error && (
        <div className="bg-red-900 border border-red-700 rounded-md p-4 mb-4">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {!uploadedImage ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-400 bg-blue-900' : 'border-gray-600 hover:border-gray-500'
          }`}
        >
          <input {...getInputProps()} />
          <div className="mx-auto w-16 h-16 mb-4 text-gray-500">
            <svg fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          {isDragActive ? (
            <p className="text-blue-400 font-medium">Drop the image here...</p>
          ) : (
            <div>
              <p className="text-white font-medium mb-2">Drop an image here, or click to select</p>
              <p className="text-gray-400 text-sm">Supports JPG, PNG, GIF, BMP, WebP</p>
            </div>
          )}
        </div>
      ) : (
        <div>
          <p className="text-gray-300 mb-4">
            Click and drag to select a crop area. Click inside an existing crop to reposition it.
          </p>

          <div className="relative inline-block border-2 border-gray-600 rounded-lg bg-gray-900 p-2">
            <canvas
              ref={imageCanvasRef}
              width={300}
              height={150}
              className="cursor-crosshair bg-gray-800"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onTouchStart={handleCanvasTouchStart}
              onTouchMove={handleCanvasTouchMove}
              onTouchEnd={handleCanvasTouchEnd}
              style={{ touchAction: 'none' }}
            />

            {cropArea && cropArea.width != 0 && cropArea.height != 0 && (
              <div
                className="absolute border-2 border-blue-500 bg-blue-200/30 pointer-events-none"
                style={style}
              />
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                setUploadedImage(null);
                setCropArea(null);
                setError(null);
              }}
              className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
            >
              Clear Image
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploadCrop;
