// In-memory adapter. No backend, browser storage, cookies or service workers.
import { characterRoster } from './characters'
import { cacheLocalPageImagesFromStorage } from './localPageImages'
const now = () => new Date().toISOString()
const stamp = '2026-10-01T09:00:00+09:00'
export const isConfigured = true
export const mockUsers = Array.from({length:6},(_,i)=>({id:i===5?'admin':'user'+(i+1),user_id:i===5?'admin':'user'+(i+1),role:i===5?'admin':'user',created_at:stamp,updated_at:stamp}))
// Six editions, each with a distinct pair of characters.
const editionSeeds = [
 { id: 'current', number: 6, date: '2026-10-01T09:00:00+09:00', characters: ['sena', 'tsubame'] },
 { id: 'past', number: 5, date: '2026-09-01T09:00:00+09:00', characters: ['saki', 'temari'] },
 { id: 'past-2', number: 4, date: '2026-08-01T09:00:00+09:00', characters: ['kotone', 'mao'] },
 { id: 'past-3', number: 3, date: '2026-07-01T09:00:00+09:00', characters: ['lilja', 'china'] },
 { id: 'past-4', number: 2, date: '2026-06-01T09:00:00+09:00', characters: ['sumika', 'hiro'] },
 { id: 'past-5', number: 1, date: '2026-05-01T09:00:00+09:00', characters: ['rinami', 'ume'] },
]
const events = editionSeeds.map((seed, i) => ({
 id: seed.id, name: '第' + seed.number + '回 強化月間',
 rules_description: '対象キャラクターを育成して結果を提出してください。\n一般・スイッチOFF・初心者のいずれかの部門に応募できます。',
 submission_start_at: null, submission_end_at: null,
 character_options: seed.characters.map(id => structuredClone(characterRoster.find(character => character.id === id))),
 page_images_path: seed.id + '/page-images.zip', is_active: i === 0,
 created_at: seed.date, updated_at: seed.date,
}))
const submissions = [0,1,2,3].map((i)=>({id:'submission'+i,event_id:'current',user_id:'user'+(i+1),discord_username:['星南推し','つばめP','新人プロデューサー','星々のきらめき'][i],producer_name:'プロデューサー'+(i+1),category:i%2?'tsubame':'sena',entry_division:['open','switch_off','beginner','open'][i],score_image_path:'sample-score',deck_image_path:null,beginner_proof_image_path:i===2?'sample-proof':null,login_days_proof_image_path:i===2?'sample-days':null,created_at:stamp,updated_at:stamp}))

const reviews = [{submission_id:'submission0',confirmed_score:25300,verification_status:'verified',admin_note:'確認済み',verified_at:stamp,verified_by:'admin',updated_at:stamp},{submission_id:'submission1',confirmed_score:22100,verification_status:'verified',admin_note:'',verified_at:stamp,verified_by:'admin',updated_at:stamp},{submission_id:'submission3',confirmed_score:null,verification_status:'invalid',admin_note:'画像を確認してください',verified_at:null,verified_by:null,updated_at:stamp}]
// Past answers follow the characters and dates of their edition.
for (const event of events.filter(event => !event.is_active)) {
 for (let i = 0; i < 2; i++) {
  const id = 'submission-' + event.id + '-' + (i + 1)
  submissions.push({ ...submissions[i], id, event_id: event.id,
   category: event.character_options[i].id, created_at: event.created_at, updated_at: event.created_at })
  reviews.push({ submission_id: id, confirmed_score: 15000 + editionSeeds.find(seed => seed.id === event.id).number * 1000 + i * 500,
   verification_status: 'verified', admin_note: '', verified_at: event.created_at, verified_by: 'admin', updated_at: event.created_at })
 }
}

const tables = {profiles:mockUsers,event_editions:events,submissions,submission_reviews:reviews}
const blobs = new Map()
export function seedMockBlob(path, blob) { blobs.set(path,blob) }
let session = null
const listeners = new Set()
const ok = data => ({data:structuredClone(data),error:null})
const denied = () => ({data:null,error:new Error('mock_permission_denied')})
const admin = () => mockUsers.find(u=>u.id===session?.user.id)?.role==='admin'
function query(table) {
 const filters=[]; let operation='select', values, single=false, ordering
 const q={select(){return q},eq(key,value){filters.push([key,value]);return q},order(key,opts){ordering=[key,opts];return q},single(){single=true;return q},maybeSingle(){single=true;return q},insert(v){operation='insert';values=v;return q},update(v){operation='update';values=v;return q},upsert(v){operation='upsert';values=v;return q},then(resolve,reject){return Promise.resolve().then(()=>{
 if(!session) return denied()
 if(table==='profiles'&&!admin()&&filters.some(([k,v])=>k==='id'&&v!==session.user.id)) return denied()
 if(['event_editions','submission_reviews','profiles'].includes(table)&&operation!=='select'&&!admin()) return denied()
 let rows=tables[table]; if(!rows) return {data:null,error:new Error('unknown_table')}
 let matched=rows.filter(r=>filters.every(([k,v])=>r[k]===v))
 if(operation!=='select') {
 if(table==='submissions') {
 if(values.user_id!==session.user.id) return denied()
 const event=events.find(e=>e.id===values.event_id), time=Date.now()
 if(!event?.is_active||(event.submission_start_at&&time<Date.parse(event.submission_start_at))||(event.submission_end_at&&time>Date.parse(event.submission_end_at))) return {data:null,error:new Error('closed')}
 }
 const batch=Array.isArray(values)?values:[values]; matched=[]
 for(const v of batch) {
 let existing=operation==='update'?rows.find(r=>filters.every(([k,x])=>r[k]===x)):operation==='upsert'?rows.find(r=>table==='submissions'?r.event_id===v.event_id&&r.user_id===v.user_id:r.submission_id===v.submission_id):null
 if(table==='submissions'&&existing) { const review=reviews.find(r=>r.submission_id===existing.id); const changed=['score_image_path','deck_image_path','beginner_proof_image_path','login_days_proof_image_path'].some(k=>existing[k]!==v[k]); if(review?.verification_status==='verified'&&changed) return {data:null,error:new Error('reviewed_image_locked')}; if(review) Object.assign(review,{verification_status:'pending',confirmed_score:null,verified_at:null,verified_by:null}) }
 if(existing) Object.assign(existing,structuredClone(v),{updated_at:now()}); else { existing={id:crypto.randomUUID(),created_at:now(),updated_at:now(),is_active:false,page_images_path:null,...structuredClone(v)}; rows.push(existing) }; matched.push(existing)
 }
 }
 if(table==='submissions'&&!admin()) matched=matched.filter(r=>r.user_id===session.user.id)
 if(table==='profiles'&&!admin()) matched=matched.filter(r=>r.id===session.user.id)
 if(ordering) { const [k,o]=ordering; matched=[...matched].sort((a,b)=>String(a[k]).localeCompare(String(b[k]))*(o?.ascending===false?-1:1)) }
 return ok(single?matched[0]??null:matched)
 }).then(resolve,reject)} }
 return q
}
export const supabase = {
 from:query,
 auth:{async getSession(){return {data:{session}}},onAuthStateChange(callback){listeners.add(callback);return {data:{subscription:{unsubscribe:()=>listeners.delete(callback)}}}},async signInWithPassword({email}){const user=mockUsers.find(u=>u.user_id===email);if(!user)return denied();session={user:{id:user.id}};listeners.forEach(fn=>fn('SIGNED_IN',session));return ok(null)},async signOut(){session=null;listeners.forEach(fn=>fn('SIGNED_OUT',null));return ok(null)}},
 async rpc(name,args={}) {
 if(!session)return denied()
 const active=events.find(e=>e.is_active)
 if(name==='get_event_settings') {const time=Date.now();return ok({...active,event_id:active.id,event_name:active.name,server_now:now(),accepting_submissions:(!active.submission_start_at||time>=Date.parse(active.submission_start_at))&&(!active.submission_end_at||time<=Date.parse(active.submission_end_at))})}
 if(name==='list_my_submission_history') return ok(submissions.filter(s=>s.user_id===session.user.id).map(s=>{const e=events.find(e=>e.id===s.event_id),r=reviews.find(r=>r.submission_id===s.id); const {user_id,...entry}=s;return {...entry,event_name:e.name,is_active:e.is_active,character_options:e.character_options,verification_status:r?.verification_status??'pending',confirmed_score:r?.verification_status==='verified'?r.confirmed_score:null}}).sort((a,b)=>b.updated_at.localeCompare(a.updated_at)))
 if(!admin()) return denied()
 if(name==='count_registered_users') return ok(mockUsers.filter(u=>u.role==='user').length)
 if(name==='list_admin_submissions') return ok(submissions.filter(s=>s.event_id===args.p_event_id).map(s=>({...s,profile:{user_id:mockUsers.find(u=>u.id===s.user_id).user_id},review:reviews.find(r=>r.submission_id===s.id)??null})))
 if(name==='list_user_summaries') return ok(mockUsers.map(u=>({...u,has_submission:submissions.some(s=>s.user_id===u.id),last_submitted_at:submissions.filter(s=>s.user_id===u.id).sort((a,b)=>b.updated_at.localeCompare(a.updated_at))[0]?.updated_at??null})))
 if(name==='set_active_event')return activate(args.p_event_id)
 return {data:null,error:new Error('unknown_rpc')}
 },
 functions:{async invoke(name,{body}){if(!admin())return denied();if(name==='activate-event')return activate(body.eventId);if(!['create-user','reset-user-password'].includes(name))return {data:null,error:new Error('unknown_function')};let user=mockUsers.find(u=>u.user_id===body.userId);if(name==='create-user'&&user)return ok({status:'already_exists',userId:body.userId});if(!user){user={id:crypto.randomUUID(),user_id:body.userId,role:'user',created_at:now(),updated_at:now()};mockUsers.push(user)}return ok({status:'created',userId:user.user_id,password:'MOCK-PASSWORD'})}},
 storage:{from(bucket){return {async upload(path,blob){if(!session||(bucket==='page-images'&&!admin()))return denied();blobs.set(bucket+'/'+path,blob);return ok({path})},async download(path){const key=blobs.has(bucket+'/'+path)?bucket+'/'+path:path; const blob=blobs.get(key);return blob?{data:blob,error:null}:{data:null,error:new Error('image_missing')}},async remove(paths){paths.forEach(p=>blobs.delete(bucket+'/'+p));return ok(null)}}}}
}
async function activate(id) {const event=events.find(e=>e.id===id);if(!event?.page_images_path)return {data:null,error:new Error('images_required')};await cacheLocalPageImagesFromStorage(event.page_images_path);events.forEach(e=>e.is_active=e.id===id);return ok(null)}
