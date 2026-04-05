const fs = require('fs');
const p = 'src/app/simulator/SimulatorClient.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(/bg-white(?![^\s>]* dark:bg)/g, 'bg-white dark:bg-gray-800')
     .replace(/text-gray-900(?![^\s>]* dark:text)/g, 'text-gray-900 dark:text-white')
     .replace(/text-gray-800(?![^\s>]* dark:text)/g, 'text-gray-800 dark:text-gray-100')
     .replace(/text-gray-700(?![^\s>]* dark:text)/g, 'text-gray-700 dark:text-gray-200')
     .replace(/text-gray-600(?![^\s>]* dark:text)/g, 'text-gray-600 dark:text-gray-300')
     .replace(/text-gray-500(?![^\s>]* dark:text)/g, 'text-gray-500 dark:text-gray-400')
     .replace(/text-gray-400(?![^\s>]* dark:text)/g, 'text-gray-400 dark:text-gray-500')
     .replace(/bg-gray-200(?![^\s>]* dark:bg)/g, 'bg-gray-200 dark:bg-gray-700')
     .replace(/bg-gray-100(?![^\s>]* dark:bg)/g, 'bg-gray-100 dark:bg-gray-700')
     .replace(/bg-gray-50(?![^\s>]* dark:bg)/g, 'bg-gray-50 dark:bg-gray-800')
     .replace(/border-gray-200(?![^\s>]* dark:border)/g, 'border-gray-200 dark:border-gray-600')
     .replace(/border-gray-100(?![^\s>]* dark:border)/g, 'border-gray-100 dark:border-gray-700')
     .replace(/border-gray-50(?![^\s>]* dark:border)/g, 'border-gray-50 dark:border-gray-700')
     .replace(/<option value="">/g, '<option value="" className="dark:bg-gray-800">')
     .replace(/<option key={grade} value={grade}>/g, '<option key={grade} value={grade} className="dark:bg-gray-800">');

// Brand Orange -> Neon Lime
c = c.replace(/bg-brand-orange-500(?![^\s>]* dark:bg)/g, 'bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-gray-900')
     .replace(/hover:bg-brand-orange-600(?![^\s>]* dark:hover)/g, 'hover:bg-brand-orange-600 dark:hover:bg-lime-400')
     .replace(/text-brand-orange-500(?![^\s>]* dark:text)/g, 'text-brand-orange-500 dark:text-brand-neon-lime')
     .replace(/hover:text-brand-orange-600(?![^\s>]* dark:hover)/g, 'hover:text-brand-orange-600 dark:hover:text-lime-400')
     .replace(/ring-brand-orange-500(?![^\s>]* dark:focus)/g, 'ring-brand-orange-500 dark:focus:ring-brand-neon-lime')
     .replace(/border-brand-orange-500(?![^\s>]* dark:focus)/g, 'border-brand-orange-500 dark:focus:border-brand-neon-lime')
     .replace(/bg-brand-orange-50(?=\/| )(?![^\s>]* dark:bg)/g, 'bg-brand-orange-50 dark:bg-brand-neon-lime/10 ')
     .replace(/bg-brand-orange-50\/30(?![^\s>]* dark:bg)/g, 'bg-brand-orange-50/30 dark:bg-brand-neon-lime/20')
     .replace(/border-brand-orange-300(?![^\s>]* dark:border)/g, 'border-brand-orange-300 dark:border-brand-neon-lime')
     .replace(/border-brand-orange-100(?![^\s>]* dark:border)/g, 'border-brand-orange-100 dark:border-brand-neon-lime/30')
     .replace(/text-brand-orange-700(?![^\s>]* dark:text)/g, 'text-brand-orange-700 dark:text-brand-neon-lime')
     .replace(/text-brand-orange-600(?![^\s>]* dark:text)/g, 'text-brand-orange-600 dark:text-brand-neon-lime');

// Slot Card Navy -> Lime
c = c.replace(/text-brand-navy-700(?![^\s>]* dark:text)/g, 'text-brand-navy-700 dark:text-brand-neon-lime')
     .replace(/bg-brand-navy-50 px-2.5/g, 'bg-brand-navy-50 dark:bg-brand-navy-900/40 px-2.5')
     .replace(/bg-brand-navy-50 text-brand-navy-700 px-3/g, 'bg-brand-navy-50 dark:bg-brand-navy-900/40 text-brand-navy-700 dark:text-brand-neon-lime px-3')
     .replace(/bg-brand-navy-50(?![^\s>]* dark:bg)/g, 'bg-brand-navy-50 dark:bg-brand-navy-900/40');

// Fix the progress bar red-400 to orange logic
c = c.replace(/bg-red-400(?![^\s>]* dark:bg)/g, 'bg-red-400 dark:bg-red-500')
     .replace(/bg-green-400(?![^\s>]* dark:bg)/g, 'bg-green-400 dark:bg-brand-neon-lime');

// Fix border red
c = c.replace(/border-red-100(?![^\s>]* dark:border)/g, 'border-red-100 dark:border-red-900');

fs.writeFileSync(p, c, 'utf8');
