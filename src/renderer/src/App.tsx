import React, { useState, useEffect, useRef } from 'react';
import { Eye, FolderOpen, BookOpen, Settings2, Sun, Moon, ChevronLeft, ChevronRight, Maximize2, Camera, CameraOff, PanelLeftClose, PanelLeftOpen, Presentation, MonitorOff, Timer, X } from 'lucide-react';
import { PresentationState, CameraState, GestureFeedback } from './types';
import { loadPresentationFromBuffer, PresentationDocument } from './engine/pdfEngine';
import { SlideViewer } from './components/SlideViewer';
import { SlideThumbnail } from './components/SlideThumbnail';
import { CameraPreview } from './components/CameraPreview';
import { SmartSpectraController } from './engine/smartSpectraController';
import { PresenterHUD } from './components/PresenterHUD';
import { LiveGestureTracker } from './components/LiveGestureTracker';
import type { GestureControlMode } from './components/LiveGestureTracker';
import type { MotionCommand } from './engine/directionalGestureEngine';
import { audioFeedback } from './utils/audioChime';

type GestureSensitivity = 'quick' | 'balanced' | 'relaxed' | 'custom';
type GestureTiming = { minIntentionalBlinkMs: number; maxIntentionalBlinkMs: number; refractoryCooldownMs: number };
const GESTURE_PRESETS: Record<Exclude<GestureSensitivity, 'custom'>, GestureTiming> = {
  quick: { minIntentionalBlinkMs: 400, maxIntentionalBlinkMs: 1200, refractoryCooldownMs: 900 },
  balanced: { minIntentionalBlinkMs: 550, maxIntentionalBlinkMs: 1500, refractoryCooldownMs: 1200 },
  relaxed: { minIntentionalBlinkMs: 750, maxIntentionalBlinkMs: 1900, refractoryCooldownMs: 1600 },
};
const readGesturePreference = (): { preset: GestureSensitivity; custom: GestureTiming } => {
  const fallback = { preset: 'balanced' as GestureSensitivity, custom: { ...GESTURE_PRESETS.balanced } };
  try {
    const saved = JSON.parse(localStorage.getItem('glimra-gesture-timing') || 'null');
    if (!saved || !['quick', 'balanced', 'relaxed', 'custom'].includes(saved.preset)) return fallback;
    const min = Number(saved.custom?.minIntentionalBlinkMs);
    const cooldown = Number(saved.custom?.refractoryCooldownMs);
    if (!Number.isFinite(min) || !Number.isFinite(cooldown) || min < 300 || min > 1200 || cooldown < 600 || cooldown > 2500) return fallback;
    return { preset: saved.preset, custom: { minIntentionalBlinkMs: min, maxIntentionalBlinkMs: min + 950, refractoryCooldownMs: cooldown } };
  } catch { return fallback; }
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

  const [camera, setCamera] = useState<CameraState>({
    isActive: false,
    status: 'idle',
    faceDetected: false,
    validationMessage: 'Camera idle',
    lastGesture: null,
  });

  const [chargeRatio, setChargeRatio] = useState(0);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [scrollCommand, setScrollCommand] = useState<{ id: number; direction: 'up' | 'down' } | null>(null);
  const [gestureMode, setGestureMode] = useState<GestureControlMode>(() => {
    try {
      const saved = localStorage.getItem('glimra-control-mode');
      return saved === 'head' || saved === 'eyes' ? saved : 'hand';
    } catch { return 'hand'; }
  });
  const [gestureTrackingReady, setGestureTrackingReady] = useState(false);
  const [gestureTrackingError, setGestureTrackingError] = useState<string | null>(null);

  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isBlackout, setIsBlackout] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => { try { return localStorage.getItem('glimra-theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } });
  const [showSlides, setShowSlides] = useState(true);
  const [showCameraSetup, setShowCameraSetup] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const [apiKey, setApiKey] = useState('');
  const [gesturePreference, setGesturePreference] = useState(readGesturePreference);
  const sensitivity = gesturePreference.preset;
  const gestureTiming = sensitivity === 'custom' ? gesturePreference.custom : GESTURE_PRESETS[sensitivity];
  const [soundFeedbackEnabled, setSoundFeedbackEnabled] = useState(true);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [calibrationSamples, setCalibrationSamples] = useState<number[]>([]);
  const calibrationActiveRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<SmartSpectraController | null>(null);
  // SDK listeners live for the window lifetime; delegate to the latest render.
  const slideActionsRef = useRef<{ next: () => void; prev: () => void }>({ next: () => {}, prev: () => {} });

  useEffect(() => { try { localStorage.setItem('glimra-theme', theme); } catch { /* preference storage unavailable */ } }, [theme]);
  useEffect(() => {
    if (!presentation.isLoaded) return;
    const id = window.setInterval(() => setSeconds(value => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [presentation.isLoaded]);
  const timeLabel = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  // Escape closes the topmost setup or help surface without changing camera state.
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (showPrivacyModal) setShowPrivacyModal(false);
      else if (calibrationOpen) endCalibration();
      else if (showSettingsModal) setShowSettingsModal(false);
      else if (showGuideModal) setShowGuideModal(false);
      else if (showCameraSetup) setShowCameraSetup(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [showPrivacyModal, showSettingsModal, showGuideModal, showCameraSetup, calibrationOpen]);

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
      onNextSlide: () => slideActionsRef.current.next(),
      onPrevSlide: () => slideActionsRef.current.prev(),
      onStreamAvailable: (stream) => { setVideoStream(prev => prev?.getVideoTracks()[0]?.id === stream.getVideoTracks()[0]?.id ? prev : stream); setGestureTrackingError(null); },
      onStatusChange: (status) => setCamera((prev) => ({ ...prev, status })),
      onValidationChange: (validationMessage, faceDetected) =>
        setCamera((prev) => ({ ...prev, validationMessage, faceDetected })),
      onGestureDetected: (feedback: GestureFeedback) => {
        setCamera((prev) => ({ ...prev, lastGesture: feedback }));
      },
      onChargeProgress: (ratio) => setChargeRatio(ratio),
      onCalibrationSample: (durationMs) => {
        if (!calibrationActiveRef.current) return;
        setCalibrationSamples(prev => prev.length >= 5 ? prev : [...prev, durationMs]);
      },
      onSdkUnavailable: (_code, message) => {
        calibrationActiveRef.current = false;
        setCalibrationOpen(false);
        // SmartSpectra is optional to head/hand navigation once the camera
        // is open. Do not revoke consent or clear the camera stream here.
        setCamera(prev => ({ ...prev, isActive: true, status: 'tracking', faceDetected: false,
          validationMessage: `${message}. Head and hand control stays on.` }));
      },
      onError: (_code, message) => {
        calibrationActiveRef.current = false;
        setCalibrationOpen(false);
        // A failed SDK session must not leave a stale live preview or
        // appear active. Do not silently restart and spend more credits.
        setVideoStream(null);
        void window.glimraDesktop?.setCameraConsent(false);
        setCamera((prev) => ({
          ...prev,
          isActive: false,
          faceDetected: false,
          status: 'error',
          validationMessage: message,
        }));
      },
    });

    return () => {
      const controller = controllerRef.current;
      controllerRef.current = null;
      void controller?.stop();
      void window.glimraDesktop?.setCameraConsent(false);
    };
  }, []);

  // Hand swipes are the default. Blink navigation is opt-in only.
  useEffect(() => {
    try { localStorage.setItem('glimra-control-mode', gestureMode); } catch { /* optional */ }
    controllerRef.current?.setBlinkNavigationEnabled(gestureMode === 'eyes');
    setGestureTrackingReady(false);
    setGestureTrackingError(null);
  }, [gestureMode]);

  // Presenter keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('glimra:scroll-gesture', { detail: { direction: e.key === 'ArrowUp' ? 'up' : 'down' } }));
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
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
      } else if (e.key === 'b' || e.key === 'B' || e.key === '.') {
        e.preventDefault();
        toggleBlackout();
      } else if (e.key === '?' || e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setShowGuideModal((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentation.currentSlide, presentation.totalSlides, camera.status, presentation.isLoaded]);

  const nextSlide = () => {
    setIsBlackout(false);
    setPresentation((prev) => {
      if (!prev.isLoaded || prev.currentSlide >= prev.totalSlides) return prev;
      audioFeedback.playSlideAdvance();
      return { ...prev, currentSlide: prev.currentSlide + 1 };
    });
  };

  const prevSlide = () => {
    setIsBlackout(false);
    setPresentation((prev) => {
      if (!prev.isLoaded || prev.currentSlide <= 1) return prev;
      audioFeedback.playSlidePrevious();
      return { ...prev, currentSlide: prev.currentSlide - 1 };
    });
  };

  slideActionsRef.current.next = nextSlide;
  slideActionsRef.current.prev = prevSlide;

  // Gesture detectors dispatch this event after a verified vertical movement.
  useEffect(() => {
    const handleScrollGesture = (event: Event) => {
      const direction = (event as CustomEvent<{ direction?: string }>).detail?.direction;
      if (direction !== 'up' && direction !== 'down') return;
      setScrollCommand(previous => ({ id: (previous?.id ?? 0) + 1, direction }));
    };
    window.addEventListener('glimra:scroll-gesture', handleScrollGesture);
    return () => window.removeEventListener('glimra:scroll-gesture', handleScrollGesture);
  }, []);

  const jumpToSlide = (slideNum: number) => {
    setIsBlackout(false);
    setPresentation((prev) => {
      if (!prev.isLoaded || slideNum < 1 || slideNum > prev.totalSlides) return prev;
      audioFeedback.playSlideAdvance();
      return { ...prev, currentSlide: slideNum };
    });
  };

  const toggleBlackout = () => {
    setIsBlackout((prev) => !prev);
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

  useEffect(() => {
    try { localStorage.setItem('glimra-gesture-timing', JSON.stringify(gesturePreference)); } catch { /* optional preference storage */ }
    controllerRef.current?.updateGestureConfig(gestureTiming);
  }, [gesturePreference]);

  const endCalibration = () => {
    calibrationActiveRef.current = false;
    controllerRef.current?.setCalibrationMode(false);
    setCalibrationOpen(false);
  };
  const beginCalibration = () => {
    if (camera.status !== 'tracking' || !camera.faceDetected) return;
    setCalibrationSamples([]);
    calibrationActiveRef.current = true;
    controllerRef.current?.setCalibrationMode(true);
    setShowSettingsModal(false);
    setCalibrationOpen(true);
  };
  const calibrationSuggestion = (() => {
    if (calibrationSamples.length !== 5) return null;
    const sorted = [...calibrationSamples].sort((a, b) => a - b);
    const median = sorted[2];
    const min = Math.max(300, Math.min(1200, Math.round(median * 0.75 / 50) * 50));
    return { minIntentionalBlinkMs: min, maxIntentionalBlinkMs: min + 950, refractoryCooldownMs: 1200 };
  })();
  const applyCalibration = () => {
    if (!calibrationSuggestion) return;
    setGesturePreference({ preset: 'custom', custom: calibrationSuggestion });
    endCalibration();
  };

  const handleSensitivityChange = (newSens: GestureSensitivity) => {
    setGesturePreference(prev => ({ ...prev, preset: newSens }));
  };
  const handleCustomTimingChange = (key: 'minIntentionalBlinkMs' | 'refractoryCooldownMs', value: number) => {
    setGesturePreference(prev => {
      const custom = { ...prev.custom, [key]: value };
      custom.maxIntentionalBlinkMs = custom.minIntentionalBlinkMs + 950;
      return { preset: 'custom', custom };
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

      // Validate the selected file before handing it to PDF.js. A .pdf extension
      // alone does not guarantee that the contents are a readable PDF.
      if (buffer.byteLength < 5) {
        throw new Error('This file is empty or too small to be a PDF.');
      }
      const header = new TextDecoder('ascii').decode(buffer.slice(0, Math.min(buffer.byteLength, 1024)));
      if (!header.includes('%PDF-')) {
        throw new Error('This file is not a PDF. Choose a PDF exported from your presentation app.');
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
      setSeconds(0);
    } catch (err: unknown) {
      console.error('[Glimra] Failed to load presentation:', err);
      const detail = err instanceof Error ? err.message : '';
      const message = /password/i.test(detail)
        ? 'This PDF is password-protected. Unlock it before opening.'
        : /Invalid PDF|Missing PDF|format|structure|corrupt/i.test(detail)
          ? 'This PDF could not be read. Try exporting it again as a PDF.'
          : detail.startsWith('This file')
            ? detail
            : 'Could not open this PDF. Check the browser console for the PDF.js error.';
      setLoadError(message);
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

  const handleEnableCameraClick = async () => {
    if (camera.isActive) {
      endCalibration();
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

    await window.glimraDesktop?.setCameraConsent(true);

    setCamera((prev) => ({
      ...prev,
      isActive: true,
      status: 'initializing',
      validationMessage: 'Connecting to SmartSpectra…',
    }));

    try {
      if (!controllerRef.current) throw new Error('Camera controller is unavailable.');
      await controllerRef.current.start(apiKey);
    } catch (error) {
      setCamera(prev => ({ ...prev, isActive: false, status: 'error', faceDetected: false, validationMessage: error instanceof Error ? error.message : 'Could not start the camera.' }));
      setVideoStream(null);
      await window.glimraDesktop?.setCameraConsent(false);
    }
  };

  const saveApiKey = async (key: string) => {
    const trimmed = key.trim();
    setApiKey(trimmed);
    if (window.glimraDesktop?.storeApiKey) {
      await window.glimraDesktop.storeApiKey(trimmed);
    }
    setShowSettingsModal(false);

    if (camera.isActive && controllerRef.current) {
      await controllerRef.current.stop();
      try {
        await controllerRef.current.start(trimmed);
      } catch (error) {
        setCamera(prev => ({ ...prev, isActive: false, status: 'error', faceDetected: false, validationMessage: error instanceof Error ? error.message : 'Could not restart the camera.' }));
        setVideoStream(null);
        await window.glimraDesktop?.setCameraConsent(false);
      }
    }
  };

  return (
    <div className={`glimra-app ${presentation.isFullscreen ? "is-presenting" : ""}`} data-theme={theme}>
      <header className="studio-topbar">
        <div className="studio-brand"><span className="brand-mark"><Eye size={20} strokeWidth={2.6}/></span><span className="brand-name">Glimra<span className="brand-subtitle"> Studio</span></span></div>
        <div className="topbar-actions">
          {presentation.isLoaded && <span className="document-title" title={presentation.fileName || ''}>{presentation.fileName}</span>}
          <button className="icon-button" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Toggle color theme" onClick={() => setTheme(v => v === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button>
          <button className="topbar-text-button" onClick={() => setShowGuideModal(true)}><BookOpen size={16}/> <span>Guide</span></button>
          <button className="icon-button" title="Settings" aria-label="Settings" onClick={() => setShowSettingsModal(true)}><Settings2 size={19}/></button>
        </div>
      </header>
      <div className="studio-layout">
        {presentation.isLoaded && !presentation.isFullscreen && showSlides && (
          <aside className="slide-rail" aria-label="Slide navigator">
            <div className="rail-heading"><span>Slides</span><button className="icon-button small" title="Hide slides" onClick={() => setShowSlides(false)}><PanelLeftClose size={16}/></button></div>
            <div className="rail-list">{Array.from({length:presentation.totalSlides},(_,i)=>i+1).map(page=>(
              pdfDoc && <SlideThumbnail key={page} document={pdfDoc} page={page} selected={presentation.currentSlide===page} onSelect={()=>jumpToSlide(page)}/>
            ))}</div>
          </aside>
        )}
        <section className="studio-center">
          {!presentation.isFullscreen && presentation.isLoaded && !showSlides && <button className="restore-rail" onClick={() => setShowSlides(true)}><PanelLeftOpen size={16}/> Show slides</button>}
          <div className={`studio-stage ${presentation.isLoaded?'has-presentation':''}`}>
            <LiveGestureTracker
              stream={videoStream}
              enabled={camera.isActive && camera.status !== 'paused' && camera.status !== 'error'}
              mode={gestureMode}
              onCommand={(command: MotionCommand) => {
                if (!presentation.isLoaded || gestureMode === 'eyes') return;
                setCamera(prev => ({
                  ...prev,
                  lastGesture: {
                    type: command.source === 'hand' ? 'hand-swipe' : 'head-motion',
                    timestamp: Date.now(),
                    label: command.source === 'hand' ? 'Hand ' + command.direction : 'Head ' + command.direction,
                  },
                }));
                if (command.direction === 'right') slideActionsRef.current.next();
                else if (command.direction === 'left') slideActionsRef.current.prev();
                else window.dispatchEvent(new CustomEvent('glimra:scroll-gesture', { detail: { direction: command.direction } }));
              }}
              onTrackingReady={() => { setGestureTrackingReady(true); setGestureTrackingError(null); }}
              onTrackingError={(message) => { console.error('[Glimra/Gestures]', message); setGestureTrackingReady(false); setGestureTrackingError(message); }}
            />
            <PresenterHUD camera={camera} chargeRatio={chargeRatio} videoStream={videoStream} onTogglePause={toggleGesturePause} controlMode={gestureMode} trackingReady={gestureTrackingReady}/>
            {camera.isActive && gestureTrackingError && <div role="alert" className="studio-error">{gestureTrackingError}</div>}
            <input type="file" ref={fileInputRef} accept=".pdf,application/pdf" onChange={handleFileUpload} className="visually-hidden" />
            {!presentation.isLoaded ? (
              <div className="welcome-stage" onDragOver={(event) => event.preventDefault()} onDrop={async (event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (!file) return; if (!file.name.toLowerCase().endsWith('.pdf')) { setLoadError('Please choose a PDF file.'); return; } try { await loadPdfData(await file.arrayBuffer(), file.name); } catch { setLoadError('Could not read this PDF file.'); } }}>
                <div className="welcome-symbol"><Presentation size={38} strokeWidth={1.6}/></div>
                <h1>Your stage is ready.</h1>
                <p>Open a PDF. Present without touching your computer.</p>
                <button className="primary-button" onClick={() => fileInputRef.current?.click()} disabled={isLoadingDeck}><FolderOpen size={18}/>{isLoadingDeck?'Opening…':'Open presentation'}</button>
                <span className="welcome-hint">Or drag a PDF into this window</span>
                {loadError && <div className="studio-error" role="alert">{loadError}</div>}
              </div>
            ) : (
              <SlideViewer document={pdfDoc} currentSlide={presentation.currentSlide} totalSlides={presentation.totalSlides} fileName={presentation.fileName} onNext={nextSlide} onPrev={prevSlide} onJumpToSlide={jumpToSlide} scrollCommand={scrollCommand} onToggleFullscreen={toggleFullscreen} isFullscreen={presentation.isFullscreen} isBlackout={isBlackout} onToggleBlackout={toggleBlackout} embedded={!presentation.isFullscreen}/>
            )}
          </div>
          {!presentation.isFullscreen && <footer className="studio-footer">
            <div className="footer-group">
              <button className="icon-button" aria-label="Previous slide" disabled={!presentation.isLoaded || presentation.currentSlide<=1} onClick={prevSlide}><ChevronLeft size={19}/></button>
              <span className="slide-count">{presentation.isLoaded?`${presentation.currentSlide} / ${presentation.totalSlides}`:'No slides'}</span>
              <button className="icon-button" aria-label="Next slide" disabled={!presentation.isLoaded || presentation.currentSlide>=presentation.totalSlides} onClick={nextSlide}><ChevronRight size={19}/></button>
            </div>
            <div className="footer-group footer-center">
              <button className={`camera-status ${camera.status==='tracking'&&camera.faceDetected?'tracking':''}`} onClick={() => setShowCameraSetup(true)}>
                {camera.isActive && camera.status==='tracking'?<Camera size={16}/>:<CameraOff size={16}/>}
                <span>{camera.isActive && camera.status==='tracking'?'Hands-free ready':camera.status==='initializing'?'Connecting camera…':camera.status==='error'?'Camera error':camera.status==='paused'?'Hands-free paused':'Hands-free off'}</span>
              </button>
            </div>
            <div className="footer-group">
              {presentation.isLoaded && <><span className="timer-readout"><Timer size={15}/>{timeLabel}</span><button className="icon-button" aria-label={isBlackout?'Resume screen':'Blank screen'} title="Blank screen (B)" onClick={toggleBlackout}><MonitorOff size={18}/></button><button className="icon-button" aria-label="Toggle fullscreen" onClick={toggleFullscreen}><Maximize2 size={18}/></button></>}
              {!presentation.isLoaded && <button className="footer-setup" onClick={() => setShowCameraSetup(true)}>Set up camera <ChevronLeft size={15}/></button>}
            </div>
          </footer>}
        </section>
      </div>
      {showCameraSetup && <div className="studio-scrim" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)setShowCameraSetup(false)}}>
        <section className="camera-panel" role="dialog" aria-modal="true" aria-labelledby="camera-setup-title" aria-describedby="camera-setup-description">
          <div className="panel-head"><div><h2 id="camera-setup-title">Set up hands-free control</h2></div><button className="icon-button" aria-label="Close camera setup" onClick={()=>setShowCameraSetup(false)}><X size={20}/></button></div>
          <p className="panel-description" id="camera-setup-description">Use your open hand to control your PDF. Swipe left or right for slides; up or down to scroll a page.</p>
          <CameraPreview stream={videoStream}/>
          <div className="panel-field"><label>Camera status</label><p>{camera.validationMessage}</p></div>
          <div className="panel-field"><label>Control method</label><div className="sensitivity-options">{(['hand', 'head', 'eyes'] as GestureControlMode[]).map(option => <button key={option} type="button" className={gestureMode===option?'active':''} onClick={() => setGestureMode(option)}>{option === 'hand' ? 'Hands (default)' : option === 'head' ? 'Head' : 'Eyes'}</button>)}</div><p>Hands: swipe. Head: move left, right, up or down. Eyes: SmartSpectra blink control.</p></div>
          <div className="panel-field"><label>Eye timing (eyes mode only)</label><div className="sensitivity-options">{(['quick', 'balanced', 'relaxed', 'custom'] as GestureSensitivity[]).map(option=><button key={option} type="button" className={sensitivity===option?'active':''} onClick={()=>handleSensitivityChange(option)}>{option[0].toUpperCase()+option.slice(1)}<small>{option === 'custom' ? 'Adjust in Settings' : `${GESTURE_PRESETS[option].minIntentionalBlinkMs} ms`}</small></button>)}</div><p>Close your eyes, then open them to move forward. Adjust your timing in Settings.</p></div>
          <button className="primary-button panel-primary" disabled={camera.status === "initializing"} onClick={async()=>{await handleEnableCameraClick();setShowCameraSetup(false)}}>{camera.isActive?'Disconnect camera':'Connect camera'}</button>
          <button className="text-button" onClick={()=>{setShowCameraSetup(false);setShowSettingsModal(true)}}>API key settings</button>
        </section>
      </div>}
      {/* Guide & Onboarding Modal */}
      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-title"
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
              maxWidth: '560px',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 id="guide-title" style={{ fontSize: '18px', fontWeight: 600 }}>
                How Glimra works
              </h2>
              <button
                onClick={() => setShowGuideModal(false)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-muted)',
                  fontSize: '13px',
                }}
              >
                Close
              </button>
            </div>

            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
              Glimra lets you present a PDF without touching your computer.
              <strong> Open-hand swipes are the default.</strong> Choose Head or Eyes in Settings if you prefer.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-accent)' }}>Hands — default</div>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: 1.7 }}>
                  Show one open hand to the camera. Swipe right: next slide. Swipe left: previous slide.
                  Swipe up: scroll up inside the current PDF page. Swipe down: scroll down inside that same page.
                  Bring your hand back to the middle before repeating.
                </p>
              </div>
              <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>Head — optional</div>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: 1.7 }}>
                  Choose Head in Settings. Move your head right or left to change slides.
                  Move it up or down to scroll within the current PDF page.
                  Return to the middle between movements.
                </p>
              </div>
              <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>Eyes — optional SmartSpectra control</div>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: 1.7 }}>
                  Choose Eyes in Settings. A deliberate long blink goes forward; a quick double-blink goes back.
                  Eye control needs valid live SmartSpectra readings. Eye movements do not scroll pages.
                </p>
              </div>
              <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>PDF scrolling and keyboard backup</div>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: 1.7 }}>
                  Up and down only move the content of the current page, not the slide number.
                  Use Fit width or Zoom in when a page is too small to scroll. If a whole page already fits on screen, it has no extra content to scroll.
                  Arrow Up/Down scroll; Arrow Left/Right or Page Up/Down change slides.
                  Space or P pauses gestures. F toggles fullscreen. B blanks the screen.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                onClick={() => setShowGuideModal(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-text-inverse)',
                  fontWeight: 500,
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
              maxWidth: '480px',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <h2 id="settings-title" style={{ fontSize: '18px', fontWeight: 600 }}>
              Settings
            </h2>

            {/* API Key */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="api-key-input" style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
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
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-base)',
                  color: 'var(--color-text-primary)',
                  fontSize: '13px',
                }}
              />
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Encrypted via OS safeStorage. Never sent to third parties or logged.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Control method</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['hand', 'head', 'eyes'] as GestureControlMode[]).map(option => (
                  <button type="button" key={option} aria-pressed={gestureMode===option}
                    onClick={() => setGestureMode(option)}
                    style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid', borderColor: gestureMode===option ? 'var(--color-accent)' : 'var(--color-border-subtle)', color: gestureMode===option ? 'var(--color-accent)' : 'var(--color-text-primary)', backgroundColor: 'var(--color-bg-elevated)' }}>
                    {option === 'hand' ? 'Hands (default)' : option === 'head' ? 'Head' : 'Eyes'}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Hands: swipe to turn pages or scroll. Head: move in the direction you want. Eyes: optional SmartSpectra blink controls.</p>
            </div>
            {/* Gesture Sensitivity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Eye blink timing (eyes mode only)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {(['quick', 'balanced', 'relaxed', 'custom'] as GestureSensitivity[]).map((level) => (
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
                          ? 'var(--color-accent)'
                          : 'var(--color-border-subtle)',
                      backgroundColor:
                        sensitivity === level
                          ? 'var(--color-accent-subtle)'
                          : 'var(--color-bg-elevated)',
                      color:
                        sensitivity === level
                          ? 'var(--color-accent)'
                          : 'var(--color-text-primary)',
                      fontSize: '12px',
                      textTransform: 'capitalize',
                    }}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Close your eyes for at least {(gestureTiming.minIntentionalBlinkMs / 1000).toFixed(2)} seconds, then open them before {(gestureTiming.maxIntentionalBlinkMs / 1000).toFixed(2)} seconds to move forward. Wait {(gestureTiming.refractoryCooldownMs / 1000).toFixed(2)} seconds between commands.
              </p>
              {sensitivity === 'custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '12px' }} htmlFor="blink-hold">Minimum eye hold: {(gestureTiming.minIntentionalBlinkMs / 1000).toFixed(2)}s</label>
                  <input id="blink-hold" type="range" min="300" max="1200" step="50" value={gesturePreference.custom.minIntentionalBlinkMs} onChange={event => handleCustomTimingChange('minIntentionalBlinkMs', Number(event.target.value))}/>
                  <label style={{ fontSize: '12px' }} htmlFor="blink-cooldown">Time between commands: {(gestureTiming.refractoryCooldownMs / 1000).toFixed(2)}s</label>
                  <input id="blink-cooldown" type="range" min="600" max="2500" step="100" value={gesturePreference.custom.refractoryCooldownMs} onChange={event => handleCustomTimingChange('refractoryCooldownMs', Number(event.target.value))}/>
                </div>
              )}
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Eye timing only affects Eyes mode. Hands are the default and do not require blink timing.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button type="button" disabled={camera.status !== 'tracking' || !camera.faceDetected} onClick={beginCalibration}
                style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}>
                Practice and find my eye timing
              </button>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Start the camera first. Practice five comfortable eye holds. Slides will not move during practice.
              </p>
            </div>

            {/* Audio Feedback Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>
                  Presenter audio cues
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Plays a subtle chime when slides advance or step back
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSoundToggle(!soundFeedbackEnabled)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: soundFeedbackEnabled
                    ? 'var(--color-accent-subtle)'
                    : 'var(--color-bg-elevated)',
                  color: soundFeedbackEnabled
                    ? 'var(--color-accent)'
                    : 'var(--color-text-secondary)',
                  fontSize: '12px',
                }}
              >
                {soundFeedbackEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button
                onClick={() => setShowSettingsModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-elevated)',
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
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-text-inverse)',
                  fontWeight: 500,
                  fontSize: '13px',
                }}
              >
                Save settings
              </button>
            </div>
          </div>
        </div>
      )}

      {calibrationOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="calibration-title"
          style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--color-bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 110 }}>
          <div style={{ width: '100%', maxWidth: '440px', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-lg)', padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h2 id="calibration-title" style={{ fontSize: '18px' }}>Practice eye control</h2>
            <p>Look at the camera. Close your eyes comfortably, then open them. Repeat five times, with a short break between each try.</p>
            <p style={{ fontWeight: 600 }}>{calibrationSamples.length} of 5 gestures detected</p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{camera.validationMessage}</p>
            {calibrationSamples.length > 0 && <p style={{ fontSize: '12px' }}>Detected holds: {calibrationSamples.map(ms => (ms / 1000).toFixed(2) + 's').join(', ')}</p>}
            {calibrationSuggestion && (
              <p>Suggested minimum hold: {(calibrationSuggestion.minIntentionalBlinkMs / 1000).toFixed(2)} seconds. You can adjust it later in Settings.</p>
            )}
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Only valid, stable SmartSpectra readings count. Practice does not change slides or save video.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={endCalibration}>Cancel</button>
              <button type="button" onClick={() => { setCalibrationSamples([]); controllerRef.current?.setCalibrationMode(true); }}>Try again</button>
              {calibrationSuggestion && <button type="button" onClick={applyCalibration}>Use this timing</button>}
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
                  fontSize: '13px',
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
