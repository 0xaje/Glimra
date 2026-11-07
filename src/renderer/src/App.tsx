import React, { useState, useEffect, useRef } from 'react';
import { PresentationState, CameraState } from './types';

export default function App() {
  const [presentation, setPresentation] = useState<PresentationState>({
    isLoaded: false,
    fileName: null,
    totalSlides: 0,
    currentSlide: 1,
    isFullscreen: false,
  });

  const [camera, setCamera] = useState<CameraState>({
    isActive: false,
    status: 'idle',
    faceDetected: false,
    validationMessage: 'Camera idle',
    lastGesture: null,
  });

  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem('glimra_presage_api_key') || ''
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle keyboard shortcuts for presenters
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'p' || e.key === 'P' || e.key === ' ') {
        e.preventDefault();
        toggleGesturePause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentation.currentSlide, presentation.totalSlides, camera.status]);

  const nextSlide = () => {
    setPresentation((prev) => {
      if (!prev.isLoaded || prev.currentSlide >= prev.totalSlides) return prev;
      return { ...prev, currentSlide: prev.currentSlide + 1 };
    });
  };

  const prevSlide = () => {
    setPresentation((prev) => {
      if (!prev.isLoaded || prev.currentSlide <= 1) return prev;
      return { ...prev, currentSlide: prev.currentSlide - 1 };
    });
  };

  const toggleFullscreen = async () => {
    if (window.glimraDesktop?.toggleFullscreen) {
      const isFull = await window.glimraDesktop.toggleFullscreen();
      setPresentation((prev) => ({ ...prev, isFullscreen: isFull }));
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        setPresentation((prev) => ({ ...prev, isFullscreen: true }));
      } else {
        document.exitFullscreen().catch(() => {});
        setPresentation((prev) => ({ ...prev, isFullscreen: false }));
      }
    }
  };

  const toggleGesturePause = () => {
    if (!camera.isActive) return;
    setCamera((prev) => ({
      ...prev,
      status: prev.status === 'paused' ? 'tracking' : 'paused',
      validationMessage: prev.status === 'paused' ? 'Tracking active' : 'Paused by presenter',
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Glimra currently supports standard PDF presentation decks.');
      return;
    }

    setPresentation({
      isLoaded: true,
      fileName: file.name,
      totalSlides: 1, // Will be read by PDF.js engine in M2
      currentSlide: 1,
      isFullscreen: false,
    });
  };

  const handleEnableCameraClick = () => {
    if (camera.isActive) {
      // Disable camera and release resources
      setCamera({
        isActive: false,
        status: 'idle',
        faceDetected: false,
        validationMessage: 'Camera idle',
        lastGesture: null,
      });
    } else {
      setShowPrivacyModal(true);
    }
  };

  const confirmCameraConsent = () => {
    setShowPrivacyModal(false);
    setCamera({
      isActive: true,
      status: 'initializing',
      faceDetected: false,
      validationMessage: 'Connecting to SmartSpectra...',
      lastGesture: null,
    });
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('glimra_presage_api_key', key.trim());
    setShowSettingsModal(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100vh' }}>
      {/* Primary Presenter Bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: '1px solid var(--color-border-subtle)',
          backgroundColor: 'var(--color-bg-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.01em' }}>
            Glimra
          </h1>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
            Control without a touch
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Hands-Free Camera Control Toggle */}
          <button
            onClick={handleEnableCameraClick}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              border: '1px solid var(--color-border-strong)',
              backgroundColor: camera.isActive
                ? 'var(--color-accent-subtle)'
                : 'var(--color-bg-elevated)',
              color: camera.isActive
                ? 'var(--color-accent)'
                : 'var(--color-text-primary)',
            }}
          >
            {camera.isActive ? 'Hands-free active' : 'Enable hands-free'}
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-elevated)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Settings
          </button>
        </div>
      </header>

      {/* Main Presentation Stage */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          position: 'relative',
        }}
      >
        {!presentation.isLoaded ? (
          <div
            style={{
              maxWidth: '480px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <h2 style={{ fontSize: '24px', fontWeight: 500 }}>
              Present hands-free with intentional eye gestures
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>
              Import any PDF slide deck to begin presenting. Control slides using verified
              prolonged blinks or fallback to your keyboard anytime.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,application/pdf"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                marginTop: '8px',
                padding: '10px 24px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-text-inverse)',
                fontWeight: 500,
                fontSize: '14px',
              }}
            >
              Choose PDF presentation
            </button>
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Slide Stage Canvas Area */}
            <div
              style={{
                width: '100%',
                maxWidth: '1200px',
                aspectRatio: '16 / 9',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                  {presentation.fileName}
                </p>
                <p style={{ fontSize: '20px', marginTop: '8px' }}>
                  Slide {presentation.currentSlide} of {presentation.totalSlides}
                </p>
              </div>

              {/* Gesture HUD Indicator (Top Right) */}
              {camera.isActive && (
                <div
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-bg-overlay)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor:
                        camera.status === 'tracking'
                          ? 'var(--color-signal-active)'
                          : camera.status === 'paused'
                          ? 'var(--color-signal-warning)'
                          : 'var(--color-border-strong)',
                    }}
                  />
                  <span>{camera.validationMessage}</span>
                  <button
                    onClick={toggleGesturePause}
                    style={{
                      marginLeft: '4px',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-subtle)',
                      fontSize: '11px',
                    }}
                  >
                    {camera.status === 'paused' ? 'Resume' : 'Pause'}
                  </button>
                </div>
              )}
            </div>

            {/* Presenter Slide Navigation Bar */}
            <nav
              aria-label="Presentation controls"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginTop: '16px',
              }}
            >
              <button
                onClick={prevSlide}
                disabled={presentation.currentSlide <= 1}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color:
                    presentation.currentSlide <= 1
                      ? 'var(--color-text-muted)'
                      : 'var(--color-text-primary)',
                }}
              >
                Previous
              </button>

              <span style={{ fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>
                {presentation.currentSlide} / {presentation.totalSlides}
              </span>

              <button
                onClick={nextSlide}
                disabled={presentation.currentSlide >= presentation.totalSlides}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color:
                    presentation.currentSlide >= presentation.totalSlides
                      ? 'var(--color-text-muted)'
                      : 'var(--color-text-primary)',
                }}
              >
                Next
              </button>

              <button
                onClick={toggleFullscreen}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface)',
                }}
              >
                {presentation.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              </button>
            </nav>
          </div>
        )}
      </main>

      {/* Privacy and Camera Notice Modal */}
      {showPrivacyModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="privacy-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--color-bg-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: 100,
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h2 id="privacy-title" style={{ fontSize: '18px', fontWeight: 600 }}>
              Camera access & privacy
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
              Glimra uses your camera exclusively to detect intentional eye gestures (prolonged
              blinks) to control slide transitions.
            </p>
            <ul
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: '13px',
                paddingLeft: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <li>Video frames are processed in local device memory and are never saved to disk.</li>
              <li>No video or audio is streamed to external cloud servers.</li>
              <li>The camera turns off immediately when you pause, disable, or exit.</li>
              <li>Physical keyboard shortcuts always remain functional.</li>
            </ul>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
              <button
                onClick={() => setShowPrivacyModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-elevated)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmCameraConsent}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-text-inverse)',
                  fontWeight: 500,
                }}
              >
                Enable camera control
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--color-bg-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h2 id="settings-title" style={{ fontSize: '18px', fontWeight: 600 }}>
              Settings
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label htmlFor="api-key-input" style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Presage SmartSpectra API Key
              </label>
              <input
                id="api-key-input"
                type="password"
                defaultValue={apiKey}
                placeholder="Enter your API key"
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-base)',
                  color: 'var(--color-text-primary)',
                  fontSize: '13px',
                }}
              />
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Get a developer key from physiology.presagetech.com. Stored locally on this device.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
              <button
                onClick={() => setShowSettingsModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-elevated)',
                }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById('api-key-input') as HTMLInputElement;
                  if (input) saveApiKey(input.value);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-text-inverse)',
                  fontWeight: 500,
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
