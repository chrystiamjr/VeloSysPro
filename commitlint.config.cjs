// Enforces Conventional Commits so semantic-release can derive the version.
// feat: -> patch (0.x), fix:/perf: -> patch, BREAKING CHANGE -> minor (see .releaserc.json).
module.exports = {
  extends: ['@commitlint/config-conventional'],
};
