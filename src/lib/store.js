const path = require('path');
const { app } = require('electron');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const { hashPassword } = require('./auth');

const userDataPath = app.getPath('userData');
const dbFile = path.join(userDataPath, 'rectify-jabre.json');

const adapter = new FileSync(dbFile);
const db = low(adapter);

db.defaults({
  agents: [],
  pnrs: [],
  rates: null,
  settings: { searchApiKey: null, apifyToken: null },
  liveCache: []
}).write();

// One-time migration: earlier versions shipped two hardcoded demo agents
// with plaintext passwords baked into every install. Upgrade any leftover
// plaintext password on an existing local database to a salted hash so
// nothing plaintext is left sitting on disk, even for old local installs.
const legacyPlaintextAgents = db.get('agents').filter((a) => typeof a.password === 'string').value();
if (legacyPlaintextAgents.length > 0) {
  legacyPlaintextAgents.forEach((agent) => {
    const { salt, hash } = hashPassword(agent.password);
    // `password: undefined` drops the key entirely on the next JSON.stringify
    // (JSON.stringify omits undefined-valued keys) - a simple, reliable way
    // to remove the plaintext field without depending on lodash chain quirks.
    db.get('agents').find({ agentId: agent.agentId })
      .assign({ passwordSalt: salt, passwordHash: hash, password: undefined })
      .write();
  });
}

module.exports = db;
