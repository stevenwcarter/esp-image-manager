import { useEffect, useState, useRef } from 'react';
// Import the default initialization function and the specific Rust functions
import init, { preview, greet } from 'wasm-image-preview';

const WasmImagePreview = () => {
  const [isWasmLoaded, setIsWasmLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 1. Initialize Wasm module on mount
  useEffect(() => {
    init()
      .then(() => setIsWasmLoaded(true))
      .catch((err) => {
        console.error('Error loading Wasm:', err);
        setError('Failed to load Wasm module');
      });
  }, []);

  // 2. Handle File Selection
  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !isWasmLoaded) return;

    try {
      // Read file as an ArrayBuffer
      const buffer = await file.arrayBuffer();
      // Convert to Uint8Array (required by Rust Vec<u8>)
      const data = new Uint8Array(buffer);

      // 3. Call the Rust function
      // This returns the packed bits (1 bit per pixel)
      const packedResult = preview(data);

      // 4. Draw to Canvas
      drawPackedImage(packedResult);
    } catch (err) {
      console.error(err);
      setError('Error processing image');
    }
  };

  // Helper: Unpack 1-bit data to RGBA for Canvas
  const drawPackedImage = (packedData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Constants from your Rust code
    const WIDTH = 128;
    const HEIGHT = 64;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.createImageData(WIDTH, HEIGHT);

    let pixelIndex = 0;

    // Iterate through every byte in the packed buffer
    for (const byte of packedData) {
      // Iterate through 8 bits per byte (from MSB to LSB)
      for (let bit = 7; bit >= 0; bit--) {
        // Stop if we exceed expected pixels
        if (pixelIndex >= WIDTH * HEIGHT) break;

        // Check if the specific bit is set
        const isWhite = (byte >> bit) & 1;

        // Calculate position in the Canvas ImageData (4 bytes per pixel: R, G, B, A)
        const dataIndex = pixelIndex * 4;

        // Set pixel color based on bit (0 = Black, 1 = White)
        const color = isWhite ? 0 : 255; // Note: In your Rust logic, < 128.0 became 1.
        // Usually 1 is white, 0 is black. Adjust if inverted.

        imageData.data[dataIndex] = color; // R
        imageData.data[dataIndex + 1] = color; // G
        imageData.data[dataIndex + 2] = color; // B
        imageData.data[dataIndex + 3] = 255; // Alpha (Opaque)

        pixelIndex++;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Wasm Image Processor</h1>

      {!isWasmLoaded && <p>Loading Wasm module...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => greet('React User')}>Test Greet</button>
      </div>

      <input type="file" accept="image/*" onChange={handleFileChange} disabled={!isWasmLoaded} />

      <div style={{ marginTop: '20px' }}>
        <p>Output (128x64):</p>
        <canvas
          ref={canvasRef}
          width={128}
          height={64}
          style={{ border: '1px solid #ccc', imageRendering: 'pixelated', width: '256px' }}
        />
      </div>
    </div>
  );
};

export default WasmImagePreview;
