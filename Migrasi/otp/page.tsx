"use client"

import { useState, useMemo, lazy, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AppShell } from "@/components/layout/app-shell"
import { GlassCard } from "@/components/ui/glass-card"
import { cn } from "@/lib/utils"
import { Download, Plus, Search, X, Trash2, Mail, Check, AlertTriangle, FileText, List, CalendarDays } from "lucide-react"
import { useHSEPrograms, useUpdateProgramMonth, useCreateProgram, useDeleteProgram } from "@/hooks/useHSEPrograms"
import { downloadCSV } from "@/lib/supabase-store"
import { months, monthLabels } from "@/lib/otp-store"
import { MobileProgramCard } from "@/components/otp/MobileProgramCard"
import { ProgramTimeline } from "@/components/otp/ProgramTimeline"
import type { Month } from "@/types/supabase"

// Lazy import for PDF button (client-side only)
const PDFDownloadButton = lazy(() => import('@/components/otp/PDFDownloadButton'))

// PDF button loading placeholder
function PDFButtonFallback() {
    return (
        <span className="px-3 py-2 bg-[var(--accent-purple)] text-white rounded-lg text-xs font-semibold opacity-50 flex items-center gap-1">
            <FileText className="w-3 h-3" /> PDF
        </span>
    )
}

// Types for local state
interface MonthData {
    plan: number
    actual: number
    wpts_id?: string
    plan_date?: string
    impl_date?: string
    pic_name?: string
    pic_email?: string
    pic_manager?: string
    pic_manager_email?: string
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

// Cell color logic
function getCellStyle(plan: number, actual: number) {
    if (plan === 0 && actual === 0) return { bg: "bg-[var(--bg-tertiary)]", text: "text-[var(--text-muted)]" }
    if (actual >= plan && plan > 0) return { bg: "bg-[var(--success-color)]/20", text: "text-[var(--success-color)]" }
    if (actual > 0 && actual < plan) return { bg: "bg-[var(--warning-color)]/20", text: "text-[var(--warning-color)]" }
    if (plan > 0 && actual === 0) return { bg: "bg-[var(--danger-color)]/20", text: "text-[var(--danger-color)]" }
    return { bg: "bg-[var(--bg-tertiary)]", text: "text-[var(--text-muted)]" }
}

// Skeleton Loading Component
function TableSkeleton() {
    return (
        <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-10 h-10 bg-[var(--bg-tertiary)] rounded" />
                    <div className="flex-1 h-10 bg-[var(--bg-tertiary)] rounded" />
                    <div className="w-20 h-10 bg-[var(--bg-tertiary)] rounded" />
                    {Array.from({ length: 12 }).map((_, j) => (
                        <div key={j} className="w-10 h-10 bg-[var(--bg-tertiary)] rounded" />
                    ))}
                    <div className="w-24 h-10 bg-[var(--bg-tertiary)] rounded" />
                </div>
            ))}
        </div>
    )
}

export default function OTPPage() {
    const [year, setYear] = useState(2026)
    const [region, setRegion] = useState<"indonesia" | "asia">("indonesia")
    const [base, setBase] = useState("all")
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [showActual, setShowActual] = useState(true)
    const [editModal, setEditModal] = useState<{ open: boolean; programId: number; month: string } | null>(null)
    const [createModal, setCreateModal] = useState(false)
    const [deleteModal, setDeleteModal] = useState<{ open: boolean; programId: number; programName: string } | null>(null)
    const [emailSending, setEmailSending] = useState(false)
    const [emailSent, setEmailSent] = useState(false)
    const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table')

    // Use Supabase-powered hook
    const { data, isLoading, isError } = useHSEPrograms({
        region,
        base,
        category: 'otp',
        year
    })

    // Mutations
    const updateMonth = useUpdateProgramMonth()
    const createProgram = useCreateProgram()
    const deleteProgram = useDeleteProgram()

    // Programs from hook data
    const programs = useMemo(() => {
        return (data?.programs || []) as Program[]
    }, [data?.programs])

    const filteredPrograms = useMemo(() => {
        return programs.filter(prog => {
            const matchesSearch = prog.name.toLowerCase().includes(search.toLowerCase()) ||
                (prog.plan_type || "").toLowerCase().includes(search.toLowerCase())
            let matchesStatus = true
            if (statusFilter === "completed") matchesStatus = prog.progress >= 100  // >= 100 for completed
            else if (statusFilter === "progress") matchesStatus = prog.progress > 0 && prog.progress < 100
            else if (statusFilter === "notstarted") matchesStatus = prog.progress === 0
            return matchesSearch && matchesStatus
        })
    }, [programs, search, statusFilter])

    // Summary stats
    const stats = useMemo(() => {
        const total = programs.length
        const completed = programs.filter(p => p.progress >= 100).length  // >= 100 for completed
        const inProgress = programs.filter(p => p.progress > 0 && p.progress < 100).length
        const avgProgress = total > 0 ? Math.min(100, Math.round(programs.reduce((sum, p) => sum + p.progress, 0) / total)) : 0  // Cap at 100
        return { total, completed, inProgress, avgProgress }
    }, [programs])

    // Handle region change
    const handleRegionChange = (newRegion: "indonesia" | "asia") => {
        setRegion(newRegion)
        if (newRegion === "asia") {
            setBase("all")
        }
    }

    // Handle edit save with mutation
    const handleEditSave = async (formData: MonthData, sendEmail: boolean) => {
        if (!editModal) return

        // Call mutation
        updateMonth.mutate({
            programId: editModal.programId,
            month: editModal.month as Month,
            year,
            data: formData
        })

        if (sendEmail && formData.plan_date && formData.pic_email) {
            console.log('Dummy: Email notification would be sent to:', formData.pic_email)
            setEmailSent(true)
            setTimeout(() => setEmailSent(false), 3000)
        }

        // Auto-sync to Google Calendar mock
        if (formData.plan_date || formData.impl_date) {
            console.log('Dummy: Calendar sync triggered')
        }

        setEditModal(null)
    }

    // Handle delete program with mutation
    const handleDeleteConfirm = () => {
        if (!deleteModal) return
        deleteProgram.mutate(deleteModal.programId)
        setDeleteModal(null)
    }

    // Handle create new program with mutation
    const handleCreate = async (name: string, planType: string, dueDate: string) => {
        createProgram.mutate({
            name: name,
            program_type: 'otp',
            region,
            base,
            plan_type: planType,
            due_date: dueDate || undefined
        })

        // Auto-sync to Google Calendar mock
        if (dueDate) {
            console.log('Dummy: Calendar sync for new program triggered')
        }

        setCreateModal(false)
    }

    // Handle export
    const handleExport = () => {
        if (!data) return
        let regionLabel: string
        if (region === "asia") {
            regionLabel = "Asia_OTP"
        } else if (base === "all") {
            regionLabel = "Indonesia_AllBases_OTP"
        } else {
            regionLabel = `Indonesia_${base.charAt(0).toUpperCase() + base.slice(1)}_OTP`
        }
        downloadCSV(data, regionLabel)
    }

    // Get current program for edit modal
    const currentProgram = editModal ? programs.find(p => p.id === editModal.programId) : null
    const currentMonthData = currentProgram && editModal ? (currentProgram.months[editModal.month] || { plan: 0, actual: 0 }) : null

    const regionLabel = region === "asia" ? "ASIA" : "Indonesia"

    return (
        <AppShell>
            <div className="space-y-4">
                {/* Email sent notification */}
                {emailSent && (
                    <div className="fixed top-4 right-4 z-[400] bg-[var(--success-color)] text-white px-4 py-2 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                        <Check className="w-4 h-4" /> Email notification sent!
                    </div>
                )}

                {/* Header */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#9b59b6] to-[#8e44ad] rounded-xl flex items-center justify-center text-2xl shrink-0">
                        📋
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <h1 className="text-xl font-bold text-[var(--text-primary)]">{year} HSE OTP</h1>
                        <p className="text-xs text-[var(--text-muted)]">{regionLabel} • Objective, Target & Program Tracker</p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <select
                            value={region}
                            onChange={(e) => handleRegionChange(e.target.value as "indonesia" | "asia")}
                            className="px-2 py-1.5 text-xs border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]"
                        >
                            <option value="indonesia">🇮🇩 Indonesia</option>
                            <option value="asia">🌏 Asia</option>
                        </select>
                        <select
                            value={base}
                            onChange={(e) => setBase(e.target.value)}
                            disabled={region === "asia"}
                            className="px-2 py-1.5 text-xs border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)] disabled:opacity-50"
                        >
                            <option value="all">All Bases</option>
                            <option value="narogong">📍 Narogong</option>
                            <option value="duri">📍 Duri</option>
                            <option value="balikpapan">📍 Balikpapan</option>
                        </select>
                        <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="px-2 py-1.5 text-xs border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]"
                        >
                            {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button
                            onClick={() => setCreateModal(true)}
                            className="p-2 bg-[var(--accent-blue)] text-white rounded-lg"
                            title="Add Program"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={isLoading}
                            className="px-3 py-2 bg-[#27ae60] text-white rounded-lg text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                        >
                            <Download className="w-3 h-3" /> CSV
                        </button>
                        {/* PDF Download */}
                        {!isLoading && programs.length > 0 && (
                            <Suspense fallback={<PDFButtonFallback />}>
                                <PDFDownloadButton
                                    programs={programs}
                                    region={region}
                                    base={base}
                                    year={year}
                                />
                            </Suspense>
                        )}
                        {/* View Mode Toggle */}
                        <div className="flex rounded-lg overflow-hidden border border-[var(--border-light)]">
                            <button
                                onClick={() => setViewMode('table')}
                                className={cn(
                                    "px-3 py-2 text-xs font-semibold flex items-center gap-1 transition-colors",
                                    viewMode === 'table'
                                        ? "bg-[var(--accent-blue)] text-white"
                                        : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
                                )}
                                title="Table View"
                            >
                                <List className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setViewMode('timeline')}
                                className={cn(
                                    "px-3 py-2 text-xs font-semibold flex items-center gap-1 transition-colors",
                                    viewMode === 'timeline'
                                        ? "bg-[var(--accent-blue)] text-white"
                                        : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
                                )}
                                title="Timeline View"
                            >
                                <CalendarDays className="w-3.5 h-3.5" />
                            </button>
                            {/* Refresh Button */}
                            <button
                                onClick={() => {
                                    if (typeof window !== 'undefined') {
                                        localStorage.removeItem('hse-otp-data-v2');
                                        localStorage.removeItem('hse-otp-data');
                                        window.location.reload();
                                    }
                                }}
                                className="px-3 py-2 bg-[var(--error-color)] text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-red-600 transition-colors shadow-lg animate-pulse"
                                title="Clear Cache & Refresh"
                            >
                                REFRESH
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <motion.div
                        whileHover={{ y: -5, scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="p-3 text-center rounded-xl shadow-lg bg-gradient-to-br from-[#27ae60] to-[#2ecc71] text-white cursor-pointer"
                    >
                        <div className="text-2xl font-bold">{isLoading ? '-' : stats.total}</div>
                        <div className="text-[10px] opacity-90">Total Programs</div>
                    </motion.div>
                    <motion.div
                        whileHover={{ y: -5, scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="p-3 text-center rounded-xl shadow-lg bg-gradient-to-br from-[#3498db] to-[#2980b9] text-white cursor-pointer"
                    >
                        <div className="text-2xl font-bold">{isLoading ? '-' : stats.completed}</div>
                        <div className="text-[10px] opacity-90">Completed</div>
                    </motion.div>
                    <motion.div
                        whileHover={{ y: -5, scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="p-3 text-center rounded-xl shadow-lg bg-gradient-to-br from-[#f39c12] to-[#e67e22] text-white cursor-pointer"
                    >
                        <div className="text-2xl font-bold">{isLoading ? '-' : stats.inProgress}</div>
                        <div className="text-[10px] opacity-90">In Progress</div>
                    </motion.div>
                    <motion.div
                        whileHover={{ y: -5, scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="p-3 text-center rounded-xl shadow-lg bg-gradient-to-br from-[#e74c3c] to-[#c0392b] text-white cursor-pointer"
                    >
                        <div className="text-2xl font-bold">{isLoading ? '-' : stats.avgProgress}%</div>
                        <div className="text-[10px] opacity-90">Avg Progress</div>
                    </motion.div>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                        <input
                            type="text"
                            placeholder="🔍 Search programs..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 text-sm border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)] focus:outline-none focus:border-[var(--accent-blue)]"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2.5 text-sm border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]"
                    >
                        <option value="all">All Status</option>
                        <option value="completed">100% Complete</option>
                        <option value="progress">In Progress (1-99%)</option>
                        <option value="notstarted">Not Started (0%)</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <input
                            type="checkbox"
                            checked={showActual}
                            onChange={(e) => setShowActual(e.target.checked)}
                            className="w-4 h-4 accent-[var(--accent-blue)]"
                        />
                        Show Actual
                    </label>
                </div>

                {/* Timeline View */}
                {viewMode === 'timeline' && (
                    <ProgramTimeline programs={filteredPrograms} year={year} />
                )}

                {/* Mobile Card View */}
                <div className="block md:hidden space-y-3">
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-40 bg-[var(--bg-tertiary)] rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : isError ? (
                        <div className="p-8 text-center text-[var(--danger-color)]">
                            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                            <p>Failed to load programs.</p>
                        </div>
                    ) : filteredPrograms.length === 0 ? (
                        <div className="p-8 text-center text-[var(--text-muted)]">
                            No OTP programs found
                        </div>
                    ) : (
                        filteredPrograms.map((prog, idx) => (
                            <MobileProgramCard
                                key={prog.id}
                                program={prog}
                                index={idx}
                                onEdit={(id, month) => setEditModal({ open: true, programId: id, month })}
                                onDelete={(id, name) => setDeleteModal({ open: true, programId: id, programName: name })}
                            />
                        ))
                    )}
                </div>

                {/* Desktop Table View */}
                <GlassCard className={cn("overflow-hidden hidden md:block", viewMode === 'timeline' && "!hidden")}>
                    <div className="overflow-x-auto">
                        {isLoading ? (
                            <div className="p-6">
                                <TableSkeleton />
                            </div>
                        ) : isError ? (
                            <div className="p-8 text-center text-[var(--danger-color)]">
                                <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                                <p>Failed to load programs. Please check your connection.</p>
                            </div>
                        ) : (
                            <table className="w-full text-xs min-w-[1100px]">
                                <thead className="bg-[var(--bg-tertiary)]">
                                    <tr>
                                        <th className="p-3 text-left font-semibold sticky left-0 bg-[var(--bg-tertiary)] z-10 w-10">#</th>
                                        <th className="p-3 text-left font-semibold sticky left-10 bg-[var(--bg-tertiary)] z-10 min-w-[200px]">Program</th>
                                        <th className="p-3 text-left font-semibold min-w-[200px]">Guidance</th>
                                        <th className="p-3 text-center font-semibold w-20">Plan Type</th>
                                        {monthLabels.map(m => <th key={m} className="p-3 text-center font-semibold w-12">{m}</th>)}
                                        <th className="p-3 text-center font-semibold w-24">Progress</th>
                                        <th className="p-3 text-center font-semibold w-12">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPrograms.length === 0 ? (
                                        <tr><td colSpan={18} className="p-8 text-center text-[var(--text-muted)]">No OTP programs found</td></tr>
                                    ) : (
                                        filteredPrograms.map((prog, idx) => {
                                            const progressColor = prog.progress >= 100 ? "bg-[var(--success-color)]" : prog.progress >= 50 ? "bg-[var(--warning-color)]" : "bg-[var(--danger-color)]"
                                            return (
                                                <motion.tr
                                                    key={prog.id}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                                                    className="border-b border-[var(--border-light)] hover:bg-[var(--bg-tertiary)]/30"
                                                >
                                                    <td className="p-2 sticky left-0 bg-[var(--bg-secondary)] z-10 text-center font-semibold">{idx + 1}</td>
                                                    <td className="p-2 sticky left-10 bg-[var(--bg-secondary)] z-10">
                                                        <div className="font-medium max-w-[180px] truncate" title={prog.name}>{prog.name}</div>
                                                    </td>
                                                    <td className="p-2">
                                                        <div className="text-[10px] text-[var(--text-muted)] line-clamp-2 max-w-[250px]" title={prog.guidance}>{prog.guidance || "-"}</div>
                                                    </td>
                                                    <td className="p-2 text-center text-[var(--text-muted)] text-[10px]">{prog.plan_type || "-"}</td>
                                                    {months.map(month => {
                                                        const monthData = prog.months[month] || { plan: 0, actual: 0 }
                                                        const styles = getCellStyle(monthData.plan, monthData.actual)
                                                        const isEmpty = monthData.plan === 0 && monthData.actual === 0
                                                        const display = showActual ? `${monthData.actual}/${monthData.plan}` : `${monthData.plan}`
                                                        return (
                                                            <td key={month} className="p-1">
                                                                <div
                                                                    onClick={() => setEditModal({ open: true, programId: prog.id, month })}
                                                                    className={cn(
                                                                        "w-10 h-10 mx-auto rounded flex flex-col items-center justify-center cursor-pointer transition-transform hover:scale-105 font-semibold text-[10px]",
                                                                        styles.bg, styles.text
                                                                    )}
                                                                    title={`Plan: ${monthData.plan} | Actual: ${monthData.actual}${monthData.plan_date ? ` | Date: ${monthData.plan_date}` : ""}`}
                                                                >
                                                                    <span>{isEmpty ? "-" : display}</span>
                                                                    {monthData.wpts_id && <span className="text-[8px] text-[var(--success-color)]">{monthData.wpts_id}</span>}
                                                                </div>
                                                            </td>
                                                        )
                                                    })}
                                                    <td className="p-2 text-center">
                                                        <div className="flex items-center gap-1">
                                                            <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${prog.progress}%` }}
                                                                    transition={{ duration: 1, ease: "easeOut", delay: idx * 0.05 + 0.2 }}
                                                                    className={cn("h-full", progressColor)}
                                                                />
                                                            </div>
                                                            <span className="text-[10px] font-semibold w-8">{prog.progress}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <button
                                                            onClick={() => setDeleteModal({ open: true, programId: prog.id, programName: prog.name })}
                                                            className="p-1.5 rounded bg-[var(--danger-color)]/10 text-[var(--danger-color)] hover:bg-[var(--danger-color)]/20"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </td>
                                                </motion.tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </GlassCard>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 p-3 bg-[var(--bg-secondary)] rounded-lg text-xs text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-[var(--success-color)] rounded" />Plan = Actual</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-[var(--warning-color)] rounded" />Actual &gt; Plan</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-[var(--danger-color)] rounded" />Actual &lt; Plan</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded" />No Activity</span>
                </div>
            </div>

            {/* Edit Modal */}
            <AnimatePresence>
                {editModal && currentProgram && currentMonthData && (
                    <EditModal
                        program={currentProgram}
                        month={editModal.month}
                        data={currentMonthData}
                        onClose={() => setEditModal(null)}
                        onSave={handleEditSave}
                        emailSending={emailSending}
                        isSaving={updateMonth.isPending}
                    />
                )}
            </AnimatePresence>

            {/* Create Modal */}
            <AnimatePresence>
                {createModal && (
                    <CreateModal
                        onClose={() => setCreateModal(false)}
                        onCreate={handleCreate}
                        isCreating={createProgram.isPending}
                    />
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteModal && (
                    <DeleteConfirmModal
                        programName={deleteModal.programName}
                        onClose={() => setDeleteModal(null)}
                        onConfirm={handleDeleteConfirm}
                        isDeleting={deleteProgram.isPending}
                    />
                )}
            </AnimatePresence>
        </AppShell>
    )
}

// Delete Confirmation Modal
function DeleteConfirmModal({ programName, onClose, onConfirm, isDeleting }: {
    programName: string;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 z-[300] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-[var(--bg-secondary)] rounded-2xl w-full max-w-sm shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-[var(--danger-color)]/10 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-[var(--danger-color)]" />
                    </div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Delete OTP Program?</h3>
                    <p className="text-sm text-[var(--text-muted)] mb-1">You are about to delete:</p>
                    <p className="text-sm font-medium text-[var(--text-secondary)] mb-4 px-4 truncate">&ldquo;{programName}&rdquo;</p>
                    <p className="text-xs text-[var(--danger-color)] mb-6">This action cannot be undone.</p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-[var(--border-light)] rounded-lg text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isDeleting}
                            className="flex-1 px-4 py-2.5 bg-[var(--danger-color)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--danger-color)]/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" /> {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}

// Edit Modal Component
function EditModal({ program, month, data, onClose, onSave, emailSending, isSaving }: {
    program: Program; month: string; data: MonthData;
    onClose: () => void; onSave: (data: MonthData, sendEmail: boolean) => void;
    emailSending: boolean; isSaving: boolean;
}) {
    const [form, setForm] = useState<MonthData>(data)
    const [sendEmail, setSendEmail] = useState(false)

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 z-[300] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b border-[var(--border-light)] flex items-center justify-between">
                    <h3 className="font-bold text-[var(--text-primary)]">Edit {month.toUpperCase()} - {program.name.substring(0, 25)}...</h3>
                    <button onClick={onClose} className="p-1 hover:bg-[var(--bg-tertiary)] rounded"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">Plan Value</label>
                            <input type="number" value={form.plan} onChange={e => setForm({ ...form, plan: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-tertiary)] text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">Actual Value</label>
                            <input type="number" value={form.actual} onChange={e => setForm({ ...form, actual: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-tertiary)] text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-[var(--text-secondary)] mb-1">WPTS ID</label>
                        <input type="text" value={form.wpts_id || ""} onChange={e => setForm({ ...form, wpts_id: e.target.value })} placeholder="Enter WPTS ID" className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-tertiary)] text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">Plan Date</label>
                            <input type="date" value={form.plan_date || ""} onChange={e => setForm({ ...form, plan_date: e.target.value })} className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-tertiary)] text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">Implementation Date</label>
                            <input type="date" value={form.impl_date || ""} onChange={e => setForm({ ...form, impl_date: e.target.value })} className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-tertiary)] text-sm" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">PIC Name</label>
                            <input type="text" value={form.pic_name || ""} onChange={e => setForm({ ...form, pic_name: e.target.value })} placeholder="Enter PIC name" className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-tertiary)] text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">PIC Email</label>
                            <input type="email" value={form.pic_email || ""} onChange={e => setForm({ ...form, pic_email: e.target.value })} placeholder="email@example.com" className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-tertiary)] text-sm" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">PIC Manager Name</label>
                            <input type="text" value={form.pic_manager || ""} onChange={e => setForm({ ...form, pic_manager: e.target.value })} placeholder="Enter manager name" className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-tertiary)] text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">PIC Manager Email</label>
                            <input type="email" value={form.pic_manager_email || ""} onChange={e => setForm({ ...form, pic_manager_email: e.target.value })} placeholder="manager@example.com" className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-tertiary)] text-sm" />
                        </div>
                    </div>
                    {/* Email notification option */}
                    <div className="p-3 bg-[var(--accent-blue)]/10 rounded-lg">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={sendEmail}
                                onChange={e => setSendEmail(e.target.checked)}
                                disabled={!form.plan_date || !form.pic_email}
                                className="w-4 h-4 accent-[var(--accent-blue)] disabled:opacity-50"
                            />
                            <Mail className="w-4 h-4 text-[var(--accent-blue)]" />
                            <span className={!form.plan_date || !form.pic_email ? "opacity-50" : ""}>
                                Send email reminder to PIC
                            </span>
                        </label>
                        {(!form.plan_date || !form.pic_email) && (
                            <p className="text-[10px] text-[var(--text-muted)] mt-1 ml-6">Fill Plan Date and PIC Email to enable</p>
                        )}
                    </div>
                </div>
                <div className="p-4 border-t border-[var(--border-light)] flex gap-3 justify-end">
                    <button onClick={onClose} className="px-4 py-2 border border-[var(--border-light)] rounded-lg text-sm font-medium">Cancel</button>
                    <button
                        onClick={() => onSave(form, sendEmail)}
                        disabled={emailSending || isSaving}
                        className="px-4 py-2 bg-[var(--accent-blue)] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                        {emailSending ? "Sending..." : isSaving ? "Saving..." : "Save"}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}

// Create Modal Component
function CreateModal({ onClose, onCreate, isCreating }: { onClose: () => void; onCreate: (name: string, planType: string, dueDate: string) => void; isCreating: boolean }) {
    const [name, setName] = useState("")
    const [planType, setPlanType] = useState("Annually")
    const [dueDate, setDueDate] = useState("")

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 z-[300] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-md"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b border-[var(--border-light)] flex items-center justify-between">
                    <h3 className="font-bold text-[var(--text-primary)]">➕ Add New OTP Program</h3>
                    <button onClick={onClose} className="p-1 hover:bg-[var(--bg-tertiary)] rounded"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-xs text-[var(--text-secondary)] mb-1">Program Name *</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter program name" className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-tertiary)] text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs text-[var(--text-secondary)] mb-1">Plan Type</label>
                        <select value={planType} onChange={e => setPlanType(e.target.value)} className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-tertiary)] text-sm">
                            <option value="Annually">Annually</option>
                            <option value="Annually / Base">Annually / Base</option>
                            <option value="Quarterly">Quarterly</option>
                            <option value="Quarterly / Base">Quarterly / Base</option>
                            <option value="Monthly">Monthly</option>
                            <option value="Monthly / Base">Monthly / Base</option>
                            <option value="Per Semester">Per Semester</option>
                            <option value="Per Semester / Base">Per Semester / Base</option>
                            <option value="One time in year">One time in year</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-[var(--text-secondary)] mb-1">Due Date</label>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-tertiary)] text-sm" />
                    </div>
                </div>
                <div className="p-4 border-t border-[var(--border-light)] flex gap-3 justify-end">
                    <button onClick={onClose} className="px-4 py-2 border border-[var(--border-light)] rounded-lg text-sm font-medium">Cancel</button>
                    <button
                        onClick={() => name && onCreate(name, planType, dueDate)}
                        disabled={!name || isCreating}
                        className="px-4 py-2 bg-[var(--accent-blue)] text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                        {isCreating ? 'Creating...' : 'Create Program'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}