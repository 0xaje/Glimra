export interface PresentationState {
  isLoaded: boolean;
  fileName: string | null;
  totalSlides: number;
  currentSlide: number;
  isFullscreen: boolean;
}

export type GestureType = 'prolonged-blink' | 'double-blink' | 'head-motion';

export interface GestureFeedback {
  type: GestureType;
  timestamp: number;
  label: string;
}

export type TrackingStatus = 'idle' | 'initializing' | 'tracking' | 'paused' | 'error';

export interface CameraState {
  isActive: boolean;
  status: TrackingStatus;
  faceDetected: boolean;
  validationMessage: string;
  lastGesture: GestureFeedback | null;
}
