/**
 * Parses date filter strings for transaction queries.
 *
 * - Date-only format (YYYY-MM-DD):
 *   - startDate (isEnd=false): beginning of that calendar day in UTC (00:00:00.000Z)
 *   - endDate (isEnd=true): end of that calendar day in UTC (23:59:59.999Z)
 * - Timestamp format: preserves the explicit time and timezone semantics
 */
export function parseDateFilter(dateStr: string, isEnd: boolean = false): Date {
    const trimmed = dateStr.trim();
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
    if (isDateOnly) {
        return new Date(isEnd ? `${trimmed}T23:59:59.999Z` : `${trimmed}T00:00:00.000Z`);
    }
    return new Date(trimmed);
}
