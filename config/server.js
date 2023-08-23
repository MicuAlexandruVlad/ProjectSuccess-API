module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  // change port to 1337 when in dev
  port: env.int('PORT', 1212),
  // disable url when in dev
  url: 'https://brainspot.app',
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
});
