import * as FileSystem from 'expo-file-system/legacy';

import { array, object, text } from '@/db/database';
import { getLiveState, importAiPayload, saveLiveState } from '@/services/documentEngine';
import { deleteAttachment } from '@/services/media';
import { makeId, nowIso } from '@/services/id';
import { extractJsonPayload, normalizeAiPayload, validateAiJson } from '@/services/aiJson';

export type SourceItem = {
  id: string;
  attachment_id?: string;
  original_name?: string;
  stored_name?: string;
  kind?: string;
  mime?: string;
  size?: number;
  path?: string;
  url?: string;
  uploaded_at?: string;
};

function ensureNewDocument(state: any) {
  const current = object(state.new_document);
  const next: any = {
    workflow_version: '2.0.0-rn',
    created_at: current.created_at || nowIso(),
    scope_note: text(current.scope_note),
    stage: text(current.stage || 'source'),
    pasted_json: text(current.pasted_json),
    last_process_status: text(current.last_process_status),
    validation: current.validation || null,
    sources: array(current.sources),
  };
  state.new_document = next;
  return next;
}

export async function listSources(): Promise<SourceItem[]> {
  const s = await getLiveState();
  return array(ensureNewDocument(s).sources) as SourceItem[];
}

export async function addSourceFromAttachment(att: any) {
  const s = await getLiveState();
  const nd = ensureNewDocument(s);
  const item: SourceItem = {
    id: makeId('SRC'),
    attachment_id: att.id,
    original_name: att.original_name,
    stored_name: att.id,
    kind: att.kind,
    mime: att.mime,
    size: att.size,
    path: att.uri,
    url: att.uri,
    uploaded_at: nowIso(),
  };
  nd.sources.push(item);
  nd.last_source_at = nowIso();
  await saveLiveState(s);
  return item;
}

export async function deleteSource(sourceId: string) {
  const s = await getLiveState();
  const nd = ensureNewDocument(s);
  const src = nd.sources.find((x: SourceItem) => x.id === sourceId);
  nd.sources = nd.sources.filter((x: SourceItem) => x.id !== sourceId);
  await saveLiveState(s);
  if (src?.attachment_id) await deleteAttachment(src.attachment_id);
}

export async function clearSources(deleteFiles = true) {
  const s = await getLiveState();
  const nd = ensureNewDocument(s);
  const old = [...nd.sources];
  nd.sources = [];
  await saveLiveState(s);
  if (deleteFiles) {
    for (const src of old) if (src?.attachment_id) await deleteAttachment(src.attachment_id);
  }
}

export async function moveSource(sourceId: string, direction: -1 | 1) {
  const s = await getLiveState();
  const nd = ensureNewDocument(s);
  const idx = nd.sources.findIndex((x: SourceItem) => x.id === sourceId);
  const next = idx + direction;
  if (idx < 0 || next < 0 || next >= nd.sources.length) return nd.sources;
  [nd.sources[idx], nd.sources[next]] = [nd.sources[next], nd.sources[idx]];
  await saveLiveState(s);
  return nd.sources;
}

export async function setScopeNote(note: string) {
  const s = await getLiveState();
  const nd = ensureNewDocument(s);
  nd.scope_note = text(note);
  await saveLiveState(s);
}

export async function setSmartStage(stage: 'source' | 'process' | 'items' | 'details' | 'preview') {
  const s = await getLiveState();
  const nd = ensureNewDocument(s);
  nd.stage = stage;
  await saveLiveState(s);
}

export async function setPastedJson(value: string) {
  const s = await getLiveState();
  const nd = ensureNewDocument(s);
  nd.pasted_json = value;
  await saveLiveState(s);
}

export async function importSmartText(value: string) {
  const payload = extractJsonPayload(value);
  return importSmartPayload(payload, value);
}

export async function importSmartJsonFile(uri: string) {
  const raw = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  const payload = extractJsonPayload(raw.replace(/^\uFEFF/, ''));
  return importSmartPayload(payload, raw);
}

export async function importSmartPayload(payload: unknown, pastedText = '') {
  const validation = validateAiJson(payload);
  if (validation.errors.length) throw new Error(`JSON không đạt chuẩn: ${validation.errors.slice(0, 8).join(' | ')}`);
  const normalized = normalizeAiPayload(payload);
  const next = await importAiPayload(normalized);
  const nd = ensureNewDocument(next);
  nd.pasted_json = pastedText || nd.pasted_json;
  nd.last_process_status = 'JSON_IMPORTED';
  nd.last_process_at = nowIso();
  nd.validation = normalized.validation;
  nd.stage = 'process';
  next.new_document = nd;
  await saveLiveState(next);
  return { state: next, validation: normalized.validation };
}

export function getSmartStats(state: any) {
  let floors = 0; let rooms = 0; let items = 0; let checks = 0; let noImage = 0; let noPrice = 0; let locks = 0; let estimates = 0;
  for (const floor of array(state?.floors)) {
    floors += 1;
    for (const room of array(floor?.rooms)) {
      rooms += 1;
      for (const item of array(room?.items)) {
        items += 1;
        const status = String(item?.status || '').toUpperCase();
        if (status.includes('NEED') || status.includes('CHECK')) checks += 1;
        if (status.includes('LOCK')) locks += 1;
        if (status.includes('ESTIMATE')) estimates += 1;
        if (!text(item?.image).trim()) noImage += 1;
        if (!(Number(item?.unit_price ?? item?.price) > 0)) noPrice += 1;
      }
    }
  }
  return { floors, rooms, items, checks, noImage, noPrice, locks, estimates };
}
