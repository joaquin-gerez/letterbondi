import { useEffect, useState } from 'react';
import type { PlatformStats } from '../../shared/types';

const HERO_IMAGES = [
  '/bondis/1.jpg',
  '/bondis/2.jpg',
  '/bondis/3.jpg',
  '/bondis/4.jpg',
  '/bondis/5.jpg',
  '/bondis/6.jpg',
  '/bondis/7.jpg',
  '/bondis/8.jpg',
  '/bondis/9.jpg',
  '/bondis/10.jpg',
  '/bondis/11.jpg',
  '/bondis/12.jpg',
  '/bondis/13.jpg',
  '/bondis/14.jpg',
  '/bondis/15.jpg',
  '/bondis/16.jpg',
  '/bondis/17.jpg',
];

function randomImageExcept(excluded: number): number {
  if (HERO_IMAGES.length < 2) return 0;
  const candidate = Math.floor(Math.random() * (HERO_IMAGES.length - 1));
  return candidate >= excluded ? candidate + 1 : candidate;
}

export function HomeHero({ stats, onLogTrip }: { stats: PlatformStats | null; onLogTrip: () => void }) {
  const [carousel, setCarousel] = useState(() => {
    const current = Math.floor(Math.random() * HERO_IMAGES.length);
    return { previous: null as number | null, current, next: randomImageExcept(current) };
  });

  useEffect(() => {
    const nextImage = new Image();
    nextImage.src = HERO_IMAGES[carousel.next]!;
  }, [carousel.next]);

  useEffect(() => {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setCarousel((current) => ({ previous: current.current, current: current.next, next: randomImageExcept(current.next) }));
    }, 5400);
    return () => window.clearInterval(timer);
  }, []);

  const visibleImages = Array.from(new Set([carousel.previous, carousel.current, carousel.next])).filter((index): index is number => index !== null);

  return (
    <section className="home-hero" aria-labelledby="page-title">
      <div className="hero-media" aria-hidden="true">
        {visibleImages.map((index) => (
          <img className={`hero-image ${carousel.current === index ? 'is-current' : ''}`} src={HERO_IMAGES[index]} alt="" key={HERO_IMAGES[index]} loading={carousel.current === index ? 'eager' : 'lazy'} fetchPriority={carousel.previous === null && carousel.current === index ? 'high' : 'auto'} />
        ))}
      </div>
      <div className="hero-shade" aria-hidden="true" />
      <div className="hero-content">
        <h1 id="page-title">
          <span>Trackeá los bondis que tomaste.</span>
          <span>Guardá los que te querés subir.</span>
          <span>Contale al resto cómo estuvo.</span>
        </h1>
        <button className="hero-action" onClick={onLogTrip}>Reseñar un viaje</button>
        <p className="hero-count" aria-label="Estado del archivo">
          {stats ? `${stats.lineCount} servicios · ${stats.provinceCount} provincias · ${stats.logCount} viajes registrados` : 'Cargando el archivo nacional…'}
        </p>
      </div>
    </section>
  );
}
