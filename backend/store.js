const fs = require('fs');
const path = require('path');

const FILE = path.join(process.env.USER_DATA_PATH || __dirname, 'data.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return { accessTokens: [], tellerTokens: [], snapshots: [], budgetLimits: {}, goals: [], notificationPrefs: {}, feedback: [] };
  }
}

function save(app) {
  const existing = load();
  fs.writeFileSync(FILE, JSON.stringify({
    accessTokens:      app.locals.accessTokens      || [],
    tellerTokens:      app.locals.tellerTokens      || [],
    snapshots:         app.locals.snapshots         || existing.snapshots         || [],
    budgetLimits:      app.locals.budgetLimits      || existing.budgetLimits      || {},
    goals:             app.locals.goals             || existing.goals             || [],
    notificationPrefs: app.locals.notificationPrefs || existing.notificationPrefs || {},
    feedback:          app.locals.feedback          || existing.feedback          || [],
  }, null, 2));
}

module.exports = { load, save };
