const fs = require('fs');
let c = fs.readFileSync('c:\\quimresaapp\\src\\pages\\StandardFormulas.tsx', 'utf8');

// Layout base
c = c.replace(/<div className="min-h-screen bg-\[#0A0F14\] text-slate-200 font-sans flex flex-col overflow-x-hidden">/g, '<div className="min-h-screen bg-slate-50 dark:bg-[#0A0F14] text-slate-800 dark:text-slate-200 font-sans flex flex-col overflow-x-hidden">');

// Backgrounds
c = c.replace(/bg-slate-900(?!\/)/g, 'bg-white dark:bg-slate-900');
c = c.replace(/bg-slate-900\/40/g, 'bg-slate-100 dark:bg-slate-900/40');
c = c.replace(/bg-slate-900\/50/g, 'bg-slate-100 dark:bg-slate-900/50');
c = c.replace(/bg-slate-900\/60/g, 'bg-slate-100 dark:bg-slate-900/60');
c = c.replace(/bg-slate-900\/80/g, 'bg-white dark:bg-slate-900/80');
c = c.replace(/bg-slate-950(?!\/)/g, 'bg-slate-50 dark:bg-slate-950');
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

// Restore explicitly white texts
c = c.replace(/<h1 className="text-lg font-semibold uppercase tracking-tight text-slate-900 dark:text-white">/g, '<h1 className="text-lg font-semibold uppercase tracking-tight text-white">');
c = c.replace(/<button onClick=\{\(\) => navigate\(-1\)\} className="p-2 text-black hover:text-slate-900 dark:hover:text-white transition-colors">/g, '<button onClick={() => navigate(-1)} className="p-2 text-white hover:text-slate-200 transition-colors">');
c = c.replace(/<ArrowLeft className="h-6 w-6 text-black" \/>/g, '<ArrowLeft className="h-6 w-6 text-white" />');
c = c.replace(/<Filter className="h-5 w-5 text-black" \/>/g, '<Filter className="h-5 w-5 text-white" />');
c = c.replace(/className={`p-2 rounded-lg transition-all \$\{showFilters \? 'bg-black\/20 text-slate-900 dark:text-white' : 'text-black hover:bg-black\/10'\}`}/g, 'className={`p-2 rounded-lg transition-all ${showFilters ? \'bg-black/20 text-white\' : \'text-white hover:bg-black/10\'}`}');

fs.writeFileSync('c:\\quimresaapp\\src\\pages\\StandardFormulas.tsx', c);
console.log('Script executed');
