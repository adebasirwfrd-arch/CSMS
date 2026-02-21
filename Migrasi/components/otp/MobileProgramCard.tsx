'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

interface MonthData {
    plan: number
    actual: number
    wpts_id?: string
}

interface Program {
    id: number
    name: string
    guidance?: string
    plan_type: string
    due_date: string | null
    months: Record<string, MonthData>
    progress: number
}

interface MobileProgramCardProps {
    program: Program
    index: number
    onEdit: (programId: number, month: string) => void
    onDelete: (programId: number, programName: string) => void
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export function MobileProgramCard({ program, index, onEdit, onDelete }: MobileProgramCardProps) {
    const progressColor = program.progress === 100
        ? 'from-[var(--success-color)] to-emerald-400'
        : program.progress >= 50
            ? 'from-[var(--warning-color)] to-amber-400'
            : 'from-[var(--danger-color)] to-red-400'

    // Calculate monthly summary
    const completedMonths = MONTHS.filter(m => {
        const data = program.months[m]
        return data && data.plan > 0 && data.actual >= data.plan
    }).length

    const activeMonths = MONTHS.filter(m => {
        const data = program.months[m]
        return data && data.plan > 0
    }).length

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="bg-[var(--bg-secondary)]/80 backdrop-blur-md rounded-xl border border-[var(--border-light)] p-4 shadow-lg"
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[var(--text-primary)] text-sm leading-tight truncate" title={program.name}>
                        {program.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] rounded-full">
                            {program.plan_type || 'N/A'}
                        </span>
                        {program.due_date && (
                            <span className="text-[10px] text-[var(--text-muted)]">
                                Due: {program.due_date}
                            </span>
                        )}
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-[var(--text-primary)]">{program.progress}%</div>
                    <div className="text-[10px] text-[var(--text-muted)]">{completedMonths}/{activeMonths} months</div>
                </div>
            </div>

            {/* Guidance Section */}
            {program.guidance && (
                <div className="mb-3 p-2 bg-[var(--bg-tertiary)]/50 rounded-lg border border-[var(--border-light)]/50">
                    <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1 tracking-wider opacity-70">Guidance</div>
                    <div className="text-[10px] text-[var(--text-secondary)] leading-relaxed italic">
                        "{program.guidance}"
                    </div>
                </div>
            )}

            {/* Progress Bar */}
            <div className="mb-3">
                <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${program.progress}%` }}
                        transition={{ duration: 1, ease: 'easeOut', delay: index * 0.05 + 0.2 }}
                        className={cn('h-full bg-gradient-to-r', progressColor)}
                    />
                </div>
            </div>

            {/* Month Pills */}
            <div className="flex flex-wrap gap-1 mb-3">
                {MONTHS.map(month => {
                    const data = program.months[month] || { plan: 0, actual: 0 }
                    const isEmpty = data.plan === 0 && data.actual === 0
                    const isComplete = data.plan > 0 && data.actual >= data.plan
                    const isPartial = data.actual > 0 && data.actual < data.plan
                    const isPending = data.plan > 0 && data.actual === 0

                    let pillColor = 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                    if (isComplete) pillColor = 'bg-[var(--success-color)]/20 text-[var(--success-color)]'
                    else if (isPartial) pillColor = 'bg-[var(--warning-color)]/20 text-[var(--warning-color)]'
                    else if (isPending) pillColor = 'bg-[var(--danger-color)]/20 text-[var(--danger-color)]'

                    return (
                        <button
                            key={month}
                            onClick={() => onEdit(program.id, month)}
                            className={cn(
                                'px-2 py-1 rounded text-[10px] font-medium uppercase transition-transform active:scale-95',
                                pillColor
                            )}
                        >
                            {month}
                            {!isEmpty && (
                                <span className="ml-1 opacity-75">{data.actual}/{data.plan}</span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--border-light)]">
                <button
                    onClick={() => onDelete(program.id, program.name)}
                    className="text-xs text-[var(--danger-color)] hover:underline"
                >
                    Delete
                </button>
                <button
                    onClick={() => onEdit(program.id, 'jan')}
                    className="flex items-center gap-1 text-xs text-[var(--accent-blue)] font-medium"
                >
                    Edit Details <ChevronRight className="w-3 h-3" />
                </button>
            </div>
        </motion.div>
    )
}
