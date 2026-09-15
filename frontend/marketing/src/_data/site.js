/**
 * Site configuration — single configurable URL, provider-neutral.
 * Production: set SITE_URL (or URL) env var to the canonical HTTPS origin.
 * No example.com placeholder is emitted; local fallback is a clearly
 * non-production placeholder (https://anatomiax.example) that is never
 * presented as real contact information.
 *
 * Contact email is also configurable and marked as placeholder until a real
 * address is supplied. No company address/legal entity is invented here.
 */
const rawUrl = (process.env.SITE_URL || process.env.URL || 'https://anatomiax.example').trim();
const normalizedUrl = rawUrl.replace(/\/+$/, '');

// App origin for Login/Get Started CTAs (empty = fall back to /contact/).
// Set APP_URL to the deployed web-app origin (e.g. https://app.<domain>) so
// marketing Login reaches <app>/login and Get Started reaches <app>/register.
// No production domain is invented here; unset keeps current contact fallback.
const rawAppUrl = (process.env.APP_URL || '').trim();
const appUrl = rawAppUrl.replace(/\/+$/, '');

module.exports = {
  name: 'AnatomiaX',
  url: normalizedUrl,
  // Configurable contact — placeholder until real address is supplied.
  // Footer/contact pages render this with an explicit placeholder notice.
  email: (process.env.CONTACT_EMAIL || 'contact@anatomiax.example').trim(),
  // Marketing-to-app journey (see _includes navbar/footer, src/index.njk).
  appUrl,
  loginUrl: appUrl ? `${appUrl}/login` : '/contact/',
  getStartedUrl: appUrl ? `${appUrl}/register` : '/contact/',
  description:
    'Interactive 3D human anatomy and AI-assisted medical education for students, educators, and lifelong learners.',
  language: 'en',
  // Open Graph / Twitter — single image served from /public
  ogImage: '/og-image.png',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'AnatomiaX — 3D Human Anatomy & AI Medical Learning',
  twitterCard: 'summary_large_image',
  // Theme — matches Tailwind daisyUI light
  themeColor: '#0f172a',
  // Organization — minimal, no invented legal details
  organization: {
    name: 'AnatomiaX',
    url: normalizedUrl,
    logo: `${normalizedUrl}/og-image.png`,
  },
};
