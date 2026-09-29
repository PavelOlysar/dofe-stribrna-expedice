// Site-wide settings. The site is hosted on Cloudflare Workers at the root of its address, so PATH_PREFIX
// is normally unset ("/"). SITE_ORIGIN lets a custom domain replace the workers.dev one.
const prefix = process.env.PATH_PREFIX || '/';
const origin = process.env.SITE_ORIGIN || 'https://dofe-stribrna-expedice.olysarp.workers.dev';

export default {
  prefix,
  url: origin + prefix, // absolute URL for link previews, canonical links and the sitemap
  langs: ['cs', 'en'],
  // the footer invites visitors to write to the expedition members
  contact: { email: 'olysarp@gmail.com' }
};
