import {
    ChatBubbleLeftEllipsisIcon,
    ClipboardDocumentCheckIcon,
    DocumentDuplicateIcon,
    DocumentIcon,
    ShieldCheckIcon,
    VideoCameraIcon
} from '@heroicons/react/24/outline';

export const RECORD_TYPES = ['PLANNING', 'ANALYSIS', 'VIDEO', 'FORM', 'CHAT'];

export const getTypeConfig = (type) => {
    const safeType = String(type || '').trim().toUpperCase();

    switch (safeType) {
        case 'PLANNING':
            return {
                icon: <ClipboardDocumentCheckIcon className="w-7 h-7 text-blue-600 stroke-2" />,
                label: 'KẾ HOẠCH AI',
                bgColor: 'bg-blue-50',
                borderColor: 'hover:border-blue-400',
                badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200'
            };
        case 'ANALYSIS':
            return {
                icon: <ShieldCheckIcon className="w-7 h-7 text-rose-600 stroke-2" />,
                label: 'THẨM ĐỊNH VĂN BẢN',
                bgColor: 'bg-rose-50',
                borderColor: 'hover:border-rose-400',
                badgeStyle: null
            };
        case 'VIDEO':
            return {
                icon: <VideoCameraIcon className="w-7 h-7 text-orange-600 stroke-2" />,
                label: 'THẨM ĐỊNH VIDEO',
                bgColor: 'bg-orange-50',
                borderColor: 'hover:border-orange-400',
                badgeStyle: null
            };
        case 'FORM':
            return {
                icon: <DocumentDuplicateIcon className="w-7 h-7 text-purple-600 stroke-2" />,
                label: 'BIỂU MẪU',
                bgColor: 'bg-purple-50',
                borderColor: 'hover:border-purple-400',
                badgeStyle: 'bg-purple-50 text-purple-700 border-purple-200'
            };
        case 'CHAT':
            return {
                icon: <ChatBubbleLeftEllipsisIcon className="w-7 h-7 text-emerald-600 stroke-2" />,
                label: 'TRỢ LÝ CHAT',
                bgColor: 'bg-emerald-50',
                borderColor: 'hover:border-emerald-400',
                badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200'
            };
        default:
            return {
                icon: <DocumentIcon className="w-7 h-7 text-zinc-500 stroke-2" />,
                label: 'HỒ SƠ KHÁC',
                bgColor: 'bg-zinc-100',
                borderColor: 'hover:border-zinc-300',
                badgeStyle: 'bg-zinc-100 text-zinc-600 border-zinc-200'
            };
    }
};

export const normalizeRecord = (source = {}) => {
    const fullData = source.fullData || source;
    const createdAt = fullData.CreatedAt || source.CreatedAt || source.date || source.createdAt;
    const rawName = source.name || fullData.Title || fullData.FileName || fullData.Name;

    return {
        id: source.id ?? source.Id ?? source.ID ?? fullData.Id ?? fullData.ID ?? '',
        name: rawName || 'Bản ghi không tên',
        title: fullData.Title || rawName || '',
        fileName: fullData.FileName || source.fileName || '',
        type: source.type || source.RecordType || fullData.RecordType || '',
        date: source.date || (createdAt ? new Date(createdAt).toLocaleDateString('vi-VN') : 'Chưa có ngày'),
        createdAt,
        riskScore: Number(source.riskScore ?? source.RiskScore ?? fullData.RiskScore ?? 0),
        description: source.description || source.Description || fullData.Description || '',
        analysisJson: source.analysisJson || source.AnalysisJson || fullData.AnalysisJson || '',
        fullData
    };
};

export const parseAnalysisJson = (value) => {
    if (!value) return null;
    if (typeof value === 'object') return value;

    try {
        return JSON.parse(value);
    } catch (error) {
        console.error('Không thể parse AnalysisJson:', error);
        return null;
    }
};

export const renderRecordBadge = (record) => {
    const safeRecord = normalizeRecord(record);
    const safeType = String(safeRecord.type || '').trim().toUpperCase();
    const config = getTypeConfig(safeType);

    if (safeType === 'ANALYSIS' || safeType === 'VIDEO') {
        const score = Number(safeRecord.riskScore ?? 0);
        const isSafe = score >= 80;

        return (
            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black border tracking-wider ${isSafe ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                }`}>
                {isSafe ? 'AN TOÀN' : 'RỦI RO'} ({score}%)
            </span>
        );
    }

    return (
        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black border tracking-wider ${config.badgeStyle}`}>
            {config.label}
        </span>
    );
};
