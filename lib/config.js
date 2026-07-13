import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), '.data');
const CONFIG_FILE = join(DATA_DIR, 'config.json');

const DEFAULTS = {
  callmebotApiKey: '',
  managerWhatsApp: '+96898983134',
};

function ensure() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(CONFIG_FILE)) {
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULTS, null, 2), 'utf8');
  }
}

export function getConfig() {
  ensure();
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function updateConfig(patch) {
  const next = { ...getConfig(), ...patch };
  ensure();
  writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
