import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Comfortable Typography Scale & WCAG 2.1 AA UI System', () => {
  const indexCss = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf-8');
  const libraryCode = fs.readFileSync(path.resolve(__dirname, '../pages/Library/Library.jsx'), 'utf-8');
  const externalDocsCode = fs.readFileSync(path.resolve(__dirname, '../pages/ExternalDocs/ExternalDocsList.jsx'), 'utf-8');
  const controlledCopyCode = fs.readFileSync(path.resolve(__dirname, '../pages/ControlledCopy/ControlledCopyRegister.jsx'), 'utf-8');
  const taskInboxCode = fs.readFileSync(path.resolve(__dirname, '../pages/Tasks/TaskInbox.jsx'), 'utf-8');
  const docDetailModalCode = fs.readFileSync(path.resolve(__dirname, '../components/workflow/DocumentDetailModal.jsx'), 'utf-8');

  it('1. verifies src/index.css has standard 40px (h-10) form controls, buttons, and comfortable badges', () => {
    // Inputs & selects h-10
    expect(indexCss).toContain('.input-primary {\n    @apply w-full h-10');
    expect(indexCss).toContain('.select-primary {\n    @apply w-full h-10');
    
    // Buttons h-10 text-sm
    expect(indexCss).toContain('.btn-primary {\n    @apply bg-[#0D99FF] hover:bg-[#007BE5] active:bg-[#006ACC] text-white text-sm font-semibold px-4 h-10');
    expect(indexCss).toContain('.btn-secondary {\n    @apply bg-white hover:bg-[#F0F0F0] active:bg-[#EBEBEB] text-[#1E1E1E] border border-[#E5E5E5] text-sm font-medium px-4 h-10');
    
    // Badges comfortable padding & font-semibold
    expect(indexCss).toContain('.badge-active {\n    @apply bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9] font-semibold text-xs px-2.5 py-1 rounded-md');
    expect(indexCss).toContain('.badge-pending {\n    @apply bg-[#FFF7D4] text-[#D49800] border border-[#FFE785] font-semibold text-xs px-2.5 py-1 rounded-md');
    
    // Table header & row styling
    expect(indexCss).toContain('.table-header {\n    @apply bg-[#F8FAFC] text-[#374151] font-bold text-xs uppercase tracking-wider border-b border-[#E2E8F0];');
    expect(indexCss).toContain('.table-row {\n    @apply hover:bg-[#F8FAFC] transition-colors duration-150 border-b border-[#F1F5F9]');
  });

  it('2. verifies Library.jsx uses comfortable table typography, headers, tabs, and filters', () => {
    // Table header with crisp contrast and padding
    expect(libraryCode).toContain('bg-[#F8FAFC] text-[#374151] font-bold text-xs uppercase tracking-wider border-b border-[#E2E8F0]');
    
    // Table rows with 14px (text-sm) primary title and doc code
    expect(libraryCode).toContain('font-mono font-bold text-sm text-[#0D99FF] bg-[#E5F4FF] border border-[#B8E1FF] px-2.5 py-0.5 rounded-md inline-block');
    expect(libraryCode).toContain('font-medium text-[#1E293B] text-sm leading-relaxed');
    
    // Segmented tabs with text-sm font-semibold and h-10 search/filters
    expect(libraryCode).toContain('px-4 py-2.5 rounded-lg text-sm font-semibold');
    expect(libraryCode).toContain('h-10 text-sm placeholder:text-[#999999]');
  });

  it('3. verifies ExternalDocsList.jsx has 3xl metric numbers, comfortable badges, and table rows', () => {
    // Big Numbers in Metric Cards
    expect(externalDocsCode).toContain('text-3xl font-bold font-mono text-[#1E293B]');
    expect(externalDocsCode).toContain('text-3xl font-bold font-mono text-[#14AE5C]');
    
    // Table header & rows
    expect(externalDocsCode).toContain('bg-[#F8FAFC] text-[#374151] uppercase font-bold text-xs tracking-wider border-b border-[#E2E8F0]');
    expect(externalDocsCode).toContain('font-mono font-bold text-sm text-[#0D99FF] bg-[#E5F4FF]');
    expect(externalDocsCode).toContain('font-medium text-[#1E293B] text-sm leading-relaxed');
  });

  it('4. verifies ControlledCopyRegister.jsx has upgraded workflow navigator tabs and table scaling', () => {
    // Navigator tabs with comfortable padding and text-sm
    expect(controlledCopyCode).toContain('px-3.5 py-3 rounded-lg transition-all cursor-pointer');
    expect(controlledCopyCode).toContain('text-sm truncate font-medium');
    
    // Table headers with high-contrast slate-700
    expect(controlledCopyCode).toContain('bg-[#F8FAFC] text-[#374151] uppercase font-bold text-xs tracking-wider border-b border-[#E2E8F0]');
    expect(controlledCopyCode).toContain('font-bold text-sm font-mono text-[#0D99FF]');
  });

  it('5. verifies TaskInbox.jsx has text-sm tabs, h-10 search input, and comfortable risk badges', () => {
    expect(taskInboxCode).toContain('py-2.5 px-4 rounded-lg font-bold text-sm');
    expect(taskInboxCode).toContain('w-full pl-10 pr-4 py-2 h-10 bg-white');
  });

  it('6. verifies DocumentDetailModal.jsx has comfortable property cards, h-10 buttons, and legible DAR cards', () => {
    // Property cards with text-xs / text-sm
    expect(docDetailModalCode).toContain('text-xs text-[#64748B] font-semibold flex items-center gap-1.5');
    expect(docDetailModalCode).toContain('text-sm font-bold text-[#1E293B]');
    
    // Action buttons standardized to h-10 text-sm font-semibold
    expect(docDetailModalCode).toContain('h-10 px-3.5 bg-white border border-[#E5E5E5]');
    expect(docDetailModalCode).toContain('h-10 px-3.5 bg-[#0D99FF]');
    
    // Controlled copies table in modal
    expect(docDetailModalCode).toContain('bg-[#F8FAFC] text-[#374151] font-bold text-xs uppercase tracking-wider border-b border-[#E2E8F0]');
  });
});
