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

module.exports = {
  name: 'AnatomiaX',
  url: normalizedUrl,
  // Configurable contact — placeholder until real address is supplied.
  // Footer/contact pages render this with an explicit placeholder notice.
  email: (process.env.CONTACT_EMAIL || 'contact@anatomiax.example').trim(),
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
