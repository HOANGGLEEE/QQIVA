import { getLiveState, saveLiveState } from '@/services/documentEngine';
import { object } from '@/db/database';

export async function getCompany(){const s=await getLiveState();return object(s.company);}
export async function saveCompany(company:any){const s=await getLiveState();s.company={...object(s.company),...company};await saveLiveState(s);return s.company;}
export async function getSettings(){const s=await getLiveState();return{...object(s.settings),ui_language:s.settings?.ui_language||s.document_language||'vi',document_language:s.document_language||s.settings?.document_language||'vi'};}
export async function saveSettings(patch:any){const s=await getLiveState();s.settings={...object(s.settings),...patch};if(patch.document_language)s.document_language=patch.document_language;await saveLiveState(s);return s.settings;}
