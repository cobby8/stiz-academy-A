const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walk(dirPath, callback);
        } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
            callback(dirPath);
        }
    });
}

let modifiedFiles = 0;

walk('c:/0.programing/stiz-academy-A/src/app', (filepath) => {
    let content = fs.readFileSync(filepath, 'utf8');
    let original = content;

    // 1. Hero bg gradient
    content = content.replace(
        /className="relative overflow-hidden bg-gradient-to-br from-brand-navy-900 via-brand-navy-800 to-brand-navy-900 text-white py-12 md:py-14"/g,
        'className="relative overflow-hidden bg-gradient-to-br from-brand-navy-900 via-brand-navy-800 to-brand-navy-900 dark:from-black dark:via-gray-900 dark:to-black text-white py-12 md:py-14 transition-colors duration-300"'
    );

    // 2. Hero circle 1
    content = content.replace(
        /border-white\/5 rounded-full translate-x-1\/3 -translate-y-1\/3"/g,
        'border-white/5 dark:border-brand-neon-cobalt/10 rounded-full translate-x-1/3 -translate-y-1/3 transition-colors duration-300"'
    );

    // 3. Hero circle 2
    content = content.replace(
        /border-brand-orange-500\/10 rounded-full -translate-x-1\/4 translate-y-1\/4"/g,
        'border-brand-orange-500/10 dark:border-brand-neon-lime/10 rounded-full -translate-x-1/4 translate-y-1/4 transition-colors duration-300"'
    );

    // 4. Background surface
    content = content.replace(
        /className="bg-surface-section"/g,
        'className="bg-surface-section dark:bg-gray-900 transition-colors duration-300"'
    );
    content = content.replace(
        /className="([^"]*) bg-surface-section"/g,
        'className="$1 bg-surface-section dark:bg-gray-900 transition-colors duration-300"'
    );
    content = content.replace(
        /className="bg-surface-section ([^"]*)"/g,
        'className="bg-surface-section dark:bg-gray-900 $1 transition-colors duration-300"'
    );

    // 5. bg-white border cards
    content = content.replace(
        /bg-white rounded-2xl border border-gray-100/g,
        'bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 transition-colors duration-300'
    );

    // Filter out duplicates if script is run twice
    content = content.replace(/(dark:[a-zA-Z0-9-]+)\s+\1/g, '$1');
    content = content.replace(/transition-colors duration-300 transition-colors duration-300/g, 'transition-colors duration-300');

    if (content !== original) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log('Updated', filepath);
        modifiedFiles++;
    }
});

console.log(`Script finished. modified ${modifiedFiles} files.`);
