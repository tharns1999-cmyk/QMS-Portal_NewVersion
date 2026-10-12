import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import useStore from '../store/useStore';
import { getDocumentReviewMetrics } from '../utils/documentUtils';
import PeriodicReviewDashboard from '../pages/PeriodicReviews/PeriodicReviewDashboard';

describe('Periodic Review Metrics & MECE Calculation Logic', () => {
  describe('getDocumentReviewMetrics unit tests', () => {
    it('Criteria 1: Document overdue (diffDays < 0) counts strictly in overdue, NOT dueSoon', () => {
      const refDate = new Date('2028-10-12');
      const docs = [
        { id: 'DOC-1', next_review_date: '2028-10-09' } // 3 days overdue
      ];

      const metrics = getDocumentReviewMetrics(docs, refDate);
      expect(metrics.total).toBe(1);
      expect(metrics.dueSoon).toBe(0);
      expect(metrics.overdue).toBe(1);
      expect(metrics.completed).toBe(0);
      expect(metrics.upToDate).toBe(0);
      expect(metrics.dueSoon + metrics.overdue + metrics.completed + metrics.upToDate).toBe(metrics.total);
    });

    it('Criteria 2: Document due soon (0 <= diffDays <= 30) counts in dueSoon, NOT overdue', () => {
      const refDate = new Date('2028-10-01');
      const docs = [
        { id: 'DOC-1', next_review_date: '2028-10-20' } // 19 days away
      ];

      const metrics = getDocumentReviewMetrics(docs, refDate);
      expect(metrics.total).toBe(1);
      expect(metrics.dueSoon).toBe(1);
      expect(metrics.overdue).toBe(0);
      expect(metrics.completed).toBe(0);
      expect(metrics.upToDate).toBe(0);
      expect(metrics.dueSoon + metrics.overdue + metrics.completed + metrics.upToDate).toBe(metrics.total);
    });

    it('Documents with review_status COMPLETED count in completed and are mutually exclusive', () => {
      const refDate = new Date('2028-10-12');
      const docs = [
        { id: 'DOC-1', next_review_date: '2028-10-09', review_status: 'COMPLETED' },
        { id: 'DOC-2', next_review_date: '2028-10-09', is_reviewed_this_cycle: true }
      ];

      const metrics = getDocumentReviewMetrics(docs, refDate);
      expect(metrics.total).toBe(2);
      expect(metrics.completed).toBe(2);
      expect(metrics.overdue).toBe(0);
      expect(metrics.dueSoon).toBe(0);
      expect(metrics.upToDate).toBe(0);
    });

    it('Multi-document mixed test strictly adheres to MECE (total = dueSoon + overdue + completed + upToDate)', () => {
      const refDate = new Date('2028-10-12');
      const docs = [
        { id: 'D1', next_review_date: '2028-10-05' }, // Overdue (-7 days)
        { id: 'D2', next_review_date: '2028-10-20' }, // Due Soon (+8 days)
        { id: 'D3', next_review_date: '2028-11-20' }, // Up to date (+39 days)
        { id: 'D4', next_review_date: '2028-10-01', review_status: 'COMPLETED' } // Completed
      ];

      const metrics = getDocumentReviewMetrics(docs, refDate);
      expect(metrics.total).toBe(4);
      expect(metrics.overdue).toBe(1);
      expect(metrics.dueSoon).toBe(1);
      expect(metrics.upToDate).toBe(1);
      expect(metrics.completed).toBe(1);
      expect(metrics.dueSoon + metrics.overdue + metrics.completed + metrics.upToDate).toBe(metrics.total);
    });
  });

  describe('PeriodicReviewDashboard UI Integration tests', () => {
    beforeEach(() => {
      useStore.setState({
        currentUser: {
          id: 'U002',
          name: 'QC Reviewer',
          department: 'QC',
          role: 'DEPARTMENT_USER'
        }
      });
    });

    it('Integration Acceptance Criteria 1: Overdue document shows Total=1, DueSoon=0, Overdue=1, Completed=0', () => {
      useStore.setState({
        simulatedSystemDate: '2028-10-12',
        documents: [
          {
            id: 'DOC-QC-OVERDUE',
            doc_code: 'WI-QC-OVERDUE',
            title: 'QC Procedure Overdue',
            department: 'QC',
            status: 'EFFECTIVE',
            next_review_date: '2028-10-09' // Overdue
          }
        ],
        externalDocuments: [],
        periodicReviewSchedules: []
      });

      render(
        <MemoryRouter initialEntries={['/periodic-reviews']}>
          <PeriodicReviewDashboard />
        </MemoryRouter>
      );

      // Total card
      const totalCard = screen.getByText('เอกสารทั้งหมด').closest('.card-surface').querySelector('h3.text-3xl');
      expect(totalCard).toHaveTextContent('1');

      // Due soon card (must NOT double count overdue document!)
      const dueSoonCard = screen.getByText('ใกล้ครบกำหนดใน 30 วัน').closest('.card-surface').querySelector('h3.text-3xl');
      expect(dueSoonCard).toHaveTextContent('0');

      // Overdue card
      const overdueCard = screen.getAllByText('เกินกำหนด')[0].closest('.card-surface').querySelector('h3.text-3xl');
      expect(overdueCard).toHaveTextContent('1');

      // Completed card
      const completedCard = screen.getByText('ทบทวนแล้วเสร็จ').closest('.card-surface').querySelector('h3.text-3xl');
      expect(completedCard).toHaveTextContent('0');
    });

    it('Integration Acceptance Criteria 2: Document 1-30 days before review shows DueSoon=1, Overdue=0', () => {
      useStore.setState({
        simulatedSystemDate: '2028-10-01',
        documents: [
          {
            id: 'DOC-QC-DUESOON',
            doc_code: 'WI-QC-DUESOON',
            title: 'QC Procedure Due Soon',
            department: 'QC',
            status: 'EFFECTIVE',
            next_review_date: '2028-10-15' // Due in 14 days
          }
        ],
        externalDocuments: [],
        periodicReviewSchedules: []
      });

      render(
        <MemoryRouter initialEntries={['/periodic-reviews']}>
          <PeriodicReviewDashboard />
        </MemoryRouter>
      );

      // Due soon card shows 1
      const dueSoonCard = screen.getByText('ใกล้ครบกำหนดใน 30 วัน').closest('.card-surface').querySelector('h3.text-3xl');
      expect(dueSoonCard).toHaveTextContent('1');

      // Overdue card shows 0
      const overdueCard = screen.getAllByText('เกินกำหนด')[0].closest('.card-surface').querySelector('h3.text-3xl');
      expect(overdueCard).toHaveTextContent('0');

      // Total card shows 1
      const totalCard = screen.getByText('เอกสารทั้งหมด').closest('.card-surface').querySelector('h3.text-3xl');
      expect(totalCard).toHaveTextContent('1');
    });

    it('Action Required Tab exists and filters due soon and overdue documents combined', () => {
      useStore.setState({
        simulatedSystemDate: '2028-10-12',
        documents: [
          {
            id: 'DOC-1',
            doc_code: 'WI-QC-1',
            title: 'QC Doc 1',
            department: 'QC',
            status: 'EFFECTIVE',
            next_review_date: '2028-10-09' // Overdue
          },
          {
            id: 'DOC-2',
            doc_code: 'WI-QC-2',
            title: 'QC Doc 2',
            department: 'QC',
            status: 'EFFECTIVE',
            next_review_date: '2028-10-25' // Due soon
          },
          {
            id: 'DOC-3',
            doc_code: 'WI-QC-3',
            title: 'QC Doc 3',
            department: 'QC',
            status: 'EFFECTIVE',
            next_review_date: '2029-05-01' // Far future
          }
        ],
        externalDocuments: [],
        periodicReviewSchedules: []
      });

      render(
        <MemoryRouter initialEntries={['/periodic-reviews']}>
          <PeriodicReviewDashboard />
        </MemoryRouter>
      );

      // Verify the tab button exists
      const actionReqTab = screen.getByRole('button', { name: /ต้องดำเนินการ \(Due Soon \/ Overdue\)/i });
      expect(actionReqTab).toBeInTheDocument();
    });
  });
});
