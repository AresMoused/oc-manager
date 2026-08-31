/** 陪玩姬 tool protocol, aligned with 智绘姬 SystemQuery. */

import type { Character } from "@/lib/types";
import {
  loadParams,
  loadPromptPresets,
  loadSettings,
  loadWorkflows,
  runSavedComfyJob,
} from "@/lib/comfyConfig";
import { characterCardText } from "@/lib/characterChat";

export interface ZhiTaskStep {
  title: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  result: string;
}

export interface ZhiTask {
  title: string;
  steps: ZhiTaskStep[];
}

export const TOOL_INSTRUCTION = `需要查资料、生图、改抽卡姬配置时，用工具（对用户可见的正文里不要出现这些标签）：
<SystemQuery>{"type":"task_create","title":"短标题","steps":["步骤1","步骤2"]}</SystemQuery>
<SystemQuery>{"type":"load_module","module":"characters"}</SystemQuery>
<SystemQuery>{"type":"read","path":"characters"}</SystemQuery>
<SystemQuery>{"type":"read","path":"characters.角色名"}</SystemQuery>
<SystemQuery>{"type":"generate_image","characterName":"角色名","extra":"服装或场景，如 bikini, beach"}</SystemQuery>
<SystemQuery>{"type":"task_update","step":1,"status":"completed","result":"简述"}</SystemQuery>
<SystemQuery>{"type":"ui_action","action":"goto","path":"/comfy"}</SystemQuery>

module: characters | comfy | generator | sheet
path: characters / characters.名 / comfy / comfy.presets
generate_image 会用该角色「提示词库」里最匹配的一条（可用 extra 匹配「成熟」等标签）加上 extra 去抽卡姬出图。没有工作流时不要假装已经出图。
先 load_module 再 read，不要编造角色是否存在。一次可以发多条 SystemQuery。`;

const MODULES: Record<string, string> = {
  characters: `===== 角色管理模块 =====
read characters → 全部角色摘要（姓名、世界、身份、提示词标签）
read characters.角色名 → 卡面摘要 + 提示词库（label/text）+ 图库数量
生成图时用 generate_image.characterName 指定角色，extra 写服装/场景/要哪条词库（如「成熟」）。
OC Manager 没有 NovelAI 角色参考图预设；角色一致性靠提示词库 + 抽卡姬工作流。`,
  comfy: `===== 抽卡姬 / ComfyUI =====
read comfy → 地址、当前工作流、是否可生图
read comfy.presets → 抽卡姬提示词预设名
generate_image 使用当前保存的工作流和采样参数。
没工作流时引导用户打开 /comfy 上传 API 格式工作流。
ui_action goto /comfy 可跳转。`,
  generator: `===== 外观生成器 =====
词库在「角色外观生成器」。陪玩姬不能直接改词库开关。
可根据角色提示词给 Danbooru 词，或用 <apply> addPrompt 建议写入卡。`,
  sheet: `===== 角色卡 =====
改卡用 <apply>JSON</apply>，等用户点应用。
fields: story identity residence faction affiliation race gender age height weight birthplace
addPrompt / addTimeline 可选。`,
};

export function extractSystemQueries(raw: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<SystemQuery>([\s\S]*?)<\/SystemQuery>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(raw || "")))) {
    try {
      const j = JSON.parse(m[1]!.trim());
      if (j && typeof j === "object") out.push(j as Record<string, unknown>);
    } catch {
      /* skip */
    }
  }
  return out;
}

export function stripSystemQueries(raw: string): string {
  return String(raw || "")
    .replace(/<SystemQuery>[\s\S]*?<\/SystemQuery>/gi, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

function findCharacters(list: Character[], q: string): Character[] {
  const n = q.trim().toLowerCase();
  if (!n) return [];
  const exact = list.filter((c) => c.name.toLowerCase() === n);
  if (exact.length) return exact;
  return list.filter(
    (c) =>
      c.name.toLowerCase().includes(n) ||
      n.includes(c.name.toLowerCase()) ||
      (c.prompts || []).some((p) => (p.label || "").toLowerCase().includes(n))
  );
}

function pickPrompt(c: Character, hint: string) {
  const prompts = c.prompts || [];
  if (!prompts.length) return null;
  const h = hint.toLowerCase();
  const scored = prompts.map((p) => {
    const lab = (p.label || "").toLowerCase();
    const text = (p.text || "").toLowerCase();
    let s = 0;
    if (lab && h.includes(lab)) s += 5;
    if (lab && lab.split(/[\s,_-]+/).some((w) => w && h.includes(w))) s += 3;
    if (h.includes("成熟") && (lab.includes("成熟") || text.includes("mature"))) s += 4;
    if (h.includes("幼") && lab.includes("幼")) s += 4;
    return { p, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return (scored[0]!.s > 0 ? scored[0]!.p : prompts[0]) || null;
}

function charSummary(c: Character) {
  return {
    id: c.id,
    name: c.name,
    world: c.world,
    identity: c.identity,
    age: c.age,
    gender: c.gender,
    race: c.race,
    promptLabels: (c.prompts || []).map((p) => p.label || "(未命名)"),
    promptCount: (c.prompts || []).length,
    galleryCount: (c.gallery || []).length,
  };
}

export type ZhiToolCtx = {
  characters: Character[];
  pageCharacter?: Character;
  pathname: string;
  signal?: AbortSignal;
  task: ZhiTask | null;
  onTask: (t: ZhiTask | null) => void;
  onStatus: (s: string) => void;
  onGoto?: (path: string) => void;
};

export async function runQueries(
  queries: Record<string, unknown>[],
  ctx: ZhiToolCtx
): Promise<{ text: string; images: string[]; characterId?: string }> {
  const lines: string[] = [];
  const images: string[] = [];
  let task = ctx.task;
  let characterId: string | undefined;

  for (const q of queries) {
    const type = String(q.type || "");
    try {
      if (type === "task_create") {
        const steps = Array.isArray(q.steps) ? q.steps.map(String) : [];
        task = {
          title: String(q.title || "任务"),
          steps: steps.map((title, i) => ({
            title,
            status: i === 0 ? "in_progress" : "pending",
            result: "",
          })),
        };
        ctx.onTask(task);
        lines.push(`✅ 任务创建：${task.title}（${task.steps.length} 步）`);
      } else if (type === "task_update") {
        if (!task) {
          lines.push("没有进行中的任务");
          continue;
        }
        const i = Math.max(0, Number(q.step || 1) - 1);
        if (task.steps[i]) {
          task = {
            ...task,
            steps: task.steps.map((s, idx) =>
              idx === i
                ? {
                    ...s,
                    status: (String(q.status || "completed") as ZhiTaskStep["status"]) || "completed",
                    result: String(q.result || ""),
                  }
                : s
            ),
          };
          ctx.onTask(task);
          lines.push(`步骤 ${i + 1} → ${task.steps[i]!.status} ${task.steps[i]!.result}`);
        }
      } else if (type === "load_module") {
        const mod = String(q.module || "").toLowerCase();
        const body = MODULES[mod] || MODULES.characters;
        lines.push(`【系统自动回复 - 加载模块: ${mod || "characters"}】\n${body}`);
      } else if (type === "read" || type === "browse") {
        lines.push(handleRead(String(q.path || ""), ctx.characters));
      } else if (type === "generate_image") {
        ctx.onStatus("抽卡姬出图中…");
        const characterName = String(q.characterName || q.character || "");
        const extra = String(q.extra || q.prompt || "");
        const hits = characterName ? findCharacters(ctx.characters, characterName) : [];
        const c = hits[0] || ctx.pageCharacter;
        if (c) characterId = c.id;
        let characterPrompt = "";
        let usedLabel = "";
        if (c) {
          const picked = pickPrompt(c, `${characterName} ${extra}`);
          if (picked) {
            characterPrompt = picked.text;
            usedLabel = picked.label || "";
          }
        }
        const suffix = extra
          .replace(new RegExp(characterName, "ig"), "")
          .replace(/角色管理|那个|一下|帮我|生成|一张|图片/g, "")
          .trim();
        const job = await runSavedComfyJob(
          {
            prompt_character: characterPrompt || extra,
            prompt_suffix: characterPrompt ? suffix : "",
          },
          ctx.signal
        );
        images.push(...job.urls);
        lines.push(
          [
            `✅ 已出图 ${job.urls.length} 张`,
            c ? `角色：${c.name}${usedLabel ? `（词库 ${usedLabel}）` : ""}` : "未绑定角色卡，只用了 extra/prompt",
            `seed ${job.seed}`,
            `prompt: ${job.prompt.slice(0, 400)}`,
            `urls:\n${job.urls.join("\n")}`,
          ].join("\n")
        );
      } else if (type === "ui_action") {
        const action = String(q.action || "");
        const path = String(q.path || q.value || "");
        if ((action === "goto" || action.startsWith("switch_tab") || action === "open") && path.startsWith("/")) {
          ctx.onGoto?.(path);
          lines.push(`已跳转 ${path}`);
        } else if (action.includes("char_ref") || action.includes("novelai")) {
          lines.push("OC Manager 没有 NovelAI 角色参考对话框。请用 read characters 和 generate_image。");
        } else {
          lines.push(`未实现的 ui_action: ${action}`);
        }
      } else {
        lines.push(`未知工具 ${type}`);
      }
    } catch (e) {
      lines.push(`❌ ${type} 失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { text: lines.join("\n\n───────────────\n"), images, characterId };
}

function handleRead(path: string, characters: Character[]): string {
  const p = path.trim();
  const low = p.toLowerCase();
  if (!p || low === "characters" || low.startsWith("novelai.charref")) {
    return (
      `【角色列表 ${characters.length}】\n` +
      characters.map((c) => JSON.stringify(charSummary(c))).join("\n")
    );
  }
  if (low === "comfy" || low === "comfyui") {
    const s = loadSettings();
    const wfs = loadWorkflows();
    const active = wfs.find((w) => w.id === s.activeWorkflowId) || wfs[0];
    const params = loadParams();
    return JSON.stringify(
      {
        baseUrl: s.baseUrl,
        workflowCount: wfs.length,
        activeWorkflow: active?.name || null,
        ready: !!active,
        size: `${params.width}x${params.height}`,
        steps: params.steps,
      },
      null,
      2
    );
  }
  if (low === "comfy.presets") {
    const list = loadPromptPresets();
    return list.length
      ? list.map((x) => `- ${x.name}`).join("\n")
      : "抽卡姬还没有提示词预设";
  }
  const name = p.replace(/^characters\./i, "").replace(/^character\./i, "");
  const hits = findCharacters(characters, name);
  if (!hits.length) return `没有找到角色「${name}」。当前有：${characters.map((c) => c.name).join("、") || "（空）"}`;
  return hits
    .map((c) => {
      const prompts = (c.prompts || [])
        .map((pr) => `· [${pr.label || "未命名"}] ${pr.text.slice(0, 280)}`)
        .join("\n");
      return `【${c.name}】\n${characterCardText(c, [c], 4)}\n提示词库：\n${prompts || "（空）"}`;
    })
    .join("\n\n");
}