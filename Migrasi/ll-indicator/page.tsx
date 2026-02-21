"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AppShell } from "@/components/layout/app-shell"
import { cn } from "@/lib/utils"
import { Download, Plus, ChevronDown, ChevronUp, Check, X, Trash2, AlertTriangle, Calendar } from "lucide-react"
import { PageTransition, PageHeader, PageContent } from "@/components/ui/page-transition"
import {
    loadLLData,
    saveLLData,
    downloadCSV,
    calculateStatus,
    iconOptions,
    getAvailableYears,
    addYear,
    type LLYearData,
    type LLIndicator
} from "@/lib/ll-indicator-store"

export default function LLIndicatorPage() {
    const [availableYears, setAvailableYears] = useState<number[]>([2024, 2025, 2026])
    const [selectedYear, setSelectedYear] = useState(2025)
    const [data, setData] = useState<LLYearData>({ year: 2025, lagging: [], leading: [] })
    const [laggingExpanded, setLaggingExpanded] = useState(true)
    const [leadingExpanded, setLeadingExpanded] = useState(true)
    const [editModal, setEditModal] = useState<{ type: "lagging" | "leading"; indicator: LLIndicator | null } | null>(null)
    const [deleteModal, setDeleteModal] = useState<{ type: "lagging" | "leading"; id: number; name: string } | null>(null)
    const [addYearModal, setAddYearModal] = useState(false)
    const [iconPicker, setIconPicker] = useState(false)
    const [selectedIcon, setSelectedIcon] = useState("📊")

    // Load available years and current year data
    useEffect(() => {
        const years = getAvailableYears()
        setAvailableYears(years)
        if (years.length > 0 && !years.includes(selectedYear)) {
            setSelectedYear(years[0])
        }
    }, [])

    // Load data when year changes
    useEffect(() => {
        const yearData = loadLLData(selectedYear)
        setData(yearData)
    }, [selectedYear])

    const saveData = (newData: LLYearData) => {
        setData(newData)
        saveLLData(selectedYear, newData)
    }

    const handleYearChange = (year: number) => {
        setSelectedYear(year)
    }

    const handleAddYear = (year: number) => {
        const newYearData = addYear(year)
        setAvailableYears(getAvailableYears())
        setSelectedYear(year)
        setData(newYearData)
        setAddYearModal(false)
    }

    const handleSave = (type: "lagging" | "leading", indicator: LLIndicator, isNew: boolean) => {
        const newData = { ...data }
        if (isNew) {
            const maxId = Math.max(0, ...newData[type].map(i => i.id))
            indicator.id = maxId + 1
            newData[type] = [...newData[type], indicator]
        } else {
            newData[type] = newData[type].map(i => i.id === indicator.id ? indicator : i)
        }
        saveData(newData)
        setEditModal(null)
    }

    const handleDelete = (type: "lagging" | "leading", id: number) => {
        const newData = { ...data }
        newData[type] = newData[type].filter(i => i.id !== id)
        saveData(newData)
        setDeleteModal(null)
    }

    const openAddModal = (type: "lagging" | "leading") => {
        setSelectedIcon(type === "lagging" ? "⚠️" : "✅")
        setEditModal({ type, indicator: null })
    }

    const openEditModal = (type: "lagging" | "leading", indicator: LLIndicator) => {
        setSelectedIcon(indicator.icon || "📊")
        setEditModal({ type, indicator })
    }

    const StatusIcon = ({ target, actual }: { target: string; actual: string }) => {
        const status = calculateStatus(target, actual)
        return status === "achieved" ? (
            <div className="w-6 h-6 bg-[var(--success-color)] rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
            </div>
        ) : status === "not-achieved" ? (
            <div className="w-6 h-6 bg-[var(--danger-color)] rounded-full flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
            </div>
        ) : (
            <div className="w-6 h-6 bg-[var(--warning-color)] rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-black">~</span>
            </div>
        )
    }

    const IndicatorTable = ({ type, indicators, expanded }: { type: "lagging" | "leading"; indicators: LLIndicator[]; expanded: boolean }) => (
        <AnimatePresence>
            {expanded && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                >
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[var(--bg-tertiary)]">
                                <tr>
                                    <th className="text-left p-3 font-semibold w-8">#</th>
                                    <th className="text-center p-3 font-semibold w-10">Icon</th>
                                    <th className="text-left p-3 font-semibold">Indicator</th>
                                    <th className="text-center p-3 font-semibold w-28">Target</th>
                                    <th className="text-center p-3 font-semibold w-20">Actual</th>
                                    <th className="text-center p-3 font-semibold w-12">Status</th>
                                    <th className="text-left p-3 font-semibold">Intent</th>
                                    <th className="text-center p-3 font-semibold w-16">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {indicators.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-6 text-center text-[var(--text-muted)]">
                                            No indicators. Click &quot;Add&quot; to create one.
                                        </td>
                                    </tr>
                                ) : (
                                    indicators.map((row, idx) => (
                                        <motion.tr
                                            key={row.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05, duration: 0.3 }}
                                            className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                                            onClick={() => openEditModal(type, row)}
                                        >
                                            <td className="p-3 text-[var(--text-muted)]">{idx + 1}</td>
                                            <td className="p-3 text-center text-lg">{row.icon || "📊"}</td>
                                            <td className="p-3 font-medium">{row.name}</td>
                                            <td className="p-3 text-center text-xs">{row.target}</td>
                                            <td className="p-3 text-center font-semibold">{row.actual}</td>
                                            <td className="p-3 text-center"><StatusIcon target={row.target} actual={row.actual} /></td>
                                            <td className="p-3 text-[var(--text-secondary)] text-xs">{row.intent}</td>
                                            <td className="p-3 text-center">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setDeleteModal({ type, id: row.id, name: row.name })
                                                    }}
                                                    className="p-1.5 text-[var(--danger-color)] hover:bg-[var(--danger-color)]/10 rounded transition-colors"
                                                    title="Delete"
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
            )}
        </AnimatePresence>
    )

    return (
        <AppShell>
            <PageTransition className="space-y-4">
                {/* Header */}
                <PageHeader className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#e74c3c] to-[#27ae60] rounded-xl flex items-center justify-center text-2xl">
                        📈
                    </div>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-[var(--text-primary)]">{selectedYear} LL Indicator</h1>
                        <p className="text-xs text-[var(--text-muted)]">Lagging & Leading Indicators</p>
                    </div>
                    <div className="flex gap-2 items-center">
                        {/* Year Selector */}
                        <select
                            value={selectedYear}
                            onChange={(e) => handleYearChange(Number(e.target.value))}
                            className="px-3 py-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)] text-sm"
                        >
                            {availableYears.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        {/* Add Year Button */}
                        <button
                            onClick={() => setAddYearModal(true)}
                            className="px-3 py-2 border border-[var(--accent-blue)] text-[var(--accent-blue)] rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-[var(--accent-blue)]/10"
                        >
                            <Calendar className="w-3 h-3" /> Add Year
                        </button>
                        {/* Download Button */}
                        <button
                            onClick={() => downloadCSV(data, selectedYear)}
                            className="px-3 py-2 bg-[#27ae60] text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                        >
                            <Download className="w-3 h-3" /> Export CSV
                        </button>
                    </div>
                </PageHeader>

                {/* Stats Summary */}
                <PageContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <motion.div
                        whileHover={{ scale: 1.02, y: -3 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="p-4 text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl"
                    >
                        <div className="text-3xl font-bold bg-gradient-to-r from-[#e74c3c] to-[#c0392b] bg-clip-text text-transparent">{data.lagging.length}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">Lagging Indicators</div>
                    </motion.div>
                    <motion.div
                        whileHover={{ scale: 1.02, y: -3 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="p-4 text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl"
                    >
                        <div className="text-3xl font-bold bg-gradient-to-r from-[#27ae60] to-[#2ecc71] bg-clip-text text-transparent">{data.leading.length}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">Leading Indicators</div>
                    </motion.div>
                    <motion.div
                        whileHover={{ scale: 1.02, y: -3 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="p-4 text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl"
                    >
                        <div className="text-3xl font-bold bg-gradient-to-r from-[#3498db] to-[#2980b9] bg-clip-text text-transparent">
                            {[...data.lagging, ...data.leading].filter(i => calculateStatus(i.target, i.actual) === "achieved").length}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">Achieved</div>
                    </motion.div>
                    <motion.div
                        whileHover={{ scale: 1.02, y: -3 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="p-4 text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl"
                    >
                        <div className="text-3xl font-bold bg-gradient-to-r from-[#f39c12] to-[#e67e22] bg-clip-text text-transparent">
                            {[...data.lagging, ...data.leading].filter(i => calculateStatus(i.target, i.actual) === "on-track").length}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">On Track</div>
                    </motion.div>
                </PageContent>

                {/* Lagging Indicators */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-xl"
                >
                    <motion.div
                        whileHover={{ scale: 1.005 }}
                        onClick={() => setLaggingExpanded(!laggingExpanded)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setLaggingExpanded(!laggingExpanded)}
                        className="w-full p-4 bg-gradient-to-r from-[#c0392b] to-[#e74c3c] text-white flex items-center justify-between cursor-pointer"
                    >
                        <span className="font-bold">⚠️ LAGGING INDICATORS ({data.lagging.length})</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); openAddModal("lagging") }}
                                className="px-2 py-1 bg-white/20 rounded text-xs font-semibold flex items-center gap-1 hover:bg-white/30"
                            >
                                <Plus className="w-3 h-3" /> Add
                            </button>
                            <motion.div animate={{ rotate: laggingExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                <ChevronDown className="w-5 h-5" />
                            </motion.div>
                        </div>
                    </motion.div>
                    <IndicatorTable type="lagging" indicators={data.lagging} expanded={laggingExpanded} />
                </motion.div>

                {/* Leading Indicators */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-xl"
                >
                    <motion.div
                        whileHover={{ scale: 1.005 }}
                        onClick={() => setLeadingExpanded(!leadingExpanded)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setLeadingExpanded(!leadingExpanded)}
                        className="w-full p-4 bg-gradient-to-r from-[#27ae60] to-[#2ecc71] text-white flex items-center justify-between cursor-pointer"
                    >
                        <span className="font-bold">✅ LEADING INDICATORS ({data.leading.length})</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); openAddModal("leading") }}
                                className="px-2 py-1 bg-white/20 rounded text-xs font-semibold flex items-center gap-1 hover:bg-white/30"
                            >
                                <Plus className="w-3 h-3" /> Add
                            </button>
                            <motion.div animate={{ rotate: leadingExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                <ChevronDown className="w-5 h-5" />
                            </motion.div>
                        </div>
                    </motion.div>
                    <IndicatorTable type="leading" indicators={data.leading} expanded={leadingExpanded} />
                </motion.div>

                {/* Add Year Modal */}
                {addYearModal && (
                    <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
                        <div className="bg-[var(--bg-primary)] rounded-xl w-full max-w-sm">
                            <div className="p-4 border-b border-[var(--border-light)] flex justify-between items-center">
                                <h3 className="font-bold">Add New Year</h3>
                                <button onClick={() => setAddYearModal(false)} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    const form = e.target as HTMLFormElement
                                    const year = parseInt((form.elements.namedItem("year") as HTMLInputElement).value)
                                    if (year && !availableYears.includes(year)) {
                                        handleAddYear(year)
                                    } else if (availableYears.includes(year)) {
                                        alert("Year already exists!")
                                    }
                                }}
                                className="p-4 space-y-4"
                            >
                                <div>
                                    <label className="block text-xs font-medium mb-1">Year</label>
                                    <input
                                        name="year"
                                        type="number"
                                        required
                                        min={2020}
                                        max={2050}
                                        defaultValue={new Date().getFullYear() + 1}
                                        className="w-full p-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)] text-lg font-bold text-center"
                                    />
                                </div>
                                <p className="text-xs text-[var(--text-muted)] text-center">
                                    This will create a new empty LL Indicator for the selected year.
                                </p>
                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setAddYearModal(false)}
                                        className="flex-1 p-2 border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-tertiary)]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 p-2 bg-[var(--accent-blue)] text-white rounded-lg font-semibold"
                                    >
                                        Add Year
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit/Add Modal */}
                {editModal && (
                    <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
                        <div className="bg-[var(--bg-primary)] rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                            <div className="p-4 border-b border-[var(--border-light)] flex justify-between items-center sticky top-0 bg-[var(--bg-primary)]">
                                <h3 className="font-bold">
                                    {editModal.indicator ? "Edit" : "Add"} {editModal.type === "lagging" ? "Lagging" : "Leading"} Indicator
                                </h3>
                                <button onClick={() => setEditModal(null)} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    const form = e.target as HTMLFormElement
                                    handleSave(editModal.type, {
                                        id: editModal.indicator?.id || 0,
                                        icon: selectedIcon,
                                        name: (form.elements.namedItem("name") as HTMLInputElement).value,
                                        target: (form.elements.namedItem("target") as HTMLInputElement).value,
                                        actual: (form.elements.namedItem("actual") as HTMLInputElement).value,
                                        intent: (form.elements.namedItem("intent") as HTMLTextAreaElement).value,
                                    }, !editModal.indicator)
                                }}
                                className="p-4 space-y-4"
                            >
                                {/* Icon Picker */}
                                <div>
                                    <label className="block text-xs font-medium mb-1">Icon</label>
                                    <button
                                        type="button"
                                        onClick={() => setIconPicker(!iconPicker)}
                                        className="w-16 h-16 text-3xl border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center"
                                    >
                                        {selectedIcon}
                                    </button>
                                    {iconPicker && (
                                        <div className="mt-2 p-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)] grid grid-cols-10 gap-1">
                                            {iconOptions.map((icon, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => { setSelectedIcon(icon); setIconPicker(false) }}
                                                    className={cn(
                                                        "w-8 h-8 text-lg rounded hover:bg-[var(--accent-blue)]/20",
                                                        selectedIcon === icon && "bg-[var(--accent-blue)]/30"
                                                    )}
                                                >
                                                    {icon}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-medium mb-1">Indicator Name *</label>
                                    <input
                                        name="name"
                                        type="text"
                                        required
                                        defaultValue={editModal.indicator?.name || ""}
                                        className="w-full p-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]"
                                        placeholder="e.g. Lost Time Injury (LTI)"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Target *</label>
                                        <input
                                            name="target"
                                            type="text"
                                            required
                                            defaultValue={editModal.indicator?.target || ""}
                                            className="w-full p-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]"
                                            placeholder="e.g. 0, 100%, Quarterly"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Actual</label>
                                        <input
                                            name="actual"
                                            type="text"
                                            defaultValue={editModal.indicator?.actual || ""}
                                            className="w-full p-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]"
                                            placeholder="e.g. 0, 95%, 2/4"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium mb-1">Intent / Description</label>
                                    <textarea
                                        name="intent"
                                        rows={2}
                                        defaultValue={editModal.indicator?.intent || ""}
                                        className="w-full p-2 border border-[var(--border-light)] rounded-lg bg-[var(--bg-secondary)]"
                                        placeholder="Purpose or goal of this indicator"
                                    />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditModal(null)}
                                        className="flex-1 p-2 border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-tertiary)]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 p-2 bg-[var(--accent-blue)] text-white rounded-lg font-semibold"
                                    >
                                        {editModal.indicator ? "Save Changes" : "Add Indicator"}
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
                                <h3 className="text-lg font-bold mb-2">Delete Indicator?</h3>
                                <p className="text-sm text-[var(--text-muted)] mb-4">
                                    Are you sure you want to delete <strong>&quot;{deleteModal.name}&quot;</strong>? This action cannot be undone.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setDeleteModal(null)}
                                        className="flex-1 p-3 border border-[var(--border-light)] rounded-lg hover:bg-[var(--bg-tertiary)] font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleDelete(deleteModal.type, deleteModal.id)}
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
