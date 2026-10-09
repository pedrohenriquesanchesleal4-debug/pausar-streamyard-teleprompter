/**
 * sync-state-machine.js
 * Máquina de estados finita para o acompanhamento inteligente do teleprompter.
 * Gerencia transições entre: IDLE, LISTENING, TRACKING, PAUSED, UNCERTAIN, RECOVERING, ERROR.
 */

(function () {
  class SyncStateMachine {
    static STATES = {
      IDLE: "IDLE",             // Aguardando início do usuário
      LISTENING: "LISTENING",   // Microfone ativo, ouvindo som/voz
      TRACKING: "TRACKING",     // Alinhamento ativo e correspondência confirmada
      PAUSED: "PAUSED",         // Pausado manualmente ou por silêncio prolongado
      UNCERTAIN: "UNCERTAIN",   // Transcrição ambígua ou possível improviso
      RECOVERING: "RECOVERING", // Tentando restabelecer alinhamento após desvio
      ERROR: "ERROR"            // Falha de hardware, permissão ou rede
    };

  /**
   * @param {Object} options
   * @param {number} [options.silenceTimeoutMs=2800] - Tempo de silêncio para congelar rolagem
   * @param {number} [options.recoveryTimeoutMs=4500] - Tempo em incerteza antes de passar para recovery
   * @param {Function} [options.onStateChange] - Callback executado a cada mudança de estado
   */
  constructor(options = {}) {
    this.state = SyncStateMachine.STATES.IDLE;
    this.silenceTimeoutMs = options.silenceTimeoutMs || 2800;
    this.recoveryTimeoutMs = options.recoveryTimeoutMs || 4500;
    this.onStateChange = options.onStateChange || null;

    this.silenceTimer = null;
    this.uncertainTimer = null;
    this.lastMatchTime = 0;
    this.isManualPaused = false;
    this.lastErrorMessage = "";
  }

  /**
   * Retorna o estado atual
   */
  getState() {
    return this.state;
  }

  /**
   * Transiciona para um novo estado notificando listeners
   * @param {string} newState 
   * @param {Object} [meta={}] 
   */
  transition(newState, meta = {}) {
    if (!SyncStateMachine.STATES[newState]) {
      console.warn(`[SyncStateMachine] Estado inválido: ${newState}`);
      return;
    }

    // Se estiver em pausa manual, impede transição para estados de rolagem ativa
    if (this.isManualPaused && (newState === SyncStateMachine.STATES.TRACKING || newState === SyncStateMachine.STATES.RECOVERING)) {
      return;
    }

    if (this.state === newState && !meta.forceNotify) {
      return;
    }

    const previousState = this.state;
    this.state = newState;

    if (typeof this.onStateChange === "function") {
      this.onStateChange({
        previousState,
        currentState: this.state,
        meta
      });
    }
  }

  /**
   * O usuário iniciou o modo inteligente
   */
  startListening() {
    this.isManualPaused = false;
    this.transition(SyncStateMachine.STATES.LISTENING, { reason: "USER_START" });
  }

  /**
   * O usuário pausou manualmente
   */
  manualPause() {
    this.isManualPaused = true;
    this._clearTimers();
    this.transition(SyncStateMachine.STATES.PAUSED, { reason: "MANUAL_PAUSE" });
  }

  /**
   * O usuário retomou manualmente
   */
  manualResume() {
    this.isManualPaused = false;
    this.transition(SyncStateMachine.STATES.LISTENING, { reason: "MANUAL_RESUME" });
    this._resetSilenceTimer();
  }

  /**
   * Alterna pausa/retomada manual
   */
  toggleManualPause() {
    if (this.isManualPaused || this.state === SyncStateMachine.STATES.PAUSED) {
      this.manualResume();
    } else {
      this.manualPause();
    }
  }

  /**
   * O usuário interrompeu totalmente o acompanhamento
   */
  stop() {
    this.isManualPaused = false;
    this._clearTimers();
    this.transition(SyncStateMachine.STATES.IDLE, { reason: "USER_STOP" });
  }

  /**
   * Notifica que uma fala com correspondência confirmada ocorreu
   */
  onConfidentMatch(details = {}) {
    if (this.isManualPaused) return;

    this.lastMatchTime = Date.now();
    this._clearUncertainTimer();
    this.transition(SyncStateMachine.STATES.TRACKING, details);
    this._resetSilenceTimer();
  }

  /**
   * Notifica que uma fala foi detectada, mas a correspondência foi incerta ou ausente (improviso)
   */
  onUncertainMatch(details = {}) {
    if (this.isManualPaused) return;

    // Se já estiver em TRACKING, passa para UNCERTAIN e inicia timer para RECOVERING
    if (this.state === SyncStateMachine.STATES.TRACKING || this.state === SyncStateMachine.STATES.LISTENING) {
      this.transition(SyncStateMachine.STATES.UNCERTAIN, details);

      if (!this.uncertainTimer) {
        this.uncertainTimer = setTimeout(() => {
          if (this.state === SyncStateMachine.STATES.UNCERTAIN && !this.isManualPaused) {
            this.transition(SyncStateMachine.STATES.RECOVERING, { reason: "PROLONGED_MISMATCH" });
          }
        }, this.recoveryTimeoutMs);
      }
    }
    this._resetSilenceTimer();
  }

  /**
   * Notifica que um período de silêncio foi detectado
   */
  onSilence(details = {}) {
    if (this.isManualPaused) return;
    this._clearUncertainTimer();
    if (
      this.state === SyncStateMachine.STATES.TRACKING ||
      this.state === SyncStateMachine.STATES.UNCERTAIN ||
      this.state === SyncStateMachine.STATES.LISTENING
    ) {
      this.transition(SyncStateMachine.STATES.PAUSED, { reason: "SILENCE_DETECTED", ...details });
    }
  }

  /**
   * Notifica ocorrência de erro no reconhecimento ou áudio
   */
  onError(errorMessage) {
    this.lastErrorMessage = String(errorMessage || "Erro no reconhecimento de voz");
    this._clearTimers();
    this.transition(SyncStateMachine.STATES.ERROR, { error: this.lastErrorMessage });
  }

  /**
   * Reseta o timer de silêncio
   * @private
   */
  _resetSilenceTimer() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      // Se estava ouvindo ou acompanhando e não houve mais falas, pausa suavemente
      if (!this.isManualPaused && (this.state === SyncStateMachine.STATES.TRACKING || this.state === SyncStateMachine.STATES.UNCERTAIN)) {
        this.transition(SyncStateMachine.STATES.PAUSED, { reason: "SILENCE_DETECTED" });
      }
    }, this.silenceTimeoutMs);
  }

  /**
   * Limpa timer de incerteza
   * @private
   */
  _clearUncertainTimer() {
    if (this.uncertainTimer) {
      clearTimeout(this.uncertainTimer);
      this.uncertainTimer = null;
    }
  }

  /**
   * Limpa todos os timers ativos
   * @private
   */
  _clearTimers() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this._clearUncertainTimer();
  }

  /**
   * Retorna metadados visuais para cada estado (rótulo, cor, ícone)
   */
  static getBadgeInfo(state) {
    switch (state) {
      case SyncStateMachine.STATES.IDLE:
        return { label: "Inativo", color: "#64748b", icon: "⏹", desc: "Aguardando início" };
      case SyncStateMachine.STATES.LISTENING:
        return { label: "Ouvindo", color: "#38bdf8", icon: "🎙", desc: "Capturando áudio" };
      case SyncStateMachine.STATES.TRACKING:
        return { label: "Sincronizado", color: "#22c55e", icon: "✓", desc: "Acompanhando leitura" };
      case SyncStateMachine.STATES.PAUSED:
        return { label: "Pausado", color: "#eab308", icon: "⏸", desc: "Texto congelado" };
      case SyncStateMachine.STATES.UNCERTAIN:
        return { label: "Incerto / Improviso", color: "#f97316", icon: "〰", desc: "Fala fora do roteiro" };
      case SyncStateMachine.STATES.RECOVERING:
        return { label: "Buscando trecho", color: "#a855f7", icon: "🔍", desc: "Reencontrando posição" };
      case SyncStateMachine.STATES.ERROR:
        return { label: "Atenção", color: "#ef4444", icon: "⚠", desc: "Verifique o microfone" };
      default:
        return { label: state, color: "#64748b", icon: "•", desc: "" };
    }
  }
}

  if (typeof module !== "undefined" && module.exports) {
    module.exports = SyncStateMachine;
  }
  if (typeof window !== "undefined") {
    window.SyncStateMachine = SyncStateMachine;
  }
})();

