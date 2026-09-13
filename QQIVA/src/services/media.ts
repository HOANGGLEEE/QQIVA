import { Asset } from 'expo-asset';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import type { ImageSourcePropType } from 'react-native';

import { getDatabase } from '@/db/database';
import { seedImageAssets } from '@/data/seed/imageAssets';
import { makeId, nowIso } from '@/services/id';

const ROOT = `${FileSystem.documentDirectory}qqiva/`;
const IMAGE_DIR = `${ROOT}images/`;
const SOURCE_DIR = `${ROOT}source_files/`;
const EXPORT_DIR = `${ROOT}exports/`;
const TEMPLATE_DIR = `${ROOT}contract_templates/`;

export async function ensureMediaDirs(){for(const dir of [ROOT,IMAGE_DIR,SOURCE_DIR,EXPORT_DIR,TEMPLATE_DIR]){const info=await FileSystem.getInfoAsync(dir);if(!info.exists)await FileSystem.makeDirectoryAsync(dir,{intermediates:true});}}

export function imageSource(path?:string):ImageSourcePropType|undefined{const raw=String(path||'').trim();if(!raw)return undefined;if(raw.startsWith('file://')||raw.startsWith('content://')||raw.startsWith('http://')||raw.startsWith('https://')||raw.startsWith('data:'))return{uri:raw};const name=raw.split('/').pop()||raw;const moduleId=seedImageAssets[name];if(moduleId)return moduleId;return undefined;}

export async function resolveImageUri(path?:string){const raw=String(path||'').trim();if(!raw)return'';if(raw.startsWith('file://')||raw.startsWith('content://')||raw.startsWith('data:'))return raw;const name=raw.split('/').pop()||raw;const moduleId=seedImageAssets[name];if(!moduleId)return raw;const asset=Asset.fromModule(moduleId);await asset.downloadAsync();return asset.localUri||asset.uri;}

export async function pickImages(options:{multiple?:boolean;ownerType?:string;ownerId?:string}={}){await ensureMediaDirs();const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted)throw new Error('QQIVA cần quyền truy cập ảnh.');const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:!!options.multiple,quality:1,selectionLimit:options.multiple?0:1});if(result.canceled)return[];const out=[];for(const asset of result.assets){out.push(await persistFile(asset.uri,asset.fileName||`image-${Date.now()}.jpg`,asset.mimeType||'image/jpeg','IMAGE',options.ownerType||'GENERAL',options.ownerId||''));}return out;}

export async function takePhoto(ownerType='GENERAL',ownerId=''){await ensureMediaDirs();const permission=await ImagePicker.requestCameraPermissionsAsync();if(!permission.granted)throw new Error('QQIVA cần quyền camera.');const result=await ImagePicker.launchCameraAsync({mediaTypes:['images'],quality:1,exif:false});if(result.canceled)return null;const asset=result.assets[0];return persistFile(asset.uri,asset.fileName||`camera-${Date.now()}.jpg`,asset.mimeType||'image/jpeg','IMAGE',ownerType,ownerId);}

export async function pickDocument(ownerType='SOURCE',ownerId='',types:string|string[]='*/*'){await ensureMediaDirs();const result=await DocumentPicker.getDocumentAsync({type:types,multiple:false,copyToCacheDirectory:true});if(result.canceled)return null;const asset=result.assets[0];const kind=(asset.mimeType||'').includes('pdf')?'PDF':(asset.mimeType||'').includes('json')||asset.name.toLowerCase().endsWith('.json')?'JSON':'FILE';return persistFile(asset.uri,asset.name,asset.mimeType||'',kind,ownerType,ownerId);}

export async function pickMultipleDocuments(ownerType='SOURCE',ownerId='',types:string|string[]='*/*'){await ensureMediaDirs();const result=await DocumentPicker.getDocumentAsync({type:types,multiple:true,copyToCacheDirectory:true});if(result.canceled)return[];const out=[];for(const asset of result.assets){const kind=(asset.mimeType||'').includes('pdf')?'PDF':asset.name.toLowerCase().endsWith('.json')?'JSON':'FILE';out.push(await persistFile(asset.uri,asset.name,asset.mimeType||'',kind,ownerType,ownerId));}return out;}

export async function persistFile(sourceUri:string,originalName:string,mime:string,kind:string,ownerType:string,ownerId:string){await ensureMediaDirs();const ext=(originalName.match(/\.[A-Za-z0-9]{1,8}$/)?.[0]||extensionFromMime(mime,kind));const id=makeId('ATT');const dir=kind==='IMAGE'?IMAGE_DIR:(ownerType==='CONTRACT_TEMPLATE'?TEMPLATE_DIR:SOURCE_DIR);const dest=`${dir}${id}${ext}`;await FileSystem.copyAsync({from:sourceUri,to:dest});const info=await FileSystem.getInfoAsync(dest);const row={id,owner_type:ownerType,owner_id:ownerId,kind,uri:dest,original_name:originalName,mime,size:info.exists&&'size'in info?Number(info.size||0):0,legacy_path:kind==='IMAGE'?dest:'',created_at:nowIso()};const db=await getDatabase();await db.runAsync('INSERT OR REPLACE INTO attachments (id,owner_type,owner_id,kind,uri,original_name,mime,size,legacy_path,created_at,raw_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)',row.id,row.owner_type,row.owner_id,row.kind,row.uri,row.original_name,row.mime,row.size,row.legacy_path,row.created_at,JSON.stringify(row));return row;}

export async function listAttachments(ownerType:string,ownerId:string){const db=await getDatabase();return db.getAllAsync<any>('SELECT * FROM attachments WHERE owner_type=? AND owner_id=? ORDER BY created_at DESC',ownerType,ownerId);}
export async function deleteAttachment(id:string){const db=await getDatabase();const row=await db.getFirstAsync<any>('SELECT uri FROM attachments WHERE id=?',id);if(row?.uri?.startsWith('file://'))await FileSystem.deleteAsync(row.uri,{idempotent:true});await db.runAsync('DELETE FROM attachments WHERE id=?',id);}
export async function getExportDirectory(){await ensureMediaDirs();return EXPORT_DIR;}

function extensionFromMime(mime:string,kind:string){if(mime.includes('png'))return'.png';if(mime.includes('webp'))return'.webp';if(mime.includes('jpeg')||mime.includes('jpg')||kind==='IMAGE')return'.jpg';if(mime.includes('pdf'))return'.pdf';if(mime.includes('json'))return'.json';return'.bin';}
