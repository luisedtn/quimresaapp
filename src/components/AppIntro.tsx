import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import videoSrc from '../assets/logoQuimresa.mp4';
import splashSrc from '../assets/splash.png';

type IntroPhase = 'video' | 'logo';

const LOGO_HOLD_MS = 1700;
const EXIT_FADE_MS = 550;
const VIDEO_SAFETY_MS = 12000;
const NATIVE_SPLASH_MAX_MS = 3500;
const HINT_HIDE_MS = 2600;
const REVEAL_DELAY_MS = 120;

interface AppIntroProps {
  onDone: () => void;
}

/**
 * Pantalla de introduccion de la app.
 * Secuencia: animacion logoQuimresa.mp4 -> splash.png -> app.
 * El video se reproduce con sonido (autoplay habilitado en el WebView de
 * Android desde MainActivity); si un navegador bloquea el autoplay con sonido,
 * se reproduce mudo y el primer gesto lo activa.
 * El splash nativo de Android se mantiene visible (fondo blanco) hasta que el
 * video esta listo, para que la reproduccion comience en el mismo instante en
 * que desaparece.
 */
export default function AppIntro({ onDone }: AppIntroProps) {
  const [phase, setPhase] = useState<IntroPhase>('video');
  const [exiting, setExiting] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [videoDuration, setVideoDuration] = useState(8);
  const [videoReady, setVideoReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onDoneRef = useRef(onDone);
  const exitingRef = useRef(false);
  const finishedRef = useRef(false);
  const audioBlockedRef = useRef(false);

  onDoneRef.current = onDone;

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    document.documentElement.classList.remove('intro-loading');
    onDoneRef.current();
  }, []);

  const startExit = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    document.documentElement.classList.remove('intro-loading');
    setExiting(true);
    window.setTimeout(finish, EXIT_FADE_MS);
  }, [finish]);

  const goToLogo = useCallback(() => {
    if (exitingRef.current) return;
    const video = videoRef.current;
    if (video && !video.paused) video.pause();
    setPhase('logo');
    setShowHint(false);
  }, []);

  const handleSkip = useCallback(() => {
    if (exitingRef.current) return;
    const video = videoRef.current;
    // Si el autoplay con sonido fue bloqueado, el primer gesto activa el
    // audio (sin saltar el video); los siguientes gestos si saltan.
    if (video && audioBlockedRef.current && video.muted) {
      video.muted = false;
      audioBlockedRef.current = false;
      void video.play().catch(() => undefined);
      return;
    }
    if (video && !video.paused) video.pause();
    startExit();
  }, [startExit]);

  const revealTimerRef = useRef<number | undefined>(undefined);

  /**
   * Android WebView pinta un placeholder (icono de play) mientras el video no
   * tiene su primer fotograma decodificado. El elemento se mantiene invisible
   * hasta entonces y se revela con una pequena pausa, cuando el fotograma ya
   * esta pintado, evitando asi el parpadeo.
   */
  const revealVideo = useCallback(() => {
    if (exitingRef.current || finishedRef.current) return;
    window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = window.setTimeout(() => setVideoReady(true), REVEAL_DELAY_MS);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.classList.remove('intro-loading');
      window.clearTimeout(revealTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSkip]);

  useEffect(() => {
    if (phase !== 'video') return;
    const video = videoRef.current;
    let cancelled = false;
    let started = false;

    const startPlayback = async () => {
      if (cancelled || started) return;
      started = true;
      try {
        if (Capacitor.isNativePlatform()) {
          await Promise.race([
            SplashScreen.hide(),
            new Promise<void>(resolve => window.setTimeout(resolve, 700)),
          ]);
        }
      } catch {
        // Sin splash nativo (navegador): continuar con la reproduccion
      }
      if (cancelled || !video) return;
      try {
        video.muted = false;
        await video.play();
      } catch {
        if (cancelled) return;
        // Autoplay con sonido bloqueado (politica de autoplay del navegador):
        // reproducir sin audio para no perder el video; el primer gesto lo
        // activara con sonido (ver handleSkip).
        try {
          video.muted = true;
          audioBlockedRef.current = true;
          await video.play();
        } catch {
          goToLogo();
        }
      }
    };

    const handleCanPlay = () => {
      void startPlayback();
    };
    const handleEnded = () => goToLogo();
    const handleVideoError = () => goToLogo();
    const handleMetadata = () => {
      if (video && Number.isFinite(video.duration) && video.duration > 0) {
        setVideoDuration(video.duration);
      }
    };

    const splashSafety = window.setTimeout(() => void startPlayback(), NATIVE_SPLASH_MAX_MS);
    const durationSafety = window.setTimeout(goToLogo, VIDEO_SAFETY_MS);
    const hintTimer = window.setTimeout(() => setShowHint(false), HINT_HIDE_MS);

    video?.addEventListener('canplay', handleCanPlay);
    video?.addEventListener('ended', handleEnded);
    video?.addEventListener('error', handleVideoError);
    video?.addEventListener('loadedmetadata', handleMetadata);

    if (video && video.readyState >= 2) {
      revealVideo();
      if (video.readyState >= 3) {
        handleMetadata();
        void startPlayback();
      }
    }

    return () => {
      cancelled = true;
      window.clearTimeout(splashSafety);
      window.clearTimeout(durationSafety);
      window.clearTimeout(hintTimer);
      video?.removeEventListener('canplay', handleCanPlay);
      video?.removeEventListener('ended', handleEnded);
      video?.removeEventListener('error', handleVideoError);
      video?.removeEventListener('loadedmetadata', handleMetadata);
    };
  }, [phase, goToLogo, revealVideo]);

  useEffect(() => {
    if (phase !== 'logo') return;
    const timer = window.setTimeout(startExit, LOGO_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [phase, startExit]);

  return (
    <div
      className="app-intro"
      style={{ opacity: exiting ? 0 : 1 }}
      onClick={handleSkip}
      role="presentation"
    >
      {phase === 'video' ? (
        <>
          <video
            ref={videoRef}
            className="app-intro__video"
            src={videoSrc}
            autoPlay
            playsInline
            preload="auto"
            disablePictureInPicture
            onLoadedData={revealVideo}
          />
          {/* Cubierta blanca: oculta el placeholder (icono de play) que el
              WebView de Android pinta hasta decodificar el primer fotograma */}
          <div className={`app-intro__cover${videoReady ? ' app-intro__cover--hidden' : ''}`} />
        </>
      ) : (
        <img className="app-intro__logo" src={splashSrc} alt="Quimresa" draggable={false} />
      )}

      {phase === 'video' && showHint && !exiting && (
        <span className="app-intro__hint">Toca para saltar</span>
      )}

      {phase === 'video' && !exiting && (
        <div className="app-intro__progress">
          <div
            className="app-intro__progress-bar"
            style={{ animationDuration: `${videoDuration}s` }}
          />
        </div>
      )}
    </div>
  );
}
