"use client"

import { useMemo, useRef, useState } from "react"
import { Shield, FileText, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

// Types for OTP Program
interface MonthData {
    plan: number
    actual: number
    wpts_id?: string
    plan_date?: string
    impl_date?: string
    pic_name?: string
    pic_email?: string
}

interface OTPProgram {
    id: number
    name: string
    plan_type: string
    due_date: string | null
    months: Record<string, MonthData>
    progress: number
}

interface ProgramTimelineProps {
    programs: OTPProgram[]
    year: number
}

// Month utilities
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Status color helper
function getStatusStyle(plan: number, actual: number) {
    if (actual >= plan && plan > 0) {
        return {
            gradient: "from-emerald-500 to-teal-400",
            shadow: "shadow-emerald-500/30",
            icon: CheckCircle2,
            status: "Complete"
        }
    }
    if (actual > 0 && actual < plan) {
        return {
            gradient: "from-amber-400 to-orange-400",
            shadow: "shadow-amber-500/30",
            icon: Clock,
            status: "In Progress"
        }
    }
    if (plan > 0 && actual === 0) {
        return {
            gradient: "from-rose-500 to-red-500",
            shadow: "shadow-rose-500/30",
            icon: AlertCircle,
            status: "Not Started"
        }
    }
    return {
        gradient: "from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700",
        shadow: "shadow-slate-500/20",
        icon: FileText,
        status: "No Activity"
    }
}

// Custom Channel Component (Sidebar)
function CustomChannel({ program }: { program: OTPProgram }) {
    return (
        <div className="flex items-center gap-3 h-14 px-4 border-r border-white/10 bg-white/5 backdrop-blur-md">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                    {program.name}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] truncate">
                    {program.plan_type || "OTP Program"}
                </div>
            </div>
        </div>
    )
}

// Custom Program Bar Component with Tooltip
function CustomProgramBar({
    monthData,
    monthLabel,
    programName
}: {
    monthData: MonthData
    monthLabel: string
    programName: string
}) {
    const style = getStatusStyle(monthData.plan, monthData.actual)
    const StatusIcon = style.icon

    return (
        <div className="relative group">
            {/* The Bar */}
            <div
                className={cn(
                    "h-8 rounded-full shadow-lg transition-all duration-300",
                    "hover:scale-[1.03] hover:brightness-110 cursor-pointer",
                    "flex items-center justify-center gap-1.5 px-3",
                    "bg-gradient-to-r",
                    style.gradient,
                    style.shadow
                )}
            >
                <StatusIcon className="w-3.5 h-3.5 text-white/90" />
                <span className="text-[11px] font-bold text-white">
                    {monthData.actual}/{monthData.plan}
                </span>
            </div>

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden group-hover:block">
                <div className="w-52 bg-slate-900/95 text-white p-3 rounded-xl text-xs backdrop-blur-xl border border-white/10 shadow-2xl">
                    <div className="font-semibold text-sm mb-2 truncate">{programName}</div>
                    <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between">
                            <span className="text-slate-400">Month:</span>
                            <span className="font-medium">{monthLabel}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Plan:</span>
                            <span className="font-medium">{monthData.plan}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Actual:</span>
                            <span className="font-medium">{monthData.actual}</span>
                        </div>
                        {monthData.pic_name && (
                            <div className="flex justify-between">
                                <span className="text-slate-400">PIC:</span>
                                <span className="font-medium truncate max-w-[100px]">{monthData.pic_name}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center pt-1 border-t border-white/10">
                            <span className="text-slate-400">Status:</span>
                            <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                                style.status === "Complete" && "bg-emerald-500/20 text-emerald-400",
                                style.status === "In Progress" && "bg-amber-500/20 text-amber-400",
                                style.status === "Not Started" && "bg-rose-500/20 text-rose-400",
                                style.status === "No Activity" && "bg-slate-500/20 text-slate-400"
                            )}>
                                {style.status}
                            </span>
                        </div>
                    </div>
                </div>
                {/* Arrow */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900/95" />
            </div>
        </div>
    )
}

// Main ProgramTimeline Component
export function ProgramTimeline({ programs, year }: ProgramTimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [sidebarWidth] = useState(240)

    // Transform programs into timeline data
    const timelineData = useMemo(() => {
        return programs.map(program => {
            const monthsData = MONTHS.map((month, idx) => ({
                month,
                label: MONTH_LABELS[idx],
                data: program.months[month] || { plan: 0, actual: 0 }
            })).filter(m => m.data.plan > 0 || m.data.actual > 0)

            return {
                program,
                monthsData
            }
        })
    }, [programs])

    if (programs.length === 0) {
        return (
            <div className="h-[500px] rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center">
                <div className="text-center text-[var(--text-muted)]">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No programs to display</p>
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-white/10 shadow-xl overflow-hidden">
            {/* Main scroll container - handles both X and Y scrolling */}
            <div
                ref={containerRef}
                className="overflow-auto max-h-[500px]"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {/* Inner container with min-width for horizontal scroll */}
                <div className="min-w-[1000px]">
                    {/* Header Row */}
                    <div className="flex border-b border-white/10 sticky top-0 z-30 bg-[var(--bg-secondary)]">
                        {/* Sticky Sidebar Header */}
                        <div
                            className="flex-shrink-0 px-4 py-3 bg-[var(--bg-secondary)] border-r border-white/10 sticky left-0 z-40"
                            style={{ width: sidebarWidth, minWidth: sidebarWidth }}
                        >
                            <span className="text-xs font-semibold text-[var(--text-primary)]">
                                Programs ({programs.length})
                            </span>
                        </div>
                        {/* Month Headers */}
                        <div className="flex-1 flex">
                            {MONTH_LABELS.map((label, idx) => (
                                <div
                                    key={idx}
                                    className="flex-1 px-2 py-3 text-center border-l border-white/5 first:border-l-0 bg-[var(--bg-secondary)]"
                                    style={{ minWidth: '70px' }}
                                >
                                    <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                                        {label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Timeline Body */}
                    <div>
                        {timelineData.map(({ program }) => (
                            <div
                                key={program.id}
                                className="flex border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors"
                            >
                                {/* Sidebar Channel */}
                                <div
                                    className="flex-shrink-0 sticky left-0 z-10 bg-[var(--bg-secondary)] border-r border-white/10"
                                    style={{ width: sidebarWidth }}
                                >
                                    <CustomChannel program={program} />
                                </div>

                                {/* Timeline Grid */}
                                <div className="flex-1 flex">
                                    {MONTHS.map((month, idx) => {
                                        const monthData = program.months[month]
                                        const hasActivity = monthData && (monthData.plan > 0 || monthData.actual > 0)

                                        return (
                                            <div
                                                key={idx}
                                                className="flex-1 h-14 flex items-center justify-center px-1 border-l border-white/5 first:border-l-0"
                                            >
                                                {hasActivity && monthData ? (
                                                    <CustomProgramBar
                                                        monthData={monthData}
                                                        monthLabel={MONTH_LABELS[idx]}
                                                        programName={program.name}
                                                    />
                                                ) : (
                                                    <div className="w-full h-8 rounded-full bg-white/5 dark:bg-white/[0.02]" />
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 py-3 border-t border-white/10 bg-[var(--bg-secondary)]">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" />
                    <span className="text-[10px] text-[var(--text-muted)]">Complete</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-r from-amber-400 to-orange-400" />
                    <span className="text-[10px] text-[var(--text-muted)]">In Progress</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-r from-rose-500 to-red-500" />
                    <span className="text-[10px] text-[var(--text-muted)]">Not Started</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-600" />
                    <span className="text-[10px] text-[var(--text-muted)]">No Activity</span>
                </div>
            </div>
        </div>
    )
}
