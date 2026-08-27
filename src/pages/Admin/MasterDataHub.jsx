import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, 
  Building2, 
  FileCode, 
  MapPin, 
  KeyRound, 
  Clock, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  RotateCcw, 
  X, 
  Layers, 
  Save, 
  ArrowLeft,
  Crown,
  Sparkles,
  PenTool,
  CheckCircle2,
  AlertCircle,
  Eye,
  Upload,
  Sliders,
  Check,
  Fingerprint,
  Award,
  FileCheck,
  ChevronDown
} from 'lucide-react';
import useStore from '../../store/useStore';
import toast from 'react-hot-toast';
import { TablePagination } from '../../components/common/TablePagination';
import { useTablePagination } from '../../hooks/useTablePagination';

const MasterDataHub = () => {
  const navigate = useNavigate();
  const { 
    currentUser, 
    masterUsers, 
    masterDepartments, 
    departments: storeDepts,
    documentTypes, 
    distributionLocations, 
    signatureSettings, 
    slaSettings,
    approvalMatrix,
    approval_matrix,
    controlledCopyInstances,
    documentControlledCopies,
    documents,
    // Actions
    addMasterUser,
    updateMasterUser,
    toggleUserStatus,
    resetUserPassword,
    resetUserPin,
    unlockUserAccount,
    updateUserSignatureProfile,
    addDepartment,
    updateDepartment,
    toggleDepartmentStatus,
    addDocumentType,
    updateDocumentType,
    toggleDocumentTypeStatus,
    addDistributionLocation,
    updateDistributionLocation,
    deleteDistributionLocation,
    toggleLocationStatus,
    updateSignatureSettings,
    updateSlaSettings,
    updateApprovalMatrix,
    updateApprovalMatrixEntry,
    resetTransactionDataToCleanSlate,
    seedComprehensiveQaMockData
  } = useStore();

  const [activeTab, setActiveTab] = useState('users'); // users, departments, docTypes, locations, security, sla
  const [isCleanSlateModalOpen, setIsCleanSlateModalOpen] = useState(false);

  // --- FILTERS & SEARCH STATES ---
  const [userSearch, setUserSearch] = useState('');
  const [userDeptFilter, setUserDeptFilter] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');

  const [deptSearch, setDeptSearch] = useState('');
  const [typeSearch, setTypeSearch] = useState('');
  
  const [locSearch, setLocSearch] = useState('');
  const [selectedLocDept, setSelectedLocDept] = useState('ALL');
  const [isLocDeptDropdownOpen, setIsLocDeptDropdownOpen] = useState(false);
  const [locDeptSearchText, setLocDeptSearchText] = useState('');
  const locDeptDropdownRef = useRef(null);

  // --- TAB 5 E-SIGNATURE FILTERS & SEARCH STATES ---
  const [sigUserSearch, setSigUserSearch] = useState('');
  const [sigDeptFilter, setSigDeptFilter] = useState('ALL');
  const [sigStatusFilter, setSigStatusFilter] = useState('ALL');

  // --- MODAL STATES ---
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({
    name: '',
    empId: '',
    email: '',
    department: 'QA',
    position: '',
    role: 'GENERAL_USER',
    level: 1
  });

  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptFormData, setDeptFormData] = useState({
    id: '',
    nameTh: '',
    nameEn: '',
    headUserId: ''
  });

  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeFormData, setTypeFormData] = useState({
    code: '',
    nameTh: '',
    name: '',
    namingPattern: '{Type}-{Dept}-{##}',
    is_form_type: false,
    category: 'INTERNAL',
    allowDar: true,
    reviewCycleMonths: 12,
    retentionPeriodYears: 3,
    description: ''
  });

  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState(null);
  const [locFormData, setLocFormData] = useState({
    id: '',
    code: '',
    name: '',
    departmentId: 'PD',
    description: '',
    isMasterOffice: false
  });

  const [orphanWarningModal, setOrphanWarningModal] = useState({
    isOpen: false,
    message: ''
  });

  // Security Form (21 CFR Part 11 Compliant)
  const [secForm, setSecForm] = useState({
    pinLength: signatureSettings?.pinLength || 6,
    maxFailedAttempts: signatureSettings?.maxFailedAttempts || 3,
    defaultPin: signatureSettings?.defaultPin || '123456',
    requireReasonForSigning: signatureSettings?.requireReasonForSigning !== undefined ? signatureSettings.requireReasonForSigning : true,
    requireReAuthentication: signatureSettings?.requireReAuthentication !== undefined ? signatureSettings.requireReAuthentication : true,
    enableTimestampAuthority: signatureSettings?.enableTimestampAuthority !== undefined ? signatureSettings.enableTimestampAuthority : true,
    dualSignOffOnObsolete: signatureSettings?.dualSignOffOnObsolete !== undefined ? signatureSettings.dualSignOffOnObsolete : true,
    auditTrailLogging: signatureSettings?.auditTrailLogging !== undefined ? signatureSettings.auditTrailLogging : true,
    signatureStampFormat: signatureSettings?.signatureStampFormat || 'STANDARD_WITH_METADATA'
  });

  // Signature Profile Modal States
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [selectedUserForSignature, setSelectedUserForSignature] = useState(null);
  const [signatureFormData, setSignatureFormData] = useState({
    signatureType: 'TYPOGRAPHIC',
    signatureStyle: 'BRUSH_SCRIPT',
    signatureInitials: '',
    signatureImage: '',
    certificateSerial: ''
  });

  // Digital Stamp Simulator Modal States
  const [isStampSimulatorModalOpen, setIsStampSimulatorModalOpen] = useState(false);
  const [stampSimulatorUser, setStampSimulatorUser] = useState(null);
  const [stampSimulatorRole, setStampSimulatorRole] = useState('APPROVER');

  // SLA Form
  const [slaForm, setSlaForm] = useState({
    reviewSlaDays: slaSettings?.reviewSlaDays || 3,
    approvalSlaDays: slaSettings?.approvalSlaDays || 3,
    hardcopyReceiptSlaDays: slaSettings?.hardcopyReceiptSlaDays || 5,
    recallSlaDays: slaSettings?.recallSlaDays || 7
  });

  // Dynamic Approval Rows: Linked directly to Tab 3's documentTypes (Single Source of Truth)
  const dynamicApprovalRows = useMemo(() => {
    const rawMatrix = approvalMatrix || approval_matrix || [];
    const types = (documentTypes && documentTypes.length > 0) ? documentTypes : [
      { code: 'QM', name: 'คู่มือคุณภาพ (Quality Manual)', nameTh: 'คู่มือคุณภาพ', description: 'คู่มือคุณภาพระดับสูงสุดขององค์กร' },
      { code: 'SOP', name: 'ระเบียบปฏิบัติ (Standard Operating Procedure)', nameTh: 'ระเบียบปฏิบัติ', description: 'ขั้นตอนการทำงานข้ามสายงาน' },
      { code: 'WI', name: 'วิธีปฏิบัติงาน (Work Instruction)', nameTh: 'วิธีปฏิบัติงาน', description: 'ขั้นตอนการปฏิบัติงานเฉพาะจุด' },
      { code: 'FM', name: 'แบบฟอร์ม (Form / Record)', nameTh: 'แบบฟอร์ม', description: 'แบบฟอร์มบันทึกข้อมูลคุณภาพ' },
      { code: 'SD', name: 'เอกสารสนับสนุน (Supporting Document)', nameTh: 'เอกสารสนับสนุน', description: 'เอกสารสนับสนุนและอ้างอิงภายนอก' }
    ];

    return types.map((docType) => {
      const code = docType.code || docType.id;
      const existingConfig = rawMatrix.find(
        (m) => (m.doc_type || m.docType) === code
      );

      const defaultApprover = code === 'QM' ? 8 : (code === 'SOP' ? 6 : 5);

      return {
        code,
        docType: code,
        doc_type: code,
        name: docType.nameTh || docType.name || code,
        nameTh: docType.nameTh || docType.name || code,
        description: docType.description || '',
        category: docType.category || (code === 'ED' ? 'EXTERNAL' : 'INTERNAL'),
        minRequesterLevel: existingConfig?.min_requester_level ?? existingConfig?.minRequesterLevel ?? 1,
        min_requester_level: existingConfig?.min_requester_level ?? existingConfig?.minRequesterLevel ?? 1,
        requiredReviewerLevel: existingConfig?.required_reviewer_level ?? existingConfig?.requiredReviewerLevel ?? 4,
        required_reviewer_level: existingConfig?.required_reviewer_level ?? existingConfig?.requiredReviewerLevel ?? 4,
        requiredApproverLevel: existingConfig?.required_approver_level ?? existingConfig?.requiredApproverLevel ?? defaultApprover,
        required_approver_level: existingConfig?.required_approver_level ?? existingConfig?.requiredApproverLevel ?? defaultApprover,
        requireAckDefault: existingConfig?.require_ack_default ?? existingConfig?.requireAckDefault ?? false,
        require_ack_default: existingConfig?.require_ack_default ?? existingConfig?.requireAckDefault ?? false,
      };
    });
  }, [documentTypes, approvalMatrix, approval_matrix]);

  // Keep currentMatrix as alias to dynamicApprovalRows for non-regression
  const currentMatrix = dynamicApprovalRows;
  const approvalMatrixPagination = useTablePagination(dynamicApprovalRows, 10);

  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [editingMatrixEntry, setEditingMatrixEntry] = useState(null);
  const [matrixFormData, setMatrixFormData] = useState({
    docType: 'SOP',
    nameTh: '',
    minRequesterLevel: 1,
    requiredReviewerLevel: 4,
    requiredApproverLevel: 6,
    requireAckDefault: true,
    description: ''
  });

  // Access Control: Only DCC Admin or Super Admin
  const isAdmin = currentUser?.isDcc || currentUser?.role === 'DCC_ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  // Fallback dept list
  const departmentsList = useMemo(() => {
    if (masterDepartments && masterDepartments.length > 0) return masterDepartments;
    if (storeDepts && storeDepts.length > 0) {
      return storeDepts.map(d => ({
        id: d,
        nameTh: d,
        nameEn: d,
        headName: 'Department Head'
      }));
    }
    return [
      { id: 'QA', nameTh: 'ฝ่ายประกันและควบคุมคุณภาพ', nameEn: 'Quality Assurance & Control', headName: 'ธนาวุฒิ สมควรกิจดำรง' },
      { id: 'PD', nameTh: 'ฝ่ายผลิต', nameEn: 'Production Department', headName: 'มนัสวีร์ ขจรศักดิ์' },
      { id: 'EN', nameTh: 'ฝ่ายวิศวกรรม', nameEn: 'Engineering Department', headName: 'วิศวกรรมการผลิต' },
      { id: 'WH', nameTh: 'ฝ่ายคลังสินค้า', nameEn: 'Warehouse Department', headName: 'คลังสินค้าและจัดส่ง' },
      { id: 'HR', nameTh: 'ฝ่ายทรัพยากรบุคคล', nameEn: 'Human Resources', headName: 'ทรัพยากรบุคคล' }
    ];
  }, [masterDepartments, storeDepts]);

  const allCopies = useMemo(() => {
    return (controlledCopyInstances && controlledCopyInstances.length > 0) 
      ? controlledCopyInstances 
      : (documentControlledCopies || []);
  }, [controlledCopyInstances, documentControlledCopies]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (locDeptDropdownRef.current && !locDeptDropdownRef.current.contains(event.target)) {
        setIsLocDeptDropdownOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsLocDeptDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // If unauthorized, render Access Denied Card
  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 border border-rose-200 shadow-none max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mx-auto">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-bold text-[#1E1E1E]">การเข้าถึงถูกปฏิเสธ (Access Denied)</h2>
          <p className="text-sm text-[#666666]">
            ระบบสงวนสิทธิ์การเข้าใช้งานศูนย์ข้อมูลหลัก (Master Data Management Hub) ให้เฉพาะเจ้าหน้าที่ควบคุมเอกสาร (DCC Admin) หรือ Super Admin เท่านั้น
          </p>
          <button
            onClick={() => navigate('/portal')}
            className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl text-sm hover:bg-slate-800 transition-colors"
          >
            กลับสู่หน้าหลัก (Portal Home)
          </button>
        </div>
      </div>
    );
  }

  // --- TAB 1 HANDLERS (Users) ---
  const filteredUsers = (masterUsers || []).filter(u => {
    const matchSearch = (u.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.id || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.empId || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.position || '').toLowerCase().includes(userSearch.toLowerCase());
    const matchDept = !userDeptFilter || u.department === userDeptFilter || (u.depts && u.depts.includes(userDeptFilter));
    const matchRole = !userRoleFilter || u.role === userRoleFilter || (userRoleFilter === 'DCC_ADMIN' && u.isDcc);
    return matchSearch && matchDept && matchRole;
  });

  const userPagination = useTablePagination(filteredUsers, 50);

  const handleOpenUserModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUserFormData({
        name: user.name,
        empId: user.empId || '',
        email: user.email || '',
        department: user.department || user.depts?.[0] || 'QA',
        position: user.position || '',
        role: user.role || (user.isDcc ? 'DCC_ADMIN' : 'GENERAL_USER'),
        level: user.level || 1
      });
    } else {
      setEditingUser(null);
      setUserFormData({
        name: '',
        empId: '',
        email: '',
        department: 'QA',
        position: 'Staff',
        role: 'GENERAL_USER',
        level: 1
      });
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e) => {
    e.preventDefault();
    if (!userFormData.name.trim()) {
      toast.error('กรุณาระบุชื่อ-นามสกุล');
      return;
    }

    try {
      if (editingUser) {
        updateMasterUser(editingUser.id, userFormData);
        toast.success(`อัปเดตข้อมูลผู้ใช้ "${userFormData.name}" เรียบร้อยแล้ว`);
      } else {
        addMasterUser(userFormData);
        toast.success(`เพิ่มผู้ใช้งาน "${userFormData.name}" เรียบร้อยแล้ว`);
      }
      setIsUserModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  // --- TAB 2 HANDLERS (Departments) ---
  const filteredDepartments = departmentsList.filter(d => {
    return (d.id || '').toLowerCase().includes(deptSearch.toLowerCase()) ||
      (d.nameTh || d.name || '').toLowerCase().includes(deptSearch.toLowerCase()) ||
      (d.nameEn || '').toLowerCase().includes(deptSearch.toLowerCase()) ||
      (d.headName || '').toLowerCase().includes(deptSearch.toLowerCase());
  });

  const handleOpenDeptModal = (dept = null) => {
    if (dept) {
      setEditingDept(dept);
      setDeptFormData({
        id: dept.id,
        nameTh: dept.nameTh || dept.name || '',
        nameEn: dept.nameEn || '',
        headUserId: dept.headUserId || ''
      });
    } else {
      setEditingDept(null);
      setDeptFormData({
        id: '',
        nameTh: '',
        nameEn: '',
        headUserId: ''
      });
    }
    setIsDeptModalOpen(true);
  };

  const handleSaveDept = (e) => {
    e.preventDefault();
    if (!deptFormData.id.trim() || !deptFormData.nameTh.trim()) {
      toast.error('กรุณากรอกรหัสแผนกและชื่อภาษาไทย');
      return;
    }

    const headUser = (masterUsers || []).find(u => u.id === deptFormData.headUserId);
    const payload = {
      ...deptFormData,
      id: deptFormData.id.toUpperCase(),
      name: deptFormData.nameTh,
      headName: headUser ? headUser.name : (editingDept?.headName || 'ยังไม่ได้กำหนด')
    };

    try {
      if (editingDept) {
        updateDepartment(editingDept.id, payload);
        toast.success(`อัปเดตแผนก "${payload.id}" เรียบร้อยแล้ว`);
      } else {
        addDepartment(payload);
        toast.success(`เพิ่มแผนก "${payload.id}" เรียบร้อยแล้ว`);
      }
      setIsDeptModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาด');
    }
  };

  // --- TAB 3 HANDLERS (Document Types) ---
  const filteredDocTypes = (documentTypes || []).filter(t => {
    return (t.code || t.id || '').toLowerCase().includes(typeSearch.toLowerCase()) ||
      (t.nameTh || '').toLowerCase().includes(typeSearch.toLowerCase()) ||
      (t.name || '').toLowerCase().includes(typeSearch.toLowerCase());
  });

  const docTypePagination = useTablePagination(filteredDocTypes, 10);

  const handleOpenTypeModal = (type = null) => {
    if (type) {
      setEditingType(type);
      const isExt = type.category === 'EXTERNAL' || type.code === 'ED';
      setTypeFormData({
        code: type.code || type.id,
        nameTh: type.nameTh || '',
        name: type.name || '',
        namingPattern: type.namingPattern || '',
        is_form_type: Boolean(type.is_form_type),
        category: type.category || (isExt ? 'EXTERNAL' : 'INTERNAL'),
        allowDar: type.allowDar !== undefined ? type.allowDar : !isExt,
        reviewCycleMonths: type.reviewCycleMonths || 12,
        retentionPeriodYears: type.retentionPeriodYears || 3,
        description: type.description || ''
      });
    } else {
      setEditingType(null);
      setTypeFormData({
        code: '',
        nameTh: '',
        name: '',
        namingPattern: '{Type}-{Dept}-{##}',
        is_form_type: false,
        category: 'INTERNAL',
        allowDar: true,
        reviewCycleMonths: 12,
        retentionPeriodYears: 3,
        description: ''
      });
    }
    setIsTypeModalOpen(true);
  };

  const handleSaveType = (e) => {
    e.preventDefault();
    if (!typeFormData.code.trim() || !typeFormData.nameTh.trim()) {
      toast.error('กรุณากรอกรหัสประเภทและชื่อประเภทเอกสาร');
      return;
    }

    const payload = {
      ...typeFormData,
      code: typeFormData.code.toUpperCase(),
      name: typeFormData.name || typeFormData.nameTh
    };

    try {
      if (editingType) {
        updateDocumentType(editingType.code || editingType.id, payload);
        toast.success(`อัปเดตประเภทเอกสาร "${payload.code}" เรียบร้อยแล้ว`);
      } else {
        addDocumentType(payload);
        toast.success(`เพิ่มประเภทเอกสาร "${payload.code}" เรียบร้อยแล้ว`);
      }
      setIsTypeModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาด');
    }
  };

  // --- TAB 4 HANDLERS (Distribution Locations) ---
  const stationCountByDept = useMemo(() => {
    const counts = {};
    (distributionLocations || []).forEach(loc => {
      const dept = loc.departmentId || loc.department || 'PD';
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return counts;
  }, [distributionLocations]);

  const filteredDeptOptions = useMemo(() => {
    const query = locDeptSearchText.trim().toLowerCase();
    if (!query) return departmentsList;
    return departmentsList.filter(d => 
      (d.id || '').toLowerCase().includes(query) ||
      (d.nameTh || '').toLowerCase().includes(query) ||
      (d.nameEn || '').toLowerCase().includes(query) ||
      (d.name || '').toLowerCase().includes(query)
    );
  }, [departmentsList, locDeptSearchText]);

  const filteredLocations = (distributionLocations || []).filter(l => {
    const dept = l.departmentId || l.department || '';
    const matchDept = selectedLocDept === 'ALL' || dept === selectedLocDept;
    const matchSearch = (l.name || '').toLowerCase().includes(locSearch.toLowerCase()) ||
      (l.id || '').toLowerCase().includes(locSearch.toLowerCase()) ||
      (l.code || '').toLowerCase().includes(locSearch.toLowerCase()) ||
      (l.description || '').toLowerCase().includes(locSearch.toLowerCase());
    return matchDept && matchSearch;
  });

  const locationPagination = useTablePagination(filteredLocations, 10);

  const handleOpenLocModal = (loc = null) => {
    if (loc) {
      setEditingLoc(loc);
      setLocFormData({
        id: loc.id,
        code: loc.code || loc.id,
        name: loc.name,
        departmentId: loc.departmentId || 'PD',
        description: loc.description || '',
        isMasterOffice: Boolean(loc.isMasterOffice)
      });
    } else {
      setEditingLoc(null);
      setLocFormData({
        id: '',
        code: '',
        name: '',
        departmentId: selectedLocDept !== 'ALL' ? selectedLocDept : 'PD',
        description: '',
        isMasterOffice: false
      });
    }
    setIsLocModalOpen(true);
  };

  const handleSaveLoc = (e) => {
    e.preventDefault();
    if (!locFormData.name.trim() || !locFormData.departmentId) {
      toast.error('กรุณาระบุชื่อสถานีปฏิบัติงานและเลือกแผนก');
      return;
    }

    try {
      if (editingLoc) {
        updateDistributionLocation(editingLoc.id, locFormData);
        toast.success(`อัปเดตจุดใช้งาน "${locFormData.name}" เรียบร้อยแล้ว`);
      } else {
        addDistributionLocation(locFormData);
        toast.success(`เพิ่มจุดใช้งาน "${locFormData.name}" เรียบร้อยแล้ว`);
      }
      setIsLocModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDeleteLoc = (locId) => {
    try {
      deleteDistributionLocation(locId);
      toast.success('ลบจุดใช้งานเรียบร้อยแล้ว');
    } catch (err) {
      setOrphanWarningModal({
        isOpen: true,
        message: err.message
      });
    }
  };

  // --- TAB 5 HANDLERS (Security & 21 CFR Part 11 Digital Signature) ---
  const handleSaveSecuritySettings = (e) => {
    e.preventDefault();
    updateSignatureSettings(secForm);
    toast.success('บันทึกการตั้งค่านโยบายความปลอดภัยและ E-Signature สำเร็จ');
  };

  const handleOpenSignatureModal = (user) => {
    setSelectedUserForSignature(user);
    setSignatureFormData({
      signatureType: user.signatureType || 'TYPOGRAPHIC',
      signatureStyle: user.signatureStyle || 'BRUSH_SCRIPT',
      signatureInitials: user.signatureInitials || (user.name ? user.name.split(' ').map(n => n[0]).join('') : 'SIG'),
      signatureImage: user.signatureImage || '',
      certificateSerial: user.certificateSerial || `CERT-2026-${(user.department || 'QA').replace('/', '')}${user.id || '000'}`
    });
    setIsSignatureModalOpen(true);
  };

  const handleSaveSignatureProfile = (e) => {
    e.preventDefault();
    if (!selectedUserForSignature) return;

    try {
      updateUserSignatureProfile(selectedUserForSignature.id, signatureFormData);
      toast.success(`อัปเดตโปรไฟล์ลายเซ็นของ "${selectedUserForSignature.name}" เรียบร้อยแล้ว`);
      setIsSignatureModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการบันทึกโปรไฟล์ลายเซ็น');
    }
  };

  const handleOpenStampSimulator = (user) => {
    setStampSimulatorUser(user);
    setStampSimulatorRole('APPROVER');
    setIsStampSimulatorModalOpen(true);
  };

  // Filtered Users for Tab 5 Signature Directory
  const filteredSigUsers = useMemo(() => {
    return (masterUsers || []).filter(u => {
      const matchSearch = (u.name || '').toLowerCase().includes(sigUserSearch.toLowerCase()) ||
        (u.empId || '').toLowerCase().includes(sigUserSearch.toLowerCase()) ||
        (u.id || '').toLowerCase().includes(sigUserSearch.toLowerCase()) ||
        (u.position || '').toLowerCase().includes(sigUserSearch.toLowerCase()) ||
        (u.department || '').toLowerCase().includes(sigUserSearch.toLowerCase());

      const matchDept = sigDeptFilter === 'ALL' || u.department === sigDeptFilter || (u.depts && u.depts.includes(sigDeptFilter));

      let matchStatus = true;
      if (sigStatusFilter === 'REGISTERED') matchStatus = Boolean(u.hasRegisteredSignature);
      else if (sigStatusFilter === 'PENDING') matchStatus = !u.hasRegisteredSignature;
      else if (sigStatusFilter === 'LOCKED') matchStatus = Boolean(u.isLocked);

      return matchSearch && matchDept && matchStatus;
    });
  }, [masterUsers, sigUserSearch, sigDeptFilter, sigStatusFilter]);

  const sigUserPagination = useTablePagination(filteredSigUsers, 10);

  // --- TAB 6 HANDLERS (SLA & Approval Matrix Settings) ---
  const handleAdjustSla = (field, delta) => {
    setSlaForm(prev => {
      const current = Number(prev[field]) || 1;
      const updated = Math.max(1, Math.min(30, current + delta));
      return { ...prev, [field]: updated };
    });
  };

  const handleOpenMatrixModal = (entry) => {
    setEditingMatrixEntry(entry);
    const code = entry.docType || entry.code || entry.doc_type || 'SOP';
    const matchedType = (documentTypes || []).find(t => (t.code || t.id) === code);
    setMatrixFormData({
      docType: code,
      nameTh: entry.nameTh || entry.name || matchedType?.nameTh || matchedType?.name || entry.description || code,
      minRequesterLevel: entry.minRequesterLevel ?? entry.min_requester_level ?? 1,
      requiredReviewerLevel: entry.requiredReviewerLevel ?? entry.required_reviewer_level ?? 4,
      requiredApproverLevel: entry.requiredApproverLevel ?? entry.required_approver_level ?? (code === 'QM' ? 8 : code === 'SOP' ? 6 : 5),
      requireAckDefault: entry.requireAckDefault ?? entry.require_ack_default ?? false,
      description: entry.description || matchedType?.description || ''
    });
    setIsMatrixModalOpen(true);
  };

  const handleSaveMatrixEntry = (e) => {
    e.preventDefault();
    if (!matrixFormData.docType) return;
    if (matrixFormData.requiredApproverLevel < matrixFormData.requiredReviewerLevel) {
      toast.error('ระดับผู้อนุมัติขั้นสุดท้าย (Approver Level) ต้องไม่ต่ำกว่าระดับผู้ทบทวน (Reviewer Level)');
      return;
    }
    updateApprovalMatrixEntry(matrixFormData.docType, matrixFormData);
    toast.success(`อัปเดตสายการอนุมัติสำหรับ ${matrixFormData.docType} เรียบร้อยแล้ว`);
    setIsMatrixModalOpen(false);
  };

  const handleSaveSlaSettings = (e) => {
    e.preventDefault();
    updateSlaSettings(slaForm);
    toast.success('บันทึกกำหนดเวลา SLA เรียบร้อยแล้ว');
  };

  const handleSaveAllSlaAndMatrix = (e) => {
    e.preventDefault();
    updateSlaSettings(slaForm);
    toast.success('บันทึกการตั้งค่าสายการอนุมัติและ SLAs เรียบร้อยแล้ว');
  };

  const getMatrixLevelBadge = (level, label = '') => {
    const lvlNum = Number(level) || 1;
    let colorClass = 'bg-slate-100 text-slate-700 border-slate-200';
    let roleText = 'Staff / Operator';

    if (lvlNum === 1) { colorClass = 'bg-slate-100 text-slate-700 border-slate-200'; roleText = 'ทุกคน / Staff'; }
    else if (lvlNum === 2) { colorClass = 'bg-slate-100 text-slate-700 border-slate-200'; roleText = 'Officer'; }
    else if (lvlNum === 3) { colorClass = 'bg-sky-50 text-sky-700 border-sky-200'; roleText = 'Senior Staff'; }
    else if (lvlNum === 4) { colorClass = 'bg-blue-50 text-blue-700 border-blue-200'; roleText = 'Supervisor'; }
    else if (lvlNum === 5) { colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-200'; roleText = 'Asst. Mgr / Lead'; }
    else if (lvlNum === 6) { colorClass = 'bg-purple-50 text-purple-700 border-purple-200'; roleText = 'General Manager'; }
    else if (lvlNum === 7) { colorClass = 'bg-amber-50 text-amber-800 border-amber-200'; roleText = 'Director'; }
    else if (lvlNum >= 8) { colorClass = 'bg-rose-50 text-rose-800 border-rose-200'; roleText = 'MD / กรรมการ'; }

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border font-mono ${colorClass}`}>
        <span>L{lvlNum}+</span>
        <span className="font-sans font-medium text-[11px] opacity-90 hidden sm:inline">({label || roleText})</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 w-full max-w-full overflow-hidden">
      {/* 1. Minimalist Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dcc/dashboard')}
            className="action-icon-btn text-[#666666] hover:text-[#1E1E1E] shrink-0 h-11 w-11 rounded-xl"
            title="กลับ Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E1E1E] leading-tight">
              ศูนย์กลางจัดการข้อมูลหลัก (Master Data Management Hub)
            </h1>
            <p className="text-sm text-[#666666] mt-1 font-normal">
              จัดการโครงสร้างข้อมูลพื้นฐานของระบบคุณภาพ ISO 9001 / FSSC 22000
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => {
              seedComprehensiveQaMockData();
              toast.success('โหลดชุดข้อมูลจำลอง QA Workflow (DARs, Tasks, สำเนาควบคุม) เรียบร้อยแล้ว');
            }}
            className="px-3.5 py-1.5 rounded-full text-xs font-bold text-[#0D99FF] bg-[#E5F4FF] hover:bg-[#D1EFFF] border border-[#B8E1FF] transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="โหลดชุดข้อมูลจำลองคำร้อง QA ครบทุก Flow สำหรับ Manual Testing"
          >
            <Sparkles size={13} className="text-[#0D99FF]" />
            <span>โหลด Mock Data (QA)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCleanSlateModalOpen(true)}
            className="px-3.5 py-1.5 rounded-full text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="ล้างข้อมูลจำลองเชิงธุรกรรมทั้งหมด เพื่อเริ่มทดสอบแบบ Clean Slate (คง Master Data ไว้ 100%)"
          >
            <RotateCcw size={13} className="text-rose-600" />
            <span>ล้างข้อมูลเพื่อเริ่มทดสอบใหม่ (Clean Slate)</span>
          </button>

          <span className="bg-[#F5F5F5] text-slate-700 text-xs font-bold px-3.5 py-1.5 rounded-full border border-[#E5E5E5]/80 inline-flex items-center gap-2 font-mono shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            DCC ADMIN CENTER
          </span>
        </div>
      </div>

      {/* 2. Segmented Pill Floating Tabs (6 หมวดหมู่) */}
      <div className="bg-[#F5F5F5]/80 p-1.5 rounded-xl flex gap-1.5 border border-[#E5E5E5]/60 overflow-x-auto scrollbar-none">
        {[
          { id: 'users', label: '1. ผู้ใช้งานและสิทธิ์', icon: Users, count: (masterUsers || []).length },
          { id: 'departments', label: '2. แผนกและโครงสร้าง', icon: Building2, count: departmentsList.length },
          { id: 'docTypes', label: '3. ประเภทเอกสารและรหัส', icon: FileCode, count: (documentTypes || []).length },
          { id: 'locations', label: '4. จุดใช้งานและไลน์ผลิต', icon: MapPin, count: (distributionLocations || []).length },
          { id: 'security', label: '5. ลายมือชื่อและความปลอดภัย', icon: KeyRound },
          { id: 'sla', label: '6. สายการอนุมัติและ SLAs', icon: Clock }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm transition-all whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-white text-[#1E1E1E] shadow-xs'
                  : 'text-[#666666] hover:text-[#1E1E1E] hover:bg-white/50'
              }`}
            >
              <Icon size={17} className={isActive ? 'text-[#0D99FF]' : 'text-slate-400'} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full font-bold ${
                  isActive ? 'bg-[#E5F4FF] text-[#007BE5]' : 'bg-slate-200/70 text-[#666666]'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content Container */}
      <div className="w-full max-w-full overflow-hidden">
        {/* ================= TAB 1: USERS & ROLES ================= */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Unified Action Toolbar */}
            <div className="card-surface p-4 flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto flex-1 min-w-0">
                <div className="relative flex-1 min-w-[220px]">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="ค้นหาชื่อ, รหัสพนักงาน, อีเมล, ตำแหน่ง..."
                    className="w-full pl-10 pr-4 py-2 text-xs bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl focus:bg-white focus:border-[#0D99FF] outline-none transition-all"
                  />
                </div>

                <select
                  value={userDeptFilter}
                  onChange={(e) => setUserDeptFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl outline-none"
                >
                  <option value="">ทุกแผนก (All Depts)</option>
                  {departmentsList.map(d => (
                    <option key={d.id} value={d.id}>{d.id} - {d.nameTh || d.name}</option>
                  ))}
                </select>

                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl outline-none"
                >
                  <option value="">ทุกบทบาท (All Roles)</option>
                  <option value="DCC_ADMIN">DCC Admin</option>
                  <option value="DEPT_ADMIN">Dept Admin / Manager</option>
                  <option value="GENERAL_USER">General User</option>
                </select>
              </div>

              <button
                onClick={() => handleOpenUserModal()}
                className="btn-primary text-xs shrink-0 whitespace-nowrap"
              >
                <Plus size={15} /> เพิ่มผู้ใช้งานใหม่ (Add User)
              </button>
            </div>

            {/* Users Elevated Table */}
            <div className="w-full max-w-full overflow-hidden bg-white border border-[#E2E8F0] rounded-xl shadow-2xs flex flex-col min-h-0">
              <div className="overflow-x-auto overflow-y-auto max-h-[560px] w-full max-w-full scrollbar-thin">
                <table className="w-full text-left text-xs table-auto min-w-[960px] border-collapse">
                  <thead className="bg-[#F8FAFC] text-slate-700 font-bold text-xs uppercase tracking-wider border-b border-[#E2E8F0] whitespace-nowrap sticky top-0 z-10 shadow-xs backdrop-blur-sm">
                    <tr>
                      <th className="px-4 py-3.5 min-w-[240px] bg-[#F8FAFC]">ชื่อ-นามสกุล / อีเมล</th>
                      <th className="px-4 py-3.5 w-28 whitespace-nowrap bg-[#F8FAFC]">แผนก</th>
                      <th className="px-4 py-3.5 min-w-[140px] whitespace-nowrap bg-[#F8FAFC]">ตำแหน่งงาน</th>
                      <th className="px-4 py-3.5 text-center w-32 whitespace-nowrap bg-[#F8FAFC]">บทบาท (Role)</th>
                      <th className="px-4 py-3.5 text-center w-28 whitespace-nowrap bg-[#F8FAFC]">ระดับอนุมัติ</th>
                      <th className="px-4 py-3.5 text-center w-28 whitespace-nowrap bg-[#F8FAFC]">สถานะ</th>
                      <th className="px-4 py-3.5 text-right w-36 whitespace-nowrap bg-[#F8FAFC]">การจัดการ (Actions)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {userPagination.paginatedData.map(user => (
                      <tr key={user.id} className="hover:bg-[#F8FAFC]/80 transition-colors">
                        <td className="px-4 py-3 min-w-[240px]">
                          <div className="font-bold text-[#1E1E1E] flex items-center gap-2 text-sm sm:text-[15px]">
                            <span>{user.name}</span>
                            {user.isLocked && (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs rounded-md font-bold">LOCKED</span>
                            )}
                          </div>
                          <div className="text-slate-400 text-xs font-mono mt-0.5">
                            {user.empId || user.id} • {user.email}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">
                          <span className="px-2.5 py-1 bg-[#F5F5F5] rounded-lg text-slate-700 font-mono text-xs font-bold">
                            {user.department || user.depts?.[0]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs sm:text-sm">
                          {user.position || '-'}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            user.role === 'DCC_ADMIN' || user.isDcc
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : user.role === 'DEPT_ADMIN'
                              ? 'bg-[#E5F4FF] text-[#007BE5] border border-[#E5F4FF]'
                              : 'bg-[#F5F5F5] text-slate-700'
                          }`}>
                            {user.role || (user.isDcc ? 'DCC_ADMIN' : 'GENERAL_USER')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className="px-2.5 py-1 bg-[#E5F4FF] text-[#007BE5] font-mono font-bold rounded-lg border border-indigo-100 text-xs">
                            Level {user.level}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => toggleUserStatus(user.id)}
                            className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-all ${
                              user.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-[#F5F5F5] text-slate-400 border border-[#E5E5E5] hover:bg-slate-200'
                            }`}
                          >
                            {user.status === 'ACTIVE' ? '🟢 Active' : '⚪ Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenUserModal(user)}
                              className="action-icon-btn text-[#666666] hover:text-[#0D99FF] hover:bg-[#E5F4FF] cursor-pointer"
                              title="แก้ไขข้อมูลผู้ใช้"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => {
                                resetUserPassword(user.id);
                                toast.success(`รีเซ็ตรหัสผ่านของ ${user.name} เรียบร้อยแล้ว`);
                              }}
                              className="action-icon-btn text-[#666666] hover:text-amber-600 hover:bg-amber-50"
                              title="รีเซ็ตรหัสผ่านเริ่มต้น"
                            >
                              <RotateCcw size={14} />
                            </button>
                            {user.isLocked && (
                              <button
                                onClick={() => {
                                  unlockUserAccount(user.id);
                                  toast.success(`ปลดล็อกบัญชี ${user.name} เรียบร้อยแล้ว`);
                                }}
                                className="action-icon-btn text-emerald-600 hover:bg-emerald-50"
                                title="ปลดล็อกบัญชี"
                              >
                                <Unlock size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          ไม่พบข้อมูลผู้ใช้งานที่ค้นหา
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <TablePagination
                currentPage={userPagination.currentPage}
                totalItems={userPagination.totalItems}
                pageSize={userPagination.pageSize}
                onPageChange={userPagination.setCurrentPage}
                onPageSizeChange={userPagination.setPageSize}
              />
            </div>
          </div>
        )}

        {/* ================= TAB 2: DEPARTMENTS ================= */}
        {activeTab === 'departments' && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="card-surface p-4 flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full min-w-0">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={deptSearch}
                  onChange={(e) => setDeptSearch(e.target.value)}
                  placeholder="ค้นหารหัสแผนก หรือชื่อภาษาไทย/อังกฤษ..."
                  className="w-full pl-10 pr-4 py-2 text-xs bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl focus:bg-white focus:border-[#0D99FF] outline-none transition-all"
                />
              </div>

              <button
                onClick={() => handleOpenDeptModal()}
                className="btn-primary text-xs shrink-0 whitespace-nowrap"
              >
                <Plus size={15} /> เพิ่มแผนกใหม่ (Add Department)
              </button>
            </div>

            {/* Departments Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDepartments.map(dept => {
                const docCount = (documents || []).filter(d => d.department === dept.id || d.owner_dept === dept.id).length;
                const copyCount = allCopies.filter(c => c.holder_dept === dept.id || c.department === dept.id).length;

                return (
                  <div 
                    key={dept.id}
                    className="card-surface p-5 hover:border-[#E5E5E5] hover:shadow-sm transition-all space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 bg-[#0D99FF] text-white font-mono font-bold text-xs rounded-lg shadow-2xs">
                          {dept.id}
                        </span>
                        <button
                          onClick={() => toggleDepartmentStatus(dept.id)}
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            dept.status !== 'INACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-[#F5F5F5] text-slate-400 border border-[#E5E5E5]'
                          }`}
                        >
                          {dept.status !== 'INACTIVE' ? '🟢 Active' : '⚪ Inactive'}
                        </button>
                      </div>

                      <div>
                        <h3 className="font-bold text-[#1E1E1E] text-base break-words">
                          {dept.nameTh || dept.name}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5 break-words">
                          {dept.nameEn || dept.name}
                        </p>
                      </div>

                      <div className="p-3 bg-[#F5F5F5]/70 border border-slate-100 rounded-xl text-xs space-y-1">
                        <span className="text-[#666666] font-medium block text-xs">หัวหน้าแผนก / ผู้ลงนามมาตรฐาน:</span>
                        <span className="font-bold text-slate-800 block break-words text-sm">
                          {dept.headName || 'ยังไม่ได้กำหนด'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-[#F5F5F5] text-slate-700 rounded-lg font-medium text-xs" title="เอกสารแม่บทที่แผนกนี้เป็นเจ้าของ">
                          📄 {docCount} เอกสาร
                        </span>
                        <span className="px-2.5 py-1 bg-[#E5F4FF] text-[#007BE5] rounded-lg font-medium text-xs" title="สำเนาควบคุมที่ติดตั้งในแผนกนี้">
                          📋 {copyCount} เล่มสำเนา
                        </span>
                      </div>

                      <button
                        onClick={() => handleOpenDeptModal(dept)}
                        className="action-icon-btn text-[#666666] hover:text-[#0D99FF] hover:bg-[#E5F4FF]"
                        title="แก้ไขข้อมูลแผนก"
                      >
                        <Edit size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TAB 3: DOCUMENT TYPES ================= */}
        {activeTab === 'docTypes' && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="card-surface p-4 flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full min-w-0">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={typeSearch}
                  onChange={(e) => setTypeSearch(e.target.value)}
                  placeholder="ค้นหารหัสประเภทเอกสาร เช่น QM, SOP, WI, FM..."
                  className="w-full pl-10 pr-4 py-2 text-xs bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl focus:bg-white focus:border-[#0D99FF] outline-none transition-all"
                />
              </div>

              <button
                onClick={() => handleOpenTypeModal()}
                className="btn-primary text-xs shrink-0 whitespace-nowrap"
              >
                <Plus size={15} /> เพิ่มประเภทเอกสาร (Add Document Type)
              </button>
            </div>

            {/* Types Table */}
            <div className="w-full max-w-full overflow-hidden bg-white border border-[#E2E8F0] rounded-xl shadow-2xs flex flex-col min-h-0">
              <div className="overflow-x-auto overflow-y-auto max-h-[560px] w-full max-w-full scrollbar-thin">
                <table className="w-full text-left text-xs table-auto min-w-[960px] border-collapse">
                  <thead className="bg-[#F8FAFC] text-slate-700 font-bold text-xs uppercase tracking-wider border-b border-[#E2E8F0] whitespace-nowrap sticky top-0 z-10 shadow-xs backdrop-blur-sm">
                    <tr>
                      <th className="px-4 py-3.5 w-28 font-mono bg-[#F8FAFC]">Type Code</th>
                      <th className="px-4 py-3.5 min-w-[220px] bg-[#F8FAFC]">ชื่อประเภทเอกสาร</th>
                      <th className="px-4 py-3.5 min-w-[180px] font-mono bg-[#F8FAFC]">รูปแบบการตั้งรหัส (Pattern)</th>
                      <th className="px-4 py-3.5 text-center w-32 whitespace-nowrap bg-[#F8FAFC]">ขอบเขต & DAR</th>
                      <th className="px-4 py-3.5 text-center w-36 whitespace-nowrap bg-[#F8FAFC]">Clean Form Bypass</th>
                      <th className="px-4 py-3.5 text-center w-28 whitespace-nowrap bg-[#F8FAFC]">รอบทบทวน</th>
                      <th className="px-4 py-3.5 text-center w-28 whitespace-nowrap bg-[#F8FAFC]">อายุจัดเก็บ</th>
                      <th className="px-4 py-3.5 text-center w-28 whitespace-nowrap bg-[#F8FAFC]">สถานะ</th>
                      <th className="px-4 py-3.5 text-right w-24 whitespace-nowrap bg-[#F8FAFC]">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {docTypePagination.paginatedData.map(type => (
                      <tr key={type.code || type.id} className="hover:bg-[#F8FAFC]/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-[#007BE5] whitespace-nowrap">
                          {type.code || type.id}
                        </td>
                        <td className="px-4 py-3 min-w-[220px]">
                          <div className="font-bold text-[#1E1E1E] text-sm sm:text-[15px]">
                            {type.nameTh || type.name}
                          </div>
                          <div className="text-slate-400 text-xs mt-0.5">
                            {type.description || type.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                          <span className="bg-[#F5F5F5] px-2.5 py-1 rounded-lg border border-[#E5E5E5] font-bold text-xs">
                            {type.namingPattern || `${type.code}-{Dept}-{##}`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {(type.allowDar !== false && type.category !== 'EXTERNAL' && type.code !== 'ED') ? (
                            <span className="px-2.5 py-1 bg-[#E5F4FF] text-[#007BE5] font-bold rounded-full border border-[#E5F4FF] text-xs inline-flex items-center gap-1 shadow-2xs">
                              📑 ภายใน (DAR)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-bold rounded-full border border-amber-200 text-xs inline-flex items-center gap-1 shadow-2xs">
                              🌐 ภายนอก (External)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {type.is_form_type ? (
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-full border border-emerald-200 text-xs">
                              ✅ Clean Bypass
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-[#F5F5F5] text-[#666666] rounded-full text-xs">
                              Watermark Normal
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap font-medium text-slate-700 text-xs sm:text-sm">
                          ทุก {type.reviewCycleMonths || 12} เดือน
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap font-medium text-slate-700 text-xs sm:text-sm">
                          {type.retentionPeriodYears || 3} ปี
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => toggleDocumentTypeStatus(type.code || type.id)}
                            className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-all ${
                              type.status !== 'INACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-[#F5F5F5] text-slate-400 border border-[#E5E5E5]'
                            }`}
                          >
                            {type.status !== 'INACTIVE' ? '🟢 Active' : '⚪ Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleOpenTypeModal(type)}
                            className="action-icon-btn text-[#666666] hover:text-[#0D99FF] hover:bg-[#E5F4FF] cursor-pointer"
                            title="แก้ไขประเภทเอกสาร"
                          >
                            <Edit size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {docTypePagination.paginatedData.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                          ไม่พบข้อมูลประเภทเอกสารที่ค้นหา
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <TablePagination
                currentPage={docTypePagination.currentPage}
                totalItems={docTypePagination.totalItems}
                pageSize={docTypePagination.pageSize}
                onPageChange={docTypePagination.setCurrentPage}
                onPageSizeChange={docTypePagination.setPageSize}
              />
            </div>
          </div>
        )}

        {/* ================= TAB 4: LOCATIONS MATRIX ================= */}
        {activeTab === 'locations' && (
          <div className="space-y-4">
            {/* Unified Enterprise Search & Filter Toolbar (Figma UI3 Toolbar Pattern) */}
            <div className="card-surface p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Left Section: Search Input + Searchable Department Combobox + Clear Filters */}
              <div className="flex flex-1 flex-wrap items-center gap-2.5 min-w-0">
                {/* Station Free-text Search Field */}
                <div className="relative flex-1 min-w-[200px] sm:min-w-[240px]">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={locSearch}
                    onChange={(e) => setLocSearch(e.target.value)}
                    placeholder="ค้นหาชื่อจุดใช้งาน, รหัสสถานีปฏิบัติงาน..."
                    className="w-full h-10.5 pl-10 pr-9 py-2 text-xs sm:text-sm bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl focus:bg-white focus:border-[#0D99FF] outline-none transition-all placeholder:text-slate-400 font-normal"
                  />
                  {locSearch && (
                    <button
                      type="button"
                      onClick={() => setLocSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors"
                      title="ล้างคำค้นหา"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Searchable Department Combobox / Autocomplete Dropdown */}
                <div className="relative shrink-0" ref={locDeptDropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsLocDeptDropdownOpen(prev => !prev);
                      setLocDeptSearchText('');
                    }}
                    className={`h-10.5 px-3.5 rounded-xl border transition-all text-xs sm:text-sm font-medium flex items-center justify-between gap-2.5 min-w-[200px] sm:w-64 md:w-72 bg-white ${
                      isLocDeptDropdownOpen ? 'border-[#0D99FF] ring-2 ring-[#0D99FF]/10' : 'border-[#E5E5E5] hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <Building2 size={15} className="text-[#0D99FF] shrink-0" />
                      <span className="truncate text-slate-800 font-medium">
                        {selectedLocDept === 'ALL'
                          ? 'ทุกแผนก (All Departments)'
                          : `${selectedLocDept} — ${departmentsList.find(d => d.id === selectedLocDept)?.nameTh || departmentsList.find(d => d.id === selectedLocDept)?.name || selectedLocDept}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {selectedLocDept !== 'ALL' && (
                        <span className="px-1.5 py-0.5 rounded-md bg-[#E5F4FF] text-[#007BE5] font-mono text-[11px] font-bold">
                          {stationCountByDept[selectedLocDept] || 0}
                        </span>
                      )}
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${isLocDeptDropdownOpen ? 'rotate-180 text-[#0D99FF]' : ''}`} />
                    </div>
                  </button>

                  {/* Dropdown Popover */}
                  {isLocDeptDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 bg-white border border-[#E5E5E5] rounded-xl shadow-lg z-30 p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          autoFocus
                          value={locDeptSearchText}
                          onChange={(e) => setLocDeptSearchText(e.target.value)}
                          placeholder="พิมพ์ค้นหาชื่อ/รหัสแผนก..."
                          className="w-full pl-8 pr-7 py-1.5 bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg text-xs font-medium outline-none focus:bg-white focus:border-[#0D99FF]"
                        />
                        {locDeptSearchText && (
                          <button
                            type="button"
                            onClick={() => setLocDeptSearchText('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      <div className="max-h-56 overflow-y-auto space-y-0.5 scrollbar-thin">
                        {/* All Departments Option */}
                        {(!locDeptSearchText || 'ทุกแผนก all departments'.includes(locDeptSearchText.toLowerCase())) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLocDept('ALL');
                              setIsLocDeptDropdownOpen(false);
                            }}
                            className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium text-left flex items-center justify-between transition-colors ${
                              selectedLocDept === 'ALL'
                                ? 'bg-[#E5F4FF] text-[#007BE5] font-bold'
                                : 'text-slate-700 hover:bg-[#F5F5F5]'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span>ทุกแผนก (All Departments)</span>
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {(distributionLocations || []).length} จุด
                            </span>
                          </button>
                        )}

                        {filteredDeptOptions.map(dept => {
                          const count = stationCountByDept[dept.id] || 0;
                          const isSelected = selectedLocDept === dept.id;
                          return (
                            <button
                              key={dept.id}
                              type="button"
                              onClick={() => {
                                setSelectedLocDept(dept.id);
                                setIsLocDeptDropdownOpen(false);
                              }}
                              className={`w-full px-2.5 py-2 rounded-lg text-xs text-left flex items-center justify-between transition-colors ${
                                isSelected
                                  ? 'bg-[#E5F4FF] text-[#007BE5] font-bold'
                                  : 'text-slate-700 hover:bg-[#F5F5F5]'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 truncate">
                                <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px]">
                                  {dept.id}
                                </span>
                                <span className="truncate">{dept.nameTh || dept.name || dept.nameEn}</span>
                              </div>
                              <span className={`text-[11px] font-mono shrink-0 ${isSelected ? 'text-[#007BE5] font-bold' : 'text-slate-400'}`}>
                                {count} จุด
                              </span>
                            </button>
                          );
                        })}

                        {filteredDeptOptions.length === 0 && (
                          <div className="py-4 text-center text-xs text-slate-400">
                            ไม่พบแผนกที่ค้นหา
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Clear Filters Button */}
                {(selectedLocDept !== 'ALL' || locSearch.trim() !== '') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLocDept('ALL');
                      setLocSearch('');
                      setLocDeptSearchText('');
                    }}
                    className="h-10.5 px-3.5 rounded-xl border border-[#E5E5E5] bg-white text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                    title="ล้างตัวกรองและคำค้นหาทั้งหมด"
                  >
                    <RotateCcw size={13} className="text-slate-400 group-hover:text-rose-600" />
                    <span>ล้างตัวกรอง</span>
                  </button>
                )}
              </div>

              {/* Right Section: Counter Badge + Primary Action Button */}
              <div className="flex items-center gap-3 shrink-0 self-end lg:self-auto flex-wrap justify-end">
                <div 
                  data-testid="station-count-badge"
                  className="text-xs font-mono font-semibold text-[#64748B] px-3 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]/80 whitespace-nowrap"
                >
                  พบ <strong className="text-[#1E1E1E]">{filteredLocations.length}</strong> จาก {(distributionLocations || []).length} จุด
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenLocModal()}
                  className="h-10.5 px-4 rounded-xl bg-[#0D99FF] text-white hover:bg-[#007BE5] font-semibold text-xs sm:text-sm shadow-2xs transition-all flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  <Plus size={16} />
                  <span>เพิ่มจุดใช้งานใหม่ (Add Location)</span>
                </button>
              </div>
            </div>

            {/* Locations Elevated Table */}
            <div className="w-full max-w-full overflow-hidden bg-white border border-[#E2E8F0] rounded-xl shadow-2xs flex flex-col min-h-0">
              <div className="overflow-x-auto overflow-y-auto max-h-[560px] w-full max-w-full scrollbar-thin">
                <table className="w-full text-left text-xs table-auto min-w-[980px] border-collapse">
                  <thead className="bg-[#F8FAFC] text-slate-700 font-bold text-xs uppercase tracking-wider border-b border-[#E2E8F0] whitespace-nowrap sticky top-0 z-10 shadow-xs backdrop-blur-sm">
                    <tr>
                      <th className="px-4 py-3.5 w-28 whitespace-nowrap bg-[#F8FAFC]">แผนก</th>
                      <th className="px-4 py-3.5 w-32 font-mono whitespace-nowrap bg-[#F8FAFC]">Location ID</th>
                      <th className="px-4 py-3.5 min-w-[260px] bg-[#F8FAFC]">ชื่อจุดใช้งานหน้างาน (Point of Use / Station)</th>
                      <th className="px-4 py-3.5 text-center w-36 whitespace-nowrap bg-[#F8FAFC]">Master Lock (Copy 01)</th>
                      <th className="px-4 py-3.5 text-center w-32 whitespace-nowrap bg-[#F8FAFC]">สำเนาควบคุมผูกอยู่</th>
                      <th className="px-4 py-3.5 text-center w-28 whitespace-nowrap bg-[#F8FAFC]">สถานะ</th>
                      <th className="px-4 py-3.5 text-right w-28 whitespace-nowrap bg-[#F8FAFC]">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {locationPagination.paginatedData.map(loc => {
                      const activeCopies = allCopies.filter(c => 
                        (c.location_id === loc.id || c.locationId === loc.id || c.location === loc.name) &&
                        (c.status === 'ISSUED_ACTIVE' || c.status === 'ACTIVE' || c.status === 'PENDING_ISSUE' || c.status === 'DISPATCHED_PENDING_RECEIPT')
                      );

                      return (
                        <tr key={loc.id} className="hover:bg-[#F8FAFC]/80 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">
                            <span className="px-2.5 py-1 bg-[#F5F5F5] rounded-lg text-slate-700 font-mono text-xs font-bold">
                              {loc.departmentId}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-[#007BE5] whitespace-nowrap">
                            {loc.id}
                          </td>
                          <td className="px-4 py-3 min-w-[260px]">
                            <div className="font-bold text-[#1E1E1E] text-sm sm:text-[15px]">
                              {loc.name}
                            </div>
                            {loc.description && (
                              <div className="text-slate-400 text-xs mt-0.5">
                                {loc.description}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {loc.isMasterOffice ? (
                              <span className="bg-amber-50 text-amber-700 border border-amber-200/70 text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1 shadow-2xs">
                                <Crown size={14} className="text-amber-600" /> Master Station
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                              activeCopies.length > 0
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-[#F5F5F5] text-slate-400'
                            }`}>
                              {activeCopies.length} เล่ม
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => toggleLocationStatus(loc.id)}
                              className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-all ${
                                loc.status !== 'INACTIVE'
                                   ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-[#F5F5F5] text-slate-400 border border-[#E5E5E5]'
                              }`}
                            >
                              {loc.status !== 'INACTIVE' ? '🟢 Active' : '⚪ Inactive'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenLocModal(loc)}
                                className="action-icon-btn text-[#666666] hover:text-[#0D99FF] hover:bg-[#E5F4FF] cursor-pointer"
                                title="แก้ไขจุดใช้งาน"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteLoc(loc.id)}
                                className="action-icon-btn text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title="ลบจุดใช้งาน"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {locationPagination.paginatedData.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center space-y-2 max-w-sm mx-auto">
                            <div className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center text-slate-400">
                              <MapPin size={20} />
                            </div>
                            <p className="text-sm font-bold text-slate-700">ไม่พบจุดใช้งานตรงตามเงื่อนไขที่ค้นหา</p>
                            <p className="text-xs text-slate-400">
                              ลองเปลี่ยนคำค้นหา หรือกดปุ่มล้างตัวกรองเพื่อแสดงจุดใช้งานทั้งหมด
                            </p>
                            {(selectedLocDept !== 'ALL' || locSearch.trim() !== '') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedLocDept('ALL');
                                  setLocSearch('');
                                  setLocDeptSearchText('');
                                }}
                                className="mt-2 px-3 py-1.5 rounded-lg bg-[#E5F4FF] text-[#007BE5] text-xs font-semibold hover:bg-[#D1EFFF] transition-colors"
                              >
                                ล้างตัวกรองทั้งหมด
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <TablePagination
                currentPage={locationPagination.currentPage}
                totalItems={locationPagination.totalItems}
                pageSize={locationPagination.pageSize}
                onPageChange={locationPagination.setCurrentPage}
                onPageSizeChange={locationPagination.setPageSize}
              />
            </div>
          </div>
        )}

        {/* ================= TAB 5: E-SIGNATURES & 21 CFR PART 11 SECURITY ================= */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* 1. Compliance Master Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-slate-700/60 shadow-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#0D99FF]/20 text-[#0D99FF] border border-[#0D99FF]/40 font-mono">
                      21 CFR Part 11 Compliant
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                      ISO 9001:2015 Clause 7.5
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                      ISO 13485:2016 Certified
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    สถาปัตยกรรมลายมือชื่ออิเล็กทรอนิกส์และความปลอดภัย (Digital Signatures & Security Architecture)
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
                    ระบบควบคุมความสมบูรณ์ของลายเซ็นดิจิทัล (Digital Signature Manifest), เจตจำนงการลงนาม (Signing Intent), การประทับเวลาที่ตรวจสอบย้อนกลับได้ (Audit Trail Timestamp), และการเข้ารหัสยืนยันตัวตนระดับบุคคลตามมาตรฐานสากล
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const sampleUser = (masterUsers || [])[0] || currentUser;
                      handleOpenStampSimulator(sampleUser);
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#0D99FF] hover:bg-[#007BE5] text-white transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <Eye size={16} />
                    <span>ทดสอบประทับตราจำลอง (Stamp Simulator)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Main 2-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Global Security & E-Signature Policy Engine (5 Cols) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="card-surface p-5 sm:p-6 space-y-5">
                  <div className="flex items-center gap-3 pb-3.5 border-b border-slate-100">
                    <div className="p-2.5 bg-[#E5F4FF] text-[#0D99FF] rounded-xl shrink-0">
                      <Lock size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1E1E1E] text-sm sm:text-base">นโยบายความปลอดภัย E-Signature</h3>
                      <p className="text-xs text-slate-400">21 CFR Part 11 Security & Authentication Policies</p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveSecuritySettings} className="space-y-4.5 text-xs">
                    {/* PIN Security Group */}
                    <div className="space-y-3 p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                      <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <KeyRound size={14} className="text-[#0D99FF]" />
                        <span>นโยบายรหัสผ่าน Signing PIN</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">ความยาว PIN (หลัก):</label>
                          <input
                            type="number"
                            min="4"
                            max="8"
                            value={secForm.pinLength}
                            onChange={(e) => setSecForm({ ...secForm, pinLength: parseInt(e.target.value) || 6 })}
                            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg focus:border-[#0D99FF] outline-none text-sm font-mono font-bold"
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">จำนวนครั้งผิดสูงสุด:</label>
                          <input
                            type="number"
                            min="3"
                            max="10"
                            value={secForm.maxFailedAttempts}
                            onChange={(e) => setSecForm({ ...secForm, maxFailedAttempts: parseInt(e.target.value) || 3 })}
                            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg focus:border-[#0D99FF] outline-none text-sm font-mono font-bold"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">PIN เริ่มต้นเมื่อสร้าง/รีเซ็ต (Default PIN):</label>
                        <input
                          type="text"
                          value={secForm.defaultPin}
                          onChange={(e) => setSecForm({ ...secForm, defaultPin: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg font-mono focus:border-[#0D99FF] outline-none text-sm font-bold tracking-wider"
                        />
                      </div>
                    </div>

                    {/* 21 CFR Part 11 Toggles */}
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-emerald-600" />
                        <span>เกณฑ์การบังคับใช้ตามมาตรฐาน 21 CFR Part 11</span>
                      </div>

                      <div className="space-y-2.5">
                        {/* Toggle 1: Require Reason */}
                        <label className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-[#F8FAFC] transition-colors cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(secForm.requireReasonForSigning)}
                            onChange={(e) => setSecForm({ ...secForm, requireReasonForSigning: e.target.checked })}
                            className="mt-0.5 w-4 h-4 rounded text-[#0D99FF] focus:ring-[#0D99FF]"
                          />
                          <div className="flex-1 min-w-0 text-xs">
                            <span className="font-bold text-slate-800 block">บังคับระบุเจตจำนงการลงนาม (Meaning / Intent)</span>
                            <span className="text-[11px] text-slate-500">ระบุบทบาทและวัตถุประสงค์ (ผู้ยื่น / ผู้ตรวจทาน / ผู้อนุมัติ / ผู้รับทราบ) ในตราประทับ</span>
                          </div>
                        </label>

                        {/* Toggle 2: Re-Authentication */}
                        <label className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-[#F8FAFC] transition-colors cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(secForm.requireReAuthentication)}
                            onChange={(e) => setSecForm({ ...secForm, requireReAuthentication: e.target.checked })}
                            className="mt-0.5 w-4 h-4 rounded text-[#0D99FF] focus:ring-[#0D99FF]"
                          />
                          <div className="flex-1 min-w-0 text-xs">
                            <span className="font-bold text-slate-800 block">บังคับยืนยันตัวตนด้วย Signing PIN ทุกการอนุมัติ</span>
                            <span className="text-[11px] text-slate-500">ป้องกันการลงนามค้างไว้จากเซสชันเบราว์เซอร์โดยไม่ตั้งใจ</span>
                          </div>
                        </label>

                        {/* Toggle 3: Timestamp Authority */}
                        <label className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-[#F8FAFC] transition-colors cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(secForm.enableTimestampAuthority)}
                            onChange={(e) => setSecForm({ ...secForm, enableTimestampAuthority: e.target.checked })}
                            className="mt-0.5 w-4 h-4 rounded text-[#0D99FF] focus:ring-[#0D99FF]"
                          />
                          <div className="flex-1 min-w-0 text-xs">
                            <span className="font-bold text-slate-800 block">ประทับเวลา Bangkok Timezone & Cryptographic Hash</span>
                            <span className="text-[11px] text-slate-500">สร้าง Checksum SHA-256 เพื่อตรวจสอบความถูกต้องของเอกสาร</span>
                          </div>
                        </label>

                        {/* Toggle 4: Dual Sign-Off */}
                        <label className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-[#F8FAFC] transition-colors cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(secForm.dualSignOffOnObsolete)}
                            onChange={(e) => setSecForm({ ...secForm, dualSignOffOnObsolete: e.target.checked })}
                            className="mt-0.5 w-4 h-4 rounded text-[#0D99FF] focus:ring-[#0D99FF]"
                          />
                          <div className="flex-1 min-w-0 text-xs">
                            <span className="font-bold text-slate-800 block">บังคับลงนามคู่สำหรับการขอยกเลิกเอกสาร (Dual Sign-Off)</span>
                            <span className="text-[11px] text-slate-500">ต้องได้รับการอนุมัติร่วมจากหัวหน้าแผนกและ DCC ก่อนยกเลิก</span>
                          </div>
                        </label>

                        {/* Toggle 5: Immutable Audit Trail */}
                        <label className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-[#F8FAFC] transition-colors cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(secForm.auditTrailLogging)}
                            onChange={(e) => setSecForm({ ...secForm, auditTrailLogging: e.target.checked })}
                            className="mt-0.5 w-4 h-4 rounded text-[#0D99FF] focus:ring-[#0D99FF]"
                          />
                          <div className="flex-1 min-w-0 text-xs">
                            <span className="font-bold text-slate-800 block">บันทึก Audit Trail แบบแก้ไขไม่ได้ (Immutable Log)</span>
                            <span className="text-[11px] text-slate-500">บันทึกทุกเหตุการณ์การลงนามเข้าสู่ระบบ System Action Log</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Stamp Format Preset */}
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">รูปแบบตราประทับเริ่มต้น (Stamp Preset):</label>
                      <select
                        value={secForm.signatureStampFormat || 'STANDARD_WITH_METADATA'}
                        onChange={(e) => setSecForm({ ...secForm, signatureStampFormat: e.target.value })}
                        className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl font-medium outline-none text-xs"
                      >
                        <option value="STANDARD_WITH_METADATA">มาตรฐานสากล: ลายเซ็น + ชื่อ + ตำแหน่ง + เจตจำนง + เวลา + Hash</option>
                        <option value="FORMAL_BOXED_STAMP">กรอบทางการ: ตราประทับคู่พร้อมรหัสใบรับรอง (Formal Quality Seal)</option>
                        <option value="MINIMAL_LEAN">กะทัดรัด: ลายเซ็นและชื่อพร้อมวันที่ 2 บรรทัด (Minimal Lean)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 mt-2 text-sm cursor-pointer"
                    >
                      <Save size={15} /> บันทึกนโยบายความปลอดภัย
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column: User Digital Signature Directory & Profile Management (7 Cols) */}
              <div className="lg:col-span-7 card-surface p-5 sm:p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-[#1E1E1E] text-sm sm:text-base flex items-center gap-2">
                      <PenTool size={18} className="text-[#0D99FF]" />
                      <span>ไดเรกทอรีลายเซ็นและโปรไฟล์ความปลอดภัยรายบุคคล</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      จัดการรูปแบบลายเซ็นดิจิทัล, ใบรับรองอิเล็กทรอนิกส์, และสถานะ Signing PIN
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="px-2.5 py-1 bg-[#E5F4FF] text-[#0D99FF] rounded-lg font-bold">
                      {(masterUsers || []).filter(u => u.hasRegisteredSignature !== false).length} / {(masterUsers || []).length} Registered
                    </span>
                  </div>
                </div>

                {/* Toolbar Filters */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={sigUserSearch}
                      onChange={(e) => setSigUserSearch(e.target.value)}
                      placeholder="ค้นหาชื่อ, รหัส, แผนก..."
                      className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:bg-white focus:border-[#0D99FF] outline-none"
                    />
                  </div>

                  <select
                    value={sigDeptFilter}
                    onChange={(e) => setSigDeptFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl font-medium outline-none"
                  >
                    <option value="ALL">ทุกแผนก</option>
                    {departmentsList.map(d => (
                      <option key={d.id} value={d.id}>{d.id}</option>
                    ))}
                  </select>

                  <select
                    value={sigStatusFilter}
                    onChange={(e) => setSigStatusFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl font-medium outline-none"
                  >
                    <option value="ALL">ทุกสถานะ</option>
                    <option value="REGISTERED">ลงทะเบียนแล้ว</option>
                    <option value="PENDING">ยังไม่ตั้งค่า</option>
                    <option value="LOCKED">บัญชีถูกล็อก</option>
                  </select>
                </div>

                {/* User Directory Table */}
                <div className="overflow-hidden border border-[#E2E8F0] rounded-xl flex flex-col min-h-0 bg-white shadow-2xs">
                  <div className="overflow-x-auto overflow-y-auto max-h-[480px] scrollbar-thin">
                    <table className="w-full text-left text-xs table-auto border-collapse">
                      <thead className="bg-[#F8FAFC] text-slate-700 font-bold uppercase tracking-wider sticky top-0 border-b border-[#E2E8F0] z-10 shadow-xs backdrop-blur-sm">
                        <tr>
                          <th className="px-4 py-3 min-w-[160px] bg-[#F8FAFC]">ผู้ใช้งาน & สังกัด</th>
                          <th className="px-3 py-3 min-w-[140px] bg-[#F8FAFC]">รูปแบบลายเซ็น (Asset)</th>
                          <th className="px-3 py-3 text-center w-28 whitespace-nowrap bg-[#F8FAFC]">สถานะ PIN</th>
                          <th className="px-3 py-3 text-center w-24 whitespace-nowrap bg-[#F8FAFC]">บัญชี</th>
                          <th className="px-4 py-3 text-right w-44 whitespace-nowrap bg-[#F8FAFC]">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {sigUserPagination.paginatedData.map(u => {
                          const styleLabel = u.signatureStyle === 'FORMAL_SERIF' ? 'Formal Serif' :
                            u.signatureStyle === 'MODERN_SANS' ? 'Modern Sans' :
                            u.signatureStyle === 'CLASSIC_CALLIGRAPHY' ? 'Calligraphy' : 'Brush Script';

                          return (
                            <tr key={u.id} className="hover:bg-[#F8FAFC] transition-colors">
                              <td className="px-4 py-3 align-middle">
                                <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                                  <span>{u.name}</span>
                                  {u.role === 'DCC_ADMIN' && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#0D99FF]/10 text-[#0D99FF]">DCC</span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                                  <span>{u.empId || u.id}</span>
                                  <span>•</span>
                                  <span className="font-semibold text-slate-600">{u.department}</span>
                                  {u.position && <span>• {u.position}</span>}
                                </div>
                              </td>

                              <td className="px-3 py-3 align-middle">
                                <div className="space-y-1">
                                  <div className="h-7 px-2.5 bg-slate-50 border border-slate-200/80 rounded-md flex items-center justify-center font-serif italic text-slate-800 text-xs truncate max-w-[150px] shadow-2xs">
                                    {u.signatureInitials || u.name}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                      {styleLabel}
                                    </span>
                                    <span className="text-[10px] text-emerald-600 font-bold">
                                      ✓ Active
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td className="px-3 py-3 text-center align-middle whitespace-nowrap font-mono">
                                <div className="text-xs font-bold text-slate-700">
                                  {u.failedPinAttempts || 0} / {secForm.maxFailedAttempts}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {u.failedPinAttempts > 0 ? 'กรอกผิดสะสม' : 'ปกติ'}
                                </div>
                              </td>

                              <td className="px-3 py-3 text-center align-middle whitespace-nowrap">
                                {u.isLocked ? (
                                  <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-bold rounded-lg text-[11px] border border-rose-200 inline-flex items-center gap-1">
                                    <Lock size={10} /> Locked
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-lg text-[11px] inline-flex items-center gap-1">
                                    <CheckCircle2 size={10} /> OK
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3 text-right align-middle whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSignatureModal(u)}
                                    className="px-2 py-1 bg-[#E5F4FF] hover:bg-[#D1EFFF] text-[#0D99FF] rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                    title="ตั้งค่าโปรไฟล์ลายเซ็นดิจิทัล"
                                  >
                                    <PenTool size={12} />
                                    <span>ตั้งค่า</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenStampSimulator(u)}
                                    className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                    title="ทดสอบตราประทับ"
                                  >
                                    <Eye size={14} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      resetUserPin(u.id);
                                      toast.success(`รีเซ็ต PIN ของ ${u.name} เป็น ${secForm.defaultPin} สำเร็จ`);
                                    }}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                    title="รีเซ็ต PIN กลับเป็นค่าเริ่มต้น"
                                  >
                                    Reset PIN
                                  </button>

                                  {u.isLocked && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        unlockUserAccount(u.id);
                                        toast.success(`ปลดล็อกบัญชี ${u.name} สำเร็จ`);
                                      }}
                                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                    >
                                      Unlock
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {sigUserPagination.paginatedData.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-xs">
                              ไม่พบรายชื่อผู้ใช้งานตามเงื่อนไขที่ค้นหา
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <TablePagination
                    currentPage={sigUserPagination.currentPage}
                    totalItems={sigUserPagination.totalItems}
                    pageSize={sigUserPagination.pageSize}
                    onPageChange={sigUserPagination.setCurrentPage}
                    onPageSizeChange={sigUserPagination.setPageSize}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 6: APPROVAL MATRIX & SLAS ================= */}
        {activeTab === 'sla' && (
          <div className="space-y-6">
            {/* ส่วนที่ 1: กำหนดกรอบเวลาการปฏิบัติงาน (SLA Timelines) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#E5F4FF] text-[#0D99FF] flex items-center justify-center font-bold">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#1E1E1E]">ส่วนที่ 1: กำหนดกรอบเวลาการปฏิบัติงาน (SLA Timelines)</h2>
                    <p className="text-xs text-[#666666]">กำหนดจำนวนวันทำการสูงสุดสำหรับการดำเนินการในแต่ละขั้นตอนตามมาตรฐาน ISO 9001</p>
                  </div>
                </div>
              </div>

              {/* Compact SLA Metric Cards with Stepper Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Card 1: Review SLA */}
                <div className="card-surface p-4 border border-[#E5E5E5]/80 hover:border-[#0D99FF]/40 rounded-2xl transition-all flex flex-col justify-between space-y-3 bg-white shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#0D99FF] font-bold text-xs sm:text-sm">
                      <Clock size={15} />
                      <span>1. ทบทวนคำขอ (Review SLA)</span>
                    </div>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-[#E5F4FF] text-[#007BE5]">
                      Review
                    </span>
                  </div>

                  {/* Compact Stepper & Number Input */}
                  <div className="flex items-center gap-2 justify-center py-1 bg-[#F8FAFC] p-2 rounded-xl border border-[#E2E8F0]/80">
                    <button
                      type="button"
                      onClick={() => handleAdjustSla('reviewSlaDays', -1)}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-bold text-base flex items-center justify-center transition-colors shadow-2xs border border-[#E2E8F0] cursor-pointer"
                      title="ลดจำนวนวัน"
                    >
                      -
                    </button>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={slaForm.reviewSlaDays}
                        onChange={(e) => setSlaForm({ ...slaForm, reviewSlaDays: parseInt(e.target.value) || 1 })}
                        className="w-12 h-7 text-center text-base font-bold font-mono text-[#1E1E1E] bg-white border border-[#E2E8F0] rounded-lg focus:border-[#0D99FF] outline-none"
                      />
                      <span className="text-xs text-slate-500 font-medium whitespace-nowrap">วันทำการ</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdjustSla('reviewSlaDays', 1)}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-bold text-base flex items-center justify-center transition-colors shadow-2xs border border-[#E2E8F0] cursor-pointer"
                      title="เพิ่มจำนวนวัน"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-500 text-center leading-snug">
                    สำหรับผู้ทบทวนประจำแผนกในการตรวจทาน DAR
                  </div>
                </div>

                {/* Card 2: Approve SLA */}
                <div className="card-surface p-4 border border-[#E5E5E5]/80 hover:border-emerald-500/40 rounded-2xl transition-all flex flex-col justify-between space-y-3 bg-white shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs sm:text-sm">
                      <ShieldCheck size={15} />
                      <span>2. อนุมัติเอกสาร (Approve SLA)</span>
                    </div>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                      Approve
                    </span>
                  </div>

                  {/* Compact Stepper & Number Input */}
                  <div className="flex items-center gap-2 justify-center py-1 bg-[#F8FAFC] p-2 rounded-xl border border-[#E2E8F0]/80">
                    <button
                      type="button"
                      onClick={() => handleAdjustSla('approvalSlaDays', -1)}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-bold text-base flex items-center justify-center transition-colors shadow-2xs border border-[#E2E8F0] cursor-pointer"
                      title="ลดจำนวนวัน"
                    >
                      -
                    </button>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={slaForm.approvalSlaDays}
                        onChange={(e) => setSlaForm({ ...slaForm, approvalSlaDays: parseInt(e.target.value) || 1 })}
                        className="w-12 h-7 text-center text-base font-bold font-mono text-[#1E1E1E] bg-white border border-[#E2E8F0] rounded-lg focus:border-emerald-500 outline-none"
                      />
                      <span className="text-xs text-slate-500 font-medium whitespace-nowrap">วันทำการ</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdjustSla('approvalSlaDays', 1)}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-bold text-base flex items-center justify-center transition-colors shadow-2xs border border-[#E2E8F0] cursor-pointer"
                      title="เพิ่มจำนวนวัน"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-500 text-center leading-snug">
                    สำหรับผู้อนุมัติขั้นสุดท้าย (Dept Head / General Manager)
                  </div>
                </div>

                {/* Card 3: Receipt SLA */}
                <div className="card-surface p-4 border border-[#E5E5E5]/80 hover:border-amber-500/40 rounded-2xl transition-all flex flex-col justify-between space-y-3 bg-white shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-600 font-bold text-xs sm:text-sm">
                      <Layers size={15} />
                      <span>3. ตรวจรับเล่ม (Receipt SLA)</span>
                    </div>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-amber-50 text-amber-700">
                      Receipt
                    </span>
                  </div>

                  {/* Compact Stepper & Number Input */}
                  <div className="flex items-center gap-2 justify-center py-1 bg-[#F8FAFC] p-2 rounded-xl border border-[#E2E8F0]/80">
                    <button
                      type="button"
                      onClick={() => handleAdjustSla('hardcopyReceiptSlaDays', -1)}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-bold text-base flex items-center justify-center transition-colors shadow-2xs border border-[#E2E8F0] cursor-pointer"
                      title="ลดจำนวนวัน"
                    >
                      -
                    </button>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={slaForm.hardcopyReceiptSlaDays}
                        onChange={(e) => setSlaForm({ ...slaForm, hardcopyReceiptSlaDays: parseInt(e.target.value) || 1 })}
                        className="w-12 h-7 text-center text-base font-bold font-mono text-[#1E1E1E] bg-white border border-[#E2E8F0] rounded-lg focus:border-amber-500 outline-none"
                      />
                      <span className="text-xs text-slate-500 font-medium whitespace-nowrap">วันทำการ</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdjustSla('hardcopyReceiptSlaDays', 1)}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-bold text-base flex items-center justify-center transition-colors shadow-2xs border border-[#E2E8F0] cursor-pointer"
                      title="เพิ่มจำนวนวัน"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-500 text-center leading-snug">
                    สำหรับผู้ถือสำเนาประจำจุดตรวจสอบและยืนยันรับเล่มจริง
                  </div>
                </div>

                {/* Card 4: Recall SLA */}
                <div className="card-surface p-4 border border-[#E5E5E5]/80 hover:border-rose-500/40 rounded-2xl transition-all flex flex-col justify-between space-y-3 bg-white shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-600 font-bold text-xs sm:text-sm">
                      <RotateCcw size={15} />
                      <span>4. เรียกคืนและทำลาย (Recall SLA)</span>
                    </div>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-rose-50 text-rose-700">
                      Recall
                    </span>
                  </div>

                  {/* Compact Stepper & Number Input */}
                  <div className="flex items-center gap-2 justify-center py-1 bg-[#F8FAFC] p-2 rounded-xl border border-[#E2E8F0]/80">
                    <button
                      type="button"
                      onClick={() => handleAdjustSla('recallSlaDays', -1)}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-bold text-base flex items-center justify-center transition-colors shadow-2xs border border-[#E2E8F0] cursor-pointer"
                      title="ลดจำนวนวัน"
                    >
                      -
                    </button>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={slaForm.recallSlaDays}
                        onChange={(e) => setSlaForm({ ...slaForm, recallSlaDays: parseInt(e.target.value) || 1 })}
                        className="w-12 h-7 text-center text-base font-bold font-mono text-[#1E1E1E] bg-white border border-[#E2E8F0] rounded-lg focus:border-rose-500 outline-none"
                      />
                      <span className="text-xs text-slate-500 font-medium whitespace-nowrap">วันทำการ</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdjustSla('recallSlaDays', 1)}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-bold text-base flex items-center justify-center transition-colors shadow-2xs border border-[#E2E8F0] cursor-pointer"
                      title="เพิ่มจำนวนวัน"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-500 text-center leading-snug">
                    สำหรับ DCC จัดเก็บเล่มเดิมที่ยกเลิกเพื่อนำไปทำลาย
                  </div>
                </div>
              </div>
            </div>

            {/* ส่วนที่ 2: ผังเมทริกซ์สายการอนุมัติตามประเภทเอกสาร (Approval Matrix by Doc Type) */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Sliders size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#1E1E1E]">ส่วนที่ 2: ผังเมทริกซ์สายการอนุมัติตามประเภทเอกสาร (Approval Routing Matrix by Doc Type)</h2>
                    <p className="text-xs text-[#666666]">กำหนดระดับตำแหน่งขั้นต่ำ (Min Level) ของผู้ยื่น, ผู้ทบทวน, และผู้อนุมัติสำหรับเอกสารแต่ละประเภท</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-lg text-xs border border-indigo-200/70 inline-flex items-center gap-1.5 shadow-2xs">
                    <CheckCircle2 size={13} className="text-indigo-600" />
                    <span>เชื่อมโยงจาก Tab 3 (Single Source of Truth)</span>
                  </span>
                </div>
              </div>

              {/* Elevated Matrix Table with Visual Workflow Pipeline */}
              <div className="w-full max-w-full overflow-hidden bg-white border border-[#E2E8F0] rounded-xl shadow-2xs flex flex-col min-h-0">
                <div className="overflow-x-auto overflow-y-auto max-h-[560px] w-full max-w-full scrollbar-thin">
                  <table className="w-full text-left text-xs table-auto min-w-[920px] border-collapse">
                    <thead className="bg-[#F8FAFC] text-slate-700 font-bold text-xs uppercase tracking-wider border-b border-[#E2E8F0] whitespace-nowrap sticky top-0 z-10 shadow-xs backdrop-blur-sm">
                      <tr>
                        <th className="px-4 py-3.5 w-60 bg-[#F8FAFC]">ประเภทเอกสาร (Doc Type)</th>
                        <th className="px-4 py-3.5 min-w-[460px] bg-[#F8FAFC]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>สายการอนุมัติ (Workflow Pipeline:</span>
                            <span className="text-[11px] font-semibold text-slate-500 normal-case">ระดับผู้ยื่นขั้นต่ำ</span>
                            <span className="text-slate-400">➔</span>
                            <span className="text-[11px] font-semibold text-[#0D99FF] normal-case">ระดับผู้ทบทวน (Reviewer)</span>
                            <span className="text-slate-400">➔</span>
                            <span className="text-[11px] font-semibold text-indigo-600 normal-case">ระดับผู้อนุมัติ (Approver)</span>
                            <span>)</span>
                          </div>
                        </th>
                        <th className="px-4 py-3.5 text-center w-36 whitespace-nowrap bg-[#F8FAFC]">การรับทราบ (Default Ack)</th>
                        <th className="px-4 py-3.5 text-right w-28 whitespace-nowrap bg-[#F8FAFC]">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {approvalMatrixPagination.paginatedData.map((item) => {
                        const code = item.code || item.docType || item.doc_type;
                        const minReq = item.minRequesterLevel ?? item.min_requester_level ?? 1;
                        const reqRev = item.requiredReviewerLevel ?? item.required_reviewer_level ?? 4;
                        const reqApp = item.requiredApproverLevel ?? item.required_approver_level ?? 6;
                        const isAck = item.requireAckDefault ?? item.require_ack_default ?? false;

                        return (
                          <tr key={code} className="hover:bg-[#F8FAFC]/80 transition-colors">
                            {/* Document Type Column */}
                            <td className="px-4 py-3.5 align-middle">
                              <div className="flex items-center gap-2.5">
                                <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-[#E5F4FF] text-[#007BE5] border border-[#B8E1FF] shadow-2xs">
                                  {code}
                                </span>
                                <div className="min-w-0">
                                  <div className="font-bold text-sm text-slate-800 truncate">{item.name || code}</div>
                                  {item.description && item.description !== item.name && (
                                    <div className="text-[11px] text-slate-400 truncate max-w-[220px]">{item.description}</div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Visual Workflow Pipeline Column (1. Requester ➔ 2. Reviewer ➔ 3. Approver) */}
                            <td className="px-4 py-3.5 align-middle">
                              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                {/* Step 1: Requester */}
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] font-mono text-xs font-semibold shadow-2xs whitespace-nowrap">
                                  <span className="text-[10px] uppercase font-bold text-slate-500 font-sans">1. ผู้ยื่น:</span>
                                  <span className="font-bold text-slate-800">L{minReq}+</span>
                                  <span className="text-[11px] text-slate-600 font-sans font-normal opacity-90">({minReq === 1 ? 'ทุกคน' : 'Sup+'})</span>
                                </div>

                                <span className="text-slate-400 font-bold shrink-0">➔</span>

                                {/* Step 2: Reviewer */}
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#E5F4FF] text-[#007BE5] border border-[#B8E1FF] font-mono text-xs font-semibold shadow-2xs whitespace-nowrap">
                                  <span className="text-[10px] uppercase font-bold text-[#0D99FF] font-sans">2. ผู้ทบทวน:</span>
                                  <span className="font-bold text-[#007BE5]">L{reqRev}+</span>
                                  <span className="text-[11px] text-[#007BE5] font-sans font-normal opacity-90">({reqRev >= 6 ? 'GM' : reqRev >= 5 ? 'Mgr' : 'Sup'})</span>
                                </div>

                                <span className="text-slate-400 font-bold shrink-0">➔</span>

                                {/* Step 3: Approver */}
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE] font-mono text-xs font-semibold shadow-2xs whitespace-nowrap">
                                  <span className="text-[10px] uppercase font-bold text-indigo-500 font-sans">3. ผู้อนุมัติ:</span>
                                  <span className="font-bold text-[#4F46E5]">L{reqApp}+</span>
                                  <span className="text-[11px] text-[#4F46E5] font-sans font-normal opacity-90">({reqApp >= 8 ? 'MD/กรรมการ' : reqApp >= 6 ? 'GM' : 'Mgr'})</span>
                                </div>
                              </div>
                            </td>

                            {/* Default Ack Column */}
                            <td className="px-4 py-3.5 text-center align-middle whitespace-nowrap">
                              {isAck ? (
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-lg text-[11px] border border-emerald-200 inline-flex items-center gap-1">
                                  <Check size={12} /> บังคับรับทราบ
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 font-medium rounded-lg text-[11px] inline-flex items-center gap-1">
                                  ไม่ต้องรับทราบ
                                </span>
                              )}
                            </td>

                            {/* Action Button */}
                            <td className="px-4 py-3.5 text-right align-middle whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenMatrixModal(item)}
                                className="px-3 py-1.5 bg-[#E5F4FF] hover:bg-[#D1EFFF] text-[#0D99FF] rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                                title={`แก้ไขผังสายการอนุมัติของ ${code}`}
                              >
                                <Edit size={13} />
                                <span>แก้ไข</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {approvalMatrixPagination.paginatedData.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-xs">
                            ไม่พบข้อมูลสายการอนุมัติ
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  currentPage={approvalMatrixPagination.currentPage}
                  totalItems={approvalMatrixPagination.totalItems}
                  pageSize={approvalMatrixPagination.pageSize}
                  onPageChange={approvalMatrixPagination.setCurrentPage}
                  onPageSizeChange={approvalMatrixPagination.setPageSize}
                />
              </div>
            </div>

            {/* Unified Save Card */}
            <div className="card-surface p-5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-[#E5E5E5] rounded-xl shadow-xs">
              <div>
                <h3 className="font-bold text-[#1E1E1E] text-sm">บันทึกการตั้งค่าสายการอนุมัติและ SLAs ทั้งหมด</h3>
                <p className="text-xs text-slate-500 mt-0.5">ระบบจะนำ SLA และ Routing Matrix ที่ตั้งค่าไปใช้คำนวณวันครบกำหนดและคัดเลือกผู้ทบทวน/อนุมัติอัตโนมัติ</p>
              </div>

              <button
                type="button"
                onClick={handleSaveAllSlaAndMatrix}
                className="btn-primary text-xs shrink-0 whitespace-nowrap px-5 py-2.5 flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Save size={16} /> บันทึกการตั้งค่าสายการอนุมัติและ SLAs
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= USER MODAL ================= */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl shadow-none border border-[#E5E5E5] w-full max-w-lg overflow-hidden flex flex-col my-8"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base text-white">
                {editingUser ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่'}
              </h3>
              <button 
                onClick={() => setIsUserModalOpen(false)} 
                className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">ชื่อ-นามสกุล <span className="text-rose-500">*</span>:</label>
                <input
                  type="text"
                  required
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  placeholder="เช่น สมชาย สายผลิต"
                  className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">รหัสพนักงาน (Emp ID):</label>
                  <input
                    type="text"
                    value={userFormData.empId}
                    onChange={(e) => setUserFormData({ ...userFormData, empId: e.target.value })}
                    placeholder="เช่น EMP-015"
                    className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">อีเมล:</label>
                  <input
                    type="email"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    placeholder="user@company.com"
                    className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">สังกัดแผนก:</label>
                  <select
                    value={userFormData.department}
                    onChange={(e) => setUserFormData({ ...userFormData, department: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl"
                  >
                    {departmentsList.map(d => (
                      <option key={d.id} value={d.id}>{d.id} - {d.nameTh || d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">ตำแหน่งงาน:</label>
                  <input
                    type="text"
                    value={userFormData.position}
                    onChange={(e) => setUserFormData({ ...userFormData, position: e.target.value })}
                    placeholder="เช่น Production Supervisor"
                    className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">บทบาทสิทธิ์ (Role):</label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl"
                  >
                    <option value="GENERAL_USER">General User (ผู้ใช้งานทั่วไป)</option>
                    <option value="DEPT_ADMIN">Dept Admin / Reviewer</option>
                    <option value="DCC_ADMIN">DCC Admin (ผู้ควบคุมเอกสาร)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">ระดับอำนาจอนุมัติ (Level):</label>
                  <select
                    value={userFormData.level}
                    onChange={(e) => setUserFormData({ ...userFormData, level: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl"
                  >
                    <option value="1">Level 1: Staff / Operator</option>
                    <option value="2">Level 2: Officer</option>
                    <option value="3">Level 3: Supervisor</option>
                    <option value="4">Level 4: Supervisor (Senior)</option>
                    <option value="5">Level 5: Dept Manager</option>
                    <option value="6">Level 6: General Manager</option>
                    <option value="7">Level 7: Director</option>
                    <option value="8">Level 8: Managing Director</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ================= DEPARTMENT MODAL ================= */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl shadow-none border border-[#E5E5E5] w-full max-w-md overflow-hidden flex flex-col my-8"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base text-white">
                {editingDept ? 'แก้ไขข้อมูลแผนก' : 'เพิ่มแผนกใหม่'}
              </h3>
              <button 
                onClick={() => setIsDeptModalOpen(false)} 
                className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDept} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">รหัสแผนก (Dept Code) <span className="text-rose-500">*</span>:</label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingDept)}
                  value={deptFormData.id}
                  onChange={(e) => setDeptFormData({ ...deptFormData, id: e.target.value.toUpperCase() })}
                  placeholder="เช่น PD, QA, QC, WH, EN..."
                  className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl font-mono uppercase"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">ชื่อแผนกภาษาไทย <span className="text-rose-500">*</span>:</label>
                <input
                  type="text"
                  required
                  value={deptFormData.nameTh}
                  onChange={(e) => setDeptFormData({ ...deptFormData, nameTh: e.target.value })}
                  placeholder="เช่น ฝ่ายผลิต"
                  className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">ชื่อแผนกภาษาอังกฤษ:</label>
                <input
                  type="text"
                  value={deptFormData.nameEn}
                  onChange={(e) => setDeptFormData({ ...deptFormData, nameEn: e.target.value })}
                  placeholder="เช่น Production Department"
                  className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">หัวหน้าแผนก / ผู้มีอำนาจลงนามประจำแผนก:</label>
                <select
                  value={deptFormData.headUserId}
                  onChange={(e) => setDeptFormData({ ...deptFormData, headUserId: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl"
                >
                  <option value="">-- เลือกหัวหน้าแผนก --</option>
                  {(masterUsers || []).map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.department})</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs"
                >
                  บันทึกแผนก
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ================= DOCUMENT TYPE MODAL ================= */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl shadow-none border border-[#E5E5E5] w-full max-w-lg overflow-hidden flex flex-col my-8"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base text-white">
                {editingType ? 'แก้ไขประเภทเอกสาร' : 'เพิ่มประเภทเอกสารใหม่'}
              </h3>
              <button 
                onClick={() => setIsTypeModalOpen(false)} 
                className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveType} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">รหัสประเภท (Type Code) <span className="text-rose-500">*</span>:</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingType)}
                    value={typeFormData.code}
                    onChange={(e) => setTypeFormData({ ...typeFormData, code: e.target.value.toUpperCase() })}
                    placeholder="เช่น SOP, WI, FM..."
                    className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">รูปแบบรหัส (Pattern):</label>
                  <input
                    type="text"
                    value={typeFormData.namingPattern}
                    onChange={(e) => setTypeFormData({ ...typeFormData, namingPattern: e.target.value })}
                    placeholder="{Type}-{Dept}-{##}"
                    className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">ชื่อประเภทภาษาไทย <span className="text-rose-500">*</span>:</label>
                <input
                  type="text"
                  required
                  value={typeFormData.nameTh}
                  onChange={(e) => setTypeFormData({ ...typeFormData, nameTh: e.target.value })}
                  placeholder="เช่น ระเบียบปฏิบัติงาน"
                  className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">หมวดหมู่เอกสาร & สิทธิ์ DAR (Category & DAR Scope) <span className="text-rose-500">*</span>:</label>
                <select
                  value={typeFormData.category || 'INTERNAL'}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setTypeFormData({
                      ...typeFormData,
                      category: cat,
                      allowDar: cat === 'INTERNAL'
                    });
                  }}
                  className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl font-medium"
                >
                  <option value="INTERNAL">เอกสารภายใน (Internal - รองรับการสร้างและเปิดคำร้อง DAR)</option>
                  <option value="EXTERNAL">เอกสารภายนอก (External - ควบคุมผ่านโมดูล ED ไม่ผ่าน DAR)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">รอบเวลาทบทวน (เดือน):</label>
                  <input
                    type="number"
                    min="1"
                    value={typeFormData.reviewCycleMonths}
                    onChange={(e) => setTypeFormData({ ...typeFormData, reviewCycleMonths: parseInt(e.target.value) || 12 })}
                    className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">อายุจัดเก็บ (ปี):</label>
                  <input
                    type="number"
                    min="1"
                    value={typeFormData.retentionPeriodYears}
                    onChange={(e) => setTypeFormData({ ...typeFormData, retentionPeriodYears: parseInt(e.target.value) || 3 })}
                    className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={typeFormData.is_form_type}
                    onChange={(e) => setTypeFormData({ ...typeFormData, is_form_type: e.target.checked })}
                    className="w-4 h-4 text-[#0D99FF] rounded"
                  />
                  <div>
                    <span className="font-bold text-slate-800">เป็นแบบฟอร์มเปล่า (Blank Form Type)</span>
                    <p className="text-xs text-slate-400">ใช้กฎ Form Clean Bypass ไม่ประทับลายน้ำเมื่ออยู่ในสถานะบังคับใช้</p>
                  </div>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTypeModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs"
                >
                  บันทึกประเภทเอกสาร
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ================= LOCATION MODAL ================= */}
      {isLocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl shadow-none border border-[#E5E5E5] w-full max-w-md overflow-hidden flex flex-col my-8"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base text-white">
                {editingLoc ? 'แก้ไขจุดใช้งานหน้างาน' : 'เพิ่มจุดใช้งานใหม่'}
              </h3>
              <button 
                onClick={() => setIsLocModalOpen(false)} 
                className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveLoc} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">สังกัดแผนก <span className="text-rose-500">*</span>:</label>
                <select
                  value={locFormData.departmentId}
                  onChange={(e) => setLocFormData({ ...locFormData, departmentId: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl"
                >
                  {departmentsList.map(d => (
                    <option key={d.id} value={d.id}>{d.id} - {d.nameTh || d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">รหัสจุดใช้งาน (Location ID/Code):</label>
                <input
                  type="text"
                  disabled={Boolean(editingLoc)}
                  value={locFormData.id}
                  onChange={(e) => setLocFormData({ ...locFormData, id: e.target.value, code: e.target.value })}
                  placeholder="เช่น PD-L5 (เว้นว่างเพื่อสร้างอัตโนมัติ)"
                  className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">ชื่อจุดใช้งาน/สถานีปฏิบัติงาน <span className="text-rose-500">*</span>:</label>
                <input
                  type="text"
                  required
                  value={locFormData.name}
                  onChange={(e) => setLocFormData({ ...locFormData, name: e.target.value })}
                  placeholder="เช่น Line 5 - Baking Area 2"
                  className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">คำอธิบายพื้นที่:</label>
                <textarea
                  value={locFormData.description}
                  onChange={(e) => setLocFormData({ ...locFormData, description: e.target.value })}
                  rows={2}
                  placeholder="รายละเอียดจุดติดตั้งเอกสารฉบับควบคุม..."
                  className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl resize-none"
                />
              </div>

              <div className="p-3 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={locFormData.isMasterOffice}
                    onChange={(e) => setLocFormData({ ...locFormData, isMasterOffice: e.target.checked })}
                    className="w-4 h-4 text-[#0D99FF] rounded"
                  />
                  <div>
                    <span className="font-bold text-slate-800">เป็นจุดคุมงานหลัก (Master Station)</span>
                    <p className="text-xs text-slate-400">สำหรับล็อกหมายเลข Copy 01 ประจำแผนก</p>
                  </div>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLocModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs"
                >
                  บันทึกจุดใช้งาน
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ================= CLEAN SLATE CONFIRMATION MODAL ================= */}
      {isCleanSlateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-[#E5E5E5] shadow-none space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
                  <RotateCcw size={24} className="text-rose-600" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1E1E1E]">ล้างข้อมูลเพื่อเริ่มทดสอบใหม่ (Clean Slate)</h3>
                  <p className="text-xs text-[#666666] font-normal">Factory Reset Transaction Data for E2E Testing</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCleanSlateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-[#F5F5F5] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                การดำเนินการนี้จะ <strong>ลบข้อมูลจำลองเชิงธุรกรรม (Transaction Data) ทั้งหมด</strong> เพื่อให้ระบบกลับสู่สภาพเริ่มต้นที่สะอาด (Clean Slate) สำหรับการทดสอบ Workflow ตั้งแต่ต้น:
              </p>

              <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-xl space-y-1.5 text-rose-950 font-medium">
                <div className="font-bold text-rose-800 flex items-center gap-1.5">
                  <span>🗑️ ข้อมูลที่จะถูกล้างเป็นค่าว่าง (`[]`):</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-rose-900 text-xs pl-1">
                  <li>คำร้อง DAR ทั้งหมด (`dars`, `darRequests`, `timeline`)</li>
                  <li>เอกสารในคลังและเอกสารแม่บท (`documents`, `externalDocuments`)</li>
                  <li>ทะเบียนสำเนาควบคุมทั้งหมด (`controlledCopyInstances`, `documentControlledCopies`)</li>
                  <li>กล่องงานและแจ้งเตือนทั้งหมด (`tasks: []`, `notifications: []`)</li>
                  <li>ประวัติการทำงานและ Audit Trail ทั้งหมด (`actionLog`, `auditTrail`)</li>
                </ul>
              </div>

              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1.5 text-emerald-950 font-medium">
                <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                  <span>✅ ข้อมูลหลักที่ยังคงไว้ 100% (Preserved Master Data):</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-emerald-900 text-xs pl-1">
                  <li>บัญชีผู้ใช้ 10 บัญชีมาตรฐาน พร้อมรหัส PIN 123456</li>
                  <li>แผนก 9 แผนกมาตรฐาน (`PD`, `QA/QC`, `WH`, `EN` ฯลฯ)</li>
                  <li>ประเภทเอกสาร 6 ประเภท (`QM`, `SOP`, `WI`, `FM`, `SD`, `SPEC`)</li>
                  <li>จุดใช้งานและสถานีมาตรฐานประจำโรงงาน</li>
                  <li>การตั้งค่าความปลอดภัย e-Signature และ SLAs</li>
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsCleanSlateModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-[#1E1E1E] hover:bg-[#F5F5F5] rounded-xl transition-colors"
              >
                ยกเลิก (Cancel)
              </button>
              <button
                type="button"
                onClick={() => {
                  resetTransactionDataToCleanSlate();
                  setIsCleanSlateModalOpen(false);
                  toast.success('ล้างข้อมูลธุรกรรมทั้งหมดเรียบร้อยแล้ว ระบบพร้อมสำหรับการทดสอบ Clean Slate');
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-sm shadow-rose-600/30 flex items-center gap-1.5"
              >
                <RotateCcw size={14} />
                <span>ยืนยันล้างข้อมูล (Confirm Reset)</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ================= USER SIGNATURE PROFILE MODAL ================= */}
      {isSignatureModalOpen && selectedUserForSignature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-xl border border-[#E2E8F0] w-full max-w-xl overflow-hidden flex flex-col my-8"
          >
            <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#0D99FF]/20 rounded-xl text-[#0D99FF]">
                  <PenTool size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">
                    ตั้งค่าโปรไฟล์ลายเซ็นดิจิทัล (Digital Signature Profile)
                  </h3>
                  <p className="text-xs text-slate-400">
                    21 CFR Part 11 & ISO 9001:2015 Electronic Signature Asset
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsSignatureModalOpen(false)} 
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSignatureProfile} className="p-6 space-y-5 text-xs">
              {/* User Identity Banner */}
              <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800 text-sm">
                    {selectedUserForSignature.name}
                  </div>
                  <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                    {selectedUserForSignature.empId || selectedUserForSignature.id} • {selectedUserForSignature.department} • {selectedUserForSignature.position || 'User'}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Level {selectedUserForSignature.level || 1}
                </span>
              </div>

              {/* Signature Style Selection */}
              <div>
                <label className="font-bold text-slate-700 block mb-2">
                  1. เลือกสไตล์ลายเซ็นตัวอักษรแบบวิจิตร (Typographic Calligraphy Style):
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'BRUSH_SCRIPT', label: 'Brush Script (พู่กันพลิ้วไหว)', fontClass: 'font-serif italic font-bold' },
                    { id: 'FORMAL_SERIF', label: 'Formal Executive (ทางการสากล)', fontClass: 'font-serif tracking-widest uppercase' },
                    { id: 'MODERN_SANS', label: 'Modern Sans (โมเดิร์นคมชัด)', fontClass: 'font-sans font-extrabold tracking-wide uppercase' },
                    { id: 'CLASSIC_CALLIGRAPHY', label: 'Classic Calligraphy (ตวัดคลาสสิก)', fontClass: 'font-mono italic font-semibold' }
                  ].map(style => {
                    const isSelected = signatureFormData.signatureStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setSignatureFormData({ ...signatureFormData, signatureStyle: style.id })}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#E5F4FF] border-[#0D99FF] ring-2 ring-[#0D99FF]/20 shadow-xs'
                            : 'bg-white border-[#E2E8F0] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold text-slate-700">{style.label}</span>
                          {isSelected && <Check size={14} className="text-[#0D99FF]" />}
                        </div>
                        <div className={`text-slate-800 text-sm truncate py-1 ${style.fontClass}`}>
                          {signatureFormData.signatureInitials || selectedUserForSignature.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Initials & Serial Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">อักษรย่อลายเซ็น (Initials / Monogram):</label>
                  <input
                    type="text"
                    value={signatureFormData.signatureInitials}
                    onChange={(e) => setSignatureFormData({ ...signatureFormData, signatureInitials: e.target.value })}
                    placeholder="เช่น BM-QA หรือ บีม"
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl font-medium focus:bg-white focus:border-[#0D99FF] outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">รหัสใบรับรองดิจิทัล (Digital Certificate ID):</label>
                  <input
                    type="text"
                    readOnly
                    value={signatureFormData.certificateSerial}
                    className="w-full px-3 py-2 bg-slate-100 border border-[#E2E8F0] rounded-xl font-mono text-slate-500 text-xs select-all"
                  />
                </div>
              </div>

              {/* Live 21 CFR Part 11 Digital Stamp Preview */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5 flex items-center justify-between">
                  <span>2. ตัวอย่างตราประทับดิจิทัลจริง (Live 21 CFR Part 11 Stamp Inspector):</span>
                  <span className="text-[10px] text-[#0D99FF] font-mono font-normal">Real-Time Verification Preview</span>
                </label>
                <div className="p-4 bg-white border-2 border-dashed border-[#0D99FF]/40 rounded-xl space-y-2 relative overflow-hidden shadow-2xs">
                  <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <ShieldCheck size={12} /> VERIFIED
                  </div>

                  <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#0D99FF]">
                    21 CFR PART 11 DIGITALLY SIGNED & SEALED
                  </div>

                  <div className="flex items-center gap-4 py-1">
                    <div className="w-28 h-10 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center font-serif italic text-slate-900 font-bold text-base px-2 truncate shadow-2xs">
                      {signatureFormData.signatureInitials || selectedUserForSignature.name}
                    </div>
                    <div className="space-y-0.5 text-[11px] text-slate-700 leading-snug">
                      <div><strong className="text-slate-900">Signer:</strong> {selectedUserForSignature.name} ({selectedUserForSignature.empId || selectedUserForSignature.id})</div>
                      <div><strong className="text-slate-900">Department:</strong> {selectedUserForSignature.department} | Level {selectedUserForSignature.level || 1}</div>
                      <div><strong className="text-slate-900">Intent:</strong> Review & Approval of Documented Information (ISO 9001:2015)</div>
                      <div className="text-[10px] text-slate-400 font-mono">Date/Time: 25/08/2026 22:15:00 (UTC+7 Bangkok) | SHA-256: 7f83b165...4a91c</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSignatureModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Save size={14} />
                  <span>บันทึกโปรไฟล์ลายเซ็น</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ================= DIGITAL STAMP SIMULATOR MODAL ================= */}
      {isStampSimulatorModalOpen && stampSimulatorUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-xl border border-[#E2E8F0] w-full max-w-lg overflow-hidden flex flex-col my-8"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">
                    ทดสอบประทับตราจำลอง (21 CFR Part 11 Stamp Simulator)
                  </h3>
                  <p className="text-xs text-slate-400">
                    จำลองผลลัพธ์การประทับตราบนเอกสาร DAR / PDF Watermark
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsStampSimulatorModalOpen(false)} 
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Role Selector */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">เลือกลำดับขั้นตอนการลงนามใน DAR Workflow:</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'REQUESTER', label: '1. ผู้ยื่นคำร้อง (Requester)', meaning: 'I declare that this DAR request is accurate and complete.' },
                    { id: 'REVIEWER', label: '2. ผู้ทบทวน (Reviewer)', meaning: 'I have reviewed and verified the technical contents.' },
                    { id: 'APPROVER', label: '3. ผู้อนุมัติ (Approver)', meaning: 'I approve the document for release and effective use.' },
                    { id: 'DCC_RECEIVER', label: '4. ผู้ควบคุมเอกสาร (DCC)', meaning: 'Official document registration and controlled copy issuance.' }
                  ].map(roleItem => {
                    const isSelected = stampSimulatorRole === roleItem.id;
                    return (
                      <button
                        key={roleItem.id}
                        type="button"
                        onClick={() => setStampSimulatorRole(roleItem.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#E5F4FF] border-[#0D99FF] text-[#007BE5] font-bold shadow-2xs'
                            : 'bg-white border-[#E2E8F0] text-slate-700 hover:bg-[#F8FAFC]'
                        }`}
                      >
                        {roleItem.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rendered Stamp Simulation */}
              <div className="p-5 bg-gradient-to-b from-slate-50 to-white border border-[#0D99FF]/40 rounded-2xl space-y-3 relative shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[11px] font-bold font-mono text-slate-800 uppercase">
                      QMS DIGITAL SIGNATURE SEAL
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#0D99FF] font-bold bg-[#E5F4FF] px-2 py-0.5 rounded-full">
                    {stampSimulatorUser.certificateSerial || 'CERT-2026-QA001'}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-32 h-14 bg-white border border-slate-300/80 rounded-xl flex items-center justify-center font-serif italic text-slate-900 font-bold text-lg px-3 truncate shadow-2xs">
                    {stampSimulatorUser.signatureInitials || stampSimulatorUser.name}
                  </div>
                  <div className="space-y-1 text-xs text-slate-700 flex-1 min-w-0">
                    <div className="font-bold text-slate-900 text-sm truncate">{stampSimulatorUser.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{stampSimulatorUser.empId || stampSimulatorUser.id} • {stampSimulatorUser.department} • Level {stampSimulatorUser.level || 1}</div>
                    <div className="text-[11px] text-[#0D99FF] font-semibold">
                      Intent: {stampSimulatorRole === 'REQUESTER' ? 'ผู้ยื่นคำร้อง (Submission)' :
                        stampSimulatorRole === 'REVIEWER' ? 'ผู้ทบทวนเอกสาร (Reviewed)' :
                        stampSimulatorRole === 'APPROVER' ? 'ผู้อนุมัติเอกสาร (Approved)' : 'ผู้ควบคุมเอกสาร (DCC Released)'}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 text-[10px] font-mono text-slate-500 flex flex-col gap-0.5">
                  <div>Timestamp: 25/08/2026 22:15:00 (+07:00 Bangkok)</div>
                  <div className="truncate">SHA-256 Checksum: e9a4f21d8b73a45c991e60f83d21b7a44f128c93b</div>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>
                  ตราประทับอิเล็กทรอนิกส์นี้ผ่านการรับรองตามมาตรฐาน <strong>21 CFR Part 11 Subpart B</strong> และสามารถตรวจสอบความถูกต้องย้อนกลับได้ 100%
                </span>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsStampSimulatorModalOpen(false)}
                  className="btn-primary text-xs px-5 cursor-pointer"
                >
                  ปิดหน้าต่าง (Close)
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ================= APPROVAL MATRIX EDIT MODAL ================= */}
      {isMatrixModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-xl border border-[#E5E5E5] w-full max-w-lg overflow-hidden flex flex-col my-8"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#0D99FF]/20 rounded-xl text-[#0D99FF]">
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">
                    แก้ไขผังสายการอนุมัติ ({matrixFormData.docType})
                  </h3>
                  <p className="text-xs text-slate-400">
                    กำหนดระดับอำนาจอนุมัติและเงื่อนไขการรับทราบ
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsMatrixModalOpen(false)} 
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMatrixEntry} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">ประเภทเอกสาร (Document Type):</label>
                <div className="flex items-center gap-2.5 p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                  <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-[#E5F4FF] text-[#007BE5] border border-[#B8E1FF] shadow-2xs">
                    {matrixFormData.docType}
                  </span>
                  <div>
                    <span className="font-bold text-slate-800 text-sm block">{matrixFormData.nameTh || matrixFormData.docType}</span>
                    {matrixFormData.description && (
                      <span className="text-[11px] text-slate-400">{matrixFormData.description}</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">1. ระดับผู้มีสิทธิ์ยื่นคำขอขั้นต่ำ (Min Requester Level):</label>
                <select
                  aria-label="ระดับผู้มีสิทธิ์ยื่นคำขอขั้นต่ำ"
                  value={matrixFormData.minRequesterLevel}
                  onChange={(e) => setMatrixFormData({ ...matrixFormData, minRequesterLevel: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl font-medium text-slate-800 focus:bg-white focus:border-[#0D99FF] outline-none text-xs"
                >
                  <option value="1">Level 1 ขึ้นไป (ทุกคนในแผนก / Staff & Officer)</option>
                  <option value="2">Level 2 ขึ้นไป (Officer ขึ้นไป)</option>
                  <option value="3">Level 3 ขึ้นไป (Senior Staff ขึ้นไป)</option>
                  <option value="4">Level 4 ขึ้นไป (Supervisor / หัวหน้างานขึ้นไป)</option>
                  <option value="5">Level 5 ขึ้นไป (Asst. Mgr / Lead ขึ้นไป)</option>
                  <option value="6">Level 6 ขึ้นไป (General Manager / ฝ่ายบริหาร)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">ผู้ใช้ที่มีระดับตำแหน่งต่ำกว่านี้จะไม่สามารถสร้างคำร้อง DAR สำหรับประเภทนี้ได้</p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">2. ระดับผู้ทบทวนที่ต้องการ (Required Reviewer Level):</label>
                <select
                  aria-label="ระดับผู้ทบทวนที่ต้องการ"
                  value={matrixFormData.requiredReviewerLevel}
                  onChange={(e) => setMatrixFormData({ ...matrixFormData, requiredReviewerLevel: parseInt(e.target.value) || 4 })}
                  className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl font-medium text-slate-800 focus:bg-white focus:border-[#0D99FF] outline-none text-xs"
                >
                  <option value="3">Level 3 (Senior Staff ประจำแผนก)</option>
                  <option value="4">Level 4 (Supervisor ประจำแผนก)</option>
                  <option value="5">Level 5 (Assistant Manager / Lead ประจำแผนก)</option>
                  <option value="6">Level 6 (General Manager / ฝ่ายบริหาร)</option>
                  <option value="7">Level 7 (Director / คณะกรรมการ)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">ระดับตำแหน่งขั้นต่ำที่จะถูกดึงเข้ามาเป็นผู้ทบทวน (Reviewer) ในสายงาน</p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">3. ระดับผู้อนุมัติขั้นสุดท้าย (Final Approver Level):</label>
                <select
                  aria-label="ระดับผู้อนุมัติขั้นสุดท้าย"
                  value={matrixFormData.requiredApproverLevel}
                  onChange={(e) => setMatrixFormData({ ...matrixFormData, requiredApproverLevel: parseInt(e.target.value) || 6 })}
                  className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl font-medium text-slate-800 focus:bg-white focus:border-[#0D99FF] outline-none text-xs"
                >
                  <option value="5">Level 5 (Assistant Manager / Dept Manager)</option>
                  <option value="6">Level 6 (General Manager / ผู้จัดการทั่วไป)</option>
                  <option value="7">Level 7 (Director / ผู้อำนวยการสายงาน)</option>
                  <option value="8">Level 8 (Managing Director / กรรมการผู้จัดการ / QMR)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">ระดับตำแหน่งขั้นสุดท้ายที่มีอำนาจลงนามอนุมัติบังคับใช้เอกสารฉบับนี้</p>
              </div>

              {matrixFormData.requiredApproverLevel < matrixFormData.requiredReviewerLevel && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-rose-600" />
                  <span>คำเตือน: ระดับผู้อนุมัติ (Level {matrixFormData.requiredApproverLevel}) ต่ำกว่าระดับผู้ทบทวน (Level {matrixFormData.requiredReviewerLevel}) กรุณาเลือกระดับให้ถูกต้อง</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100">
                <label className="font-bold text-slate-700 block mb-2">4. การบังคับรับทราบเป็นค่าเริ่มต้น (Default Acknowledgement):</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                    <input
                      type="radio"
                      name="modalAck"
                      checked={matrixFormData.requireAckDefault === true}
                      onChange={() => setMatrixFormData({ ...matrixFormData, requireAckDefault: true })}
                      className="w-4 h-4 text-[#0D99FF] focus:ring-[#0D99FF]"
                    />
                    <span>บังคับต้องรับทราบ (Required)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                    <input
                      type="radio"
                      name="modalAck"
                      checked={matrixFormData.requireAckDefault === false}
                      onChange={() => setMatrixFormData({ ...matrixFormData, requireAckDefault: false })}
                      className="w-4 h-4 text-[#0D99FF] focus:ring-[#0D99FF]"
                    />
                    <span>ไม่ต้องรับทราบ (Optional / No Ack)</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMatrixModalOpen(false)}
                  className="btn-secondary text-xs cursor-pointer"
                >
                  ยกเลิก (Cancel)
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs cursor-pointer shadow-xs"
                >
                  บันทึกการเปลี่ยนแปลง
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ================= ORPHAN PROTECTION MODAL ================= */}
      {orphanWarningModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl p-6 max-w-md w-full border border-rose-200 shadow-none space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <ShieldAlert size={28} />
              <h3 className="font-bold text-base text-[#1E1E1E]">ไม่สามารถลบจุดใช้งานได้ (Orphan Protection)</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed break-words">
              {orphanWarningModal.message}
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              💡 <strong>คำแนะนำด้านความปลอดภัย:</strong> หากไม่ต้องการใช้งานสถานีนี้ ให้คลิกเปลี่ยนสถานะเป็น <strong>Inactive</strong> แทนการลบข้อมูลถาวร
            </div>
            <button
              onClick={() => setOrphanWarningModal({ isOpen: false, message: '' })}
              className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-colors"
            >
              รับทราบ (Close)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterDataHub;
