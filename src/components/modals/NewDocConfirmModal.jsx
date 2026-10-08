import React from 'react';
import ActionConfirmModal from '../common/ActionConfirmModal';

/**
 * NewDocConfirmModal - High-Density Summary Spec Sheet Modal
 * Specifically designed for New Document Registration Confirmation (Linear / Minimalist SaaS Aesthetic).
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {() => void} props.onConfirm
 * @param {string} [props.title]
 * @param {Array} props.summaryData
 * @param {boolean} [props.isLoading=false]
 * @param {string} [props.confirmText]
 * @param {string} [props.cancelText]
 */
const NewDocConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "ยืนยันการส่งคำร้องขอขึ้นทะเบียนเอกสารใหม่ (Confirm New Document Registration)",
  summaryData = [],
  isLoading = false,
  confirmText = "ยืนยันการส่งคำร้องขอ",
  cancelText = "ยกเลิก / กลับไปแก้ไข",
  ...rest
}) => {
  return (
    <ActionConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      actionType="submit"
      summaryData={summaryData}
      isLoading={isLoading}
      confirmText={confirmText}
      cancelText={cancelText}
      {...rest}
    />
  );
};

export default NewDocConfirmModal;
