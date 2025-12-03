import Button from 'components/Button';
import { useEffect, useState, useRef, useCallback, ChangeEvent } from 'react';
import { useDropzone } from 'react-dropzone';
import { ReactSketchCanvas, ReactSketchCanvasRef } from 'react-sketch-canvas';
// Import the default initialization function and the specific Rust functions
import init, { preview, greet } from 'wasm-image-preview';

const WasmImagePreview = () => {
  const [isWasmLoaded, setIsWasmLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'draw' | 'upload'>('draw');
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
  const [eraseMode, setEraseMode] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [eraserWidth, setEraserWidth] = useState(10);
  const [cropArea, setCropArea] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasDrawRef = useRef<ReactSketchCanvasRef>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleEraserClick = () => {
    setEraseMode(true);
    canvasDrawRef.current?.eraseMode(true);
  };

  const handlePenClick = () => {
    setEraseMode(false);
    canvasDrawRef.current?.eraseMode(false);
  };

  const handleStrokeWidthChange = (event: ChangeEvent<HTMLInputElement>) => {
    setStrokeWidth(+event.target.value);
  };

  const handleEraserWidthChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEraserWidth(+event.target.value);
  };

  // Constants
  const DISPLAY_WIDTH = 128;
  const DISPLAY_HEIGHT = 64;

  // 1. Initialize Wasm module on mount
  useEffect(() => {
    init()
      .then(() => setIsWasmLoaded(true))
      .catch((err) => {
        console.error('Error loading Wasm:', err);
        setError('Failed to load Wasm module');
      });
  }, []);

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

  // Convert canvas to image data and process through WASM
  // const processCanvasImage = async (dataString: string) => {
  //   if (!isWasmLoaded) return;
  //
  //   try {
  //     // Create a temporary canvas at the target resolution
  //     const tempCanvas = document.createElement('canvas');
  //     tempCanvas.width = DISPLAY_WIDTH;
  //     tempCanvas.height = DISPLAY_HEIGHT;
  //     const tempCtx = tempCanvas.getContext('2d');
  //     if (!tempCtx) return;
  //
  //     // Draw the source canvas to the temporary canvas, scaled down
  //     tempCtx.drawImage(dataString, 0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
  //
  //     // Convert canvas to PNG blob, then to array buffer for WASM
  //     tempCanvas.toBlob(async (blob) => {
  //       if (!blob) return;
  //
  //       const arrayBuffer = await blob.arrayBuffer();
  //       const uint8Array = new Uint8Array(arrayBuffer);
  //
  //       // Process through WASM with actual PNG data
  //       const packedResult = preview(uint8Array);
  //       drawPackedImage(packedResult);
  //     }, 'image/png');
  //   } catch (err) {
  //     console.error('Error processing canvas:', err);
  //     setError('Error processing drawing');
  //   }
  // };

  // Handle drawing canvas changes
  const handleDrawingChange = async () => {
    if (!canvasDrawRef.current || !isWasmLoaded) return;

    const dataURL = await canvasDrawRef.current.exportImage('jpeg');
    // 1. Split the Data URL to separate the metadata from the base64 data.
    // The format is typically "data:[<mediatype>][;base64],<data>"
    const parts = dataURL.split(',');
    const base64Data = parts[1]; // Get the base64 encoded data part

    // 2. Decode the base64 string into a binary string.
    // `atob()` is used for base64 decoding in browsers.
    const binaryString = atob(base64Data);

    // 3. Create a Uint8Array from the binary string.
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    if (!isWasmLoaded) return;

    // Process through WASM with actual PNG data
    const packedResult = preview(bytes);
    drawPackedImage(packedResult);
  };

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      setUploadedImage(img);
      setCropArea(null);
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
        console.log('Canvas found:', canvas.width, 'x', canvas.height);
        console.log('Image loaded:', uploadedImage.width, 'x', uploadedImage.height);

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

        console.log('Drawing image at:', offsetX, offsetY, 'size:', drawWidth, drawHeight);
        ctx.drawImage(uploadedImage, offsetX, offsetY, drawWidth, drawHeight);
      } else {
        console.error('Could not get canvas context');
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

  // Handle crop area selection
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = imageCanvasRef.current;
    if (!canvas || !uploadedImage) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setCropArea({ x, y, width: 0, height: 0 });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !cropArea) return;

    const canvas = imageCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

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
  };

  const handleCanvasMouseUp = () => {
    setIsDrawing(false);

    if (cropArea && cropArea.width != 0 && cropArea.height != 0) {
      processCroppedImage();
    }
  };

  const processCroppedImage = async () => {
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
        drawPackedImage(packedResult);
      }, 'image/png');
    } catch (err) {
      console.error('Error processing cropped image:', err);
      setError('Error processing cropped image');
    }
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
  console.log(cropArea);
  console.log('Crop area style:', style);

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">ESP32 Display Preview</h1>

        {!isWasmLoaded && (
          <div className="bg-blue-900 border border-blue-700 rounded-md p-4 mb-6">
            <p className="text-blue-200">Loading WASM module...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900 border border-red-700 rounded-md p-4 mb-6">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('draw')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'draw'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              Draw Mode
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upload'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              Upload Mode
            </button>
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {activeTab === 'draw' && (
              <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Drawing Canvas</h2>
                <p className="text-gray-300 mb-4">
                  Draw on the canvas below. Your drawing will be processed in real-time to show how
                  it would appear on the 128x64 OLED display.
                </p>
                <div className="flex flex-column gap-2 p-2">
                  <h1>Tools</h1>
                  <div className="flex gap-2 align-items-center">
                    <Button disabled={!eraseMode} onClick={handlePenClick}>
                      Pen
                    </Button>
                    <Button
                      className="btn btn-sm btn-outline-primary"
                      disabled={eraseMode}
                      onClick={handleEraserClick}
                    >
                      Eraser
                    </Button>
                    <label htmlFor="strokeWidth" className="form-label">
                      Stroke width
                    </label>
                    <input
                      disabled={eraseMode}
                      type="range"
                      className="form-range"
                      min="1"
                      max="20"
                      step="1"
                      id="strokeWidth"
                      value={strokeWidth}
                      onChange={handleStrokeWidthChange}
                    />
                    <label htmlFor="eraserWidth" className="form-label">
                      Eraser width
                    </label>
                    <input
                      disabled={!eraseMode}
                      type="range"
                      className="form-range"
                      min="1"
                      max="20"
                      step="1"
                      id="eraserWidth"
                      value={eraserWidth}
                      onChange={handleEraserWidthChange}
                    />
                  </div>
                </div>
                <div className="border-2 border-gray-600 rounded-lg p-4 bg-gray-900">
                  <ReactSketchCanvas
                    ref={canvasDrawRef}
                    strokeWidth={strokeWidth}
                    eraserWidth={eraserWidth}
                    width={'512px'}
                    height={'256px'}
                    strokeColor="#FFFFFF"
                    canvasColor="#000000"
                    onChange={handleDrawingChange}
                    className="border border-gray-600 bg-black"
                    style={{ touchAction: 'none' }}
                  />
                  {/* <CanvasDraw */}
                  {/*   ref={canvasDrawRef} */}
                  {/*   canvasWidth={DRAW_CANVAS_WIDTH} */}
                  {/*   canvasHeight={DRAW_CANVAS_HEIGHT} */}
                  {/*   brushRadius={2} */}
                  {/*   brushColor="#ffffff" */}
                  {/*   backgroundColor="#000000" */}
                  {/*   onChange={handleDrawingChange} */}
                  {/*   disabled={!isWasmLoaded} */}
                  {/*   className="border border-gray-600 bg-black" */}
                  {/* /> */}
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => canvasDrawRef.current?.clearCanvas()}
                    className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!isWasmLoaded}
                  >
                    Clear Canvas
                  </button>
                  <button
                    onClick={() => canvasDrawRef.current?.undo()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!isWasmLoaded}
                  >
                    Undo
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'upload' && (
              <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Upload & Crop Image</h2>

                {!uploadedImage ? (
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                      isDragActive
                        ? 'border-blue-400 bg-blue-900'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <div className="mx-auto w-16 h-16 mb-4 text-gray-500">
                      <svg
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                      >
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
                        <p className="text-white font-medium mb-2">
                          Drop an image here, or click to select
                        </p>
                        <p className="text-gray-400 text-sm">Supports JPG, PNG, GIF, BMP, WebP</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-300 mb-4">
                      Click and drag to select a crop area. The crop frame can be 2:1 (landscape) or
                      1:2 (portrait) aspect ratio to match your OLED display orientation.
                    </p>

                    <div className="relative inline-block border-2 border-gray-600 rounded-lg bg-gray-900 p-2">
                      <canvas
                        ref={imageCanvasRef}
                        width={400}
                        height={300}
                        className="cursor-crosshair bg-gray-800"
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
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
                        }}
                        className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
                      >
                        Upload Different Image
                      </button>
                      <button
                        onClick={processCroppedImage}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!cropArea}
                      >
                        Process Crop
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-1">
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

              {/* Test WASM Button */}
              <div className="mt-6 pt-4 border-t border-gray-700">
                <button
                  onClick={() => greet('React User')}
                  className="w-full px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!isWasmLoaded}
                >
                  Test WASM Connection
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WasmImagePreview;
