const fs = require('fs');
const path = require('path');

const cssDir = path.join(__dirname, 'css');
const jsDir = path.join(__dirname, 'js');
const indexHtml = path.join(__dirname, 'index.html');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            results.push(file);
        }
    });
    return results;
}

const allFiles = [...walk(cssDir), ...walk(jsDir), indexHtml];

allFiles.forEach(file => {
    if (!file.endsWith('.css') && !file.endsWith('.js') && !file.endsWith('.html')) return;
    
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace CSS variables
    content = content.replace(/--p-/g, '--brand-');
    content = content.replace(/--gold-/g, '--accent-');
    
    // Replace rgba purples
    content = content.replace(/rgba\(124,\s*58,\s*237/g, 'rgba(31, 71, 133');
    content = content.replace(/rgba\(168,\s*85,\s*247/g, 'rgba(46, 107, 196');
    
    // Replace hex colors
    content = content.replace(/#1e1145/gi, '#0f2241'); // old sidebar bg -> new deep navy
    content = content.replace(/#7C3AED/gi, '#1f4785');
    content = content.replace(/#A855F7/gi, '#2e6bc4');
    content = content.replace(/#2d1b69/gi, '#152e56'); // old login gradient mid
    content = content.replace(/#4c1d95/gi, '#0a1628'); // old login gradient end
    
    // Replace shadows
    content = content.replace(/--sh-purple/g, '--sh-brand');

    fs.writeFileSync(file, content, 'utf8');
});

console.log('Brand colors replaced!');
