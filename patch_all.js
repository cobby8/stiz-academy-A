const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('src');
for (const p of files) {
    let c = fs.readFileSync(p, 'utf8');
    let original = c;

    // Apply only if the class exists and lacks the dark mode variant
    c = c.replace(/bg-brand-orange-500(?![^\s>]* dark:bg)/g, 'bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-gray-900')
         .replace(/hover:bg-brand-orange-600(?![^\s>]* dark:hover)/g, 'hover:bg-brand-orange-600 dark:hover:bg-lime-400')
         .replace(/text-brand-orange-500(?![^\s>]* dark:text)/g, 'text-brand-orange-500 dark:text-brand-neon-lime')
         .replace(/hover:text-brand-orange-600(?![^\s>]* dark:hover)/g, 'hover:text-brand-orange-600 dark:hover:text-lime-400')
         .replace(/ring-brand-orange-500(?![^\s>]* dark:focus)/g, 'ring-brand-orange-500 dark:focus:ring-brand-neon-lime')
         .replace(/border-brand-orange-500(?![^\s>]* dark:focus)(?![^\s>]* dark:border)/g, 'border-brand-orange-500 dark:border-brand-neon-lime')
         .replace(/bg-brand-orange-50(?=\/| )(?![^\s>]* dark:bg)/g, 'bg-brand-orange-50 dark:bg-brand-neon-lime/10 ')
         .replace(/bg-brand-orange-50\/30(?![^\s>]* dark:bg)/g, 'bg-brand-orange-50/30 dark:bg-brand-neon-lime/20')
         .replace(/border-brand-orange-300(?![^\s>]* dark:border)/g, 'border-brand-orange-300 dark:border-brand-neon-lime')
         .replace(/border-brand-orange-100(?![^\s>]* dark:border)/g, 'border-brand-orange-100 dark:border-brand-neon-lime/30')
         .replace(/text-brand-orange-700(?![^\s>]* dark:text)/g, 'text-brand-orange-700 dark:text-brand-neon-lime')
         .replace(/text-brand-orange-600(?![^\s>]* dark:text)/g, 'text-brand-orange-600 dark:text-brand-neon-lime')
         .replace(/bg-surface-section(?![^\s>]* dark:bg)/g, 'bg-surface-section dark:bg-gray-900');

    if (original !== c) {
        fs.writeFileSync(p, c, 'utf8');
        console.log('Patched: ' + p);
    }
}

