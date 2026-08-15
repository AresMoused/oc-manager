"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCharacters } from "@/hooks/useCharacters";
import {
  ComfyParams, ComfyPromptPreset, ComfySettings, ComfyWorkflowTemplate,
  DEFAULT_SAMPLERS, DEFAULT_SCHEDULERS, PLACEHOLDERS,
  applyPlaceholders, comfyCheckConnection, comfyImageUrl, comfyQueuePrompt,
  comfyWaitForImages, composePositivePrompt, defaultParams, defaultSettings,
  detectPlaceholders, loadParams, loadPromptPresets, loadSettings, loadWorkflows,
  normalizeWorkflowUpload, saveParams, savePromptPresets, saveSettings, saveWorkflows,
} from "@/lib/comfyConfig";
import {
  BuilderData,
  composePrompt,
  filterEnabledSections,
  getActivePreset,
  loadCachedBuilder,
  normalizeBuilderData,
  pickRandomSelected,
  saveCachedBuilder,
} from "@/lib/promptBuilder";

function newId() { return crypto.randomUUID(); }

const RANDOM_LOCK_KEY = "oc-comfy-random-char-lock";
const BATCH_KEY = "oc-comfy-batch-count";

export default function ComfyView() {
  // SIZE_PROBE_5K - partial file for testing large content push
  return <div>partial</div>;
}
