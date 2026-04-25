const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'data.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return { accessTokens: [], tellerTokens: [], snapshots: [], budgetLimits: {} };
  }
}

function save(app) {
  const existing = load();
  fs.writeFileSync(FILE, JSON.stringify({
    accessTokens: app.locals.accessTokens || [],
    tellerTokens: app.locals.tellerTokens || [],
    snapshots: app.locals.snapshots || existing.snapshots || [],
    budgetLimits: app.locals.budgetLimits || existing.budgetLimits || {},
    goals: app.locals.goals || existing.goals || [],
  }, null, 2));
}

module.exports = { load, save };
