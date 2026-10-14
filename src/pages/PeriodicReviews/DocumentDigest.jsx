import { CalendarDays, Eye, FileText, History } from 'lucide-react';
import { formatQmsDisplayDate } from '../../utils/dateFormatter';
import { getDocCode, getDocTitle, getCleanRev, getCleanDept } from '../../utils/domainNormalizer';

export default function DocumentDigest({ schedule, document, isExternal, statusLabel, onOpenDocument }) {
  const code = getDocCode(document) || schedule.documentNumber;
  const title = getDocTitle(document) || schedule.documentName;
  const version = isExternal
    ? getCleanRev(document?.sourceVersion || document?.edition || schedule.edition || schedule.sourceVersion || schedule.rev, '-')
    : getCleanRev(schedule.rev || document);
  const issuer = document?.issuer || document?.officialIssuer || document?.source || document?.issuing_agency || schedule.issuer || '-';
  const rows = [
    [isExternal ? 'รุ่นเอกสาร (Edition)' : 'ฉบับที่ (Revision)', isExternal ? (/^Edition\b/i.test(version) ? version : `Edition ${version}`) : version],
    ...(isExternal ? [['หน่วยงานผู้ออกเอกสาร', issuer]] : []),
    ['แผนกเจ้าของ', getCleanDept(schedule.ownerDepartmentId || document, '-')],
    ['ผู้รับผิดชอบ / เจ้าของ', schedule.ownerUserId || document?.owner || '-'],
    ['วันที่มีผลบังคับใช้', formatQmsDisplayDate(schedule.originalReviewAnchorDate || document?.effectiveDate)]
  ];

  return (
    <aside className="sticky top-6 overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-xl bg-sky-50 p-2.5 text-sky-700"><FileText className="h-5 w-5" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-all text-lg font-bold tracking-tight text-slate-900">{code}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${isExternal ? 'bg-emerald-50 text-emerald-800' : 'bg-sky-50 text-sky-800'}`}>{isExternal ? 'เอกสารภายนอก' : 'เอกสารภายใน'}</span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{title}</p>
          </div>
        </div>
        <div className="mt-5"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusLabel.color}`}>{statusLabel.label}</span></div>
        <dl className="mt-5 divide-y divide-slate-100 border-y border-slate-100">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 py-3 text-sm">
              <dt className="text-slate-500">{label}</dt><dd className="max-w-[55%] text-right font-medium text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50 p-4">
          <div className="rounded-lg bg-white p-2 text-sky-700"><CalendarDays className="h-5 w-5" aria-hidden="true" /></div>
          <div><p className="text-xs font-medium text-sky-800">วันที่ครบกำหนดรอบนี้</p><p className="mt-0.5 text-base font-semibold tabular-nums text-sky-950">{formatQmsDisplayDate(schedule.nextReviewDate)}</p></div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onOpenDocument} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"><Eye className="h-4 w-4" aria-hidden="true" />เปิดดูไฟล์เอกสาร</button>
          <button type="button" onClick={onOpenDocument} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"><History className="h-4 w-4" aria-hidden="true" />ดูประวัติตรวจสอบ</button>
        </div>
      </div>
    </aside>
  );
}
