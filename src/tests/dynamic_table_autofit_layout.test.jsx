import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Library from '../pages/Library/Library';
import ActionLog from '../pages/Admin/ActionLog';
import ControlledCopyRegister from '../pages/ControlledCopy/ControlledCopyRegister';
import ExternalDocsList from '../pages/ExternalDocs/ExternalDocsList';
import DarList from '../pages/DarWorkflow/DarList';
import useStore from '../store/useStore';

describe('Dynamic Table Layout Overhaul & Auto-Fit Content Height Tests', () => {
  const mockUser = {
    id: 'U005',
    name: 'บีม (QA)',
    department: 'QA',
    depts: ['QA'],
    role: 'DCC_ADMIN',
    level: 4,
    isDcc: true
  };

  beforeEach(() => {
    useStore.setState({
      currentUser: mockUser,
      documents: [
        {
          id: 'doc-1',
          title: 'SOP-QA-01',
          name: 'ระเบียบการตรวจประเมินคุณภาพ',
          department: 'QA',
          rev: '01',
          effectiveDate: '2026-08-01',
          status: 'EFFECTIVE',
          access_control: { scope: 'GENERAL' }
        }
      ],
      externalDocuments: [],
      actionLog: [
        {
          id: 'log-1',
          actionType: 'CC_DISPATCH',
          actor: 'DCC Officer',
          role: 'DCC_ADMIN',
          details: 'Dispatched copy 01',
          date: '2026-08-25T10:00:00Z'
        }
      ],
      controlledCopyInstances: [
        {
          id: 'cc-1',
          doc_id: 'doc-1',
          doc_code: 'SOP-QA-01',
          copy_no: '01',
          holder_dept: 'QA',
          location: 'QA Lab',
          status: 'PENDING_ISSUE'
        }
      ],
      dars: [],
      tasks: [],
      masterUsers: [{ id: 'U005', name: 'บีม (QA)' }]
    });
  });

  it('1. Library.jsx renders table card with h-auto and w-full without artificial min-h locking', () => {
    const { container } = render(
      <MemoryRouter>
        <Library />
      </MemoryRouter>
    );

    const table = container.querySelector('table');
    const tableCard = table.closest('.rounded-xl');
    expect(tableCard).toBeInTheDocument();
    expect(tableCard.className).toContain('h-auto');
    expect(tableCard.className).toContain('w-full');
    expect(tableCard.className).not.toMatch(/min-h-\[\d+px\]/);
    expect(tableCard.className).not.toMatch(/min-h-\[\d+vh\]/);
  });

  it('2. ActionLog.jsx renders table card with h-auto and eliminates min-h-60vh', () => {
    const { container } = render(
      <MemoryRouter>
        <ActionLog />
      </MemoryRouter>
    );

    const table = container.querySelector('table');
    const logCard = table.closest('.rounded-xl');
    expect(logCard).toBeInTheDocument();
    expect(logCard.className).toContain('h-auto');
    expect(logCard.className).not.toContain('min-h-[60vh]');
  });

  it('3. ControlledCopyRegister.jsx renders workflow tabs with h-auto containers', () => {
    const { container } = render(
      <MemoryRouter>
        <ControlledCopyRegister />
      </MemoryRouter>
    );

    const table = container.querySelector('table');
    const activeTabContainer = table.closest('.rounded-xl');
    expect(activeTabContainer).toBeInTheDocument();
    expect(activeTabContainer.className).toContain('h-auto');
  });

  it('4. ExternalDocsList.jsx renders main card with h-auto and w-full', () => {
    const { container } = render(
      <MemoryRouter>
        <ExternalDocsList />
      </MemoryRouter>
    );

    const table = container.querySelector('table');
    const extCard = table.closest('.rounded-xl');
    expect(extCard).toBeInTheDocument();
    expect(extCard.className).toContain('h-auto');
    expect(extCard.className).toContain('w-full');
  });

  it('5. DarList.jsx renders table card with h-auto and w-full', () => {
    const { container } = render(
      <MemoryRouter>
        <DarList />
      </MemoryRouter>
    );

    const table = container.querySelector('table');
    const darCard = table.closest('.rounded-xl');
    expect(darCard).toBeInTheDocument();
    expect(darCard.className).toContain('h-auto');
  });
});
