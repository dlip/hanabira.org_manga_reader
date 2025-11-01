// Thin client SRS types relying on backend authority
export interface SRSReviewRecord {
  card_id: string;
  interval_days: number;
  ease_factor: number;
  repetition: number;
  next_review: number;
  last_review: number;
  difficulty: number;
  streak: number;
}

export interface ClientSRSStats {
  totalReviews: number;
  correctAnswers: number;
  accuracy: number;
  cardsLearned: number;
  cardsMature: number;
  averageEase: number;
  streak: number;
}

interface PendingReviewAction {
  card_id: string;
  difficulty: number; // UI difficulty 1-4
  timestamp: number;
}

export class SRSManager {
  private static readonly PENDING_ACTIONS_KEY = 'mokuro_srs_pending_actions_v1';
  private static listenersBound = false;
  private static reviewCache: Record<string, SRSReviewRecord> = {};

  // ---- Pending Sync Queue Helpers ----
  private static loadPendingActions(): PendingReviewAction[] {
    try {
      const raw = localStorage.getItem(this.PENDING_ACTIONS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as PendingReviewAction[];
    } catch (e) { console.warn('[SRSManager] Failed to load pending actions', e); }
    return [];
  }

  private static savePendingActions(actions: PendingReviewAction[]): void {
    try { localStorage.setItem(this.PENDING_ACTIONS_KEY, JSON.stringify(actions)); } catch {}
  }

  private static enqueueAction(action: PendingReviewAction): void {
    const list = this.loadPendingActions();
    list.push(action);
    this.savePendingActions(list);
    if (typeof window !== 'undefined') console.debug('[SRSManager] Queued offline review action', action);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('srs-offline-queued', { detail: { card_id: action.card_id, difficulty: action.difficulty } }));
    }
  }

  static async flushPendingActions(): Promise<void> {
    if (typeof window === 'undefined') return;
    const list = this.loadPendingActions();
    if (list.length === 0) return;
    const { apiClient } = await import('./api-client');
    const remaining: PendingReviewAction[] = [];
    for (const act of list.sort((a,b)=>a.timestamp-b.timestamp)) {
      try {
        await apiClient.srs.reviewAction(act.card_id, act.difficulty);
      } catch (e) {
        console.warn('[SRSManager] Failed to flush action (keeping)', act, e);
        remaining.push(act);
      }
    }
    this.savePendingActions(remaining);
    if (typeof window !== 'undefined') {
      const flushed = list.length - remaining.length;
      if (flushed > 0) {
        window.dispatchEvent(new CustomEvent('srs-offline-flushed', { detail: { flushed, remaining: remaining.length } }));
      }
    }
  }

  private static bindWindowListeners(): void {
    if (this.listenersBound || typeof window === 'undefined') return;
    window.addEventListener('focus', () => {
      this.flushPendingActions().catch(err => console.warn('[SRSManager] Flush actions on focus failed', err));
    });
    window.addEventListener('online', () => {
      this.flushPendingActions().catch(err => console.warn('[SRSManager] Flush actions on online failed', err));
    });
    this.listenersBound = true;
  }

  // Thin client review – no local algorithm
  static async reviewCard(cardId: string, difficulty: number): Promise<{ offlineQueued: boolean; review?: SRSReviewRecord }>{
    this.bindWindowListeners();
    try {
      const { apiClient } = await import('./api-client');
      const serverReview = await apiClient.srs.reviewAction(cardId, difficulty);
      this.reviewCache[cardId] = serverReview;
      this.invalidateReviewCountCache();
      return { offlineQueued: false, review: serverReview };
    } catch (e) {
      console.warn('[SRSManager] Failed to send review – queued', { cardId, e });
      this.enqueueAction({ card_id: cardId, difficulty, timestamp: Date.now() });
      this.invalidateReviewCountCache();
      return { offlineQueued: true };
    }
  }

  // Removed previous local algorithm implementation.

  static async getCardsForReview(limit: number = 20): Promise<string[]> {
    try {
      const { apiClient } = await import('./api-client');
      return (await apiClient.srs.getCardsDue(limit)).map(c => c.id);
    } catch (e) {
      console.warn('[SRSManager] Failed to fetch due cards – offline returning empty list', e);
      return [];
    }
  }

  static invalidateReviewCountCache(): void {
    // This method can be called to indicate that review counts should be refreshed
    // For now, we'll dispatch a custom event that the MainLayout can listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('srs-review-updated'));
    }
  }

  // Removed local due card calculation

  static getCardsByInterval(): { new: string[]; learning: string[]; mature: string[] } {
    const reviews = Object.values(this.reviewCache);
    const buckets = { new: [] as string[], learning: [] as string[], mature: [] as string[] };
    reviews.forEach(r => {
      if (r.repetition === 0) buckets.new.push(r.card_id);
      else if (r.interval_days < 21) buckets.learning.push(r.card_id);
      else buckets.mature.push(r.card_id);
    });
    return buckets;
  }

  static async getStats(): Promise<ClientSRSStats> {
    try {
      const { apiClient } = await import('./api-client');
  interface BackendStatsShape { total_reviews?: number; correct_answers?: number; cards_learned?: number; cards_mature?: number; average_ease?: number; totalReviews?: number; correctAnswers?: number; cardsLearned?: number; cardsMature?: number; averageEase?: number; }
  const backendStats: BackendStatsShape = await apiClient.srs.getStats() as unknown as BackendStatsShape;
  // Expect backend to return aggregated metrics already; provide defensive defaults
  const totalReviews = backendStats.total_reviews ?? backendStats.totalReviews ?? 0;
  const correctAnswers = backendStats.correct_answers ?? backendStats.correctAnswers ?? 0;
  const cardsLearned = backendStats.cards_learned ?? backendStats.cardsLearned ?? 0;
  const cardsMature = backendStats.cards_mature ?? backendStats.cardsMature ?? 0;
  const averageEase = backendStats.average_ease ?? backendStats.averageEase ?? 2.5;
      const accuracy = totalReviews > 0 ? (correctAnswers / totalReviews) * 100 : 0;
        const streakResp = await apiClient.srs.getStreak();
        const streak = streakResp.streak || 0;
        return { totalReviews, correctAnswers, accuracy, cardsLearned, cardsMature, averageEase, streak };
    } catch (e) {
      console.warn('[SRSManager] Failed to load stats', e);
        return { totalReviews: 0, correctAnswers: 0, accuracy: 0, cardsLearned: 0, cardsMature: 0, averageEase: 2.5, streak: 0 };
    }
  }


  // Preview helper
  static async preview(cardId: string, difficulty: number): Promise<{ predicted_interval_days: number; predicted_next_review: number } | null> {
    try {
      const { apiClient } = await import('./api-client');
      const p = await apiClient.srs.preview(cardId, difficulty);
      return { predicted_interval_days: p.predicted_interval_days, predicted_next_review: p.predicted_next_review };
    } catch (e) {
      console.warn('[SRSManager] Preview failed', e);
      return null;
    }
  }

}
