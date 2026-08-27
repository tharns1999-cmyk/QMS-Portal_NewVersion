import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard/Dashboard';
import TaskInbox from '../pages/Tasks/TaskInbox';

describe('Smoke Tests for Main Pages', () => {
  it('should render Dashboard without crashing', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByText(/ตรวจสอบคิวงาน/i)).toBeInTheDocument();
  });

  it('should render TaskInbox without crashing and have clickable tabs', () => {
    render(
      <MemoryRouter>
        <TaskInbox />
      </MemoryRouter>
    );
    // Tab "Review" usually exists
    const reviewTab = screen.getByText('Review');
    expect(reviewTab).toBeInTheDocument();
    
    // Tab should be clickable
    expect(reviewTab.closest('button')).toBeInTheDocument();
  });
});
