import { Upload } from 'types';

interface GalleryProps {
  uploads: Upload[];
}

// Constants
const THUMBNAIL_WIDTH = 160;
const THUMBNAIL_HEIGHT = 80;

const Gallery = ({ uploads }: GalleryProps) => {
  // Format date helper
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Unknown date';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch {
      return 'Invalid date';
    }
  };

  // Get the 100 most recent uploads
  const recentUploads = uploads
    .slice()
    .sort((a, b) => {
      const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 100);

  return (
    <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6 mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Gallery</h2>
        <span className="text-sm text-gray-400">
          {recentUploads.length} of {uploads.length} uploads (most recent 100)
        </span>
      </div>

      {recentUploads.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No uploads found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
          {recentUploads.map((upload) => (
            <div
              key={upload.uuid}
              className="bg-gray-900 rounded-lg p-4 border border-gray-600 hover:border-gray-500 transition-colors min-w-0"
            >
              <div className="flex justify-center mb-3">
                <div className="bg-black p-3 rounded">
                  {upload.png ? (
                    <img
                      src={upload.png}
                      alt={`Upload ${upload.uuid}`}
                      className="border border-gray-600 bg-black"
                      style={{
                        imageRendering: 'pixelated',
                        width: `${THUMBNAIL_WIDTH}px`,
                        height: `${THUMBNAIL_HEIGHT}px`,
                      }}
                    />
                  ) : (
                    <div
                      className="border border-gray-600 bg-gray-700 flex items-center justify-center text-gray-400 text-xs"
                      style={{
                        width: `${THUMBNAIL_WIDTH}px`,
                        height: `${THUMBNAIL_HEIGHT}px`,
                      }}
                    >
                      No image
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-400 space-y-1">
                {upload.message && (
                  <div className="text-gray-300 truncate" title={upload.message}>
                    {upload.message}
                  </div>
                )}
                <div className="text-gray-500 text-[10px] leading-tight">
                  {formatDate(upload.uploadedAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Gallery;
