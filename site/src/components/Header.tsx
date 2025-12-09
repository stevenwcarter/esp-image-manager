import React from 'react';
import { useDisplay, DisplayType } from '../contexts/DisplayContext';

const Header: React.FC = () => {
  const { displayType, setDisplayType } = useDisplay();

  const handleDisplayChange = (newDisplayType: DisplayType) => {
    setDisplayType(newDisplayType);
  };

  return (
    <header className="bg-gray-800 border-b border-gray-700 p-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">ESP Image Manager</h1>

        <nav className="flex space-x-4">
          <button
            onClick={() => handleDisplayChange('Esp32')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              displayType === 'Esp32'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            ESP32 Display
          </button>
          <button
            onClick={() => handleDisplayChange('RGB_320x240')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              displayType === 'RGB_320x240'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            RGB 320x240
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
