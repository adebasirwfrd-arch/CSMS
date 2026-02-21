export type MatrixCategory = "audit" | "training" | "drill" | "meeting"

export interface MatrixMonthData {
    plan: number
    actual: number
    wpts_id?: string
    plan_date?: string
    impl_date?: string
    pic_name?: string
    pic_email?: string
}

export interface MatrixProgram {
    id: number
    name: string
    reference?: string
    plan_type: string
    months: Record<string, MatrixMonthData>
    progress?: number
}

export interface MatrixData {
    year: number
    category: MatrixCategory
    region: string
    programs: MatrixProgram[]
}

export const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
export const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export const categoryLabels: Record<MatrixCategory, string> = {
    audit: "Audit",
    training: "Training",
    drill: "Emergency Drill",
    meeting: "Meeting"
}

export const categoryIcons: Record<MatrixCategory, string> = {
    audit: "📋",
    training: "📚",
    drill: "🚨",
    meeting: "🤝"
}

export function getMatrixData(category: MatrixCategory, base: string): MatrixData {
    return {
        year: 2026,
        category,
        region: "indonesia",
        programs: []
    }
}

export function calculateProgress(program: MatrixProgram): number {
    return 0
}

export function loadPersistedData(): any {
    return null
}

export function savePersistedData(data: any) {
    console.log("Mock save data", data)
}

export function syncToCalendar(data: any) {
    console.log("Mock calendar sync disabled")
}

export function downloadCSV(data: any, title: string, base: string, year: number) {
    console.log("Mock CSV download", title, base, year)
}
