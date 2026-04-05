const fs = require('fs');
const p = 'src/app/simulator/SimulatorClient.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(/bg-brand-orange-500(?! dark:bg)/g, 'bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-gray-900')
     .replace(/hover:bg-brand-orange-600(?! dark:hover)/g, 'hover:bg-brand-orange-600 dark:hover:bg-lime-400')
     .replace(/text-brand-orange-500(?! dark:text)/g, 'text-brand-orange-500 dark:text-brand-neon-lime')
     .replace(/hover:text-brand-orange-600(?! dark:hover)/g, 'hover:text-brand-orange-600 dark:hover:text-lime-400')
     .replace(/ring-brand-orange-500(?! dark:focus)/g, 'ring-brand-orange-500 dark:focus:ring-brand-neon-lime')
     .replace(/border-brand-orange-500(?! dark:focus)/g, 'border-brand-orange-500 dark:focus:border-brand-neon-lime')
     .replace(/bg-brand-orange-50\/30(?! dark:bg)/g, 'bg-brand-orange-50/30 dark:bg-brand-neon-lime/20')
     .replace(/border-brand-orange-300(?! dark:border)/g, 'border-brand-orange-300 dark:border-brand-neon-lime')
     .replace(/text-brand-orange-700(?! dark:text)/g, 'text-brand-orange-700 dark:text-brand-neon-lime')
     .replace(/border-brand-orange-100(?! dark:border)/g, 'border-brand-orange-100 dark:border-brand-neon-lime/30')
     .replace(/text-brand-orange-600(?! dark:text)/g, 'text-brand-orange-600 dark:text-brand-neon-lime')
     .replace(/bg-brand-orange-50(?![/|]| dark:)/g, 'bg-brand-orange-50 dark:bg-brand-neon-lime/10');

fs.writeFileSync(p, c, 'utf8');

