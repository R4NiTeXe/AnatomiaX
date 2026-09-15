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
  if (prefersReduced) {
    document.documentElement.classList.remove('js-anim');
    return;
  }

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

      // Hero entrance (once) — one timeline so the first viewport builds in
      // deliberate beats (~1s total). CSS (via the `js-anim` gate) already
      // holds every start-state pre-paint, so these `to` tweens can never
      // flash or flicker — without JS everything simply stays visible.
      // Beats: ambient 0–150ms → kicker 150–350 → headline 300–800 →
      // text 450–850 → CTAs 550–950 → stats 650–1000 → visual 600–1050.
      const heroBgOnly = document.querySelector('[data-hero-bg]');
      const heroLabelOnly = document.querySelector('[data-hero-label]');
      const heroLines = document.querySelectorAll('.hero-line');
      const heroTextOnly = document.querySelector('[data-hero-text]');
      const heroCtas = document.querySelectorAll('[data-hero-actions] > *');
      const heroStatsOnly = document.querySelectorAll('[data-hero-stats] > *');
      const heroVisualOnly = document.querySelector('[data-hero-visual]');
      const hasHero =
        heroBgOnly ||
        heroLabelOnly ||
        heroLines.length ||
        heroTextOnly ||
        heroCtas.length ||
        heroStatsOnly.length ||
        heroVisualOnly;
      if (hasHero) {
        const intro = gsap.timeline({
          defaults: { ease: 'power2.out', overwrite: 'auto' },
          // Belt-and-braces: drop the pre-paint gate once the intro lands so
          // no CSS start-state can ever re-apply (clearProps already restores
          // natural inline values first).
          onComplete: () => document.documentElement.classList.remove('js-anim'),
        });
        if (heroBgOnly) {
          intro.to(heroBgOnly, { opacity: 1, duration: 0.25, clearProps: 'opacity' }, 0);
        }
        if (heroLabelOnly) {
          intro.to(
            heroLabelOnly,
            { opacity: 1, y: 0, duration: 0.3, clearProps: 'opacity,transform' },
            0.15
          );
        }
        if (heroLines.length) {
          intro.to(
            heroLines,
            { y: 0, duration: 0.55, stagger: 0.12, ease: 'power3.out', clearProps: 'transform' },
            0.3
          );
        }
        if (heroTextOnly) {
          intro.to(
            heroTextOnly,
            { opacity: 1, y: 0, duration: 0.4, clearProps: 'opacity,transform' },
            0.45
          );
        }
        if (heroCtas.length) {
          intro.to(
            heroCtas,
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.35,
              stagger: 0.1,
              clearProps: 'opacity,transform',
            },
            0.55
          );
        }
        if (heroStatsOnly.length) {
          intro.to(
            heroStatsOnly,
            { opacity: 1, y: 0, duration: 0.4, stagger: 0.07, clearProps: 'opacity,transform' },
            0.65
          );
        }
        if (heroVisualOnly) {
          intro.to(
            heroVisualOnly,
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.5,
              ease: 'power3.out',
              clearProps: 'opacity,transform',
            },
            0.6
          );
        }
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
