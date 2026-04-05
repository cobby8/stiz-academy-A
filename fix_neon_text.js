const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        file = path.join(dir, file);
        if (fs.statSync(file).isDirectory()) {
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

    // Fix the double injection
    c = c.replace(/dark:bg-brand-neon-lime dark:text-gray-900 text-white dark:text-white/g, 'dark:bg-brand-neon-lime text-white dark:text-brand-navy-900');
    c = c.replace(/dark:text-gray-900 dark:text-white/g, 'dark:text-brand-navy-900');
    
    // Convert remaining dark:text-gray-900 next to neon lime into navy
    c = c.replace(/dark:bg-brand-neon-lime dark:text-gray-900/g, 'dark:bg-brand-neon-lime dark:text-brand-navy-900');

    // Also look for isolated text-white next to neon lime without a dark text override
    // like "bg-brand-orange-500 dark:bg-brand-neon-lime text-white" -> needs dark:text-brand-navy-900
    // Actually, `dark:bg-brand-neon-lime` ALREADY has `dark:text-brand-navy-900` if my script caught it,
    // but if it didn't...
    
    // Let's ensure EVERY neon lime background has dark navy text
    c = c.replace(/dark:bg-brand-neon-lime(?=\s)(?!.*dark:text-brand-navy-900)/g, 'dark:bg-brand-neon-lime dark:text-brand-navy-900');

    if (original !== c) {
        fs.writeFileSync(p, c, 'utf8');
        console.log('Fixed neon text in: ' + p);
    }
}
