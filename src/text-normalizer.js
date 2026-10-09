/**
 * text-normalizer.js
 * Módulo de normalização textual e tokenização para alinhamento em português brasileiro.
 * Preserva o texto original intacto enquanto cria tokens normalizados para comparação.
 */

(function () {
  class TextNormalizer {
  /**
   * Normaliza uma string de texto para fins de comparação fonética/textual.
   * Remove acentos, pontuação, múltiplos espaços e converte para minúsculas.
   * @param {string} text 
   * @returns {string}
   */
  static normalize(text) {
    if (!text) return "";
    return String(text)
      .toLowerCase()
      // Remove acentos e diacríticos mantendo os caracteres base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // Trata caracteres especiais específicos da língua portuguesa e tipografia
      .replace(/[çÇ]/g, "c")
      .replace(/[“”"']/g, "")
      .replace(/[—–-]/g, " ")
      // Remove pontuação restante
      .replace(/[.,\/#!$%\^&\*;:{}=\_`~()?¡¿!+@<>|\\\[\]]/g, " ")
      // Colapsa múltiplos espaços em branco e quebras de linha
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Mapeamento de equivalências comuns faladas vs escritas em PT-BR
   * (ex: "pra" <-> "para", "tá" <-> "está", numerais falados, etc.)
   */
  static normalizeToken(word) {
    const n = this.normalize(word);
    const aliases = {
      "pra": "para",
      "pro": "para o",
      "pras": "para as",
      "pros": "para os",
      "ta": "esta",
      "tao": "estao",
      "to": "estou",
      "tava": "estava",
      "vc": "voce",
      "vcs": "voces",
      "ne": "nao e",
      "eh": "e",
      "dq": "do que",
      "pq": "porque",
      "q": "que",
      "vamo": "vamos",
      "bora": "vamos",
      "blz": "beleza",
      "pera": "espera",
      "obg": "obrigado"
    };
    return aliases[n] || n;
  }

  /**
   * Tokeniza o roteiro preservando a estrutura original (linhas, posições de caracteres)
   * e gerando metadados para rolagem e destaque visual preciso.
   * @param {string} rawScript 
   * @returns {{ raw: string, tokens: Array, lines: Array }}
   */
  static tokenizeScript(rawScript) {
    const raw = String(rawScript || "");
    const rawLines = raw.split(/\r?\n/);
    const tokens = [];
    const lines = [];

    let globalTokenIndex = 0;
    let charOffset = 0;

    for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex++) {
      const lineText = rawLines[lineIndex];
      const lineStartChar = charOffset;
      const lineEndChar = lineStartChar + lineText.length;
      charOffset = lineEndChar + 1; // +1 para a quebra de linha

      const lineTokens = [];
      // Expressão regular Unicode para capturar cada palavra (letras e números)
      const wordRegex = /[\p{L}\p{N}]+/gu;
      let match;

      while ((match = wordRegex.exec(lineText)) !== null) {
        const rawWord = match[0];
        const normWord = this.normalize(rawWord);

        // Se após normalizar a palavra tiver conteúdo comparável
        if (normWord.length > 0) {
          const token = {
            index: globalTokenIndex,
            lineIndex: lineIndex,
            wordIndexInLine: lineTokens.length,
            rawWord: rawWord,
            normWord: normWord,
            charStart: lineStartChar + match.index,
            charEnd: lineStartChar + match.index + rawWord.length,
            elementId: `tok-${globalTokenIndex}`
          };

          tokens.push(token);
          lineTokens.push(token);
          globalTokenIndex++;
        }
      }

      lines.push({
        lineIndex: lineIndex,
        rawText: lineText,
        normText: this.normalize(lineText),
        tokens: lineTokens,
        charStart: lineStartChar,
        charEnd: lineEndChar,
        firstTokenIndex: lineTokens.length > 0 ? lineTokens[0].index : null,
        lastTokenIndex: lineTokens.length > 0 ? lineTokens[lineTokens.length - 1].index : null
      });
    }

    return {
      raw,
      tokens,
      lines,
      tokenCount: tokens.length,
      lineCount: lines.length
    };
  }

  /**
   * Calcula distância de Levenshtein entre duas palavras
   * @param {string} a 
   * @param {string} b 
   * @returns {number}
   */
  static levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const row = [];
    for (let i = 0; i <= b.length; i++) row[i] = i;

    for (let i = 1; i <= a.length; i++) {
      let prev = i;
      for (let j = 1; j <= b.length; j++) {
        let val;
        if (a[i - 1] === b[j - 1]) {
          val = row[j - 1];
        } else {
          val = Math.min(row[j - 1] + 1, Math.min(prev + 1, row[j] + 1));
        }
        row[j - 1] = prev;
        prev = val;
      }
      row[b.length] = prev;
    }
    return row[b.length];
  }

  /**
   * Calcula a similaridade entre duas palavras normalizadas (0.0 a 1.0)
   * Leva em consideração erros fonéticos leves de transcrição em pt-BR
   * @param {string} wordA 
   * @param {string} wordB 
   * @returns {number}
   */
  static similarity(wordA, wordB) {
    if (!wordA || !wordB) return 0;
    const a = this.normalizeToken(wordA);
    const b = this.normalizeToken(wordB);

    if (a === b) return 1.0;

    // Se uma palavra é muito curta (1 ou 2 letras), exige correspondência exata
    const maxLen = Math.max(a.length, b.length);
    if (maxLen <= 2) return 0.0;

    const dist = this.levenshtein(a, b);
    // Para palavras de tamanho 3-4, tolera no máximo 1 troca
    if (maxLen <= 4 && dist <= 1) return 0.75;
    // Para palavras longas, tolera pequenas variações de conjugação/plural
    if (maxLen > 4 && dist <= 1) return 0.85;
    if (maxLen > 6 && dist <= 2) return 0.70;

    return Math.max(0, 1 - dist / maxLen);
  }
}

  if (typeof module !== "undefined" && module.exports) {
    module.exports = TextNormalizer;
  }
  if (typeof window !== "undefined") {
    window.TextNormalizer = TextNormalizer;
  }
})();
