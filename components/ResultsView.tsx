import React, { useState, useEffect } from 'react';
import { ScanResponse } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { AlertCircle, CheckCircle, BrainCircuit, Sparkles, FileText, ChevronRight, RotateCcw, Copy, ScanLine, Terminal, ChevronDown, ChevronUp, Image } from 'lucide-react';

interface ResultsViewProps {
  data: ScanResponse;
  onHumanize: () => void;
  isHumanizing: boolean;
  onScanAgain: () => void;
  imagePreview?: string;
}

const ResultsView: React.FC<ResultsViewProps> = ({ data, onHumanize, isHumanizing, onScanAgain, imagePreview }) => {
  const { detection, recommendations, humanizer } = data;
  const [animatedScore, setAnimatedScore] = useState(0);
  const [showPrompt, setShowPrompt] = useState(true);

  // Animate the risk score counting up
  useEffect(() => {
    setAnimatedScore(0);
    const duration = 1500;
    const steps = 60;
    const intervalTime = duration / steps;
    const increment = detection.risk_score / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= detection.risk_score) {
        setAnimatedScore(detection.risk_score);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.floor(current));
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [detection.risk_score]);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'HIGH': return 'text-brand-red border-brand-red shadow-brand-red/20';
      case 'MEDIUM': return 'text-yellow-500 border-yellow-500 shadow-yellow-500/20';
      case 'LOW': return 'text-green-500 border-green-500 shadow-green-500/20';
      default: return 'text-gray-400 border-gray-400';
    }
  };

  const getRiskBg = (level: string) => {
    switch (level) {
      case 'HIGH': return 'bg-brand-red/10';
      case 'MEDIUM': return 'bg-yellow-500/10';
      case 'LOW': return 'bg-green-500/10';
      default: return 'bg-gray-400/10';
    }
  };

  const getVerdictText = (level: string) => {
    switch(level) {
      case 'HIGH': return "AI GENERATED";
      case 'MEDIUM': return "SUSPICIOUS";
      case 'LOW': return "HUMAN WRITTEN";
      default: return "UNKNOWN";
    }
  };

  const pieData = [
    { name: 'AI', value: detection.ai_probability * 100 },
    { name: 'Human', value: detection.human_probability * 100 },
  ];
  const COLORS = ['#DC143C', '#22c55e'];

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Top Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Risk Score Card */}
        <div className={`glass-card p-6 rounded-xl flex flex-col items-center justify-center relative overflow-hidden ${getRiskBg(detection.risk_level)} animate-fade-up`}>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4 z-10 text-center border-b border-white/10 pb-2 w-full">
            Content Verdict
          </h3>
          
          <div className="relative w-36 h-36 z-10 transform hover:scale-105 transition-transform duration-500 cursor-default mb-2">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={45}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                    animationDuration={1500}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className={`text-4xl font-black ${getRiskColor(detection.risk_level).split(' ')[0]} drop-shadow-md`}>
                  {animatedScore}%
                </span>
                <span className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">AI Score</span>
             </div>
          </div>

          <div className="z-10 text-center">
            <div className={`text-xl font-black tracking-tighter ${getVerdictText(detection.risk_level) === 'AI GENERATED' ? 'text-brand-red animate-pulse' : getVerdictText(detection.risk_level) === 'HUMAN WRITTEN' ? 'text-green-500' : 'text-yellow-500'}`}>
              {getVerdictText(detection.risk_level)}
            </div>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">
              {detection.risk_level} RISK LEVEL
            </p>
          </div>

          {/* Subtle background glow based on risk */}
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-[80px] opacity-20 ${
              detection.risk_level === 'HIGH' ? 'bg-red-600' : detection.risk_level === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'
          }`} />
        </div>

        {/* Summary Card */}
        <div className="glass-card p-6 rounded-xl md:col-span-2 flex flex-col justify-between animate-fade-up animate-delay-100 group hover:bg-white/5 transition-colors duration-500">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BrainCircuit className="text-brand-red w-5 h-5 animate-pulse-slow" />
              <h3 className="text-white font-semibold text-lg">Analysis Summary</h3>
            </div>
            <p className="text-gray-300 leading-relaxed text-sm md:text-base border-l-2 border-brand-red/50 pl-4 group-hover:border-brand-red transition-colors duration-300">
              {detection.summary}
            </p>
          </div>
          
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center gap-3">
            {detection.model_suspected && (
               <span className="px-3 py-1 rounded-full bg-white/5 text-xs text-gray-400 border border-white/10 flex items-center gap-1.5 hover:border-brand-red/50 transition-colors cursor-default">
                 Suspected: <span className="text-brand-red font-semibold">{detection.model_suspected}</span>
               </span>
            )}
            <span className="px-3 py-1 rounded-full bg-white/5 text-xs text-gray-400 border border-white/10 flex items-center gap-2 group/confidence hover:border-white/20 transition-colors cursor-default">
                 Confidence: 
                 <span className="flex items-center gap-1.5">
                   <span className={`w-2 h-2 rounded-full ${
                     detection.confidence === 'high' ? 'bg-green-500' : detection.confidence === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                   } animate-pulse shadow-[0_0_8px_currentColor]`} />
                   <span className="capitalize font-medium text-white">{detection.confidence}</span>
                 </span>
            </span>
          </div>
        </div>
      </div>

      {/* Image Preview & Suspected Prompt (Image Mode Only) */}
      {imagePreview && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-up animate-delay-200">
            {/* Image Preview */}
            <div className="glass-card p-1 rounded-xl overflow-hidden relative group">
              <div className="absolute inset-0 bg-brand-red/5 z-0"></div>
              <div className="relative z-10 bg-black/50 rounded-lg overflow-hidden h-full flex flex-col">
                 <div className="p-3 border-b border-white/10 flex items-center gap-2 bg-black/60">
                    <Image className="w-4 h-4 text-brand-red" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">Analyzed Image</span>
                 </div>
                 <div className="p-4 flex-1 flex items-center justify-center bg-black/40">
                    <img 
                      src={imagePreview} 
                      alt="Analyzed content" 
                      className="max-h-[300px] w-auto object-contain rounded-lg border border-white/10 shadow-xl" 
                    />
                 </div>
              </div>
            </div>

            {/* Suspected Prompt */}
            {detection.suspected_prompt && (
              <div className="glass-card rounded-xl overflow-hidden flex flex-col h-full border-brand-red/20 shadow-[0_0_15px_rgba(220,20,60,0.05)]">
                 <div 
                   className="bg-brand-red/10 px-4 py-3 border-b border-brand-red/10 flex items-center justify-between cursor-pointer hover:bg-brand-red/20 transition-colors"
                   onClick={() => setShowPrompt(!showPrompt)}
                 >
                   <div className="flex items-center gap-2">
                     <Terminal className="w-4 h-4 text-brand-red" />
                     <span className="text-xs font-bold text-brand-red uppercase tracking-wider">Suspected Generation Prompt</span>
                   </div>
                   {showPrompt ? <ChevronUp className="w-4 h-4 text-brand-red" /> : <ChevronDown className="w-4 h-4 text-brand-red" />}
                 </div>
                 
                 {showPrompt && (
                   <div className="p-4 bg-black/40 flex-1 overflow-y-auto max-h-[300px] animate-fade-in">
                     <p className="text-sm font-mono text-gray-300 leading-relaxed italic border-l-2 border-brand-red/30 pl-3">
                       "{detection.suspected_prompt}"
                     </p>
                     <div className="mt-4 flex justify-end">
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           navigator.clipboard.writeText(detection.suspected_prompt || "");
                         }}
                         className="text-xs flex items-center gap-1.5 text-gray-500 hover:text-white transition-colors bg-white/5 px-2 py-1 rounded border border-white/5 hover:border-white/20"
                       >
                         <Copy className="w-3 h-3" /> Copy Prompt
                       </button>
                     </div>
                   </div>
                 )}
                 {!showPrompt && (
                    <div className="p-4 flex-1 flex items-center justify-center bg-black/40 text-gray-500 text-xs italic">
                       Click to view the reconstructed prompt...
                    </div>
                 )}
              </div>
            )}
         </div>
      )}

      {/* Signals & Detailed Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-xl animate-fade-up animate-delay-200 flex flex-col h-full">
           <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
             <AlertCircle className="w-5 h-5 text-brand-red" />
             Detected Signals
           </h3>
           <ul className="space-y-3 flex-grow">
             {detection.signals.map((signal, idx) => (
               <li 
                 key={idx} 
                 className="flex items-start gap-3 text-sm text-gray-300 bg-black/40 p-3 rounded-lg border border-white/5 hover:border-brand-red/30 transition-all duration-300 group hover:translate-x-1"
                 style={{ animationDelay: `${idx * 100}ms` }}
               >
                 <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-red shrink-0 group-hover:scale-150 group-hover:shadow-[0_0_8px_rgba(220,20,60,0.8)] transition-all" />
                 {signal}
               </li>
             ))}
           </ul>
        </div>

        <div className="glass-card p-6 rounded-xl animate-fade-up animate-delay-300 flex flex-col h-full">
           <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
             <FileText className="w-5 h-5 text-brand-red" />
             Detailed Analysis
           </h3>
           <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap mb-6">
             {detection.detailed_analysis}
           </p>

           <div className="mt-auto">
             <h4 className="text-white font-semibold mb-3 text-sm uppercase flex items-center gap-2">
               <CheckCircle className="w-4 h-4 text-green-500" /> Recommendations
             </h4>
             <div className="flex flex-wrap gap-2">
               {recommendations.map((rec, idx) => (
                 <span key={idx} className="px-3 py-1.5 rounded bg-brand-red/5 text-gray-300 text-xs border border-brand-red/10 hover:bg-brand-red/10 hover:text-white transition-colors cursor-default">
                   {rec}
                 </span>
               ))}
             </div>
           </div>
        </div>
      </div>

      {/* Humanizer Section */}
      <div className="glass-card p-1 rounded-xl bg-gradient-to-r from-brand-red/20 via-brand-black to-brand-red/20 animate-fade-up animate-delay-500 transform hover:scale-[1.01] transition-transform duration-500">
         <div className="bg-brand-black rounded-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h3 className="text-white font-bold flex items-center gap-2 text-xl">
                <Sparkles className="text-brand-red animate-pulse" />
                Humanizer Engine
              </h3>
              {!humanizer.humanized_text && (
                <button 
                  onClick={onHumanize}
                  disabled={isHumanizing}
                  className={`
                    relative overflow-hidden px-6 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 shadow-lg
                    ${isHumanizing 
                      ? 'bg-gray-800 text-gray-300 cursor-not-allowed border border-gray-700' 
                      : 'bg-brand-red hover:bg-brand-darkRed text-white shadow-brand-red/20 hover:shadow-brand-red/40'
                    }
                  `}
                >
                  {isHumanizing && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-[200%] animate-[shimmer_2s_infinite] translate-x-[-100%]" />
                  )}
                  {isHumanizing ? (
                    <>
                       <div className="w-4 h-4 border-2 border-brand-red border-t-transparent rounded-full animate-spin" /> 
                       <span>Rewriting Patterns...</span>
                    </>
                  ) : (
                    <>Humanize Text <ChevronRight className="w-4 h-4" /></>
                  )}
                </button>
              )}
            </div>

            {humanizer.humanized_text ? (
              <div className="animate-fade-up">
                 <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4 relative overflow-hidden group hover:border-brand-red/30 transition-colors">
                    <div className="absolute top-0 left-0 w-1 h-full bg-brand-red/50" />
                    <p className="text-gray-200 whitespace-pre-wrap font-sans leading-relaxed relative z-10">
                      {humanizer.humanized_text}
                    </p>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => navigator.clipboard.writeText(humanizer.humanized_text || "")}
                        className="bg-black/80 hover:bg-black text-white text-xs px-3 py-1.5 rounded backdrop-blur flex items-center gap-1 border border-white/10"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                 </div>
                 <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                    <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
                       <CheckCircle className="w-4 h-4 text-green-500" />
                       <span>Improvement Score: <strong className="text-white">{humanizer.improvement_score}</strong></span>
                    </div>
                    {humanizer.changes_made.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                         <span className="text-gray-500">Changes:</span>
                         {humanizer.changes_made.map((change, i) => (
                           <span key={i} className="text-xs bg-white/5 px-2 py-0.5 rounded text-gray-300 border border-white/5">{change}</span>
                         ))}
                      </div>
                    )}
                 </div>
              </div>
            ) : (
              <p className="text-gray-500 italic text-sm">
                AI Wala Jhol can rewrite this content to remove AI patterns and make it sound more natural. Click the button above to start the magic.
              </p>
            )}
         </div>
      </div>

      {/* Scan Again Button */}
      <div className="flex justify-center pt-8 animate-fade-up animate-delay-500">
        <button
          onClick={onScanAgain}
          className="group flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-8 py-3 rounded-full transition-all hover:scale-105 hover:border-brand-red/50 shadow-lg"
        >
           <RotateCcw className="w-4 h-4 group-hover:-rotate-180 transition-transform duration-500" />
           Scan Another Content
        </button>
      </div>
    </div>
  );
};

export default ResultsView;