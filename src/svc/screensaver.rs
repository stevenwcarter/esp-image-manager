use crate::{
    config::ConfigSvc,
    context::GraphQLContext,
    db::get_conn,
    models::{DisplayFormat, Upload},
    schema::uploads,
    svc::upload::push_upload_to_device,
};
use anyhow::{Context, Result};
use diesel::prelude::*;
use std::{
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc,
    },
    time::Duration,
};
use tokio::{sync::RwLock, time::interval};
use tracing::{error, info, warn};

#[derive(Debug, Clone)]
pub struct ScreensaverState {
    pub is_running: bool,
    pub current_index: usize,
    pub upload_count: usize,
    pub interval_seconds: u64,
}

pub struct ScreensaverSvc {
    state: Arc<RwLock<ScreensaverState>>,
    is_running: Arc<AtomicBool>,
    current_index: Arc<AtomicUsize>,
    context: Arc<GraphQLContext>,
}

impl ScreensaverSvc {
    pub fn new(context: Arc<GraphQLContext>) -> Self {
        Self {
            state: Arc::new(RwLock::new(ScreensaverState {
                is_running: true,
                current_index: 0,
                upload_count: 0,
                interval_seconds: 120,
            })),
            is_running: Arc::new(AtomicBool::new(true)),
            current_index: Arc::new(AtomicUsize::new(0)),
            context,
        }
    }

    /// Start the screensaver background task
    pub async fn start(&self) -> Result<()> {
        info!("Starting screensaver service");

        // Load initial configuration
        let interval_seconds = ConfigSvc::get_screensaver_interval(&self.context)
            .await
            .unwrap_or_else(|e| {
                warn!("Failed to load screensaver interval, using default 120s: {}", e);
                120
            });

        // Update state
        {
            let mut state = self.state.write().await;
            state.interval_seconds = interval_seconds;
            state.upload_count = self.get_rgb_upload_count().await.unwrap_or(0);
        }

        info!(
            "Screensaver initialized with {}s interval, {} RGB uploads available",
            interval_seconds,
            self.get_rgb_upload_count().await.unwrap_or(0)
        );

        // Start the background task
        let service = self.clone();
        tokio::spawn(async move {
            service.run_slideshow().await;
        });

        Ok(())
    }

    /// Main slideshow loop
    async fn run_slideshow(&self) {
        let mut interval_timer = interval(Duration::from_secs(
            self.state.read().await.interval_seconds,
        ));

        loop {
            interval_timer.tick().await;

            if !self.is_running.load(Ordering::Relaxed) {
                continue;
            }

            if let Err(e) = self.advance_to_next_image().await {
                error!("Failed to advance screensaver: {}", e);
            }

            // Check if interval has changed and update timer
            let current_interval = self.state.read().await.interval_seconds;
            if interval_timer.period() != Duration::from_secs(current_interval) {
                info!("Updating screensaver interval to {}s", current_interval);
                interval_timer = interval(Duration::from_secs(current_interval));
            }
        }
    }

    /// Get count of RGB320x240 uploads
    async fn get_rgb_upload_count(&self) -> Result<usize> {
        let mut conn = get_conn(&self.context);
        let count = uploads::table
            .filter(uploads::display.eq(DisplayFormat::RGB320x240.as_str()))
            .count()
            .get_result::<i64>(&mut conn)
            .context("Failed to count RGB uploads")?;
        Ok(count as usize)
    }

    /// Get RGB uploads for slideshow
    async fn get_rgb_uploads(&self) -> Result<Vec<Upload>> {
        let mut conn = get_conn(&self.context);
        uploads::table
            .filter(uploads::display.eq(DisplayFormat::RGB320x240.as_str()))
            .order_by(uploads::uploaded_at.desc())
            .load::<Upload>(&mut conn)
            .context("Failed to load RGB uploads")
    }

    /// Advance to the next image in the slideshow
    pub async fn advance_to_next_image(&self) -> Result<()> {
        let uploads = self.get_rgb_uploads().await?;
        
        if uploads.is_empty() {
            warn!("No RGB uploads available for slideshow");
            return Ok(());
        }

        let current_idx = self.current_index.load(Ordering::Relaxed);
        let next_idx = (current_idx + 1) % uploads.len();
        
        if let Some(upload) = uploads.get(next_idx) {
            info!(
                "Displaying image {} of {}: {:?}",
                next_idx + 1,
                uploads.len(),
                upload.name.as_deref().unwrap_or("Untitled")
            );

            // Try to push to device, but don't fail if it's offline
            if let Err(e) = push_upload_to_device(upload).await {
                warn!("Failed to push image to device (device may be offline): {}", e);
            }

            self.current_index.store(next_idx, Ordering::Relaxed);
            
            // Update state
            {
                let mut state = self.state.write().await;
                state.current_index = next_idx;
                state.upload_count = uploads.len();
            }
        }

        Ok(())
    }

    /// Go to the previous image
    pub async fn go_to_previous_image(&self) -> Result<()> {
        let uploads = self.get_rgb_uploads().await?;
        
        if uploads.is_empty() {
            warn!("No RGB uploads available for slideshow");
            return Ok(());
        }

        let current_idx = self.current_index.load(Ordering::Relaxed);
        let prev_idx = if current_idx == 0 {
            uploads.len() - 1
        } else {
            current_idx - 1
        };
        
        if let Some(upload) = uploads.get(prev_idx) {
            info!(
                "Displaying image {} of {}: {:?}",
                prev_idx + 1,
                uploads.len(),
                upload.name.as_deref().unwrap_or("Untitled")
            );

            if let Err(e) = push_upload_to_device(upload).await {
                warn!("Failed to push image to device (device may be offline): {}", e);
            }

            self.current_index.store(prev_idx, Ordering::Relaxed);
            
            // Update state
            {
                let mut state = self.state.write().await;
                state.current_index = prev_idx;
                state.upload_count = uploads.len();
            }
        }

        Ok(())
    }

    /// Pause the slideshow
    pub async fn pause(&self) -> Result<()> {
        info!("Pausing screensaver slideshow");
        self.is_running.store(false, Ordering::Relaxed);
        
        let mut state = self.state.write().await;
        state.is_running = false;
        
        Ok(())
    }

    /// Resume the slideshow
    pub async fn resume(&self) -> Result<()> {
        info!("Resuming screensaver slideshow");
        self.is_running.store(true, Ordering::Relaxed);
        
        let mut state = self.state.write().await;
        state.is_running = true;
        
        Ok(())
    }

    /// Set the slideshow interval
    pub async fn set_interval(&self, seconds: u64) -> Result<()> {
        info!("Setting screensaver interval to {}s", seconds);
        
        ConfigSvc::set_screensaver_interval(&self.context, seconds).await
            .map_err(|e| anyhow::anyhow!("Failed to set screensaver interval: {}", e))?;
        
        let mut state = self.state.write().await;
        state.interval_seconds = seconds;
        
        Ok(())
    }

    /// Get current screensaver state
    pub async fn get_state(&self) -> ScreensaverState {
        self.state.read().await.clone()
    }

    /// Handle new upload - immediately display if it's RGB
    pub async fn on_new_upload(&self, upload: &Upload) -> Result<()> {
        if upload.display.as_deref() == Some(DisplayFormat::RGB320x240.as_str()) {
            info!("New RGB upload received, displaying immediately: {:?}", 
                  upload.name.as_deref().unwrap_or("Untitled"));
            
            // Push to device immediately
            if let Err(e) = push_upload_to_device(upload).await {
                warn!("Failed to push new upload to device: {}", e);
            }
            
            // Update upload count and reset to show the new image first
            let upload_count = self.get_rgb_upload_count().await.unwrap_or(0);
            self.current_index.store(0, Ordering::Relaxed);
            
            let mut state = self.state.write().await;
            state.current_index = 0;
            state.upload_count = upload_count;
        }
        
        Ok(())
    }
}

impl Clone for ScreensaverSvc {
    fn clone(&self) -> Self {
        Self {
            state: Arc::clone(&self.state),
            is_running: Arc::clone(&self.is_running),
            current_index: Arc::clone(&self.current_index),
            context: Arc::clone(&self.context),
        }
    }
}