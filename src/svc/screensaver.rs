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
use tokio::{sync::{mpsc, RwLock}, time::sleep};
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
    reset_timer_tx: Arc<RwLock<Option<mpsc::UnboundedSender<()>>>>,
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
            reset_timer_tx: Arc::new(RwLock::new(None)),
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
        let (reset_tx, mut reset_rx) = mpsc::unbounded_channel();
        
        // Store the sender so other methods can reset the timer
        {
            let mut tx_guard = self.reset_timer_tx.write().await;
            *tx_guard = Some(reset_tx);
        }

        loop {
            let current_interval = self.state.read().await.interval_seconds;
            
            tokio::select! {
                // Normal timer expiration
                _ = sleep(Duration::from_secs(current_interval)) => {
                    if self.is_running.load(Ordering::Relaxed) {
                        if let Err(e) = self.advance_to_next_image().await {
                            error!("Failed to advance screensaver: {}", e);
                        }
                    }
                }
                // Timer reset signal (from new upload or manual advance)
                _ = reset_rx.recv() => {
                    // Timer was reset, continue the loop with a fresh timer
                    continue;
                }
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

            // Reset the timer after manually advancing
            self.reset_timer().await;
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

            // Reset the timer after manually going to previous
            self.reset_timer().await;
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
            
            {
                let mut state = self.state.write().await;
                state.current_index = 0;
                state.upload_count = upload_count;
            }

            // Reset the timer so the next image won't appear for a full interval
            self.reset_timer().await;
        }
        
        Ok(())
    }

    /// Reset the slideshow timer
    async fn reset_timer(&self) {
        if let Some(tx) = &*self.reset_timer_tx.read().await {
            // Send reset signal (ignore if channel is closed)
            let _ = tx.send(());
        }
    }
}

impl Clone for ScreensaverSvc {
    fn clone(&self) -> Self {
        Self {
            state: Arc::clone(&self.state),
            is_running: Arc::clone(&self.is_running),
            current_index: Arc::clone(&self.current_index),
            context: Arc::clone(&self.context),
            reset_timer_tx: Arc::clone(&self.reset_timer_tx),
        }
    }
}