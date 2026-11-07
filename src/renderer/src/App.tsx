import React, { useState, useEffect, useRef } from 'react';
import { PresentationState, CameraState, GestureFeedback } from './types';
import { loadPresentationFromBuffer, PresentationDocument } from './engine/pdfEngine';
import { SlideViewer } from './components/SlideViewer';
import { SmartSpectraController } from './engine/smartSpectraController';
import { PresenterHUD } from './components/PresenterHUD';

export default function App() {
  const [presentation, setPresentation] = useState<PresentationState>({
    isLoaded: false,
    fileName: null,
    totalSlides: 0,
    currentSlide: 1,
    isFullscreen: false,
  });

  const [pdfDoc, setPdfDoc] = useState<PresentationDocument | null>(null);
  const [isLoadingDeck, setIsLoadingDeck] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [camera, setCamera] = useState<CameraState>({
    isActive: false,
    status: 'idle',
    faceDetected: false,
    validationMessage: 'Camera idle',
    lastGesture: null,
  });

  const [chargeRatio, setChargeRatio] = useState(0);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem('glimra_presage_api_key') || ''
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<SmartSpectraController | null>(null);

  // Initialize SmartSpectra controller once
  useEffect(() => {
    controllerRef.current = new SmartSpectraController({
      onNextSlide: () => nextSlide(),
      onPrevSlide: () => prevSlide(),
      onStreamAvailable: (stream) => setVideoStream(stream),
      onStatusChange: (status) => setCamera((prev) => ({ ...prev, status })),
      onValidationChange: (validationMessage, faceDetected) =>
        setCamera((prev) => ({ ...prev, validationMessage, faceDetected })),
      onGestureDetected: (feedback: GestureFeedback) => {
        setCamera((prev) => ({ ...prev, lastGesture: feedback }));
      },
      onChargeProgress: (ratio) => setChargeRatio(ratio),
      onError: (_code, message) => {
        setCamera((prev) => ({
          ...prev,
          status: 'error',
          validationMessage: message,
        }));
      },
    });

    return () => {
      controllerRef.current?.stop();
    };
  }, []);

  // Presenter keyboard shortcuts
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
  }, [presentation.currentSlide, presentation.totalSlides, camera.status, presentation.isLoaded]);

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
    if (!camera.isActive || !controllerRef.current) return;
    const willPause = camera.status !== 'paused';
    controllerRef.current.setPaused(willPause);
  };

  const loadPdfData = async (buffer: ArrayBuffer, name: string) => {
    try {
      setIsLoadingDeck(true);
      setLoadError(null);

      // Clean up previous presentation document
      if (pdfDoc) {
        pdfDoc.destroy();
        setPdfDoc(null);
      }

      const doc = await loadPresentationFromBuffer(buffer);
      setPdfDoc(doc);
      setPresentation({
        isLoaded: true,
        fileName: name,
        totalSlides: doc.numPages,
        currentSlide: 1,
        isFullscreen: false,
      });
    } catch (err: any) {
      console.error('[Glimra] Failed to load presentation:', err);
      setLoadError('Failed to parse PDF presentation. Please check the file.');
    } finally {
      setIsLoadingDeck(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setLoadError('Glimra currently supports standard PDF presentation files.');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      await loadPdfData(buffer, file.name);
    } catch (err) {
      console.error('[Glimra] Error reading file:', err);
      setLoadError('Could not read the selected presentation file.');
    }
  };

  const handleLoadSampleDeck = async () => {
    try {
      setIsLoadingDeck(true);
      setLoadError(null);
      const response = await fetch('/glimra-sample-deck.pdf');
      if (!response.ok) throw new Error('Could not fetch sample presentation');
      const buffer = await response.arrayBuffer();
      await loadPdfData(buffer, 'Glimra Starter Presentation.pdf');
    } catch (err: any) {
      console.error('[Glimra] Failed to load sample presentation:', err);
      setLoadError('Could not load the built-in starter presentation.');
      setIsLoadingDeck(false);
    }
  };

  const handleEnableCameraClick = async () => {
    if (camera.isActive) {
      // Disarm camera
      await controllerRef.current?.stop();
      setCamera({
        isActive: false,
        status: 'idle',
        faceDetected: false,
        validationMessage: 'Camera idle',
        lastGesture: null,
      });
      setVideoStream(null);
    } else {
      setShowPrivacyModal(true);
    }
  };

  const confirmCameraConsent = async () => {
    setShowPrivacyModal(false);

    if (!apiKey.trim()) {
      setShowSettingsModal(true);
      return;
    }

    setCamera((prev) => ({
      ...prev,
      isActive: true,
      status: 'initializing',
      validationMessage: 'Connecting to SmartSpectra…',
    }));

    await controllerRef.current?.start(apiKey);
  };

  const saveApiKey = async (key: string) => {
    const trimmed = key.trim();
    setApiKey(trimmed);
    localStorage.setItem('glimra_presage_api_key', trimmed);
    setShowSettingsModal(false);

    // If camera was pending key, restart with key
    if (camera.isActive && controllerRef.current) {
      await controllerRef.current.stop();
      await controllerRef.current.start(trimmed);
    }
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
          zIndex: 20,
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
          position: 'relative',
          overflow: 'clip',
        }}
      >
        {/* Presenter HUD Overlay */}
        <PresenterHUD
          camera={camera}
          chargeRatio={chargeRatio}
          videoStream={videoStream}
          onTogglePause={toggleGesturePause}
        />

        {!presentation.isLoaded ? (
          <div
            style={{
              maxWidth: '480px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              padding: '24px',
            }}
          >
            <h2 style={{ fontSize: '24px', fontWeight: 500 }}>
              Present hands-free with intentional eye gestures
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>
              Import any PDF presentation deck to begin presenting. Control slides using verified
              prolonged blinks or fallback to your keyboard anytime.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,application/pdf"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoadingDeck}
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-text-inverse)',
                  fontWeight: 500,
                  fontSize: '14px',
                }}
              >
                {isLoadingDeck ? 'Loading…' : 'Choose PDF presentation'}
              </button>

              <button
                onClick={handleLoadSampleDeck}
                disabled={isLoadingDeck}
                style={{
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-strong)',
                  color: 'var(--color-text-primary)',
                  fontSize: '14px',
                }}
              >
                Try sample deck
              </button>
            </div>

            {loadError && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-signal-danger)',
                  color: 'var(--color-signal-danger)',
                  fontSize: '13px',
                }}
              >
                {loadError}
              </div>
            )}
          </div>
        ) : (
          <SlideViewer
            document={pdfDoc}
            currentSlide={presentation.currentSlide}
            totalSlides={presentation.totalSlides}
            fileName={presentation.fileName}
            onNext={nextSlide}
            onPrev={prevSlide}
            onToggleFullscreen={toggleFullscreen}
            isFullscreen={presentation.isFullscreen}
          />
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
