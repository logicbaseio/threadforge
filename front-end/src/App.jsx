import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  RefreshCw, 
  Download, 
  Copy, 
  Image as ImageIcon, 
  MessageSquare, 
  Wand2, 
  LayoutTemplate,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
  Link as LinkIcon,
  FileText,
  X,
  Globe,
  Settings
} from 'lucide-react';

// --- CONFIGURATION ---
// TODO: PASTE YOUR RENDER URL BELOW inside the quotes
// Example: "https://threadforge-backend.onrender.com/api/scrape"
const LIVE_BACKEND_URL = "https://threadforge.onrender.com"; 

const apiKey = ""; // Injected by environment

// --- API & Utility Functions ---

async function callGemini(prompt, systemInstruction = "") {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Error generating text.";
  } catch (e) {
    console.error("Gemini API Error:", e);
    throw new Error("AI Service Error");
  }
}

async function generateImage(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;
  const payload = {
    instances: [{ prompt: prompt }],
    parameters: { sampleCount: 1 }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    const base64 = data.predictions?.[0]?.bytesBase64Encoded;
    return base64 ? `data:image/png;base64,${base64}` : null;
  } catch (e) {
    console.error("Imagen API Error:", e);
    return null;
  }
}

// --- Helper to Clean Raw Scraped Text ---
async function cleanScrapedData(rawText) {
  const prompt = `
    I have raw text scraped from a social media thread (Twitter/X or Facebook).
    Extract the actual thread posts.
    
    Rules:
    1. Identify the main post and threaded replies by the author.
    2. Ignore UI text (Like, Reply, Share, Navigation, Sidebar).
    3. Return ONLY a valid JSON array of strings. Example: ["Post 1", "Post 2"].
    4. If valid content is found, ignore any login prompts or error messages in the text.

    Raw Text:
    """
    ${rawText.substring(0, 15000)}
    """
  `;
  
  const result = await callGemini(prompt, "You are a data extraction specialist. Output strictly JSON.");
  const jsonMatch = result.match(/\[[\s\S]*\]/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
}

// --- Components ---

const SettingsModal = ({ isOpen, onClose, proxyUrl, setProxyUrl }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Settings size={20} /> Configuration
        </h3>
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Proxy Server URL</label>
          <input 
            type="text" 
            value={proxyUrl}
            onChange={(e) => setProxyUrl(e.target.value)}
            placeholder="https://your-app.onrender.com/api/scrape"
            className="w-full p-3 border border-slate-200 rounded-lg text-sm"
          />
          <p className="text-xs text-slate-400 mt-2">
            This points to your backend scraper. Ensure your Render service is live.
          </p>
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};

const SmartImportModal = ({ isOpen, onClose, onImport }) => {
  const [text, setText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    try {
      const posts = await cleanScrapedData(text);
      if (posts.length > 0) {
        onImport(posts);
        onClose();
      } else {
        alert("Could not identify posts. Try pasting different text.");
      }
    } catch (e) {
      alert("Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><FileText size={20} /> Paste Dump</h3>
          <button onClick={onClose}><X size={24} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the entire page text (Ctrl+A, Ctrl+C) here..."
            className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
          />
        </div>
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button onClick={handleAnalyze} disabled={isAnalyzing || !text} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center gap-2">
            {isAnalyzing ? <Loader2 className="animate-spin" /> : 'Extract Posts'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ThreadItem = ({ item, index, isSource, onDelete, onChange, isProcessing }) => {
  return (
    <div className={`relative group border rounded-xl p-4 mb-4 transition-all duration-300 ${isSource ? 'bg-white border-slate-200 hover:border-blue-300' : 'bg-indigo-50 border-indigo-100 hover:border-indigo-300'}`}>
      <div className="flex justify-between items-center mb-3">
        <span className={`text-xs font-bold uppercase tracking-wider ${isSource ? 'text-slate-400' : 'text-indigo-400'}`}>
          {index === 0 ? 'Main Post' : `Thread #${index}`}
        </span>
        {isSource && (
          <button onClick={() => onDelete(item.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
        )}
      </div>
      <div className="space-y-4">
        <div className="relative">
          {isSource ? (
            <textarea
              value={item.text}
              onChange={(e) => onChange(item.id, 'text', e.target.value)}
              className="w-full min-h-[100px] p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 text-sm resize-y"
            />
          ) : (
            <div className="w-full min-h-[100px] p-3 bg-white border border-indigo-100 rounded-lg text-slate-700 text-sm whitespace-pre-wrap relative group/text">
               {isProcessing ? (
                 <div className="flex items-center justify-center h-full text-indigo-400 gap-2"><Loader2 size={16} className="animate-spin" /> Rewriting...</div>
               ) : item.text}
               {!isProcessing && item.text && (
                 <button onClick={() => navigator.clipboard.writeText(item.text)} className="absolute top-2 right-2 opacity-0 group-hover/text:opacity-100 bg-white border p-1.5 rounded-md hover:bg-indigo-50"><Copy size={14} className="text-indigo-600" /></button>
               )}
            </div>
          )}
        </div>
        <div className="relative">
          {item.media ? (
            <div className="relative rounded-lg overflow-hidden aspect-video bg-slate-100 border border-slate-200 group/media">
              <img src={item.media} alt="Content" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover/media:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover/media:opacity-100">
                {isSource ? (
                  <button onClick={() => onChange(item.id, 'media', null)} className="bg-white/90 text-red-500 p-2 rounded-full hover:scale-110 transition-transform"><Trash2 size={18} /></button>
                ) : (
                  <a href={item.media} download={`thread-${index}.png`} className="bg-white/90 text-indigo-600 p-2 rounded-full hover:scale-110 transition-transform flex items-center gap-2 px-4"><Download size={18} /> <span className="text-xs font-bold">Download</span></a>
                )}
              </div>
            </div>
          ) : (
            <div className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors ${isSource ? 'border-slate-200 hover:bg-slate-50' : 'border-indigo-200 bg-indigo-50/50'}`}>
              {isProcessing ? (
                <div className="flex flex-col items-center text-indigo-400"><Loader2 size={24} className="animate-spin mb-2" /><span className="text-xs font-medium">Generating Visuals...</span></div>
              ) : (
                <>
                  <ImageIcon size={24} className={isSource ? "text-slate-300 mb-2" : "text-indigo-300 mb-2"} />
                  {isSource ? (
                    <label className="cursor-pointer">
                      <span className="text-xs text-blue-500 font-semibold hover:underline">Upload Image</span>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => onChange(item.id, 'media', ev.target.result);
                          reader.readAsDataURL(file);
                        }
                      }} />
                    </label>
                  ) : <span className="text-xs text-indigo-400">AI Generated Image</span>}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [thread, setThread] = useState([{ id: 1, text: '', media: null }]);
  const [generatedThread, setGeneratedThread] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('input');
  
  const [urlInput, setUrlInput] = useState("");
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Initializing state with the hardcoded LIVE_BACKEND_URL
  // We add a check: if the user hasn't replaced the placeholder yet, fallback to localhost or empty
  const initialProxyUrl = LIVE_BACKEND_URL.includes("PASTE_YOUR_RENDER_URL_HERE") 
    ? "http://localhost:3001/api/scrape" 
    : LIVE_BACKEND_URL;

  const [proxyUrl, setProxyUrl] = useState(initialProxyUrl);

  // Actions
  const addItem = () => setThread([...thread, { id: Date.now(), text: '', media: null }]);
  const updateItem = (id, field, value) => setThread(thread.map(i => i.id === id ? { ...i, [field]: value } : i));
  const deleteItem = (id) => thread.length > 1 && setThread(thread.filter(i => i.id !== id));

  const handleUrlFetch = async () => {
    if (!urlInput) return;
    
    // Check if user forgot to update URL
    if (proxyUrl.includes("PASTE_YOUR_RENDER_URL_HERE")) {
      alert("Please configure the Backend URL in the code or settings!");
      setIsSettingsOpen(true);
      return;
    }

    setIsFetchingUrl(true);
    try {
      // 1. Call the Proxy
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput })
      });
      
      if (!response.ok) throw new Error('Proxy Error');
      const data = await response.json();
      
      if (!data.text) throw new Error('No text found');

      // 2. Process the raw dump from Proxy
      const posts = await cleanScrapedData(data.text);
      
      if (posts.length > 0) {
        setThread(posts.map((t, i) => ({
          id: Date.now() + i,
          text: t,
          media: data.images?.[i] || null // Try to map images if proxy returned them
        })));
        setGeneratedThread([]);
      } else {
        alert("Could not parse thread structure from URL.");
      }

    } catch (e) {
      console.error(e);
      alert(`Fetch failed. Check your proxy URL in Settings.`);
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleRegenerate = async () => {
    setIsProcessing(true);
    setActiveTab('output');
    
    const results = [];
    setGeneratedThread(thread.map(t => ({ ...t, text: '', media: null, isProcessing: true })));

    for (let i = 0; i < thread.length; i++) {
      const item = thread[i];
      const newText = await callGemini(`Rewrite this post. Maintain meaning, change style to be fresh/engaging. Original: "${item.text}"`);
      const imgPrompt = await callGemini(`Create an image generation prompt for this social media post: "${newText}". Return ONLY the prompt.`);
      const newMedia = await generateImage(imgPrompt + ", 4k, photorealistic");

      const res = { id: item.id, text: newText, media: newMedia, isProcessing: false };
      results.push(res);
      setGeneratedThread(prev => {
        const u = [...prev];
        u[i] = res;
        return u;
      });
    }
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-700">
      <SmartImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImport={(posts) => {
        setThread(posts.map((t, i) => ({ id: Date.now() + i, text: t, media: null })));
        setGeneratedThread([]);
      }} />
      
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} proxyUrl={proxyUrl} setProxyUrl={setProxyUrl} />

      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white"><RefreshCw size={20} className={isProcessing ? "animate-spin" : ""} /></div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">ThreadForge</h1>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={() => setIsSettingsOpen(true)} className="text-slate-400 hover:text-slate-600"><Settings size={20} /></button>
             <button 
              onClick={handleRegenerate}
              disabled={isProcessing || !thread[0].text}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-all shadow-md ${isProcessing || !thread[0].text ? 'bg-slate-300' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              {isProcessing ? <><Loader2 size={18} className="animate-spin" /> Remixing...</> : <><Wand2 size={18} /> Remix Thread</>}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="lg:hidden flex border-b border-slate-200 mb-6">
          {['input', 'output'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 font-medium text-sm border-b-2 capitalize ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>
              {tab === 'input' ? 'Source' : 'Result'}
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className={`flex-1 w-full ${activeTab === 'input' ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              
              {/* INPUT METHODS */}
              <div className="mb-6 space-y-4">
                <div className="bg-slate-50 p-1.5 rounded-xl flex gap-2">
                  <div className="flex-1 relative">
                    <LinkIcon size={16} className="absolute left-3 top-3 text-slate-400" />
                    <input 
                      type="text" 
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://twitter.com/user/status/..."
                      className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <button 
                    onClick={handleUrlFetch}
                    disabled={isFetchingUrl || !urlInput}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {isFetchingUrl ? <Loader2 size={16} className="animate-spin" /> : 'Fetch'}
                  </button>
                </div>
                
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-100"></div>
                  <span className="flex-shrink-0 mx-4 text-xs text-slate-300 font-semibold uppercase">OR</span>
                  <div className="flex-grow border-t border-slate-100"></div>
                </div>

                <button 
                  onClick={() => setIsImportModalOpen(true)}
                  className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <FileText size={16} /> Paste Text Dump (No CORS Issues)
                </button>
              </div>

              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2"><MessageSquare size={20} /> Content</h2>
                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{thread.length} items</span>
              </div>

              {thread.map((item, index) => (
                <ThreadItem key={item.id} index={index} item={item} isSource={true} onDelete={deleteItem} onChange={updateItem} />
              ))}

              <button onClick={addItem} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-medium hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                <Plus size={20} /> Add Item
              </button>
            </div>
          </div>

          <div className="hidden lg:flex flex-col items-center justify-center pt-32 text-slate-300"><ArrowRight size={32} /></div>

          <div className={`flex-1 w-full ${activeTab === 'output' ? 'block' : 'hidden lg:block'}`}>
             <div className="bg-white rounded-2xl shadow-xl border border-indigo-100 p-6 relative overflow-hidden min-h-[500px]">
               <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-bl-full -z-0 opacity-50"></div>
               <div className="flex items-center justify-between mb-6 relative z-10">
                <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-900"><Wand2 size={20} className="text-indigo-500" /> Remixed Thread</h2>
                {generatedThread.length > 0 && !isProcessing && <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100"><Check size={12} /> Done</span>}
              </div>

              {generatedThread.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 relative z-10">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4"><Wand2 size={32} className="text-slate-300" /></div>
                  <p className="font-medium text-lg text-slate-600">Ready to remix</p>
                </div>
              ) : (
                <div className="relative z-10">
                  {generatedThread.map((item, index) => <ThreadItem key={item.id} index={index} item={item} isSource={false} isProcessing={item.isProcessing} />)}
                </div>
              )}
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}
