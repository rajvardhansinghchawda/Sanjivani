import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

// Assets
import loadAmbulanceIcon from '../assets/load ambulance.png';
import patientStretcherIcon from '../assets/patient stracher.png';

const AmbulanceLoader = ({ onComplete }) => {
  const overlayRef = useRef(null);
  const containerRef = useRef(null);
  const ambulanceClosedRef = useRef(null);
  const stretcherRef = useRef(null);
  const blinkingLightRef = useRef(null);
  const shadowRef = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        // Final fade out of the entire overlay
        gsap.to(overlayRef.current, {
          opacity: 0,
          duration: 0.8,
          ease: 'power2.inOut',
          onComplete: () => {
            if (onComplete) onComplete();
          }
        });
      }
    });

    // --- Initial State ---
    gsap.set(overlayRef.current, { opacity: 1 });
    gsap.set(ambulanceClosedRef.current, { x: '100vw', y: 0, rotation: 0, opacity: 1, filter: 'blur(10px)' });
    gsap.set(stretcherRef.current, { x: '100vw', y: '5vh', opacity: 0, scale: 0.8 }); // Start from right
    gsap.set(shadowRef.current, { opacity: 0, scaleX: 0.5 });
    gsap.set(blinkingLightRef.current, { opacity: 0 });

    // --- 1. Continuous Ambulance Motion (Right -> Center -> Left) ---
    tl.to(ambulanceClosedRef.current, {
      x: '-100vw',
      duration: 5,
      ease: 'power1.inOut',
      onUpdate: () => {
        // Dynamic motion blur based on speed can be simulated with filter
      }
    });

    // Sync Shadow
    tl.to(shadowRef.current, {
      x: '-100vw',
      opacity: 0.3,
      duration: 5,
      ease: 'power1.inOut'
    }, 0);

    // Sync Blinking Light
    tl.to(blinkingLightRef.current, {
      x: '-100vw',
      opacity: 1,
      duration: 5,
      ease: 'power1.inOut',
      onStart: () => {
        gsap.to(blinkingLightRef.current, {
          opacity: 0.2,
          repeat: -1,
          yoyo: true,
          duration: 0.4,
          ease: 'sine.inOut'
        });
      }
    }, 0);

    // --- 2. Stretcher Interaction (Catching up on the fly) ---
    // The stretcher needs to move faster than the ambulance to "catch" the rear
    tl.to(stretcherRef.current, {
      x: '-10vw', // Target point relative to moving ambulance
      opacity: 1,
      duration: 2,
      ease: 'power2.out'
    }, 1) // Start shortly after ambulance enters
    .to(stretcherRef.current, {
      scale: 0.2,
      opacity: 0,
      x: '-30vw', // Move "inside" the already moving ambulance
      duration: 0.8,
      ease: 'power2.in'
    }, '>-0.5');

    return () => {
      tl.kill();
    };
  }, [onComplete]);

  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-white"
      style={{
        background: 'radial-gradient(circle at center, #ffffff 0%, #eef6ff 100%)'
      }}
    >
      {/* Premium UI Feel: Background Blur/Texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
      
      {/* Cinematic Depth Overlay */}
      <div className="absolute inset-0 pointer-events-none backdrop-blur-[2px]"></div>

      <div ref={containerRef} className="relative w-full max-w-4xl h-screen flex flex-col items-center justify-center">
        
        {/* Soft Ambient Shadow */}
        <div 
          ref={shadowRef}
          className="absolute w-64 h-8 bg-black/20 rounded-[100%] blur-xl bottom-[35%] z-0"
        ></div>

        {/* Emergency Light Glow - Positioned roughly where the light is on the icon */}
        <div 
          ref={blinkingLightRef}
          className="absolute w-12 h-12 bg-red-600 rounded-full blur-xl z-20 pointer-events-none"
          style={{ top: 'calc(50% - 85px)', left: 'calc(50% + 40px)' }}
        ></div>

        {/* Ambulance Assets */}
        <img 
          ref={ambulanceClosedRef}
          src={loadAmbulanceIcon} 
          alt="Ambulance" 
          className="absolute w-[450px] object-contain z-10 drop-shadow-2xl"
        />

        {/* Patient Stretcher */}
        <img 
          ref={stretcherRef}
          src={patientStretcherIcon} 
          alt="Stretcher" 
          className="absolute w-40 object-contain z-[5] drop-shadow-xl"
        />

        {/* Loading Text with Glassmorphism */}
        <div className="absolute bottom-20 px-8 py-4 bg-white/30 backdrop-blur-md border border-white/40 rounded-3xl shadow-2xl flex items-center gap-4">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-[#1B4332] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-2 h-2 bg-[#1B4332] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-2 h-2 bg-[#1B4332] rounded-full animate-bounce"></span>
          </div>
          <span className="text-[#1B4332] font-black text-xs uppercase tracking-[0.2em]">Secure Dispatch Portal Initializing</span>
        </div>
      </div>

      <style>{`
        @keyframes scanline {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(100%); }
        }
      `}</style>
    </div>
  );
};

export default AmbulanceLoader;
