import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ArrowLeft, Search, Beaker } from 'lucide-react';

import { motion } from 'motion/react';

interface FormulasProps {
  email: string | null | undefined;
}

export default function Formulas({ email }: FormulasProps) {
  const navigate = useNavigate();
  const [formulas, setFormulas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchFormulas = async () => {
      // For prototype: show mock formulas if no email or no results
      const mockFormulas = [
        { 
          id: '1', 
          nombreColor: 'Andean Studio Gold', 
          codigo: 'QR-7728-SG', 
          componentes: [
            { base: 'TITANIUM WHITE PW6', cantidad: 68.20 },
            { base: 'ORGANIC YELLOW PY83', cantidad: 24.15 },
            { base: 'TRANS. OXIDE RED PR101', cantidad: 7.65 }
          ]
        },
        { 
          id: '2', 
          nombreColor: 'Industrial Slate Grey', 
          codigo: 'QR-9901-SL', 
          componentes: [
            { base: 'CARBON BLACK PBK7', cantidad: 12.40 },
            { base: 'TITANIUM WHITE PW6', cantidad: 85.10 },
            { base: 'PHTHALO BLUE PB15', cantidad: 2.50 }
          ]
        }
      ];

      if (!email) {
        setFormulas(mockFormulas);
        setLoading(false);
        return;
      }
      
      try {
        const q = query(collection(db, 'formulas'), where('clienteEmail', '==', email));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFormulas(data.length > 0 ? data : mockFormulas);
      } catch (error) {
        console.error('Firestore Error (Formulas):', error);
        setFormulas(mockFormulas); // Graceful fallback
      } finally {
        setLoading(false);
      }
    };

    fetchFormulas();
  }, [email]);

  const filteredFormulas = formulas.filter(f => 
    f.nombreColor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0A0F14] text-slate-200 font-sans flex flex-col">
      <header className="fixed top-0 z-10 flex w-full items-center justify-between border-b border-slate-800 bg-[#0A0F14]/80 backdrop-blur-md px-4 py-4">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold uppercase tracking-tight">Fórmulas de Color</h1>
        <div className="w-10"></div>
      </header>

      <main className="pt-24 px-4 max-w-lg mx-auto w-full flex-grow">
        {/* Search Bar */}
        <div className="relative mb-8">
          <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o código de lote..."
            className="w-full rounded-xl bg-slate-900 border border-slate-800 py-3 pr-4 pl-11 text-sm text-white focus:ring-2 focus:ring-[#004A99]/50 focus:border-[#004A99] outline-none transition-all placeholder:text-slate-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
             <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#004A99] border-t-transparent"></div>
          </div>
        ) : filteredFormulas.length > 0 ? (
          <div className="grid gap-6">
            {filteredFormulas.map((formula) => (
              <motion.div 
                key={formula.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="elegant-card p-6 transition-all hover:border-slate-700 bg-slate-900/40 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4">
                  <Beaker className="h-5 w-5 text-slate-800" />
                </div>
                
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">{formula.nombreColor}</h3>
                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em] mt-1">{formula.codigo}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                   <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Protocolo de Fórmula (Estándar 1kg)</p>
                   </div>
                   
                   <div className="bg-slate-950/50 rounded-lg p-2 divide-y divide-slate-900">
                     {formula.componentes?.map((comp: any, idx: number) => (
                       <div key={idx} className="flex justify-between items-center text-xs py-2 px-2 hover:bg-slate-800/30 transition-colors">
                         <span className="text-slate-400 italic font-medium">{comp.base}</span>
                         <span className="font-mono text-emerald-400 font-bold">{comp.cantidad}g</span>
                       </div>
                     ))}
                   </div>
                </div>

                <div className="mt-6 flex justify-between items-center">
                   <p className="text-[10px] text-slate-600 uppercase tracking-tighter">Última calibración: hace 24h</p>
                   <button className="text-[10px] font-bold text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-colors">
                     Descargar SDS
                   </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-slate-600">
             <p className="text-sm italic">No hay registros que coincidan con su búsqueda.</p>
          </div>
        )}
      </main>

      <footer className="p-6 text-center">
        <p className="text-[10px] text-slate-700 uppercase tracking-widest">Repositorio Digital de Pigmentos Quimresa S.A.</p>
      </footer>
    </div>
  );
}
