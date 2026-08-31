/** 陪玩姬 tool protocol, aligned with 智绘姬 SystemQuery. */

import type { AppearanceProfile, Character, OutfitPreset } from "@/lib/types";
import {
  loadParams,
  loadPromptPresets,
  loadSettings,
  loadWorkflows,
  runSavedComfyJob,
} from "@/lib/comfyConfig";
import { rollLexiconHint } from "@/lib/comfyLexicon";
import { characterCardText } from "@/lib/characterChat";
import {
  appearanceOf,
  appearanceSummary,
  composeAppearancePrompt,
} from "@/lib/appearance";

export interface ZhiTaskStep {
  title: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  result: string;
}

export interface ZhiTask {
  title: string;
  steps: ZhiTaskStep[];
}

export const TOOL_INSTRUCTION = `你可以决定要不要出图。画面有明确视觉（换装、新场景、用户要看图、关键动作）时，对用户说完后追加 generate_image；闲聊、纯问答不要出图。

工具（对用户可见正文里不要出现这些标签）：
<SystemQuery>{"type":"read","path":"characters.角色名"}</SystemQuery>
<SystemQuery>{"type":"generate_image","characterName":"角色名","angle":"front","upper":"sfw","extra":"beach, smiling","lexicon":"BDSM"}</SystemQuery>
<SystemQuery>{"type":"generate_image","characterName":"角色名","outfit":"礼服","extra":"ballroom"}</SystemQuery>
<SystemQuery>{"type":"write_appearance","characterName":"角色名","faceFront":"elf, blonde hair"}</SystemQuery>

默认只组合角色「脸+身体」，不要叠卡里已有服装。
- 用户明确要穿卡里某套（礼服/平常服）才填 outfit
- 从抽卡姬词库随机衣服：填 lexicon（如 BDSM、服装），不要填 outfit
- 临时衣服（比基尼等）写 extra，不要填 outfit
没有抽卡姬工作流时不要假装已经出图。`;

const MODULES: Record<string, string> = {
  characters: `===== 角色管理模块 =====
read characters / characters.名 → 卡面、分层外观、服装列表、旧快照标签
外观：face / upperSfw / fullSfw / NSFW 对应层，正/背。
服装：独立 outfits，activeOutfitId 为当前穿的。
write_appearance 改分层或增改一套衣服。
generate_image: characterName, extra 场景, lexicon 抽卡姬词库名（随机一套衣服，不叠卡内衣装）, outfit 仅当用户指定卡里某套。默认不含服装层。
不要用 NovelAI charRef 路径。`,
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
  onPatchCharacter?: (id: string, patch: Partial<Character>) => void;
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
        let extra = String(q.extra || q.prompt || "");
        const hits = characterName ? findCharacters(ctx.characters, characterName) : [];
        const c = hits[0] || ctx.pageCharacter;
        if (c) characterId = c.id;
        const app = c ? appearanceOf(c) : undefined;
        const outfitHint = String(q.outfit || q.outfitName || "");
        let lexiconHint = String(q.lexicon || q.lexiconHint || "");
        if (!lexiconHint) {
          const m = extra.match(/([A-Za-z0-9_\u4e00-\u9fff]{2,20})词库/);
          if (m) lexiconHint = m[1]!;
        }
        let rolledNote = "";
        if (lexiconHint) {
          extra = extra.replace(/[^,，。]*词库[^,，。]*/g, "").trim();
          const rolled = await rollLexiconHint(lexiconHint);
          if (!rolled?.tags) {
            lines.push(`❌ 词库「${lexiconHint}」没有抽到条目。请确认抽卡姬里有这个分类/列表。`);
            continue;
          }
          extra = [extra, rolled.tags].filter(Boolean).join(", ");
          rolledNote = `词库 ${rolled.categoryLabel}/${rolled.listLabel} → ${rolled.name || rolled.tags.slice(0, 40)}`;
        }
        const skipOutfit = !outfitHint || !!lexiconHint || q.skipOutfit === true;
        const hasLook = !!(app && (app.face.front || app.upperSfw.front));
        const composed = composeAppearancePrompt(app, {
          angle: q.angle === "back" ? "back" : "front",
          upper: q.upper === "nsfw" ? "nsfw" : "sfw",
          lower: q.lower === "hidden" ? "hidden" : q.lower === "nsfw" ? "nsfw" : "sfw",
          outfitHint: skipOutfit ? "" : outfitHint,
          extra,
          skipOutfit,
        });
        let characterPrompt = composed;
        let usedLabel = skipOutfit ? "脸+身体（不含卡内衣装）" : outfitHint || "分层外观";
        if (rolledNote) usedLabel += ` · ${rolledNote}`;
        if (!hasLook && (!composed || composed === extra) && c) {
          const picked = pickPrompt(c, `${characterName} ${extra} ${outfitHint}`);
          if (picked) {
            characterPrompt = skipOutfit
              ? extra
              : [picked.text, extra].filter(Boolean).join(", ");
            if (!skipOutfit) usedLabel = picked.label || usedLabel;
          }
        }
        const ov: Parameters<typeof runSavedComfyJob>[0] = {
          prompt_character: characterPrompt || extra,
          prompt_suffix: "",
        };
        if (app?.negative) ov.negative_prompt = app.negative;
        const job = await runSavedComfyJob(ov, ctx.signal);
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
      } else if (type === "write_appearance") {
        const characterName = String(q.characterName || q.character || "");
        const hits = characterName ? findCharacters(ctx.characters, characterName) : [];
        const c = hits[0] || ctx.pageCharacter;
        if (!c) {
          lines.push("write_appearance：找不到角色");
          continue;
        }
        if (!ctx.onPatchCharacter) {
          lines.push("此页不能改卡（分享只读）");
          continue;
        }
        const next = applyAppearanceWrite(appearanceOf(c), q);
        ctx.onPatchCharacter(c.id, { appearance: next });
        characterId = c.id;
        lines.push(`✅ 已更新 ${c.name} 外观\n${appearanceSummary(next)}`);
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
      return `【${c.name}】\n${characterCardText(c, [c], 4)}\n\n分层外观：\n${appearanceSummary(appearanceOf(c))}\n提示词快照：\n${prompts || "（空）"}`;
    })
    .join("\n\n");
}

function applyAppearanceWrite(
  base: AppearanceProfile,
  q: Record<string, unknown>
): AppearanceProfile {
  const next: AppearanceProfile = {
    ...base,
    face: { ...base.face },
    upperSfw: { ...base.upperSfw },
    fullSfw: { ...base.fullSfw },
    upperNsfw: { ...base.upperNsfw },
    fullNsfw: { ...base.fullNsfw },
    outfits: base.outfits.map((o) => ({ ...o, upper: { ...o.upper }, full: { ...o.full } })),
  };
  if (typeof q.faceFront === "string" && q.faceFront.trim()) next.face.front = q.faceFront;
  if (typeof q.faceBack === "string") next.face.back = q.faceBack;
  if (typeof q.upperSfwFront === "string" && q.upperSfwFront.trim()) next.upperSfw.front = q.upperSfwFront;
  if (typeof q.fullSfwFront === "string") next.fullSfw.front = q.fullSfwFront;
  if (typeof q.upperNsfwFront === "string") next.upperNsfw.front = q.upperNsfwFront;
  if (typeof q.fullNsfwFront === "string") next.fullNsfw.front = q.fullNsfwFront;
  if (typeof q.photoPrompt === "string") next.photoPrompt = q.photoPrompt;
  if (typeof q.nameCN === "string") next.nameCN = q.nameCN;
  if (typeof q.nameEN === "string") next.nameEN = q.nameEN;
  if (typeof q.activeOutfitId === "string") next.activeOutfitId = q.activeOutfitId;
  const o = q.outfit;
  if (o && typeof o === "object") {
    const rec = o as Record<string, unknown>;
    const nameCN = String(rec.nameCN || rec.name || "");
    const nameEN = String(rec.nameEN || "");
    const id = String(rec.id || "");
    let hit = next.outfits.find(
      (x) =>
        (id && x.id === id) ||
        (nameCN && x.nameCN === nameCN) ||
        (nameEN && x.nameEN === nameEN)
    );
    if (!hit) {
      const created: OutfitPreset = {
        id: id || crypto.randomUUID(),
        nameCN: nameCN || "新服装",
        nameEN,
        upper: { front: "", back: "" },
        full: { front: "", back: "" },
        photoPrompt: "",
      };
      next.outfits.push(created);
      hit = created;
    }
    if (typeof rec.upperFront === "string") hit.upper.front = rec.upperFront;
    if (typeof rec.upperBack === "string") hit.upper.back = rec.upperBack;
    if (typeof rec.fullFront === "string") hit.full.front = rec.fullFront;
    if (typeof rec.fullBack === "string") hit.full.back = rec.fullBack;
    if (typeof rec.photoPrompt === "string") hit.photoPrompt = rec.photoPrompt;
    if (nameCN) hit.nameCN = nameCN;
    if (nameEN) hit.nameEN = nameEN;
    next.activeOutfitId = hit.id;
  }
  return next;
}