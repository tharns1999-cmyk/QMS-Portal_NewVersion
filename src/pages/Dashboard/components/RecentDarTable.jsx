import React from 'react';
import EmptyState from '../../../components/EmptyState';

/**
 * RecentDarTable Component
 * Displays filtered DAR items scoped to the user's role and data boundaries.
 */
const RecentDarTable = ({
  recentDars = [],
  isAdmin,
  navigate,
  isDraftDar,
  getStatusBadge,
  getCurrentHandler,
  renderActionButtons
}) => {
  return (
    <div className="overflow-x-auto w-full">
      {recentDars.length > 0 ? (
        <table className="w-full text-left border-collapse min-w-[960px]">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-500 font-medium text-xs font-mono">
              <th className="py-3 px-4 w-12 text-center">จัดการ</th>
              <th className="py-3 px-4 w-44">เลขที่คำขอ</th>
              <th className="py-3 px-4">ชื่อเอกสาร / รายละเอียด</th>
              <th className="py-3 px-4 w-28">ประเภท</th>
              {isAdmin && <th className="py-3 px-4 w-24">แผนก</th>}
              <th className="py-3 px-4 w-32">สถานะ</th>
              <th className="py-3 px-4 w-40">ผู้รับผิดชอบปัจจุบัน</th>
              <th className="py-3 px-4 w-28 text-right">วันที่ยื่น</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {recentDars.map((dar, idx) => (
              <tr 
                key={dar.id || idx}
                onClick={() => {
                  if (dar.isTask) {
                    navigate(`/tasks/approve-replacement/${dar.taskId}`);
                  } else if (isDraftDar(dar)) {
                    const basePath = (dar.type === 'NEW' || dar.type === 'NEW_DOCUMENT') ? '/dcc/dar/new/document' : 
                                    (dar.type === 'REVISION' || dar.type === 'REVISE') ? '/dcc/dar/new/revision' : 
                                    '/dcc/dar/new/obsolete';
                    navigate(`${basePath}?draftId=${encodeURIComponent(dar.id)}`, {
                      state: { draftId: dar.id, draftData: dar }
                    });
                  } else {
                    navigate(`/dar/${dar.id}`);
                  }
                }}
                className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
              >
                <td className="py-3 px-4 text-center whitespace-nowrap">
                  {renderActionButtons(dar)}
                </td>
                <td className="py-3 px-4 font-mono font-medium text-xs whitespace-nowrap">
                  {isDraftDar(dar) ? (
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        const basePath = (dar.type === 'NEW' || dar.type === 'NEW_DOCUMENT') ? '/dcc/dar/new/document' : 
                                        (dar.type === 'REVISION' || dar.type === 'REVISE') ? '/dcc/dar/new/revision' : 
                                        '/dcc/dar/new/obsolete';
                        navigate(`${basePath}?draftId=${encodeURIComponent(dar.id)}`, {
                          state: { draftId: dar.id, draftData: dar }
                        });
                      }}
                      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-pointer transition-colors"
                      title="คลิกเพื่อแก้ไขแบบร่างต่อ"
                    >
                      ฉบับร่าง (Draft)
                    </span>
                  ) : (
                    <span 
                      className="text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200/80 inline-block font-mono font-semibold text-xs hover:underline cursor-pointer transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (dar.isTask) {
                          navigate(`/tasks/approve-replacement/${dar.taskId}`);
                        } else {
                          navigate(`/dar/${dar.id}`);
                        }
                      }}
                    >
                      {dar.darNumber || dar.dar_no || dar.darNo || (isDraftDar(dar) ? 'ฉบับร่าง (Draft)' : (dar.id || '-'))}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 font-medium text-slate-800 leading-relaxed break-all break-words min-w-0 [overflow-wrap:anywhere] group-hover:text-sky-600 transition-colors text-[13px] sm:text-sm" title={dar.title}>
                  {dar.title || '-'}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-mono text-[11px] font-medium uppercase tracking-wider border border-slate-200">
                    {({'NEW': 'จัดทำใหม่', 'NEW_DOCUMENT': 'จัดทำใหม่', 'REVISION': 'ขอแก้ไข', 'REVISE': 'ขอแก้ไข', 'OBSOLETE': 'ขอยกเลิก', 'REPLACEMENT': 'ขอสำเนาทดแทน'})[dar.type] || dar.type || '-'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="py-3 px-4 text-slate-600 font-mono text-xs whitespace-nowrap">
                    {dar.department || '-'}
                  </td>
                )}
                <td className="py-3 px-4 whitespace-nowrap">
                  {getStatusBadge(dar.status)}
                </td>
                <td className="py-3 px-4 text-slate-600 whitespace-nowrap min-w-0 truncate text-[13px] font-medium">
                  {dar.isTask ? 'ผู้จัดการแผนก' : getCurrentHandler(dar)}
                </td>
                <td className="py-3 px-4 text-slate-400 text-right font-mono text-xs whitespace-nowrap">
                  {dar.date || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="p-12 flex items-center justify-center">
          <EmptyState />
        </div>
      )}
    </div>
  );
};

export default RecentDarTable;
