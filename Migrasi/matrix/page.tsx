"use client"

import { useState, useEffect, useCallback, lazy, Suspense } from "react"
import { motion } from "framer-motion"
import { AppShell } from "@/components/layout/app-shell"
import { cn } from "@/lib/utils"
import { Download, Plus, Search, X, Check, Trash2, AlertTriangle, Mail, List, CalendarDays, FileText } from "lucide-react"
import { PageTransition, PageHeader, PageContent } from "@/components/ui/page-transition"
import { MatrixTimeline } from "@/components/matrix/MatrixTimeline"
import { MobileMatrixCard } from "@/components/matrix/MobileMatrixCard"

// Lazy load PDF button to avoid SSR issues
const MatrixPDFDownloadButton = lazy(() => import('@/components/matrix/MatrixPDFDownloadButton'))

function PDFButtonFallback() {
    return (
        <span className="px-3 py-2 bg-[var(--accent-purple)] text-white rounded-lg text-xs font-semibold opacity-50 flex items-center gap-1">
            <FileText className="w-3 h-3" /> PDF
        </span>
    )
}
import {
    getMatrixData,
    calculateProgress,
    loadPersistedData,
    savePersistedData,
    syncToCalendar,
    downloadCSV,
    categoryLabels,
    categoryIcons,
    months,
    monthLabels,
    type MatrixData,
    type MatrixProgram,
    type MatrixCategory,
    type MatrixMonthData
} from "@/lib/matrix-store"

const categories: { value: MatrixCategory; label: string }[] = [
    { value: "audit", label: "📋 Audit" },
    { value: "training", label: "📚 Training" },
    { value: "drill", label: "🚨 Emergency Drill" },
    { value: "meeting", label: "🤝 Meeting" },
]

const getCellColor = (plan: number, actual: number) => {
    if (plan === 0 && actual === 0) return "bg-[var(--bg-tertiary)]"
    if (actual >= plan && plan > 0) return "bg-[var(--success-color)]"
    if (actual > 0 && actual < plan) return "bg-[var(--warning-color)]"
    if (plan > 0 && actual === 0) return "bg-[var(--danger-color)]"
    return "bg-[var(--bg-tertiary)]"
}

export default function MatrixPage() {
    const [year, setYear] = useState(2026)
    const [category, setCategory] = useState<MatrixCategory>("audit")
    const [base, setBase] = useState("all")
    const [search, setSearch] = useState("")
    const [showActual, setShowActual] = useState(true)
    const [currentData, setCurrentData] = useState<MatrixData>({ year: 2026, category: "audit", region: "indonesia", programs: [] })
    const [editModal, setEditModal] = useState<{ programId: number; month: string } | null>(null)
    const [createModal, setCreateModal] = useState(false)
    const [deleteModal, setDeleteModal] = useState<{ programId: number; programName: string } | null>(null)
    const [emailSent, setEmailSent] = useState(false)
    const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table')

    // Load data based on category and base
    const loadData = useCallback(() => {
        const storageKey = `${category}_${base}`
        const persisted = loadPersistedData()
        if (persisted && persisted[storageKey]) {
            setCurrentData(persisted[storageKey])
        } else {
            const freshData = getMatrixData(category, base)
            setCurrentData(freshData)
        }
    }, [category, base])

    useEffect(() => {
        loadData()
    }, [loadData])

    // Calculate statistics
    const programsWithProgress = currentData.programs.map(p => ({
        ...p,
        progress: calculateProgress(p)
    }))

    const filteredPrograms = programsWithProgress.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.reference && p.reference.toLowerCase().includes(search.toLowerCase()))
    )

    const totalPrograms = filteredPrograms.length
    const completed = filteredPrograms.filter(p => p.progress >= 100).length  // >= 100 for completed
    const inProgress = filteredPrograms.filter(p => p.progress > 0 && p.progress < 100).length
    const avgProgress = totalPrograms > 0 ? Math.min(100, Math.round(filteredPrograms.reduce((sum, p) => sum + (p.progress || 0), 0) / totalPrograms)) : 0

    // Save data and sync calendar
    const saveData = (newData: MatrixData) => {
        setCurrentData(newData)
        const storageKey = `${category}_${base}`
        const persisted = loadPersistedData() || {}
        persisted[storageKey] = newData
        savePersistedData(persisted)
        console.log("Dummy: Calendar sync omitted")
    }

    // Handle edit save
    const handleEditSave = (programId: number, month: string, updates: Partial<MatrixMonthData>) => {
        const newData = { ...currentData }
        const progIndex = newData.programs.findIndex(p => p.id === programId)
        if (progIndex >= 0) {
            newData.programs[progIndex] = {
                ...newData.programs[progIndex],
                months: {
                    ...newData.programs[progIndex].months,
                    [month]: {
                        ...newData.programs[progIndex].months[month],
                        ...updates
                    }
                }
            }
            saveData(newData)
        }
        setEditModal(null)
    }

    // Handle delete
    const handleDelete = (programId: number) => {
        const newData = {
            ...currentData,
            programs: currentData.programs.filter(p => p.id !== programId)
        }
        saveData(newData)
        setDeleteModal(null)
    }

    // Handle create
    const handleCreate = (name: string, reference: string, planType: string) => {
        const newProgram: MatrixProgram = {
            id: Math.max(0, ...currentData.programs.map(p => p.id)) + 1,
            name,
            reference,
            plan_type: planType,
            months: Object.fromEntries(months.map(m => [m, { plan: 0, actual: 0 }]))
        }
        const newData = {
            ...currentData,
            programs: [...currentData.programs, newProgram]
        }
        saveData(newData)
        setCreateModal(false)
    }

    // Handle export
    const handleExport = () => {
        const baseLabel = base === "all" ? "AllBases" : base.charAt(0).toUpperCase() + base.slice(1)
        downloadCSV(currentData, categoryLabels[category], base, year)
    }

    // Get current program for edit modal
    const currentProgram = editModal ? programsWithProgress.find(p => p.id === editModal.programId) : null
    const currentMonthData = currentProgram && editModal ? (currentProgram.months[editModal.month] || { plan: 0, actual: 0 }) : null

    return (
        <AppShell>
            <PageTransition className="space-y-4">
                {/* Email sent notification */}
                {emailSent && (
                    <div className="fixed top-4 right-4 z-[400] bg-[var(--success-color)] text-white px-4 py-2 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                        <Check className="w-4 h-4" /> Email notification sent!
                    </div>
                )}

                {/* Header Section */}
                <div className="space-y-4">
                    {/* Title Row */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#16a085] to-[#1abc9c] rounded-xl flex items-center justify-center text-2xl shrink-0">
                            {categoryIcons[category]}
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <h1 className="text-xl font-bold text-[var(--text-primary)]">{year} Matrix - {categoryLabels[category]}</h1>
                            <p className="text-xs text-[var(--text-muted)]">
                                HSE Matrix Tracker - {base === "all" ? "All Bases" : base.charAt(0).toUpperCase() + base.slice(1)}
                            </p>
                        </div>
                    </div>

                    {/* Controls Row */}
                    <div className="flex flex-wrap gap-2 items-center">
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as MatrixCategory)}
                            className="px-2 py-1.5 text-xs border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]"
                        >
                            {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        <select
                            value={base}
                            onChange={(e) => setBase(e.target.value)}
                            className="px-2 py-1.5 text-xs border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]"
                        >
                            <option value="all">All Bases</option>
                            <option value="narogong">Narogong</option>
                            <option value="duri">Duri</option>
                            <option value="balikpapan">Balikpapan</option>
                        </select>
                        <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="px-2 py-1.5 text-xs border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]"
                        >
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>

                        <div className="h-6 w-px bg-[var(--border-light)] mx-1 hidden sm:block" />

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setCreateModal(true)}
                            className="p-2 bg-[var(--accent-blue)] text-white rounded-lg shadow-lg shadow-blue-500/20"
                            title="Add Program"
                        >
                            <Plus className="w-4 h-4" />
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                                localStorage.removeItem('hse-matrix-data');
                                localStorage.removeItem('hse-matrix-data-2026');
                                localStorage.removeItem('hse-matrix-data-v2');
                                window.location.reload();
                            }}
                            className="px-3 py-2 bg-red-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-lg shadow-red-500/20"
                            title="Reset all Matrix cache data"
                        >
                            <Trash2 className="w-3 h-3" /> REFRESH
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleExport}
                            className="px-3 py-2 bg-[#27ae60] text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-lg shadow-green-500/20"
                        >
                            <Download className="w-3 h-3" /> CSV
                        </motion.button>

                        {/* PDF Download */}
                        {filteredPrograms.length > 0 && (
                            <Suspense fallback={<PDFButtonFallback />}>
                                <MatrixPDFDownloadButton
                                    programs={filteredPrograms}
                                    category={category}
                                    base={base}
                                    year={year}
                                />
                            </Suspense>
                        )}

                        {/* View Mode Toggle */}
                        <div className="flex rounded-lg overflow-hidden border border-[var(--border-light)] ml-auto sm:ml-0">
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
                        </div>
                    </div>
                </div>

                {/* Dashboard Cards */}
                <PageContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <motion.div
                        whileHover={{ y: -5, scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="p-3 text-center rounded-xl shadow-lg bg-gradient-to-br from-[#16a085] to-[#1abc9c] text-white cursor-pointer"
                    >
                        <div className="text-2xl font-bold">{totalPrograms}</div>
                        <div className="text-[10px] opacity-90">Total Programs</div>
                    </motion.div>
                    <motion.div
                        whileHover={{ y: -5, scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="p-3 text-center rounded-xl shadow-lg bg-gradient-to-br from-[#27ae60] to-[#2ecc71] text-white cursor-pointer"
                    >
                        <div className="text-2xl font-bold">{completed}</div>
                        <div className="text-[10px] opacity-90">Completed</div>
                    </motion.div>
                    <motion.div
                        whileHover={{ y: -5, scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="p-3 text-center rounded-xl shadow-lg bg-gradient-to-br from-[#3498db] to-[#2980b9] text-white cursor-pointer"
                    >
                        <div className="text-2xl font-bold">{inProgress}</div>
                        <div className="text-[10px] opacity-90">In Progress</div>
                    </motion.div>
                    <motion.div
                        whileHover={{ y: -5, scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="p-3 text-center rounded-xl shadow-lg bg-gradient-to-br from-[#9b59b6] to-[#8e44ad] text-white cursor-pointer"
                    >
                        <div className="text-2xl font-bold">{avgProgress}%</div>
                        <div className="text-[10px] opacity-90">Avg Progress</div>
                    </motion.div>
                </PageContent>

                {/* Filters */}
                {/* Filters Row */}
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                        <input
                            type="text"
                            placeholder="Search programs..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 text-sm border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)] focus:outline-none focus:border-[var(--accent-blue)]"
                        />
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer text-[var(--text-secondary)]">
                        <input
                            type="checkbox"
                            checked={showActual}
                            onChange={(e) => setShowActual(e.target.checked)}
                            className="w-4 h-4 rounded accent-[var(--accent-blue)]"
                        />
                        Show Actual
                    </label>
                </div>

                {/* Timeline View */}
                {viewMode === 'timeline' && (
                    <MatrixTimeline programs={filteredPrograms} year={year} />
                )}

                {/* Mobile Card View (Visible only on mobile) */}
                <div className="block md:hidden space-y-3">
                    {filteredPrograms.length === 0 ? (
                        <div className="p-8 text-center text-[var(--text-muted)]">
                            No programs found for this category
                        </div>
                    ) : (
                        filteredPrograms.map((program, idx) => (
                            <MobileMatrixCard
                                key={program.id}
                                program={program}
                                index={idx}
                                onEdit={(id, month) => setEditModal({ programId: id, month })}
                                onDelete={(id, name) => setDeleteModal({ programId: id, programName: name })}
                                showActual={showActual}
                            />
                        ))
                    )}
                </div>

                {/* Matrix Table (Desktop only) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className={cn("bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-xl hidden md:block", viewMode === 'timeline' && "!hidden")}
                >
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[900px]">
                            <thead className="bg-[var(--bg-tertiary)]">
                                <tr>
                                    <th className="p-2 text-left font-semibold sticky left-0 bg-[var(--bg-tertiary)] z-10 w-8">#</th>
                                    <th className="p-2 text-left font-semibold sticky left-8 bg-[var(--bg-tertiary)] z-10 min-w-[180px]">Program</th>
                                    <th className="p-2 text-left font-semibold min-w-[100px]">Reference</th>
                                    {monthLabels.map(m => <th key={m} className="p-2 text-center font-semibold w-10">{m}</th>)}
                                    <th className="p-2 text-center font-semibold w-20">Progress</th>
                                    <th className="p-2 text-center font-semibold w-16">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPrograms.length === 0 ? (
                                    <tr>
                                        <td colSpan={16} className="p-8 text-center text-[var(--text-muted)]">
                                            No programs found for this category
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPrograms.map((program, idx) => (
                                        <motion.tr
                                            key={program.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05, duration: 0.3 }}
                                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                        >
                                            <td className="p-2 sticky left-0 bg-[var(--bg-secondary)] z-10">{idx + 1}</td>
                                            <td className="p-2 sticky left-8 bg-[var(--bg-secondary)] z-10 font-medium">{program.name}</td>
                                            <td className="p-2 text-[var(--text-muted)] text-[10px]">{program.reference || "-"}</td>
                                            {months.map((month, mIdx) => {
                                                const data = program.months[month] || { plan: 0, actual: 0 }
                                                return (
                                                    <td key={mIdx} className="p-1">
                                                        <div
                                                            onClick={() => setEditModal({ programId: program.id, month })}
                                                            className={cn(
                                                                "w-8 h-8 mx-auto rounded flex items-center justify-center text-white font-bold text-[10px] cursor-pointer hover:opacity-80 transition-opacity",
                                                                getCellColor(data.plan, showActual ? data.actual : 0)
                                                            )}
                                                        >
                                                            {data.plan > 0 ? (showActual ? `${data.actual}/${data.plan}` : data.plan) : ""}
                                                        </div>
                                                    </td>
                                                )
                                            })}
                                            <td className="p-2">
                                                <div className="flex items-center gap-1">
                                                    <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-[var(--success-color)] transition-all"
                                                            style={{ width: `${program.progress}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-semibold w-8">{program.progress}%</span>
                                                </div>
                                            </td>
                                            <td className="p-2 text-center">
                                                <button
                                                    onClick={() => setDeleteModal({ programId: program.id, programName: program.name })}
                                                    className="p-1.5 text-[var(--danger-color)] hover:bg-[var(--danger-color)]/10 rounded transition-colors"
                                                    title="Delete program"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 p-3 bg-[var(--bg-secondary)] rounded-lg text-xs text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 bg-[var(--success-color)] rounded" />
                        Actual ≥ Plan
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 bg-[var(--warning-color)] rounded" />
                        Actual &lt; Plan
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 bg-[var(--danger-color)] rounded" />
                        Not Started
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded" />
                        No Activity
                    </span>
                </div>

                {/* Edit Modal */}
                {editModal && currentProgram && currentMonthData && (
                    <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
                        <div className="bg-[var(--bg-primary)] rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                            <div className="p-4 border-b border-[var(--border-light)] flex justify-between items-center sticky top-0 bg-[var(--bg-primary)]">
                                <h3 className="font-bold">Edit: {currentProgram.name}</h3>
                                <button onClick={() => setEditModal(null)} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    const form = e.target as HTMLFormElement
                                    handleEditSave(editModal.programId, editModal.month, {
                                        plan: parseInt((form.elements.namedItem("plan") as HTMLInputElement).value) || 0,
                                        actual: parseInt((form.elements.namedItem("actual") as HTMLInputElement).value) || 0,
                                        wpts_id: (form.elements.namedItem("wpts_id") as HTMLInputElement).value,
                                        plan_date: (form.elements.namedItem("plan_date") as HTMLInputElement).value,
                                        impl_date: (form.elements.namedItem("impl_date") as HTMLInputElement).value,
                                        pic_name: (form.elements.namedItem("pic_name") as HTMLInputElement).value,
                                        pic_email: (form.elements.namedItem("pic_email") as HTMLInputElement).value,
                                    })
                                }}
                                className="p-4 space-y-4"
                            >
                                <div className="p-3 bg-[var(--accent-blue)]/10 rounded-lg text-sm">
                                    <strong>Month:</strong> {monthLabels[months.indexOf(editModal.month)]} {year}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Plan</label>
                                        <input name="plan" type="number" defaultValue={currentMonthData.plan} className="w-full p-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Actual</label>
                                        <input name="actual" type="number" defaultValue={currentMonthData.actual} className="w-full p-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">WPTS ID</label>
                                    <input name="wpts_id" type="text" defaultValue={currentMonthData.wpts_id || ""} className="w-full p-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]" placeholder="Enter WPTS number" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Plan Date</label>
                                        <input name="plan_date" type="date" defaultValue={currentMonthData.plan_date || ""} className="w-full p-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Implementation Date</label>
                                        <input name="impl_date" type="date" defaultValue={currentMonthData.impl_date || ""} className="w-full p-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">PIC Name</label>
                                    <input name="pic_name" type="text" defaultValue={currentMonthData.pic_name || ""} className="w-full p-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">PIC Email</label>
                                    <input name="pic_email" type="email" defaultValue={currentMonthData.pic_email || ""} className="w-full p-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]" />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setEditModal(null)} className="flex-1 p-2 border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-tertiary)]">
                                        Cancel
                                    </button>
                                    <button type="submit" className="flex-1 p-2 bg-[var(--accent-blue)] text-white rounded-lg font-semibold">
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Create Modal */}
                {createModal && (
                    <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
                        <div className="bg-[var(--bg-primary)] rounded-xl w-full max-w-md">
                            <div className="p-4 border-b border-[var(--border-light)] flex justify-between items-center">
                                <h3 className="font-bold">Add New {categoryLabels[category]} Program</h3>
                                <button onClick={() => setCreateModal(false)} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    const form = e.target as HTMLFormElement
                                    handleCreate(
                                        (form.elements.namedItem("name") as HTMLInputElement).value,
                                        (form.elements.namedItem("reference") as HTMLInputElement).value,
                                        (form.elements.namedItem("plan_type") as HTMLSelectElement).value
                                    )
                                }}
                                className="p-4 space-y-4"
                            >
                                <div>
                                    <label className="block text-xs font-medium mb-1">Program Name *</label>
                                    <input name="name" type="text" required className="w-full p-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]" placeholder="e.g. Fire Safety Audit" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Reference</label>
                                    <input name="reference" type="text" className="w-full p-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]" placeholder="e.g. IOGP CLSR and ISO 45001" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Plan Type</label>
                                    <select name="plan_type" className="w-full p-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]">
                                        <option value="Monthly">Monthly</option>
                                        <option value="Quarterly">Quarterly</option>
                                        <option value="Annually">Annually</option>
                                        <option value="As Required">As Required</option>
                                    </select>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setCreateModal(false)} className="flex-1 p-2 border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-tertiary)]">
                                        Cancel
                                    </button>
                                    <button type="submit" className="flex-1 p-2 bg-[var(--accent-blue)] text-white rounded-lg font-semibold">
                                        Create Program
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {deleteModal && (
                    <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
                        <div className="bg-[var(--bg-primary)] rounded-xl w-full max-w-sm">
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 bg-[var(--danger-color)]/10 rounded-full flex items-center justify-center">
                                    <AlertTriangle className="w-8 h-8 text-[var(--danger-color)]" />
                                </div>
                                <h3 className="text-lg font-bold mb-2">Delete Program?</h3>
                                <p className="text-sm text-[var(--text-muted)] mb-4">
                                    Are you sure you want to delete <strong>&quot;{deleteModal.programName}&quot;</strong>? This action cannot be undone.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setDeleteModal(null)}
                                        className="flex-1 p-3 border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-tertiary)] font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleDelete(deleteModal.programId)}
                                        className="flex-1 p-3 bg-[var(--danger-color)] text-white rounded-lg font-semibold"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </PageTransition>
        </AppShell>
    )
}
