import { useRef, useState, ChangeEvent } from 'react';
import { ReactSketchCanvas, ReactSketchCanvasRef } from 'react-sketch-canvas';

interface DrawingCanvasProps {
  isWasmLoaded: boolean;
  onDrawingChange: (dataURL: string) => Promise<void>;
  displayType?: string;
}

const DrawingCanvas = ({
  isWasmLoaded,
  onDrawingChange,
  displayType = 'ESP32',
}: DrawingCanvasProps) => {
  console.log(displayType);
  const [inverted, setInverted] = useState(false);
  const [eraseMode, setEraseMode] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [eraserWidth, setEraserWidth] = useState(10);
  const canvasDrawRef = useRef<ReactSketchCanvasRef>(null);

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

  const handleDrawingChange = async () => {
    if (!canvasDrawRef.current || !isWasmLoaded) return;

    const dataURL = await canvasDrawRef.current.exportImage('jpeg');
    await onDrawingChange(dataURL);
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6">
      <h2 className="text-xl font-semibold text-white mb-4">Drawing Canvas</h2>
      <p className="text-gray-300 mb-4">
        Draw on the canvas below. Your drawing will be processed in real-time to show how it would
        appear on the selected display.
      </p>

      <div className="flex flex-column gap-2 p-2">
        <h3 className="text-white">Tools</h3>
        <div className="flex gap-2 align-items-center">
          <button
            onClick={handlePenClick}
            className="w-[70px] px-2 py-1 text-sm bg-gray-700 text-white rounded-md hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!eraseMode}
          >
            Pen
          </button>
          <button
            onClick={handleEraserClick}
            className="w-[70px] px-2 py-1 text-sm bg-gray-700 text-white rounded-md hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={eraseMode}
          >
            Eraser
          </button>
          <label htmlFor="strokeWidth" className="form-label text-white">
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
          <label htmlFor="eraserWidth" className="form-label text-white">
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
          strokeColor={inverted ? '#000000' : '#FFFFFF'}
          canvasColor={inverted ? '#FFFFFF' : '#000000'}
          onChange={handleDrawingChange}
          className="border border-gray-600 bg-black"
          style={{ touchAction: 'none' }}
        />
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
        <button
          onClick={() => canvasDrawRef.current?.redo()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!isWasmLoaded}
        >
          Redo
        </button>
        <button
          onClick={() => {
            canvasDrawRef.current?.clearCanvas();
            setInverted(!inverted);
          }}
          className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!isWasmLoaded}
        >
          Invert Colors
        </button>
      </div>
    </div>
  );
};

export default DrawingCanvas;
