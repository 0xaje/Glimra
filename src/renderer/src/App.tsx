import React, { useState, useEffect, useRef } from 'react';
import { Eye, FolderOpen, BookOpen, Settings2, Sun, Moon, ChevronLeft, ChevronRight, Maximize2, Camera, CameraOff, PanelLeftClose, PanelLeftOpen, Presentation, MonitorOff, Timer, X } from 'lucide-react';
import { PresentationState, CameraState, GestureFeedback } from './types';
import { loadPresentationFromBuffer, PresentationDocument } from './engine/pdfEngine';
import { SlideViewer } from './components/SlideViewer';
import { SlideThumbnail } from './components/SlideThumbnail';
import { CameraPreview } from './components/CameraPreview';
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
  const [theme, setTheme] = useState<'dark' | 'light'>(() => { try { return localStorage.getItem('glimra-theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } });
  const [showSlides, setShowSlides] = useState(true);
  const [showCameraSetup, setShowCameraSetup] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const [apiKey, setApiKey] = useState('');
  const [sensitivity, setSensitivity] = useState<GestureSensitivity>('standard');
  const [soundFeedbackEnabled, setSoundFeedbackEnabled] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<SmartSpectraController | null>(null);

  useEffect(() => { try { localStorage.setItem('glimra-theme', theme); } catch { /* preference storage unavailable */ } }, [theme]);
  useEffect(() => {
    if (!presentation.isLoaded) return;
    const id = window.setInterval(() => setSeconds(value => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [presentation.isLoaded]);
  const timeLabel = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
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
          isActive: false,
          faceDetected: false,
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
      setSeconds(0);
    } catch (err: unknown) {
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
            <PresenterHUD camera={camera} chargeRatio={chargeRatio} videoStream={videoStream} onTogglePause={toggleGesturePause}/>
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
              <SlideViewer document={pdfDoc} currentSlide={presentation.currentSlide} totalSlides={presentation.totalSlides} fileName={presentation.fileName} onNext={nextSlide} onPrev={prevSlide} onJumpToSlide={jumpToSlide} onToggleFullscreen={toggleFullscreen} isFullscreen={presentation.isFullscreen} isBlackout={isBlackout} onToggleBlackout={toggleBlackout} embedded={!presentation.isFullscreen}/>
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
                {camera.status==='tracking'&&camera.faceDetected?<Camera size={16}/>:<CameraOff size={16}/>}
                <span>{camera.status==='tracking'&&camera.faceDetected?'Hands-free active':camera.status==='initializing'?'Connecting camera…':camera.status==='error'?'Camera error':camera.status==='paused'?'Hands-free paused':'Hands-free off'}</span>
              </button>
            </div>
            <div className="footer-group">
              {presentation.isLoaded && <><span className="timer-readout"><Timer size={15}/>{timeLabel}</span><button className="icon-button" aria-label={isBlackout?'Resume screen':'Blank screen'} title="Blank screen (B)" onClick={toggleBlackout}><MonitorOff size={18}/></button><button className="icon-button" aria-label="Toggle fullscreen" onClick={toggleFullscreen}><Maximize2 size={18}/></button></>}
              {!presentation.isLoaded && <button className="footer-setup" onClick={() => setShowCameraSetup(true)}>Set up camera <ChevronRight size={15}/></button>}
            </div>
          </footer>}
        </section>
      </div>
      {showCameraSetup && <div className="studio-scrim" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)setShowCameraSetup(false)}}>
        <section className="camera-panel" role="dialog" aria-modal="true" aria-labelledby="camera-setup-title">
          <div className="panel-head"><div><h2 id="camera-setup-title">Set up hands-free control</h2></div><button className="icon-button" aria-label="Close camera setup" onClick={()=>setShowCameraSetup(false)}><X size={20}/></button></div>
          <p className="panel-description">Connect your camera and choose how long to close your eyes to change slides.</p>
          <CameraPreview stream={videoStream}/>
          <div className="panel-field"><label>Camera status</label><p>{camera.validationMessage}</p></div>
          <div className="panel-field"><label>Blink sensitivity</label><div className="sensitivity-options">{(['responsive','standard','deliberate'] as GestureSensitivity[]).map(option=><button key={option} className={sensitivity===option?'active':''} onClick={()=>handleSensitivityChange(option)}>{option[0].toUpperCase()+option.slice(1)}<small>{SENSITIVITY_DWELL_MAP[option]} ms</small></button>)}</div><p>Choose a slower setting if slides change too easily.</p></div>
          <button className="primary-button panel-primary" onClick={async()=>{await handleEnableCameraClick();setShowCameraSetup(false)}}>{camera.isActive?'Disconnect camera':'Connect camera'}</button>
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
              Glimra recognizes intentional eye gestures to give you confident, touch-free control
              while addressing an audience. Natural involuntary blinks are filtered out.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-accent)' }}>
                  Next slide: intentional dwell blink
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Close eyes deliberately for approximately 380 milliseconds. The HUD charge bar indicates
                  the dwell progress before advancing the slide.
                </div>
              </div>

              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-signal-warning)' }}>
                  Previous slide: quick double-blink
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Perform two crisp consecutive blinks within half a second to step backwards.
                </div>
              </div>

              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  Presenter shortcuts & fallbacks
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: 1.6 }}>
                  Right Arrow / Page Down: Next slide<br />
                  Left Arrow / Page Up: Previous slide<br />
                  Space or P: Pause / Resume eye gesture detection<br />
                  B or period: Blackout / blank screen<br />
                  F: Toggle fullscreen presentation
                </div>
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

            {/* Gesture Sensitivity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
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
                {sensitivity === 'responsive' && '320ms intentional dwell for rapid presenters.'}
                {sensitivity === 'standard' && '380ms dwell balanced for natural speech pacing.'}
                {sensitivity === 'deliberate' && '460ms dwell preventing accidental triggers.'}
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
