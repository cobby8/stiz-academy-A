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

    c = c.replace(/hover:bg-white dark:bg-gray-800/g, 'hover:bg-white dark:hover:bg-gray-800');

    if (original !== c) {
        fs.writeFileSync(p, c, 'utf8');
        console.log('Fixed hover in: ' + p);
    }
}

