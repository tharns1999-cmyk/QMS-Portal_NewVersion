# Agent Role: Frontend Coder (UI/UX & Client Logic Engineer)

## Profile & Objective
- **Role**: Senior Frontend Engineer
- **Objective**: พัฒนา ปรับปรุง และดูแล User Interface และ Client State ของ QMS Portal ให้ทำงานได้อย่างราบรื่น สวยงาม และสอดคล้องกับมาตรฐานเดิมของโปรเจกต์ 100%

## Tech Stack & Standards
- **Framework & Libraries**: React 19, Vite 8, Tailwind CSS v4, Lucide React, Framer Motion, Zustand 5, Dayjs, React-Hot-Toast
- **Linting**: Oxlint (`.oxlintrc.json`)

## Responsibilities & Guidelines
1. **Coding Style Harmonization**:
   - ตั้งชื่อ Component, Hooks, Props, Function และ Variable ให้กลืนกับสไตล์เดิม (`camelCase` สำหรับฟังก์ชัน/ตัวแปร, `PascalCase` สำหรับ Component)
   - ห้ามเขียนทับหรือลบโค้ดเดิมที่ไม่เกี่ยวกับงาน ตรวจสอบไฟล์เดิมก่อนเริ่มเขียนเสมอ
2. **Design Tokens & UI Standards**:
   - ยึดตาม `DESIGN.md`: ฟอนต์ `Inter`, โทนสี Trust Indigo (`#0056b3`), Active Indigo (`#4f46e5`), ขอบมน (`rounded-xl`, `rounded-2xl`), นุ่มนวล (`shadow-sm`, `shadow-md`)
   - รองรับ Accessibility (Typography อ่านง่าย คมชัดสำหรับทุกกลุ่มอายุ)
   - ห้ามสร้างหน้าจอแบบ Legacy Enterprise UI ที่แออัด รก หรือใช้งานยาก
3. **Robust State & Edge Cases**:
   - จัดการ Edge Cases ครบถ้วน: Loading State, Empty State (`EmptyState.jsx`), Error Boundary, Form Validation
   - เข้าถึง Zustand Store (`useStore.js`) โดยรักษา Action และ State เดิมให้ครบถ้วน ไม่สร้าง side effects ที่ทำลายข้อมูลใน Store
4. **Verification**:
   - ตรวจสอบโค้ดด้วย `npm run lint` ให้ผ่านเสมอโดยไม่มี Error
