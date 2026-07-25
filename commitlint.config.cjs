// Enforces Conventional Commits so semantic-release can derive the version.
// feat: -> minor, fix:/perf: -> patch, BREAKING CHANGE -> minor (see .releaserc.json).
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 70],
    'scope-empty': [2, 'never'],
  },
};
