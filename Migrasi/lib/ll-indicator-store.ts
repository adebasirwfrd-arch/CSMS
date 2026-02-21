// LL Indicator Store - State management with multi-year localStorage persistence
import llData from "./ll_indicator.json"

export interface LLIndicator {
    id: number
    name: string
    icon: string
    target: string
    actual: string
    intent: string
}

export interface LLYearData {
    year: number
    lagging: LLIndicator[]
    leading: LLIndicator[]
}

export interface LLDataStore {
    years: number[]
    data: Record<number, LLYearData>
}

// LocalStorage key
const STORAGE_KEY = "hse-ll-indicator-v2"

// Get default years
const defaultYears = [2024, 2025, 2026]

// Load initial data from JSON (for year 2025)
export function getInitialData(): LLYearData {
    return llData as LLYearData
}

// Create empty year data
export function createEmptyYearData(year: number): LLYearData {
    return {
        year,
        lagging: [],
        leading: []
    }
}

// Load all years from localStorage
export function loadLLStore(): LLDataStore {
    if (typeof window === "undefined") {
        return {
            years: defaultYears,
            data: { 2025: getInitialData() }
        }
    }
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            return JSON.parse(stored)
        }
        // Initialize with default data
        const initialData = getInitialData()
        return {
            years: defaultYears,
            data: {
                2024: createEmptyYearData(2024),
                2025: initialData,
                2026: createEmptyYearData(2026)
            }
        }
    } catch {
        return {
            years: defaultYears,
            data: { 2025: getInitialData() }
        }
    }
}

// Load data for specific year
export function loadLLData(year: number): LLYearData {
    const store = loadLLStore()
    return store.data[year] || createEmptyYearData(year)
}

// Save entire store to localStorage
export function saveLLStore(store: LLDataStore): void {
    if (typeof window === "undefined") return
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    } catch (e) {
        console.error("Failed to save LL data:", e)
    }
}

// Save data for specific year
export function saveLLData(year: number, data: LLYearData): void {
    const store = loadLLStore()
    store.data[year] = data
    if (!store.years.includes(year)) {
        store.years.push(year)
        store.years.sort((a, b) => b - a) // Descending order
    }
    saveLLStore(store)
}

// Add new year
export function addYear(year: number): LLYearData {
    const store = loadLLStore()
    if (!store.years.includes(year)) {
        store.years.push(year)
        store.years.sort((a, b) => b - a)
        store.data[year] = createEmptyYearData(year)
        saveLLStore(store)
    }
    return store.data[year] || createEmptyYearData(year)
}

// Get available years
export function getAvailableYears(): number[] {
    const store = loadLLStore()
    return store.years.sort((a, b) => b - a)
}

// Calculate status based on target and actual
export function calculateStatus(target: string, actual: string): "achieved" | "not-achieved" | "on-track" {
    // For numeric targets like "0"
    if (target === "0") {
        return actual === "0" ? "achieved" : "not-achieved"
    }

    // For percentage targets like "100%"
    if (target.includes("%") && actual.includes("%")) {
        const targetNum = parseFloat(target.replace("%", ""))
        const actualNum = parseFloat(actual.replace("%", ""))
        if (actualNum >= targetNum) return "achieved"
        if (actualNum >= targetNum * 0.8) return "on-track"
        return "not-achieved"
    }

    // For ratio targets like "0/4", "3/4"
    if (actual.includes("/")) {
        const [done, total] = actual.split("/").map(n => parseInt(n))
        if (done >= total) return "achieved"
        if (done > 0) return "on-track"
        return "not-achieved"
    }

    // Default to on-track
    return "on-track"
}

// Generate CSV export
export function generateCSV(data: LLYearData): string {
    let csv = "Type,#,Icon,Indicator Name,Target,Actual,Intent\n"

    data.lagging.forEach((ind, idx) => {
        csv += `Lagging,${idx + 1},"${ind.icon}","${ind.name.replace(/"/g, '""')}","${ind.target}","${ind.actual}","${(ind.intent || "").replace(/"/g, '""')}"\n`
    })

    data.leading.forEach((ind, idx) => {
        csv += `Leading,${idx + 1},"${ind.icon}","${ind.name.replace(/"/g, '""')}","${ind.target}","${ind.actual}","${(ind.intent || "").replace(/"/g, '""')}"\n`
    })

    return csv
}

// Download CSV
export function downloadCSV(data: LLYearData, year: number): void {
    const csv = generateCSV(data)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `HSE_LL_Indicator_${year}.csv`
    link.click()
}

// Common emoji icons for LL Indicators
export const iconOptions = [
    "💀", "🏥", "🩹", "🚗", "🌿", "🔥", "🩺", "⚕️", "🏠", "🤒", "⚠️",
    "📋", "👔", "👨‍💼", "📅", "🔧", "📚", "💉", "📝", "🔍", "📢", "🗓️",
    "✅", "❌", "💚", "💛", "❤️", "⭐", "🎯", "📊", "📈", "🛡️", "🔒",
    "🚨", "🏆", "👷", "🦺", "🧯", "🚑", "⛑️", "🔬", "💼"
]
