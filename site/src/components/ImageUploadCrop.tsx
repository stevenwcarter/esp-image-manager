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
  const [aspectRatioLocked, setAspectRatioLocked] = useState(true);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const cropAreaRef = useRef<CropArea | null>(null);

  // Constants
  // const DISPLAY_WIDTH = 128;
  // const DISPLAY_HEIGHT = 64;

  // Throttle preview updates to at most once per 100ms
  const lastUpdateTime = useRef<number>(0);

  // Keep ref in sync with state
  useEffect(() => {
    cropAreaRef.current = cropArea;
  }, [cropArea]);

  const processFullImage = useCallback(async () => {
    if (!uploadedImage || !isWasmLoaded) return;

    try {
      if (!imageCanvasRef.current) {
        return;
      }

      // Convert canvas to PNG blob, then to array buffer for WASM
      imageCanvasRef.current.toBlob(async (blob) => {
        if (!blob) return;

        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Process through WASM with actual PNG data - let WASM handle padding
        const packedResult = preview(uint8Array);
        onImageProcessed(packedResult);
      }, 'image/png');
    } catch (err) {
      console.error('Error processing full image:', err);
      setError('Error processing full image');
    }
  }, [uploadedImage, isWasmLoaded, preview, onImageProcessed]);

  const processCroppedImage = useCallback(async () => {
    const currentCropArea = cropAreaRef.current;
    if (!uploadedImage || !currentCropArea || !isWasmLoaded) return;

    const canvas = imageCanvasRef.current;
    if (!canvas) return;

    try {
      // Calculate how the image is displayed in the canvas (same logic as useEffect)
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

      // Convert canvas crop coordinates to original image coordinates
      const grabX =
        currentCropArea.width < 0 ? currentCropArea.x + currentCropArea.width : currentCropArea.x;
      const grabY =
        currentCropArea.height < 0 ? currentCropArea.y + currentCropArea.height : currentCropArea.y;
      const grabWidth = Math.abs(currentCropArea.width);
      const grabHeight = Math.abs(currentCropArea.height);

      // Convert canvas coordinates to image coordinates
      const scaleX = uploadedImage.width / drawWidth;
      const scaleY = uploadedImage.height / drawHeight;

      const imgCropX = (grabX - offsetX) * scaleX;
      const imgCropY = (grabY - offsetY) * scaleY;
      const imgCropWidth = grabWidth * scaleX;
      const imgCropHeight = grabHeight * scaleY;

      // Clamp coordinates to image boundaries
      const clampedX = Math.max(0, Math.min(imgCropX, uploadedImage.width));
      const clampedY = Math.max(0, Math.min(imgCropY, uploadedImage.height));
      const clampedWidth = Math.max(1, Math.min(imgCropWidth, uploadedImage.width - clampedX));
      const clampedHeight = Math.max(1, Math.min(imgCropHeight, uploadedImage.height - clampedY));

      // Create a canvas with the cropped portion at original resolution
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = clampedWidth;
      tempCanvas.height = clampedHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      // Draw the cropped portion from the original image (not scaled)
      tempCtx.drawImage(
        uploadedImage,
        clampedX,
        clampedY,
        clampedWidth,
        clampedHeight, // source crop from original image
        0,
        0,
        clampedWidth,
        clampedHeight, // destination on temp canvas
      );

      // Convert canvas to PNG blob, then to array buffer for WASM
      tempCanvas.toBlob(async (blob) => {
        if (!blob) return;

        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Process through WASM with actual PNG data - let WASM handle scaling/padding
        const packedResult = preview(uint8Array);
        onImageProcessed(packedResult);
      }, 'image/png');
    } catch (err) {
      console.error('Error processing cropped image:', err);
      setError('Error processing cropped image');
    }
  }, [uploadedImage, isWasmLoaded, preview, onImageProcessed]);

  // Throttled preview update function
  const throttledProcessCrop = useCallback(() => {
    const now = Date.now();
    if (now - lastUpdateTime.current >= 200) {
      lastUpdateTime.current = now;
      const currentCropArea = cropAreaRef.current;
      if (currentCropArea && currentCropArea.width !== 0 && currentCropArea.height !== 0) {
        processCroppedImage();
      }
    }
  }, [processCroppedImage]);

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

  // Draw uploaded image on canvas when it changes and process full image
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

        // Process the full image for preview when first loaded
        setTimeout(() => processFullImage(), 0);
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

    let newWidth: number, newHeight: number;

    if (aspectRatioLocked) {
      // Determine if we should use 2:1 or 1:2 aspect ratio based on drag direction
      // Use absolute values to determine aspect ratio, then preserve individual signs
      const absWidth = Math.abs(width);
      const absHeight = Math.abs(height);
      const widthSign = Math.sign(width);
      const heightSign = Math.sign(height);

      if (absWidth > absHeight) {
        // Landscape: maintain 2:1 ratio (width is dominant)
        newWidth = widthSign * absWidth;
        newHeight = heightSign * (absWidth / 2);
      } else {
        // Portrait: maintain 1:2 ratio (height is dominant)
        newHeight = heightSign * absHeight;
        newWidth = widthSign * (absHeight / 2);
      }
    } else {
      // Free-form crop when aspect ratio is unlocked
      newWidth = width;
      newHeight = height;
    }

    setCropArea({ ...cropArea, width: newWidth, height: newHeight });
    throttledProcessCrop();
  };

  // Unified handler for ending crop area selection (mouse and touch)
  const handleCropEnd = () => {
    setIsDrawing(false);
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });

    // Ensure final state is processed with a small delay to avoid conflicts
    setTimeout(() => {
      const currentCropArea = cropAreaRef.current;
      if (currentCropArea && currentCropArea.width !== 0 && currentCropArea.height !== 0) {
        processCroppedImage();
      }
    }, 50);
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
          <div className="mb-4">
            <p className="text-gray-300 mb-2">
              Click and drag to select a crop area. Click inside an existing crop to reposition it.
            </p>
            <button
              onClick={() => setAspectRatioLocked(!aspectRatioLocked)}
              className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                aspectRatioLocked
                  ? 'bg-yellow-700 border-yellow-600 text-yellow-100 hover:bg-yellow-600'
                  : 'bg-green-700 border-green-600 text-green-100 hover:bg-green-600'
              }`}
            >
              {aspectRatioLocked ? '🔒 Aspect Ratio Locked' : '🔓 Free Crop'}
            </button>
          </div>

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
                setCropArea(null);
                processFullImage();
              }}
              className="px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-600"
              disabled={!cropArea}
            >
              Clear Crop
            </button>
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
