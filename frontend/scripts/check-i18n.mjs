// Vérifie que chaque texte traduit du site a son équivalent anglais.
//   node scripts/check-i18n.mjs        (depuis frontend/)
// Repère les textes passés au pipe « | t » (y compris « (a ? 'x' : 'y') | t »),
// à t('…') / translate('…') et les champs marqués « i18n » (label/title/text…) ;
// signale ceux absents de src/app/core/i18n-en.ts, et les {paramètres} différents.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP = new URL('../src/app/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const DICT = join(APP, 'core', 'i18n-en.ts');

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|html)$/.test(name) && !name.endsWith('.spec.ts') && path !== DICT && name !== 'i18n.ts') files.push(path);
  }
})(APP);

const unquote = (lit) => {
  const q = lit[0];
  return lit.slice(1, -1).replace(new RegExp('\\\\' + q, 'g'), q).replace(/\\\\/g, '\\');
};
const LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g;

// Clés dont la valeur n'est pas un texte affiché (identifiants, routes, icônes…)
const TECHNICAL_KEYS = new Set(['value', 'id', 'icon', 'slug', 'path', 'redirectTo', 'pathMatch', 'group', 'kind', 'key', 'tone', 'status', 'url', 'href', 'sort', 'cls', 'class']);
const used = new Map(); // texte → fichier
const add = (text, file) => {
  if (text.trim() && !used.has(text)) used.set(text, file);
};

for (const file of files) {
  // &quot; : guillemets dans un attribut de template (texte contenant une apostrophe)
  const src = readFileSync(file, 'utf8').replaceAll('&quot;', '"');
  // 1. … | t   (pas | tnd)
  for (const m of src.matchAll(/\|\s*t\b(?!nd)/g)) {
    let i = m.index - 1;
    while (i >= 0 && /\s/.test(src[i])) i--;
    if (src[i] === "'" || src[i] === '"') {
      const q = src[i];
      let j = i - 1;
      while (j >= 0 && !(src[j] === q && src[j - 1] !== '\\')) j--;
      add(unquote(src.slice(j, i + 1)), file);
    } else if (src[i] === ')') {
      let depth = 0;
      let j = i;
      for (; j >= 0; j--) {
        if (src[j] === ')') depth++;
        else if (src[j] === '(' && --depth === 0) break;
      }
      // Littéraux du groupe, sauf ceux d'une comparaison (=== 'dark')
      const group = src.slice(j, i + 1);
      for (const m2 of group.matchAll(LITERAL)) {
        if (/[!=]==?\s*$/.test(group.slice(0, m2.index))) continue;
        add(unquote(m2[0]), file);
      }
    }
  }
  // 2. t('…'), translate('…'), i18n.t('…')
  for (const m of src.matchAll(/\b(?:t|translate)\(\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`[^`$]*`)/g)) {
    add(unquote(m[1]), file);
  }
  // 3 bis. Lignes annotées « // traduit à l'affichage » (texte gardé en français puis passé au pipe)
  for (const line of src.matchAll(/^.*\/\/ traduit à l'affichage.*$/gm)) {
    for (const lit of line[0].split('//')[0].match(LITERAL) ?? []) add(unquote(lit), file);
  }
  // 3. Blocs marqués « // i18n … // /i18n » : toutes les valeurs « clé: 'texte' », sauf les clés techniques
  for (const block of src.matchAll(/\/\/ i18n\b[^\n]*\n([\s\S]*?)\n\s*\/\/ \/i18n/g)) {
    for (const m of block[1].matchAll(/([\w$]+|'[^'\n]*')\s*:\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")/g)) {
      if (TECHNICAL_KEYS.has(m[1])) continue;
      add(unquote(m[2]), file);
    }
    // switch … return 'texte'
    for (const m of block[1].matchAll(/\breturn\s+('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")/g)) add(unquote(m[1]), file);
    // Listes de textes : une ligne = un littéral
    for (const m of block[1].matchAll(/^\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"),?\s*$/gm)) add(unquote(m[1]), file);
  }
}

const dictSrc = readFileSync(DICT, 'utf8');
const dict = new Map();
for (const m of dictSrc.matchAll(/^\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|[\wÀ-ÿ]+)\s*:\s*\n?\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*,/gm)) {
  const key = /^['"]/.test(m[1]) ? unquote(m[1]) : m[1];
  dict.set(key, unquote(m[2]));
}

let missing = 0;
let params = 0;
for (const [text, file] of used) {
  if (!dict.has(text)) {
    missing++;
    console.log(`MANQUANT  ${file.slice(APP.length)}  «${text}»`);
    continue;
  }
  const p = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(',');
  if (p(text) !== p(dict.get(text))) {
    params++;
    console.log(`PARAMÈTRES  «${text}»  →  «${dict.get(text)}»`);
  }
}
const unused = [...dict.keys()].filter((k) => !used.has(k));
console.log(`\n${used.size} textes utilisés · ${dict.size} traductions · ${missing} manquant(s) · ${params} paramètre(s) différent(s) · ${unused.length} inutilisée(s)`);
if (process.argv.includes('--unused')) unused.forEach((k) => console.log(`INUTILISÉE  «${k}»`));
process.exit(missing || params ? 1 : 0);
