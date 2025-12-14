# ESP32 Image Manager

A full-stack image management system for ESP32 displays with automatic screensaver functionality.

## Features

- Upload and manage images for ESP32 displays
- Support for multiple display types:
  - **ESP32 (Monochrome)**: 128x64 1-bit packed data
  - **RGB320x240**: Full color JPEG data
- Automatic screensaver slideshow for RGB displays
- Real-time GraphQL API for image management and screensaver control
- Web-based image editor with drawing canvas and cropping tools

## Screensaver System

The screensaver automatically cycles through all RGB320x240 uploads at a configurable interval. It ignores the `public` flag and displays all available images for that display type.

### Configuration

Configuration is stored in the `config` database table:

```sql
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

#### Default Configuration

- `screensaver.interval`: Slideshow interval in seconds (default: 120)

### GraphQL API

#### Queries

```graphql
# Get current screensaver status
query {
  screensaverStatus {
    isRunning
    currentIndex
    uploadCount
    intervalSeconds
  }
}
```

#### Mutations

```graphql
# Pause the slideshow
mutation {
  pauseScreensaver
}

# Resume the slideshow
mutation {
  resumeScreensaver
}

# Advance to next image immediately
mutation {
  nextImage
}

# Go back to previous image
mutation {
  previousImage
}

# Set slideshow interval (seconds)
mutation {
  setScreensaverInterval(seconds: 60)
}
```

### Behavior

- **Auto-start**: Screensaver starts automatically when the server boots
- **New upload handling**: When a new RGB320x240 image is uploaded, it's immediately displayed and the slideshow resets to start from the beginning
- **Error handling**: Device communication failures are logged but don't stop the slideshow (useful when displays are offline for maintenance)
- **Display filtering**: Only cycles through uploads with `display = "RGB_320x240"`

### Logging

The screensaver uses structured logging with the `tracing` crate:

- **Info level**: Normal operations like interval changes, image displays, and service lifecycle events
- **Warn level**: Non-fatal issues like device communication failures or missing configuration
- **Error level**: Service failures that require attention

Example log output:
```
INFO screensaver: Starting screensaver service
INFO screensaver: Screensaver initialized with 120s interval, 15 RGB uploads available
INFO screensaver: Displaying image 3 of 15: "sunset_photo"
WARN screensaver: Failed to push image to device (device may be offline): Connection refused
INFO screensaver: Setting screensaver interval to 60s
```

## Development

### Database Migrations

```bash
# Create new migration
diesel migration generate migration_name

# Run migrations
diesel migration run

# Revert migrations
diesel migration revert
```

### Building

```bash
cargo build
```

### Running

```bash
# Set up environment variables
export DATABASE_URL="db/db.sqlite3"
export ESP_ENDPOINT="http://esp32-device/upload"
export ESP_RGB_ENDPOINT="http://rgb-device/upload"

# Start the server
cargo run
```

## Architecture

- **Backend**: Rust with Axum web framework and Diesel ORM
- **GraphQL**: Juniper for GraphQL server implementation  
- **Database**: SQLite with embedded migrations
- **Frontend**: React/TypeScript with WASM image processing
- **Background Tasks**: Tokio async tasks for screensaver management
