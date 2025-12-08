import React, { createContext, useContext, useState, ReactNode } from 'react';

export type DisplayType = 'ESP32' | 'RGB320x240';

interface DisplayContextType {
  displayType: DisplayType;
  setDisplayType: (type: DisplayType) => void;
}

const DisplayContext = createContext<DisplayContextType | undefined>(undefined);

interface DisplayProviderProps {
  children: ReactNode;
}

export const DisplayProvider: React.FC<DisplayProviderProps> = ({ children }) => {
  const [displayType, setDisplayType] = useState<DisplayType>('RGB320x240'); // Default to RGB320x240

  return (
    <DisplayContext.Provider value={{ displayType, setDisplayType }}>
      {children}
    </DisplayContext.Provider>
  );
};

export const useDisplay = (): DisplayContextType => {
  const context = useContext(DisplayContext);
  if (!context) {
    throw new Error('useDisplay must be used within a DisplayProvider');
  }
  return context;
};
