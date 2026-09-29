// Site-wide settings. PATH_PREFIX is set by the GitHub Action (the site lives at /dofe-stribrna-expedice/
// on GitHub Pages); locally it's "/". SITE_ORIGIN lets a custom domain replace the GitHub Pages one.
const prefix = process.env.PATH_PREFIX || '/';
const origin = process.env.SITE_ORIGIN || 'https://pavelolysar.github.io';

export default {
  prefix,
  url: origin + (process.env.PATH_PREFIX || '/dofe-stribrna-expedice/'), // absolute URL for link previews
  langs: ['cs', 'en'],
  contact: {
    name: 'Pavel Olysar',
    web: 'https://pavelolysar.com',
    webLabel: 'pavelolysar.com',
    email: 'olysarp@gmail.com'
  }
};
