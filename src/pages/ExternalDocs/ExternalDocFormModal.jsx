import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../../store/useStore';
import { X, Upload, Save, AlertCircle, FileText, CheckCircle2, Shield, Clock, Building2, Tag, Layers, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import UserSelector from '../../components/UserSelector';
import RelatedStandardsSelector from '../../components/workflow/RelatedStandardsSelector';
import DistributionSetup from '../../components/workflow/DistributionSetup';
import ActionConfirmModal from '../../components/common/ActionConfirmModal';
import { formatDocumentRunningNumber, calculateNextExternalDocSequence } from '../../services/MasterDataService';

const ExternalDocFormModal = ({ isOpen, onClose, documentToEdit = null }) => {
  const { 
    currentUser, 
    masterUsers, 
    registerExternalDoc, 
    updateExternalDoc, 
    masterDepartments, 
    departments: storeDepts,
    documentTypes,
    externalDocuments 
  } = useStore();

  const userDept = currentUser?.department || currentUser?.dept_code || currentUser?.dept || 'QA';
  const availableDepts = useMemo(() => {
    return (masterDepartments || storeDepts || []).filter(d => typeof d === 'string' || d.status !== 'INACTIVE');
  }, [masterDepartments, storeDepts]);

  const [formData, setFormData] = useState({
    department: userDept,
    title: '',
    sourceVersion: '',
    source: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    reviewCycleMonths: 12,
    reviewerId: '',
    approverId: '',
    acknowledgees: [],
    accessScope: 'General',
    accessDepartments: [],
    accessUsers: [],
    relatedStandards: [],
    otherStandardDetail: '',
    isPhysicalCopy: false,
    distributions: [],
    reason: ''
  });

  const [fileName, setFileName] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [payloadToSubmit, setPayloadToSubmit] = useState(null);

  // Compute Auto-Generated ED Code Preview from Master Data Pattern (01-99 ➔ 100+)
  const previewEdCode = useMemo(() => {
    if (documentToEdit) {
      return documentToEdit.edCode || documentToEdit.doc_code || documentToEdit.docNo || documentToEdit.id;
    }
    const dept = formData.department || userDept;
    const edType = (documentTypes || []).find(t => t.code === 'ED' || t.id === 'ED');
    const pattern = edType?.namingPattern || 'ED-{Dept}-{##}';

    const nextSeq = calculateNextExternalDocSequence(dept, externalDocuments);
    const seqNum = formatDocumentRunningNumber(nextSeq);
    return pattern
      .replace('{Type}', 'ED')
      .replace('{Dept}', dept)
      .replace('{###}', seqNum)
      .replace('{##}', seqNum);
  }, [documentToEdit, formData.department, userDept, externalDocuments, documentTypes]);

  useEffect(() => {
    if (isOpen) {
      const activeDept = currentUser?.department || currentUser?.dept_code || currentUser?.dept || 'QA';
      if (documentToEdit) {
        const isPhysical = Boolean(documentToEdit.is_physical_copy || (documentToEdit.distributions && documentToEdit.distributions.length > 0));
        setFormData({
          department: documentToEdit.department || documentToEdit.dept || activeDept,
          title: documentToEdit.title || '',
          sourceVersion: documentToEdit.sourceVersion || documentToEdit.edition || '',
          source: documentToEdit.source || '',
          effectiveDate: documentToEdit.effectiveDate || new Date().toISOString().split('T')[0],
          reviewCycleMonths: documentToEdit.reviewCycleMonths || 12,
          reviewerId: documentToEdit.reviewerId || '',
          approverId: documentToEdit.approverId || '',
          acknowledgees: documentToEdit.acknowledgees || [],
          accessScope: documentToEdit.accessScope || 'General',
          accessDepartments: documentToEdit.accessDepartments || [],
          accessUsers: documentToEdit.accessUsers || [],
          relatedStandards: documentToEdit.relatedStandards || [],
          otherStandardDetail: documentToEdit.otherStandardDetail || '',
          isPhysicalCopy: isPhysical,
          distributions: documentToEdit.distributions || [],
          reason: ''
        });
        setFileName(documentToEdit.fileName || '');
      } else {
        setFormData({
          department: activeDept,
          title: '',
          sourceVersion: '',
          source: '',
          effectiveDate: new Date().toISOString().split('T')[0],
          reviewCycleMonths: 12,
          reviewerId: '',
          approverId: '',
          acknowledgees: [],
          accessScope: 'General',
          accessDepartments: [],
          accessUsers: [],
          relatedStandards: [],
          otherStandardDetail: '',
          isPhysicalCopy: false,
          distributions: [],
          reason: ''
        });
        setFileName('');
      }
    }
  }, [documentToEdit, isOpen, currentUser]);

  // Rule: DCC Admin cannot be an External Reviewer (ISO compliance)
  const eligibleReviewers = useMemo(() => {
    return (masterUsers || []).filter(u => !u.isDcc && u.role !== 'DCC_ADMIN' && u.id !== 'U001');
  }, [masterUsers]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFileName(e.target.files[0].name);
    }
  };

  const handleDeptToggle = (deptCode) => {
    setFormData(prev => {
      const depts = prev.accessDepartments || [];
      if (depts.includes(deptCode)) return { ...prev, accessDepartments: depts.filter(d => d !== deptCode) };
      return { ...prev, accessDepartments: [...depts, deptCode] };
    });
  };

  const handleAddUser = (userId) => {
    if (!userId) return;
    setFormData(prev => {
      if ((prev.accessUsers || []).includes(userId)) return prev;
      return { ...prev, accessUsers: [...(prev.accessUsers || []), userId] };
    });
  };

  const handleRemoveUser = (userId) => {
    setFormData(prev => ({
      ...prev,
      accessUsers: (prev.accessUsers || []).filter(id => id !== userId)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title?.trim() || !formData.source?.trim() || !formData.effectiveDate || !formData.reviewerId || !formData.approverId) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (ชื่อเอกสาร, แหล่งที่มา, วันที่บังคับใช้, Reviewer และ Approver)');
      return;
    }
    
    if (formData.relatedStandards?.includes('อื่น ๆ (Others)') && !formData.otherStandardDetail?.trim()) {
      toast.error('กรุณาระบุรายละเอียดมาตรฐานอื่นๆ');
      return;
    }
    
    if (documentToEdit && !formData.reason?.trim()) {
      toast.error('กรุณาระบุเหตุผลในการอัปเดตเวอร์ชันเอกสาร');
      return;
    }

    const payload = {
      ...formData,
      edCode: previewEdCode,
      doc_code: previewEdCode,
      docNo: previewEdCode,
      distributions: formData.isPhysicalCopy ? formData.distributions : [],
      physical_distribution: formData.isPhysicalCopy ? formData.distributions : [],
      is_physical_copy: Boolean(formData.isPhysicalCopy && (formData.distributions || []).length > 0),
      fileName,
      updatedAt: new Date().toISOString()
    };

    setPayloadToSubmit(payload);
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = () => {
    if (documentToEdit) {
      updateExternalDoc(documentToEdit.id, payloadToSubmit);
      toast.success(`ส่งคำขออัปเดตเอกสาร ${previewEdCode} (Rev.${String(parseInt(documentToEdit.rev || '1', 10) + 1).padStart(2, '0')}) สำเร็จ`);
    } else {
      registerExternalDoc(payloadToSubmit);
      toast.success(`ลงทะเบียนเอกสารภายนอก ${previewEdCode} เรียบร้อยแล้ว`);
    }
    setShowConfirmModal(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ scale: 0.96, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 15 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="relative bg-white border border-stone-200/50 w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] z-10 my-auto"
          >
            {/* Header: Claude Aesthetic (White/Flat) */}
            <div className="bg-white px-8 pt-8 pb-4 border-b border-stone-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#f9f8f6] text-[#da7756] border border-stone-200 flex items-center justify-center shrink-0">
                  <FileText size={24} />
                </div>
                <div>
                  <h2 className="text-[#2d2d2d] font-bold text-xl sm:text-2xl tracking-tight flex items-center gap-2">
                    {documentToEdit ? 'อัปเดตเอกสารภายนอก (Update External Document)' : 'ลงทะเบียนเอกสารภายนอก (Register External Document)'}
                  </h2>
                  <p className="text-stone-500 text-sm sm:text-base mt-1 font-medium">
                    ระบบควบคุมเอกสารภายนอกและกฎหมายตามมาตรฐาน ISO 9001 / FSSC 22000
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={onClose}
                className="text-stone-400 hover:text-[#2d2d2d] hover:bg-stone-50 rounded-xl p-2 transition-colors focus:ring-2 focus:ring-[#da7756]/20 outline-none"
                title="ปิดหน้าต่าง"
              >
                <X size={24} />
              </button>
            </div>

            {/* Form Body */}
            <div className="px-8 py-8 overflow-y-auto flex-1 space-y-8 bg-[#f9f8f6] scrollbar-thin">
              {/* Guidance Banner */}
              <div className="bg-white border border-stone-200 p-5 rounded-xl flex gap-4 items-start text-stone-800 shadow-sm">
                <AlertCircle className="shrink-0 text-[#da7756] mt-0.5" size={24} />
                <div className="text-sm space-y-1.5">
                  <p className="font-bold text-[#2d2d2d] text-base">กฎการควบคุมเอกสารภายนอก (External Document Rules)</p>
                  <p className="text-stone-600 leading-relaxed">
                    • เอกสารภายนอกใช้ระบบรหัสควบคุม <span className="font-mono font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">ED-&#123;Dept&#125;-&#123;###&#125;</span> โดยไม่ต้องเปิดคำร้อง DAR ภายใน
                  </p>
                  <p className="text-stone-600 leading-relaxed">
                    • ผู้ทบทวน (Reviewer) ต้องเป็นผู้เชี่ยวชาญ/หัวหน้างานประจำแผนก (DCC Admin ไม่สามารถเป็นผู้ทบทวนเนื้อหาได้)
                  </p>
                </div>
              </div>

              {/* Code Preview Badge Card */}
              <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-[#f9f8f6] p-2 rounded-xl border border-stone-100">
                    <Tag className="text-[#da7756]" size={20} />
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-stone-500 uppercase tracking-wider block mb-0.5">รหัสเอกสารควบคุม (System ED Code)</span>
                    <span className="font-mono text-lg font-bold text-[#2d2d2d]">{previewEdCode}</span>
                  </div>
                </div>
                {documentToEdit && (
                  <div className="flex items-center gap-3 bg-[#f9f8f6] px-4 py-2.5 rounded-xl border border-stone-200">
                    <span className="text-sm text-stone-600">ฉบับเดิม: <strong className="text-stone-800">Rev.{documentToEdit.rev || '01'}</strong></span>
                    <span className="text-sm font-bold bg-white text-[#da7756] px-3 py-1.5 rounded-lg shadow-sm border border-stone-200">
                      ➔ ฉบับใหม่: Rev.{String(parseInt(documentToEdit.rev || '1', 10) + 1).padStart(2, '0')}
                    </span>
                  </div>
                )}
              </div>

              <form id="external-doc-form" onSubmit={handleSubmit} className="space-y-8">
                {/* 1. Basic Metadata Grid */}
                <div className="bg-white p-6 sm:p-8 rounded-xl border border-stone-200 shadow-sm space-y-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#2d2d2d] flex items-center gap-2.5 border-b border-stone-100 pb-3">
                    <Building2 className="text-stone-400" size={18} /> ข้อมูลทั่วไปของเอกสาร (General Information)
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-stone-600">
                        แผนกผู้รับผิดชอบ (Responsible Dept) <span className="text-rose-500">*</span>
                      </label>
                      <select 
                        value={formData.department}
                        onChange={e => handleChange('department', e.target.value)}
                        disabled={!!documentToEdit}
                        className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-base text-[#2d2d2d] placeholder:text-stone-400 focus:border-[#da7756] focus:ring-4 focus:ring-[#da7756]/15 transition-all outline-none font-medium disabled:bg-[#f3f2ef] disabled:text-stone-400 disabled:cursor-not-allowed"
                      >
                        {availableDepts.map(deptObj => {
                          const deptCode = typeof deptObj === 'string' ? deptObj : deptObj.id;
                          const deptName = typeof deptObj === 'string' ? deptObj : (deptObj.nameTh || deptObj.name);
                          return (
                            <option key={deptCode} value={deptCode}>
                              {deptCode} - {deptName}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-stone-600">
                        เวอร์ชัน/รุ่นต้นฉบับภายนอก (Source Edition) <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        value={formData.sourceVersion}
                        onChange={e => handleChange('sourceVersion', e.target.value)}
                        placeholder="เช่น Edition 5, Issue 2026, Ver 2.1"
                        className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-base text-[#2d2d2d] placeholder:text-stone-400 focus:border-[#da7756] focus:ring-4 focus:ring-[#da7756]/15 transition-all outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-stone-600">
                      ชื่อเอกสาร / กฎหมาย / มาตรฐาน (Document Title) <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={formData.title}
                      onChange={e => handleChange('title', e.target.value)}
                      placeholder="เช่น ISO 9001:2015 Quality Management Systems - Requirements"
                      className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-base text-[#2d2d2d] placeholder:text-stone-400 focus:border-[#da7756] focus:ring-4 focus:ring-[#da7756]/15 transition-all outline-none font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-stone-600">
                        หน่วยงานผู้ออกเอกสาร (Official Issuer / Source) <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        value={formData.source}
                        onChange={e => handleChange('source', e.target.value)}
                        placeholder="เช่น ISO, กระทรวงอุตสาหกรรม, Vendor Tetra Pak"
                        className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-base text-[#2d2d2d] placeholder:text-stone-400 focus:border-[#da7756] focus:ring-4 focus:ring-[#da7756]/15 transition-all outline-none font-medium"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-stone-600">
                        วันที่บังคับใช้ (Effective Date) <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="date" 
                        value={formData.effectiveDate}
                        onChange={e => handleChange('effectiveDate', e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-base text-[#2d2d2d] focus:border-[#da7756] focus:ring-4 focus:ring-[#da7756]/15 transition-all outline-none font-medium"
                      />
                    </div>
                  </div>

                  {/* Review Cycle */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-stone-600">
                        รอบการทบทวนความทันสมัย (Validity Review Cycle)
                      </label>
                      <select 
                        value={formData.reviewCycleMonths}
                        onChange={e => handleChange('reviewCycleMonths', Number(e.target.value))}
                        className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-base text-[#2d2d2d] focus:border-[#da7756] focus:ring-4 focus:ring-[#da7756]/15 transition-all outline-none font-medium cursor-pointer"
                      >
                        <option value={12}>12 เดือน (ประจำปี - มาตรฐานทั่วไป)</option>
                        <option value={24}>24 เดือน (ทุก 2 ปี)</option>
                        <option value={36}>36 เดือน (ทุก 3 ปี)</option>
                      </select>
                    </div>

                    <div className="bg-[#f9f8f6] p-4 rounded-xl border border-stone-200 flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-sm font-bold text-stone-500 block">วันครบกำหนดทบทวนรอบถัดไป</span>
                        <strong className="text-[#2d2d2d] font-mono text-base bg-white px-2 py-0.5 rounded border border-stone-200">
                          {(() => {
                            const d = new Date(formData.effectiveDate || new Date());
                            d.setMonth(d.getMonth() + Number(formData.reviewCycleMonths || 12));
                            return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
                          })()}
                        </strong>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-stone-200 shadow-sm">
                        <Clock className="text-stone-400" size={20} />
                      </div>
                    </div>
                  </div>

                  {/* Related Standards */}
                  <div className="pt-4 border-t border-stone-100">
                    <RelatedStandardsSelector
                      value={{
                        relatedStandards: formData.relatedStandards,
                        otherStandardDetail: formData.otherStandardDetail
                      }}
                      onChange={(newVals) => setFormData(prev => ({ ...prev, ...newVals }))}
                      error={formData.relatedStandards?.includes('อื่น ๆ (Others)') && !formData.otherStandardDetail?.trim() ? 'กรุณาระบุรายละเอียดมาตรฐานอื่นๆ' : ''}
                    />
                  </div>

                  {/* Update Reason if editing */}
                  {documentToEdit && (
                    <div className="pt-2">
                      <label className="block text-sm font-bold text-rose-700 mb-2">
                        เหตุผลในการปรับปรุงเวอร์ชัน (Update Reason) <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        value={formData.reason}
                        onChange={e => handleChange('reason', e.target.value)}
                        placeholder="ระบุเหตุผลในการอัปเดตเวอร์ชันเอกสารฉบับนี้..."
                        rows={3}
                        className="w-full px-4 py-3 bg-white border border-rose-200 rounded-xl text-base font-medium text-[#2d2d2d] placeholder:text-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none resize-none shadow-sm"
                      />
                    </div>
                  )}
                </div>

                {/* 2. Confidentiality & Access Scope */}
                <div className="bg-white p-6 sm:p-8 rounded-xl border border-stone-200 shadow-sm space-y-6">
                  <h3 className="text-base font-bold text-[#2d2d2d] flex items-center gap-2.5 border-b border-stone-100 pb-3">
                    <Shield className="text-stone-400" size={20} /> การควบคุมระดับสิทธิ์และการเข้าถึง (Access Control)
                  </h3>

                  <div>
                    <label className="block text-sm font-bold text-stone-600 mb-3">
                      ระดับการเข้าถึง (Access Scope) <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { id: 'General', label: 'General (ทั่วไป)', desc: 'ทุกคนในองค์กรสามารถเข้าถึงได้' },
                        { id: 'Department', label: 'Department (แผนก)', desc: 'เฉพาะแผนกที่ได้รับอนุญาต' },
                        { id: 'Restricted', label: 'Restricted (จำกัดสิทธิ์)', desc: 'เฉพาะบุคคลที่ระบุเท่านั้น' }
                      ].map(scope => {
                        const isSelected = formData.accessScope === scope.id;
                        return (
                          <button
                            type="button"
                            key={scope.id}
                            onClick={() => handleChange('accessScope', scope.id)}
                            className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                              isSelected
                                ? 'bg-white border-[#da7756] shadow-[0_0_0_1px_#da7756] text-[#2d2d2d]'
                                : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-[#f9f8f6]'
                            }`}
                          >
                            <div className="font-bold text-sm sm:text-base flex items-center justify-between">
                              <span className={isSelected ? 'text-[#da7756]' : ''}>{scope.label}</span>
                              {isSelected && <CheckCircle2 size={18} className="text-[#da7756]" />}
                            </div>
                            <span className="text-xs sm:text-sm text-stone-500 mt-1.5 block leading-relaxed">{scope.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {formData.accessScope === 'Department' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-[#f9f8f6] p-5 rounded-xl border border-stone-200 space-y-3"
                    >
                      <label className="block text-sm font-bold text-stone-600">เลือกแผนกที่อนุญาตให้เข้าถึง (Target Departments)</label>
                      <div className="flex flex-wrap gap-2.5 pt-1">
                        {availableDepts.map(deptObj => {
                          const deptCode = typeof deptObj === 'string' ? deptObj : deptObj.id;
                          const deptName = typeof deptObj === 'string' ? deptObj : (deptObj.nameTh || deptObj.name);
                          const isChecked = (formData.accessDepartments || []).includes(deptCode);
                          return (
                            <label 
                              key={deptCode} 
                              className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-xl border text-sm font-bold transition-all ${
                                isChecked
                                  ? 'bg-[#da7756] border-[#da7756] text-white shadow-sm'
                                  : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-[#f9f8f6]'
                              }`}
                            >
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleDeptToggle(deptCode)}
                                className="hidden"
                              />
                              <span>{deptCode} ({deptName})</span>
                            </label>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {formData.accessScope === 'Restricted' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-white p-5 rounded-xl border border-rose-200 space-y-4 shadow-sm"
                    >
                      <label className="block text-sm font-bold text-rose-700">ระบุรายชื่อผู้มีสิทธิ์เข้าถึง (Restricted Authorized Users)</label>
                      <div className="max-w-xl">
                        <UserSelector 
                          value=""
                          onChange={handleAddUser}
                          placeholder="ค้นหาและเพิ่มผู้ใช้งาน..."
                        />
                      </div>
                      <div className="flex flex-wrap gap-2.5 pt-1">
                        {(formData.accessUsers || []).map(uId => {
                          const u = (masterUsers || []).find(user => user.id === uId);
                          return (
                            <span key={uId} className="inline-flex items-center gap-2 bg-white border border-rose-200 text-rose-800 text-sm px-3.5 py-1.5 rounded-xl font-medium shadow-sm">
                              <span>{u ? u.name : uId}</span>
                              <button 
                                type="button" 
                                onClick={() => handleRemoveUser(uId)} 
                                className="text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-full p-0.5 transition-colors"
                              >
                                <X size={16} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* 3. Reviewers & Approvers (Workflow) */}
                <div className="bg-white p-6 sm:p-8 rounded-xl border border-stone-200 shadow-sm space-y-6">
                  <h3 className="text-base font-bold text-[#2d2d2d] flex items-center gap-2.5 border-b border-stone-100 pb-3">
                    <UserSelector className="hidden" /> สายการทบทวนและอนุมัติ (Workflow Sign-Off)
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-stone-600">
                        ผู้ทบทวนเอกสาร (External Reviewer) <span className="text-rose-500">*</span>
                      </label>
                      <UserSelector 
                        value={formData.reviewerId}
                        onChange={val => handleChange('reviewerId', val)}
                        users={eligibleReviewers}
                        placeholder="เลือกผู้ทบทวน (ที่ไม่ใช่ DCC Admin)..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-stone-600">
                        ผู้อนุมัติเอกสาร (External Approver) <span className="text-rose-500">*</span>
                      </label>
                      <UserSelector 
                        value={formData.approverId}
                        onChange={val => handleChange('approverId', val)}
                        users={masterUsers}
                        placeholder="เลือกผู้อนุมัติ (Manager / Director)..."
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Physical Controlled Copy Distribution (Optional Hybrid On-Demand) */}
                <div className="bg-white p-6 sm:p-8 rounded-xl border border-stone-200 shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                    <div className="pr-6">
                      <h3 className="text-base font-bold text-[#2d2d2d] flex items-center gap-2.5">
                        <Layers className="text-stone-400" size={20} /> การขอออกสำเนาควบคุมหน้างาน (Physical Controlled Copy on Demand)
                      </h3>
                      <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
                        ระบบควบคุมแบบ Digital Reference เป็นค่าเริ่มต้น — เปิดสวิตช์เมื่อต้องการให้ DCC พิมพ์เล่มเอกสารควบคุมแจกจ่ายไปยังจุดใช้งานจริง
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={formData.isPhysicalCopy}
                        onChange={e => handleChange('isPhysicalCopy', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-14 h-7 bg-[#f3f2ef] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-200 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#da7756] border border-stone-200"></div>
                    </label>
                  </div>

                  <AnimatePresence>
                    {formData.isPhysicalCopy && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pt-2"
                      >
                        <DistributionSetup
                          ownerDept={formData.department || userDept}
                          distributions={formData.distributions || []}
                          onChange={dists => handleChange('distributions', dists)}
                          documentType="ED"
                          _document={{ docNo: previewEdCode, title: formData.title || 'External Document' }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 5. Official PDF File Upload */}
                <div className="bg-white p-6 sm:p-8 rounded-xl border border-stone-200 shadow-sm space-y-4">
                  <label className="block text-sm font-bold text-stone-600">
                    ไฟล์เอกสารทางการ (Official PDF File)
                  </label>
                  <div className="border-2 border-dashed border-stone-300 hover:border-[#da7756] rounded-xl p-8 flex flex-col items-center justify-center hover:bg-[#f9f8f6] transition-all cursor-pointer relative group">
                    <input 
                      type="file" 
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    />
                    <div className="w-16 h-16 bg-[#f9f8f6] group-hover:bg-[#da7756]/10 rounded-full flex items-center justify-center mb-4 transition-colors">
                      <Upload className="text-stone-400 group-hover:text-[#da7756] transition-colors" size={32} />
                    </div>
                    <span className="text-sm font-bold text-stone-600 group-hover:text-[#da7756] transition-colors">คลิกหรือลากไฟล์ PDF มาวางที่นี่</span>
                    <span className="text-xs text-stone-400 mt-1">รองรับไฟล์ .PDF เท่านั้น (ขนาดไม่เกิน 25MB)</span>
                    {fileName && (
                      <div className="mt-4 flex items-center gap-2 bg-[#f9f8f6] border border-stone-200 text-[#2d2d2d] px-4 py-2 rounded-xl text-sm font-bold shadow-sm">
                        <FileText size={18} className="text-[#da7756]" />
                        <span>{fileName}</span>
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </div>

            {/* Footer Actions */}
            <div className="bg-[#f9f8f6] border-t border-stone-200 px-8 py-5 flex items-center justify-end gap-4 rounded-b-2xl shrink-0">
              <button 
                type="button"
                onClick={onClose}
                className="bg-white hover:bg-stone-50 text-stone-600 font-bold text-base px-6 py-3 rounded-xl border border-stone-200 transition-colors focus:ring-4 focus:ring-stone-200 outline-none cursor-pointer"
              >
                ยกเลิก
              </button>
              <button 
                type="submit"
                form="external-doc-form"
                className="bg-[#da7756] hover:bg-[#c96646] active:scale-[0.98] text-white font-bold text-base px-8 py-3 rounded-xl transition-all flex items-center gap-2.5 focus:ring-4 focus:ring-[#da7756]/20 outline-none cursor-pointer"
              >
                <Save size={20} />
                <span>{documentToEdit ? 'ส่งคำขออัปเดต' : 'ยืนยันการลงทะเบียน'}</span>
              </button>
            </div>
          </motion.div>

          {/* Action Confirm Modal */}
          {showConfirmModal && (
            <ActionConfirmModal
              isOpen={showConfirmModal}
              onClose={() => setShowConfirmModal(false)}
              onConfirm={handleConfirmSubmit}
              title={documentToEdit ? 'ยืนยันการอัปเดตเอกสารภายนอก' : 'ยืนยันการลงทะเบียนเอกสารภายนอก'}
              message={documentToEdit 
                ? `คุณต้องการส่งคำขอปรับปรุงเวอร์ชันสำหรับ ${previewEdCode} หรือไม่?`
                : `คุณต้องการลงทะเบียนเอกสารภายนอกรหัส ${previewEdCode} เข้าสู่ระบบหรือไม่?`
              }
              confirmLabel="ยืนยันการบันทึก (Confirm)"
              summaryItems={[
                { label: 'รหัสเอกสาร (Code)', value: previewEdCode },
                { label: 'ชื่อเอกสาร (Title)', value: formData.title },
                { label: 'แผนก (Department)', value: formData.department },
                { label: 'รุ่นภายนอก (Edition)', value: formData.sourceVersion || '-' },
                { label: 'แหล่งที่มา (Source)', value: formData.source },
                { label: 'วันบังคับใช้ (Effective Date)', value: formData.effectiveDate },
                { label: 'ระดับสิทธิ์ (Access Scope)', value: formData.accessScope },
                { label: 'รอบทบทวน (Review Cycle)', value: `${formData.reviewCycleMonths} เดือน` }
              ]}
            />
          )}
        </div>
      )}
    </AnimatePresence>
  );
};

export default ExternalDocFormModal;
