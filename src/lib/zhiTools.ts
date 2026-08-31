/** 陪玩姬 tool protocol, aligned with 智绘姬 SystemQuery. */

import type { AppearanceProfile, Character, OutfitPreset, StoredPrompt } from "@/lib/types";
import type { AiApiConfig, AiModelParams } from "@/lib/aiConfig";
import { writeImagePrompt, resolveComfyPrompt } from "@/lib/imagePrompt";
import type { WorldMeta } from "@/lib/worlds";
import type { LoreMap, WorldLore } from "@/lib/worldLore";
import { getLore, emptyLore } from "@/lib/worldLore";
import {
  loadParams,
  loadPromptPresets,
  loadSettings,
  loadWorkflows,
  runSavedComfyJob,
} from "@/lib/comfyConfig";
import { rollLexiconHint } from "@/lib/comfyLexicon";
import { pushDebugLog } from "@/lib/debugLog";
import { characterCardText } from "@/lib/characterChat";
import {
  appearanceOf,
  appearanceSummary,
  composeAppearancePrompt,
  fillAppearanceFromPrompts,
} from "@/lib/appearance";
import {
  SKILL_INSTRUCTION,
  resolveSkillId,
  skillDetailText,
  type LoreSection,
  type ZhiPendingChange,
} from "@/lib/zhiSkills";
import { fetchLexiconCatalog, loadLocalLists, resolveEnabledIds } from "@/lib/lexicon";

export interface ZhiTaskStep {
  title: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  result: string;
}

export interface ZhiTask {
  title: string;
  steps: ZhiTaskStep[];
}

export const TOOL_INSTRUCTION = SKILL_INSTRUCTION;

const MODULES: Record<string, string> = {
  characters: skillDetailText(),
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
  worlds?: WorldMeta[];
  lore?: LoreMap;
  catalog?: Record<string, unknown>;
  pageCharacter?: Character;
  pathname: string;
  signal?: AbortSignal;
  task: ZhiTask | null;
  onTask: (t: ZhiTask | null) => void;
  onStatus: (s: string) => void;
  onGoto?: (path: string) => void;
  logSource?: string;
  lastUserLine?: string;
  preferCharacter?: Character;
  selfCharacter?: Character;
  canWrite?: boolean;
  ai?: { config: AiApiConfig; params: AiModelParams };
  historyText?: string;
};

export async function runQueries(
  queries: Record<string, unknown>[],
  ctx: ZhiToolCtx
): Promise<{ text: string; images: string[]; characterId?: string; pending: ZhiPendingChange[] }> {
  const lines: string[] = [];
  const images: string[] = [];
  const pending: ZhiPendingChange[] = [];
  let task = ctx.task;
  let characterId: string | undefined;

  for (const q of queries) {
    const skill = resolveSkillId(q);
    try {
      if (skill === "task_create") {
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
      } else if (skill === "task_update") {
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
      } else if (skill === "list_skills") {
        lines.push(`【技能列表】\n${skillDetailText()}`);
      } else if (skill === "read_app") {
        lines.push(readApp(ctx));
      } else if (skill === "list_characters") {
        lines.push(handleRead("characters", ctx));
      } else if (skill === "read_character") {
        const name = String(q.characterName || q.character || q.path || "").replace(/^characters?\./i, "");
        lines.push(handleRead(name ? `characters.${name}` : "characters", ctx));
      } else if (skill === "read_world") {
        lines.push(readWorld(ctx, String(q.worldName || q.name || q.path || "")));
      } else if (skill === "read_lore") {
        lines.push(readLore(ctx, String(q.worldName || q.name || "")));
      } else if (skill === "read_lexicon") {
        lines.push(await readLexicon());
      } else if (skill === "read_comfy") {
        lines.push(handleRead("comfy", ctx));
      } else if (skill === "read_page") {
        lines.push(`当前路径 ${ctx.pathname}`);
      } else if (skill === "read" || skill === "browse") {
        lines.push(handleRead(String(q.path || ""), ctx));
      } else if (skill === "generate_image") {
        ctx.onStatus("抽卡姬出图中…");
        const characterName = String(q.characterName || q.character || "");
        let extra = String(q.extra || q.prompt || "");
        const hits = characterName ? findCharacters(ctx.characters, characterName) : [];
        const selfWear = /我.{0,12}(穿|给.*看|自拍)|生成一张我/.test(ctx.lastUserLine || "");
        const c =
          (selfWear && (ctx.selfCharacter || ctx.preferCharacter)) ||
          hits[0] ||
          ctx.preferCharacter ||
          ctx.pageCharacter;
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
        if (ctx.ai) {
          ctx.onStatus("陪玩姬写提示词…");
          try {
            const written = await writeImagePrompt({
              character: c,
              characters: ctx.characters,
              extra,
              scene: extra,
              history: ctx.historyText,
              userLine: ctx.lastUserLine || extra,
              config: ctx.ai.config,
              params: ctx.ai.params,
              signal: ctx.signal,
              fallback: characterPrompt || extra,
              source: ctx.logSource || "出图提示词",
            });
            if (written.prompt) {
              ov.prompt_character = written.prompt;
              usedLabel += ` · 预设 ${written.packName}`;
            }
          } catch (e) {
            lines.push(`提示词生成失败，改用卡面组合：${e instanceof Error ? e.message : String(e)}`);
          }
        }
        ctx.onStatus("抽卡姬出图中…");
        ov.prompt_character = resolveComfyPrompt(String(ov.prompt_character || extra), ctx.characters);
        pushDebugLog({
          source: ctx.logSource || "陪玩姬",
          kind: "tool",
          title: `generate_image ${c?.name || characterName || ""}`,
          payload: {
            query: q,
            usedCharacter: c?.name,
            skipOutfit,
            prompt: characterPrompt || extra,
            lexicon: rolledNote,
          },
        });
        const job = await runSavedComfyJob(ov, ctx.signal, {
          source: ctx.logSource || "抽卡姬",
          note: `generate_image ${c?.name || ""}`,
        });
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
      } else if (skill === "roll_lexicon") {
        const hint = String(q.hint || q.lexicon || q.category || "");
        const rolled = await rollLexiconHint(hint);
        lines.push(
          rolled
            ? `抽到 ${rolled.categoryLabel}/${rolled.listLabel} · ${rolled.name}\n${rolled.tags}`
            : `词库「${hint}」没有抽到条目`
        );
      } else if (skill === "write_appearance" || skill === "fill_appearance") {
        if (!ctx.canWrite) { lines.push("此页只读，修改需要你确认且有编辑权。"); continue; }
        const c = pickChar(ctx, q);
        if (!c) { lines.push(`${skill}：找不到角色`); continue; }
        const next =
          skill === "fill_appearance"
            ? fillAppearanceFromPrompts(c, String(q.label || q.promptLabel || ""))
            : applyAppearanceWrite(appearanceOf(c), q);
        characterId = c.id;
        pending.push({
          id: crypto.randomUUID(),
          skill,
          title: skill === "fill_appearance" ? `用旧提示词填 ${c.name} 外观` : `改 ${c.name} 外观`,
          summary: appearanceSummary(next),
          target: c.name,
          kind: "character",
          characterId: c.id,
          characterPatch: { appearance: next },
        });
        lines.push(`📝 待你确认：${c.name} 外观/服装（点应用才写入）\n${appearanceSummary(next)}`);
      } else if (skill === "write_character" || skill === "add_prompt" || skill === "add_timeline") {
        if (!ctx.canWrite) { lines.push("此页只读，修改需要你确认且有编辑权。"); continue; }
        const c = pickChar(ctx, q);
        if (!c) { lines.push(`${skill}：找不到角色`); continue; }
        const change = characterWriteChange(c, skill, q);
        pending.push(change);
        characterId = c.id;
        lines.push(`📝 待你确认：${change.title}\n${change.summary}`);
      } else if (skill === "add_character") {
        if (!ctx.canWrite) { lines.push("此页只读。"); continue; }
        const name = String(q.name || q.characterName || "新角色").trim();
        const draft = {
          name,
          world: String(q.world || q.worldName || ""),
          ...(typeof q.fields === "object" && q.fields ? (q.fields as Partial<Character>) : {}),
        };
        pending.push({
          id: crypto.randomUUID(),
          skill,
          title: `新建角色 ${name}`,
          summary: JSON.stringify(draft),
          target: name,
          kind: "create_character",
          createDraft: draft,
        });
        lines.push(`📝 待你确认：新建角色 ${name}`);
      } else if (skill === "delete_character") {
        if (!ctx.canWrite) { lines.push("此页只读。"); continue; }
        const c = pickChar(ctx, q);
        if (!c) { lines.push("找不到要删的角色"); continue; }
        pending.push({
          id: crypto.randomUUID(),
          skill,
          title: `删除 ${c.name}`,
          summary: "将从你的库中删除这张卡，以及指向她的关系。",
          target: c.name,
          kind: "delete_character",
          characterId: c.id,
        });
        lines.push(`📝 待你确认：删除角色 ${c.name}`);
      } else if (skill === "write_world") {
        if (!ctx.canWrite) { lines.push("此页只读。"); continue; }
        const w = pickWorld(ctx, String(q.worldName || q.name || ""));
        if (!w) { lines.push("找不到世界"); continue; }
        const worldPatch: ZhiPendingChange["worldPatch"] = {};
        if (typeof q.name === "string" && q.name.trim()) worldPatch.name = q.name.trim();
        if (typeof q.color === "string") worldPatch.color = q.color;
        if (typeof q.system === "string") worldPatch.system = q.system as WorldMeta["system"];
        if (Array.isArray(q.dmRoster)) {
          const names = q.dmRoster.map(String);
          worldPatch.dmRoster = ctx.characters.filter((c) => names.includes(c.name) || names.includes(c.id)).map((c) => c.id);
        }
        pending.push({
          id: crypto.randomUUID(),
          skill,
          title: `改世界 ${w.name}`,
          summary: JSON.stringify(worldPatch),
          target: w.name,
          kind: "world",
          worldId: w.id,
          worldPatch,
        });
        lines.push(`📝 待你确认：改世界 ${w.name}\n${JSON.stringify(worldPatch)}`);
      } else if (skill === "write_lore") {
        if (!ctx.canWrite) { lines.push("此页只读。"); continue; }
        const worldName = String(q.worldName || q.name || "").trim();
        const section = String(q.section || "locations") as LoreSection;
        const entry = (q.entry && typeof q.entry === "object" ? q.entry : q) as Record<string, unknown>;
        if (!worldName) { lines.push("write_lore 需要 worldName"); continue; }
        pending.push({
          id: crypto.randomUUID(),
          skill,
          title: `改设定 ${worldName}/${section}`,
          summary: JSON.stringify(entry).slice(0, 800),
          target: worldName,
          kind: "lore",
          loreWorld: worldName,
          loreSection: section,
          loreEntry: entry,
        });
        lines.push(`📝 待你确认：世界设定 ${worldName} · ${section}`);
      } else if (skill === "goto") {
        const action = String(q.action || "goto");
        const path = String(q.path || q.value || "");
        if (path.startsWith("/")) {
          ctx.onGoto?.(path);
          lines.push(`已跳转 ${path}`);
        } else if (action.includes("char_ref") || action.includes("novelai")) {
          lines.push("没有 NovelAI 角色参考。请用 read_character / generate_image。");
        } else {
          lines.push(`未实现的跳转: ${action} ${path}`);
        }
      } else {
        lines.push(`未知技能 ${skill}`);
      }
    } catch (e) {
      lines.push(`❌ ${skill} 失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { text: lines.join("\n\n───────────────\n"), images, characterId, pending };
}

function pickChar(ctx: ZhiToolCtx, q: Record<string, unknown>): Character | undefined {
  const name = String(q.characterName || q.character || "").replace(/^characters?\./i, "");
  const hits = name ? findCharacters(ctx.characters, name) : [];
  return hits[0] || ctx.pageCharacter;
}

function pickWorld(ctx: ZhiToolCtx, name: string): WorldMeta | undefined {
  const list = ctx.worlds || [];
  const n = name.trim().toLowerCase();
  if (!n) return list[0];
  return list.find((w) => w.name.toLowerCase() === n || w.id === name) || list.find((w) => w.name.toLowerCase().includes(n));
}

function characterWriteChange(c: Character, skill: string, q: Record<string, unknown>): ZhiPendingChange {
  const patch: Partial<Character> = {};
  const fields = q.fields && typeof q.fields === "object" ? (q.fields as Record<string, unknown>) : {};
  const allow = [
    "name", "gender", "age", "race", "height", "weight", "affiliation", "identity",
    "residence", "faction", "birthplace", "world", "sheetRole", "playerName", "story",
    "modules", "play", "traits", "emotions", "combat", "happiness", "preferences", "outward",
  ];
  for (const k of allow) {
    if (fields[k] != null) (patch as Record<string, unknown>)[k] = fields[k];
    if (q[k] != null && k !== "name") (patch as Record<string, unknown>)[k] = q[k];
  }
  if (q.appearance && typeof q.appearance === "object") {
    patch.appearance = q.appearance as Character["appearance"];
  }
  let timelineEvent: ZhiPendingChange["timelineEvent"];
  if (skill === "add_prompt" || (q.label && q.text) || (q.addPrompt && typeof q.addPrompt === "object")) {
    const ap = (q.addPrompt as { label?: string; text?: string }) || q;
    const text = String(ap.text || q.text || "");
    if (text) {
      const item: StoredPrompt = {
        id: crypto.randomUUID(),
        text,
        label: String(ap.label || q.label || "陪玩姬"),
        createdAt: new Date().toISOString(),
      };
      patch.prompts = [...(c.prompts || []), item];
    }
  }
  if (skill === "add_timeline" || q.title || (q.addTimeline && typeof q.addTimeline === "object")) {
    const tl = (q.addTimeline as { title?: string; description?: string }) || q;
    const title = String(tl.title || q.title || "");
    if (title) {
      timelineEvent = {
        date: String(q.date || new Date().toISOString().slice(0, 10)),
        title,
        description: String(tl.description || q.description || ""),
        importance: "normal",
      };
    }
  }
  const note = String(q.note || Object.keys(patch).join("、") || timelineEvent?.title || "改卡");
  return {
    id: crypto.randomUUID(),
    skill,
    title: `改 ${c.name}`,
    summary: note,
    target: c.name,
    kind: "character",
    characterId: c.id,
    characterPatch: Object.keys(patch).length ? patch : undefined,
    timelineEvent,
  };
}

function readApp(ctx: ZhiToolCtx): string {
  const worlds = ctx.worlds || [];
  return JSON.stringify(
    {
      page: ctx.pathname,
      worlds: worlds.map((w) => ({ id: w.id, name: w.name, system: w.system, color: w.color, roster: w.dmRoster.length })),
      characters: ctx.characters.length,
      names: ctx.characters.map((c) => `${c.name}${c.world ? ` @${c.world}` : ""}`),
    },
    null,
    2
  );
}

function readWorld(ctx: ZhiToolCtx, name: string): string {
  const w = pickWorld(ctx, name);
  if (!w) return `没有世界「${name}」。现有：${(ctx.worlds || []).map((x) => x.name).join("、") || "（空）"}`;
  const lore = getLore(ctx.lore || {}, w.name);
  const chars = ctx.characters.filter((c) => c.world === w.name);
  return JSON.stringify(
    {
      ...w,
      characterNames: chars.map((c) => c.name),
      loreCounts: {
        locations: lore.locations.length,
        factions: lore.factions.length,
        rules: lore.rules.length,
        artifacts: lore.artifacts.length,
        history: lore.history.length,
        races: lore.races.length,
      },
    },
    null,
    2
  );
}

function readLore(ctx: ZhiToolCtx, name: string): string {
  const w = pickWorld(ctx, name);
  const key = w?.name || name;
  if (!key) return "需要 worldName";
  return JSON.stringify({ world: key, lore: getLore(ctx.lore || {}, key) }, null, 2);
}

async function readLexicon(): Promise<string> {
  try {
    const { index, defaultEnabled } = await fetchLexiconCatalog();
    const locals = loadLocalLists();
    const allIds = [
      ...index.categories.flatMap((c) => c.lists.map((l) => l.id)),
      ...locals.map((l) => l.id),
    ];
    const enabled = resolveEnabledIds(allIds, defaultEnabled);
    return JSON.stringify(
      {
        enabled,
        categories: index.categories.map((c) => ({
          id: c.id,
          label: c.label,
          lists: c.lists.map((l) => ({ id: l.id, label: l.label, tags: l.filterTags })),
        })),
        local: locals.map((l) => ({ id: l.id, label: l.label, category: l.categoryLabel })),
      },
      null,
      2
    );
  } catch (e) {
    return `词库读取失败：${e instanceof Error ? e.message : String(e)}`;
  }
}

function handleRead(path: string, ctx: ZhiToolCtx): string {
  const characters = ctx.characters;
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
        workflows: wfs.map((w) => w.name),
        ready: !!active,
        size: `${params.width}x${params.height}`,
        steps: params.steps,
        presets: loadPromptPresets().map((x) => x.name),
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
  return hits.map((c) => `【${c.name}】\n${JSON.stringify(charDump(c), null, 2)}`).join("\n\n");
}

function charDump(c: Character) {
  return {
    id: c.id,
    name: c.name,
    world: c.world,
    gender: c.gender,
    age: c.age,
    race: c.race,
    height: c.height,
    weight: c.weight,
    affiliation: c.affiliation,
    identity: c.identity,
    residence: c.residence,
    faction: c.faction,
    birthplace: c.birthplace,
    sheetRole: c.sheetRole,
    playerName: c.playerName,
    story: c.story,
    appearance: appearanceOf(c),
    prompts: c.prompts,
    timeline: c.timeline,
    relationships: c.relationships,
    modules: c.modules,
    gallery: (c.gallery || []).map((g) => ({ url: g.url, caption: g.caption })),
    play: c.play
      ? { system: c.play.system, version: c.play.version, data: c.play.data }
      : undefined,
    traits: c.traits,
    emotions: c.emotions,
    combat: c.combat,
    happiness: c.happiness,
    preferences: c.preferences,
    outward: c.outward,
  };
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