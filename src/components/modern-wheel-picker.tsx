"use client";

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface WheelPickerOption {
  value: string;
  label: string;
}

interface ModernWheelPickerProps {
  value: string;
  onValueChange: (value: string) => void;
  options: WheelPickerOption[];
  label?: string;
  suffix?: string;
}

export function ModernWheelPicker({
  value,
  onValueChange,
  options,
  label = 'Ventana de Análisis',
  suffix = 'min',
}: ModernWheelPickerProps) {
  const ITEM_WIDTH = 52;
  const CONTAINER_WIDTH = ITEM_WIDTH * 7;
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentIndex = options.findIndex(opt => opt.value === value);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, currentIndex));
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollStartRef = useRef(0);
  const velocityRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const snapToNearestItem = useCallback(() => {
    if (!scrollRef.current) return;
    const scrollLeft = scrollRef.current.scrollLeft;
    const index = Math.round(scrollLeft / ITEM_WIDTH);
    const clamped = Math.max(0, Math.min(index, options.length - 1));
    setActiveIndex(clamped);
    onValueChange(options[clamped].value);
    scrollRef.current.scrollTo({ left: clamped * ITEM_WIDTH, behavior: 'smooth' });
  }, [options, onValueChange]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    scrollStartRef.current = scrollRef.current?.scrollLeft || 0;
    lastXRef.current = e.clientX;
    lastTimeRef.current = Date.now();
    velocityRef.current = 0;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || !scrollRef.current) return;
    const dx = startXRef.current - e.clientX;
    scrollRef.current.scrollLeft = scrollStartRef.current + dx;
    const now = Date.now();
    const dt = now - lastTimeRef.current;
    if (dt > 0) velocityRef.current = (lastXRef.current - e.clientX) / dt;
    lastXRef.current = e.clientX;
    lastTimeRef.current = now;
  }, []);

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
    if (Math.abs(velocityRef.current) > 0.3) {
      let vel = velocityRef.current * 14;
      const friction = 0.93;
      const animate = () => {
        if (!scrollRef.current || Math.abs(vel) < 0.5) {
          snapToNearestItem();
          return;
        }
        scrollRef.current.scrollLeft += vel;
        vel *= friction;
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
    } else {
      snapToNearestItem();
    }
  }, [snapToNearestItem]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (!scrollRef.current) return;
    scrollRef.current.scrollLeft += e.deltaY > 0 ? ITEM_WIDTH : -ITEM_WIDTH;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(snapToNearestItem, 150);
  }, [snapToNearestItem]);

  const handleScroll = useCallback(() => {
    if (isDraggingRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(snapToNearestItem, 100);
  }, [snapToNearestItem]);

  useEffect(() => {
    const idx = options.findIndex(opt => opt.value === value);
    if (idx >= 0 && idx !== activeIndex) {
      setActiveIndex(idx);
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ left: idx * ITEM_WIDTH, behavior: 'smooth' });
      }
    }
  }, [value, activeIndex, options, ITEM_WIDTH]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const getItemOpacity = (index: number) => {
    const dist = Math.abs(index - activeIndex);
    if (dist === 0) return 1;
    if (dist === 1) return 0.75;
    if (dist === 2) return 0.45;
    return 0.35;
  };

  const getItemScale = (index: number) => {
    const dist = Math.abs(index - activeIndex);
    if (dist === 0) return 1.2;
    if (dist === 1) return 0.92;
    return 0.78;
  };

  return (
    <div className="flex flex-col items-center gap-2 select-none w-full">
      {label && <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-400">{label}</span>}

      <div className="relative mx-auto rounded-2xl" style={{ width: CONTAINER_WIDTH, background: 'linear-gradient(90deg, rgb(245, 245, 245) 0%, rgba(250, 250, 250, 0.96) 100%)', backdropFilter: 'blur(4px)', border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none rounded-l-2xl" style={{ background: 'linear-gradient(to right, rgba(250,250,250,0.95), transparent)' }} />
        <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none rounded-r-2xl" style={{ background: 'linear-gradient(to left, rgba(250,250,250,0.95), transparent)' }} />
        <div className="absolute top-1 bottom-1 z-[5] rounded-xl pointer-events-none" style={{ left: '50%', width: ITEM_WIDTH + 6, transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.055)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)' }} />

        <div ref={scrollRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onScroll={handleScroll} onWheel={handleWheel} className="flex items-center overflow-x-auto cursor-grab active:cursor-grabbing" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory', height: 54, paddingLeft: ITEM_WIDTH * 3, paddingRight: ITEM_WIDTH * 3 }}>
          {options.map((opt, idx) => (
            <div key={opt.value} onClick={() => { setActiveIndex(idx); onValueChange(opt.value); if (scrollRef.current) scrollRef.current.scrollTo({ left: idx * ITEM_WIDTH, behavior: 'smooth' }); }} className="flex-shrink-0 flex items-center justify-center cursor-pointer" style={{ width: ITEM_WIDTH, height: 54, scrollSnapAlign: 'center', opacity: getItemOpacity(idx), transform: `scale(${getItemScale(idx)})`, transition: isDraggingRef.current ? 'none' : 'all 0.25s ease-out' }}>
              <span className={cn('tabular-nums transition-colors duration-150', idx === activeIndex ? 'text-[22px] font-bold text-gray-900' : 'text-[16px] font-medium text-gray-400')} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>{opt.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-xl font-bold text-gray-700 tabular-nums" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>±{options[activeIndex]?.label ?? value}</span>
        <span className="text-xs font-medium text-gray-400">{suffix}</span>
      </div>
    </div>
  );
}
