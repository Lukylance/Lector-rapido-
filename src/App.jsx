import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Settings, Upload, BookOpen, RotateCcw, Trophy, Zap, Eye, ChevronLeft, FileUp, Loader2, X } from 'lucide-react';

// --- CONFIGURACIÓN Y CONSTANTES ---
const STOP_WORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "y", "o", "pero", "de", "del", 
  "a", "ante", "con", "por", "para", "según", "sin", "sobre", "tras", "que", "en", "su", "sus", "al"
]);

const DEFAULT_TEXT = `El cerebro humano es una máquina increíblemente adaptable. Cuando leemos de forma tradicional, nuestros ojos realizan pequeños saltos llamados movimientos sacádicos. Entre cada salto, el ojo se detiene por una fracción de segundo para enfocar la palabra, lo que se conoce como fijación. Además, la mayoría de las personas tienen el hábito de la subvocalización, que es pronunciar mentalmente cada palabra que leen. Esto limita severamente nuestra velocidad de lectura al ritmo del habla, generalmente entre doscientas y trescientas palabras por minuto. Sin embargo, al utilizar la Presentación Visual Serial Rápida, eliminamos la necesidad de mover los ojos y reducimos drásticamente la subvocalización. Al centrar nuestra visión en el Punto Óptimo de Reconocimiento de cada palabra, nuestro cerebro puede procesar la información visual casi instantáneamente. Con práctica, es posible duplicar o triplicar la velocidad de lectura sin perder comprensión.`;

// --- FUNCIONES UTILITARIAS ---

const getORPIndex = (word) => {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
};

const tokenizeText = (text) => {
  return text.trim().split(/\s+/).filter(word => word.length > 0);
};

const loadJSZip = async () => {
  if (window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => reject(new Error("No se pudo cargar la librería JSZip"));
    document.head.appendChild(script);
  });
};

const extractTextFromEpub = async (file) => {
  try {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(file);
    const parser = new DOMParser();
    
    const containerXml = await zip.file("META-INF/container.xml").async("string");
    const containerDoc = parser.parseFromString(containerXml, "application/xml");
    const rootfile = containerDoc.getElementsByTagName("rootfile")[0].getAttribute("full-path");
    
    const basePath = rootfile.includes('/') ? rootfile.substring(0, rootfile.lastIndexOf('/') + 1) : "";
    const opfXml = await zip.file(rootfile).async("string");
    const opfDoc = parser.parseFromString(opfXml, "application/xml");
    
    const manifestItems = opfDoc.getElementsByTagName("item");
    const manifest = {};
    for (let item of manifestItems) {
      manifest[item.getAttribute("id")] = item.getAttribute("href");
    }
    
    const spineItems = opfDoc.getElementsByTagName("itemref");
    const spine = Array.from(spineItems).map(item => item.getAttribute("idref"));
    
    let fullText = "";
    for (const id of spine) {
      const href = manifest[id];
      if (href) {
        const decodedHref = decodeURIComponent(href);
        const filePath = basePath + decodedHref;
        const fileData = zip.file(filePath);
        
        if (fileData) {
          const html = await fileData.async("string");
          const doc = parser.parseFromString(html, "text/html");
          fullText += doc.body.textContent + " ";
        }
      }
    }
    return fullText.trim();
  } catch (error) {
    console.error("Error leyendo el ePub:", error);
    throw new Error("No se pudo procesar el archivo ePub. Asegúrate de que no tenga DRM.");
  }
};

// --- COMPONENTES PRINCIPALES ---

export default function App() {
  const [view, setView] = useState('home'); 
  const [text, setText] = useState(DEFAULT_TEXT);
  const [tokens, setTokens] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState("Texto de ejemplo");
  const [showSettings, setShowSettings] = useState(false);
  
  // Configuraciones
  const [wpm, setWpm] = useState(300);
  const [chunkSize, setChunkSize] = useState(4);
  const [skipStopWords, setSkipStopWords] = useState(true);
  
  // Estado de lectura
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wordsRead, setWordsRead] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setTokens(tokenizeText(text));
    setCurrentIndex(0);
  }, [text]);

  const handleStart = (mode) => {
    if (tokens.length === 0) return;
    setView(mode);
    setIsPlaying(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);

    try {
      if (file.name.toLowerCase().endsWith('.epub')) {
        const extractedText = await extractTextFromEpub(file);
        setText(extractedText);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => setText(event.target.result);
        reader.readAsText(file);
      }
    } catch (error) {
      alert(error.message);
      setFileName("Error al cargar");
    } finally {
      setIsLoading(false);
    }
  };

  const endReading = () => {
    setIsPlaying(false);
    setView('stats');
  };

  // --- VISTAS ---

  // 1. Vista de Inicio
  const HomeView = () => (
    <div className="flex flex-col h-screen w-full bg-slate-900 text-slate-100 overflow-y-auto safe-area-inset">
      <div className="flex-1 flex flex-col w-full px-3 sm:px-6 py-4 sm:py-6">
        <div className="max-w-2xl mx-auto w-full space-y-4 sm:space-y-8">
          {/* Header */}
          <div className="text-center space-y-2 pt-2">
            <div className="flex justify-center mb-3 sm:mb-4 text-emerald-400">
              <Zap size={40} className="sm:w-12 sm:h-12" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Lector Alto Rendimiento</h1>
            <p className="text-sm sm:text-base text-slate-400 px-2">Abre EPUB o TXT y entrena tu velocidad.</p>
          </div>

          {/* Upload Card */}
          <div className="bg-slate-800 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-xl space-y-4 sm:space-y-6 border border-slate-700 relative overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                <Loader2 size={40} className="text-emerald-500 animate-spin mb-3 sm:mb-4" />
                <span className="font-semibold text-sm sm:text-lg text-emerald-400 text-center px-2">Procesando...</span>
              </div>
            )}
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center space-x-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 cursor-pointer p-4 sm:p-5 rounded-lg sm:rounded-xl transition-colors shadow-lg font-bold text-sm sm:text-base touch-manipulation"
            >
              <FileUp size={20} className="sm:w-6 sm:h-6 flex-shrink-0" />
              <span>Abrir .EPUB o .TXT</span>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".txt,.epub" 
                className="hidden" 
                onChange={handleFileUpload}
              />
            </button>
            
            <div className="bg-slate-900 rounded-lg p-3 text-xs sm:text-sm text-slate-400 border border-slate-700">
              <div className="truncate">📄 {fileName}</div>
              <div className="text-slate-500 mt-1">{tokens.length} palabras</div>
            </div>

            {/* Textarea */}
            <textarea
              className="w-full h-20 sm:h-24 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm sm:text-base text-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="O pega tu texto aquí..."
            />
          </div>

          {/* Settings Card */}
          <div className="bg-slate-800 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-xl space-y-4 sm:space-y-6 border border-slate-700">
            <h2 className="text-lg sm:text-xl font-semibold flex items-center space-x-2">
              <Settings size={20} className="sm:w-6 sm:h-6 text-emerald-400 flex-shrink-0" />
              <span>Configuración</span>
            </h2>
            
            <div className="space-y-4 sm:space-y-6">
              {/* WPM Control */}
              <div>
                <div className="flex justify-between mb-2 items-center gap-2">
                  <label className="text-xs sm:text-sm font-medium text-slate-300">Velocidad</label>
                  <span className="font-bold text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded text-xs sm:text-sm whitespace-nowrap">{wpm} WPM</span>
                </div>
                <input 
                  type="range" min="100" max="1000" step="10" 
                  value={wpm} onChange={(e) => setWpm(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Chunk Size Control */}
              <div>
                <div className="flex justify-between mb-2 items-center gap-2">
                  <label className="text-xs sm:text-sm font-medium text-slate-300">Tamaño Bloque</label>
                  <span className="font-bold text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded text-xs sm:text-sm whitespace-nowrap">{chunkSize}p</span>
                </div>
                <input 
                  type="range" min="1" max="10" step="1" 
                  value={chunkSize} onChange={(e) => setChunkSize(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Stop Words Checkbox */}
              <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500/50 transition touch-manipulation active:bg-slate-800">
                <input 
                  type="checkbox" 
                  checked={skipStopWords} 
                  onChange={(e) => setSkipStopWords(e.target.checked)}
                  className="w-5 h-5 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-800 border-slate-600 cursor-pointer"
                />
                <span className="text-xs sm:text-sm text-slate-300 font-medium">Atenuar palabras relleno</span>
              </label>
            </div>
          </div>

          {/* Mode Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pb-4">
            <button 
              onClick={() => handleStart('rsvp')}
              className="flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border-2 border-emerald-600/30 hover:border-emerald-500 rounded-lg sm:rounded-2xl transition-all shadow-lg group touch-manipulation"
            >
              <Eye size={28} className="sm:w-9 sm:h-9 mb-2 text-emerald-500 group-hover:scale-110 transition-transform" />
              <span className="font-bold text-sm sm:text-base">Modo RSVP</span>
              <span className="text-xs text-slate-400 text-center mt-1">Palabra a palabra</span>
            </button>
            
            <button 
              onClick={() => handleStart('hybrid')}
              className="flex flex-col items-center justify-center p-4 sm:p-6 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg sm:rounded-2xl transition-all shadow-lg hover:shadow-indigo-500/20 group touch-manipulation"
            >
              <BookOpen size={28} className="sm:w-9 sm:h-9 mb-2 text-indigo-100 group-hover:scale-110 transition-transform" />
              <span className="font-bold text-sm sm:text-base">Teleprompter</span>
              <span className="text-xs text-indigo-200 text-center mt-1">Bloques en centro</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // 2. Vista de Lectura RSVP
  const RSVPView = () => {
    const timerRef = useRef(null);
    const playPause = () => setIsPlaying(!isPlaying);

    useEffect(() => {
      if (isPlaying) {
        const msPerWord = 60000 / wpm;
        timerRef.current = setInterval(() => {
          setCurrentIndex((prev) => {
            if (prev >= tokens.length - 1) {
              clearInterval(timerRef.current);
              endReading();
              return prev;
            }
            setWordsRead(w => w + 1);
            return prev + 1;
          });
        }, msPerWord);
      } else {
        clearInterval(timerRef.current);
      }
      return () => clearInterval(timerRef.current);
    }, [isPlaying, wpm, tokens.length]);

    const word = tokens[currentIndex] || "";
    const orpIdx = getORPIndex(word);
    const leftPart = word.substring(0, orpIdx);
    const orpChar = word.charAt(orpIdx);
    const rightPart = word.substring(orpIdx + 1);

    return (
      <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 relative safe-area-inset">
        {/* Top Bar */}
        <div className="p-3 sm:p-4 flex justify-between items-center bg-slate-900/50 backdrop-blur-sm z-10 border-b border-slate-800">
          <button 
            onClick={() => { setIsPlaying(false); setView('home'); }} 
            className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 active:bg-slate-600 transition touch-manipulation"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="text-emerald-400 font-bold text-sm sm:text-base">{wpm} WPM</div>
          <div className="w-10"></div>
        </div>

        {/* Reading Area */}
        <div className="flex-1 flex items-center justify-center p-3 sm:p-4 relative cursor-pointer select-none" onClick={playPause}>
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-slate-700 -translate-y-1/2 z-0"></div>
          <div className="absolute top-1/4 bottom-1/4 left-1/2 w-[1px] bg-slate-700 -translate-x-1/2 z-0 opacity-20"></div>

          <div className="flex items-center justify-center z-10 font-sans font-medium">
            <div className="text-right text-slate-300 pr-1 sm:pr-2 max-w-[35vw] sm:max-w-[40vw] break-words">
              {leftPart}
            </div>
            <div className="text-emerald-500 font-bold text-4xl sm:text-5xl md:text-6xl px-1 sm:px-2 flex-shrink-0">
              {orpChar}
            </div>
            <div className="text-left text-slate-300 pl-1 sm:pl-2 max-w-[35vw] sm:max-w-[40vw] break-words">
              {rightPart}
            </div>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="p-4 sm:p-6 bg-slate-900 border-t border-slate-800 flex flex-col items-center space-y-4 sm:space-y-6 z-10">
          <input 
            type="range" min="0" max={tokens.length - 1} 
            value={currentIndex} onChange={(e) => { setCurrentIndex(Number(e.target.value)); setIsPlaying(false); }}
            className="w-full max-w-2xl h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex items-center justify-center space-x-4 sm:space-x-8 w-full">
            <button 
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 10))} 
              className="p-3 sm:p-4 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 active:bg-slate-600 transition touch-manipulation flex-shrink-0"
            >
              <RotateCcw size={20} className="sm:w-6 sm:h-6" />
            </button>
            <button 
              onClick={playPause}
              className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 rounded-full shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-transform active:scale-95 touch-manipulation flex-shrink-0"
            >
              {isPlaying ? <Pause size={28} className="sm:w-9 sm:h-9 fill-current" /> : <Play size={28} className="sm:w-9 sm:h-9 fill-current ml-1" />}
            </button>
            <div className="w-12 sm:w-16 flex-shrink-0"></div>
          </div>
        </div>
      </div>
    );
  };

  // 3. Vista de Teleprompter
  const HybridView = () => {
    const timerRef = useRef(null);
    const playPause = () => setIsPlaying(!isPlaying);

    const chunks = [];
    for (let i = 0; i < tokens.length; i += chunkSize) {
      chunks.push(tokens.slice(i, i + chunkSize));
    }
    
    const currentChunkIndex = Math.floor(currentIndex / chunkSize);

    useEffect(() => {
      if (isPlaying) {
        const msPerChunk = (60000 / wpm) * chunkSize;
        timerRef.current = setInterval(() => {
          setCurrentIndex((prev) => {
            if (prev >= tokens.length - chunkSize) {
              clearInterval(timerRef.current);
              endReading();
              return tokens.length - 1;
            }
            setWordsRead(w => w + chunkSize);
            return prev + chunkSize;
          });
        }, msPerChunk);
      } else {
        clearInterval(timerRef.current);
      }
      return () => clearInterval(timerRef.current);
    }, [isPlaying, wpm, chunkSize, tokens.length]);

    const renderChunkText = (chunkWords, isActive) => {
      if (!chunkWords) return "";
      return chunkWords.map((word, idx) => {
        const cleanWord = word.replace(/[.,;!?()]/g, '').toLowerCase();
        const isStopWord = skipStopWords && STOP_WORDS.has(cleanWord);
        return (
          <span key={idx} className={isStopWord ? 'opacity-40 font-light' : 'font-medium'}>
            {word}{' '}
          </span>
        );
      });
    };

    return (
      <div className="flex flex-col h-screen w-full bg-[#0a0f1a] text-slate-100 relative overflow-hidden safe-area-inset">
        {/* Top Bar */}
        <div className="p-3 sm:p-4 flex justify-between items-center bg-slate-800/80 backdrop-blur z-20 border-b border-slate-700">
          <button 
            onClick={() => { setIsPlaying(false); setView('home'); }} 
            className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 active:bg-slate-500 transition touch-manipulation"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <span className="text-xs sm:text-sm text-indigo-300 font-semibold uppercase">Teleprompter</span>
            <span className="text-indigo-400 font-bold text-sm sm:text-base">{wpm} WPM</span>
          </div>
          <div className="w-10"></div>
        </div>

        {/* Reading Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 cursor-pointer relative" onClick={playPause}>
          <div className="absolute top-1/2 left-0 w-full h-20 sm:h-32 bg-indigo-900/10 -translate-y-1/2 z-0 border-y border-indigo-500/10 pointer-events-none"></div>

          <div className="flex flex-col items-center justify-center w-full max-w-3xl space-y-3 sm:space-y-6 z-10 select-none">
            {[-2, -1, 0, 1, 2].map(offset => {
              const idx = currentChunkIndex + offset;
              const chunk = chunks[idx];
              const isActive = offset === 0;

              if (!chunk) return <div key={offset} className="h-6 sm:h-8"></div>;

              let styles = "text-center transition-all duration-300 ease-out will-change-transform px-2 ";
              if (isActive) {
                styles += "text-2xl sm:text-4xl lg:text-5xl text-indigo-100 font-bold scale-100 opacity-100 drop-shadow-[0_0_15px_rgba(99,102,241,0.3)]";
              } else if (Math.abs(offset) === 1) {
                styles += "text-lg sm:text-xl text-slate-400 scale-90 opacity-40 blur-[1px]";
              } else {
                styles += "text-sm sm:text-lg text-slate-600 scale-75 opacity-10 blur-[2px]";
              }

              return (
                <div key={`${idx}-${offset}`} className={styles}>
                  {renderChunkText(chunk, isActive)}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="p-4 sm:p-6 bg-[#0d1322] border-t border-slate-800/50 flex flex-col items-center space-y-4 sm:space-y-6 relative z-20">
          <input 
            type="range" min="0" max={tokens.length - 1} step={chunkSize}
            value={currentIndex} onChange={(e) => { setCurrentIndex(Number(e.target.value)); setIsPlaying(false); }}
            className="w-full max-w-2xl h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex items-center justify-center space-x-4 sm:space-x-8 w-full">
            <button 
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - chunkSize * 5))} 
              className="p-3 sm:p-4 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 active:bg-slate-600 transition touch-manipulation flex-shrink-0"
            >
              <RotateCcw size={20} className="sm:w-6 sm:h-6" />
            </button>
            <button 
              onClick={playPause}
              className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-full shadow-[0_0_30px_rgba(79,70,229,0.4)] transition-transform active:scale-95 touch-manipulation flex-shrink-0"
            >
              {isPlaying ? <Pause size={28} className="sm:w-9 sm:h-9 fill-current" /> : <Play size={28} className="sm:w-9 sm:h-9 fill-current ml-1" />}
            </button>
            <div className="w-12 sm:w-16 flex-shrink-0"></div>
          </div>
        </div>
      </div>
    );
  };

  // 4. Vista de Estadísticas
  const StatsView = () => (
    <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-900 text-slate-100 p-4 sm:p-6 safe-area-inset">
      <div className="bg-slate-800 p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl max-w-sm w-full text-center space-y-6 sm:space-y-8 border border-slate-700">
        <div className="flex justify-center text-yellow-500 mb-3 sm:mb-4 animate-bounce">
          <Trophy size={56} className="sm:w-16 sm:h-16" />
        </div>
        
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">¡Completado!</h2>
          <p className="text-xs sm:text-sm text-slate-400">Excelente entrenamiento visual.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">Velocidad</div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-400">{wpm} <span className="text-xs font-normal text-slate-500">WPM</span></div>
          </div>
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">Palabras</div>
            <div className="text-xl sm:text-2xl font-bold text-indigo-400">{Math.min(wordsRead, tokens.length)}</div>
          </div>
        </div>

        <button 
          onClick={() => { setView('home'); setCurrentIndex(0); setWordsRead(0); }}
          className="w-full py-3 sm:py-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base transition-colors shadow-lg touch-manipulation"
        >
          Volver al Inicio
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-slate-900 overflow-hidden font-sans selection:bg-emerald-500/30">
      {view === 'home' && <HomeView />}
      {view === 'rsvp' && <RSVPView />}
      {view === 'hybrid' && <HybridView />}
      {view === 'stats' && <StatsView />}
    </div>
  );
}