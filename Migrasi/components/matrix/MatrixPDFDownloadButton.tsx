import { FileText } from 'lucide-react';

export default function MatrixPDFDownloadButton() {
    return (
        <button className="px-3 py-2 bg-[var(--accent-purple)] text-white rounded-lg text-xs font-semibold flex items-center gap-1 opacity-50 cursor-not-allowed">
            <FileText className="w-3 h-3" /> PDF (Disabled)
        </button>
    );
}
