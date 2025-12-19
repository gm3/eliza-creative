import fs from 'fs';
import path from 'path';

const css = fs.readFileSync('styles.css', 'utf8');

// Extract sections based on comments
const sections = {
    preview: css.match(/\/\* Asset Preview Styles \*\/[\s\S]*?(?=\/\* Scrollbar Styling \*\/)/)?.[0] || '',
    music: css.match(/\/\* Music Player Styles \*\/[\s\S]*?(?=\/\* News Page Styles \*\/)/)?.[0] || '',
    news: css.match(/\/\* News Page Styles \*\/[\s\S]*$/)?.[0] || '',
    showcase: css.match(/\/\* Showcase styles \*\/[\s\S]*?(?=\/\* LLMs styles \*\/)/)?.[0] || '',
    llms: css.match(/\/\* LLMs styles \*\/[\s\S]*?(?=\/\* Styles for Brand Kit)/)?.[0] || '',
    about: css.match(/\/\* Styles for About page[\s\S]*?(?=\/\* Styles for Brand Kit)/)?.[0] || '',
    brandKit: css.match(/\/\* Styles for Brand Kit[\s\S]*?(?=\/\* Showcase styles)/)?.[0] || ''
};

// Write extracted sections
Object.entries(sections).forEach(([name, content]) => {
    if (content) {
        fs.writeFileSync(`styles/${name}.css`, content.trim() + '\n');
        console.log(`Created styles/${name}.css`);
    }
});

console.log('Extraction complete!');
