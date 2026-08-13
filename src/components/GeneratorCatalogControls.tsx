"use client";

export function CatalogToolbar({
  editMode,
  onToggleEdit,
  onExport,
  onImportFile,
  onAddSection,
}: {
  editMode: boolean;
  onToggleEdit: () => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onAddSection: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={onToggleEdit}
        className={`px-3 py-1.5 text-sm rounded-lg border ${
          editMode
            ? "border-amber-500 text-amber-300 bg-amber-950/30"
            : "border-neutral-700 text-neutral-300 hover:bg-neutral-800"
        }`}
      >
        {editMode ? "退出编辑" : "编辑词库"}
      </button>
      <button
        type="button"
        onClick={onExport}
        className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
      >
        导出 JSON
      </button>
      <label className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 cursor-pointer">
        导入 JSON
        <input
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportFile(f);
            e.target.value = "";
          }}
        />
      </label>
      {editMode && (
        <button
          type="button"
          onClick={onAddSection}
          className="px-3 py-1.5 text-sm rounded-lg bg-amber-700 hover:bg-amber-600 text-white"
        >
          + 添加分区
        </button>
      )}
    </div>
  );
}

export function ItemEditorModal({
  editor,
  onChange,
  onClose,
  onSave,
}: {
  editor: {
    sectionKey: string;
    index: number | null;
    name: string;
    tags: string;
    hex: string;
  };
  onChange: (next: typeof editor) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#111] border border-neutral-700 rounded-xl p-5 space-y-3">
        <h2 className="text-lg font-semibold text-white">
          {editor.index === null ? "添加提示词" : "编辑提示词"}
        </h2>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">名称</label>
          <input
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
            value={editor.name}
            onChange={(e) => onChange({ ...editor, name: e.target.value })}
            placeholder="blonde hair"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">
            tags（写入提示词）
          </label>
          <input
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-purple-500"
            value={editor.tags}
            onChange={(e) => onChange({ ...editor, tags: e.target.value })}
            placeholder="blonde hair, "
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">
            色块 hex（可选）
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              className="w-10 h-9 rounded border border-neutral-700 bg-transparent cursor-pointer"
              value={
                editor.hex && /^#[0-9A-Fa-f]{6}$/.test(editor.hex)
                  ? editor.hex
                  : "#888888"
              }
              onChange={(e) => onChange({ ...editor, hex: e.target.value })}
            />
            <input
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-purple-500"
              value={editor.hex}
              onChange={(e) => onChange({ ...editor, hex: e.target.value })}
              placeholder="#E6C870"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400">
            取消
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export function SectionEditorModal({
  editor,
  onChange,
  onClose,
  onSave,
}: {
  editor: {
    key: string | null;
    sectionKey: string;
    label: string;
    icon: string;
    desc: string;
  };
  onChange: (next: typeof editor) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#111] border border-neutral-700 rounded-xl p-5 space-y-3">
        <h2 className="text-lg font-semibold text-white">
          {editor.key === null ? "添加分区" : "编辑分区"}
        </h2>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">
            key（英文标识）
          </label>
          <input
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-purple-500"
            value={editor.sectionKey}
            onChange={(e) =>
              onChange({ ...editor, sectionKey: e.target.value })
            }
            placeholder="hair_color"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">显示名称</label>
          <input
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
            value={editor.label}
            onChange={(e) => onChange({ ...editor, label: e.target.value })}
            placeholder="发色"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">
            图标文字（可选）
          </label>
          <input
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
            value={editor.icon}
            onChange={(e) => onChange({ ...editor, icon: e.target.value })}
            placeholder="HrC"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">描述</label>
          <input
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
            value={editor.desc}
            onChange={(e) => onChange({ ...editor, desc: e.target.value })}
            placeholder="可选说明"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400">
            取消
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
