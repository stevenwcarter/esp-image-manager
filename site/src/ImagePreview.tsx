import { useUploads } from 'hooks/useUploads';
import { useEffect, useState, useRef } from 'react';
import { useDisplay } from 'contexts/DisplayContext';
// Import the default initialization function and the specific Rust functions
import init, { preview, preview_rgb } from 'wasm-image-preview';

// Component imports
import DrawingCanvas from 'components/DrawingCanvas';
import ImageUploadCrop from 'components/ImageUploadCrop';
import DisplayPreview, { DisplayPreviewRef } from 'components/DisplayPreview';
import RGBImagePreview, { RGBImagePreviewRef } from 'components/RGBImagePreview';
import SubmitModal from 'components/SubmitModal';
import Gallery from 'components/Gallery';

const WasmImagePreview = () => {
  const { uploads, createUpload } = useUploads();
  const { displayType } = useDisplay();
  const [uploadData, setUploadData] = useState<Uint8Array | null>(null);
  const [isWasmLoaded, setIsWasmLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'draw' | 'upload'>('upload');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const displayPreviewRef = useRef<DisplayPreviewRef>(null);
  const rgbPreviewRef = useRef<RGBImagePreviewRef>(null);

  // Get the appropriate preview function based on display type
  const getPreviewFunction = () => {
    if (displayType === 'RGB_320x240') {
      // Dynamically check for preview_rgb function
      return preview_rgb;
    }
    return preview;
  };

  const handleSubmit = () => {
    if (!isWasmLoaded || !uploadData) return;
    setIsModalOpen(true);
  };

  const handleModalSubmit = (name: string, message: string, isPublic: boolean) => {
    if (!uploadData) return;

    if (!(Uint8Array.prototype as any).toBase64) {
      (Uint8Array.prototype as any).toBase64 = function () {
        let binary = '';
        const len = this.length;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(this[i]);
        }
        return btoa(binary);
      };
    }

    // For RGB320x240 display, uploadData contains JPG data from preview_rgb
    // For ESP32 display, uploadData contains binary display data from preview
    // Both are base64 encoded for upload
    createUpload({
      name,
      message,
      data: (uploadData as any).toBase64(),
      public: isPublic,
      display: displayType,
    });
  };
  const handleQuickSubmit = (name: string) => {
    if (!uploadData) return;

    if (!(Uint8Array.prototype as any).toBase64) {
      (Uint8Array.prototype as any).toBase64 = function () {
        let binary = '';
        const len = this.length;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(this[i]);
        }
        return btoa(binary);
      };
    }

    // For RGB320x240 display, uploadData contains JPG data from preview_rgb
    // For ESP32 display, uploadData contains binary display data from preview
    // Both are base64 encoded for upload
    createUpload({
      name,
      data: (uploadData as any).toBase64(),
      public: true,
      display: displayType,
    });
  };

  // Handle drawing updates from DrawingCanvas
  const handleDrawingChange = async (dataURL: string) => {
    if (!isWasmLoaded) return;

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

    // Process through WASM with actual PNG data
    const previewFn = getPreviewFunction();
    const packedResult = await previewFn(bytes);
    if (packedResult) {
      handleImageProcessed(packedResult);
    }
  };

  // Handle processed image from both drawing and upload components
  const handleImageProcessed = (packedData: Uint8Array) => {
    setUploadData(packedData);
    if (displayType === 'Esp32') {
      // ESP32 display uses packed bits format
      displayPreviewRef.current?.drawPackedImage(packedData);
    } else {
      // RGB320x240 returns JPG data directly
      rgbPreviewRef.current?.showJPGImage(packedData);
    }
  };

  // 1. Initialize Wasm module on mount
  useEffect(() => {
    init()
      .then(() => setIsWasmLoaded(true))
      .catch((err) => {
        console.error('Error loading Wasm:', err);
        setError('Failed to load Wasm module');
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">
          {displayType === 'RGB_320x240' ? 'RGB 320x240' : 'ESP32'} Display Preview
        </h1>

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
              onClick={() => setActiveTab('upload')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upload'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              Upload Mode
            </button>
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
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {activeTab === 'draw' && (
              <DrawingCanvas
                isWasmLoaded={isWasmLoaded}
                onDrawingChange={handleDrawingChange}
                displayType={displayType}
              />
            )}

            {activeTab === 'upload' && (
              <ImageUploadCrop
                onImageProcessed={handleImageProcessed}
                isWasmLoaded={isWasmLoaded}
                preview={getPreviewFunction()}
                displayType={displayType}
              />
            )}
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-1">
            {displayType !== 'RGB_320x240' ? (
              <DisplayPreview
                ref={displayPreviewRef}
                isWasmLoaded={isWasmLoaded}
                onSubmit={handleSubmit}
                onQuickSubmit={handleQuickSubmit}
              />
            ) : (
              <RGBImagePreview
                ref={rgbPreviewRef}
                isWasmLoaded={isWasmLoaded}
                onSubmit={handleSubmit}
                onQuickSubmit={handleQuickSubmit}
              />
            )}
          </div>
        </div>

        {/* Gallery */}
        <Gallery uploads={uploads} />

        {/* Submit Modal */}
        <SubmitModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleModalSubmit}
          getPreviewImageData={() =>
            displayType === 'Esp32'
              ? displayPreviewRef.current?.getImageData() || null
              : rgbPreviewRef.current?.getImageData() || null
          }
        />
      </div>
    </div>
  );
};

export default WasmImagePreview;
