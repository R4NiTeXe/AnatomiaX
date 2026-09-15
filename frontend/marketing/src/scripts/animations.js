import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

/**
 * AnatomiaX marketing animations
 * - Lenis smooth scroll + GSAP ticker
 * - Hero entrance (once, sequenced timeline with atomic final-state handoff)
 * - Hero ambient: background parallax scrub (transform-only)
 * - Scroll reveals via ScrollTrigger (+ grouped item staggers)
 * - Feature card hover (subtle lift)
 * - Placeholder scan line (lightweight)
 * - Navbar scroll state
 * Respects prefers-reduced-motion (all motion below this guard).
 */
(function () {
  // 8.24.5 development diagnostics — query-gated (?ax-debug=1), zero production
  // UI or console noise otherwise. The harness reads window.__axIntro to prove
  // the intro path executed deterministically on every load.
  const axDebug = /[?&]ax-debug=1(?:&|$)/.test(window.location.search);
  const axState = {
    bootAt: Math.round(performance.now()),
    readyStateAtInit: null,
    reducedMotion: false,
    heroTargetsFound: 0,
    deferredStart: false,
    introStarted: false,
    introStartAt: null,
    introCompleted: false,
    introCompleteAt: null,
  };
  window.__axIntro = axState;
  const axTrace = (event, extra) => {
    if (axDebug) console.info(`[ax-intro] ${event}`, extra ?? '');
  };

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    axState.reducedMotion = true;
    axTrace('reduced-motion: gate released, no timeline');
    document.documentElement.classList.remove('js-anim');
    return;
  }

  function init() {
    axState.readyStateAtInit = document.readyState;
    axTrace('init', { readyState: document.readyState });
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
      // 8.24.5: GSAP default lag smoothing stays ON (the old lagSmoothing(0)
      // disabled it, so any main-thread stall fast-forwarded every tween past
      // its visible progression — the intro could jump straight to its final
      // state on janky loads). With smoothing, stalls pause instead of skip;
      // Lenis resumes smoothly and position-driven scrub tweens are unaffected.

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
      // 8.24.3: single power2.out easing, small distances, staggered beats —
      // calm and cinematic, never flashy. Beats: ambient 0–150ms →
      // kicker 150–350 → headline 300–900 → text 450–850 → CTAs 550–1000 →
      // stats 600–1100 → visual 600–1050.
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
      // 8.24.4: NO per-tween clearProps — clearing inline styles while the
      // `js-anim` gate is still present snaps elements back to the hidden
      // start-state for a frame (the post-settle blink; worse on CTAs, whose
      // CSS `transition: transform` re-animates the snap). Instead the gate
      // is removed and all intro props cleared atomically in the same
      // synchronous onComplete, so the browser never paints in between.
      // 8.24.5: the intro starts only while the page is visible. A
      // background/prerendered tab has no running rAF clock, so starting
      // there would burn the one-shot entrance unseen; the curtain simply
      // holds until the tab is shown.
      const beginIntro = () => {
        axTrace('intro begin (page visible)');
        // Every intro target, collected once for the single atomic cleanup.
        const introTargets = [
          heroBgOnly,
          heroLabelOnly,
          ...heroLines,
          heroTextOnly,
          ...heroCtas,
          ...heroStatsOnly,
          heroVisualOnly,
        ].filter(Boolean);
        axState.heroTargetsFound = introTargets.length;
        axTrace('hero targets collected', { count: introTargets.length });
        const intro = gsap.timeline({
          defaults: { ease: 'power2.out', overwrite: 'auto' },
          onStart: () => {
            axState.introStarted = true;
            axState.introStartAt = Math.round(performance.now());
            axTrace('intro started');
          },
          onComplete: () => {
            document.documentElement.classList.remove('js-anim');
            gsap.set(introTargets, { clearProps: 'all' });
            axState.introCompleted = true;
            axState.introCompleteAt = Math.round(performance.now());
            axTrace('intro completed', {
              durationMs: axState.introCompleteAt - (axState.introStartAt ?? 0),
            });
          },
        });
        if (heroBgOnly) {
          intro.to(heroBgOnly, { opacity: 1, duration: 0.25 }, 0);
        }
        if (heroLabelOnly) {
          intro.to(
            heroLabelOnly,
            { opacity: 1, y: 0, duration: 0.3 },
            0.15
          );
        }
        if (heroLines.length) {
          intro.to(
            heroLines,
            { y: 0, duration: 0.6, stagger: 0.12 },
            0.3
          );
        }
        if (heroTextOnly) {
          intro.to(
            heroTextOnly,
            { opacity: 1, y: 0, duration: 0.4 },
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
            },
            0.55
          );
        }
        if (heroStatsOnly.length) {
          intro.to(
            heroStatsOnly,
            { opacity: 1, y: 0, duration: 0.35, stagger: 0.05 },
            0.6
          );
        }
        if (heroVisualOnly) {
          intro.to(
            heroVisualOnly,
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.45,
            },
            0.6
          );
        }
      };

      if (!hasHero) {
        axTrace('no hero targets — intro skipped');
      } else if (document.visibilityState === 'hidden') {
        // Background/prerendered tab: hold the curtain, play on reveal.
        axState.deferredStart = true;
        axTrace('deferred: tab hidden, curtain holds until visible');
        const onVisible = () => {
          if (document.visibilityState === 'hidden') return;
          document.removeEventListener('visibilitychange', onVisible);
          axTrace('visible: starting intro');
          beginIntro();
        };
        document.addEventListener('visibilitychange', onVisible);
      } else {
        beginIntro();
      }

      // Hero ambient — background parallax scrub only (transform-only, tied
      // to scroll). 8.24.3: the glow float loop is gone — the static brand
      // glow stays as treatment, and nothing ambient competes with the
      // headline, CTAs, or product visual.
      const heroBg = document.querySelector('[data-hero-bg]');
      const heroSection = heroVisualOnly ? heroVisualOnly.closest('section') : null;
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

      // Placeholder scan line — barely-there shimmer so the panel feels alive
      // without pulsing. 8.24.3: slowed well down from the original tempo.
      const scanLine = document.querySelector('[data-placeholder-scan]');
      if (scanLine) {
        gsap.to(scanLine, {
          yPercent: 220,
          duration: 7,
          ease: 'none',
          repeat: -1,
          yoyo: false,
          repeatDelay: 2,
        });
      }

      // Section reveals — subtle: small rise, calm timing.
      const reveals = document.querySelectorAll('[data-reveal]');
      reveals.forEach(el => {
        gsap.from(el, {
          opacity: 0,
          y: 14,
          duration: 0.55,
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
          y: 12,
          duration: 0.5,
          stagger: 0.08,
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

      // Feature card hover — restrained 3px lift (border glow handled in CSS)
      featureCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
          gsap.to(card, { y: -3, duration: 0.28, ease: 'power2.out', overwrite: 'auto' });
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
