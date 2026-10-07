const rawUrl = (process.env.SITE_URL || process.env.URL || 'https://anatomiax.example').trim();
const normalizedUrl = rawUrl.replace(/\/+$/, '');

const rawAppUrl = (process.env.APP_URL || '').trim();
const appUrl = rawAppUrl.replace(/\/+$/, '');

module.exports = {
  name: 'AnatomiaX',
  url: normalizedUrl,
  email: (process.env.CONTACT_EMAIL || 'contact@anatomiax.example').trim(),
  appUrl,
  loginUrl: appUrl ? `${appUrl}/login` : '/contact/',
  getStartedUrl: appUrl ? `${appUrl}/register` : '/contact/',
  description:
    'Interactive 3D human anatomy and AI-assisted medical education for students, educators, and lifelong learners.',
  language: 'en',
  ogImage: '/og-image.png',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'AnatomiaX — 3D Human Anatomy & AI Medical Learning',
  twitterCard: 'summary_large_image',
  themeColor: '#0f172a',
  organization: {
    name: 'AnatomiaX',
    url: normalizedUrl,
    logo: `${normalizedUrl}/og-image.png`,
  },
};
