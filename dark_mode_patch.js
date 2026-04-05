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

    // Apply basic dark mode pairs where dark counterpart is missing
    c = c.replace(/\bbg-white\b(?![^"'{`]*\bdark:bg-)/g, 'bg-white dark:bg-gray-800')
         .replace(/\bbg-gray-50\b(?![^"'{`]*\bdark:bg-)/g, 'bg-gray-50 dark:bg-gray-900')
         .replace(/\bbg-gray-100\b(?![^"'{`]*\bdark:bg-)/g, 'bg-gray-100 dark:bg-gray-800')
         .replace(/\btext-gray-900\b(?![^"'{`]*\bdark:text-)/g, 'text-gray-900 dark:text-white')
         .replace(/\btext-gray-800\b(?![^"'{`]*\bdark:text-)/g, 'text-gray-800 dark:text-gray-100')
         .replace(/\btext-gray-700\b(?![^"'{`]*\bdark:text-)/g, 'text-gray-700 dark:text-gray-200')
         .replace(/\btext-gray-600\b(?![^"'{`]*\bdark:text-)/g, 'text-gray-600 dark:text-gray-300')
         .replace(/\btext-gray-500\b(?![^"'{`]*\bdark:text-)/g, 'text-gray-500 dark:text-gray-400')
         .replace(/\bborder-gray-200\b(?![^"'{`]*\bdark:border-)/g, 'border-gray-200 dark:border-gray-700')
         .replace(/\bborder-gray-100\b(?![^"'{`]*\bdark:border-)/g, 'border-gray-100 dark:border-gray-800');

    if (original !== c) {
        fs.writeFileSync(p, c, 'utf8');
    }
}
