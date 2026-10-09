/**
 * alignment-engine.js
 * Motor de alinhamento inteligente entre fala reconhecida e roteiro do teleprompter.
 * Independente de interface, operando com janela deslizante, avanço monotônico,
 * pontuação de confiança e imunidade a improvisos.
 */

(function () {
  const Normalizer = typeof require !== "undefined"
    ? require("./text-normalizer")
    : (typeof window !== "undefined" ? window.TextNormalizer : null);

  class AlignmentEngine {
  /**
   * @param {Object} options
   * @param {Array} options.tokens - Lista de tokens gerados pelo TextNormalizer
   * @param {Array} options.lines - Lista de linhas geradas pelo TextNormalizer
   * @param {number} [options.lookaheadWindow=18] - Janela de palavras à frente na leitura normal
   * @param {number} [options.lookbackWindow=2] - Tolerância para trás na mesma oração
   * @param {number} [options.jumpLookahead=50] - Janela máxima para detectar salto à frente
   * @param {number} [options.minConsecutiveForJump=3] - Palavras consecutivas mínimas para validar salto
   * @param {number} [options.confidentThreshold=0.75] - Limiar de confiança alta
   * @param {number} [options.uncertainThreshold=0.55] - Limiar de correspondência incerta
   */
  constructor(options = {}) {
    this.tokens = options.tokens || [];
    this.lines = options.lines || [];
    this.lookaheadWindow = options.lookaheadWindow || 18;
    this.lookbackWindow = options.lookbackWindow || 2;
    this.jumpLookahead = options.jumpLookahead || 50;
    this.minConsecutiveForJump = options.minConsecutiveForJump || 3;
    this.confidentThreshold = options.confidentThreshold || 0.75;
    this.uncertainThreshold = options.uncertainThreshold || 0.55;

    this.currentIndex = 0;
    this.lastConfirmedIndex = 0;
    this.lastSpokenTimestamp = 0;
    this.isManualPaused = false;
    this.recentTranscripts = [];
  }

  /**
   * Atualiza os dados do roteiro (ao carregar ou editar texto)
   */
  setScript(tokens, lines) {
    this.tokens = tokens || [];
    this.lines = lines || [];
    this.currentIndex = Math.min(this.currentIndex, Math.max(0, this.tokens.length - 1));
    this.lastConfirmedIndex = this.currentIndex;
  }

  /**
   * Reposiciona manualmente o ponteiro de leitura (ex: clique, roda do mouse, atalhos).
   * O motor atualiza imediatamente suas referências internas para continuar a partir dali.
   * @param {number} tokenIndex 
   */
  repositionToIndex(tokenIndex) {
    const idx = Math.max(0, Math.min(tokenIndex, this.tokens.length - 1));
    this.currentIndex = idx;
    this.lastConfirmedIndex = idx;
    return this.getCurrentToken();
  }

  /**
   * Reposiciona por número de linha
   * @param {number} lineIndex 
   */
  repositionToLine(lineIndex) {
    if (!this.lines.length) return null;
    const lIdx = Math.max(0, Math.min(lineIndex, this.lines.length - 1));
    const line = this.lines[lIdx];
    if (line && line.firstTokenIndex !== null) {
      return this.repositionToIndex(line.firstTokenIndex);
    }
    return null;
  }

  /**
   * Define o estado de pausa manual
   * @param {boolean} paused 
   */
  setManualPaused(paused) {
    this.isManualPaused = !!paused;
  }

  /**
   * Retorna o token atual do roteiro
   */
  getCurrentToken() {
    return this.tokens[this.currentIndex] || null;
  }

  /**
   * Retorna a linha atual do roteiro
   */
  getCurrentLine() {
    const tok = this.getCurrentToken();
    if (!tok) return null;
    return this.lines[tok.lineIndex] || null;
  }

  /**
   * Processa uma transcrição vinda do reconhecimento de voz.
   * Avalia a fala contra a janela deslizante do roteiro.
   * @param {string} transcript 
   * @param {boolean} isFinal 
   * @returns {Object} Resultado do alinhamento
   */
  processSpokenTranscript(transcript, isFinal = false) {
    // 1. Pausa manual tem prioridade absoluta: não move o roteiro
    if (this.isManualPaused) {
      return {
        action: "HOLD",
        reason: "MANUAL_PAUSED",
        confidence: "NONE",
        currentIndex: this.currentIndex,
        token: this.getCurrentToken()
      };
    }

    if (!transcript || !this.tokens.length) {
      return {
        action: "HOLD",
        reason: "EMPTY_OR_NO_TOKENS",
        confidence: "NONE",
        currentIndex: this.currentIndex,
        token: this.getCurrentToken()
      };
    }

    // Normaliza as palavras faladas
    const rawWords = transcript.trim().split(/\s+/);
    const spokenTokens = rawWords
      .map((w) => (Normalizer || (typeof window !== "undefined" ? window.TextNormalizer : null)).normalize(w))
      .filter((w) => w.length > 0);

    if (spokenTokens.length === 0) {
      return {
        action: "HOLD",
        reason: "NO_SPOKEN_TOKENS",
        confidence: "NONE",
        currentIndex: this.currentIndex,
        token: this.getCurrentToken()
      };
    }

    // Mantém histórico recente das últimas frases para diagnóstico
    this.recentTranscripts.push({
      text: transcript,
      isFinal,
      time: Date.now()
    });
    if (this.recentTranscripts.length > 8) this.recentTranscripts.shift();

    // 2. Busca na janela deslizante local (normal reading: da posição atual até lookahead)
    const startSearch = Math.max(0, this.currentIndex - this.lookbackWindow);
    const endSearch = Math.min(this.tokens.length - 1, this.currentIndex + this.lookaheadWindow);

    let bestLocalMatch = this._findBestMatchInRange(spokenTokens, startSearch, endSearch);

    // 3. Avaliação da correspondência local
    if (bestLocalMatch && bestLocalMatch.score >= this.confidentThreshold) {
      // Correspondência confiável no trecho esperado
      const targetIndex = bestLocalMatch.tokenIndex;

      // Princípio monotônico: só avança ou mantém; não volta sem que seja
      // uma micro-correção na mesma linha com 2+ palavras idênticas
      if (targetIndex >= this.currentIndex) {
        this.currentIndex = targetIndex;
        this.lastConfirmedIndex = targetIndex;
        this.lastSpokenTimestamp = Date.now();

        return {
          action: "ADVANCE",
          confidence: "HIGH",
          currentIndex: this.currentIndex,
          token: this.getCurrentToken(),
          matchedWordsCount: bestLocalMatch.matchedCount,
          score: bestLocalMatch.score,
          isJump: false
        };
      } else if (targetIndex >= this.currentIndex - 1 && bestLocalMatch.matchedCount >= 2) {
        // Tolerância de 1 palavra para trás se confirmada com 2+ palavras
        this.currentIndex = targetIndex;
        this.lastConfirmedIndex = targetIndex;
        this.lastSpokenTimestamp = Date.now();

        return {
          action: "ADVANCE",
          confidence: "HIGH",
          currentIndex: this.currentIndex,
          token: this.getCurrentToken(),
          matchedWordsCount: bestLocalMatch.matchedCount,
          score: bestLocalMatch.score,
          isJump: false
        };
      }
    }

    // 4. Verificação de Salto de Trecho (quando o usuário pulou uma frase ou parágrafo)
    const jumpStart = Math.min(this.tokens.length - 1, this.currentIndex + this.lookaheadWindow);
    const jumpEnd = Math.min(this.tokens.length - 1, this.currentIndex + this.jumpLookahead);

    if (jumpStart < jumpEnd) {
      const jumpMatch = this._findBestMatchInRange(spokenTokens, jumpStart, jumpEnd);

      // Salto exige confirmação com múltiplas palavras consecutivas para evitar falsos positivos
      if (
        jumpMatch &&
        jumpMatch.score >= this.confidentThreshold &&
        jumpMatch.consecutiveMatches >= this.minConsecutiveForJump
      ) {
        this.currentIndex = jumpMatch.tokenIndex;
        this.lastConfirmedIndex = jumpMatch.tokenIndex;
        this.lastSpokenTimestamp = Date.now();

        return {
          action: "JUMP_FORWARD",
          confidence: "HIGH",
          currentIndex: this.currentIndex,
          token: this.getCurrentToken(),
          matchedWordsCount: jumpMatch.matchedCount,
          score: jumpMatch.score,
          isJump: true
        };
      }
    }

    // 5. Correspondência incerta ou improviso
    if (bestLocalMatch && bestLocalMatch.score >= this.uncertainThreshold) {
      // Transcrição parcial ou ambígua próxima do ponto
      return {
        action: "HOLD",
        confidence: "UNCERTAIN",
        reason: "AMBIGUOUS_OR_PARTIAL",
        currentIndex: this.currentIndex,
        token: this.getCurrentToken(),
        potentialScore: bestLocalMatch.score
      };
    }

    // 6. Nenhuma correspondência (improvisação, conversa fora do roteiro ou fala irreconhecível)
    // O sistema congela na última posição confirmada sem avançar cegamente
    return {
      action: "HOLD",
      confidence: "NONE",
      reason: "OFF_SCRIPT_OR_IMPROVISING",
      currentIndex: this.currentIndex,
      lastConfirmedIndex: this.lastConfirmedIndex,
      token: this.getCurrentToken()
    };
  }

  /**
   * Busca a melhor correspondência para a sequência de palavras faladas em uma faixa de tokens.
   * Utiliza matching de subsequências ponderado por similaridade de Levenshtein.
   * @private
   */
  _findBestMatchInRange(spokenTokens, startIndex, endIndex) {
    if (startIndex > endIndex || !spokenTokens.length) return null;

    let bestScore = 0;
    let bestTokenIndex = -1;
    let bestMatchedCount = 0;
    let bestConsecutive = 0;

    // Focamos nas últimas palavras faladas (tail), que representam o progresso mais recente
    const tailSpoken = spokenTokens.slice(-6); // últimas até 6 palavras faladas

    for (let scriptPos = startIndex; scriptPos <= endIndex; scriptPos++) {
      let currentScoreSum = 0;
      let matchedCount = 0;
      let consecutive = 0;
      let maxConsecutive = 0;

      // Compara a sequência de palavras faladas com a sequência do roteiro a partir de scriptPos
      for (let sIdx = 0; sIdx < tailSpoken.length; sIdx++) {
        const checkPos = scriptPos - (tailSpoken.length - 1 - sIdx);
        if (checkPos < 0 || checkPos >= this.tokens.length) continue;

        const scriptWordNorm = this.tokens[checkPos].normWord;
        const spokenWordNorm = tailSpoken[sIdx];

        const sim = (Normalizer || (typeof window !== "undefined" ? window.TextNormalizer : null)).similarity(scriptWordNorm, spokenWordNorm);
        if (sim >= 0.70) {
          currentScoreSum += sim;
          matchedCount++;
          consecutive++;
          if (consecutive > maxConsecutive) maxConsecutive = consecutive;
        } else {
          consecutive = 0;
        }
      }

      if (matchedCount > 0) {
        // Média ponderada pela quantidade de palavras encontradas
        const avgSim = currentScoreSum / tailSpoken.length;
        // Bônus para sequências consecutivas (evita pontuar palavras dispersas)
        const sequenceBonus = maxConsecutive >= 2 ? (maxConsecutive / tailSpoken.length) * 0.25 : 0;
        const finalScore = Math.min(1.0, avgSim + sequenceBonus);

        if (finalScore > bestScore) {
          bestScore = finalScore;
          bestTokenIndex = scriptPos;
          bestMatchedCount = matchedCount;
          bestConsecutive = maxConsecutive;
        }
      }
    }

    if (bestTokenIndex >= 0) {
      return {
        tokenIndex: bestTokenIndex,
        score: bestScore,
        matchedCount: bestMatchedCount,
        consecutiveMatches: bestConsecutive
      };
    }
    return null;
  }
}

  if (typeof module !== "undefined" && module.exports) {
    module.exports = AlignmentEngine;
  }
  if (typeof window !== "undefined") {
    window.AlignmentEngine = AlignmentEngine;
  }
})();

