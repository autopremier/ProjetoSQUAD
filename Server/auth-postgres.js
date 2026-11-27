'use strict';
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const { pool } = require('./database');
const now = "to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')";
async function createPasswordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = (await scrypt(String(password || ''), salt, 64)).toString('hex');
    return { salt, hash };
}
async function verifyUserPassword(row, password) {
    if (!row?.password_hash || !row?.password_salt || String(password || '').length > 128) return false;
    if (!/^[a-f0-9]{128}$/i.test(row.password_hash)) return false;
    const { hash } = await createPasswordHash(password, row.password_salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(row.password_hash, 'hex'));
}
function sessionTokenHash(token) {
    return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}
async function getActiveUserRowById(userId, client = pool) {
    const r = await client.query('SELECT * FROM squad.users WHERE id = $1 AND active = 1', [userId]);
    return r.rows[0] || null;
}
async function updateUserPassword(userId, password, client = pool) {
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new Error('Nova senha deve ter entre 12 e 128 caracteres.');
    const {hash, salt} = await createPasswordHash(password);
    const r = await client.query(`UPDATE squad.users SET password_hash=$1,password_salt=$2,password_updated_at=${now},updated_at=${now} WHERE id=$3 AND active=1`, [hash,salt,userId]);
    if (r.rowCount !== 1) throw new Error('Perfil ativo nao encontrado.');
}
async function createAuthSession({userId=null, sessionType='user', hours=24}, client=pool) {
    if (!['user','admin'].includes(sessionType) || (sessionType==='user' && !Number.isSafeInteger(userId)) || (sessionType==='admin' && userId!==null) || !Number.isFinite(hours) || hours<=0 || hours>24) throw new Error('Sessao invalida.');
    const token=crypto.randomBytes(32).toString('hex');
    const expires_at=new Date(Date.now()+hours*3600000).toISOString();
    await client.query('INSERT INTO squad.auth_sessions (token_hash,session_type,user_id,expires_at) VALUES ($1,$2,$3,$4)',[sessionTokenHash(token),sessionType,userId,expires_at]);
    return {token,expires_at};
}
async function findAuthSession(token,sessionType='user',client=pool) {
    if (!/^[a-f0-9]{64}$/i.test(token || '') || !['user','admin'].includes(sessionType)) return null;
    const r=await client.query(`SELECT s.*,u.name AS user_name,u.active AS user_active,u.access_role AS user_access_role FROM squad.auth_sessions s LEFT JOIN squad.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.session_type=$2 AND NULLIF(s.expires_at,'')::timestamptz > CURRENT_TIMESTAMP AND (s.session_type='admin' OR u.active=1) LIMIT 1`,[sessionTokenHash(token),sessionType]);
    const row=r.rows[0];
    if (!row) return null;
    await client.query(`UPDATE squad.auth_sessions SET last_seen_at=${now} WHERE id=$1`,[row.id]);
    return row;
}
async function revokeSession(token, client=pool) {
    if (!token) return;
    await client.query('DELETE FROM squad.auth_sessions WHERE token_hash=$1',[sessionTokenHash(token)]);
}
module.exports={createPasswordHash,verifyUserPassword,getActiveUserRowById,updateUserPassword,createAuthSession,findAuthSession,revokeSession};
