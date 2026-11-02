import React, { useState, useEffect } from 'react';
import { Dna, BookOpen, Activity, ExternalLink, Sparkles, Filter, ChevronRight, CheckCircle2 } from 'lucide-react';

export const BioscienceHubView: React.FC = () => {
  const [selectedGene, setSelectedGene] = useState<'MTHFR' | 'SLC46A1' | 'HBB'>('MTHFR');
  const [geneData, setGeneData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchGene = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/bioscience/gene?symbol=${selectedGene}`);
        const data = await res.json();
        setGeneData(data);
      } catch { /* fallback */ }
      setLoading(false);
    };
    fetchGene();
  }, [selectedGene]);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 p-6 border border-indigo-800/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-700 flex items-center justify-center">
              <Dna className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-black text-white">Bioscience &amp; Genomic Health Science</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
              DeepMind Science Standard
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            AlphaFold DB structures, MTHFR folate pathways, ClinVar genomic variants &amp; PubMed literature.
          </p>
        </div>

        {/* Quick Gene Selector Pills */}
        <div className="flex items-center space-x-2 bg-slate-850 p-1.5 rounded-xl border border-slate-750 text-xs font-bold">
          <button
            onClick={() => setSelectedGene('MTHFR')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${selectedGene === 'MTHFR' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            MTHFR (Folate)
          </button>
          <button
            onClick={() => setSelectedGene('SLC46A1')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${selectedGene === 'SLC46A1' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            SLC46A1 (Placenta Transporter)
          </button>
          <button
            onClick={() => setSelectedGene('HBB')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${selectedGene === 'HBB' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            HBB (Iron &amp; Hemoglobin)
          </button>
        </div>
      </div>

      {/* Main Bioscience Display Cards */}
      {geneData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Gene Overview & Uniprot Accession */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold px-2.5 py-1 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                UniProt: {geneData.uniprotAcc}
              </span>
              <span className="text-xs text-slate-400 font-mono">NCBI Gene ID: {geneData.ncbiId}</span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">{geneData.gene} — {geneData.geneName}</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">{geneData.summary}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-850 border border-slate-750 text-xs text-slate-300 space-y-1">
              <span className="text-slate-400 font-bold block uppercase text-[10px]">Biological Pathway:</span>
              <p className="font-semibold text-indigo-300">{geneData.pathway}</p>
            </div>
          </div>

          {/* Clinical Significance & AlphaFold Structure ID */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-md">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Clinical &amp; Maternal Significance</span>
            </span>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-850 p-4 rounded-xl border border-slate-750">
              {geneData.clinicalRelevance}
            </p>

            <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-indigo-300 uppercase block">AlphaFold DB Structure Prediction</span>
                <span className="text-xs font-mono font-bold text-white">{geneData.alphafoldId}</span>
              </div>

              <a
                href={`https://alphafold.ebi.ac.uk/entry/${geneData.uniprotAcc}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-1 shrink-0"
              >
                <span>AlphaFold 3D</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
