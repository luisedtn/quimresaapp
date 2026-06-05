const fs = require('fs');
let c = fs.readFileSync('c:\\quimresaapp\\src\\pages\\ColorMatch.tsx', 'utf8');

c = c.replace(/<Target className="h-5 w-5 text-black" \/>/g, '<Search className="h-5 w-5 text-black" />');

// Layout base
c = c.replace(/bg-\\[#0A0F14\\] text-slate-200/g, 'bg-slate-50 dark:bg-[#0A0F14] text-slate-800 dark:text-slate-200');

// Backgrounds
c = c.replace(/bg-slate-900(?!\/)/g, 'bg-white dark:bg-slate-900');
c = c.replace(/bg-slate-900\/40/g, 'bg-slate-100 dark:bg-slate-900/40');
c = c.replace(/bg-slate-900\/60/g, 'bg-slate-100 dark:bg-slate-900/60');
c = c.replace(/bg-slate-900\/80/g, 'bg-white dark:bg-slate-900/80');
c = c.replace(/bg-\\[#0A0F14\\]\/90/g, 'bg-slate-100/90 dark:bg-[#0A0F14]/90');
c = c.replace(/bg-\\[#0A0F14\\]\/95/g, 'bg-slate-100/95 dark:bg-[#0A0F14]/95');
c = c.replace(/bg-slate-950(?!\/)/g, 'bg-slate-50 dark:bg-slate-950');
c = c.replace(/bg-slate-950\/60/g, 'bg-slate-100 dark:bg-slate-950/60');
c = c.replace(/bg-slate-800(?!\/)/g, 'bg-slate-200 dark:bg-slate-800');

// Borders
c = c.replace(/border-slate-800(?!\/)/g, 'border-slate-300 dark:border-slate-800');
c = c.replace(/border-slate-800\/80/g, 'border-slate-300 dark:border-slate-800/80');
c = c.replace(/border-slate-800\/40/g, 'border-slate-300 dark:border-slate-800/40');
c = c.replace(/border-slate-800\/50/g, 'border-slate-300 dark:border-slate-800/50');
c = c.replace(/border-slate-700(?!\/)/g, 'border-slate-300 dark:border-slate-700');
c = c.replace(/border-slate-700\/50/g, 'border-slate-300 dark:border-slate-700/50');

// Text
c = c.replace(/text-white(?!\/)/g, 'text-slate-900 dark:text-white');
c = c.replace(/text-white\/20/g, 'text-slate-800/20 dark:text-white/20');
c = c.replace(/text-white\/40/g, 'text-slate-800/40 dark:text-white/40');
c = c.replace(/text-slate-400/g, 'text-slate-600 dark:text-slate-400');
c = c.replace(/text-slate-300/g, 'text-slate-700 dark:text-slate-300');
c = c.replace(/text-slate-200/g, 'text-slate-800 dark:text-slate-200');

// Hovers
c = c.replace(/hover:text-white/g, 'hover:text-slate-900 dark:hover:text-white');
c = c.replace(/hover:bg-slate-700/g, 'hover:bg-slate-300 dark:hover:bg-slate-700');
c = c.replace(/hover:border-slate-600/g, 'hover:border-slate-400 dark:hover:border-slate-600');

// Restore specific occurrences where text should be explicitly white
c = c.replace(/<h1 className="text-lg font-semibold uppercase tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">/g, '<h1 className="text-lg font-semibold uppercase tracking-tight flex items-center gap-2 text-white">');
c = c.replace(/<h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Capturando Color...<\/h3>/g, '<h3 className="text-xl font-bold text-white tracking-tight">Capturando Color...</h3>');

fs.writeFileSync('c:\\quimresaapp\\src\\pages\\ColorMatch.tsx', c);
