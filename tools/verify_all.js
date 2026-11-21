const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataPath = path.join(__dirname, '..', 'app', 'data.js');
const reportPath = path.join(__dirname, 'roster_report.json');

if (!fs.existsSync(dataPath)) {
  console.error('ERROR: app/data.js not found:', dataPath);
  process.exit(1);
}

const code = fs.readFileSync(dataPath, 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(code + '\nthis.NIKKE_DATA = NIKKE_DATA;', context);

const chars = context.NIKKE_DATA;
if (!Array.isArray(chars)) {
  console.error('ERROR: NIKKE_DATA is not an array');
  process.exit(1);
}

const VALID_RARITIES = new Set(['SSR', 'SR', 'R']);
const VALID_MANUFACTURERS = new Set(['エリシオン', 'ミシリス', 'テトラ', 'ピルグリム', 'アブノーマル']);
const VALID_WEAPONS = new Set(['AR', 'SMG', 'SG', 'SR', 'RL', 'MG']);
const VALID_BURSTS = new Set(['I', 'II', 'III']);
const VALID_ROLES = new Set(['火力', '防御', '支援']);
const VALID_ELEMENTS = new Set(['灼熱', '水冷', '風圧', '電撃', '鉄甲']);

const seenIds = new Set();
const errors = [];
const warnings = [];

let totalImages = 0;
const rarityCounts = { SSR: 0, SR: 0, R: 0 };
const mfgCounts = {};
const emptyCounts = { cv: 0, squad: 0, skills: 0 };

if (fs.existsSync(reportPath)) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (typeof report.total === 'number' && chars.length !== report.total) {
    errors.push(`Total count mismatch: data.js has ${chars.length}, roster_report.json expects ${report.total}`);
  }
}

chars.forEach((c, idx) => {
  const prefix = `[#${idx} ${c.id || '?'} ${c.name || '?'}]`;

  if (!c.id || typeof c.id !== 'string') {
    errors.push(`${prefix} Missing or invalid id`);
  } else if (seenIds.has(c.id)) {
    errors.push(`${prefix} Duplicate id: ${c.id}`);
  } else {
    seenIds.add(c.id);
  }

  if (!c.name || typeof c.name !== 'string' || !c.name.trim()) {
    errors.push(`${prefix} Missing required field: name`);
  }

  if (!VALID_RARITIES.has(c.rarity)) {
    errors.push(`${prefix} Invalid rarity: ${c.rarity}`);
  } else {
    rarityCounts[c.rarity] += 1;
  }

  if (!VALID_MANUFACTURERS.has(c.manufacturer)) {
    errors.push(`${prefix} Invalid manufacturer: ${c.manufacturer}`);
  } else {
    mfgCounts[c.manufacturer] = (mfgCounts[c.manufacturer] || 0) + 1;
  }

  if (!VALID_WEAPONS.has(c.weapon)) {
    errors.push(`${prefix} Invalid weapon: ${c.weapon}`);
  }

  if (!VALID_BURSTS.has(c.burst)) {
    errors.push(`${prefix} Invalid burst: ${c.burst}`);
  }

  if (!VALID_ROLES.has(c.role)) {
    errors.push(`${prefix} Invalid role: ${c.role}`);
  }

  if (!VALID_ELEMENTS.has(c.element)) {
    errors.push(`${prefix} Invalid element: ${c.element}`);
  }

  if (!c.sourceInfo || typeof c.sourceInfo !== 'object') {
    errors.push(`${prefix} Missing sourceInfo`);
  } else {
    if (!c.sourceInfo.url || !/^https?:\/\//.test(c.sourceInfo.url)) {
      errors.push(`${prefix} Invalid sourceInfo.url: ${c.sourceInfo.url}`);
    }
    if (!c.sourceInfo.date || !/^\d{4}-\d{2}-\d{2}$/.test(c.sourceInfo.date)) {
      errors.push(`${prefix} Invalid sourceInfo.date: ${c.sourceInfo.date}`);
    }
  }

  if (!Array.isArray(c.images)) {
    errors.push(`${prefix} images must be an array`);
  } else if (c.images.length === 0) {
    errors.push(`${prefix} images is empty (0 images)`);
  } else {
    totalImages += c.images.length;
    const labels = new Set();
    c.images.forEach((img, iIdx) => {
      if (!img.label || !img.url || !img.source || !img.credit) {
        errors.push(`${prefix} Image[${iIdx}] missing required metadata (label/url/source/credit)`);
      } else {
        labels.add(img.label);
        if (/(?:^|\b|_)sd(?:_|\b|\.)|chibi/i.test(img.label) || /_SD\.|chibi/i.test(img.url)) {
          errors.push(`${prefix} Image[${iIdx}] appears to be SD image: "${img.label}"`);
        }
      }
    });
    for (const reqLabel of ['立ち絵', '射撃待機', '射撃中']) {
      if (!labels.has(reqLabel)) {
        errors.push(`${prefix} Missing required pose image: ${reqLabel}`);
      }
    }
  }

  if (!c.cv) emptyCounts.cv += 1;
  if (!c.squad) emptyCounts.squad += 1;
  if (!Array.isArray(c.skills)) {
    errors.push(`${prefix} skills must be an array`);
  } else if (c.skills.length === 0) {
    emptyCounts.skills += 1;
    warnings.push(`${prefix} skills is empty`);
  }
});

console.log('=== verify_all.js Report ===');
console.log(`Total characters: ${chars.length}`);
console.log(`Total images: ${totalImages}`);
console.log('By rarity:', rarityCounts);
console.log('By manufacturer:', mfgCounts);
console.log('Empty optional fields:', emptyCounts);

if (warnings.length > 0) {
  console.log(`\nWarnings (${warnings.length}):`);
  warnings.slice(0, 20).forEach(w => console.log('  WARN:', w));
  if (warnings.length > 20) console.log(`  ... and ${warnings.length - 20} more warnings`);
}

if (errors.length > 0) {
  console.error(`\nErrors (${errors.length}):`);
  errors.forEach(e => console.error('  ERR:', e));
  process.exit(1);
}

console.log('\nALL CHECKS PASSED.');
process.exit(0);
