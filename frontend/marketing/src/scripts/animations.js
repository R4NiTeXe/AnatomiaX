import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

/**
 * AnatomiaX marketing animations
 * - Lenis smooth scroll + GSAP ticker
 * - Hero entrance (once, sequenced with stat strip + visual scale)
 * - Hero ambient: background parallax scrub + glow float (transform-only)
 * - Scroll reveals via ScrollTrigger (+ grouped item staggers)
 * - Feature card hover (subtle lift)
 * - Placeholder scan line (lightweight)
 * - Navbar scroll state
 * Respects prefers-reduced-motion (all motion below this guard).
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

      // Hero entrance (once) — headlined sequence with stat strip + visual
      const heroLabel = document.querySelector('[data-hero-label]');
      const heroHeading = document.querySelector('[data-hero-heading]');
      const heroText = document.querySelector('[data-hero-text]');
      const heroActions = document.querySelector('[data-hero-actions]');
      const heroMeta = document.querySelector('[data-hero-meta]');
      const heroVisual = document.querySelector('[data-hero-visual]');
      const heroStats = document.querySelectorAll('[data-hero-stats] > *');

      const heroEls = [heroLabel, heroHeading, heroText, heroActions].filter(Boolean);
      if (heroEls.length) {
        gsap.from(heroEls, {
          opacity: 0,
          y: 14,
          duration: 0.7,
          stagger: 0.12,
          ease: 'power2.out',
          delay: 0.15,
          clearProps: 'all',
        });
      }
      if (heroMeta && !heroStats.length) {
        gsap.from(heroMeta, {
          opacity: 0,
          y: 10,
          duration: 0.6,
          ease: 'power2.out',
          delay: 0.6,
          clearProps: 'all',
        });
      }
      if (heroStats.length) {
        gsap.from(heroStats, {
          opacity: 0,
          y: 10,
          duration: 0.55,
          stagger: 0.09,
          ease: 'power2.out',
          delay: 0.55,
          clearProps: 'all',
        });
      }
      if (heroVisual) {
        gsap.from(heroVisual, {
          opacity: 0,
          y: 16,
          scale: 0.985,
          duration: 0.8,
          ease: 'power2.out',
          delay: 0.4,
          clearProps: 'all',
        });
      }

      // Hero ambient — background parallax scrub + glow float.
      // Transform-only; scrub tied to scroll, float is a cheap yoyo loop.
      const heroBg = document.querySelector('[data-hero-bg]');
      const heroSection = heroVisual ? heroVisual.closest('section') : null;
      if (heroBg && heroSection) {
        gsap.to(heroBg, {
          yPercent: 12,
          ease: 'none',
          scrollTrigger: {
            trigger: heroSection,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });
      }
      const heroGlow = document.querySelector('[data-hero-glow]');
      if (heroGlow) {
        gsap.to(heroGlow, {
          y: -12,
          duration: 6,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
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
          y: 16,
          duration: 0.65,
          ease: 'power2.out',
          clearProps: 'all',
          scrollTrigger: {
            trigger: el,
            start: 'top 86%',
            once: true,
          },
        });
      });

      // Grouped reveals — [data-reveal-item] children cascade under one trigger
      const revealGroups = document.querySelectorAll('[data-reveal-group]');
      revealGroups.forEach(group => {
        const items = group.querySelectorAll('[data-reveal-item]');
        if (!items.length) return;
        gsap.from(items, {
          opacity: 0,
          y: 14,
          duration: 0.55,
          stagger: 0.09,
          ease: 'power2.out',
          clearProps: 'all',
          scrollTrigger: {
            trigger: group,
            start: 'top 85%',
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

      // Feature card hover (lift; border glow handled in CSS)
      featureCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
          gsap.to(card, { y: -4, duration: 0.28, ease: 'power2.out', overwrite: 'auto' });
        });
        card.addEventListener('mouseleave', () => {
          gsap.to(card, { y: 0, duration: 0.28, ease: 'power2.out', overwrite: 'auto' });
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
