import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), '.data');
const CONFIG_FILE = join(DATA_DIR, 'config.json');

const DEFAULTS = {
  callmebotApiKey: '',
  managerWhatsApp: '+96898983134',
};

function canUseFs() {
  return process.env.LOCAL_DEV === 'true' || process.env.VERCEL !== '1';
}

export function getConfig() {
  if (!canUseFs()) {
    return {
      ...DEFAULTS,
      managerWhatsApp: process.env.MANAGER_WHATSAPP || DEFAULTS.managerWhatsApp,
      callmebotApiKey: process.env.CALLMEBOT_APIKEY || '',
    };
  }

  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (!existsSync(CONFIG_FILE)) {
      writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULTS, null, 2), 'utf8');
    }
    return { ...DEFAULTS, ...JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function updateConfig(patch) {
  if (!canUseFs()) {
    // On Vercel, configure via Environment Variables instead.
    return getConfig();
  }
  const next = { ...getConfig(), ...patch };
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
