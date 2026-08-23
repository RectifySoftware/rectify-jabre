const path = require('path');
const { app } = require('electron');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const userDataPath = app.getPath('userData');
const dbFile = path.join(userDataPath, 'rectify-jabre.json');

const adapter = new FileSync(dbFile);
const db = low(adapter);

db.defaults({
  agents: [
    {
      agentId: '1A2B3C',
      password: 'jabre1',
      name: 'M TRAVIS',
      pcc: '7X4Y',
      dutyCodes: ['AA', 'SUP']
    },
    {
      agentId: 'DEMO01',
      password: 'demo',
      name: 'A DEMO',
      pcc: '9Q1Z',
      dutyCodes: ['AA']
    }
  ],
  pnrs: [],
  rates: null,
  settings: { searchApiKey: null, apifyToken: null },
  liveCache: []
}).write();

module.exports = db;
