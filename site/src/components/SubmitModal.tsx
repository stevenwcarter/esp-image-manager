import { useState } from 'react';
import Button from 'components/Button';

interface SubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (message: string, isPublic: boolean) => void;
  getPreviewImageData?: () => ImageData | null;
}

const SubmitModal = ({ isOpen, onClose, onSubmit, getPreviewImageData }: SubmitModalProps) => {
  const [message, setMessage] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(message.trim(), isPublic);
      // Reset form after successful submission
      setMessage('');
      setIsPublic(false);
      onClose();
    } catch (error) {
      console.error('Submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setMessage('');
      setIsPublic(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Submit Image</h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-200 text-xl disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {/* Preview */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Preview</h3>
          <div className="flex justify-center bg-black p-4 rounded-lg">
            <canvas
              width={128}
              height={64}
              className="border border-gray-600 bg-black"
              style={{
                imageRendering: 'pixelated',
                width: '256px',
                height: '128px',
              }}
              ref={(canvas) => {
                if (canvas && getPreviewImageData) {
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    const imageData = getPreviewImageData();
                    if (imageData) {
                      ctx.putImageData(imageData, 0, 0);
                    }
                  }
                }
              }}
            />
          </div>
          <div className="text-center mt-2">
            <span className="text-xs text-gray-400">128 × 64 pixels</span>
          </div>
        </div>

        {/* Message Input */}
        <div className="mb-4">
          <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">
            Message
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter a description for your image..."
            rows={3}
            disabled={isSubmitting}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        {/* Public Gallery Checkbox */}
        <div className="mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              disabled={isSubmitting}
              className="mr-2 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50"
            />
            <span className="text-sm text-gray-300">Show in public gallery</span>
          </label>
          <p className="text-xs text-gray-400 mt-1">
            When enabled, your image will be visible to other users
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!message.trim() || isSubmitting}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SubmitModal;
