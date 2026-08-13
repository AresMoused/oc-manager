"use client";

import { useState } from "react";
import { TimelineEvent } from "@/lib/types";
import SectionHeader from "./SectionHeader";

interface Props {
  events: TimelineEvent[];
  onAdd: (event: Omit<TimelineEvent, "id">) => void;
  onUpdate: (id: string, updates: Partial<TimelineEvent>) => void;
  onDelete: (id: string) => void;
  editable?: boolean;
}

export default function Timeline({
  events,
  onAdd,
  onUpdate,
  onDelete,
  editable = true,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: "",
    title: "",
    description: "",
    importance: "normal" as TimelineEvent["importance"],
  });

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onAdd(form);
    setForm({ date: "", title: "", description: "", importance: "normal" });
    setShowForm(false);
  };

  const importanceColor = {
    normal: "bg-neutral-600",
    major: "bg-amber-500",
    critical: "bg-rose-500",
  };

  return (
    <div>
      <SectionHeader
        title="时间线 / Timeline"
        onAdd={editable ? () => setShowForm(true) : undefined}
      />
      <div className="bg-[#111] border border-neutral-800 border-t-0 rounded-b-md p-4">
        {showForm && (
          <div className="mb-4 p-3 bg-[#0a0a0a] border border-purple-800/50 rounded-lg space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Date (e.g. Year 3 / 2024-05)"
                className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm outline-none focus:border-purple-500"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
              <select
                className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm outline-none focus:border-purple-500"
                value={form.importance}
                onChange={(e) =>
                  setForm({
                    ...form,
                    importance: e.target.value as TimelineEvent["importance"],
                  })
                }
              >
                <option value="normal">Normal</option>
                <option value="major">Major</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <input
              placeholder="Event title"
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm outline-none focus:border-purple-500"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <textarea
              placeholder="Description..."
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm outline-none focus:border-purple-500 min-h-[60px]"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-3 py-1 text-sm text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-500 rounded text-white"
              >
                Add Event
              </button>
            </div>
          </div>
        )}

        {events.length === 0 ? (
          <p className="text-neutral-500 text-sm text-center py-6">
            No events yet. Click + to record a major event.
          </p>
        ) : (
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-neutral-700" />
            {events.map((ev) => (
              <div key={ev.id} className="relative">
                <div
                  className={`absolute -left-4 top-1.5 w-3 h-3 rounded-full border-2 border-[#111] ${importanceColor[ev.importance || "normal"]}`}
                />
                <div className="bg-[#0a0a0a] border border-neutral-800 rounded-lg p-3 group">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-purple-400 font-mono">
                          {ev.date || "Unknown"}
                        </span>
                        {ev.importance && ev.importance !== "normal" && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              ev.importance === "critical"
                                ? "bg-rose-900/50 text-rose-300"
                                : "bg-amber-900/50 text-amber-300"
                            }`}
                          >
                            {ev.importance}
                          </span>
                        )}
                      </div>
                      <h4 className="font-medium text-neutral-100">
                        {ev.title}
                      </h4>
                      {ev.description && (
                        <p className="text-sm text-neutral-400 mt-1 leading-relaxed">
                          {ev.description}
                        </p>
                      )}
                    </div>
                    {editable && (
                      <button
                        onClick={() => onDelete(ev.id)}
                        className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-rose-400 text-xs transition"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
