/**
 * speech-recognizer.js
 * Módulo de reconhecimento de fala em português brasileiro (pt-BR).
 * Arquitetura abstrata modular que permite alternar entre Web Speech API nativa,
 * simulação para testes e motores locais (Whisper.cpp/Vosk).
 */

(function () {
  class BaseSpeechRecognizer {
    constructor(options = {}) {
      this.lang = options.lang || "pt-BR";
      this.active = false;
      this.stopping = false;
    this.onResult = options.onResult || null;
    this.onError = options.onError || null;
    this.onStatusChange = options.onStatusChange || null;
    this.recentTranscripts = [];
  }

  start() {
    throw new Error("start() deve ser implementado pela subclasse");
  }

  stop() {
    throw new Error("stop() deve ser implementado pela subclasse");
  }

  isAvailable() {
    return false;
  }

  getRecentTranscripts() {
    return [...this.recentTranscripts];
  }

  _recordTranscript(text, isFinal, confidence = 1.0) {
    const item = { text, isFinal, confidence, timestamp: Date.now() };
    this.recentTranscripts.push(item);
    if (this.recentTranscripts.length > 10) this.recentTranscripts.shift();
    return item;
  }
}

/**
 * Reconhecedor baseado na Web Speech API (Chromium / Electron)
 */
class WebSpeechRecognizer extends BaseSpeechRecognizer {
  constructor(options = {}) {
    super(options);
    this.recognition = null;
    this.restartTimeout = null;
    this.restartAttempts = 0;
    this.maxRapidRestarts = 5;
    this.lastStartTime = 0;
  }

  isAvailable() {
    if (typeof window === "undefined") return false;
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  start() {
    if (this.active) {
      console.log("[WebSpeechRecognizer] Já está ativo.");
      return;
    }

    if (!this.isAvailable()) {
      const err = "Web Speech API não disponível neste ambiente.";
      if (typeof this.onError === "function") this.onError({ code: "NOT_SUPPORTED", message: err });
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
      this.recognition = new SpeechRec();
    } catch (e) {
      if (typeof this.onError === "function") this.onError({ code: "INIT_FAILED", message: String(e) });
      return;
    }

    this.recognition.lang = this.lang;
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.active = true;
    this.stopping = false;
    this.lastStartTime = Date.now();

    this.recognition.onstart = () => {
      this.restartAttempts = 0;
      if (typeof this.onStatusChange === "function") {
        this.onStatusChange({ status: "LISTENING", lang: this.lang });
      }
    };

    this.recognition.onresult = (event) => {
      if (!this.active) return;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = res[0] ? res[0].transcript : "";
        const confidence = res[0] ? (res[0].confidence || 0.9) : 0.9;
        const isFinal = res.isFinal;

        if (transcript.trim()) {
          this._recordTranscript(transcript.trim(), isFinal, confidence);

          if (typeof this.onResult === "function") {
            this.onResult({
              transcript: transcript.trim(),
              isFinal,
              confidence
            });
          }
        }
      }
    };

    this.recognition.onerror = (event) => {
      const errCode = event.error;
      console.warn("[WebSpeechRecognizer] Erro:", errCode);

      // Erro "no-speech" é comum e esperado em pausas/silêncio prolongado
      if (errCode === "no-speech") {
        return;
      }

      if (errCode === "not-allowed" || errCode === "service-not-allowed") {
        this.stopping = true;
        this.active = false;
        if (typeof this.onError === "function") {
          this.onError({ code: "PERMISSION_DENIED", message: "Permissão de microfone negada." });
        }
        return;
      }

      if (errCode === "network") {
        if (typeof this.onError === "function") {
          this.onError({ code: "NETWORK_ERROR", message: "Reconhecimento dependente de rede falhou ou sem conexão." });
        }
      }
    };

    this.recognition.onend = () => {
      // Chromium encerra a sessão periodicamente ou após silêncio.
      // Se não foi uma parada solicitada pelo usuário, reconecta de forma resiliente.
      if (this.active && !this.stopping) {
        const uptime = Date.now() - this.lastStartTime;
        if (uptime < 1500) {
          this.restartAttempts++;
        } else {
          this.restartAttempts = 0;
        }

        if (this.restartAttempts >= this.maxRapidRestarts) {
          console.warn("[WebSpeechRecognizer] Muitas reinicializações rápidas. Pausando auto-restart.");
          this.active = false;
          if (typeof this.onError === "function") {
            this.onError({ code: "EXCESSIVE_RESTARTS", message: "Serviço de voz instável. Clique para reiniciar." });
          }
          return;
        }

        const delay = Math.min(1000, 200 + this.restartAttempts * 200);
        this.restartTimeout = setTimeout(() => {
          if (this.active && !this.stopping) {
            try {
              this.recognition.start();
            } catch (err) {
              console.warn("[WebSpeechRecognizer] Falha ao reiniciar:", err);
            }
          }
        }, delay);
      } else {
        this.active = false;
        if (typeof this.onStatusChange === "function") {
          this.onStatusChange({ status: "STOPPED" });
        }
      }
    };

    try {
      this.recognition.start();
    } catch (e) {
      this.active = false;
      if (typeof this.onError === "function") {
        this.onError({ code: "START_FAILED", message: String(e) });
      }
    }
  }

  stop() {
    this.stopping = true;
    this.active = false;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (_) {}
    }
    if (typeof this.onStatusChange === "function") {
      this.onStatusChange({ status: "STOPPED" });
    }
  }
}

/**
 * Reconhecedor simulado para testes unitários automatizados e cenários determinísticos
 */
class MockSpeechRecognizer extends BaseSpeechRecognizer {
  constructor(options = {}) {
    super(options);
    this.transcriptQueue = [];
    this.intervalId = null;
    this.speedMs = options.speedMs || 400;
  }

  isAvailable() {
    return true;
  }

  loadScriptPhrases(phrases = []) {
    this.transcriptQueue = [...phrases];
  }

  feedTranscript(text, isFinal = true, confidence = 0.95) {
    this._recordTranscript(text, isFinal, confidence);
    if (typeof this.onResult === "function") {
      this.onResult({ transcript: text, isFinal, confidence });
    }
  }

  start() {
    this.active = true;
    this.stopping = false;
    if (typeof this.onStatusChange === "function") {
      this.onStatusChange({ status: "LISTENING", lang: this.lang });
    }

    if (this.transcriptQueue.length > 0) {
      this.intervalId = setInterval(() => {
        if (!this.active || this.transcriptQueue.length === 0) {
          this.stop();
          return;
        }
        const phrase = this.transcriptQueue.shift();
        this.feedTranscript(phrase, true);
      }, this.speedMs);
    }
  }

  stop() {
    this.stopping = true;
    this.active = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (typeof this.onStatusChange === "function") {
      this.onStatusChange({ status: "STOPPED" });
    }
  }
}

/**
 * Reconhecedor Local com Whisper Offline e Seleção de Microfone.
 * Captura áudio mono a 16kHz em tempo real, monitora VU meter,
 * detecta atividade vocal com piso de ruído adaptativo e transcreve
 * as palavras localmente via Whisper no processo principal.
 */
class LocalWhisperSpeechRecognizer extends BaseSpeechRecognizer {
  constructor(options = {}) {
    super(options);
    this.deviceId = options.deviceId || null;
    this.audioContext = null;
    this.mediaStream = null;
    this.analyser = null;
    this.processor = null;
    this.rafId = null;

    this.isSpeaking = false;
    this.lastVoiceTime = 0;
    this.speechChunks = [];
    this.preRollChunks = [];
    this.totalSamples = 0;
    this.isTranscribing = false;

    this.onAudioLevel = options.onAudioLevel || null;
    this.silenceTimeoutMs = options.silenceTimeoutMs || 1800;
    this.noiseFloor = 0.005;
    this.sensitivity = options.sensitivity || 0.007;
  }

  isAvailable() {
    return typeof window !== "undefined" &&
      !!(window.AudioContext || window.webkitAudioContext) &&
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async setDeviceId(deviceId) {
    this.deviceId = deviceId;
    if (this.active) {
      this.stop();
      await this.start();
    }
  }

  async start() {
    if (this.active) return;
    this.stopping = false;
    this.speechChunks = [];
    this.totalSamples = 0;
    this.isSpeaking = false;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: 16000 });
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      };
      if (this.deviceId) {
        audioConstraints.deviceId = { exact: this.deviceId };
      }

      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      } catch (e) {
        if (this.deviceId) {
          console.warn("[LocalWhisper] Microfone específico falhou, usando padrão:", e);
          this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          });
        } else {
          throw e;
        }
      }

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.2;
      source.connect(this.analyser);

      // ScriptProcessorNode para coletar amostras PCM reais a 16kHz
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (e) => {
        if (!this.active || this.stopping) return;
        const inputData = e.inputBuffer.getChannelData(0);
        this._handlePcmInput(inputData);
      };

      source.connect(this.processor);
      // Silencia a saída para os alto-falantes para evitar qualquer eco ou microfonia
      const muteGain = this.audioContext.createGain();
      muteGain.gain.value = 0;
      this.processor.connect(muteGain);
      muteGain.connect(this.audioContext.destination);

      this.active = true;
      if (typeof this.onStatusChange === "function") {
        try {
          this.onStatusChange({ status: "LISTENING", mode: "LOCAL_WHISPER" });
        } catch (_) {}
      }

      this._monitorAudioLevels();
    } catch (err) {
      this.active = false;
      console.warn("[LocalWhisper] Falha ao iniciar microfone:", err);
      if (typeof this.onError === "function") {
        try {
          this.onError({ code: "MIC_ERROR", message: "Erro ao abrir microfone: " + err.message });
        } catch (_) {}
      }
    }
  }

  _monitorAudioLevels() {
    const buffer = new Float32Array(this.analyser.fftSize);

    const checkLevel = () => {
      if (!this.active || this.stopping) return;
      try {
        this.analyser.getFloatTimeDomainData(buffer);

        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / buffer.length);

        if (typeof this.onAudioLevel === "function") {
          try {
            this.onAudioLevel(rms, this.isSpeaking);
          } catch (_) {}
        }

        // Atualiza piso de ruído adaptativo dinamicamente
        if (!this.isSpeaking) {
          this.noiseFloor = Math.max(0.001, Math.min(0.025, this.noiseFloor * 0.98 + rms * 0.02));
        }

        const threshold = Math.max(0.007, this.noiseFloor * 1.5 + this.sensitivity);

        if (rms > threshold) {
          this.lastVoiceTime = Date.now();
          if (!this.isSpeaking) {
            this.isSpeaking = true;
            if (typeof this.onStatusChange === "function") {
              try {
                this.onStatusChange({ status: "SPEAKING", volume: rms });
              } catch (_) {}
            }
          }
        } else {
          if (this.isSpeaking && (Date.now() - this.lastVoiceTime > this.silenceTimeoutMs)) {
            this.isSpeaking = false;
            // Se restaram amostras de fala que ainda não foram enviadas, envia para o Whisper
            if (this.speechChunks.length > 0 && !this.isTranscribing && this.totalSamples >= 8000) {
              this._dispatchSpeechToWhisper();
            }
            if (typeof this.onStatusChange === "function") {
              try {
                this.onStatusChange({ status: "LISTENING", volume: 0 });
              } catch (_) {}
            }
            if (typeof this.onResult === "function") {
              try {
                this.onResult({
                  transcript: "",
                  isFinal: true,
                  isSilence: true,
                  confidence: 1.0
                });
              } catch (resErr) {
                console.warn("[LocalWhisper] Aviso no callback onResult:", resErr);
              }
            }
          }
        }
      } catch (loopErr) {
        console.warn("[LocalWhisper] Erro no loop de áudio:", loopErr);
      } finally {
        if (this.active && !this.stopping) {
          this.rafId = requestAnimationFrame(checkLevel);
        }
      }
    };

    this.rafId = requestAnimationFrame(checkLevel);
  }

  _handlePcmInput(pcmChunk) {
    const copy = new Float32Array(pcmChunk.length);
    copy.set(pcmChunk);

    // Mantém pre-roll circular de ~750ms para não cortar o início da fala
    if (!this.preRollChunks) this.preRollChunks = [];
    this.preRollChunks.push(copy);
    if (this.preRollChunks.length > 3) {
      this.preRollChunks.shift();
    }

    if (this.isSpeaking) {
      if (this.speechChunks.length === 0) {
        // Injeta o buffer de pre-roll no início da nova frase
        for (const pre of this.preRollChunks) {
          this.speechChunks.push(pre);
          this.totalSamples += pre.length;
        }
      } else {
        this.speechChunks.push(copy);
        this.totalSamples += copy.length;
      }

      // Se o usuário fez uma pausa leve na fala (> 450ms) ou o chunk acumulado atingiu ~3.5s (56000 amostras)
      const silenceDuration = Date.now() - this.lastVoiceTime;
      const reachedMaxChunk = this.totalSamples >= 56000;
      const pauseAfterSpeech = this.speechChunks.length >= 2 && silenceDuration > 450;

      if ((reachedMaxChunk || pauseAfterSpeech) && !this.isTranscribing && this.totalSamples >= 8000) {
        this._dispatchSpeechToWhisper();
      }
    }
  }

  async _dispatchSpeechToWhisper() {
    if (this.isTranscribing || !this.speechChunks.length) return;
    this.isTranscribing = true;

    // Mescla todos os pedaços num único Float32Array contínuo
    const merged = new Float32Array(this.totalSamples);
    let offset = 0;
    for (const chunk of this.speechChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    this.speechChunks = [];
    this.totalSamples = 0;

    try {
      if (typeof window !== "undefined" && window.desktopApi && window.desktopApi.speech) {
        // Normalização de pico (software AGC) para que microfones com ganho baixo sejam compreendidos com clareza
        let peak = 0;
        for (let i = 0; i < merged.length; i++) {
          const abs = Math.abs(merged[i]);
          if (abs > peak) peak = abs;
        }
        if (peak > 0.003 && peak < 0.6) {
          const scale = Math.min(6.0, 0.75 / peak);
          for (let i = 0; i < merged.length; i++) {
            merged[i] *= scale;
          }
        }

        const res = await window.desktopApi.speech.transcribe(Array.from(merged));
        if (res && res.text) {
          // Remove marcadores automáticos do Whisper como [música], [ruído], etc.
          let cleanText = res.text
            .replace(/\[.*?\]/g, "")
            .replace(/\(.*?\)/g, "")
            .replace(/♫.*?♫/g, "")
            .trim();

          const lower = cleanText.toLowerCase();
          const hallucinations = [
            "obrigado por assistir",
            "inscreva-se no canal",
            "legendas pela",
            "subtitles by",
            "transmissão",
            "você",
            "e"
          ];
          for (const h of hallucinations) {
            if (lower === h || lower === h + ".") {
              cleanText = "";
              break;
            }
          }

          if (cleanText.length > 0 && typeof this.onResult === "function") {
            try {
              this.onResult({
                transcript: cleanText,
                isFinal: true,
                confidence: 0.95
              });
            } catch (err) {
              console.warn("[LocalWhisper] Erro no onResult pós-Whisper:", err);
            }
          }
        }
      }
    } catch (err) {
      console.warn("[LocalWhisper] Falha na transcrição:", err);
    } finally {
      this.isTranscribing = false;
      if (this.speechChunks.length > 0 && this.totalSamples >= 16000) {
        this._dispatchSpeechToWhisper();
      }
    }
  }

  stop() {
    this.stopping = true;
    this.active = false;
    this.isSpeaking = false;
    this.speechChunks = [];
    this.totalSamples = 0;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.processor) {
      try { this.processor.disconnect(); } catch (_) {}
      this.processor = null;
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((t) => t.stop());
      } catch (_) {}
      this.mediaStream = null;
    }
    if (this.audioContext) {
      try { this.audioContext.close(); } catch (_) {}
      this.audioContext = null;
    }
    if (typeof this.onStatusChange === "function") {
      this.onStatusChange({ status: "STOPPED" });
    }
  }
}

/**
 * Reconhecedor Híbrido inteligente.
 * Prioriza LocalWhisperSpeechRecognizer no Desktop (offline, preciso e sem falhas)
 * e WebSpeechRecognizer em navegadores completos (Google Chrome extension).
 */
class HybridSpeechRecognizer extends BaseSpeechRecognizer {
  constructor(options = {}) {
    super(options);
    this.options = options;
    this.activeEngine = "NONE";

    const isElectron = typeof window !== "undefined" &&
      (!!window.desktopApi || (typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes(" electron/")));

    if (isElectron) {
      // Desktop Electron: Whisper local com reconhecimento de fala real em PT-BR e microfone selecionável
      this.activeEngine = "LOCAL_WHISPER";
      this.engine = new LocalWhisperSpeechRecognizer(options);
    } else if (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      // Extensão Chrome: Web Speech API oficial
      this.activeEngine = "WEBSPEECH";
      this.engine = new WebSpeechRecognizer(options);
    } else {
      this.activeEngine = "LOCAL_WHISPER";
      this.engine = new LocalWhisperSpeechRecognizer(options);
    }
  }

  setDeviceId(deviceId) {
    if (this.engine && typeof this.engine.setDeviceId === "function") {
      return this.engine.setDeviceId(deviceId);
    }
  }

  isAvailable() {
    return this.engine ? this.engine.isAvailable() : true;
  }

  start() {
    this.active = true;
    this.stopping = false;
    if (this.engine) {
      return this.engine.start();
    }
  }

  stop() {
    this.stopping = true;
    this.active = false;
    if (this.engine) {
      return this.engine.stop();
    }
  }
}

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      BaseSpeechRecognizer,
      WebSpeechRecognizer,
      MockSpeechRecognizer,
      LocalWhisperSpeechRecognizer,
      HybridSpeechRecognizer
    };
  }
  if (typeof window !== "undefined") {
    window.BaseSpeechRecognizer = BaseSpeechRecognizer;
    window.WebSpeechRecognizer = WebSpeechRecognizer;
    window.MockSpeechRecognizer = MockSpeechRecognizer;
    window.LocalWhisperSpeechRecognizer = LocalWhisperSpeechRecognizer;
    window.HybridSpeechRecognizer = HybridSpeechRecognizer;
  }
})();


