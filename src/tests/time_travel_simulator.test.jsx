import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import useStore from '../store/useStore';
import { evaluateDocumentReviewStatus, getReviewStatus } from '../utils/documentUtils';

describe('System Date Time Travel Simulator', () => {
  beforeEach(() => {
    useStore.getState().resetStore?.();
    useStore.setState({
      simulatedSystemDate: null,
      documents: [],
      externalDocuments: [],
      periodicReviewSchedules: []
    });
  });

  afterEach(() => {
    useStore.getState().resetSimulatedDate();
  });

  it('Criteria 1: manages simulatedSystemDate state correctly', () => {
    const store = useStore.getState();
    expect(store.simulatedSystemDate).toBeNull();
    
    // Default effective today is current date
    const realToday = store.getEffectiveToday();
    expect(realToday).toBeInstanceOf(Date);

    // Set simulated date
    store.setSimulatedDate('2027-06-15');
    expect(useStore.getState().simulatedSystemDate).toBe('2027-06-15');
    const effective = useStore.getState().getEffectiveToday();
    expect(effective.toISOString().split('T')[0]).toBe('2027-06-15');

    // Fast-forward 6 months -> 2027-12-15
    useStore.getState().fastForwardSystemDate(6);
    expect(useStore.getState().simulatedSystemDate).toBe('2027-12-15');

    // Fast-forward 12 months -> 2028-12-15
    useStore.getState().fastForwardSystemDate(12);
    expect(useStore.getState().simulatedSystemDate).toBe('2028-12-15');

    // Reset back to real time
    useStore.getState().resetSimulatedDate();
    expect(useStore.getState().simulatedSystemDate).toBeNull();
  });

  it('Criteria 2: evaluateDocumentReviewStatus evaluates against effective simulated date', () => {
    const nextReviewDate = '2027-01-01';

    // Before time travel: reference date 2026-06-01 (> 30 days) -> UP_TO_DATE
    const statusBefore = evaluateDocumentReviewStatus(nextReviewDate, new Date('2026-06-01'));
    expect(statusBefore).toBe('UP_TO_DATE');

    // Close to review date: reference date 2026-12-15 (17 days away) -> DUE_SOON
    const statusDueSoon = evaluateDocumentReviewStatus(nextReviewDate, new Date('2026-12-15'));
    expect(statusDueSoon).toBe('DUE_SOON');

    // After time travel +1 year: reference date 2027-02-01 (past due) -> OVERDUE
    const statusOverdue = evaluateDocumentReviewStatus(nextReviewDate, new Date('2027-02-01'));
    expect(statusOverdue).toBe('OVERDUE');
  });

  it('Criteria 3: advancing simulated date flips real document review status to OVERDUE and resets cleanly', () => {
    // Simulate an actual active document with next review in 6 months from 2026-01-01
    const testDoc = {
      id: 'DOC-REAL-001',
      title: 'SOP-QA-001',
      effectiveDate: '2026-01-01',
      nextReviewDate: '2026-07-01',
      status: 'EFFECTIVE'
    };

    useStore.setState({
      documents: [testDoc],
      simulatedSystemDate: '2026-01-01'
    });

    // 1. Initial state at 2026-01-01 -> UP_TO_DATE
    let effective = useStore.getState().getEffectiveToday();
    let status = evaluateDocumentReviewStatus(testDoc.nextReviewDate, effective);
    expect(status).toBe('UP_TO_DATE');

    // 2. Advance simulated date +12 months -> flips to OVERDUE
    useStore.getState().fastForwardSystemDate(12);
    effective = useStore.getState().getEffectiveToday();
    expect(useStore.getState().simulatedSystemDate).toBe('2027-01-01');
    status = evaluateDocumentReviewStatus(testDoc.nextReviewDate, effective);
    expect(status).toBe('OVERDUE');

    // 3. Reset simulated date -> returns to null
    useStore.getState().resetSimulatedDate();
    expect(useStore.getState().simulatedSystemDate).toBeNull();
  });
});
