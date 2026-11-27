const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3001;
const ADMIN_PASSWORD = process.env.PLANNER_ADMIN_PASSWORD || "0102";

app.use(cors());
app.use(express.json({ limit: "20mb" }));

const dataDirectory = path.join(__dirname, "data");
const uploadDirectory = path.join(__dirname, "uploads");
const profileUploadDirectory = path.join(uploadDirectory, "profiles");

[dataDirectory, uploadDirectory, profileUploadDirectory].forEach((directory) => {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
});

app.use("/uploads", express.static(uploadDirectory));

const databasePath = path.join(dataDirectory, "planner.db");
const db = new Database(databasePath);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        active INTEGER NOT NULL DEFAULT 1,
        nickname TEXT DEFAULT '',
        role TEXT DEFAULT '',
        brands TEXT NOT NULL DEFAULT '[]',
        photo_filename TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS contents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        brands TEXT NOT NULL DEFAULT '[]',
        format TEXT NOT NULL DEFAULT 'Reels',
        status TEXT NOT NULL DEFAULT 'Planejado',
        responsible TEXT DEFAULT '',
        urgency TEXT NOT NULL DEFAULT 'verde',
        reference_link TEXT DEFAULT '',
        description TEXT DEFAULT '',
        copy_text TEXT DEFAULT '',
        approval_status TEXT NOT NULL DEFAULT 'pendente',
        manager_note TEXT DEFAULT '',
        published_url TEXT DEFAULT '',
        published_by_user_id INTEGER,
        published_at TEXT DEFAULT '',
        platform TEXT DEFAULT 'Instagram',
        social_media_id TEXT DEFAULT '',
        metric_views INTEGER NOT NULL DEFAULT 0,
        metric_likes INTEGER NOT NULL DEFAULT 0,
        metric_comments INTEGER NOT NULL DEFAULT 0,
        metric_shares INTEGER NOT NULL DEFAULT 0,
        metric_saves INTEGER NOT NULL DEFAULT 0,
        metric_reach INTEGER NOT NULL DEFAULT 0,
        metric_total_interactions INTEGER NOT NULL DEFAULT 0,
        metric_engagement REAL NOT NULL DEFAULT 0,
        metrics_updated_at TEXT DEFAULT '',
        metrics_status TEXT NOT NULL DEFAULT 'pending',
        metrics_message TEXT DEFAULT '',
        is_live INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_id INTEGER NOT NULL,
        original_name TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'Personalizado',
        city TEXT DEFAULT '',
        note TEXT DEFAULT '',
        created_by TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`).run();


db.prepare(`
    CREATE TABLE IF NOT EXISTS creative_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        creator_user_id INTEGER,
        recipient_user_id INTEGER,
        creator_name TEXT NOT NULL DEFAULT '',
        recipient_name TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        brand TEXT NOT NULL DEFAULT '',
        creative_type TEXT NOT NULL DEFAULT 'Outro',
        quantity INTEGER NOT NULL DEFAULT 1,
        deadline TEXT NOT NULL,
        briefing TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'em_producao',
        manager_note TEXT DEFAULT '',
        submitted_at TEXT DEFAULT '',
        approved_at TEXT DEFAULT '',
        delivered_at TEXT DEFAULT '',
        recipient_read_at TEXT DEFAULT '',
        recipient_finished_at TEXT DEFAULT '',
        files_purged_at TEXT DEFAULT '',
        linked_content_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (linked_content_id) REFERENCES contents(id) ON DELETE SET NULL
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS creative_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL,
        original_name TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES creative_jobs(id) ON DELETE CASCADE
    )
`).run();

function ensureColumn(table, column, definition) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    const exists = columns.some((item) => item.name === column);

    if (!exists) {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
        console.log(`Coluna criada: ${table}.${column}`);
    }
}

ensureColumn("users", "active", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("users", "nickname", "TEXT DEFAULT ''");
ensureColumn("users", "role", "TEXT DEFAULT ''");
ensureColumn("users", "brands", "TEXT NOT NULL DEFAULT '[]'");
ensureColumn("users", "photo_filename", "TEXT DEFAULT ''");
ensureColumn("users", "created_at", "TEXT");
ensureColumn("users", "updated_at", "TEXT");

ensureColumn("contents", "reference_link", "TEXT DEFAULT ''");
ensureColumn("contents", "description", "TEXT DEFAULT ''");
ensureColumn("contents", "copy_text", "TEXT DEFAULT ''");
ensureColumn("contents", "approval_status", "TEXT NOT NULL DEFAULT 'pendente'");
ensureColumn("contents", "manager_note", "TEXT DEFAULT ''");
ensureColumn("contents", "published_url", "TEXT DEFAULT ''");
ensureColumn("contents", "published_by_user_id", "INTEGER");
ensureColumn("contents", "published_at", "TEXT DEFAULT ''");
ensureColumn("contents", "platform", "TEXT DEFAULT 'Instagram'");
ensureColumn("contents", "social_media_id", "TEXT DEFAULT ''");
ensureColumn("contents", "metric_views", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("contents", "metric_likes", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("contents", "metric_comments", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("contents", "metric_shares", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("contents", "metric_saves", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("contents", "metric_reach", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("contents", "metric_total_interactions", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("contents", "metric_engagement", "REAL NOT NULL DEFAULT 0");
ensureColumn("contents", "metrics_updated_at", "TEXT DEFAULT ''");
ensureColumn("contents", "metrics_status", "TEXT NOT NULL DEFAULT 'pending'");
ensureColumn("contents", "metrics_message", "TEXT DEFAULT ''");
ensureColumn("contents", "is_live", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("contents", "deleted_at", "TEXT DEFAULT ''");

ensureColumn("creative_jobs", "recipient_finished_at", "TEXT DEFAULT ''");
ensureColumn("creative_jobs", "files_purged_at", "TEXT DEFAULT ''");

/*
 * Migração dos conteúdos antigos:
 * tudo que já estava como Publicado e possuía data de publicação
 * passa a ser considerado NO AR.
 */
db.prepare(`
    UPDATE contents
    SET is_live = 1
    WHERE status = 'Publicado'
      AND COALESCE(is_live, 0) = 0
      AND TRIM(COALESCE(published_at, '')) <> ''
`).run();

const initialUsers = ["Johnny", "Maria Eduarda", "Giovana"];
const insertInitialUser = db.prepare(`
    INSERT OR IGNORE INTO users (name, active) VALUES (?, 1)
`);

const seedUsers = db.transaction((users) => {
    users.forEach((name) => insertInitialUser.run(name));
});
seedUsers(initialUsers);

function parseJsonArray(value) {
    try {
        const result = JSON.parse(value || "[]");
        return Array.isArray(result) ? result : [];
    } catch {
        return [];
    }
}

function normalizeInteger(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.round(number);
}

function normalizeFloat(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return number;
}

function safeUnlink(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return;
    try {
        fs.unlinkSync(filePath);
    } catch (error) {
        console.error("Erro ao excluir arquivo:", error.message);
    }
}

function removeContentPhysicalFile(filename) {
    if (!filename) return;
    safeUnlink(path.join(uploadDirectory, filename));
}

function purgeExpiredCreativeFiles() {
    const expiredJobs = db
        .prepare(`
            SELECT id
            FROM creative_jobs
            WHERE status = 'finalizado'
              AND TRIM(COALESCE(recipient_finished_at, '')) <> ''
              AND datetime(recipient_finished_at) <= datetime('now', '-7 days')
        `)
        .all();

    if (!expiredJobs.length) return 0;

    const selectFiles = db.prepare(`
        SELECT id, filename
        FROM creative_files
        WHERE job_id = ?
    `);

    const deleteFiles = db.prepare(`
        DELETE FROM creative_files
        WHERE job_id = ?
    `);

    const archiveJob = db.prepare(`
        UPDATE creative_jobs
        SET status = 'arquivado',
            files_purged_at = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);

    const nowIso = new Date().toISOString();

    for (const job of expiredJobs) {
        const files = selectFiles.all(job.id);

        deleteFiles.run(job.id);
        archiveJob.run(nowIso, job.id);

        files.forEach((file) => {
            removeContentPhysicalFile(file.filename);
        });
    }

    return expiredJobs.length;
}

function purgeExpiredTrash() {
    const expired = db
        .prepare(`
            SELECT id
            FROM contents
            WHERE TRIM(COALESCE(deleted_at, '')) <> ''
              AND datetime(deleted_at) <= datetime('now', '-24 hours')
        `)
        .all();

    if (!expired.length) return 0;

    const selectFiles = db.prepare(`SELECT filename FROM files WHERE content_id = ?`);
    const deleteContent = db.prepare(`DELETE FROM contents WHERE id = ?`);

    for (const item of expired) {
        const files = selectFiles.all(item.id);
        deleteContent.run(item.id);
        files.forEach((file) => removeContentPhysicalFile(file.filename));
    }

    return expired.length;
}

function removeProfilePhysicalFile(filename) {
    if (!filename) return;
    safeUnlink(path.join(profileUploadDirectory, filename));
}

function serializeUser(row) {
    if (!row) return null;

    return {
        id: row.id,
        name: row.name,
        active: row.active,
        nickname: row.nickname || "",
        role: row.role || "",
        brands: parseJsonArray(row.brands),
        photo_url: row.photo_filename ? `/uploads/profiles/${row.photo_filename}` : "",
        created_at: row.created_at || "",
        updated_at: row.updated_at || "",
    };
}

function getUserById(id) {
    return serializeUser(
        db.prepare(`SELECT * FROM users WHERE id = ?`).get(Number(id))
    );
}

function getActiveUserRowById(id) {
    return db
        .prepare(`
            SELECT * FROM users
            WHERE id = ? AND active = 1
        `)
        .get(Number(id));
}

function findActiveUserBySavedRecipientName(savedName) {
    const normalized = String(savedName || "").trim().toLowerCase();
    if (!normalized) return null;

    return db
        .prepare(`
            SELECT * FROM users
            WHERE active = 1
              AND (
                    lower(trim(name)) = ?
                    OR lower(trim(COALESCE(nickname, ''))) = ?
              )
            ORDER BY id DESC
            LIMIT 1
        `)
        .get(normalized, normalized);
}

function repairCreativeRecipientLink(jobId) {
    const job = db.prepare(`SELECT * FROM creative_jobs WHERE id = ?`).get(Number(jobId));
    if (!job) return null;

    const currentRecipient = job.recipient_user_id
        ? getActiveUserRowById(job.recipient_user_id)
        : null;

    if (currentRecipient) return currentRecipient;

    const repairedRecipient = findActiveUserBySavedRecipientName(job.recipient_name);
    if (!repairedRecipient) return null;

    db.prepare(`
        UPDATE creative_jobs
        SET recipient_user_id = ?,
            recipient_name = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        repairedRecipient.id,
        repairedRecipient.nickname || repairedRecipient.name,
        job.id
    );

    return repairedRecipient;
}

function repairCreativeRecipientLinksForUser(userId) {
    const user = getActiveUserRowById(userId);
    if (!user) return 0;

    const aliases = [
        String(user.name || "").trim().toLowerCase(),
        String(user.nickname || "").trim().toLowerCase(),
    ].filter(Boolean);

    if (!aliases.length) return 0;

    const candidates = db
        .prepare(`
            SELECT cj.*
            FROM creative_jobs cj
            LEFT JOIN users recipient
                ON recipient.id = cj.recipient_user_id
               AND recipient.active = 1
            WHERE cj.status IN ('aprovado', 'finalizado')
              AND recipient.id IS NULL
        `)
        .all();

    let repaired = 0;

    for (const job of candidates) {
        const savedName = String(job.recipient_name || "").trim().toLowerCase();
        if (!savedName || !aliases.includes(savedName)) continue;

        db.prepare(`
            UPDATE creative_jobs
            SET recipient_user_id = ?,
                recipient_name = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(user.id, user.nickname || user.name, job.id);
        repaired += 1;
    }

    return repaired;
}

function getFiles(contentId) {
    return db
        .prepare(`
            SELECT id, content_id, original_name, filename, mime_type, file_size, created_at
            FROM files
            WHERE content_id = ?
            ORDER BY id
        `)
        .all(contentId)
        .map((file) => ({
            ...file,
            url: `/uploads/${file.filename}`,
            download_url: `/api/creative/files/${file.id}/download`,
        }));
}

function calculateEngagement(metrics) {
    const totalInteractions =
        normalizeInteger(metrics.metric_likes) +
        normalizeInteger(metrics.metric_comments) +
        normalizeInteger(metrics.metric_shares) +
        normalizeInteger(metrics.metric_saves);

    const denominator =
        normalizeInteger(metrics.metric_reach) > 0
            ? normalizeInteger(metrics.metric_reach)
            : normalizeInteger(metrics.metric_views);

    const engagement = denominator > 0 ? (totalInteractions / denominator) * 100 : 0;

    return {
        totalInteractions,
        engagement: Number(engagement.toFixed(2)),
        engagementBase: normalizeInteger(metrics.metric_reach) > 0 ? "alcance" : "visualizações",
    };
}

function serializeContent(row) {
    if (!row) return null;

    const publisherId = Number(row.published_by_user_id || row.user_id);
    const publisher = getUserById(publisherId);
    const owner = getUserById(row.user_id);
    const engagementData = calculateEngagement(row);

    return {
        ...row,
        brands: parseJsonArray(row.brands),
        files: getFiles(row.id),
        publisher,
        owner,
        metric_total_interactions: normalizeInteger(
            row.metric_total_interactions || engagementData.totalInteractions
        ),
        metric_engagement: normalizeFloat(
            row.metric_engagement || engagementData.engagement
        ),
        engagement_base: engagementData.engagementBase,
        is_live: Boolean(Number(row.is_live || 0)),
        trash_expires_at: row.deleted_at
            ? new Date(new Date(row.deleted_at).getTime() + 24 * 60 * 60 * 1000).toISOString()
            : "",
    };
}

function getContent(id) {
    const row = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(Number(id));
    return serializeContent(row);
}

function getCreativeFiles(jobId) {
    return db
        .prepare(`
            SELECT id, job_id, original_name, filename, mime_type, file_size, created_at
            FROM creative_files
            WHERE job_id = ?
            ORDER BY id
        `)
        .all(Number(jobId))
        .map((file) => ({
            ...file,
            url: `/uploads/${file.filename}`,
        }));
}

function serializeCreativeJob(row) {
    if (!row) return null;

    const creator = row.creator_user_id ? getUserById(row.creator_user_id) : null;
    const recipient = row.recipient_user_id ? getUserById(row.recipient_user_id) : null;
    const linkedContent = row.linked_content_id
        ? db.prepare(`SELECT id, title, date, brands, status FROM contents WHERE id = ?`).get(row.linked_content_id)
        : null;

    return {
        ...row,
        creator,
        recipient,
        files: getCreativeFiles(row.id),
        temporary_expires_at: row.recipient_finished_at
            ? new Date(
                  new Date(row.recipient_finished_at).getTime() +
                      7 * 24 * 60 * 60 * 1000
              ).toISOString()
            : "",
        linked_content: linkedContent
            ? { ...linkedContent, brands: parseJsonArray(linkedContent.brands) }
            : null,
    };
}

function getCreativeJob(id) {
    return serializeCreativeJob(
        db.prepare(`SELECT * FROM creative_jobs WHERE id = ?`).get(Number(id))
    );
}

function getCreativeDeliveriesForContent(contentId) {
    return db
        .prepare(`
            SELECT *
            FROM creative_jobs
            WHERE linked_content_id = ?
              AND status = 'aprovado'
            ORDER BY datetime(approved_at) DESC, id DESC
        `)
        .all(Number(contentId))
        .map(serializeCreativeJob);
}


function validateAdmin(password) {
    return String(password || "") === ADMIN_PASSWORD;
}

const contentStorage = multer.diskStorage({
    destination: (req, file, callback) => callback(null, uploadDirectory),
    filename: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const random = Math.random().toString(36).substring(2, 10);
        callback(null, `${Date.now()}-${random}${extension}`);
    },
});

const allowedContentMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "application/pdf",
]);

const upload = multer({
    storage: contentStorage,
    limits: {
        fileSize: 500 * 1024 * 1024,
        files: 10,
    },
    fileFilter: (req, file, callback) => {
        if (allowedContentMimeTypes.has(file.mimetype)) {
            callback(null, true);
            return;
        }
        callback(new Error("Formato de arquivo não permitido."));
    },
});

const profileStorage = multer.diskStorage({
    destination: (req, file, callback) => callback(null, profileUploadDirectory),
    filename: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase() || ".jpg";
        const random = Math.random().toString(36).substring(2, 10);
        callback(null, `profile-${Date.now()}-${random}${extension}`);
    },
});

const profileUpload = multer({
    storage: profileStorage,
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, callback) => {
        if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
            callback(null, true);
            return;
        }
        callback(new Error("A foto de perfil deve ser JPG, PNG ou WEBP."));
    },
});

function pad2(value) {
    return String(value).padStart(2, "0");
}

function formatDate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function fixedDate(year, month, day) {
    return `${year}-${pad2(month)}-${pad2(day)}`;
}

function addDays(date, amount) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    result.setDate(result.getDate() + amount);
    return result;
}

function easterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

function generateSystemReminders(year) {
    const reminders = [];

    function pushReminder({ title, date, type, city = "", note = "" }) {
        reminders.push({
            id: `system-${date}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
            db_id: null,
            title,
            date,
            type,
            city,
            note,
            system: true,
            created_by: "Sistema",
        });
    }

    [
        ["Confraternização Universal", 1, 1],
        ["Tiradentes", 4, 21],
        ["Dia do Trabalho", 5, 1],
        ["Independência do Brasil", 9, 7],
        ["Nossa Senhora Aparecida", 10, 12],
        ["Finados", 11, 2],
        ["Proclamação da República", 11, 15],
        ["Dia Nacional de Zumbi e da Consciência Negra", 11, 20],
        ["Natal", 12, 25],
    ].forEach(([title, month, day]) => {
        pushReminder({ title, date: fixedDate(year, month, day), type: "Feriado nacional" });
    });

    const easter = easterSunday(year);

    pushReminder({
        title: "Carnaval - Segunda-feira",
        date: formatDate(addDays(easter, -48)),
        type: "Ponto facultativo",
        note: "Data importante para planejamento de comunicação.",
    });
    pushReminder({
        title: "Carnaval - Terça-feira",
        date: formatDate(addDays(easter, -47)),
        type: "Ponto facultativo",
        note: "Data importante para planejamento de comunicação.",
    });
    pushReminder({
        title: "Sexta-feira da Paixão",
        date: formatDate(addDays(easter, -2)),
        type: "Feriado / data nacional",
    });
    pushReminder({ title: "Páscoa", date: formatDate(easter), type: "Data comemorativa" });
    pushReminder({
        title: "Corpus Christi",
        date: formatDate(addDays(easter, 60)),
        type: "Ponto facultativo",
        note: "Data móvel importante para planejamento.",
    });

    [
        ["Aniversário de Joinville", 3, 9, "Joinville"],
        ["Aniversário de Florianópolis", 3, 23, "Florianópolis"],
        ["Aniversário de Balneário Camboriú", 7, 20, "Balneário Camboriú"],
        ["Aniversário de Jaraguá do Sul", 7, 25, "Jaraguá do Sul"],
        ["Aniversário de Blumenau", 9, 2, "Blumenau"],
    ].forEach(([title, month, day, city]) => {
        pushReminder({
            title,
            date: fixedDate(year, month, day),
            type: "Aniversário de cidade",
            city,
        });
    });

    return reminders.sort((a, b) => a.date.localeCompare(b.date));
}

function monthBounds(year, month) {
    const start = `${year}-${pad2(month)}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endExclusive = `${nextYear}-${pad2(nextMonth)}-01`;
    return { start, endExclusive };
}

function previousMonth(year, month) {
    if (month === 1) return { year: year - 1, month: 12 };
    return { year, month: month - 1 };
}

function sum(items, selector) {
    return items.reduce((total, item) => total + normalizeFloat(selector(item)), 0);
}

function percentChange(current, previous) {
    const a = normalizeFloat(current);
    const b = normalizeFloat(previous);
    if (b === 0) return a > 0 ? 100 : 0;
    return Number((((a - b) / b) * 100).toFixed(1));
}

function average(items, selector) {
    if (!items.length) return 0;
    return sum(items, selector) / items.length;
}

function groupPerformance(items, keySelector) {
    const map = new Map();

    items.forEach((item) => {
        const keys = keySelector(item);
        const keyList = Array.isArray(keys) ? keys : [keys];

        keyList.filter(Boolean).forEach((key) => {
            if (!map.has(key)) {
                map.set(key, {
                    name: key,
                    publications: 0,
                    views: 0,
                    likes: 0,
                    shares: 0,
                    interactions: 0,
                    reach: 0,
                    engagementValues: [],
                });
            }

            const group = map.get(key);
            group.publications += 1;
            group.views += normalizeInteger(item.metric_views);
            group.likes += normalizeInteger(item.metric_likes);
            group.shares += normalizeInteger(item.metric_shares);
            group.interactions += normalizeInteger(item.metric_total_interactions);
            group.reach += normalizeInteger(item.metric_reach);

            if (normalizeFloat(item.metric_engagement) > 0) {
                group.engagementValues.push(normalizeFloat(item.metric_engagement));
            }
        });
    });

    return Array.from(map.values())
        .map((group) => ({
            name: group.name,
            publications: group.publications,
            views: group.views,
            likes: group.likes,
            shares: group.shares,
            interactions: group.interactions,
            reach: group.reach,
            engagement: Number(
                (group.engagementValues.length
                    ? average(group.engagementValues, (value) => value)
                    : 0
                ).toFixed(2)
            ),
        }))
        .sort(
            (a, b) =>
                b.views - a.views ||
                b.likes - a.likes ||
                b.shares - a.shares
        );
}

function buildRanking(items) {
    const withMetrics = items.filter(
        (item) =>
            normalizeInteger(item.metric_views) > 0 ||
            normalizeInteger(item.metric_likes) > 0 ||
            normalizeInteger(item.metric_shares) > 0
    );

    if (!withMetrics.length) return [];

    const maxViews = Math.max(
        0,
        ...withMetrics.map((item) => normalizeInteger(item.metric_views))
    );

    const maxLikes = Math.max(
        0,
        ...withMetrics.map((item) => normalizeInteger(item.metric_likes))
    );

    const maxShares = Math.max(
        0,
        ...withMetrics.map((item) => normalizeInteger(item.metric_shares))
    );

    return withMetrics
        .map((item) => {
            const components = [];

            if (maxViews > 0) {
                components.push(
                    (normalizeInteger(item.metric_views) / maxViews) * 100
                );
            }

            if (maxLikes > 0) {
                components.push(
                    (normalizeInteger(item.metric_likes) / maxLikes) * 100
                );
            }

            if (maxShares > 0) {
                components.push(
                    (normalizeInteger(item.metric_shares) / maxShares) * 100
                );
            }

            const squadScore = Number(
                (
                    components.length
                        ? components.reduce((total, value) => total + value, 0) /
                          components.length
                        : 0
                ).toFixed(1)
            );

            return {
                ...item,
                squad_score: squadScore,
                squad_score_mode: "views_likes_shares",
                squad_score_components: {
                    views:
                        maxViews > 0
                            ? Number(
                                  (
                                      (normalizeInteger(item.metric_views) / maxViews) *
                                      100
                                  ).toFixed(1)
                              )
                            : null,
                    likes:
                        maxLikes > 0
                            ? Number(
                                  (
                                      (normalizeInteger(item.metric_likes) / maxLikes) *
                                      100
                                  ).toFixed(1)
                              )
                            : null,
                    shares:
                        maxShares > 0
                            ? Number(
                                  (
                                      (normalizeInteger(item.metric_shares) / maxShares) *
                                      100
                                  ).toFixed(1)
                              )
                            : null,
                },
            };
        })
        .sort(
            (a, b) =>
                b.squad_score - a.squad_score ||
                normalizeInteger(b.metric_views) - normalizeInteger(a.metric_views) ||
                normalizeInteger(b.metric_likes) - normalizeInteger(a.metric_likes) ||
                normalizeInteger(b.metric_shares) - normalizeInteger(a.metric_shares)
        )
        .map((item, index) => ({ ...item, rank: index + 1 }));
}

function getReportContents(year, month) {
    const { start, endExclusive } = monthBounds(year, month);

    return db
        .prepare(`
            SELECT *
            FROM contents
            WHERE TRIM(COALESCE(deleted_at, '')) = ''
              AND COALESCE(
                    NULLIF(substr(published_at, 1, 10), ''),
                    date
                  ) >= ?
              AND COALESCE(
                    NULLIF(substr(published_at, 1, 10), ''),
                    date
                  ) < ?
            ORDER BY
                COALESCE(NULLIF(substr(published_at, 1, 10), ''), date) DESC,
                id DESC
        `)
        .all(start, endExclusive)
        .map(serializeContent);
}

function buildReportSummary(items) {
    const published = items.filter((item) => Boolean(item.is_live));
    const withMetrics = published.filter(
        (item) => normalizeInteger(item.metric_views) > 0 || normalizeInteger(item.metric_total_interactions) > 0
    );
    const withViews = published.filter((item) => normalizeInteger(item.metric_views) > 0);
    const withEngagement = published.filter((item) => normalizeFloat(item.metric_engagement) > 0);

    return {
        planned: items.length,
        published: published.length,
        approved: items.filter((item) => item.approval_status === "aprovado").length,
        views: sum(withViews, (item) => item.metric_views),
        reach: sum(withMetrics, (item) => item.metric_reach),
        interactions: sum(withMetrics, (item) => item.metric_total_interactions),
        likes: sum(withMetrics, (item) => item.metric_likes),
        comments: sum(withMetrics, (item) => item.metric_comments),
        shares: sum(withMetrics, (item) => item.metric_shares),
        saves: sum(withMetrics, (item) => item.metric_saves),
        engagement: Number(average(withEngagement, (item) => item.metric_engagement).toFixed(2)),
        metricsCoverage: published.length
            ? Number(((withMetrics.length / published.length) * 100).toFixed(1))
            : 0,
        viewsCoverage: published.length
            ? Number(((withViews.length / published.length) * 100).toFixed(1))
            : 0,
        engagementCoverage: published.length
            ? Number(((withEngagement.length / published.length) * 100).toFixed(1))
            : 0,
    };
}

function daysSince(dateString) {
    if (!dateString) return 0;
    const date = new Date(dateString.includes("T") ? dateString : `${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return 0;
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function buildAttention(items, ranking) {
    const alerts = [];
    const published = items.filter((item) => Boolean(item.is_live));

    const withoutCoreMetrics = published.filter(
        (item) =>
            normalizeInteger(item.metric_views) === 0 &&
            normalizeInteger(item.metric_likes) === 0 &&
            normalizeInteger(item.metric_shares) === 0
    );

    const pendingApproval = items.filter(
        (item) =>
            item.approval_status === "pendente" &&
            daysSince(item.created_at || item.date) >= 3
    );

    const lowPerformance = ranking.filter((item) => item.squad_score < 45);

    if (withoutCoreMetrics.length) {
        alerts.push({
            level: "medium",
            title: "Métricas pendentes",
            description: `${withoutCoreMetrics.length} publicação(ões) ainda estão sem views, curtidas e compartilhamentos preenchidos.`,
            count: withoutCoreMetrics.length,
        });
    }

    if (pendingApproval.length) {
        alerts.push({
            level: "medium",
            title: "Aprovações paradas",
            description: `${pendingApproval.length} conteúdo(s) aguardam aprovação há 3 dias ou mais.`,
            count: pendingApproval.length,
        });
    }

    if (lowPerformance.length) {
        alerts.push({
            level: "low",
            title: "Conteúdos com índice baixo",
            description: `${lowPerformance.length} publicação(ões) ficaram com Índice SQUAD abaixo de 45 no mês.`,
            count: lowPerformance.length,
        });
    }

    if (!alerts.length) {
        alerts.push({
            level: "ok",
            title: "Sem alertas críticos",
            description: "Não há pontos críticos automáticos identificados neste período.",
            count: 0,
        });
    }

    return alerts;
}

function buildCreativeReport(year, month) {
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const rows = db
        .prepare(`
            SELECT *
            FROM creative_jobs
            WHERE status IN ('aprovado', 'finalizado', 'arquivado')
              AND substr(approved_at, 1, 7) = ?
            ORDER BY datetime(approved_at), id
        `)
        .all(monthKey);

    const summary = {
        demands: rows.length,
        pieces: rows.reduce((total, item) => total + Math.max(1, Number(item.quantity || 1)), 0),
        creators: new Set(rows.map((item) => item.creator_name).filter(Boolean)).size,
        avg_days: 0,
    };

    const turnaround = rows
        .map((item) => {
            const start = new Date(item.created_at).getTime();
            const end = new Date(item.approved_at).getTime();
            return Number.isFinite(start) && Number.isFinite(end)
                ? Math.max(0, (end - start) / (1000 * 60 * 60 * 24))
                : null;
        })
        .filter((value) => value !== null);

    summary.avg_days = turnaround.length
        ? Number((turnaround.reduce((a, b) => a + b, 0) / turnaround.length).toFixed(1))
        : 0;

    function groupBy(selector) {
        const map = new Map();
        rows.forEach((item) => {
            const name = selector(item) || "Não informado";
            if (!map.has(name)) map.set(name, { name, demands: 0, pieces: 0 });
            const group = map.get(name);
            group.demands += 1;
            group.pieces += Math.max(1, Number(item.quantity || 1));
        });
        return Array.from(map.values()).sort((a, b) => b.pieces - a.pieces || b.demands - a.demands);
    }

    const byCreator = groupBy((item) => item.creator_name).map((item) => {
        const row = rows.find((job) => job.creator_name === item.name);
        return {
            ...item,
            user: row?.creator_user_id ? getUserById(row.creator_user_id) : null,
        };
    });

    return {
        summary,
        by_brand: groupBy((item) => item.brand),
        by_creator: byCreator,
        by_type: groupBy((item) => item.creative_type),
    };
}

function loadMetaConfig() {
    const configPath = path.join(__dirname, "meta-config.json");
    if (!fs.existsSync(configPath)) {
        return { enabled: false, api_version: "v26.0", accounts: [] };
    }

    try {
        const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
        const accounts = Array.isArray(raw.accounts) ? raw.accounts : [];
        return {
            enabled: raw.enabled !== false && accounts.length > 0,
            api_version: raw.api_version || "v26.0",
            accounts,
        };
    } catch (error) {
        console.error("Erro ao ler meta-config.json:", error.message);
        return { enabled: false, api_version: "v26.0", accounts: [] };
    }
}

function normalizeInstagramPermalink(value) {
    try {
        const url = new URL(String(value || "").trim());
        const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
        if (hostname !== "instagram.com") return "";

        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length < 2 || !["p", "reel", "reels", "tv"].includes(parts[0])) return "";

        const type = parts[0] === "reels" ? "reel" : parts[0];
        const shortcode = String(parts[1] || "").replace(/[^A-Za-z0-9_-]/g, "");
        if (!shortcode) return "";

        return `https://www.instagram.com/${type}/${shortcode}/`;
    } catch {
        return "";
    }
}

function decodeHtmlEntities(value) {
    return String(value || "")
        .replace(/&quot;/gi, '"')
        .replace(/&#34;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">");
}

function parsePublicNumber(value) {
    if (value === null || value === undefined) return 0;

    let raw = String(value)
        .trim()
        .toLowerCase()
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, "");

    if (!raw) return 0;

    let multiplier = 1;
    const suffix = raw.match(/(k|m|b|mil|mi|bi)$/i)?.[1]?.toLowerCase() || "";

    if (suffix) {
        raw = raw.slice(0, -suffix.length);
        if (suffix === "k" || suffix === "mil") multiplier = 1_000;
        if (suffix === "m" || suffix === "mi") multiplier = 1_000_000;
        if (suffix === "b" || suffix === "bi") multiplier = 1_000_000_000;
    }

    if (multiplier > 1) {
        if (raw.includes(",") && !raw.includes(".")) raw = raw.replace(",", ".");
        raw = raw.replace(/,/g, "");
    } else {
        raw = raw.replace(/[.,](?=\d{3}(?:\D|$))/g, "");
        raw = raw.replace(/,/g, ".");
    }

    const number = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.round(number * multiplier);
}

function firstMetaContent(html, key) {
    const tags = String(html || "").match(/<meta\b[^>]*>/gi) || [];

    for (const tag of tags) {
        const propertyMatch = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i);
        if (!propertyMatch || propertyMatch[1].toLowerCase() !== key.toLowerCase()) continue;

        const contentMatch = tag.match(/content\s*=\s*["']([^"']*)["']/i);
        if (contentMatch) return decodeHtmlEntities(contentMatch[1]);
    }

    return "";
}

function maxRegexNumber(text, regexes) {
    let best = 0;

    for (const regex of regexes) {
        const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
        const global = new RegExp(regex.source, flags);
        let match;

        while ((match = global.exec(text)) !== null) {
            const parsed = parsePublicNumber(match[1]);
            if (parsed > best) best = parsed;
            if (global.lastIndex === match.index) global.lastIndex += 1;
        }
    }

    return best;
}

function extractPublicInstagramMetrics(html) {
    const source = decodeHtmlEntities(String(html || ""));
    const description = firstMetaContent(source, "og:description") || firstMetaContent(source, "description");

    let likes = 0;
    let comments = 0;
    let views = 0;

    const descriptionPatterns = [
        /([0-9][0-9.,]*\s*(?:k|m|b)?)\s+likes?\s*,\s*([0-9][0-9.,]*\s*(?:k|m|b)?)\s+comments?/i,
        /([0-9][0-9.,]*\s*(?:mil|mi|bi)?)\s+curtidas?\s*,\s*([0-9][0-9.,]*\s*(?:mil|mi|bi)?)\s+coment[aá]rios?/i,
    ];

    for (const pattern of descriptionPatterns) {
        const match = description.match(pattern);
        if (match) {
            likes = parsePublicNumber(match[1]);
            comments = parsePublicNumber(match[2]);
            break;
        }
    }

    likes = Math.max(
        likes,
        maxRegexNumber(source, [
            /["']like_count["']\s*:\s*([0-9]+)/i,
            /["']likeCount["']\s*:\s*([0-9]+)/i,
            /["']edge_media_preview_like["']\s*:\s*\{[^{}]*["']count["']\s*:\s*([0-9]+)/i,
            /["']edge_liked_by["']\s*:\s*\{[^{}]*["']count["']\s*:\s*([0-9]+)/i,
        ])
    );

    comments = Math.max(
        comments,
        maxRegexNumber(source, [
            /["']comment_count["']\s*:\s*([0-9]+)/i,
            /["']comments_count["']\s*:\s*([0-9]+)/i,
            /["']commentCount["']\s*:\s*([0-9]+)/i,
            /["']edge_media_to_parent_comment["']\s*:\s*\{[^{}]*["']count["']\s*:\s*([0-9]+)/i,
            /["']edge_media_to_comment["']\s*:\s*\{[^{}]*["']count["']\s*:\s*([0-9]+)/i,
        ])
    );

    views = Math.max(
        views,
        maxRegexNumber(source, [
            /["']video_view_count["']\s*:\s*([0-9]+)/i,
            /["']videoViewCount["']\s*:\s*([0-9]+)/i,
            /["']view_count["']\s*:\s*([0-9]+)/i,
            /["']viewCount["']\s*:\s*([0-9]+)/i,
            /["']play_count["']\s*:\s*([0-9]+)/i,
            /["']playCount["']\s*:\s*([0-9]+)/i,
            /["']video_play_count["']\s*:\s*([0-9]+)/i,
            /["']videoPlayCount["']\s*:\s*([0-9]+)/i,
            /([0-9][0-9.,]*\s*(?:k|m|b)?)\s+(?:views|plays)/i,
            /([0-9][0-9.,]*\s*(?:mil|mi|bi)?)\s+(?:visualiza[cç][oõ]es|reprodu[cç][oõ]es)/i,
        ])
    );

    return { views, likes, comments, description };
}

async function fetchInstagramPublicHtml(url) {
    const response = await fetch(url, {
        redirect: "follow",
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
        },
        signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
        throw new Error(`Instagram respondeu HTTP ${response.status}.`);
    }

    return response.text();
}

async function fetchPublicInstagramMetrics(permalink) {
    const targets = [permalink, `${permalink}embed/`];
    let best = { views: 0, likes: 0, comments: 0, description: "" };
    let lastError = "";

    for (const target of targets) {
        try {
            const html = await fetchInstagramPublicHtml(target);
            const metrics = extractPublicInstagramMetrics(html);

            if (metrics.views > best.views) best.views = metrics.views;
            if (metrics.likes > best.likes) best.likes = metrics.likes;
            if (metrics.comments > best.comments) best.comments = metrics.comments;
            if (!best.description && metrics.description) best.description = metrics.description;

            if (best.views > 0 && best.likes > 0 && best.comments >= 0) break;
        } catch (error) {
            lastError = error.message;
        }
    }

    if (best.views === 0 && best.likes === 0 && best.comments === 0) {
        throw new Error(
            lastError ||
                "O Instagram não expôs as métricas públicas desta publicação. Ela pode exigir login ou estar com contagens ocultas."
        );
    }

    return best;
}

async function fetchJson(url, token) {
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(body?.error?.message || `Meta API retornou ${response.status}.`);
    }
    return body;
}

async function findInstagramMediaByPermalink(permalink, account, apiVersion) {
    let url =
        `https://graph.instagram.com/${apiVersion}/${encodeURIComponent(account.ig_user_id)}/media` +
        `?fields=id,media_type,permalink,timestamp,like_count,comments_count&limit=100`;

    for (let page = 0; page < 5 && url; page += 1) {
        const body = await fetchJson(url, account.access_token);
        const items = Array.isArray(body.data) ? body.data : [];

        const found = items.find(
            (item) => normalizeInstagramPermalink(item.permalink) === normalizeInstagramPermalink(permalink)
        );
        if (found) return found;

        url = body?.paging?.next || "";
    }

    return null;
}

async function fetchMediaInsightMetric(mediaId, metric, token, apiVersion) {
    const url =
        `https://graph.instagram.com/${apiVersion}/${encodeURIComponent(mediaId)}/insights` +
        `?metric=${encodeURIComponent(metric)}`;

    try {
        const body = await fetchJson(url, token);
        const item = Array.isArray(body.data) ? body.data[0] : null;
        if (!item) return 0;

        if (Array.isArray(item.values) && item.values.length) {
            return normalizeInteger(item.values[item.values.length - 1]?.value);
        }

        return normalizeInteger(item.value);
    } catch {
        return 0;
    }
}

async function syncContentMetricsFromMeta(content, permalink, metaConfig) {
    let media = null;
    let accountUsed = null;
    let lastError = "";

    for (const account of metaConfig.accounts) {
        if (!account?.ig_user_id || !account?.access_token) continue;

        try {
            media = await findInstagramMediaByPermalink(permalink, account, metaConfig.api_version);
            if (media) {
                accountUsed = account;
                break;
            }
        } catch (error) {
            lastError = error.message;
        }
    }

    if (!media || !accountUsed) {
        throw new Error(lastError || "Publicação não encontrada nas contas Meta configuradas.");
    }

    const token = accountUsed.access_token;
    const apiVersion = metaConfig.api_version;

    const [views, reach, saved, shares, insightLikes, insightComments, totalInteractions] =
        await Promise.all([
            fetchMediaInsightMetric(media.id, "views", token, apiVersion),
            fetchMediaInsightMetric(media.id, "reach", token, apiVersion),
            fetchMediaInsightMetric(media.id, "saved", token, apiVersion),
            fetchMediaInsightMetric(media.id, "shares", token, apiVersion),
            fetchMediaInsightMetric(media.id, "likes", token, apiVersion),
            fetchMediaInsightMetric(media.id, "comments", token, apiVersion),
            fetchMediaInsightMetric(media.id, "total_interactions", token, apiVersion),
        ]);

    const likes = normalizeInteger(media.like_count || insightLikes);
    const comments = normalizeInteger(media.comments_count || insightComments);
    const interactions =
        normalizeInteger(totalInteractions) ||
        likes + comments + normalizeInteger(shares) + normalizeInteger(saved);
    const denominator = normalizeInteger(reach) || normalizeInteger(views);
    const engagement = denominator > 0 ? (interactions / denominator) * 100 : 0;

    db.prepare(`
        UPDATE contents
        SET social_media_id = ?,
            metric_views = ?,
            metric_likes = ?,
            metric_comments = ?,
            metric_shares = ?,
            metric_saves = ?,
            metric_reach = ?,
            metric_total_interactions = ?,
            metric_engagement = ?,
            metrics_updated_at = ?,
            metrics_status = 'ok',
            metrics_message = 'Métricas completas coletadas pela Meta API.',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        String(media.id || ""),
        normalizeInteger(views),
        likes,
        comments,
        normalizeInteger(shares),
        normalizeInteger(saved),
        normalizeInteger(reach),
        interactions,
        Number(engagement.toFixed(2)),
        new Date().toISOString(),
        content.id
    );

    return getContent(content.id);
}

async function syncContentMetricsFromPublicPage(content, permalink) {
    const publicMetrics = await fetchPublicInstagramMetrics(permalink);

    const views = normalizeInteger(publicMetrics.views);
    const likes = normalizeInteger(publicMetrics.likes);
    const comments = normalizeInteger(publicMetrics.comments);
    const interactions = likes + comments;
    const engagement = views > 0 ? (interactions / views) * 100 : 0;

    const notes = [];
    notes.push("Leitura pública do Instagram, sem login Meta.");
    if (views === 0) {
        notes.push("O Instagram não disponibilizou as visualizações publicamente nesta consulta.");
    }
    notes.push("Alcance, compartilhamentos e salvamentos não são públicos e permanecem zerados.");

    db.prepare(`
        UPDATE contents
        SET metric_views = ?,
            metric_likes = ?,
            metric_comments = ?,
            metric_shares = 0,
            metric_saves = 0,
            metric_reach = 0,
            metric_total_interactions = ?,
            metric_engagement = ?,
            metrics_updated_at = ?,
            metrics_status = 'public',
            metrics_message = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        views,
        likes,
        comments,
        interactions,
        Number(engagement.toFixed(2)),
        new Date().toISOString(),
        notes.join(" "),
        content.id
    );

    return getContent(content.id);
}

async function syncContentMetrics(contentId) {
    const content = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(Number(contentId));
    if (!content) throw new Error("Conteúdo não encontrado.");

    const permalink = normalizeInstagramPermalink(content.published_url);
    if (!permalink) {
        throw new Error("Cadastre um link válido de post ou Reel do Instagram.");
    }

    db.prepare(`
        UPDATE contents
        SET metrics_status = 'syncing',
            metrics_message = '',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(content.id);

    const metaConfig = loadMetaConfig();

    if (metaConfig.enabled) {
        try {
            return await syncContentMetricsFromMeta(content, permalink, metaConfig);
        } catch (error) {
            console.warn(`Meta não conseguiu sincronizar conteúdo ${content.id}. Tentando modo público: ${error.message}`);
        }
    }

    try {
        return await syncContentMetricsFromPublicPage(content, permalink);
    } catch (error) {
        const message = `Leitura pública indisponível: ${error.message}`;

        db.prepare(`
            UPDATE contents
            SET metrics_status = 'error',
                metrics_message = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(message, content.id);

        return getContent(content.id);
    }
}

let automaticSyncRunning = false;

async function syncAllPublishedMetrics() {
    if (automaticSyncRunning) return;

    automaticSyncRunning = true;
    try {
        const rows = db
            .prepare(`
                SELECT id
                FROM contents
                WHERE is_live = 1
                  AND TRIM(COALESCE(deleted_at, '')) = ''
                  AND TRIM(COALESCE(published_url, '')) <> ''
                  AND date >= date('now', '-60 days')
                  AND (
                        (
                            date >= date('now', '-14 days')
                            AND (
                                TRIM(COALESCE(metrics_updated_at, '')) = ''
                                OR datetime(metrics_updated_at) <= datetime('now', '-6 hours')
                            )
                        )
                        OR
                        (
                            date < date('now', '-14 days')
                            AND (
                                TRIM(COALESCE(metrics_updated_at, '')) = ''
                                OR datetime(metrics_updated_at) <= datetime('now', '-1 day')
                            )
                        )
                  )
                ORDER BY id DESC
            `)
            .all();

        for (const row of rows) {
            try {
                await syncContentMetrics(row.id);
            } catch (error) {
                console.error(`Falha ao sincronizar conteúdo ${row.id}:`, error.message);
            }
        }
    } finally {
        automaticSyncRunning = false;
    }
}

app.get("/api/status", (req, res) => {
    res.json({
        status: "online",
        app: "SQUAD Social Planner",
        database: databasePath,
        meta_configured: loadMetaConfig().enabled,
        time: new Date().toISOString(),
    });
});

app.get("/api/meta/status", (req, res) => {
    res.json({
        configured: false,
        metrics_mode: "manual",
        message: "Métricas manuais ativas. O link da publicação é opcional.",
    });
});

app.post("/api/admin/verify", (req, res) => {
    if (!validateAdmin(req.body?.password)) {
        return res.status(401).json({ error: "Senha administrativa incorreta." });
    }
    res.json({ success: true });
});

app.get("/api/users", (req, res) => {
    try {
        const includeInactive = String(req.query.include_inactive || "") === "1";
        const rows = db
            .prepare(`
                SELECT * FROM users
                ${includeInactive ? "" : "WHERE active = 1"}
                ORDER BY name
            `)
            .all();
        res.json(rows.map(serializeUser));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao carregar usuários." });
    }
});

app.post("/api/users", (req, res) => {
    try {
        const name = String(req.body?.name || "").trim();
        if (!name) return res.status(400).json({ error: "Digite o nome do colaborador." });

        const existing = db.prepare(`SELECT * FROM users WHERE LOWER(name) = LOWER(?)`).get(name);
        if (existing) {
            if (existing.active === 0) {
                db.prepare(`UPDATE users SET active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
                    existing.id
                );
                return res.status(201).json(getUserById(existing.id));
            }
            return res.status(409).json({ error: "Esse colaborador já existe." });
        }

        const result = db.prepare(`INSERT INTO users (name, active) VALUES (?, 1)`).run(name);
        res.status(201).json(getUserById(result.lastInsertRowid));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao criar colaborador." });
    }
});

app.put("/api/users/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
        if (!existing) return res.status(404).json({ error: "Colaborador não encontrado." });

        const name = String(req.body?.name ?? existing.name).trim();
        const nickname = String(req.body?.nickname ?? existing.nickname ?? "").trim();
        const role = String(req.body?.role ?? existing.role ?? "").trim();
        const brands = Array.isArray(req.body?.brands) ? req.body.brands : parseJsonArray(existing.brands);

        if (!name) return res.status(400).json({ error: "Nome obrigatório." });

        const duplicate = db
            .prepare(`SELECT id FROM users WHERE LOWER(name) = LOWER(?) AND id <> ?`)
            .get(name, id);
        if (duplicate) return res.status(409).json({ error: "Já existe outro colaborador com esse nome." });

        const updateProfile = db.transaction(() => {
            db.prepare(`
                UPDATE users
                SET name = ?, nickname = ?, role = ?, brands = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(name, nickname, role, JSON.stringify(brands), id);

            if (name !== existing.name) {
                db.prepare(`
                    UPDATE contents
                    SET responsible = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE responsible = ?
                `).run(name, existing.name);
            }
        });

        updateProfile();
        res.json(getUserById(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao atualizar perfil." });
    }
});

app.post("/api/users/:id/photo", profileUpload.single("photo"), (req, res) => {
    try {
        const id = Number(req.params.id);
        const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);

        if (!existing) {
            if (req.file) removeProfilePhysicalFile(req.file.filename);
            return res.status(404).json({ error: "Colaborador não encontrado." });
        }

        if (!req.file) return res.status(400).json({ error: "Selecione uma foto." });

        db.prepare(`
            UPDATE users
            SET photo_filename = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(req.file.filename, id);

        if (existing.photo_filename) removeProfilePhysicalFile(existing.photo_filename);
        res.json(getUserById(id));
    } catch (error) {
        console.error(error);
        if (req.file) removeProfilePhysicalFile(req.file.filename);
        res.status(500).json({ error: "Erro ao atualizar foto de perfil." });
    }
});

app.delete("/api/users/:id/photo", (req, res) => {
    try {
        const id = Number(req.params.id);
        const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
        if (!existing) return res.status(404).json({ error: "Colaborador não encontrado." });

        db.prepare(`UPDATE users SET photo_filename = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
        if (existing.photo_filename) removeProfilePhysicalFile(existing.photo_filename);
        res.json(getUserById(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao remover foto." });
    }
});

app.delete("/api/users/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!validateAdmin(req.body?.password)) {
            return res.status(401).json({ error: "Senha administrativa incorreta." });
        }

        const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
        if (!user) return res.status(404).json({ error: "Colaborador não encontrado." });

        db.prepare(`UPDATE users SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
        res.json({ success: true, preserved_history: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao remover colaborador." });
    }
});

app.get("/api/contents", (req, res) => {
    try {
        const userId = Number(req.query.user_id);
        if (!userId) return res.status(400).json({ error: "user_id obrigatório." });

        const contents = db
            .prepare(`
                SELECT *
                FROM contents
                WHERE user_id = ?
                  AND TRIM(COALESCE(deleted_at, '')) = ''
                ORDER BY date DESC, id DESC
            `)
            .all(userId)
            .map(serializeContent);
        res.json(contents);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao carregar conteúdos." });
    }
});

app.get("/api/contents/:id", (req, res) => {
    try {
        const content = getContent(req.params.id);
        if (!content) return res.status(404).json({ error: "Conteúdo não encontrado." });
        res.json(content);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao carregar conteúdo." });
    }
});

app.post("/api/contents", (req, res) => {
    try {
        const {
            user_id,
            title,
            date,
            brands,
            format,
            status,
            responsible,
            urgency,
            reference_link,
            description,
            copy_text,
        } = req.body || {};

        if (!user_id) return res.status(400).json({ error: "Usuário obrigatório." });
        if (!String(title || "").trim()) return res.status(400).json({ error: "Título obrigatório." });
        if (!date) return res.status(400).json({ error: "Data obrigatória." });
        if (!Array.isArray(brands) || brands.length === 0) {
            return res.status(400).json({ error: "Selecione uma marca." });
        }

        const result = db
            .prepare(`
                INSERT INTO contents (
                    user_id, title, date, brands, format, status, responsible, urgency,
                    reference_link, description, copy_text, approval_status, manager_note,
                    published_by_user_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', '', ?)
            `)
            .run(
                Number(user_id),
                String(title).trim(),
                date,
                JSON.stringify(brands),
                format || "Reels",
                status || "Planejado",
                responsible || "",
                urgency || "verde",
                reference_link || "",
                description || "",
                copy_text || "",
                Number(user_id)
            );

        res.status(201).json(getContent(result.lastInsertRowid));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao criar conteúdo." });
    }
});

app.put("/api/contents/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const existing = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id);
        if (!existing) return res.status(404).json({ error: "Conteúdo não encontrado." });

        const body = req.body || {};
        const oldBrands = parseJsonArray(existing.brands);
        const title = body.title !== undefined ? String(body.title).trim() : existing.title;
        const date = body.date !== undefined ? body.date : existing.date;
        const brands = body.brands !== undefined ? body.brands : oldBrands;
        const format = body.format !== undefined ? body.format : existing.format;
        const status = body.status !== undefined ? body.status : existing.status;
        const responsible = body.responsible !== undefined ? body.responsible : existing.responsible;
        const urgency = body.urgency !== undefined ? body.urgency : existing.urgency;
        const referenceLink =
            body.reference_link !== undefined ? body.reference_link : existing.reference_link;
        const description = body.description !== undefined ? body.description : existing.description;
        const copyText = body.copy_text !== undefined ? body.copy_text : existing.copy_text;
        const approvalStatus =
            body.approval_status !== undefined ? body.approval_status : existing.approval_status;
        const managerNote = body.manager_note !== undefined ? body.manager_note : existing.manager_note;
        const publishedUrl =
            body.published_url !== undefined ? String(body.published_url || "").trim() : existing.published_url;
        const publishedByUserId =
            body.published_by_user_id !== undefined
                ? Number(body.published_by_user_id) || null
                : existing.published_by_user_id || existing.user_id;
        const platform = body.platform !== undefined ? body.platform : existing.platform || "Instagram";

        let publishedAt =
            body.published_at !== undefined ? body.published_at : existing.published_at || "";

        /*
         * "Publicado / NO AR" é controlado exclusivamente pelo endpoint /live.
         * Enquanto estiver no ar, o workflow fica travado em Publicado.
         */
        const effectiveStatus =
            Boolean(Number(existing.is_live || 0)) ? "Publicado" : status;

        if (!title) return res.status(400).json({ error: "Título obrigatório." });
        if (!Array.isArray(brands) || brands.length === 0) {
            return res.status(400).json({ error: "Selecione pelo menos uma marca." });
        }

        db.prepare(`
            UPDATE contents
            SET title = ?, date = ?, brands = ?, format = ?, status = ?, responsible = ?, urgency = ?,
                reference_link = ?, description = ?, copy_text = ?, approval_status = ?, manager_note = ?,
                published_url = ?, published_by_user_id = ?, published_at = ?, platform = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            title,
            date,
            JSON.stringify(brands),
            format,
            effectiveStatus,
            responsible,
            urgency,
            referenceLink,
            description,
            copyText,
            approvalStatus,
            managerNote,
            publishedUrl,
            publishedByUserId,
            publishedAt,
            platform,
            id
        );

        res.json(getContent(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao atualizar conteúdo." });
    }
});

app.delete("/api/contents/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        const existing = db
            .prepare(`SELECT * FROM contents WHERE id = ?`)
            .get(id);

        if (!existing) {
            return res.status(404).json({ error: "Conteúdo não encontrado." });
        }

        if (String(existing.deleted_at || "").trim()) {
            return res.status(409).json({ error: "Este conteúdo já está na lixeira." });
        }

        const deletedAt = new Date().toISOString();

        db.prepare(`
            UPDATE contents
            SET deleted_at = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(deletedAt, id);

        res.json({
            success: true,
            temporary: true,
            deleted_at: deletedAt,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao mover conteúdo para a lixeira." });
    }
});

app.get("/api/trash", (req, res) => {
    try {
        purgeExpiredTrash();

        const userId = Number(req.query.user_id);

        if (!userId) {
            return res.status(400).json({ error: "user_id obrigatório." });
        }

        const items = db
            .prepare(`
                SELECT *
                FROM contents
                WHERE user_id = ?
                  AND TRIM(COALESCE(deleted_at, '')) <> ''
                  AND datetime(deleted_at) > datetime('now', '-24 hours')
                ORDER BY datetime(deleted_at) DESC, id DESC
            `)
            .all(userId)
            .map(serializeContent);

        res.json(items);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao carregar a lixeira." });
    }
});

app.post("/api/trash/:id/restore", (req, res) => {
    try {
        purgeExpiredTrash();

        const id = Number(req.params.id);
        const existing = db
            .prepare(`
                SELECT *
                FROM contents
                WHERE id = ?
                  AND TRIM(COALESCE(deleted_at, '')) <> ''
            `)
            .get(id);

        if (!existing) {
            return res.status(404).json({
                error: "Este conteúdo não está mais disponível para restauração.",
            });
        }

        const deletedAt = new Date(existing.deleted_at).getTime();

        if (
            !Number.isFinite(deletedAt) ||
            Date.now() - deletedAt >= 24 * 60 * 60 * 1000
        ) {
            purgeExpiredTrash();

            return res.status(410).json({
                error: "O prazo de 24 horas para restauração expirou.",
            });
        }

        db.prepare(`
            UPDATE contents
            SET deleted_at = '',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(id);

        res.json(getContent(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao restaurar conteúdo." });
    }
});

app.get("/api/creative/jobs", (req, res) => {
    try {
        purgeExpiredCreativeFiles();

        const userId = Number(req.query.user_id);
        if (!userId) {
            return res.status(400).json({ error: "user_id obrigatório." });
        }

        repairCreativeRecipientLinksForUser(userId);

        const created = db
            .prepare(`
                SELECT *
                FROM creative_jobs
                WHERE creator_user_id = ?
                ORDER BY id DESC
            `)
            .all(userId)
            .map(serializeCreativeJob);

        const currentUser = getActiveUserRowById(userId);

        const received = db
            .prepare(`
                SELECT cj.*
                FROM creative_jobs cj
                LEFT JOIN users linked_recipient
                    ON linked_recipient.id = cj.recipient_user_id
                   AND linked_recipient.active = 1
                WHERE cj.status = 'aprovado'
                  AND (
                        cj.recipient_user_id = ?
                        OR (
                            linked_recipient.id IS NULL
                            AND (
                                lower(trim(cj.recipient_name)) = lower(trim(?))
                                OR lower(trim(cj.recipient_name)) = lower(trim(?))
                            )
                        )
                  )
                ORDER BY datetime(cj.approved_at) DESC, cj.id DESC
            `)
            .all(
                userId,
                currentUser?.name || "",
                currentUser?.nickname || ""
            )
            .map(serializeCreativeJob);

        const temporary = db
            .prepare(`
                SELECT *
                FROM creative_jobs
                WHERE recipient_user_id = ?
                  AND status = 'finalizado'
                  AND TRIM(COALESCE(recipient_finished_at, '')) <> ''
                  AND datetime(recipient_finished_at) > datetime('now', '-7 days')
                ORDER BY datetime(recipient_finished_at) DESC, id DESC
            `)
            .all(userId)
            .map(serializeCreativeJob);

        const unreadCount = received.filter(
            (item) => !String(item.recipient_read_at || "").trim()
        ).length;

        res.json({
            created,
            received,
            temporary,
            unread_count: unreadCount,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao carregar a Central Criativa." });
    }
});

app.post("/api/creative/jobs", (req, res) => {
    try {
        const creatorId = Number(req.body?.creator_user_id || req.body?.user_id);
        const recipientId = Number(req.body?.recipient_user_id);
        const creator = getUserById(creatorId);
        const recipient = getUserById(recipientId);
        const title = String(req.body?.title || "").trim();
        const brand = String(req.body?.brand || "").trim();
        const creativeType = String(req.body?.creative_type || "Outro").trim();
        const quantity = Math.max(1, normalizeInteger(req.body?.quantity) || 1);
        const deadline = String(req.body?.deadline || "").trim();
        const briefing = String(req.body?.briefing || "").trim();

        if (!creator) return res.status(400).json({ error: "Criador inválido." });
        if (!recipient) return res.status(400).json({ error: "Selecione um destinatário válido." });
        if (!title) return res.status(400).json({ error: "Título obrigatório." });
        if (!brand) return res.status(400).json({ error: "Marca obrigatória." });
        if (!deadline) return res.status(400).json({ error: "Prazo obrigatório." });

        const result = db.prepare(`
            INSERT INTO creative_jobs (
                creator_user_id, recipient_user_id, creator_name, recipient_name,
                title, brand, creative_type, quantity, deadline, briefing, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'em_producao')
        `).run(
            creatorId,
            recipientId,
            creator.nickname || creator.name,
            recipient.nickname || recipient.name,
            title,
            brand,
            creativeType,
            quantity,
            deadline,
            briefing
        );

        res.status(201).json(getCreativeJob(result.lastInsertRowid));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao criar produção criativa." });
    }
});

app.put("/api/creative/jobs/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.body?.user_id);
        const existing = db.prepare(`SELECT * FROM creative_jobs WHERE id = ?`).get(id);
        if (!existing) return res.status(404).json({ error: "Produção não encontrada." });
        if (Number(existing.creator_user_id) !== userId) {
            return res.status(403).json({ error: "Somente quem criou a produção pode editar." });
        }
        if (!["em_producao", "ajuste"].includes(existing.status)) {
            return res.status(409).json({ error: "Esta produção não pode mais ser editada." });
        }

        const recipientId = Number(req.body?.recipient_user_id || existing.recipient_user_id);
        const recipient = getUserById(recipientId);
        if (!recipient) return res.status(400).json({ error: "Destinatário inválido." });

        const title = String(req.body?.title ?? existing.title).trim();
        const brand = String(req.body?.brand ?? existing.brand).trim();
        const creativeType = String(req.body?.creative_type ?? existing.creative_type).trim();
        const quantity = Math.max(1, normalizeInteger(req.body?.quantity ?? existing.quantity) || 1);
        const deadline = String(req.body?.deadline ?? existing.deadline).trim();
        const briefing = String(req.body?.briefing ?? existing.briefing ?? "").trim();

        db.prepare(`
            UPDATE creative_jobs
            SET recipient_user_id = ?, recipient_name = ?, title = ?, brand = ?,
                creative_type = ?, quantity = ?, deadline = ?, briefing = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            recipientId,
            recipient.nickname || recipient.name,
            title,
            brand,
            creativeType,
            quantity,
            deadline,
            briefing,
            id
        );

        res.json(getCreativeJob(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao atualizar produção criativa." });
    }
});

app.post("/api/creative/jobs/:id/files", upload.array("files", 10), (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.body?.user_id);
        const job = db.prepare(`SELECT * FROM creative_jobs WHERE id = ?`).get(id);
        if (!job) {
            req.files?.forEach((file) => removeContentPhysicalFile(file.filename));
            return res.status(404).json({ error: "Produção não encontrada." });
        }
        if (Number(job.creator_user_id) !== userId) {
            req.files?.forEach((file) => removeContentPhysicalFile(file.filename));
            return res.status(403).json({ error: "Somente quem criou a produção pode enviar arquivos." });
        }
        if (!["em_producao", "ajuste"].includes(job.status)) {
            req.files?.forEach((file) => removeContentPhysicalFile(file.filename));
            return res.status(409).json({ error: "Arquivos não podem mais ser alterados nesta etapa." });
        }
        if (!req.files?.length) return res.status(400).json({ error: "Nenhum arquivo selecionado." });

        const insert = db.prepare(`
            INSERT INTO creative_files (job_id, original_name, filename, mime_type, file_size)
            VALUES (?, ?, ?, ?, ?)
        `);
        const transaction = db.transaction((files) => {
            files.forEach((file) => insert.run(id, file.originalname, file.filename, file.mimetype, file.size));
        });
        transaction(req.files);

        res.json(getCreativeJob(id));
    } catch (error) {
        console.error(error);
        req.files?.forEach((file) => removeContentPhysicalFile(file.filename));
        res.status(500).json({ error: "Erro ao enviar arquivos da produção." });
    }
});

app.get("/api/creative/files/:id/download", (req, res) => {
    try {
        const id = Number(req.params.id);

        const file = db
            .prepare(`
                SELECT id, job_id, original_name, filename, mime_type, file_size
                FROM creative_files
                WHERE id = ?
            `)
            .get(id);

        if (!file) {
            return res.status(404).json({ error: "Arquivo não encontrado." });
        }

        const filePath = path.join(uploadDirectory, file.filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                error: "O arquivo não está mais disponível no servidor.",
            });
        }

        /*
         * res.download define Content-Disposition: attachment usando
         * original_name. Assim o navegador salva exatamente com o nome
         * que o designer enviou, e não com o nome interno do servidor.
         */
        return res.download(filePath, file.original_name, (error) => {
            if (error && !res.headersSent) {
                console.error("Erro no download criativo:", error);
                res.status(500).json({
                    error: "Erro ao baixar o arquivo.",
                });
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao baixar o arquivo." });
    }
});

app.delete("/api/creative/files/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.body?.user_id);
        const file = db.prepare(`SELECT * FROM creative_files WHERE id = ?`).get(id);
        if (!file) return res.status(404).json({ error: "Arquivo não encontrado." });
        const job = db.prepare(`SELECT * FROM creative_jobs WHERE id = ?`).get(file.job_id);
        if (!job || Number(job.creator_user_id) !== userId) {
            return res.status(403).json({ error: "Somente quem criou a produção pode remover arquivos." });
        }
        if (!["em_producao", "ajuste"].includes(job.status)) {
            return res.status(409).json({ error: "Este arquivo não pode mais ser removido." });
        }
        db.prepare(`DELETE FROM creative_files WHERE id = ?`).run(id);
        removeContentPhysicalFile(file.filename);
        res.json(getCreativeJob(file.job_id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao remover arquivo." });
    }
});

app.post("/api/creative/jobs/:id/submit", (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.body?.user_id);
        const job = db.prepare(`SELECT * FROM creative_jobs WHERE id = ?`).get(id);
        if (!job) return res.status(404).json({ error: "Produção não encontrada." });
        if (Number(job.creator_user_id) !== userId) {
            return res.status(403).json({ error: "Somente quem criou pode enviar para aprovação." });
        }
        if (!["em_producao", "ajuste"].includes(job.status)) {
            return res.status(409).json({ error: "Esta produção já foi enviada." });
        }
        const fileCount = db.prepare(`SELECT COUNT(*) AS total FROM creative_files WHERE job_id = ?`).get(id).total;
        if (!fileCount) return res.status(400).json({ error: "Adicione pelo menos um arquivo antes de enviar para aprovação." });

        db.prepare(`
            UPDATE creative_jobs
            SET status = 'aguardando_aprovacao', submitted_at = ?, manager_note = '', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(new Date().toISOString(), id);
        res.json(getCreativeJob(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao enviar para aprovação." });
    }
});

app.get("/api/creative/manager-jobs", (req, res) => {
    try {
        const rows = db
            .prepare(`
                SELECT * FROM creative_jobs
                WHERE status = 'aguardando_aprovacao'
                ORDER BY datetime(submitted_at), id
            `)
            .all()
            .map(serializeCreativeJob);

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao carregar aprovações." });
    }
});

app.post("/api/creative/jobs/:id/review", (req, res) => {
    try {
        const id = Number(req.params.id);
        const action = String(req.body?.action || "");
        const note = String(req.body?.note || "").trim();
        const job = db.prepare(`SELECT * FROM creative_jobs WHERE id = ?`).get(id);
        if (!job) return res.status(404).json({ error: "Produção não encontrada." });
        if (job.status !== "aguardando_aprovacao") {
            return res.status(409).json({ error: "Esta produção não está aguardando aprovação." });
        }

        if (action === "approve") {
            let recipient = job.recipient_user_id
                ? getActiveUserRowById(job.recipient_user_id)
                : null;

            if (!recipient) {
                recipient = repairCreativeRecipientLink(id);
            }

            if (!recipient) {
                return res.status(409).json({
                    error:
                        "Não foi possível localizar o destinatário atual desta arte. Abra a produção, selecione novamente 'Entregar para' e envie para aprovação.",
                });
            }

            const now = new Date().toISOString();
            db.prepare(`
                UPDATE creative_jobs
                SET status = 'aprovado',
                    recipient_user_id = ?,
                    recipient_name = ?,
                    manager_note = '',
                    approved_at = ?,
                    delivered_at = ?,
                    recipient_read_at = '',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                recipient.id,
                recipient.nickname || recipient.name,
                now,
                now,
                id
            );
        } else if (action === "adjust") {
            if (!note) return res.status(400).json({ error: "Descreva o ajuste solicitado." });
            db.prepare(`
                UPDATE creative_jobs
                SET status = 'ajuste', manager_note = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(note, id);
        } else {
            return res.status(400).json({ error: "Ação inválida." });
        }

        res.json(getCreativeJob(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao revisar produção." });
    }
});

app.post("/api/creative/jobs/:id/read", (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.body?.user_id);
        const job = db.prepare(`SELECT * FROM creative_jobs WHERE id = ?`).get(id);
        if (!job) return res.status(404).json({ error: "Entrega não encontrada." });
        if (Number(job.recipient_user_id) !== userId) {
            return res.status(403).json({ error: "Esta entrega não pertence a este usuário." });
        }
        if (job.status !== "aprovado") return res.status(409).json({ error: "A entrega ainda não foi aprovada." });

        if (!String(job.recipient_read_at || "").trim()) {
            db.prepare(`UPDATE creative_jobs SET recipient_read_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
                .run(new Date().toISOString(), id);
        }
        res.json(getCreativeJob(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao marcar entrega como visualizada." });
    }
});

app.post("/api/creative/jobs/:id/finish", (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.body?.user_id);

        const job = db
            .prepare(`SELECT * FROM creative_jobs WHERE id = ?`)
            .get(id);

        if (!job) {
            return res.status(404).json({ error: "Entrega não encontrada." });
        }

        if (Number(job.recipient_user_id) !== userId) {
            return res.status(403).json({
                error: "Esta entrega não pertence a este usuário.",
            });
        }

        if (job.status !== "aprovado") {
            return res.status(409).json({
                error: "Somente uma entrega aprovada pode ser finalizada.",
            });
        }

        const nowIso = new Date().toISOString();

        db.prepare(`
            UPDATE creative_jobs
            SET status = 'finalizado',
                recipient_finished_at = ?,
                recipient_read_at = CASE
                    WHEN TRIM(COALESCE(recipient_read_at, '')) = ''
                    THEN ?
                    ELSE recipient_read_at
                END,
                linked_content_id = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(nowIso, nowIso, id);

        res.json(getCreativeJob(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao finalizar entrega." });
    }
});

app.post("/api/creative/jobs/:id/link-content", (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.body?.user_id);
        const contentId = Number(req.body?.content_id);
        const job = db.prepare(`SELECT * FROM creative_jobs WHERE id = ?`).get(id);
        if (!job) return res.status(404).json({ error: "Entrega não encontrada." });
        if (job.status !== "aprovado") return res.status(409).json({ error: "A entrega precisa estar aprovada." });
        if (Number(job.recipient_user_id) !== userId) {
            return res.status(403).json({ error: "Esta entrega não pertence a este usuário." });
        }
        const content = db.prepare(`SELECT * FROM contents WHERE id = ? AND user_id = ?`).get(contentId, userId);
        if (!content) return res.status(400).json({ error: "Conteúdo inválido para este usuário." });

        db.prepare(`UPDATE creative_jobs SET linked_content_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(contentId, id);
        res.json(getCreativeJob(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao vincular entrega ao conteúdo." });
    }
});

app.post("/api/contents/:id/files", upload.array("files", 10), (req, res) => {
    try {
        const contentId = Number(req.params.id);
        const content = db.prepare(`SELECT id FROM contents WHERE id = ?`).get(contentId);

        if (!content) {
            req.files?.forEach((file) => removeContentPhysicalFile(file.filename));
            return res.status(404).json({ error: "Conteúdo não encontrado." });
        }

        if (!req.files?.length) return res.status(400).json({ error: "Nenhum arquivo selecionado." });

        const insertFile = db.prepare(`
            INSERT INTO files (content_id, original_name, filename, mime_type, file_size)
            VALUES (?, ?, ?, ?, ?)
        `);
        const insertMany = db.transaction((files) => {
            files.forEach((file) =>
                insertFile.run(contentId, file.originalname, file.filename, file.mimetype, file.size)
            );
        });
        insertMany(req.files);

        res.json(getContent(contentId));
    } catch (error) {
        console.error(error);
        req.files?.forEach((file) => removeContentPhysicalFile(file.filename));
        res.status(500).json({ error: "Erro ao salvar arquivos." });
    }
});

app.delete("/api/files/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        const file = db.prepare(`SELECT * FROM files WHERE id = ?`).get(id);
        if (!file) return res.status(404).json({ error: "Arquivo não encontrado." });

        db.prepare(`DELETE FROM files WHERE id = ?`).run(id);
        removeContentPhysicalFile(file.filename);
        res.json({ success: true, content_id: file.content_id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao excluir arquivo." });
    }
});

app.put("/api/contents/:id/metrics", (req, res) => {
    try {
        const id = Number(req.params.id);
        const existing = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id);

        if (!existing) {
            return res.status(404).json({ error: "Conteúdo não encontrado." });
        }

        const views = normalizeInteger(req.body?.views);
        const likes = normalizeInteger(req.body?.likes);
        const comments = normalizeInteger(req.body?.comments);
        const shares = normalizeInteger(req.body?.shares);
        const saves = normalizeInteger(req.body?.saves);
        const reach = normalizeInteger(req.body?.reach);

        const interactions = likes + comments + shares + saves;
        const denominator = reach || views;
        const engagement = denominator > 0 ? (interactions / denominator) * 100 : 0;

        const nowIso = new Date().toISOString();

        db.prepare(`
            UPDATE contents
            SET metric_views = ?,
                metric_likes = ?,
                metric_comments = ?,
                metric_shares = ?,
                metric_saves = ?,
                metric_reach = ?,
                metric_total_interactions = ?,
                metric_engagement = ?,
                metrics_updated_at = ?,
                metrics_status = 'manual',
                metrics_message = 'Métricas preenchidas manualmente.',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            views,
            likes,
            comments,
            shares,
            saves,
            reach,
            interactions,
            Number(engagement.toFixed(2)),
            nowIso,
            id
        );

        res.json(getContent(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao salvar métricas." });
    }
});

app.put("/api/contents/:id/live", (req, res) => {
    try {
        const id = Number(req.params.id);
        const existing = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id);

        if (!existing) {
            return res.status(404).json({ error: "Conteúdo não encontrado." });
        }

        const isLive = Boolean(req.body?.is_live);
        const publisherId =
            Number(req.body?.published_by_user_id) ||
            existing.published_by_user_id ||
            existing.user_id;

        if (isLive) {
            const publishedAt =
                String(existing.published_at || "").trim() ||
                new Date().toISOString();

            db.prepare(`
                UPDATE contents
                SET is_live = 1,
                    status = 'Publicado',
                    published_at = ?,
                    published_by_user_id = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(publishedAt, publisherId, id);
        } else {
            const nextStatus =
                existing.status === "Publicado" ? "Agendado" : existing.status;

            db.prepare(`
                UPDATE contents
                SET is_live = 0,
                    status = ?,
                    published_at = '',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(nextStatus, id);
        }

        res.json(getContent(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao atualizar status NO AR." });
    }
});

app.post("/api/contents/:id/metrics/refresh", (req, res) => {
    res.status(410).json({
        error: "Sincronização automática desativada. As métricas do SQUAD são preenchidas manualmente.",
    });
});

app.get("/api/reports/marketing", (req, res) => {
    try {
        const year = Number(req.query.year);
        const month = Number(req.query.month);

        if (!year || month < 1 || month > 12) {
            return res.status(400).json({ error: "Ano e mês inválidos." });
        }

        const currentItems = getReportContents(year, month);
        const previous = previousMonth(year, month);
        const previousItems = getReportContents(previous.year, previous.month);
        const currentSummary = buildReportSummary(currentItems);
        const previousSummary = buildReportSummary(previousItems);

        const ranking = buildRanking(currentItems.filter((item) => Boolean(item.is_live)));
        const byBrand = groupPerformance(
            currentItems.filter((item) => Boolean(item.is_live)),
            (item) => item.brands
        );
        const byFormat = groupPerformance(
            currentItems.filter((item) => Boolean(item.is_live)),
            (item) => item.format
        );
        const byCollaborator = groupPerformance(
            currentItems.filter((item) => Boolean(item.is_live)),
            (item) => item.publisher?.name || item.responsible || "Não informado"
        ).map((item) => {
            const user = currentItems
                .map((content) => content.publisher)
                .find((profile) => profile?.name === item.name);
            return { ...item, user: user || null };
        });

        const topViews =
            [...ranking]
                .filter((item) => normalizeInteger(item.metric_views) > 0)
                .sort((a, b) => b.metric_views - a.metric_views)[0] || null;
        const topLikes =
            [...ranking]
                .filter((item) => normalizeInteger(item.metric_likes) > 0)
                .sort((a, b) => b.metric_likes - a.metric_likes)[0] || null;

        const topShares =
            [...ranking]
                .filter((item) => normalizeInteger(item.metric_shares) > 0)
                .sort((a, b) => b.metric_shares - a.metric_shares)[0] || null;

        const topSquad = ranking[0] || null;

        const yearRows = db
            .prepare(`
                SELECT *
                FROM contents
                WHERE TRIM(COALESCE(deleted_at, '')) = ''
                  AND COALESCE(
                        NULLIF(substr(published_at, 1, 10), ''),
                        date
                      ) >= ?
                  AND COALESCE(
                        NULLIF(substr(published_at, 1, 10), ''),
                        date
                      ) < ?
                ORDER BY
                    COALESCE(NULLIF(substr(published_at, 1, 10), ''), date)
            `)
            .all(`${year}-01-01`, `${year + 1}-01-01`)
            .map(serializeContent);

        const yearly = Array.from({ length: 12 }, (_, index) => {
            const monthNumber = index + 1;

            const items = yearRows.filter((item) => {
                const reportDate =
                    String(item.published_at || "").trim().slice(0, 10) ||
                    item.date;

                return (
                    Number(reportDate.slice(5, 7)) === monthNumber &&
                    Boolean(item.is_live)
                );
            });

            const summary = buildReportSummary(items);

            return {
                month: monthNumber,
                published: summary.published,
                views: summary.views,
                interactions: summary.interactions,
                engagement: summary.engagement,
            };
        });

        res.json({
            period: { year, month },
            meta: {
                configured: false,
                public_mode: false,
                mode: "manual",
                message:
                    "Métricas manuais. O Índice SQUAD usa somente visualizações, curtidas e compartilhamentos.",
            },
            summary: currentSummary,
            comparison: {
                published: percentChange(currentSummary.published, previousSummary.published),
                views: percentChange(currentSummary.views, previousSummary.views),
                likes: percentChange(currentSummary.likes, previousSummary.likes),
                shares: percentChange(currentSummary.shares, previousSummary.shares),
            },
            ranking,
            highlights: {
                top_views: topViews,
                top_likes: topLikes,
                top_shares: topShares,
                top_squad: topSquad,
            },
            by_brand: byBrand,
            by_format: byFormat,
            by_collaborator: byCollaborator,
            creative: buildCreativeReport(year, month),
            attention: buildAttention(currentItems, ranking),
            yearly,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao gerar relatório do Marketing." });
    }
});

app.get("/api/reminders", (req, res) => {
    try {
        const year = Number(req.query.year);
        if (!year || year < 2000 || year > 2100) {
            return res.status(400).json({ error: "Ano inválido." });
        }

        const system = generateSystemReminders(year);
        const custom = db
            .prepare(`
                SELECT * FROM reminders
                WHERE substr(date, 1, 4) = ?
                ORDER BY date, id
            `)
            .all(String(year))
            .map((item) => ({
                ...item,
                id: `custom-${item.id}`,
                db_id: item.id,
                system: false,
            }));

        res.json([...system, ...custom].sort((a, b) => a.date.localeCompare(b.date)));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao carregar lembretes." });
    }
});

app.post("/api/reminders", (req, res) => {
    try {
        const { title, date, type, city, note, created_by } = req.body || {};
        if (!String(title || "").trim()) return res.status(400).json({ error: "Título obrigatório." });
        if (!date) return res.status(400).json({ error: "Data obrigatória." });

        const result = db
            .prepare(`
                INSERT INTO reminders (title, date, type, city, note, created_by)
                VALUES (?, ?, ?, ?, ?, ?)
            `)
            .run(
                String(title).trim(),
                date,
                type || "Personalizado",
                city || "",
                note || "",
                created_by || ""
            );

        const reminder = db.prepare(`SELECT * FROM reminders WHERE id = ?`).get(result.lastInsertRowid);
        res.status(201).json({
            ...reminder,
            id: `custom-${reminder.id}`,
            db_id: reminder.id,
            system: false,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao criar lembrete." });
    }
});

app.delete("/api/reminders/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        const result = db.prepare(`DELETE FROM reminders WHERE id = ?`).run(id);
        if (result.changes === 0) return res.status(404).json({ error: "Lembrete não encontrado." });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao excluir lembrete." });
    }
});

app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        const profileRequest = req.path.includes("/photo");
        return res.status(400).json({
            error:
                error.code === "LIMIT_FILE_SIZE"
                    ? profileRequest
                        ? "Foto muito grande. Limite de 5 MB."
                        : "Arquivo muito grande. Limite de 500 MB."
                    : error.message,
        });
    }

    if (error) {
        console.error(error);
        return res.status(400).json({ error: error.message || "Erro no servidor." });
    }

    next();
});

const purgedOnStart = purgeExpiredTrash();
if (purgedOnStart > 0) {
    console.log(`Lixeira: ${purgedOnStart} conteúdo(s) expirado(s) removido(s).`);
}

const creativePurgedOnStart = purgeExpiredCreativeFiles();
if (creativePurgedOnStart > 0) {
    console.log(
        `Central Criativa: arquivos de ${creativePurgedOnStart} entrega(s) expiradas foram removidos.`
    );
}

app.listen(PORT, "0.0.0.0", () => {
    console.log("");
    console.log("==========================================");
    console.log("        SQUAD SOCIAL PLANNER");
    console.log("==========================================");
    console.log("");
    console.log(`Servidor: http://localhost:${PORT}`);
    console.log(`Banco: ${databasePath}`);
    console.log(`Uploads: ${uploadDirectory}`);
    console.log("Métricas: MODO MANUAL");
    console.log("");
    console.log("Servidor online.");
    console.log("");
});


setInterval(() => {
    try {
        purgeExpiredTrash();
    } catch (error) {
        console.error("Limpeza automática da lixeira:", error.message);
    }
}, 60 * 60 * 1000);

setInterval(() => {
    try {
        purgeExpiredCreativeFiles();
    } catch (error) {
        console.error(
            "Limpeza automática da Central Criativa:",
            error.message
        );
    }
}, 60 * 60 * 1000);
