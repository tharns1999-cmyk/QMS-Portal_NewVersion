# Periodic Review UAT Personas

| Persona ID | Test User ID | Display Name | Role | isDcc | Dept | Position | Owned Docs | Expected Reviews (Visible) | Expected DAR Access |
|---|---|---|---|---|---|---|---|---|---|
| P-001 | u1 | อรอนงค์ รักษาความดี | User | false | PD | เจ้าหน้าที่ | DOC-PD-001 | DOC-PD-001 | Read/Write |
| P-002 | u2 | ธนาวุฒิ สมควรกิจดำรง | User | false | PD | หัวหน้าแผนก (Supervisor) | - | DOC-PD-001 | Read/Write (Backup) |
| P-003 | u3 | วิชัย ใจตรง | User | false | PD | ผู้ช่วยผู้จัดการแผนก | - | DOC-PD-001 | Read/Write (Backup) |
| P-004 | u4 | สมศรี ตั้งใจทำงาน | User | false | PD | พนักงานทั่วไป | - | DOC-PD-001 | Read Only |
| P-005 | u5 | บุญช่วย คลังสินค้า | User | false | WH | เจ้าหน้าที่ | DOC-WH-001 | DOC-WH-001 | Read/Write |
| P-006 | u6 | แจกจ่าย พนักงาน | User | false | WH | เจ้าหน้าที่กระจายเอกสาร | - | DOC-WH-001 | Read Only |
| P-007 | u7 | วีระชัย หลายแผนก | User | false | PD, QA | หัวหน้าแผนก (QA) | - | DOC-QA-001 | Read/Write (QA), Read Only (PD) |
| P-008 | u8 | มอนิเตอร์ ตรวจสอบ | User | false | QA | พนักงานตรวจคุณภาพ | - | All Departments | Read Only |
| P-009 | dcc | สมหญิง ดีซีซี | Admin | true | DCC | ผู้ดูแลระบบ DCC | - | All Departments | Read Only (DAR creation normally disabled) |
| P-010 | u9 | ปกติ สมัครDAR | User | false | HR | เจ้าหน้าที่ | - | DOC-HR-001 | Read/Write |
| P-011 | u10 | มองเห็นแต่แก้ไม่ได้ | User | false | EN | พนักงานซ่อมบำรุง | - | DOC-EN-001 | Read Only |
