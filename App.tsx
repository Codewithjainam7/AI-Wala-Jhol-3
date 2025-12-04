import React, { useState, useEffect, useRef, useMemo } from 'react';
import Header from './components/Header';
import ResultsView from './components/ResultsView';
import Background3D from './components/Background3D';
import FeatureCards from './components/FeatureCards';
import CustomCursor from './components/CustomCursor';
import { analyzeContent } from './services/geminiService';
import { ScanResponse, ScanMode } from './types';
import { Upload, Type, Image as ImageIcon, FileText, Loader2, History, X, ChevronRight, TrendingUp, BarChart2, BookOpen, PenTool, AlertTriangle, CheckCircle, Scan, User, Code, Globe, Mail, Github, Twitter, Linkedin, Eye, Fingerprint, Layers, Shield, Sparkles, Brain, Lightbulb, Feather, Mic, AlertOctagon, Puzzle, Binary } from 'lucide-react';
import { APP_NAME } from './constants';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend, Cell } from 'recharts';

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<{name: string, type: string, data: string, size: number} | null>(null);
  const [activeTab, setActiveTab] = useState<ScanMode>('text');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [history, setHistory] = useState<ScanResponse[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isHumanizing, setIsHumanizing] = useState(false);
  const [currentView, setCurrentView] = useState<'home' | 'learn' | 'about'>('home');
  const [viewImage, setViewImage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('awj_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history on change
  useEffect(() => {
    localStorage.setItem('awj_history', JSON.stringify(history));
  }, [history]);

  // Compute cumulative stats for Area graph (Risk over Time)
  const historyStats = useMemo(() => {
    // Reverse history for chart (oldest to newest)
    const reversed = [...history].reverse();
    return reversed.map((item, index) => ({
      name: `Scan ${index + 1}`,
      risk: item.detection.risk_score,
      date: new Date(item.timestamp).toLocaleDateString() + ' ' + new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      type: item.mode
    }));
  }, [history]);

  // Compute Stacked Bar Stats (Risk Level Distribution by Type)
  const typeDistributionStats = useMemo(() => {
    const stats = {
      text: { high: 0, medium: 0, low: 0 },
      file: { high: 0, medium: 0, low: 0 },
      image: { high: 0, medium: 0, low: 0 },
    };

    history.forEach(item => {
      const mode = item.mode === 'video' ? 'file' : item.mode; // Group video with file for now
      const level = item.detection.risk_level.toLowerCase() as 'high' | 'medium' | 'low';
      
      if (stats[mode]) {
        stats[mode][level] += 1;
      }
    });

    return [
      { name: 'Text', High: stats.text.high, Medium: stats.text.medium, Low: stats.text.low },
      { name: 'File', High: stats.file.high, Medium: stats.file.medium, Low: stats.file.low },
      { name: 'Image', High: stats.image.high, Medium: stats.image.medium, Low: stats.image.low },
    ];
  }, [history]);

  const handleReset = () => {
    setResult(null);
    setInputText('');
    setSelectedFile(null);
    setCurrentView('home');
  };

  const handleNavigate = (view: 'home' | 'learn' | 'about') => {
    setCurrentView(view);
    if (view === 'home') {
      // Don't reset result if just switching tabs back to home
    }
  };

  const handleHistoryClick = () => {
    setCurrentView('home');
    setShowHistory(true);
    // Use setTimeout to allow render to happen before scrolling
    setTimeout(() => {
      const historyElement = document.getElementById('history');
      if (historyElement) {
        historyElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleTabChange = (tab: ScanMode) => {
    setActiveTab(tab);
    setResult(null);
    setSelectedFile(null);
    setInputText('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Determine limits based on file type
      const isPdf = file.type === 'application/pdf';
      const sizeLimit = isPdf ? 100 * 1024 * 1024 : 50 * 1024 * 1024; // 100MB PDF, 50MB others
      const sizeLimitLabel = isPdf ? "100MB" : "50MB";

      if (file.size > sizeLimit) {
        alert(`File too large. Limit is ${sizeLimitLabel}.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        // Extract base64 part
        const base64Data = result.split(',')[1];
        
        setSelectedFile({
          name: file.name,
          type: file.type,
          data: base64Data,
          size: file.size
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAnalyze = async () => {
    if (activeTab === 'text' && !inputText.trim()) return;
    if (activeTab !== 'text' && !selectedFile) return;
    
    setIsLoading(true);
    setResult(null);
    
    try {
      let response: ScanResponse;
      
      if (activeTab === 'text') {
        response = await analyzeContent(inputText, 'text');
        response.file_info = { name: null, type: 'text', size_bytes: inputText.length, pages: null };
      } else {
        // Correctly identify mode
        const mode = activeTab === 'image' ? 'image' : 'text';
        
        response = await analyzeContent({
          mimeType: selectedFile!.type,
          data: selectedFile!.data
        }, mode);
        
        response.file_info = { 
          name: selectedFile!.name, 
          type: selectedFile!.type, 
          size_bytes: selectedFile!.size, 
          pages: null 
        };
      }
      
      response.mode = activeTab; 
      
      setResult(response);
      setHistory(prev => [response, ...prev]);
    } catch (error) {
      console.error(error);
      alert("Analysis failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleHumanize = async () => {
    if (!result) return;
    if (activeTab === 'text' && !inputText) return;
    if (activeTab !== 'text' && !selectedFile) return;

    setIsHumanizing(true);
    try {
      let response;
      if (activeTab === 'text') {
        response = await analyzeContent(inputText, 'humanize');
      } else {
        response = await analyzeContent({
          mimeType: selectedFile!.type,
          data: selectedFile!.data
        }, 'humanize');
      }

      setResult(prev => {
        if (!prev) return response;
        return {
          ...prev,
          humanizer: response.humanizer
        };
      });
    } catch (e) {
      console.error(e);
      alert("Humanization failed.");
    } finally {
      setIsHumanizing(false);
    }
  };

  const clearHistory = () => {
    if(confirm("Clear all history?")) {
      setHistory([]);
      localStorage.removeItem('awj_history');
    }
  }

  const getAcceptTypes = () => {
    if (activeTab === 'file') return ".pdf";
    if (activeTab === 'image') return ".jpg,.jpeg,.png,.webp";
    return "*";
  };

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans selection:bg-brand-red selection:text-white relative overflow-x-hidden">
      <CustomCursor />
      <Background3D />
      <div className="relative z-10">
      <Header 
        onGoHome={handleReset} 
        onNavigate={handleNavigate} 
        onHistoryClick={handleHistoryClick}
        currentView={currentView} 
      />

      {/* Lightbox for Profile Image */}
      {viewImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in cursor-zoom-out"
          onClick={() => setViewImage(null)}
        >
           <img 
             src={viewImage} 
             alt="Full view" 
             className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl shadow-brand-red/20" 
           />
           <button 
             className="absolute top-4 right-4 text-white hover:text-brand-red transition-colors"
             onClick={() => setViewImage(null)}
           >
             <X className="w-8 h-8" />
           </button>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 mt-8 md:mt-12">
        {currentView === 'about' && (
           <div className="animate-fade-up max-w-3xl mx-auto">
             <div className="text-center mb-10">
               <h2 className="text-4xl font-bold mb-4">Meet the Creator</h2>
               <p className="text-gray-400">The mind behind the machine.</p>
             </div>
             
             <div className="glass-card rounded-2xl overflow-hidden border border-brand-red/20 shadow-2xl shadow-brand-red/10">
                {/* Banner */}
                <div className="h-32 bg-gradient-to-r from-brand-red via-red-900 to-black relative overflow-hidden">
                   <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30"></div>
                   <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/80 to-transparent"></div>
                </div>

                {/* Profile Info */}
                <div className="px-8 pb-8 relative">
                   <div className="flex flex-col md:flex-row items-center md:items-end -mt-16 mb-6 gap-6">
                      <div 
                        className="w-32 h-32 rounded-2xl bg-black border-4 border-black shadow-xl overflow-hidden relative group cursor-zoom-in"
                        onClick={() => setViewImage("https://github.com/Codewithjainam7.png")}
                      >
                         <img 
                           src="https://github.com/Codewithjainam7.png" 
                           alt="Jainam Jain" 
                           className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                         />
                         <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Eye className="text-white w-6 h-6" />
                         </div>
                      </div>
                      <div className="text-center md:text-left flex-1">
                         <h3 className="text-3xl font-bold text-white flex items-center justify-center md:justify-start gap-2">
                           Jainam Jain <span className="text-brand-red text-sm bg-brand-red/10 px-2 py-0.5 rounded border border-brand-red/20">AI Generalist</span>
                         </h3>
                         <p className="text-gray-400 mt-1 font-medium">Tech Enthusiast & Full Stack Developer</p>
                         <p className="text-sm text-gray-500 mt-2 max-w-md">
                           Building transparent AI tools to help you distinguish between human creativity and machine generation. "AI Wala Jhol" is my passion project to bring digital literacy to everyone.
                         </p>
                      </div>
                   </div>

                   {/* Stats / Tech Stack */}
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                      <div className="bg-white/5 rounded-lg p-3 text-center border border-white/5 hover:border-brand-red/30 transition-colors">
                         <Code className="w-5 h-5 text-brand-red mx-auto mb-2" />
                         <div className="text-lg font-bold text-white">React</div>
                         <div className="text-xs text-gray-500">Frontend</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center border border-white/5 hover:border-brand-red/30 transition-colors">
                         <Globe className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                         <div className="text-lg font-bold text-white">Gemini</div>
                         <div className="text-xs text-gray-500">AI Model</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center border border-white/5 hover:border-brand-red/30 transition-colors">
                         <Shield className="w-5 h-5 text-green-400 mx-auto mb-2" />
                         <div className="text-lg font-bold text-white">Secure</div>
                         <div className="text-xs text-gray-500">Architecture</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center border border-white/5 hover:border-brand-red/30 transition-colors">
                         <Sparkles className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
                         <div className="text-lg font-bold text-white">Open</div>
                         <div className="text-xs text-gray-500">Source</div>
                      </div>
                   </div>

                   {/* Social Links */}
                   <div className="flex flex-wrap justify-center gap-4">
                      <a href="https://github.com/Codewithjainam7" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-5 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105 border border-white/10">
                         <Github className="w-4 h-4" /> GitHub
                      </a>
                      <a href="https://jainamjain.netlify.app" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-5 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105 border border-blue-500/20">
                         <Globe className="w-4 h-4" /> Website
                      </a>
                      <a href="mailto:jainjainam412@gmail.com" className="flex items-center gap-2 bg-brand-red/10 hover:bg-brand-red/20 text-brand-red px-5 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105 border border-brand-red/20">
                         <Mail className="w-4 h-4" /> Contact Me
                      </a>
                   </div>
                </div>
             </div>
             
             <div className="mt-12 text-center">
               <button 
                 onClick={() => setCurrentView('home')}
                 className="text-gray-500 hover:text-white transition-colors text-sm flex items-center justify-center gap-2 mx-auto"
               >
                 <ChevronRight className="w-4 h-4 rotate-180" /> Back to Scanner
               </button>
             </div>
           </div>
        )}

        {currentView === 'learn' && (
          <div className="animate-fade-up pb-20">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
                <BookOpen className="text-brand-red w-10 h-10" />
                AI Detection Academy
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Master the art of spotting artificial content. Whether it's text, images, or code, 
                here are the patterns the algorithms—and human eyes—should look for.
              </p>
            </div>

            {/* Section 1: Core Mechanics */}
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2 border-b border-white/10 pb-2">
               <Brain className="text-brand-red" /> Core Mechanics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
               <div className="glass-card p-6 rounded-2xl hover:bg-white/5 transition-all">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 text-blue-500">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Burstiness & Perplexity</h3>
                  <p className="text-gray-400 mb-4 text-sm leading-relaxed">
                    AI minimizes "perplexity" (surprise). It chooses the most likely next word. Human writing is "bursty"—mixing long, complex sentences with short, punchy ones.
                  </p>
                  <div className="bg-black/40 p-4 rounded-lg text-xs font-mono border-l-2 border-blue-500">
                    <span className="text-green-400 block">✅ Tip: Don't be afraid to start sentences with "And" or "But". Break grammar rules for effect.</span>
                  </div>
               </div>

               <div className="glass-card p-6 rounded-2xl hover:bg-white/5 transition-all">
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-4 text-purple-500">
                    <Puzzle className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">The "Glue Word" Trap</h3>
                  <p className="text-gray-400 mb-4 text-sm leading-relaxed">
                    LLMs love transitional phrases to maintain logic. Words like "Furthermore," "Moreover," "In conclusion," and "It is crucial to note" are massive red flags.
                  </p>
                  <div className="bg-black/40 p-4 rounded-lg text-xs font-mono border-l-2 border-purple-500">
                    <span className="text-red-400 block mb-1">❌ Avoid: "It is important to delve into..."</span>
                    <span className="text-green-400 block">✅ Try: "Let's dig into..."</span>
                  </div>
               </div>
               
               <div className="glass-card p-6 rounded-2xl hover:bg-white/5 transition-all">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
                    <AlertOctagon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Hallucinations</h3>
                  <p className="text-gray-400 mb-4 text-sm leading-relaxed">
                    AI often fabricates facts confidently. It might cite non-existent studies or invent quotes. Humans (usually) double-check or hedge uncertain claims.
                  </p>
                  <div className="bg-black/40 p-4 rounded-lg text-xs font-mono border-l-2 border-red-500">
                     <span className="text-gray-300">Always verify citations. AI makes them look real but they often lead nowhere.</span>
                  </div>
               </div>

               <div className="glass-card p-6 rounded-2xl hover:bg-white/5 transition-all">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4 text-green-500">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Context Window Drift</h3>
                  <p className="text-gray-400 mb-4 text-sm leading-relaxed">
                    Over very long texts, AI might lose the "thread" or repeat a point it made 5 paragraphs ago as if it's new. Humans generally structure long arguments with a cohesive memory.
                  </p>
               </div>

               <div className="glass-card p-6 rounded-2xl hover:bg-white/5 transition-all">
                  <div className="w-12 h-12 rounded-full bg-pink-500/10 flex items-center justify-center mb-4 text-pink-500">
                    <Binary className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Token Probabilities</h3>
                  <p className="text-gray-400 mb-4 text-sm leading-relaxed">
                    LLMs predict token by token. They rarely choose "low probability" words. Human writing often takes jagged, unpredictable paths that defy statistical likelihood.
                  </p>
               </div>
            </div>

            {/* Section 2: Human Writing Masterclass */}
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2 border-b border-white/10 pb-2">
               <Feather className="text-brand-red" /> Human Writing Masterclass (15 Pro Tips)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-16">
               {[
                 { title: "The 'I' Factor", desc: "AI is neutral. Use 'I think', 'I felt', or 'In my experience' to ground text in reality." },
                 { title: "Sensory Details", desc: "Don't just say 'it was raining'. Say 'the cold rain stung my face'. AI rarely uses sensory depth." },
                 { title: "Specifics > Generalities", desc: "AI says 'dogs are loyal'. Humans say 'My golden retriever waits by the door at 5 PM'." },
                 { title: "Active Voice", desc: "Passive: 'Mistakes were made'. Active: 'I messed up'. Active voice is punchier and more human." },
                 { title: "Breaking Grammar", desc: "Fragments. Like this. They add rhythm that AI's perfect grammar engines struggle to replicate." },
                 { title: "Idioms & Slang", desc: "Use phrases like 'hit the nail on the head' or 'spill the tea'. AI uses them stiffly or avoids them." },
                 { title: "Emotional Nuance", desc: "AI describes emotions clinically. Humans describe the *feeling* of the emotion (tight chest, sweaty palms)." },
                 { title: "Rhetorical Questions", desc: "Ask the reader something. 'Have you ever felt like...?' It creates a conversation." },
                 { title: "Unpredictable Metaphors", desc: "Compare things that don't logically fit but emotionally click. 'His voice was like gravel in a blender'." },
                 { title: "Current Events", desc: "Reference something from last week. Many models have knowledge cutoffs or hallucinate recent news." },
                 { title: "Wit & Sarcasm", desc: "Sarcasm requires understanding intent vs literal meaning. AI is terrible at subtle sarcasm." },
                 { title: "Vary Openers", desc: "Don't start every paragraph with a transition word. Start with a verb, a quote, or a sound." },
                 { title: "Direct Address", desc: "Talk to 'You'. Make the reader feel seen. 'You might be thinking this is crazy...'" },
                 { title: "Imperfections", desc: "A typo or a slightly awkward phrasing can actually signal humanity. Perfection is suspicious." },
                 { title: "Strong Opinions", desc: "AI often 'both-sides' an issue. Humans pick a hill to die on. Be decisive." }
               ].map((tip, i) => (
                  <div key={i} className="glass-card p-4 rounded-xl border border-white/5 hover:border-brand-red/30 transition-all hover:-translate-y-1">
                     <div className="flex items-center gap-2 mb-2">
                        <span className="bg-brand-red/20 text-brand-red text-xs font-bold px-2 py-0.5 rounded-full">{i+1}</span>
                        <h4 className="font-bold text-white text-sm">{tip.title}</h4>
                     </div>
                     <p className="text-xs text-gray-400 leading-relaxed">{tip.desc}</p>
                  </div>
               ))}
            </div>

            {/* Section 3: Image Forensics */}
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2 border-b border-white/10 pb-2">
               <Eye className="text-brand-red" /> Image Forensics 101
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
               <div className="glass-card p-6 rounded-xl hover:bg-white/5 transition-all group">
                  <Fingerprint className="w-10 h-10 text-yellow-500 mb-4 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-lg text-white mb-2">Hands & Extremities</h4>
                  <p className="text-sm text-gray-400">
                     AI struggles with counting. Look for 6 fingers, merging knuckles, or hands disappearing into objects.
                  </p>
               </div>
               <div className="glass-card p-6 rounded-xl hover:bg-white/5 transition-all group">
                  <Type className="w-10 h-10 text-green-500 mb-4 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-lg text-white mb-2">Text & Watermarks</h4>
                  <p className="text-sm text-gray-400">
                     Background text in AI images often looks like "alien language" or gibberish glyphs. It rarely spells real words correctly.
                  </p>
               </div>
               <div className="glass-card p-6 rounded-xl hover:bg-white/5 transition-all group">
                  <Layers className="w-10 h-10 text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-lg text-white mb-2">Texture & Skin</h4>
                  <p className="text-sm text-gray-400">
                     Look for the "plastic sheen". AI skin is often too smooth, lacking pores, fine hairs, or natural imperfections.
                  </p>
               </div>
            </div>

            {/* Section 4: Myths */}
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2 border-b border-white/10 pb-2">
               <Shield className="text-brand-red" /> Common Myths
            </h3>
            <div className="glass-card p-8 rounded-2xl bg-gradient-to-br from-black to-gray-900 border border-white/10">
               <div className="space-y-6">
                  <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 text-red-500 font-bold">1</div>
                     <div>
                        <h4 className="font-bold text-white">Myth: "AI Detectors are 100% accurate."</h4>
                        <p className="text-gray-400 text-sm mt-1">
                           Fact: No detector is perfect. They provide probabilities based on patterns. False positives happen, especially with non-native speakers who write formally.
                        </p>
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 text-red-500 font-bold">2</div>
                     <div>
                        <h4 className="font-bold text-white">Myth: "Paraphrasing tools remove AI detection."</h4>
                        <p className="text-gray-400 text-sm mt-1">
                           Fact: Modern detectors recognize the "fingerprint" of paraphrasing tools (like Quillbot) too. The syntax often remains robotic.
                        </p>
                     </div>
                  </div>
                   <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 text-red-500 font-bold">3</div>
                     <div>
                        <h4 className="font-bold text-white">Myth: "AI creates completely original ideas."</h4>
                        <p className="text-gray-400 text-sm mt-1">
                           Fact: AI remixes existing data. It predicts the most likely combination of words or pixels based on training. It doesn't "think" of new concepts.
                        </p>
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 text-red-500 font-bold">4</div>
                     <div>
                        <h4 className="font-bold text-white">Myth: "Good grammar means it's AI."</h4>
                        <p className="text-gray-400 text-sm mt-1">
                           Fact: Many humans use tools like Grammarly. Perfect grammar isn't the sole indicator; it's the *predictability* of that grammar that matters.
                        </p>
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 text-red-500 font-bold">5</div>
                     <div>
                        <h4 className="font-bold text-white">Myth: "AI can't write emotions."</h4>
                        <p className="text-gray-400 text-sm mt-1">
                           Fact: AI can simulate emotion words ("I was sad"). What it struggles with is the deep, visceral, physical description of emotion that connects to shared human experience.
                        </p>
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 text-red-500 font-bold">6</div>
                     <div>
                        <h4 className="font-bold text-white">Myth: "Longer text is harder to detect."</h4>
                        <p className="text-gray-400 text-sm mt-1">
                           Fact: Sometimes, yes. But longer text also gives the AI more chances to slip up with repetitive patterns, context drift, or hallucinations.
                        </p>
                     </div>
                  </div>
               </div>
            </div>

            <div className="text-center mt-12">
              <button 
                onClick={() => setCurrentView('home')}
                className="bg-brand-red hover:bg-brand-darkRed text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-brand-red/20 transition-all hover:scale-105"
              >
                Go to Scanner
              </button>
            </div>
          </div>
        )}

        {currentView === 'home' && (
          /* Main Scanner View */
          <>
            {/* Hero Section */}
            {!result && (
              <div className="text-center mb-12 animate-fade-in">
                <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-500 tracking-tight">
                  Catch the AI Tricks.
                </h2>
                <p className="text-gray-400 max-w-2xl mx-auto text-lg mb-10">
                  {APP_NAME} uses advanced Gemini AI models to analyze content patterns, 
                  detecting artificial generation in text, documents, and images with high precision.
                </p>
                
                {/* 3D Feature Cards */}
                <FeatureCards />
              </div>
            )}

            {/* Input Card */}
            {!result && (
            <div className="glass-card rounded-2xl p-1 mb-8 shadow-2xl shadow-black/50 animate-fade-up">
              {/* Tabs */}
              <div className="flex border-b border-white/10 bg-black/40 rounded-t-xl overflow-hidden backdrop-blur-sm">
                <button 
                  onClick={() => handleTabChange('text')}
                  className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all ${activeTab === 'text' ? 'bg-white/10 text-brand-red border-b-2 border-brand-red' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                >
                  <Type className="w-4 h-4" /> Text
                </button>
                <button 
                  onClick={() => handleTabChange('file')}
                  className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all ${activeTab === 'file' ? 'bg-white/10 text-brand-red border-b-2 border-brand-red' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                >
                  <Upload className="w-4 h-4" /> PDF
                </button>
                <button 
                  onClick={() => handleTabChange('image')}
                  className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all ${activeTab === 'image' ? 'bg-white/10 text-brand-red border-b-2 border-brand-red' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                >
                  <ImageIcon className="w-4 h-4" /> Image
                </button>
              </div>

              {/* Input Area + Action Bar */}
              <div className="bg-black/60 rounded-b-xl p-4 md:p-6 backdrop-blur-md relative overflow-hidden">
                  
                  {/* Flexible Content Area */}
                  <div className="min-h-[250px] mb-4 relative z-10">
                    
                    {/* Text/PDF Scanner Overlay */}
                    {isLoading && (activeTab === 'text' || activeTab === 'file') && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl z-20 gpu-accelerated bg-black/80 backdrop-blur-[2px]">
                         {/* Scrolling Cyber Grid */}
                         <div className="absolute inset-0 scrolling-grid opacity-20"></div>

                         {/* Scanner Beam */}
                         <div className="absolute top-0 left-0 w-full h-1 bg-brand-red shadow-[0_0_25px_#DC143C] animate-[scan_1.5s_linear_infinite]" />
                         <div className="absolute inset-0 bg-gradient-to-b from-brand-red/10 to-transparent h-1/4 animate-[scan_1.5s_linear_infinite]" />
                         
                         {/* HUD Corners */}
                         <div className="corner-bracket cb-tl"></div>
                         <div className="corner-bracket cb-tr"></div>
                         <div className="corner-bracket cb-bl"></div>
                         <div className="corner-bracket cb-br"></div>

                         {/* Central Processing Status */}
                         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                            <Loader2 className="w-10 h-10 text-brand-red animate-spin mx-auto mb-2" />
                            <div className="text-brand-red font-mono text-xs tracking-widest animate-pulse">PROCESSING DATA STREAMS</div>
                         </div>

                         {/* Random Binary Data Rain Effect (CSS simulation) */}
                         <div className="absolute top-4 left-4 text-[10px] font-mono text-brand-red/40 hidden md:block">
                            01010101<br/>11001011<br/>00111000
                         </div>
                         <div className="absolute bottom-4 right-4 text-[10px] font-mono text-brand-red/40 hidden md:block text-right">
                            Analyzing...<br/>Pattern Matching...<br/>Syntax Check...
                         </div>
                      </div>
                    )}

                    {activeTab === 'text' ? (
                      <textarea
                        className="w-full h-[250px] bg-transparent resize-none outline-none text-gray-300 placeholder-gray-600 text-lg leading-relaxed p-2"
                        placeholder="Paste your text here to analyze..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                      />
                    ) : (
                      <div 
                        onClick={() => !selectedFile && fileInputRef.current?.click()}
                        className={`min-h-[250px] w-full flex flex-col items-center justify-center border-2 border-dashed ${selectedFile ? 'border-brand-red/50 bg-black/20' : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-brand-red/50'} rounded-xl transition-all cursor-pointer group relative overflow-hidden`}
                      >
                        {selectedFile ? (
                          <div className="flex flex-col items-center animate-fade-in z-10 p-4 text-center w-full h-full relative">
                            {activeTab === 'image' ? (
                              <div className="relative rounded-lg overflow-hidden border border-white/10 shadow-xl max-h-[300px] mb-4 group-hover:border-brand-red/30 transition-all w-full md:w-auto">
                                <img 
                                  src={`data:${selectedFile.type};base64,${selectedFile.data}`} 
                                  alt="Preview" 
                                  className="max-h-[250px] w-auto object-contain mx-auto relative z-10" 
                                />
                                {isLoading && (
                                  <div className="absolute inset-0 z-20 pointer-events-none rounded-lg overflow-hidden flex items-center justify-center bg-black/60 backdrop-blur-sm">
                                     {/* Enhanced Cyber Grid Overlay */}
                                     <div className="absolute inset-0 scrolling-grid opacity-30"></div>
                                     
                                     {/* Crosshair Overlay */}
                                     <div className="absolute inset-0 flex items-center justify-center">
                                       <div className="w-full h-[1px] bg-brand-red/30"></div>
                                       <div className="h-full w-[1px] bg-brand-red/30 absolute"></div>
                                     </div>

                                     {/* Moving Laser Bar */}
                                     <div className="absolute top-0 left-0 w-full h-[2px] bg-brand-red shadow-[0_0_15px_#DC143C,0_0_30px_#DC143C] animate-[scan_2s_ease-in-out_infinite] opacity-90 gpu-accelerated"></div>
                                     
                                     {/* Trailing Gradient */}
                                     <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-t from-brand-red/20 to-transparent animate-[scan_2s_ease-in-out_infinite] origin-bottom -translate-y-full gpu-accelerated"></div>

                                     {/* Radar Circle */}
                                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] border border-brand-red/30 rounded-full animate-[radar_4s_linear_infinite] gpu-accelerated shadow-[0_0_10px_rgba(220,20,60,0.2)]"></div>
                                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160px] h-[160px] border border-brand-red/50 rounded-full animate-[radar_3s_linear_infinite_reverse] gpu-accelerated border-dashed"></div>
                                     
                                     {/* Status Text */}
                                     <div className="absolute bottom-6 left-0 right-0 text-center">
                                       <span className="inline-block bg-black/80 border border-brand-red/40 text-brand-red text-xs font-mono px-4 py-1.5 rounded animate-pulse shadow-[0_0_10px_rgba(220,20,60,0.3)]">
                                         DETECTING ARTIFACTS...
                                       </span>
                                     </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center py-8 relative">
                                <FileText className="text-brand-red w-16 h-16 mb-4 drop-shadow-lg" />
                                {isLoading && <div className="absolute inset-0 bg-brand-red/10 animate-pulse rounded-full blur-xl"></div>}
                              </div>
                            )}
                            
                            {!isLoading && (
                              <>
                                <p className="text-white font-medium text-lg max-w-xs truncate">{selectedFile.name}</p>
                                <p className="text-gray-400 text-sm mb-4">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                <button 
                                    onClick={handleRemoveFile}
                                    className="bg-black/50 hover:bg-brand-red text-white px-4 py-2 rounded-full text-sm flex items-center gap-2 border border-white/20 transition-colors"
                                >
                                    <X className="w-4 h-4" /> Remove File
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-brand-red/20 transition-all duration-300">
                              {activeTab === 'file' ? <FileText className="text-gray-500 group-hover:text-brand-red w-8 h-8 transition-colors" /> : <ImageIcon className="text-gray-500 group-hover:text-brand-red w-8 h-8 transition-colors" />}
                            </div>
                            <p className="text-gray-400 font-medium group-hover:text-white transition-colors">Click to upload {activeTab === 'file' ? 'PDF' : 'Image'}</p>
                            <p className="text-gray-600 text-sm mt-1">
                              {activeTab === 'file' ? 'Max 100MB PDF' : 'Max 50MB (JPG, PNG, WEBP)'}
                            </p>
                          </div>
                        )}
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept={getAcceptTypes()}
                          onChange={handleFileChange}
                        />
                      </div>
                    )}
                  </div>

                  {/* Action Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-4 border-t border-white/5 pt-4 relative z-20">
                    {activeTab === 'text' && (
                      <span className="text-xs text-gray-500 font-mono mr-auto sm:mr-0 order-2 sm:order-1">
                        {inputText.length} chars
                      </span>
                    )}
                    <button
                      onClick={handleAnalyze}
                      disabled={isLoading || (activeTab === 'text' ? !inputText : !selectedFile)}
                      className="w-full sm:w-auto order-1 sm:order-2 bg-gradient-to-r from-brand-red to-brand-darkRed hover:from-red-600 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-brand-red/20 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing...</>
                      ) : (
                        <>Check for Jhol <ChevronRight className="w-4 h-4" /></>
                      )}
                    </button>
                  </div>

              </div>
            </div>
            )}

            {/* Results Section */}
            {result && (
              <div id="results" className="scroll-mt-24">
                <ResultsView 
                  data={result} 
                  onHumanize={handleHumanize}
                  isHumanizing={isHumanizing}
                  onScanAgain={handleReset}
                  imagePreview={selectedFile && result.mode === 'image' ? `data:${selectedFile.type};base64,${selectedFile.data}` : undefined}
                />
              </div>
            )}

            {/* History Toggle */}
            <div className="mt-12 flex justify-center pb-8" id="history">
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className="group flex items-center gap-2 text-sm uppercase tracking-widest text-gray-500 hover:text-brand-red transition-all"
              >
                <History className="w-4 h-4 group-hover:rotate-12 transition-transform" /> 
                {showHistory ? 'Hide History' : 'View Scan History'}
              </button>
            </div>

            {/* History Panel */}
            {showHistory && (
              <div className="animate-fade-up border-t border-white/10 pt-8 pb-12">
                
                {/* History Header & Stats */}
                <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <TrendingUp className="text-brand-red w-5 h-5" /> History Insights
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Track your AI detection trends over time</p>
                  </div>
                  <button onClick={clearHistory} className="text-xs text-brand-red hover:text-red-400 px-3 py-1 rounded bg-brand-red/10 border border-brand-red/20 hover:bg-brand-red/20 transition-colors">
                    Clear All Records
                  </button>
                </div>

                {/* Graphs Grid */}
                {history.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Risk Over Time */}
                    <div className="glass-card p-4 rounded-xl min-h-[300px] w-full flex flex-col">
                      <h4 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4"/> AI Probability Trend</h4>
                      <div className="flex-1 w-full text-xs min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={historyStats}>
                              <defs>
                                <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#DC143C" stopOpacity={0.4}/>
                                  <stop offset="95%" stopColor="#DC143C" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                              <XAxis dataKey="name" stroke="#555" tick={{fill: '#888'}} />
                              <YAxis stroke="#555" tick={{fill: '#888'}} domain={[0, 100]} />
                              <Tooltip 
                                content={({ active, payload, label }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="bg-black/90 border border-white/10 p-2 rounded shadow-xl text-xs">
                                        <p className="text-white font-bold mb-1">{label}</p>
                                        <p className="text-gray-400 mb-1">{payload[0].payload.date}</p>
                                        <p className="text-brand-red">Risk Score: {payload[0].value}%</p>
                                        <p className="text-gray-500 capitalize">Type: {payload[0].payload.type}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Area type="monotone" dataKey="risk" stroke="#DC143C" strokeWidth={2} fillOpacity={1} fill="url(#colorRisk)" name="Risk Score" />
                            </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Risk Distribution by Type (Stacked) */}
                    <div className="glass-card p-4 rounded-xl min-h-[300px] w-full flex flex-col">
                      <h4 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2"><BarChart2 className="w-4 h-4"/> Risk Distribution by Type</h4>
                      <div className="flex-1 w-full text-xs min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={typeDistributionStats}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                              <XAxis dataKey="name" stroke="#555" tick={{fill: '#888'}} />
                              <YAxis stroke="#555" tick={{fill: '#888'}} allowDecimals={false} />
                              <Tooltip 
                                cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                content={({ active, payload, label }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="bg-black/90 border border-white/10 p-2 rounded shadow-xl text-xs">
                                        <p className="text-white font-bold mb-2 border-b border-white/10 pb-1">{label} Scans</p>
                                        {payload.map((entry: any, index: number) => (
                                          <div key={index} className="flex justify-between gap-4 mb-1">
                                            <span style={{color: entry.color}}>{entry.name}:</span>
                                            <span className="text-white font-mono">{entry.value}</span>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Legend wrapperStyle={{paddingTop: '10px'}} />
                              <Bar dataKey="Low" stackId="a" fill="#22c55e" radius={[0,0,0,0]} />
                              <Bar dataKey="Medium" stackId="a" fill="#eab308" radius={[0,0,0,0]} />
                              <Bar dataKey="High" stackId="a" fill="#DC143C" radius={[4,4,0,0]} />
                            </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* History List */}
                <div className="grid gap-4">
                  {history.length === 0 ? (
                    <p className="text-center text-gray-600 py-8 italic">No history found. Start analyzing content!</p>
                  ) : (
                    history.map((item, i) => (
                      <div 
                        key={item.scan_id + i} 
                        className="glass-card p-4 rounded-lg flex justify-between items-center bg-black/40 border border-white/5 hover:bg-black/80 hover:scale-[1.02] hover:border-brand-red hover:shadow-lg hover:shadow-brand-red/20 transition-all duration-300 cursor-pointer group relative overflow-hidden" 
                        onClick={() => setResult(item)}
                      >
                          <div className="flex items-center gap-4 relative z-10">
                            <div className={`w-1 h-12 rounded-full transition-all group-hover:w-1.5 group-hover:shadow-[0_0_10px_currentColor] ${item.detection.risk_level === 'HIGH' ? 'bg-brand-red text-brand-red' : item.detection.risk_level === 'MEDIUM' ? 'bg-yellow-500 text-yellow-500' : 'bg-green-500 text-green-500'}`} />
                            <div>
                              <p className="text-white font-medium truncate max-w-[200px] md:max-w-md group-hover:text-brand-red transition-colors">
                                {item.detection.summary}
                              </p>
                              <p className="text-xs text-gray-500 group-hover:text-gray-400">
                                {new Date(item.timestamp).toLocaleString()} • {item.detection.risk_level} Risk • {item.mode}
                              </p>
                            </div>
                          </div>
                          <div className="text-right hidden md:block relative z-10">
                            <span className={`text-2xl font-bold transition-colors ${item.detection.risk_level === 'HIGH' ? 'text-brand-red' : 'text-white'}`}>
                              {item.detection.risk_score}
                            </span>
                            <span className="text-xs text-gray-500 block">% AI</span>
                          </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
      </div>
    </div>
  );
};

export default App;