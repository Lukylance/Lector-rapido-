import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Settings, Upload, BookOpen, RotateCcw, Trophy, Zap, Eye, ChevronLeft, FileUp, Loader2 } from 'lucide-react';

// --- CONFIGURACIÓN Y CONSTANTES ---
const STOP_WORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "y", "o", "pero", "de", "del", 
  "a", "ante", "con", "por", "para", "según", "sin", "sobre", "tras", "que", "en", "su", "sus", "al"
]);

const DEFAULT_TEXT = `El cerebro humano es una máquina increíblemente adaptable. Cuando leemos de forma tradicional, nuestros ojos realizan pequeños saltos llamados movimientos sacádicos. Entre cada salto, el ojo se detiene por una fracción de segundo para enfocar la palabra, lo que se conoce como fijación. Además, la mayoría de las personas tienen el hábito de la subvocalización, que es pronunciar mentalmente cada palabra que leen. Esto limita severamente nuestra velocidad de lectura al ritmo del habla, generalmente entre doscientas y trescientas palabras por minuto. Sin embargo, al utilizar la Presentación Visual Serial Rápida, eliminamos la necesidad de mover los ojos y reducimos drásticamente la subvocalización. Al centrar nuestra visión en el Punto Óptimo de Reconocimiento de cada palabra, nuestro cerebro puede procesar la información visual casi instantáneamente. Con práctica, es posible duplicar o triplicar la velocidad de lectura sin perder comprensión.`;

// --- FUNCIONES UTILITARIAS ---

// Obtiene el índice del Punto Óptimo de Reconocimiento (ORP)
const getORPIndex = (word) => {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
};

// Divide el texto en palabras limpias
const tokenizeText = (text) => {
  return text.trim().split(/\s+/).filter(word => word.length > 0);
};

// Carga dinámica de JSZip para evitar errores de empaquetado
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

// Extrae el texto plano de un archivo ePub
const extractTextFromEpub = async (file) => {
  try {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(file);
    const parser = new DOMParser();
    
    // 1. Encontrar el archivo OPF
    const containerXml = await zip.file("META-INF/container.xml").async("string");
    const containerDoc = parser.parseFromString(containerXml, "application/xml");
    const rootfile = containerDoc.getElementsByTagName("rootfile")[0].getAttribute("full-path");
    
    // 2. Leer el OPF para obtener el orden de lectura (spine)
    const basePath = rootfile.includes('/') ? rootfile.substring(0, rootfile.lastIndexOf('/') + 1) : "";
    const opfXml = await zip.file(rootfile).async("string");
    const opfDoc = parser.parseFromString(opfXml, "application/xml");
    
    // Mapear IDs a rutas de archivos
    const manifestItems = opfDoc.getElementsByTagName("item");
    const manifest = {};
    for (let item of manifestItems) {
      manifest[item.getAttribute("id")] = item.getAttribute("href");
    }
    
    // Obtener el orden de los capítulos
    const spineItems = opfDoc.getElementsByTagName("itemref");
    const spine = Array.from(spineItems).map(item => item.getAttribute("idref"));
    
    // 3. Extraer texto de cada capítulo HTML/XHTML
    let fullText = "";
    for (const id of spine) {
      const href = manifest[id];
      if (href) {
        // Manejar rutas codificadas en URL dentro del ePub
        const decodedHref = decodeURIComponent(href);
        const filePath = basePath + decodedHref;
        const fileData = zip.file(filePath);
        
        if (fileData) {
          const html = await fileData.async("string");
          const doc = parser.parseFromString(html, "text/html");
          // Extraer solo el texto visible, ignorando scripts y estilos
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
  
  // Configuraciones
  const [wpm, setWpm] = useState(300);
  const [chunkSize, setChunkSize] = useState(4);
  const [skipStopWords, setSkipStopWords] = useState(true);
  
  // Estado de lectura
  const [currentIndex, setCurrentIndex] = useState(0); // Índice de la palabra actual
  const [isPlaying, setIsPlaying] = useState(false);
  const [wordsRead, setWordsRead] = useState(0);

  // Inicializar tokens
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
    <div className="flex flex-col h-full w-full bg-slate-900 text-slate-100 p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4 text-emerald-400">
            <Zap size={48} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Lector de Alto Rendimiento</h1>
          <p className="text-slate-400">Abre archivos EPUB o TXT y entrena tu velocidad visual.</p>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl shadow-xl space-y-6 border border-slate-700 relative overflow-hidden">
          {isLoading && (
             <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                <Loader2 size={40} className="text-emerald-500 animate-spin mb-4" />
                <span className="font-semibold text-lg text-emerald-400">Procesando libro...</span>
             </div>
          )}
          
          <div className="flex items-center space-x-4">
            <label className="flex-1 flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 cursor-pointer p-4 rounded-xl transition-colors shadow-lg font-bold">
              <FileUp size={24} />
              <span>Abrir .EPUB o .TXT</span>
              <input type="file" accept=".txt,.epub" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
          
          <div className="bg-slate-900 rounded-lg p-3 text-sm text-slate-400 flex justify-between items-center border border-slate-700">
             <span className="truncate pr-4">📄 {fileName}</span>
             <span className="whitespace-nowrap font-mono">{tokens.length} palabras</span>
          </div>

          <div>
            <textarea
              className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="O pega tu texto directamente aquí..."
            />
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl shadow-xl space-y-6 border border-slate-700">
          <h2 className="text-xl font-semibold flex items-center space-x-2">
            <Settings size={24} className="text-emerald-400" />
            <span>Configuración del Motor</span>
          </h2>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">Velocidad de Lectura</label>
                <span className="font-bold text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded">{wpm} WPM</span>
              </div>
              <input 
                type="range" min="100" max="1000" step="10" 
                value={wpm} onChange={(e) => setWpm(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">Ancho del Teleprompter (Chunks)</label>
                <span className="font-bold text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded">{chunkSize} palabras</span>
              </div>
              <input 
                type="range" min="1" max="10" step="1" 
                value={chunkSize} onChange={(e) => setChunkSize(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500/50 transition">
              <input 
                type="checkbox" 
                checked={skipStopWords} 
                onChange={(e) => setSkipStopWords(e.target.checked)}
                className="w-5 h-5 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-800 border-slate-600"
              />
              <span className="text-sm text-slate-300 font-medium">Atenuar palabras de relleno (Skimming visual)</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <button 
            onClick={() => handleStart('rsvp')}
            className="flex flex-col items-center justify-center p-6 bg-slate-800 hover:bg-slate-700 border-2 border-emerald-600/30 hover:border-emerald-500 rounded-2xl transition-all shadow-lg group"
          >
            <Eye size={36} className="mb-3 text-emerald-500 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-lg">Modo RSVP</span>
            <span className="text-xs text-slate-400 text-center mt-2">Palabra por palabra.<br/>Enfoque absoluto.</span>
          </button>
          
          <button 
            onClick={() => handleStart('hybrid')}
            className="flex flex-col items-center justify-center p-6 bg-indigo-600 hover:bg-indigo-500 rounded-2xl transition-all shadow-lg hover:shadow-indigo-500/20 group"
          >
            <BookOpen size={36} className="mb-3 text-indigo-100 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-lg">Modo Teleprompter</span>
            <span className="text-xs text-indigo-200 text-center mt-2">Bloques fijos en el centro.<br/>Flujo continuo.</span>
          </button>
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
      <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 relative">
        <div className="absolute top-0 w-full p-4 flex justify-between items-center bg-slate-900/50 backdrop-blur-sm z-10">
          <button onClick={() => { setIsPlaying(false); setView('home'); }} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
            <ChevronLeft size={24} />
          </button>
          <div className="text-emerald-400 font-bold">{wpm} WPM</div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 relative cursor-pointer" onClick={playPause}>
          <div className="absolute top-1/2 left-0 w-full h-[2px] bg-slate-800 -translate-y-1/2 z-0"></div>
          <div className="absolute top-1/4 bottom-1/4 left-1/2 w-[2px] bg-slate-800 -translate-x-1/2 z-0 opacity-30"></div>

          <div className="text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight flex items-center z-10 font-sans select-none">
            <div className="w-[45vw] text-right text-slate-300">{leftPart}</div>
            <div className="text-emerald-500 font-bold px-[1px]">{orpChar}</div>
            <div className="w-[45vw] text-left text-slate-300">{rightPart}</div>
          </div>
        </div>

        <div className="p-6 bg-slate-900 border-t border-slate-800 flex flex-col items-center space-y-6">
          <input 
            type="range" min="0" max={tokens.length - 1} 
            value={currentIndex} onChange={(e) => { setCurrentIndex(Number(e.target.value)); setIsPlaying(false); }}
            className="w-full max-w-2xl h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex items-center space-x-8">
            <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 10))} className="p-4 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition">
              <RotateCcw size={24} />
            </button>
            <button 
              onClick={playPause}
              className="w-20 h-20 flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-full shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-transform active:scale-95"
            >
              {isPlaying ? <Pause size={36} className="fill-current" /> : <Play size={36} className="fill-current ml-2" />}
            </button>
            <div className="w-16"></div> 
          </div>
        </div>
      </div>
    );
  };

  // 3. Vista de Teleprompter (Chunks fijos)
  const HybridView = () => {
    const timerRef = useRef(null);
    const playPause = () => setIsPlaying(!isPlaying);

    // Preparar los chunks (bloques de palabras)
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

    // Renderiza un bloque de palabras con la lógica de "Skimming"
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
      <div className="flex flex-col h-full w-full bg-[#0a0f1a] text-slate-100 relative overflow-hidden">
        {/* Barra superior */}
        <div className="absolute top-0 w-full p-4 flex justify-between items-center bg-transparent z-20">
          <button onClick={() => { setIsPlaying(false); setView('home'); }} className="p-2 bg-slate-800/80 backdrop-blur rounded-full hover:bg-slate-700">
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center space-x-3 bg-slate-800/80 backdrop-blur px-4 py-2 rounded-full">
            <span className="text-xs text-indigo-300 font-semibold tracking-wider uppercase">Teleprompter</span>
            <div className="w-1 h-4 bg-slate-600 rounded"></div>
            <span className="text-indigo-400 font-bold">{wpm} WPM</span>
          </div>
        </div>

        {/* Zona del Teleprompter */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 cursor-pointer relative" onClick={playPause}>
           
           {/* Guías de enfoque visuales (Opcionales, ayudan a centrar la vista) */}
           <div className="absolute top-1/2 left-0 w-full h-24 bg-indigo-900/10 -translate-y-1/2 z-0 border-y border-indigo-500/10 pointer-events-none"></div>

           <div className="flex flex-col items-center justify-center w-full max-w-4xl space-y-6 md:space-y-8 z-10 select-none">
             {/* Renderizamos el bloque anterior, el actual y el siguiente */}
             {[-2, -1, 0, 1, 2].map(offset => {
               const idx = currentChunkIndex + offset;
               const chunk = chunks[idx];
               const isActive = offset === 0;

               // Marcadores de posición vacíos si estamos al inicio o fin
               if (!chunk) return <div key={offset} className="h-12 md:h-16"></div>;

               // Lógica de estilos según la posición (efecto difuminado/enfoque)
               let styles = "text-center transition-all duration-300 ease-out will-change-transform ";
               if (isActive) {
                 styles += "text-3xl md:text-5xl lg:text-6xl text-indigo-100 font-bold scale-100 opacity-100 drop-shadow-[0_0_15px_rgba(99,102,241,0.3)]";
               } else if (Math.abs(offset) === 1) {
                 styles += "text-xl md:text-2xl text-slate-400 scale-90 opacity-40 blur-[1px]";
               } else {
                 styles += "text-lg md:text-xl text-slate-600 scale-75 opacity-10 blur-[2px]";
               }

               return (
                 <div key={`${idx}-${offset}`} className={styles}>
                   {renderChunkText(chunk, isActive)}
                 </div>
               );
             })}
           </div>
        </div>

        {/* Controles Inferiores */}
        <div className="p-6 bg-[#0d1322] border-t border-slate-800/50 flex flex-col items-center space-y-6 relative z-20">
          <input 
            type="range" min="0" max={tokens.length - 1} step={chunkSize}
            value={currentIndex} onChange={(e) => { setCurrentIndex(Number(e.target.value)); setIsPlaying(false); }}
            className="w-full max-w-2xl h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex items-center space-x-8">
            <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - chunkSize * 5))} className="p-4 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition">
              <RotateCcw size={24} />
            </button>
            <button 
              onClick={playPause}
              className="w-20 h-20 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-[0_0_30px_rgba(79,70,229,0.4)] transition-transform active:scale-95"
            >
              {isPlaying ? <Pause size={36} className="fill-current" /> : <Play size={36} className="fill-current ml-2" />}
            </button>
            <div className="w-16"></div>
          </div>
        </div>
      </div>
    );
  };

  // 4. Vista de Estadísticas
  const StatsView = () => (
    <div className="flex flex-col items-center justify-center h-full w-full bg-slate-900 text-slate-100 p-6">
      <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-8 border border-slate-700">
        <div className="flex justify-center text-yellow-500 mb-4 animate-bounce">
          <Trophy size={64} />
        </div>
        
        <div>
          <h2 className="text-3xl font-bold mb-2">¡Sesión Completada!</h2>
          <p className="text-slate-400">Excelente entrenamiento visual.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-700">
            <div className="text-sm text-slate-400 mb-1">Velocidad Alcanzada</div>
            <div className="text-2xl font-bold text-emerald-400">{wpm} <span className="text-sm font-normal text-slate-500">WPM</span></div>
          </div>
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-700">
            <div className="text-sm text-slate-400 mb-1">Palabras Leídas</div>
            <div className="text-2xl font-bold text-indigo-400">{Math.min(wordsRead, tokens.length)}</div>
          </div>
        </div>

        <button 
          onClick={() => { setView('home'); setCurrentIndex(0); setWordsRead(0); }}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-lg transition-colors shadow-lg"
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