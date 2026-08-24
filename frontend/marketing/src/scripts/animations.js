import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

/**
 * AnatomiaX marketing animations
 * - Lenis smooth scroll + GSAP ticker
 * - Hero entrance (once)
 * - Scroll reveals via ScrollTrigger
 * - Feature card hover (subtle)
 * - Placeholder scan line (lightweight)
 * - Navbar scroll state
 * Respects prefers-reduced-motion.
 */
(function () {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  function init() {
    const ctx = gsap.context(() => {
      // Lenis
      const lenis = new Lenis({
        duration: 1.1,
        easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        smoothTouch: false,
      });

      lenis.on('scroll', ScrollTrigger.update);

      gsap.ticker.add(time => {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);

      // Navbar subtle scroll state
      const navbar = document.querySelector('[data-navbar]');
      if (navbar) {
        const onScroll = () => {
          if (window.scrollY > 12) {
            navbar.classList.add('is-scrolled');
            navbar.classList.add('shadow-sm');
            navbar.classList.add('bg-base-100/90');
          } else {
            navbar.classList.remove('is-scrolled');
            navbar.classList.remove('shadow-sm');
            navbar.classList.remove('bg-base-100/90');
          }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
      }

      // Hero entrance (once)
      const heroLabel = document.querySelector('[data-hero-label]');
      const heroHeading = document.querySelector('[data-hero-heading]');
      const heroText = document.querySelector('[data-hero-text]');
      const heroActions = document.querySelector('[data-hero-actions]');
      const heroMeta = document.querySelector('[data-hero-meta]');
      const heroVisual = document.querySelector('[data-hero-visual]');

      const heroEls = [heroLabel, heroHeading, heroText, heroActions, heroMeta].filter(Boolean);
      if (heroEls.length) {
        gsap.from(heroEls, {
          opacity: 0,
          y: 10,
          duration: 0.6,
          stagger: 0.08,
          ease: 'power2.out',
          delay: 0.15,
          clearProps: 'all',
        });
      }
      if (heroVisual) {
        gsap.from(heroVisual, {
          opacity: 0,
          y: 12,
          duration: 0.7,
          ease: 'power2.out',
          delay: 0.35,
          clearProps: 'all',
        });
      }

      // Placeholder scan line (lightweight ambient)
      const scanLine = document.querySelector('[data-placeholder-scan]');
      if (scanLine) {
        gsap.to(scanLine, {
          yPercent: 220,
          duration: 3.2,
          ease: 'none',
          repeat: -1,
          yoyo: false,
          repeatDelay: 0.6,
        });
      }

      // Section reveals
      const reveals = document.querySelectorAll('[data-reveal]');
      reveals.forEach(el => {
        gsap.from(el, {
          opacity: 0,
          y: 12,
          duration: 0.6,
          ease: 'power2.out',
          clearProps: 'all',
          scrollTrigger: {
            trigger: el,
            start: 'top 86%',
            once: true,
          },
        });
      });

      // Feature cards stagger
      const featureCards = document.querySelectorAll('[data-feature-card]');
      if (featureCards.length) {
        gsap.from(featureCards, {
          opacity: 0,
          y: 10,
          duration: 0.5,
          stagger: 0.07,
          ease: 'power2.out',
          clearProps: 'all',
          scrollTrigger: {
            trigger: featureCards[0].closest('section') || featureCards[0],
            start: 'top 84%',
            once: true,
          },
        });
      }

      // Feature card hover (subtle)
      featureCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
          gsap.to(card, { y: -2, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
        });
        card.addEventListener('mouseleave', () => {
          gsap.to(card, { y: 0, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
        });
        card.addEventListener('focusin', () => {
          gsap.to(card, { y: -1, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
        });
        card.addEventListener('focusout', () => {
          gsap.to(card, { y: 0, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
        });
      });
    });

    // cleanup on page hide/unload
    window.addEventListener('pagehide', () => ctx.revert());
    window.addEventListener('beforeunload', () => ctx.revert());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
