# Walkthrough: DCC Workflow Navigation Deduplication & Safe Action History View (`ControlledCopyRegister.jsx`)

## Overview
We have resolved the duplicate navigation clutter in [`src/pages/ControlledCopy/ControlledCopyRegister.jsx`](file:///d:/OneDrive/Desktop/qms-portal-main/src/pages/ControlledCopy/ControlledCopyRegister.jsx) and eliminated the **White Screen of Death / Render Crash** occurring in Tab 5 ("ประวัติและบันทึกการทำงาน").

---

## 1. Unified 5-Stage Interactive Workflow Navigator

### Before vs After
- **Before:** 4 large overview stat cards on top + 5 sub-tabs underneath controlling the same `activeTab` state, creating severe visual clutter and redundant interactions.
- **After (Figma UI3 Precision Canvas Navigator):**
  - Consolidated into a single `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 bg-[#FAFAFA] p-1.5 border border-[#E5E5E5] rounded-xl mb-4` bar.
  - Interactive stages with icons and count badges:
    1. `[ 🖨️ 1. รายการรอออกสำเนา (N) ]` (`PENDING_ISSUE` / `PENDING_PRINT`)
    2. `[ 🚚 2. ติดตามการส่งมอบ (N) ]` (`DISPATCHED_TRACKING` / `DISPATCHED`)
    3. `[ ⚠️ 3. เช็กลิสต์เรียกคืนเอกสาร (N) ]` (`RECALL_CHECKLIST` / `RECALL`)
    4. `[ 📑 4. สำเนาใช้งานจริง (N) ]` (`ACTIVE_REGISTER` / `ACTIVE`)
    5. `[ 🕒 5. ประวัติการทำงาน (N) ]` (`AUDIT_TRAIL` / `HISTORY`)
  - Active tab state: `bg-white border-2 border-[#0D99FF] text-[#0D99FF] font-semibold shadow-xs` with badge `bg-[#E5F4FF] text-[#0D99FF] font-mono font-bold`.
  - Inactive tab state: `bg-white border border-[#E5E5E5] text-[#555555] hover:border-[#CCCCCC] hover:text-[#1E1E1E] shadow-2xs` with badge `bg-[#F0F0F0] text-[#666666] font-mono font-semibold`.

---

## 2. White Screen of Death Fix in Tab 5 (Audit History)

### Root Cause Diagnosed & Fixed:
1. **Unrendered Object Error:** Previously, log fields such as `log.user`, `log.details`, `log.remarks`, or `log.performed_by` could contain JavaScript Objects (e.g. `{ name: '...', id: '...' }` or `{ reason: '...' }`). Rendering them directly into JSX crashed React with *"Objects are not valid as a React child"*.
   - **Fix:** Applied safe JSON stringification: `typeof val === 'object' ? JSON.stringify(val) : (val || '-')`.
2. **Undefined Function Reference:** `handleExportCSV` had a naming mismatch with `handleExportAuditCsv`, which was fixed.
3. **Invalid Date Handling:** Wrapped timestamp parsing with safe fallback and try/catch.
4. **Data Store Aggregation:** Combined both `controlledCopyAuditTrail` and `actionLog` (with `CC_` / `DAR_` actions) into `dccHistoryLogs` with sorting and deduplication.

---

## 3. External Document Registration Auto-Sync (`ExternalDocFormModal.jsx`)

### Enhancements Made:
1. **User Department Defaulting:**
   - Evaluates `currentUser?.department || currentUser?.dept_code || currentUser?.dept || 'QA'`.
   - Populates initial `formData.department` state and resyncs via `useEffect` whenever the modal is opened.
2. **Dynamic Preview Sync:**
   - Reactive calculation of `previewEdCode` based on the selected `formData.department` with fallback `userDept`.
   - Running number and pattern `ED-{Dept}-{Seq}` immediately update when user selects another department in the dropdown.
3. **Clean Action Buttons:**
   - Updated footer action buttons to clean Thai: `[ ยกเลิก ]` and `[ ยืนยันการลงทะเบียน ]` / `[ ส่งคำขออัปเดต ]`.

---

## 4. Full-Width Layout Expansion (`ExternalDocsList.jsx`)

### Enhancements Made:
1. **Full-Width Outer Wrapper:**
   - Replaced fixed constraint `max-w-7xl mx-auto` with fluid `w-full space-y-4 pb-12` matching the standard set in [`Library.jsx`](file:///d:/OneDrive/Desktop/qms-portal-main/src/pages/Library/Library.jsx).
2. **Figma UI3 Header Strip & 4-Column Metrics Grid:**
   - Standardized Header Card with clean icon badge and direct button `[ ลงทะเบียนเอกสารภายนอก ]`.
   - Balanced 4-metric grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full`) with HSL tokens.
   - Filter bar and Data Table expanded to 100% width with zero horizontal clipping.

---

## 5. Comprehensive QA Workflow Mock Data Engine & State Seeding

### Mock Data Architecture Implemented (`src/data/mockQaWorkflowSeed.js` & `useStore.js`):
1. **User Persona Architecture:**
   - **Requester:** `U005` (บีม - QA/QC Supervisor, Level 4 QA) as the single origin for all QA requests.
   - **Reviewer:** `U003` (กัลยาณี พลไกร - Level 5 QA).
   - **Approver:** `U004` (คุณเรย์ - General Manager, Level 6).
   - **DCC Admin:** `U001` (Admin QA - DCC Admin).
   - **Cross-Dept Audience:** `U002` (PD Lv.4), `U006` (EN Lv.4), `U010` (MKT).

2. **Internal DAR Workflow Matrix (6 Realistic Cases):**
   - `DAR-2608-001` (New SOP-QA-001): `GENERAL` scope, 3 distribution locations (QA, PD, WH), status `PENDING_REVIEW`.
   - `DAR-2608-002` (New WI-QA-001): `DEPT_ONLY` scope, Paperless (0 physical copies), status `PENDING_APPROVAL`.
   - `DAR-2608-003` (New SD-QA-001): `TARGETED` scope (QA, PD, WH), Master Copy 01 only, status `PENDING_REVIEW`.
   - `DAR-2608-004` (New SOP-QA-002): `RESTRICTED` scope (U001, U003, U004, U005, Min Level 4), Paperless, status `PENDING_APPROVAL`.
   - `DAR-2608-005` (Revision on SOP-QA-003): Rev.00 to Rev.01, status `PENDING_REVIEW`.
   - `DAR-2608-006` (Obsolete on FM-QA-001): Recall physical copies from QA & WH, status `PENDING_APPROVAL`.

3. **External Documents Matrix (3 Cases):**
   - `ED-QA-01`: ISO 9001:2015 (`General`), status `PENDING_EXT_REVIEW`.
   - `ED-QA-02`: Codex GHPs Rev.2020 (`Department` - QA, PD, WH), status `PENDING_EXT_APPROVAL`.
   - `ED-QA-03`: APHA Microbiological Examination (`Restricted`), status `ACTIVE`, `nextReviewDate` in 15 days (`DUE_SOON`).

4. **Task Inbox Synchronization:**
   - 4 synchronized tasks for `U003` (Reviewer): 3 DAR review tasks + 1 external doc review task.
   - 4 synchronized tasks for `U004` (Approver): 3 DAR approval tasks + 1 external doc approval task.

5. **UI Seeding Action Integration:**
   - Added **"โหลด Mock Data (QA)"** button in Sidebar (`Sidebar.jsx`) and Master Data Hub (`MasterDataHub.jsx`).

---

## 6. Library 3-Tier Tab Re-organization & 4-Tier Access Scope Integration (`Library.jsx`)

### Key Architectural Updates:
1. **3-Tier Segmented Tab Navigation:**
   - **แท็บ 1: "เอกสารทั่วไป" (`TAB_GENERAL`):** แสดงเอกสารระดับ `GENERAL` ทั้งหมดข้ามทุกแผนกในองค์กร พนักงานทุกคนเปิดดูและดาวน์โหลดได้
   - **แท็บ 2: "เอกสารในแผนกฉัน" (`TAB_MY_DEPT`):** แสดงเอกสารทุกระดับความลับ (`GENERAL`, `DEPT_ONLY`, `TARGETED`, `RESTRICTED`) ที่แผนกตนเองเป็นเจ้าของ
   - **แท็บ 3: "เอกสารที่ได้รับการแจกจ่าย" (`TAB_DISTRIBUTED`):** แสดงเอกสารต่างแผนกที่ได้รับสิทธิ์ผ่านสำเนาควบคุม (Controlled Copy), สิทธิ์ `TARGETED`, หรือสิทธิ์ `RESTRICTED`
   - **แท็บ 4 (DCC / ผู้บริหาร): "เอกสารทั้งหมด" (`TAB_GLOBAL`):** รวมเอกสารทั้งหมดเพื่อการกำกับดูแล
2. **Badge ระดับความลับภาษาไทยคมชัด 4 ระดับ:**
   - `GENERAL`: `🌐 ทั่วไป` (สีเขียว `#E6F7ED`)
   - `DEPT_ONLY`: `🔒 เฉพาะแผนก` (สีส้ม `#FFF8E6`)
   - `TARGETED`: `🏢 ระบุแผนก` (สีฟ้า `#E5F4FF`)
   - `RESTRICTED`: `🛡️ ลับเฉพาะ (Lv.X+)` (สีแดง `#FFF2F0`)
3. **Figma UI3 Action Dock & Overflow Menu:**
   - คงความกะทัดรัด (76px) พร้อม Quick Actions (`Eye`, `Download`, `MoreHorizontal`) ครบถ้วน 100%

---

## 7. UI/UX Master Overhaul & Bug Fixes: Document Detail Modal & Table Action Menu Layering (`DocumentDetailModal.jsx` / `Library.jsx`)

### Key Architectural Updates:
1. **Fix Table Dropdown Z-Index & Bleed-Through (`Library.jsx`):**
   - Fixed table dropdown popover to have 100% solid background `bg-white`, high elevation `shadow-[0_12px_36px_rgba(0,0,0,0.16)]`, `z-50`, `backdrop-blur-none`, and `relative z-30` on active row cells.
   - Eliminated text bleed-through from table rows underneath.
   - Organized menu items into 3 structured semantic groups:
     1. การดูข้อมูลและผัง (`เปิดดูในแท็บใหม่`, `ดูรายละเอียดและประวัติ DAR`)
     2. จัดการสำเนาและขอแก้ไข (`ดาวน์โหลด External Release`, `Watermark Studio`, `ขอสำเนาควบคุมเพิ่มเติม`, `ยื่นคำร้องขอแก้ไขฉบับใหม่`, `ขอยกเลิกเอกสารฉบับนี้`)
     3. แจ้งเตือนความเสี่ยง (`แจ้งชำรุด หรือสูญหาย`)
2. **DocumentDetailModal.jsx Master Overhaul (Figma UI3):**
   - Replaced legacy orange/brown accents with **Figma Electric Blue (`#0D99FF`) and Sharp 1px Borders (`#E5E5E5`)**.
   - **Header:** Electric Blue document code badge, Rev badge, and clean title.
   - **Top 4 Inspector Property Cards (`grid grid-cols-2 md:grid-cols-4 gap-3`):**
     1. แผนกเจ้าของเอกสาร
     2. วันที่มีผลบังคับใช้
     3. สถานะเอกสาร (มีผลบังคับใช้)
     4. ระดับความลับ (General, Dept Only, Targeted, Restricted)
   - **Action Toolbar Grid (`grid grid-cols-2 sm:grid-cols-4 gap-2.5`):** Standardized `h-9` height for `เปิดดูเอกสาร`, `ดาวน์โหลด PDF`, `Watermark Studio`, and `ขอสำเนาควบคุมเพิ่ม`.
   - **Controlled Copies Table:** High-density table with `ISSUED_ACTIVE` badges and `แจ้งชำรุด/เล่มใหม่` Warning Micro-Buttons.
   - **Tab 2 (Enriched DAR Audit Trail):** Complete DAR history cards displaying Request Type, Status, Reason, Description/Plan, and 4-step sign-off matrix (Requester, Reviewer, Approver, Ack) with zero empty `-` dashes.

---

## 8. Feature Architecture & Client-Side Export: DAR History CSV/Excel Exporter (`DocumentDetailModal.jsx`)

### Key Architectural Updates:
1. **Figma UI3 Micro-Toolbar Button:**
   - Placed `[ 📥 ส่งออกประวัติ (CSV) ]` at the top right of the Header in Tab 2 ("ประวัติ DAR และการแก้ไข").
   - Spec: `h-8 px-3 text-xs font-semibold text-[#1E1E1E] bg-white border border-[#E5E5E5] hover:bg-[#F5F5F5] hover:border-[#CCCCCC] disabled:opacity-40 rounded-lg shadow-2xs inline-flex items-center gap-1.5 transition-colors cursor-pointer`.
2. **UTF-8 with BOM Generator (`\uFEFF`):**
   - Automatically prepends UTF-8 BOM (`\uFEFF`) to ensure Thai characters render flawlessly in Microsoft Excel and Google Sheets without encoding issues.
3. **14 Comprehensive Data Columns:**
   - Covers: รหัสเอกสาร, ชื่อเอกสาร, ฉบับที่ (Rev.), เลขที่คำร้อง DAR, ประเภทคำร้อง, สถานะคำร้อง, วันที่ยื่นคำขอ, วันที่มีผลบังคับใช้, ผู้ยื่นคำขอ, ผู้ทบทวน, ผู้อนุมัติ, การรับทราบ, เหตุผลในการร้องขอ, รายละเอียดคำร้อง/แผนรองรับ.
4. **Zero Regression & Automated Test Guard:**
   - Preserves all existing modal behaviors, props, state, and permissions.

---

## 9. Dynamic Table Layout Overhaul: Auto-Fit Content Height & Elimination of Artificial Blank Space

### Key Architectural Updates:
1. **Elimination of Artificial Height Locks:**
   - Removed `min-h-[60vh]`, `min-h-[80vh]`, and `h-[70vh]` fixed height constraints from all data table wrappers across the system (`Library.jsx`, `ActionLog.jsx`, `ControlledCopyRegister.jsx`, `ExternalDocsList.jsx`, `DarList.jsx`, `MyReviewTasks.jsx`).
2. **Dynamic Auto-Fit Content Height (`h-auto`):**
   - Standardized table card containers to `w-full bg-white border border-[#E5E5E5] rounded-xl overflow-hidden shadow-2xs h-auto`.
   - Cards dynamically scale up or down to fit the exact row count without leaving large vertical blank voids.
3. **Compact Empty State Styling:**
   - Empty state padded comfortably (`py-14 px-4`) with `#CCCCCC` icons, clear primary message, and secondary action prompts.

---

## 10. Table Action Dropdown Clipping & Boundary Collision Fix: Floating Context Menu & Z-Index Precision (`Library.jsx`)

### Key Architectural Updates:
1. **Prevent Left Boundary Collision & Clipping:**
   - Changed dropdown menu alignment from `left-0 sm:left-auto sm:right-0` to `left-0 origin-top-left`.
   - The popover now expands naturally to the right into the table canvas, eliminating truncation, clipped text (e.g. `ll Viewer)`, `วัติ DAR`), and collision with the left screen boundary.
2. **Standardized Action Column Dimensions:**
   - `<th>`: `w-[96px] min-w-[96px] py-3 px-3 text-center text-[11px] font-semibold text-[#777777] uppercase tracking-wider select-none whitespace-nowrap`
   - `<td>`: `w-[96px] min-w-[96px] py-2 px-3 text-center align-middle whitespace-nowrap relative`
3. **Floating Context Menu Styling (Figma UI3):**
   - Popover card: `absolute left-0 top-full mt-1.5 w-60 origin-top-left bg-white border border-[#E5E5E5] rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] py-1.5 z-50 text-left divide-y divide-[#F0F0F0] backdrop-blur-none ring-1 ring-black/5`.
   - All menu items use `whitespace-nowrap` and zero opacity bleed-through.

---

## 11. Full-Height Enterprise Workspace Canvas & Non-Clipping Floating Action Menu (`Library.jsx`)

### Key Architectural Updates:
1. **Full-Height Workspace Canvas (`Library.jsx`):**
   - Page container: `w-full h-full flex-1 flex flex-col min-h-0 space-y-3 pb-4`
   - Table container: `w-full max-w-full flex-1 flex flex-col min-h-0 bg-white border border-[#E5E5E5] rounded-xl shadow-2xs overflow-hidden h-auto`
   - Inner Scroll Container: `w-full flex-1 overflow-auto min-h-0 custom-scrollbar`
   - Sticky Header (`<thead>`): `sticky top-0 z-20 bg-[#F5F5F5] border-b border-[#E5E5E5] backdrop-blur-xs`
2. **Fixed Floating Positioning for Action Dropdown (`...`):**
   - Implemented dynamic positioning (`position: fixed`, `zIndex: 9999`) calculated via `getBoundingClientRect()` upon clicking `MoreHorizontal`.
   - **Zero Clipping Guarantee:** Completely breaks out of `overflow-x-auto`, `overflow-y-auto`, and `overflow-hidden` table boundaries.
   - **Intelligent Auto-Flip:** Automatically flips upward (`openUpward`) if row is near the bottom of the viewport (< 340px).
   - **Viewport Bounds Protection:** Clamps left coordinate to prevent going off-screen on the right (`winWidth - menuWidth - 16`).
   - Closes seamlessly on outside click, window resize, scroll, or pressing `Escape`.

---

## 12. Enterprise Typography System & Font Overhaul: IBM Plex Sans Thai + Inter Integration

### Key Architectural Updates:
1. **Google Fonts Pairing (`index.html` & `src/index.css`):**
   - Integrated **"IBM Plex Sans Thai"** (weights 300, 400, 500, 600, 700) for clean, modern, legible Thai typography with zero vowel/tone mark clipping.
   - Integrated **"Inter"** (weights 400, 500, 600, 700, 800) for numbers, codes, and Latin typography.
   - Integrated **"JetBrains Mono"** (weights 400, 500, 600, 700) for document codes, revision badges, and running numbers.
2. **Tailwind CSS v4 `@theme` Configuration (`src/index.css`):**
   - `--font-sans`: `'Inter', 'IBM Plex Sans Thai', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
   - `--font-mono`: `'JetBrains Mono', Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`
   - `--font-thai`: `'IBM Plex Sans Thai', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
3. **Thai Rendering & Baseline Alignment Enhancements:**
   - Standardized `leading-normal` and `leading-snug` across status pills, buttons, headers, and form inputs to eliminate vowel/tone mark truncation.
   - Configured `font-feature-settings: "cv02", "cv03", "cv04", "cv11"` and `text-rendering: optimizeLegibility`.

---

## 13. Verification & Test Results

### Automated Unit & Integration Tests
- Created test suite [`src/tests/typography_system.test.jsx`](file:///d:/OneDrive/Desktop/qms-portal-main/src/tests/typography_system.test.jsx) verifying font links and theme configurations.
- Executed `npx vitest run`:
  - **45 / 45 test files passed (297 / 297 tests passed 100%)**.

### Production Build Verification
- Executed `npm run build`:
  - Output bundle compiled cleanly in 2.13s with 0 errors.
