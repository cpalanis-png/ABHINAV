import { AIChatMode, AIMemoryCategory, LocationData, PendingSensitiveMemoryPrompt, SharedWellnessAIContext } from '../types';
import { StorageService } from './storage';
import { AuthService } from './authService';
import { MemoryService } from './memoryService';

export type AIErrorCode =
  | 'OFFLINE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'AUTH_FAILED'
  | 'API_KEY_MISSING'
  | 'RATE_LIMIT'
  | 'MODEL_UNAVAILABLE'
  | 'MALFORMED_RESPONSE'
  | 'EMPTY_RESPONSE'
  | 'BAD_REQUEST'
  | 'GENERATION_FAILED'
  | 'SERVER_ERROR';

export interface AIDiagnosticRecord {
  id: string;
  timestamp: string;
  status: 'success' | 'error' | 'cancelled';
  errorCode?: AIErrorCode;
  httpStatus?: number;
  latencyMs: number;
  retryCount: number;
  model?: string;
}

export interface AISendMessageOptions {
  contextMode?: AIChatMode;
  locationContext?: LocationData | null;
  selectedModel?: 'gemini-3.1-flash-lite' | 'gemini-3.8-flash' | 'gemini-4-argon';
  enableSearchGrounding?: boolean;
  enableMapsGrounding?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  testFaultHeader?: string;
  wellnessContext?: SharedWellnessAIContext | null;
}

export interface AISendMessageResult {
  text: string;
  status: 'success' | 'error' | 'cancelled';
  model?: string;
  grounded?: boolean;
  groundingSources?: Array<{ title: string; url: string; snippet?: string }>;
  searchQueries?: string[];
  memoriesUsed?: Array<{ id: string; category: AIMemoryCategory; key: string; value: string }>;
  memoriesLearned?: Array<{ id: string; category: AIMemoryCategory; key: string; value: string }>;
  pendingConsentPrompts?: PendingSensitiveMemoryPrompt[];
  errorCode?: AIErrorCode;
  errorMessage?: string;
  canRetry?: boolean;
  diagnostics: AIDiagnosticRecord;
}

export class AIService {
  private static activeController: AbortController | null = null;
  private static activeRequestId = 0;
  private static diagnosticsLog: AIDiagnosticRecord[] = [];

  /**
   * Cancels any currently running AI request to prevent duplicate overlapping calls.
   */
  public static cancelActiveRequest(): void {
    if (this.activeController) {
      try {
        this.activeController.abort('DUPLICATE_OR_USER_CANCELLED');
      } catch {
        // Ignore abort errors
      }
      this.activeController = null;
    }
  }

  /**
   * Records privacy-safe diagnostic telemetry (never logs API keys, message content, or health data).
   */
  private static recordDiagnostic(record: AIDiagnosticRecord): void {
    this.diagnosticsLog = [record, ...this.diagnosticsLog].slice(0, 25);
  }

  public static getDiagnostics(): AIDiagnosticRecord[] {
    return [...this.diagnosticsLog];
  }

  /**
   * Determines whether an error code or HTTP status represents a transient failure safe to retry.
   */
  private static isTransientFailure(code?: AIErrorCode, httpStatus?: number): boolean {
    if (!code) return false;
    if (
      code === 'AUTH_FAILED' ||
      code === 'API_KEY_MISSING' ||
      code === 'BAD_REQUEST' ||
      code === 'CANCELLED' ||
      code === 'OFFLINE' ||
      code === 'MALFORMED_RESPONSE' ||
      code === 'EMPTY_RESPONSE'
    ) {
      return false;
    }
    if (httpStatus && (httpStatus === 400 || httpStatus === 401 || httpStatus === 403)) {
      return false;
    }
    return (
      code === 'TIMEOUT' ||
      code === 'NETWORK_ERROR' ||
      code === 'RATE_LIMIT' ||
      code === 'GENERATION_FAILED' ||
      code === 'SERVER_ERROR' ||
      code === 'MODEL_UNAVAILABLE'
    );
  }

  /**
   * Maps error codes to clear, user-friendly messages without fabricating answers.
   */
  public static getFriendlyErrorMessage(code: AIErrorCode, serverMsg?: string): string {
    switch (code) {
      case 'OFFLINE':
        return 'No internet connection detected. Please check your Wi-Fi or mobile data connection and tap Retry. Emergency SOS remains fully operational.';
      case 'NETWORK_ERROR':
        return 'Unable to reach the Smart Shield AI server due to a network disconnection. Please verify your connection and tap Retry.';
      case 'TIMEOUT':
        return 'The AI assistant took too long to respond and the request timed out. Please tap Retry.';
      case 'AUTH_FAILED':
      case 'API_KEY_MISSING':
        return 'AI service authentication failed (invalid or missing API key configuration). Please contact support or verify server credentials.';
      case 'RATE_LIMIT':
        return 'The AI assistant has reached its temporary rate limit or quota. Please wait a few seconds and tap Retry.';
      case 'MODEL_UNAVAILABLE':
        return 'The requested AI model is currently unavailable. Please tap Retry or switch models.';
      case 'MALFORMED_RESPONSE':
        return 'Received a malformed or unreadable response from the AI service. Please tap Retry.';
      case 'EMPTY_RESPONSE':
        return 'The AI assistant returned an empty response. Please rephrase your question or tap Retry.';
      case 'BAD_REQUEST':
        return serverMsg || 'Your question could not be processed. Please enter a clear message and try again.';
      case 'CANCELLED':
        return 'The previous request was cancelled.';
      default:
        return serverMsg || 'The AI assistant encountered a temporary service issue. Please tap Retry.';
    }
  }

  /**
   * Unified, reliable AI message pipeline used by both Text Chat and Voice Assistant.
   */
  public static async sendMessage(
    messages: { role: 'user' | 'assistant'; content: string }[],
    contextModeOrOptions: AIChatMode | AISendMessageOptions = 'universal',
    locationContextArg?: LocationData | null
  ): Promise<AISendMessageResult> {
    const options: AISendMessageOptions =
      typeof contextModeOrOptions === 'string'
        ? { contextMode: contextModeOrOptions, locationContext: locationContextArg }
        : contextModeOrOptions;

    const contextMode = options.contextMode || 'universal';
    const locationContext = options.locationContext ?? locationContextArg ?? null;
    const selectedModel = options.selectedModel || 'gemini-3.1-flash-lite';
    const timeoutMs = options.timeoutMs || 35000;
    const maxRetries = typeof options.maxRetries === 'number' ? options.maxRetries : 1;

    // Collect shared nutrition, meal completion, and water intake context if enabled
    let wellnessContext: SharedWellnessAIContext | null = options.wellnessContext ?? null;
    if (!wellnessContext) {
      try {
        const profile = StorageService.getUserNutritionProfile();
        if (profile.shareProgressWithMainAI !== false) {
          wellnessContext = StorageService.getSharedWellnessAIContext();
        }
      } catch {
        wellnessContext = null;
      }
    }

    // Cancel any existing in-flight request to prevent duplicate overlapping calls
    this.cancelActiveRequest();

    const requestId = ++this.activeRequestId;
    const startTime = Date.now();

    // Check browser offline status immediately
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const diag: AIDiagnosticRecord = {
        id: `diag-${requestId}`,
        timestamp: new Date().toLocaleTimeString(),
        status: 'error',
        errorCode: 'OFFLINE',
        latencyMs: Date.now() - startTime,
        retryCount: 0
      };
      this.recordDiagnostic(diag);
      return {
        text: '',
        status: 'error',
        errorCode: 'OFFLINE',
        errorMessage: this.getFriendlyErrorMessage('OFFLINE'),
        canRetry: true,
        diagnostics: diag
      };
    }

    // Sanitize messages before sending: strip local welcome message and empty strings
    const sanitizedMessages = (messages || [])
      .filter((m) => m && typeof m.content === 'string' && m.content.trim().length > 0)
      .filter((m, idx) => {
        if (
          idx === 0 &&
          m.role === 'assistant' &&
          (m.content.includes('Hello! I am **Shield AI**') || m.content.includes('Smart Shield AI Assistant'))
        ) {
          return false;
        }
        return true;
      })
      .slice(-16);

    if (sanitizedMessages.length === 0) {
      const diag: AIDiagnosticRecord = {
        id: `diag-${requestId}`,
        timestamp: new Date().toLocaleTimeString(),
        status: 'error',
        errorCode: 'BAD_REQUEST',
        latencyMs: 0,
        retryCount: 0
      };
      this.recordDiagnostic(diag);
      return {
        text: '',
        status: 'error',
        errorCode: 'BAD_REQUEST',
        errorMessage: 'Please enter or speak a question before sending.',
        canRetry: false,
        diagnostics: diag
      };
    }

    let attempt = 0;
    let lastErrorCode: AIErrorCode = 'SERVER_ERROR';
    let lastHttpStatus: number | undefined;
    let lastServerErrorMsg: string | undefined;

    while (attempt <= maxRetries) {
      // Backoff delay on retry attempts (800ms, 1600ms)
      if (attempt > 0) {
        const backoffMs = 800 * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, backoffMs));
      }

      // Verify this request was not superseded during backoff
      if (requestId !== this.activeRequestId) {
        const diag: AIDiagnosticRecord = {
          id: `diag-${requestId}`,
          timestamp: new Date().toLocaleTimeString(),
          status: 'cancelled',
          errorCode: 'CANCELLED',
          latencyMs: Date.now() - startTime,
          retryCount: attempt
        };
        return {
          text: '',
          status: 'cancelled',
          errorCode: 'CANCELLED',
          errorMessage: this.getFriendlyErrorMessage('CANCELLED'),
          canRetry: true,
          diagnostics: diag
        };
      }

      const controller = new AbortController();
      this.activeController = controller;

      let didTimeout = false;
      const timer = setTimeout(() => {
        didTimeout = true;
        controller.abort('REQUEST_TIMEOUT');
      }, timeoutMs);

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeader()
        };
        if (options.testFaultHeader) {
          headers['x-shield-test-fault'] = options.testFaultHeader;
        }

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers,
          credentials: 'same-origin',
          signal: controller.signal,
          body: JSON.stringify({
            messages: sanitizedMessages,
            contextMode,
            locationContext:
              locationContext &&
              locationContext.latitude !== 0 &&
              locationContext.longitude !== 0 &&
              locationContext.status !== 'unavailable'
                ? {
                    latitude: locationContext.latitude,
                    longitude: locationContext.longitude,
                    address: locationContext.address
                  }
                : null,
            wellnessContext,
            selectedModel,
            enableSearchGrounding: Boolean(options.enableSearchGrounding),
            enableMapsGrounding: Boolean(options.enableMapsGrounding),
            userTimestamp: new Date().toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
          })
        });

        clearTimeout(timer);
        lastHttpStatus = response.status;

        // Parse response body safely to catch malformed JSON
        let rawText = '';
        try {
          rawText = await response.text();
        } catch {
          lastErrorCode = 'MALFORMED_RESPONSE';
          break;
        }

        let data: any = null;
        try {
          data = rawText ? JSON.parse(rawText) : null;
        } catch {
          lastErrorCode = 'MALFORMED_RESPONSE';
          lastServerErrorMsg = 'Received malformed JSON payload from server.';
          break;
        }

        if (!response.ok) {
          const codeFromServer = data?.code as AIErrorCode | undefined;
          lastServerErrorMsg = data?.error;

          if (response.status === 401 || response.status === 403 || codeFromServer === 'AUTH_FAILED') {
            lastErrorCode = 'AUTH_FAILED';
          } else if (codeFromServer === 'API_KEY_MISSING') {
            lastErrorCode = 'API_KEY_MISSING';
          } else if (response.status === 429 || codeFromServer === 'RATE_LIMIT') {
            lastErrorCode = 'RATE_LIMIT';
          } else if (codeFromServer === 'MODEL_UNAVAILABLE') {
            lastErrorCode = 'MODEL_UNAVAILABLE';
          } else if (response.status === 400 || codeFromServer === 'BAD_REQUEST') {
            lastErrorCode = 'BAD_REQUEST';
          } else {
            lastErrorCode = codeFromServer || 'GENERATION_FAILED';
          }

          if (this.isTransientFailure(lastErrorCode, response.status) && attempt < maxRetries) {
            attempt++;
            continue;
          }
          break;
        }

        // Validate non-empty text in 200 OK response
        if (!data || typeof data.text !== 'string') {
          lastErrorCode = 'MALFORMED_RESPONSE';
          break;
        }

        const cleanAnswer = data.text.trim();
        if (cleanAnswer.length === 0) {
          lastErrorCode = 'EMPTY_RESPONSE';
          break;
        }

        // Success!
        if (this.activeController === controller) {
          this.activeController = null;
        }

        const diag: AIDiagnosticRecord = {
          id: `diag-${requestId}`,
          timestamp: new Date().toLocaleTimeString(),
          status: 'success',
          httpStatus: response.status,
          latencyMs: Date.now() - startTime,
          retryCount: attempt,
          model: data.model || selectedModel
        };
        this.recordDiagnostic(diag);

        if (
          (Array.isArray(data.memoriesLearned) && data.memoriesLearned.length > 0) ||
          (Array.isArray(data.pendingConsentPrompts) && data.pendingConsentPrompts.length > 0)
        ) {
          MemoryService.fetchMemoryStore().catch(() => {});
        }

        return {
          text: cleanAnswer,
          status: 'success',
          model: data.model || selectedModel,
          grounded: Boolean(data.grounded),
          groundingSources: Array.isArray(data.groundingSources) ? data.groundingSources : [],
          searchQueries: Array.isArray(data.searchQueries) ? data.searchQueries : [],
          memoriesUsed: Array.isArray(data.memoriesUsed) ? data.memoriesUsed : [],
          memoriesLearned: Array.isArray(data.memoriesLearned) ? data.memoriesLearned : [],
          pendingConsentPrompts: Array.isArray(data.pendingConsentPrompts) ? data.pendingConsentPrompts : [],
          diagnostics: diag
        };
      } catch (err: any) {
        clearTimeout(timer);

        if (didTimeout) {
          lastErrorCode = 'TIMEOUT';
        } else if (controller.signal.aborted || err?.name === 'AbortError') {
          const diag: AIDiagnosticRecord = {
            id: `diag-${requestId}`,
            timestamp: new Date().toLocaleTimeString(),
            status: 'cancelled',
            errorCode: 'CANCELLED',
            latencyMs: Date.now() - startTime,
            retryCount: attempt
          };
          this.recordDiagnostic(diag);
          return {
            text: '',
            status: 'cancelled',
            errorCode: 'CANCELLED',
            errorMessage: this.getFriendlyErrorMessage('CANCELLED'),
            canRetry: true,
            diagnostics: diag
          };
        } else if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          lastErrorCode = 'OFFLINE';
        } else {
          lastErrorCode = 'NETWORK_ERROR';
        }

        if (this.isTransientFailure(lastErrorCode, lastHttpStatus) && attempt < maxRetries) {
          attempt++;
          continue;
        }
        break;
      }
    }

    if (this.activeRequestId === requestId) {
      this.activeController = null;
    }

    const canRetry =
      lastErrorCode !== 'AUTH_FAILED' &&
      lastErrorCode !== 'API_KEY_MISSING' &&
      lastErrorCode !== 'BAD_REQUEST';

    const diag: AIDiagnosticRecord = {
      id: `diag-${requestId}`,
      timestamp: new Date().toLocaleTimeString(),
      status: 'error',
      errorCode: lastErrorCode,
      httpStatus: lastHttpStatus,
      latencyMs: Date.now() - startTime,
      retryCount: attempt
    };
    this.recordDiagnostic(diag);

    return {
      text: '',
      status: 'error',
      errorCode: lastErrorCode,
      errorMessage: this.getFriendlyErrorMessage(lastErrorCode, lastServerErrorMsg),
      canRetry,
      diagnostics: diag
    };
  }

  public static async fetchDailyUpdates(timeZone?: string): Promise<any> {
    try {
      const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      let wellnessContext: SharedWellnessAIContext | null = null;
      try {
        wellnessContext = StorageService.getSharedWellnessAIContext();
      } catch {
        wellnessContext = null;
      }

      const res = await fetch('/api/daily-updates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeZone: tz, wellnessContext })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          status: 'error',
          errorMessage: errorData.error || `HTTP ${res.status} error fetching live updates`
        };
      }
      return await res.json();
    } catch (err: any) {
      return {
        status: 'error',
        errorMessage: err?.message || 'Network error fetching daily updates.'
      };
    }
  }

  public static async runEvaluationSuite(): Promise<any> {
    try {
      const res = await fetch('/api/eval/run');
      return await res.json();
    } catch (e: any) {
      return { status: 'error', message: e.message };
    }
  }
}
