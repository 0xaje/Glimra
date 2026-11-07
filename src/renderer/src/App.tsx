import React, { useState, useEffect, useRef } from 'react';
import { PresentationState, CameraState, GestureFeedback } from './types';
import { loadPresentationFromBuffer, PresentationDocument } from './engine/pdfEngine';
import { SlideViewer } from './components/SlideViewer';
import { SmartSpectraController } from './engine/smartSpectraController';
import { PresenterHUD } from './components/PresenterHUD';
import { audioFeedback } from './utils/audioChime';

type GestureSensitivity = 'responsive' | 'standard' | 'deliberate';

const SENSITIVITY_DWELL_MAP: Record<GestureSensitivity, number> = {
  responsive: 320,
  standard: 380,
  deliberate: 460,
};

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
  const [isDragOver, setIsDragOver] = useState(false);

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
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isBlackout, setIsBlackout] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [sensitivity, setSensitivity] = useState<GestureSensitivity>('standard');
  const [soundFeedbackEnabled, setSoundFeedbackEnabled] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<SmartSpectraController | null>(null);

  // Load API key from secure Electron storage on mount
  useEffect(() => {
    if (window.glimraDesktop?.retrieveApiKey) {
      window.glimraDesktop.retrieveApiKey().then((storedKey) => {
        if (storedKey) setApiKey(storedKey);
      });
    }
  }, []);

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
      } else if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        toggleGesturePause();
      } else if (e.key === 'b' || e.key === 'B' || e.key === '.') {
        e.preventDefault();
        toggleBlackout();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === '?' || e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setShowGuideModal((prev) => !prev);
      } else if (e.key === 'Escape') {
        setShowPrivacyModal(false);
        setShowSettingsModal(false);
        setShowGuideModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentation.currentSlide, presentation.totalSlides, camera.status]);

  const nextSlide = () => {
    setPresentation((prev) => {
      if (prev.currentSlide < prev.totalSlides) {
        if (soundFeedbackEnabled) audioFeedback.playSlideAdvance();
        return { ...prev, currentSlide: prev.currentSlide + 1 };
      }
      return prev;
    });
  };

  const prevSlide = () => {
    setPresentation((prev) => {
      if (prev.currentSlide > 1) {
        if (soundFeedbackEnabled) audioFeedback.playSlidePrevious();
        return { ...prev, currentSlide: prev.currentSlide - 1 };
      }
      return prev;
    });
  };

  const jumpToSlide = (slideNum: number) => {
    setPresentation((prev) => {
      const target = Math.max(1, Math.min(slideNum, prev.totalSlides));
      return { ...prev, currentSlide: target };
    });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setPresentation((prev) => ({ ...prev, isFullscreen: true }));
    } else {
      document.exitFullscreen().catch(() => {});
      setPresentation((prev) => ({ ...prev, isFullscreen: false }));
    }
  };

  const toggleBlackout = () => {
    setIsBlackout((prev) => !prev);
  };

  const toggleGesturePause = () => {
    if (!controllerRef.current || !camera.isActive) return;
    const willPause = camera.status !== 'paused';
    controllerRef.current.setPaused(willPause);
  };

  const handleSensitivityChange = (newSens: GestureSensitivity) => {
    setSensitivity(newSens);
    controllerRef.current?.updateGestureConfig({
      minIntentionalBlinkMs: SENSITIVITY_DWELL_MAP[newSens],
    });
  };

  const handleSoundToggle = (enabled: boolean) => {
    setSoundFeedbackEnabled(enabled);
    audioFeedback.setEnabled(enabled);
  };

  const loadPdfData = async (buffer: ArrayBuffer, name: string) => {
    try {
      setIsLoadingDeck(true);
      setLoadError(null);

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
      setIsBlackout(false);
    } catch (err: unknown) {
      console.error('[Glimra] Failed to load presentation:', err);
      setLoadError('Failed to parse PDF presentation. Please check the file format.');
    } finally {
      setIsLoadingDeck(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setLoadError('Glimra supports standard PDF presentation decks.');
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setLoadError('Please drop a standard PDF presentation file.');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      await loadPdfData(buffer, file.name);
    } catch (err) {
      console.error('[Glimra] Error reading dropped file:', err);
      setLoadError('Could not read the dropped presentation file.');
    }
  };

  const handleLoadSampleDeck = async () => {
    try {
      setIsLoadingDeck(true);
      setLoadError(null);
      const response = await fetch('/glimra-sample-deck.pdf');
      if (!response.ok) throw new Error('Could not fetch starter presentation');
      const buffer = await response.arrayBuffer();
      await loadPdfData(buffer, 'Glimra Starter Presentation.pdf');
    } catch (err: unknown) {
      console.error('[Glimra] Failed to load sample presentation:', err);
      setLoadError('Could not load the built-in starter presentation.');
      setIsLoadingDeck(false);
    }
  };

  const handleEnableCameraClick = async () => {
    if (camera.isActive) {
      await window.glimraDesktop?.setCameraConsent(false);
      await controllerRef.current?.stop();
      setCamera({
        isActive: false,
        status: 'idle',
        faceDetected: false,
        validationMessage: 'Camera idle',
        lastGesture: null,
      });
      setVideoStream(null);
      return;
    }

    setShowPrivacyModal(true);
  };

  const confirmCameraConsent = async () => {
    setShowPrivacyModal(false);
    if (!controllerRef.current) return;

    try {
      if (window.glimraDesktop?.setCameraConsent) {
        await window.glimraDesktop.setCameraConsent(true);
      }

      setCamera((prev) => ({
        ...prev,
        isActive: true,
        status: 'initializing',
        validationMessage: 'Connecting optical feed…',
      }));

      await controllerRef.current.start(apiKey);
    } catch (err) {
      console.error('[Glimra] Camera activation failed:', err);
      setCamera((prev) => ({
        ...prev,
        isActive: false,
        status: 'error',
        validationMessage: 'Hardware access or SDK initialization failed.',
      }));
    }
  };

  const saveApiKey = async (newKey: string) => {
    setApiKey(newKey);
    if (window.glimraDesktop?.storeApiKey) {
      await window.glimraDesktop.storeApiKey(newKey);
    }
    setShowSettingsModal(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        backgroundColor: 'var(--studio-bg)',
        color: 'var(--studio-ink-primary)',
        overflow: 'clip',
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Studio Header Bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 24px',
          borderBottom: '1px solid var(--studio-rule)',
          backgroundColor: 'var(--studio-surface)',
          zIndex: 20,
          userSelect: 'none',
        }}
      >
        {/* Brand Lockup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--studio-amber)',
                color: 'var(--studio-on-amber)',
                fontWeight: 700,
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              G
            </span>
            <span style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--studio-ink-primary)' }}>
              Glimra Studio
            </span>
          </div>

          <span style={{ width: '1px', height: '16px', backgroundColor: 'var(--studio-rule)' }} />

          <span style={{ color: 'var(--studio-ink-secondary)', fontSize: '13px' }}>
            Control without a touch
          </span>
        </div>

        {/* Deck Slot Telemetry */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {presentation.isLoaded ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--studio-elevated)',
                border: '1px solid var(--studio-rule)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span style={{ color: 'var(--studio-ink-secondary)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {presentation.fileName}
              </span>
              <span style={{ color: 'var(--studio-amber)' }}>
                {String(presentation.currentSlide).padStart(2, '0')}/{String(presentation.totalSlides).padStart(2, '0')}
              </span>
            </div>
          ) : (
            <span
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--studio-ink-secondary)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--studio-rule-subtle)',
              }}
            >
              Deck standby
            </span>
          )}
        </div>

        {/* Studio Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Hands-Free Camera Control Toggle */}
          <button
            onClick={handleEnableCameraClick}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 500,
              border: '1px solid',
              borderColor: camera.isActive
                ? 'var(--studio-signal-active)'
                : 'var(--studio-rule)',
              backgroundColor: camera.isActive
                ? 'var(--studio-signal-active-subtle)'
                : 'var(--studio-elevated)',
              color: camera.isActive
                ? 'var(--studio-signal-active)'
                : 'var(--studio-ink-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: camera.isActive
                  ? 'var(--studio-signal-active)'
                  : 'var(--studio-ink-dim)',
              }}
            />
            {camera.isActive ? 'Hands-free active' : 'Enable hands-free'}
          </button>

          {/* Guide Button */}
          <button
            onClick={() => setShowGuideModal(true)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              border: '1px solid var(--studio-rule)',
              backgroundColor: 'var(--studio-elevated)',
              color: 'var(--studio-ink-secondary)',
            }}
          >
            Guide
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              border: '1px solid var(--studio-rule)',
              backgroundColor: 'var(--studio-elevated)',
              color: 'var(--studio-ink-secondary)',
            }}
          >
            Settings
          </button>
        </div>
      </header>

      {/* Main Studio Stage */}
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
              width: '100%',
              maxWidth: '960px',
              display: 'flex',
              flexDirection: 'column',
              gap: '28px',
              padding: '32px 24px',
              margin: 'auto',
            }}
          >
            {/* Primary Importer Stage */}
            <div
              style={{
                backgroundColor: isDragOver ? 'var(--studio-amber-subtle)' : 'var(--studio-surface)',
                border: isDragOver
                  ? '2px dashed var(--studio-amber)'
                  : '1px solid var(--studio-rule)',
                borderRadius: 'var(--radius-md)',
                padding: '40px 32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '18px',
                transition: 'background-color 0.15s ease, border-color 0.15s ease',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--studio-elevated)',
                  border: '1px solid var(--studio-rule-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '18px',
                  color: 'var(--studio-amber)',
                }}
              >
                PDF
              </div>

              <div>
                <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--studio-ink-primary)', textWrap: 'balance' }}>
                  Import a PDF deck to begin presenting
                </h1>
                <p style={{ color: 'var(--studio-ink-secondary)', fontSize: '14px', marginTop: '6px', maxWidth: '520px', textWrap: 'pretty' }}>
                  Select any standard PDF deck to present hands-free with intentional eye dwell blinks, or launch the built-in starter presentation immediately.
                </p>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,application/pdf"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoadingDeck}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--studio-amber)',
                    color: 'var(--studio-on-amber)',
                    fontWeight: 600,
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {isLoadingDeck ? 'Loading…' : 'Choose PDF presentation'}
                </button>

                <button
                  onClick={handleLoadSampleDeck}
                  disabled={isLoadingDeck}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--studio-elevated)',
                    border: '1px solid var(--studio-rule-light)',
                    color: 'var(--studio-ink-primary)',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  Open starter deck
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--studio-ink-secondary)' }}>
                  Drag and drop PDF directly into window
                </span>
                <span style={{ width: '1px', height: '12px', backgroundColor: 'var(--studio-rule)' }} />
                <span style={{ fontSize: '12px', color: 'var(--studio-ink-secondary)' }}>
                  All document rendering and eye tracking run strictly offline
                </span>
              </div>

              {loadError && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--studio-signal-alert-subtle)',
                    border: '1px solid var(--studio-signal-alert)',
                    color: 'var(--studio-signal-alert)',
                    fontSize: '13px',
                  }}
                >
                  {loadError}
                </div>
              )}
            </div>

            {/* Gesture Physics & Intent Blueprint */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--studio-ink-primary)' }}>
                  Hands-free gesture architecture
                </h2>
                <span style={{ fontSize: '12px', color: 'var(--studio-ink-muted)' }}>
                  Presage SmartSpectra filters involuntary movements so you speak naturally
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '14px',
                }}
              >
                {/* Blueprint Card 1: Natural Blink Filter */}
                <div
                  style={{
                    backgroundColor: 'var(--studio-surface)',
                    border: '1px solid var(--studio-rule)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--studio-ink-muted)' }}>
                      01 / FILTERED
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--studio-elevated)',
                        color: 'var(--studio-ink-secondary)',
                        border: '1px solid var(--studio-rule)',
                      }}
                    >
                      &lt; 300 ms
                    </span>
                  </div>
                  <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--studio-ink-primary)' }}>
                    Natural blink
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--studio-ink-secondary)', lineHeight: 1.5 }}>
                    Involuntary natural blinks are automatically filtered out. Slides remain steady during speech.
                  </p>
                </div>

                {/* Blueprint Card 2: Advance Slide */}
                <div
                  style={{
                    backgroundColor: 'var(--studio-surface)',
                    border: '1px solid var(--studio-rule)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--studio-amber)' }}>
                      02 / ADVANCE
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--studio-amber-subtle)',
                        color: 'var(--studio-amber)',
                        border: '1px solid var(--studio-amber-border)',
                      }}
                    >
                      380 ms dwell
                    </span>
                  </div>
                  <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--studio-ink-primary)' }}>
                    Next slide
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--studio-ink-secondary)', lineHeight: 1.5 }}>
                    Deliberate closed-eye pause charges the progress ring, then advances forward.
                  </p>
                </div>

                {/* Blueprint Card 3: Previous Slide */}
                <div
                  style={{
                    backgroundColor: 'var(--studio-surface)',
                    border: '1px solid var(--studio-rule)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--studio-signal-active)' }}>
                      03 / REWIND
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--studio-signal-active-subtle)',
                        color: 'var(--studio-signal-active)',
                        border: '1px solid var(--studio-signal-active)',
                      }}
                    >
                      2x in 600 ms
                    </span>
                  </div>
                  <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--studio-ink-primary)' }}>
                    Previous slide
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--studio-ink-secondary)', lineHeight: 1.5 }}>
                    Two crisp intentional blinks in sequence immediately return to the preceding slide.
                  </p>
                </div>
              </div>
            </div>

            {/* Keyboard Fallback Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--studio-surface)',
                border: '1px solid var(--studio-rule-subtle)',
                fontSize: '12px',
              }}
            >
              <span style={{ color: 'var(--studio-ink-muted)' }}>
                Keyboard fallbacks always available:
              </span>
              <div style={{ display: 'flex', gap: '14px', color: 'var(--studio-ink-secondary)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                <span>[ → ] Next</span>
                <span>[ ← ] Previous</span>
                <span>[ Space / P ] Pause</span>
                <span>[ B ] Blank</span>
                <span>[ F ] Fullscreen</span>
                <span>[ ? ] Guide</span>
              </div>
            </div>
          </div>
        ) : (
          <SlideViewer
            document={pdfDoc}
            currentSlide={presentation.currentSlide}
            totalSlides={presentation.totalSlides}
            fileName={presentation.fileName}
            onNext={nextSlide}
            onPrev={prevSlide}
            onJumpToSlide={jumpToSlide}
            onToggleFullscreen={toggleFullscreen}
            isFullscreen={presentation.isFullscreen}
            isBlackout={isBlackout}
            onToggleBlackout={toggleBlackout}
          />
        )}
      </main>

      {/* Guide Modal */}
      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--studio-scrim)',
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
              maxWidth: '560px',
              backgroundColor: 'var(--studio-surface)',
              border: '1px solid var(--studio-rule-light)',
              borderRadius: 'var(--radius-md)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 id="guide-title" style={{ fontSize: '17px', fontWeight: 600, color: 'var(--studio-ink-primary)' }}>
                Hands-free presentation guide
              </h2>
              <button
                onClick={() => setShowGuideModal(false)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--studio-ink-muted)',
                  fontSize: '12px',
                }}
              >
                Close
              </button>
            </div>

            <p style={{ color: 'var(--studio-ink-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
              Glimra recognizes intentional eye gestures to give you confident, touch-free control
              while addressing an audience. Involuntary blinks are automatically filtered.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--studio-elevated)',
                  border: '1px solid var(--studio-rule)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--studio-amber)' }}>
                  Next slide: intentional dwell blink
                </div>
                <div style={{ fontSize: '12px', color: 'var(--studio-ink-secondary)', marginTop: '4px' }}>
                  Close eyes deliberately for approximately 380 milliseconds. The HUD progress ring indicates
                  the dwell charge before advancing the slide.
                </div>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--studio-elevated)',
                  border: '1px solid var(--studio-rule)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--studio-signal-active)' }}>
                  Previous slide: quick double-blink
                </div>
                <div style={{ fontSize: '12px', color: 'var(--studio-ink-secondary)', marginTop: '4px' }}>
                  Perform two crisp consecutive blinks within half a second to step backwards.
                </div>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--studio-elevated)',
                  border: '1px solid var(--studio-rule)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--studio-ink-primary)' }}>
                  Lighting & positioning recommendations
                </div>
                <div style={{ fontSize: '12px', color: 'var(--studio-ink-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                  Position your camera at eye level. Ensure even lighting on your face and avoid strong backlighting or glare directly into the lens.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={() => setShowGuideModal(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--studio-amber)',
                  color: 'var(--studio-on-amber)',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                Got it
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
            backgroundColor: 'var(--studio-scrim)',
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
              maxWidth: '480px',
              backgroundColor: 'var(--studio-surface)',
              border: '1px solid var(--studio-rule-light)',
              borderRadius: 'var(--radius-md)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <h2 id="settings-title" style={{ fontSize: '17px', fontWeight: 600, color: 'var(--studio-ink-primary)' }}>
              Studio settings
            </h2>

            {/* API Key */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="api-key-input" style={{ fontSize: '13px', color: 'var(--studio-ink-secondary)' }}>
                Presage SmartSpectra API key
              </label>
              <input
                id="api-key-input"
                type="password"
                defaultValue={apiKey}
                placeholder="Enter your API key"
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--studio-rule)',
                  backgroundColor: 'var(--studio-bg)',
                  color: 'var(--studio-ink-primary)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <p style={{ fontSize: '12px', color: 'var(--studio-ink-muted)' }}>
                Encrypted via OS safeStorage. Never sent to third parties or logged.
              </p>
            </div>

            {/* Gesture Sensitivity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: 'var(--studio-ink-secondary)' }}>
                Gesture dwell sensitivity
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {(['responsive', 'standard', 'deliberate'] as GestureSensitivity[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => handleSensitivityChange(level)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid',
                      borderColor:
                        sensitivity === level
                          ? 'var(--studio-amber)'
                          : 'var(--studio-rule)',
                      backgroundColor:
                        sensitivity === level
                          ? 'var(--studio-amber-subtle)'
                          : 'var(--studio-elevated)',
                      color:
                        sensitivity === level
                          ? 'var(--studio-amber)'
                          : 'var(--studio-ink-primary)',
                      fontSize: '12px',
                      textTransform: 'capitalize',
                    }}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--studio-ink-muted)' }}>
                {sensitivity === 'responsive' && '320ms intentional dwell for rapid presenters.'}
                {sensitivity === 'standard' && '380ms dwell balanced for natural speech pacing.'}
                {sensitivity === 'deliberate' && '460ms dwell preventing accidental triggers.'}
              </p>
            </div>

            {/* Audio Feedback Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--studio-ink-primary)' }}>
                  Presenter audio cues
                </div>
                <div style={{ fontSize: '12px', color: 'var(--studio-ink-muted)' }}>
                  Plays a subtle chime when slides advance or step back
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSoundToggle(!soundFeedbackEnabled)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--studio-rule)',
                  backgroundColor: soundFeedbackEnabled
                    ? 'var(--studio-amber-subtle)'
                    : 'var(--studio-elevated)',
                  color: soundFeedbackEnabled
                    ? 'var(--studio-amber)'
                    : 'var(--studio-ink-secondary)',
                  fontSize: '12px',
                }}
              >
                {soundFeedbackEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => setShowSettingsModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--studio-rule)',
                  backgroundColor: 'var(--studio-elevated)',
                  fontSize: '13px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById('api-key-input') as HTMLInputElement;
                  if (input) saveApiKey(input.value);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--studio-amber)',
                  color: 'var(--studio-on-amber)',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                Save settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy and Camera Notice Modal */}
      {showPrivacyModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="privacy-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--studio-scrim)',
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
              backgroundColor: 'var(--studio-surface)',
              border: '1px solid var(--studio-rule-light)',
              borderRadius: 'var(--radius-md)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h2 id="privacy-title" style={{ fontSize: '17px', fontWeight: 600, color: 'var(--studio-ink-primary)' }}>
              Camera access & local privacy
            </h2>
            <p style={{ color: 'var(--studio-ink-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
              Glimra uses your camera exclusively to detect intentional eye gestures to control slide transitions.
            </p>
            <ul
              style={{
                color: 'var(--studio-ink-secondary)',
                fontSize: '12px',
                paddingLeft: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                lineHeight: 1.5,
              }}
            >
              <li>Video frames are processed in local device memory and are never saved to disk.</li>
              <li>No video or telemetry is streamed to external cloud servers.</li>
              <li>The camera turns off immediately when you pause, disable, or exit.</li>
              <li>Physical keyboard shortcuts always remain functional.</li>
            </ul>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => setShowPrivacyModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--studio-rule)',
                  backgroundColor: 'var(--studio-elevated)',
                  fontSize: '13px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmCameraConsent}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--studio-amber)',
                  color: 'var(--studio-on-amber)',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                Enable camera control
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
