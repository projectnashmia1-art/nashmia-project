import React, { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  Check,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NashmiaCustomDatePickerProps {
  value: string; // "2026-08-18" or range "2026-08-10 to 2026-08-20" or "2026-08-10_2026-08-20"
  onChange: (dateStr: string) => void;
  error?: string;
  label?: string;
  required?: boolean;
  className?: string;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const NashmiaCustomDatePicker: React.FC<NashmiaCustomDatePickerProps> = ({
  value,
  onChange,
  error,
  label = "Loading Date",
  required = false,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to parse single or range string
  // Formats supported: "YYYY-MM-DD" or "YYYY-MM-DD to YYYY-MM-DD"
  const parseValue = (val: string) => {
    if (!val) return { startDate: "", endDate: "", isRange: false };
    if (val.includes(" to ")) {
      const [start, end] = val.split(" to ");
      return { startDate: start?.trim() || "", endDate: end?.trim() || "", isRange: true };
    }
    if (val.includes(" - ")) {
      const [start, end] = val.split(" - ");
      return { startDate: start?.trim() || "", endDate: end?.trim() || "", isRange: true };
    }
    return { startDate: val.trim(), endDate: "", isRange: false };
  };

  const parsed = parseValue(value);
  const [pickerMode, setPickerMode] = useState<"single" | "range">(
    parsed.isRange || (value && value.includes("to")) ? "range" : "range",
  );
  const [rangeStart, setRangeStart] = useState<string>(parsed.startDate || "2026-08-10");
  const [rangeEnd, setRangeEnd] = useState<string>(parsed.endDate || "2026-08-20");

  // Initial date focus
  const initialBase = parsed.startDate ? new Date(parsed.startDate) : new Date();
  const validInitialDate = isNaN(initialBase.getTime()) ? new Date() : initialBase;

  const [currentYear, setCurrentYear] = useState<number>(validInitialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(validInitialDate.getMonth()); // 0-indexed
  const [isMonthSelectorOpen, setIsMonthSelectorOpen] = useState(false);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsMonthSelectorOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update internal states when value changes externally
  useEffect(() => {
    const p = parseValue(value);
    if (p.startDate) {
      setRangeStart(p.startDate);
      const d = new Date(p.startDate);
      if (!isNaN(d.getTime())) {
        setCurrentYear(d.getFullYear());
        setCurrentMonth(d.getMonth());
      }
    }
    if (p.endDate) {
      setRangeEnd(p.endDate);
      setPickerMode("range");
    }
  }, [value]);

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Generate calendar days
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sunday

  const formatDateStr = (year: number, month: number, day: number) => {
    const formattedMonth = String(month + 1).padStart(2, "0");
    const formattedDay = String(day).padStart(2, "0");
    return `${year}-${formattedMonth}-${formattedDay}`;
  };

  const handleSelectDay = (day: number) => {
    const dateStr = formatDateStr(currentYear, currentMonth, day);

    if (pickerMode === "single") {
      setRangeStart(dateStr);
      setRangeEnd("");
      onChange(dateStr);
      setIsOpen(false);
      return;
    }

    // Range Mode:
    // If no start or both start and end exist, start fresh
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(dateStr);
      setRangeEnd("");
    } else if (rangeStart && !rangeEnd) {
      // Second click: determine chronological order
      if (new Date(dateStr) < new Date(rangeStart)) {
        setRangeEnd(rangeStart);
        setRangeStart(dateStr);
        onChange(`${dateStr} to ${rangeStart}`);
      } else {
        setRangeEnd(dateStr);
        onChange(`${rangeStart} to ${dateStr}`);
      }
    }
  };

  // Format display for input pill (e.g. 2026.08.10 - 2026.08.20 or 10 Aug – 20 Aug 2026)
  const displayFormattedDate = (val: string) => {
    if (!val) return "";
    const p = parseValue(val);
    const formatSingle = (dStr: string) => {
      if (!dStr) return "";
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return `${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })} ${d.getFullYear()}`;
    };

    if (p.isRange && p.startDate && p.endDate) {
      const d1 = new Date(p.startDate);
      const d2 = new Date(p.endDate);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        if (d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()) {
          return `${d1.getDate()} – ${d2.getDate()} ${d1.toLocaleString("en-GB", { month: "short" })} ${d1.getFullYear()} (Date Range)`;
        }
        return `${formatSingle(p.startDate)} → ${formatSingle(p.endDate)}`;
      }
      return `${p.startDate} to ${p.endDate}`;
    }

    return formatSingle(p.startDate || val);
  };

  const today = new Date();
  const isCurrentToday = (day: number) =>
    today.getFullYear() === currentYear &&
    today.getMonth() === currentMonth &&
    today.getDate() === day;

  // Range helper checks for date cells
  const getDayDateObj = (day: number) => new Date(currentYear, currentMonth, day);

  const isStartDay = (day: number) => {
    if (!rangeStart) return false;
    const d = new Date(rangeStart);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth && d.getDate() === day;
  };

  const isEndDay = (day: number) => {
    if (!rangeEnd) return false;
    const d = new Date(rangeEnd);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth && d.getDate() === day;
  };

  const isInRange = (day: number) => {
    if (!rangeStart || !rangeEnd) return false;
    const current = getDayDateObj(day);
    const s = new Date(rangeStart);
    const e = new Date(rangeEnd);
    return current > s && current < e;
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Label */}
      {label && (
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          <span className="rounded-md bg-[#6A80A9]/10 px-2 py-0.5 text-[10.5px] font-semibold text-[#6A80A9]">
            {value && (value.includes("to") || value.includes("-"))
              ? "Date Range (Flex Window)"
              : "Specific Date"}
          </span>
        </div>
      )}

      {/* Input Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between rounded-[18px] border bg-white/95 px-4 py-3.5 text-sm font-medium transition-all duration-200 text-left",
          "shadow-xs hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6A80A9]/20",
          isOpen ? "border-[#6A80A9] ring-2 ring-[#6A80A9]/20" : "border-slate-200/90",
          error && !value ? "border-rose-400 bg-rose-50/30" : "",
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#E8F1F3] text-[#24828E]">
            <CalendarIcon className="size-4 stroke-[2]" />
          </div>
          <span
            className={cn(
              "text-[13.5px] truncate",
              value ? "font-semibold text-slate-900" : "text-slate-400 font-normal",
            )}
          >
            {value
              ? displayFormattedDate(value)
              : "Select loading date or range (e.g. 10–20 Aug)..."}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-slate-400 transition-transform duration-200 ml-2",
            isOpen && "rotate-180 text-black",
          )}
        />
      </button>

      {error && !value && <p className="mt-1 text-[11px] font-medium text-rose-500">{error}</p>}

      {/* Floating Dropdown Calendar Popup with Single & Range Support (Compact & Clean) */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 mt-1.5 w-[290px] sm:w-[305px] rounded-[20px] border border-slate-200/90 bg-white p-3.5",
            "shadow-[0_16px_40px_rgba(15,23,42,0.12),0_2px_8px_rgba(15,23,42,0.04)] select-none",
            "animate-in fade-in zoom-in-95 duration-150",
          )}
        >
          {/* Mode Switcher Tabs (Date Range vs Single Date) */}
          <div className="mb-2.5 flex rounded-lg bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setPickerMode("range")}
              className={cn(
                "flex-1 rounded-md py-1 text-[11px] font-bold transition-all text-center",
                pickerMode === "range"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800",
              )}
            >
              📅 Date Range
            </button>
            <button
              type="button"
              onClick={() => {
                setPickerMode("single");
                if (rangeStart) {
                  setRangeEnd("");
                  onChange(rangeStart);
                }
              }}
              className={cn(
                "flex-1 rounded-md py-1 text-[11px] font-bold transition-all text-center",
                pickerMode === "single"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800",
              )}
            >
              Single Date
            </button>
          </div>

          {/* Range Summary Banner when in range mode */}
          {pickerMode === "range" && (
            <div className="mb-2.5 rounded-lg border border-[#6A80A9]/20 bg-[#E8F1F3]/80 px-2.5 py-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-700">
                <span className="font-bold text-[#6A80A9] uppercase tracking-wider text-[10px]">
                  Range:
                </span>
                <span className="font-semibold text-slate-900">
                  {rangeStart ? rangeStart.slice(5) : "Start"}
                  {"  →  "}
                  {rangeEnd ? rangeEnd.slice(5) : "End"}
                </span>
              </div>
            </div>
          )}

          {/* Header Row: Month/Year and Capsule `< | >` Buttons */}
          <div className="flex items-center justify-between pb-2">
            {/* Year & Month title */}
            <button
              type="button"
              onClick={() => setIsMonthSelectorOpen(!isMonthSelectorOpen)}
              className="flex items-center gap-1 text-[13.5px] font-bold text-slate-900 transition-colors hover:text-[#6A80A9]"
            >
              <span>
                {currentYear}년 {currentMonth + 1}월 (
                {new Date(currentYear, currentMonth, 1).toLocaleString("en-GB", {
                  month: "short",
                })}
                )
              </span>
              <ChevronDown className="size-3.5 text-slate-400" />
            </button>

            {/* Navigation Pill `< | >` */}
            <div className="flex items-center rounded-full border border-slate-200/90 bg-white px-1 py-0.5 shadow-xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="flex size-5 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-black"
                aria-label="Previous Month"
              >
                <ChevronLeft className="size-3.5 stroke-[2]" />
              </button>
              <span className="mx-0.5 h-2.5 w-px bg-slate-200" />
              <button
                type="button"
                onClick={handleNextMonth}
                className="flex size-5 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-black"
                aria-label="Next Month"
              >
                <ChevronRight className="size-3.5 stroke-[2]" />
              </button>
            </div>
          </div>

          {/* Quick Month Selector overlay */}
          {isMonthSelectorOpen ? (
            <div className="grid grid-cols-3 gap-1.5 py-2">
              {Array.from({ length: 12 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setCurrentMonth(i);
                    setIsMonthSelectorOpen(false);
                  }}
                  className={cn(
                    "rounded-lg py-1.5 text-[11px] font-semibold transition-all",
                    currentMonth === i
                      ? "bg-[#6A80A9] text-white shadow-xs"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {i + 1}월 ({new Date(2026, i, 1).toLocaleString("en-GB", { month: "short" })})
                </button>
              ))}
            </div>
          ) : (
            <>
              {/* Day of Week Row */}
              <div className="grid grid-cols-7 text-center pb-1">
                {WEEKDAYS_EN.map((day, idx) => (
                  <div key={idx} className="text-[10.5px] font-semibold text-slate-400 py-0.5">
                    {day}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-y-0.5 text-center">
                {/* Empty cells before month starts */}
                {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="size-7 sm:size-8" />
                ))}

                {/* Days in Month */}
                {Array.from({ length: daysInMonth }, (_, idx) => {
                  const day = idx + 1;
                  const isStart = isStartDay(day);
                  const isEnd = isEndDay(day);
                  const inBetween = isInRange(day);
                  const isSingleSelected = pickerMode === "single" && isStart;
                  const isToday = isCurrentToday(day);

                  return (
                    <div
                      key={day}
                      className={cn(
                        "relative flex size-7 sm:size-8 items-center justify-center",
                        inBetween && "bg-[#E8F1F3]/90",
                        isStart && rangeEnd && "rounded-l-full bg-[#E8F1F3]/90",
                        isEnd && rangeStart && "rounded-r-full bg-[#E8F1F3]/90",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectDay(day)}
                        className={cn(
                          "size-7 sm:size-7.5 rounded-full text-[11.5px] font-medium transition-all duration-150 flex items-center justify-center z-10",
                          isStart || isEnd || isSingleSelected
                            ? "bg-[#6A80A9] text-white font-bold shadow-xs scale-105"
                            : inBetween
                              ? "text-slate-900 font-semibold hover:bg-[#6A80A9]/30"
                              : "text-slate-800 hover:bg-[#E8F1F3] hover:text-[#6A80A9]",
                        )}
                      >
                        {day}
                      </button>

                      {/* Small Today Dot Indicator */}
                      {isToday && !isStart && !isEnd && (
                        <span className="absolute bottom-0.5 size-1 rounded-full bg-[#6A80A9]" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Dropdown Bottom Actions */}
              <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    setRangeStart(todayStr);
                    setRangeEnd("");
                    onChange(todayStr);
                  }}
                  className="text-[11px] font-semibold text-[#6A80A9] hover:underline"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-md bg-black px-3 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 transition-colors"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
