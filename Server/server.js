const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

let PDFDocument = null;
try {
    PDFDocument = require("pdfkit");
} catch {
    PDFDocument = null;
}

const app = express();
const PORT = Number(process.env.PORT || 3001);
// Bloqueia a publicacao enquanto SQLite e uploads locais estiverem ativos.
if (process.env.RENDER === "true" || process.env.NODE_ENV === "production") {
    throw new Error("Migracao cloud incompleta: backend SQLite local nao autorizado para producao.");
}
const ADMIN_PASSWORD = process.env.PLANNER_ADMIN_PASSWORD || "";

const WEATHER_LOCATION = {
    city: "Joinville",
    latitude: -26.3044,
    longitude: -48.8487,
    timezone: "America/Sao_Paulo",
};
const WEATHER_CACHE_KEY = "joinville_week_weather_v2";
const WEATHER_CACHE_MS = 60 * 60 * 1000;
const ACHIEVEMENT_CATALOG_VERSION = "2026-elite-v4-design";

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
        access_role TEXT NOT NULL DEFAULT 'colaborador',
        department TEXT DEFAULT '',
        brands TEXT NOT NULL DEFAULT '[]',
        photo_filename TEXT DEFAULT '',
        password_hash TEXT DEFAULT '',
        password_salt TEXT DEFAULT '',
        password_updated_at TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS manager_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requester_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        brand TEXT DEFAULT '',
        request_type TEXT DEFAULT '',
        desired_date TEXT DEFAULT '',
        final_deadline TEXT DEFAULT '',
        final_deadline_set_at TEXT DEFAULT '',
        priority TEXT DEFAULT 'Normal',
        objective TEXT DEFAULT '',
        target_audience TEXT DEFAULT '',
        required_info TEXT DEFAULT '',
        channels TEXT DEFAULT '[]',
        print_dimensions TEXT DEFAULT '',
        description TEXT DEFAULT '',
        references_text TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Recebido',
        manager_response TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS manager_request_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL,
        original_name TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL DEFAULT '',
        file_size INTEGER NOT NULL DEFAULT 0,
        uploaded_by_user_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES manager_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    )
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_manager_request_files_request
    ON manager_request_files(request_id, id)
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS manager_request_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES manager_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_manager_requests_requester
    ON manager_requests(requester_id, created_at DESC)
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_manager_requests_status
    ON manager_requests(status, created_at DESC)
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_hash TEXT NOT NULL UNIQUE,
        session_type TEXT NOT NULL DEFAULT 'user',
        user_id INTEGER,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_token
    ON auth_sessions(token_hash)
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        target_user_id INTEGER,
        target_user_name TEXT NOT NULL DEFAULT '',
        detail TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
    ON admin_audit_log(created_at DESC)
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
        approval_required INTEGER NOT NULL DEFAULT 1,
        approval_bypassed_at TEXT DEFAULT '',
        approval_bypassed_by_user_id INTEGER,
        approval_stage TEXT NOT NULL DEFAULT 'none',
        idea_approval_status TEXT NOT NULL DEFAULT 'nao_enviada',
        idea_manager_note TEXT DEFAULT '',
        idea_approved_at TEXT DEFAULT '',
        idea_approved_by_manager_id INTEGER,
        approval_status TEXT NOT NULL DEFAULT 'nao_enviada',
        manager_note TEXT DEFAULT '',
        approved_at TEXT DEFAULT '',
        approved_by_manager_id INTEGER,
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
    CREATE TABLE IF NOT EXISTS manager_approval_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        manager_user_id INTEGER,
        category TEXT NOT NULL,
        event_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        collaborator_user_id INTEGER,
        collaborator_name TEXT NOT NULL DEFAULT '',
        brands TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_manager_approval_events_date
    ON manager_approval_events(created_at)
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_manager_approval_events_entity
    ON manager_approval_events(entity_type, entity_id)
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        event_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        manager_user_id INTEGER,
        read_at TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE SET NULL
    )
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications(user_id, created_at DESC)
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_notifications_entity
    ON notifications(user_id, entity_type, entity_id)
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created
    ON chat_messages(created_at DESC, id DESC)
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS chat_reads (
        user_id INTEGER PRIMARY KEY,
        last_read_message_id INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS scheduled_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        summary_type TEXT NOT NULL,
        period_key TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, summary_type, period_key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS performance_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        summary_type TEXT NOT NULL,
        period_key TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        role_type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        payload TEXT NOT NULL DEFAULT '{}',
        generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, summary_type, period_key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_performance_summaries_user
    ON performance_summaries(
        user_id,
        summary_type,
        period_key DESC
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS achievement_unlocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        achievement_key TEXT NOT NULL,
        unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, achievement_key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_achievement_unlocks_user
    ON achievement_unlocks(user_id, unlocked_at DESC)
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS achievement_sync_state (
        user_id INTEGER PRIMARY KEY,
        initialized_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
`).run();

ensureColumn(
    "achievement_sync_state",
    "catalog_version",
    "TEXT NOT NULL DEFAULT ''"
);

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
    CREATE TABLE IF NOT EXISTS app_cache (
        cache_key TEXT PRIMARY KEY,
        payload TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
ensureColumn("users", "access_role", "TEXT NOT NULL DEFAULT 'colaborador'");
ensureColumn("users", "department", "TEXT DEFAULT ''");
ensureColumn("users", "brands", "TEXT NOT NULL DEFAULT '[]'");
ensureColumn("users", "photo_filename", "TEXT DEFAULT ''");
ensureColumn("users", "password_hash", "TEXT DEFAULT ''");
ensureColumn("users", "password_salt", "TEXT DEFAULT ''");
ensureColumn("users", "password_updated_at", "TEXT DEFAULT ''");
ensureColumn("users", "created_at", "TEXT");
ensureColumn("users", "updated_at", "TEXT");
ensureColumn("manager_requests", "objective", "TEXT DEFAULT ''");
ensureColumn("manager_requests", "target_audience", "TEXT DEFAULT ''");
ensureColumn("manager_requests", "required_info", "TEXT DEFAULT ''");
ensureColumn("manager_requests", "channels", "TEXT DEFAULT '[]'");
ensureColumn("manager_requests", "print_dimensions", "TEXT DEFAULT ''");
ensureColumn("manager_requests", "final_deadline", "TEXT DEFAULT ''");
ensureColumn("manager_requests", "final_deadline_set_at", "TEXT DEFAULT ''");
ensureColumn("manager_requests", "assigned_user_id", "INTEGER");
ensureColumn("manager_requests", "assigned_date", "TEXT DEFAULT ''");
ensureColumn("manager_requests", "assigned_urgency", "TEXT DEFAULT ''");
ensureColumn("manager_requests", "assigned_content_id", "INTEGER");
ensureColumn("manager_requests", "assigned_at", "TEXT DEFAULT ''");
ensureColumn("manager_requests", "deleted_at", "TEXT DEFAULT ''");
ensureColumn("manager_requests", "deleted_previous_status", "TEXT DEFAULT ''");
ensureColumn("manager_requests", "deleted_content_previous_status", "TEXT DEFAULT ''");

ensureColumn("contents", "reference_link", "TEXT DEFAULT ''");
ensureColumn("contents", "description", "TEXT DEFAULT ''");
ensureColumn("contents", "copy_text", "TEXT DEFAULT ''");
ensureColumn("contents", "approval_required", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("contents", "approval_bypassed_at", "TEXT DEFAULT ''");
ensureColumn("contents", "approval_bypassed_by_user_id", "INTEGER");
ensureColumn("contents", "approval_stage", "TEXT NOT NULL DEFAULT 'none'");
ensureColumn("contents", "idea_approval_status", "TEXT NOT NULL DEFAULT 'nao_enviada'");
ensureColumn("contents", "idea_manager_note", "TEXT DEFAULT ''");
ensureColumn("contents", "idea_approved_at", "TEXT DEFAULT ''");
ensureColumn("contents", "idea_approved_by_manager_id", "INTEGER");
ensureColumn("contents", "approval_status", "TEXT NOT NULL DEFAULT 'nao_enviada'");
ensureColumn("contents", "manager_note", "TEXT DEFAULT ''");
ensureColumn("contents", "approved_at", "TEXT DEFAULT ''");
ensureColumn("contents", "approved_by_manager_id", "INTEGER");
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
ensureColumn("files", "source_type", "TEXT DEFAULT ''");
ensureColumn("files", "source_id", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("contents", "deleted_at", "TEXT DEFAULT ''");
ensureColumn("contents", "video_files_purged_at", "TEXT DEFAULT ''");

ensureColumn("creative_jobs", "recipient_finished_at", "TEXT DEFAULT ''");
ensureColumn("creative_jobs", "files_purged_at", "TEXT DEFAULT ''");
ensureColumn("creative_jobs", "approval_required", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("creative_jobs", "manager_request_id", "INTEGER");

/*
 * Histórico inicial para conteúdos aprovados antes desta atualização.
 * Usa updated_at como referência aproximada quando approved_at ainda não existia.
 */
db.prepare(`
    UPDATE contents
    SET approved_at = COALESCE(NULLIF(TRIM(updated_at), ''), CURRENT_TIMESTAMP)
    WHERE approval_status = 'aprovado'
      AND TRIM(COALESCE(approved_at, '')) = ''
`).run();

/*
 * Conversão do fluxo antigo:
 * - só o antigo "Aguardando aprovação" vira aprovação FINAL pendente;
 * - outros registros pendentes deixam de aparecer automaticamente ao gerente.
 */
db.prepare(`
    UPDATE contents
    SET approval_stage = 'final',
        status = 'Aguardando aprovação final'
    WHERE approval_status = 'pendente'
      AND status = 'Aguardando aprovação'
      AND COALESCE(approval_stage, 'none') = 'none'
`).run();

db.prepare(`
    UPDATE contents
    SET approval_status = 'nao_enviada'
    WHERE approval_status = 'pendente'
      AND COALESCE(approval_stage, 'none') = 'none'
      AND status <> 'Aguardando aprovação final'
`).run();

db.prepare(`
    UPDATE contents
    SET status = 'Aprovado',
        approval_stage = 'none'
    WHERE approval_status = 'aprovado'
      AND COALESCE(is_live, 0) = 0
      AND status = 'Aguardando aprovação'
`).run();

db.prepare(`
    UPDATE contents
    SET status = 'Ajuste solicitado',
        approval_stage = 'none'
    WHERE approval_status = 'alteracao'
      AND COALESCE(is_live, 0) = 0
      AND status = 'Aguardando aprovação'
`).run();


/*
 * Conteúdos antigos que já estavam além da fase de Ideia são considerados
 * como ideia já confirmada, para preservar o andamento existente.
 */
db.prepare(`
    UPDATE contents
    SET idea_approval_status = 'aprovado',
        idea_approved_at = COALESCE(NULLIF(TRIM(updated_at), ''), CURRENT_TIMESTAMP)
    WHERE COALESCE(idea_approval_status, 'nao_enviada') = 'nao_enviada'
      AND status IN (
          'Planejado',
          'Em produção',
          'Em edição',
          'Aguardando aprovação final',
          'Ajuste solicitado',
          'Aprovado',
          'Agendado',
          'Publicado'
      )
`).run();

/* Perfil chamado Gerente passa automaticamente a usar o painel gerencial. */
db.prepare(`
    UPDATE users
    SET access_role = 'gerente'
    WHERE lower(trim(name)) = 'gerente'
      AND access_role <> 'gerente'
`).run();

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

function isStoriesFormat(value) {
    const normalized = String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    return ["stories", "story", "storys"].includes(normalized);
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

function purgeExpiredContentVideos() {
    /*
     * Vídeos de Social Media são arquivos pesados.
     * Eles permanecem disponíveis por 30 dias APÓS a publicação ser marcada NO AR.
     *
     * Importante:
     * - se o conteúdo ainda não foi publicado, o vídeo NÃO expira;
     * - imagens e PDFs NÃO são removidos por esta rotina;
     * - conteúdo, copy, métricas e histórico permanecem no banco.
     */
    const expiredContents = db
        .prepare(`
            SELECT DISTINCT c.id
            FROM contents c
            INNER JOIN files f ON f.content_id = c.id
            WHERE TRIM(COALESCE(c.published_at, '')) <> ''
              AND datetime(c.published_at) <= datetime('now', '-30 days')
              AND TRIM(COALESCE(c.video_files_purged_at, '')) = ''
              AND (
                    lower(COALESCE(f.mime_type, '')) LIKE 'video/%'
                    OR lower(COALESCE(f.original_name, '')) LIKE '%.mp4'
                    OR lower(COALESCE(f.original_name, '')) LIKE '%.mov'
                    OR lower(COALESCE(f.original_name, '')) LIKE '%.webm'
                  )
        `)
        .all();

    if (!expiredContents.length) return 0;

    const selectVideos = db.prepare(`
        SELECT id, filename
        FROM files
        WHERE content_id = ?
          AND (
                lower(COALESCE(mime_type, '')) LIKE 'video/%'
                OR lower(COALESCE(original_name, '')) LIKE '%.mp4'
                OR lower(COALESCE(original_name, '')) LIKE '%.mov'
                OR lower(COALESCE(original_name, '')) LIKE '%.webm'
              )
    `);

    const deleteVideo = db.prepare(`
        DELETE FROM files
        WHERE id = ?
    `);

    const markPurged = db.prepare(`
        UPDATE contents
        SET video_files_purged_at = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);

    const nowIso = new Date().toISOString();
    let removedVideos = 0;

    const transaction = db.transaction((contents) => {
        for (const content of contents) {
            const videos = selectVideos.all(content.id);

            videos.forEach((file) => {
                deleteVideo.run(file.id);
                removeContentPhysicalFile(file.filename);
                removedVideos += 1;
            });

            if (videos.length) {
                markPurged.run(nowIso, content.id);
            }
        }
    });

    transaction(expiredContents);
    return removedVideos;
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

function downloadOriginalFile(res, filePath, originalName) {
    const safeOriginalName =
        String(originalName || "arquivo")
            .replace(/[\r\n]/g, "")
            .trim() || "arquivo";

    /*
     * O arquivo físico pode ter nome interno/UUID, mas o cliente
     * nunca recebe esse nome. O Content-Disposition usa sempre
     * o nome original registrado no upload.
     */
    return res.download(
        filePath,
        safeOriginalName,
        {
            headers: {
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "private, no-store",
            },
        },
        (error) => {
            if (error && !res.headersSent) {
                console.error("Erro no download:", error);
                res.status(500).json({
                    error: "Erro ao baixar o arquivo.",
                });
            }
        }
    );
}

function serializeUser(row) {
    if (!row) return null;

    return {
        id: row.id,
        name: row.name,
        active: row.active,
        nickname: row.nickname || "",
        role: row.role || "",
        access_role: row.access_role || "colaborador",
        department: row.department || "",
        brands: parseJsonArray(row.brands),
        photo_url: row.photo_filename ? `/uploads/profiles/${row.photo_filename}` : "",
        password_set: Boolean(String(row.password_hash || "").trim()),
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

function isManagerUserId(id) {
    const user = getActiveUserRowById(id);
    return Boolean(
        user && String(user.access_role || "colaborador").toLowerCase() === "gerente"
    );
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

function managerRequestBriefingText(requestRow, finalDeadline = "") {
    const channels = parseJsonArray(requestRow?.channels);
    const officialDeadline =
        String(finalDeadline || requestRow?.final_deadline || "").trim();

    const parts = [
        `PEDIDO DE GERENTE #${String(requestRow?.id || "").padStart(4, "0")}`,
        requestRow?.objective
            ? `OBJETIVO:\n${requestRow.objective}`
            : "",
        requestRow?.target_audience
            ? `PÚBLICO-ALVO:\n${requestRow.target_audience}`
            : "",
        requestRow?.required_info
            ? `INFORMAÇÕES OBRIGATÓRIAS:\n${requestRow.required_info}`
            : "",
        channels.length
            ? `CANAIS DE DIVULGAÇÃO:\n${channels.join(", ")}`
            : "",
        requestRow?.print_dimensions
            ? `MEDIDAS DO MATERIAL IMPRESSO:\n${requestRow.print_dimensions}`
            : "",
        requestRow?.description
            ? `DETALHES / CONTEXTO:\n${requestRow.description}`
            : "",
        officialDeadline
            ? `PRAZO OFICIAL DE ENTREGA:\n${officialDeadline
                  .split("-")
                  .reverse()
                  .join("/")}`
            : "",
        requestRow?.references_text
            ? `REFERÊNCIAS / LINKS:\n${requestRow.references_text}`
            : "",
    ];

    return parts.filter(Boolean).join("\n\n");
}

function getManagerRequestRowWithPeople(requestId) {
    return db
        .prepare(`
            SELECT r.*,
                   requester.name requester_name,
                   requester.nickname requester_nickname,
                   requester.role requester_role,
                   requester.department requester_department,
                   assigned.name assigned_user_name,
                   assigned.nickname assigned_user_nickname,
                   assigned.role assigned_user_role
            FROM manager_requests r
            LEFT JOIN users requester ON requester.id = r.requester_id
            LEFT JOIN users assigned ON assigned.id = r.assigned_user_id
            WHERE r.id = ?
        `)
        .get(Number(requestId));
}

function getCreativeManagerRequest(jobRow) {
    if (!jobRow) return null;

    let requestRow = null;

    if (Number(jobRow.manager_request_id || 0)) {
        requestRow = getManagerRequestRowWithPeople(
            jobRow.manager_request_id
        );
    }

    if (!requestRow && Number(jobRow.linked_content_id || 0)) {
        const found = db
            .prepare(`
                SELECT id
                FROM manager_requests
                WHERE assigned_content_id = ?
                  AND TRIM(COALESCE(deleted_at, '')) = ''
                ORDER BY id DESC
                LIMIT 1
            `)
            .get(Number(jobRow.linked_content_id));

        if (found?.id) {
            requestRow = getManagerRequestRowWithPeople(found.id);
        }
    }

    return requestRow
        ? serializeManagerRequest(requestRow)
        : null;
}

function ensureCreativeJobForManagerRequest(
    requestRow,
    assignedUser,
    contentId,
    finalDeadline
) {
    if (!requestRow || !assignedUser || !contentId) {
        return null;
    }

    const normalizedRole = String(assignedUser.role || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    if (!normalizedRole.includes("design")) {
        return null;
    }

    const requestId = Number(requestRow.id);
    const creatorId = Number(assignedUser.id);
    const recipientId = Number(requestRow.requester_id || 0);

    const requester = recipientId
        ? getUserById(recipientId)
        : null;

    if (!requester) {
        return null;
    }

    let existing = db
        .prepare(`
            SELECT *
            FROM creative_jobs
            WHERE manager_request_id = ?
            ORDER BY id DESC
            LIMIT 1
        `)
        .get(requestId);

    if (!existing) {
        existing = db
            .prepare(`
                SELECT *
                FROM creative_jobs
                WHERE linked_content_id = ?
                  AND creator_user_id = ?
                ORDER BY id DESC
                LIMIT 1
            `)
            .get(Number(contentId), creatorId);
    }

    const title = String(
        requestRow.title || "Pedido de gestor"
    ).trim();

    const brand = String(
        requestRow.brand || "Grupo / Geral"
    ).trim();

    const creativeType = String(
        requestRow.request_type || "Arte / Material gráfico"
    ).trim();

    const deadline = String(
        finalDeadline ||
            requestRow.final_deadline ||
            requestRow.assigned_date ||
            ""
    ).trim();

    const briefing = managerRequestBriefingText(
        requestRow,
        deadline
    );

    if (existing) {
        if (
            ["em_producao", "ajuste"].includes(
                String(existing.status || "")
            )
        ) {
            db.prepare(`
                UPDATE creative_jobs
                SET creator_user_id = ?,
                    recipient_user_id = ?,
                    creator_name = ?,
                    recipient_name = ?,
                    title = ?,
                    brand = ?,
                    creative_type = ?,
                    deadline = ?,
                    briefing = ?,
                    linked_content_id = ?,
                    manager_request_id = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                creatorId,
                recipientId,
                assignedUser.nickname || assignedUser.name,
                requester.nickname || requester.name,
                title,
                brand,
                creativeType,
                deadline,
                briefing,
                Number(contentId),
                requestId,
                existing.id
            );
        } else {
            db.prepare(`
                UPDATE creative_jobs
                SET manager_request_id = ?,
                    linked_content_id = CASE
                        WHEN linked_content_id IS NULL
                          OR linked_content_id = 0
                        THEN ?
                        ELSE linked_content_id
                    END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                requestId,
                Number(contentId),
                existing.id
            );
        }

        return getCreativeJob(existing.id);
    }

    const result = db.prepare(`
        INSERT INTO creative_jobs (
            creator_user_id,
            recipient_user_id,
            creator_name,
            recipient_name,
            title,
            brand,
            creative_type,
            quantity,
            deadline,
            briefing,
            approval_required,
            status,
            linked_content_id,
            manager_request_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1, 'em_producao', ?, ?)
    `).run(
        creatorId,
        recipientId,
        assignedUser.nickname || assignedUser.name,
        requester.nickname || requester.name,
        title,
        brand,
        creativeType,
        deadline,
        briefing,
        Number(contentId),
        requestId
    );

    return getCreativeJob(result.lastInsertRowid);
}

function backfillDesignerManagerRequestJobs() {
    const rows = db
        .prepare(`
            SELECT r.*,
                   u.name assigned_user_name,
                   u.nickname assigned_user_nickname,
                   u.role assigned_user_role
            FROM manager_requests r
            JOIN users u ON u.id = r.assigned_user_id
            WHERE r.status = 'Em andamento'
              AND r.assigned_content_id IS NOT NULL
              AND TRIM(COALESCE(r.deleted_at, '')) = ''
        `)
        .all();

    let linked = 0;

    for (const row of rows) {
        const normalizedRole = String(
            row.assigned_user_role || ""
        )
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();

        if (!normalizedRole.includes("design")) {
            continue;
        }

        const before = db
            .prepare(`
                SELECT id, manager_request_id
                FROM creative_jobs
                WHERE manager_request_id = ?
                   OR (
                        linked_content_id = ?
                        AND creator_user_id = ?
                   )
                ORDER BY id DESC
                LIMIT 1
            `)
            .get(
                Number(row.id),
                Number(row.assigned_content_id),
                Number(row.assigned_user_id)
            );

        ensureCreativeJobForManagerRequest(
            row,
            {
                id: row.assigned_user_id,
                name: row.assigned_user_name,
                nickname: row.assigned_user_nickname,
                role: row.assigned_user_role,
            },
            row.assigned_content_id,
            row.final_deadline
        );

        const after = db
            .prepare(`
                SELECT id, manager_request_id
                FROM creative_jobs
                WHERE manager_request_id = ?
                   OR (
                        linked_content_id = ?
                        AND creator_user_id = ?
                   )
                ORDER BY id DESC
                LIMIT 1
            `)
            .get(
                Number(row.id),
                Number(row.assigned_content_id),
                Number(row.assigned_user_id)
            );

        if (
            after &&
            (
                !before ||
                Number(before.manager_request_id || 0) !==
                    Number(row.id)
            )
        ) {
            linked += 1;
        }
    }

    return linked;
}

function copyManagerRequestReferencesToContent(requestId, contentId) {
    const references = db
        .prepare(`
            SELECT id, original_name, filename, mime_type, file_size
            FROM manager_request_files
            WHERE request_id = ?
            ORDER BY id
        `)
        .all(Number(requestId));

    if (!references.length) return 0;

    let copied = 0;

    for (const reference of references) {
        const alreadyLinked = db
            .prepare(`
                SELECT id
                FROM files
                WHERE content_id = ?
                  AND source_type = 'manager_request'
                  AND source_id = ?
                LIMIT 1
            `)
            .get(Number(contentId), Number(reference.id));

        if (alreadyLinked) continue;

        const sourcePath = path.join(uploadDirectory, reference.filename);
        if (!fs.existsSync(sourcePath)) continue;

        const extension =
            path.extname(reference.original_name || reference.filename) ||
            path.extname(reference.filename) ||
            "";
        const random = Math.random().toString(36).substring(2, 10);
        const copiedFilename =
            `${Date.now()}-gestor-ref-${reference.id}-${random}${extension.toLowerCase()}`;
        const destinationPath = path.join(uploadDirectory, copiedFilename);

        fs.copyFileSync(sourcePath, destinationPath);

        db.prepare(`
            INSERT INTO files (
                content_id, original_name, filename, mime_type,
                file_size, source_type, source_id
            )
            VALUES (?, ?, ?, ?, ?, 'manager_request', ?)
        `).run(
            Number(contentId),
            reference.original_name,
            copiedFilename,
            reference.mime_type,
            Number(reference.file_size || 0),
            Number(reference.id)
        );

        copied += 1;
    }

    return copied;
}

function getFiles(contentId) {
    return db
        .prepare(`
            SELECT id, content_id, original_name, filename, mime_type, file_size,
                   source_type, source_id, created_at
            FROM files
            WHERE content_id = ?
            ORDER BY id
        `)
        .all(contentId)
        .map((file) => ({
            ...file,
            url: `/uploads/${file.filename}`,
            download_url: `/api/files/${file.id}/download`,
        }));
}

function logManagerApprovalEvent({
    managerUserId = null,
    category,
    eventType,
    entityType,
    entityId,
    title = "",
    collaboratorUserId = null,
    collaboratorName = "",
    brands = [],
}) {
    db.prepare(`
        INSERT INTO manager_approval_events (
            manager_user_id,
            category,
            event_type,
            entity_type,
            entity_id,
            title,
            collaborator_user_id,
            collaborator_name,
            brands,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        managerUserId ? Number(managerUserId) : null,
        category,
        eventType,
        entityType,
        Number(entityId),
        title,
        collaboratorUserId ? Number(collaboratorUserId) : null,
        collaboratorName || "",
        JSON.stringify(Array.isArray(brands) ? brands : [brands].filter(Boolean)),
        new Date().toISOString()
    );
}

function serializeChatMessage(row) {
    if (!row) return null;

    return {
        id: row.id,
        message: row.message,
        created_at: row.created_at,
        sender: getUserById(row.sender_user_id),
    };
}

function getChatUnreadCount(userId) {
    const latest =
        db.prepare(`
            SELECT COALESCE(MAX(id), 0) AS id
            FROM chat_messages
        `).get()?.id || 0;

    const lastRead =
        db.prepare(`
            SELECT last_read_message_id
            FROM chat_reads
            WHERE user_id = ?
        `).get(Number(userId))?.last_read_message_id || 0;

    if (Number(latest) <= Number(lastRead)) return 0;

    return Number(
        db.prepare(`
            SELECT COUNT(*) AS total
            FROM chat_messages
            WHERE id > ?
              AND sender_user_id <> ?
        `).get(Number(lastRead), Number(userId))?.total || 0
    );
}

function markChatRead(userId) {
    const latest =
        db.prepare(`
            SELECT COALESCE(MAX(id), 0) AS id
            FROM chat_messages
        `).get()?.id || 0;

    db.prepare(`
        INSERT INTO chat_reads (
            user_id,
            last_read_message_id,
            updated_at
        )
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            last_read_message_id = excluded.last_read_message_id,
            updated_at = CURRENT_TIMESTAMP
    `).run(Number(userId), Number(latest));

    return Number(latest);
}

function localNowParts() {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(new Date());

    const map = {};

    parts.forEach((part) => {
        if (part.type !== "literal") {
            map[part.type] = Number(part.value);
        }
    });

    const dateKey = `${map.year}-${String(map.month).padStart(
        2,
        "0"
    )}-${String(map.day).padStart(2, "0")}`;

    const fakeUtc = new Date(
        Date.UTC(map.year, map.month - 1, map.day)
    );

    return {
        ...map,
        date_key: dateKey,
        weekday: fakeUtc.getUTCDay(),
    };
}

function dateKeyShift(dateKey, amount) {
    const [year, month, day] = String(dateKey)
        .split("-")
        .map(Number);

    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + Number(amount));

    return `${date.getUTCFullYear()}-${String(
        date.getUTCMonth() + 1
    ).padStart(2, "0")}-${String(date.getUTCDate()).padStart(
        2,
        "0"
    )}`;
}

function dateKeyMonth(dateKey) {
    return String(dateKey || "").slice(0, 7);
}

function isoLocalDateKey(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value).slice(0, 10);
    }

    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    const map = {};
    parts.forEach((part) => {
        if (part.type !== "literal") map[part.type] = part.value;
    });

    return `${map.year}-${map.month}-${map.day}`;
}

function formatSummaryNumber(value) {
    return new Intl.NumberFormat("pt-BR").format(
        Number(value || 0)
    );
}

function summaryUserType(user) {
    const role = String(user?.role || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    return role.includes("design") ? "design" : "social";
}

function contentSummaryForPeriod(userId, startKey, endKey) {
    const items = db
        .prepare(`
            SELECT *
            FROM contents
            WHERE user_id = ?
              AND COALESCE(is_live, 0) = 1
              AND TRIM(COALESCE(published_at, '')) <> ''
              AND TRIM(COALESCE(deleted_at, '')) = ''
        `)
        .all(Number(userId))
        .filter((item) => {
            const key = isoLocalDateKey(item.published_at);
            return key >= startKey && key <= endKey;
        });

    const metricItems = items.filter(
        (item) => !isStoriesFormat(item.format)
    );

    const bestContent =
        metricItems
            .slice()
            .sort(
                (a, b) =>
                    normalizeInteger(b.metric_views) -
                        normalizeInteger(a.metric_views) ||
                    Number(b.id) - Number(a.id)
            )[0] || null;

    return {
        contents: items.length,
        stories: items.filter((item) =>
            isStoriesFormat(item.format)
        ).length,
        views: metricItems.reduce(
            (total, item) =>
                total + normalizeInteger(item.metric_views),
            0
        ),
        likes: metricItems.reduce(
            (total, item) =>
                total + normalizeInteger(item.metric_likes),
            0
        ),
        shares: metricItems.reduce(
            (total, item) =>
                total + normalizeInteger(item.metric_shares),
            0
        ),
        best_content: bestContent
            ? {
                  id: Number(bestContent.id),
                  title: bestContent.title || "Conteúdo",
                  views: normalizeInteger(
                      bestContent.metric_views
                  ),
              }
            : null,
    };
}

function designSummaryForPeriod(userId, startKey, endKey) {
    const jobs = db
        .prepare(`
            SELECT *
            FROM creative_jobs
            WHERE creator_user_id = ?
              AND TRIM(COALESCE(approved_at, '')) <> ''
        `)
        .all(Number(userId))
        .filter((item) => {
            const key = isoLocalDateKey(item.approved_at);
            return key >= startKey && key <= endKey;
        });

    const brands = new Set(
        jobs
            .map((item) => String(item.brand || "").trim())
            .filter(Boolean)
    );

    const biggestJob =
        jobs
            .slice()
            .sort(
                (a, b) =>
                    Number(b.quantity || 1) -
                        Number(a.quantity || 1) ||
                    Number(b.id) - Number(a.id)
            )[0] || null;

    return {
        demands: jobs.length,
        pieces: jobs.reduce(
            (total, item) =>
                total + Math.max(1, Number(item.quantity || 1)),
            0
        ),
        brands: brands.size,
        biggest_demand: biggestJob
            ? {
                  id: Number(biggestJob.id),
                  title: biggestJob.title || "Demanda",
                  pieces: Math.max(
                      1,
                      Number(biggestJob.quantity || 1)
                  ),
              }
            : null,
    };
}

function performanceSummaryExists(userId, type, periodKey) {
    return Boolean(
        db.prepare(`
            SELECT id
            FROM performance_summaries
            WHERE user_id = ?
              AND summary_type = ?
              AND period_key = ?
        `).get(
            Number(userId),
            String(type),
            String(periodKey)
        )
    );
}

function serializePerformanceSummary(row) {
    if (!row) return null;

    let payload = {};

    try {
        payload = JSON.parse(row.payload || "{}");
    } catch {
        payload = {};
    }

    return {
        id: Number(row.id),
        user_id: Number(row.user_id),
        summary_type: row.summary_type,
        period_key: row.period_key,
        start_date: row.start_date,
        end_date: row.end_date,
        role_type: row.role_type,
        title: row.title,
        message: row.message,
        note: row.note,
        payload,
        generated_at: row.generated_at,
    };
}

function getPerformanceSummaries(userId, limitPerType = 12) {
    const limit = Math.max(
        1,
        Math.min(36, Number(limitPerType || 12))
    );

    const weekly = db
        .prepare(`
            SELECT *
            FROM performance_summaries
            WHERE user_id = ?
              AND summary_type = 'weekly'
            ORDER BY period_key DESC, id DESC
            LIMIT ?
        `)
        .all(Number(userId), limit)
        .map(serializePerformanceSummary);

    const monthly = db
        .prepare(`
            SELECT *
            FROM performance_summaries
            WHERE user_id = ?
              AND summary_type = 'monthly'
            ORDER BY period_key DESC, id DESC
            LIMIT ?
        `)
        .all(Number(userId), limit)
        .map(serializePerformanceSummary);

    return {
        weekly,
        monthly,
    };
}

function monthNamePt(monthNumber) {
    const names = [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
    ];

    return names[Math.max(1, Math.min(12, monthNumber)) - 1];
}

function periodLabelPt(startKey, endKey, type) {
    if (type === "monthly") {
        const [year, month] = String(startKey)
            .split("-")
            .map(Number);

        return `${monthNamePt(month)} ${year}`;
    }

    const [, startMonth, startDay] = String(startKey)
        .split("-")
        .map(Number);
    const [, endMonth, endDay] = String(endKey)
        .split("-")
        .map(Number);

    if (startMonth === endMonth) {
        return `${startDay} a ${endDay} de ${monthNamePt(
            endMonth
        ).toLowerCase()}`;
    }

    return `${startDay}/${String(startMonth).padStart(
        2,
        "0"
    )} a ${endDay}/${String(endMonth).padStart(2, "0")}`;
}

function unlockedAchievementsForPeriod(userId, startKey, endKey) {
    return db
        .prepare(`
            SELECT achievement_key, unlocked_at
            FROM achievement_unlocks
            WHERE user_id = ?
              AND TRIM(COALESCE(unlocked_at, '')) <> ''
        `)
        .all(Number(userId))
        .filter((item) => {
            const key = isoLocalDateKey(item.unlocked_at);
            return key >= startKey && key <= endKey;
        });
}

function previousPeriodForComparison(summaryType, startKey, endKey) {
    if (summaryType === "weekly") {
        return {
            start_key: dateKeyShift(startKey, -7),
            end_key: dateKeyShift(endKey, -7),
        };
    }

    const currentMonthStart = `${String(startKey).slice(
        0,
        7
    )}-01`;

    const previousMonthEnd = dateKeyShift(
        currentMonthStart,
        -1
    );

    const previousMonthKey = String(
        previousMonthEnd
    ).slice(0, 7);

    return {
        start_key: `${previousMonthKey}-01`,
        end_key: previousMonthEnd,
    };
}

function nextAchievementSnapshot(user) {
    try {
        const personal =
            decoratePersonalAchievements(user);

        const next = personal?.summary?.next;

        if (!next) return null;

        return {
            key: next.key,
            title: next.title,
            icon: next.icon,
            percent: Number(next.percent || 0),
            remaining: Number(next.remaining || 0),
            unit: next.unit || "",
        };
    } catch (error) {
        console.error(
            "Próxima conquista no resumo:",
            error.message
        );
        return null;
    }
}

function buildRecognitionText({
    roleType,
    summaryType,
    current,
    previous,
    achievementsUnlocked,
    nextAchievement,
}) {
    const lines = [];

    if (roleType === "design") {
        if (
            current.pieces > 0 &&
            previous.pieces > 0 &&
            current.pieces > previous.pieces
        ) {
            lines.push(
                `Você está acima do período anterior em ${formatSummaryNumber(
                    current.pieces - previous.pieces
                )} peça(s).`
            );
        } else if (current.pieces > 0) {
            lines.push(
                summaryType === "weekly"
                    ? "Bom ritmo de produção para a primeira metade da semana."
                    : "Mais um mês de produção registrado no seu histórico."
            );
        }

        if (current.biggest_demand?.pieces > 0) {
            lines.push(
                `Sua maior demanda do período teve ${formatSummaryNumber(
                    current.biggest_demand.pieces
                )} peça(s).`
            );
        }
    } else {
        if (
            current.views > 0 &&
            previous.views > 0 &&
            current.views > previous.views
        ) {
            lines.push(
                `Você superou o período anterior em ${formatSummaryNumber(
                    current.views - previous.views
                )} visualizações.`
            );
        } else if (current.contents > 0) {
            lines.push(
                summaryType === "weekly"
                    ? "Bom ritmo até aqui. Ainda há bastante semana pela frente."
                    : "Mais um mês de publicações registrado no seu histórico."
            );
        }

        if (current.best_content?.views > 0) {
            lines.push(
                `Seu conteúdo de maior alcance no período chegou a ${formatSummaryNumber(
                    current.best_content.views
                )} views.`
            );
        }
    }

    if (achievementsUnlocked > 0) {
        lines.push(
            `Você desbloqueou ${formatSummaryNumber(
                achievementsUnlocked
            )} ${
                achievementsUnlocked === 1
                    ? "conquista"
                    : "conquistas"
            } neste período.`
        );
    }

    if (
        nextAchievement &&
        Number(nextAchievement.percent || 0) >= 60 &&
        Number(nextAchievement.remaining || 0) > 0
    ) {
        lines.push(
            `Você já está em ${nextAchievement.percent}% da conquista “${nextAchievement.title}”.`
        );
    }

    if (!lines.length) {
        lines.push(
            "Seu desempenho ficou registrado para acompanhar sua evolução nos próximos períodos."
        );
    }

    return lines.join(" ");
}

function createPerformanceSummary({
    user,
    summaryType,
    periodKey,
    startKey,
    endKey,
}) {
    if (!user || isManagerUserId(user.id)) return null;

    if (
        performanceSummaryExists(
            user.id,
            summaryType,
            periodKey
        )
    ) {
        return null;
    }

    const roleType = summaryUserType(user);
    const userName =
        user.nickname || user.name || "Colaborador";
    const periodLabel = periodLabelPt(
        startKey,
        endKey,
        summaryType
    );

    const previousPeriod = previousPeriodForComparison(
        summaryType,
        startKey,
        endKey
    );

    const achievementsUnlocked =
        unlockedAchievementsForPeriod(
            user.id,
            startKey,
            endKey
        ).length;

    const nextAchievement =
        nextAchievementSnapshot(user);

    let current;
    let previous;
    let title;
    let message;

    if (roleType === "design") {
        current = designSummaryForPeriod(
            user.id,
            startKey,
            endKey
        );

        previous = designSummaryForPeriod(
            user.id,
            previousPeriod.start_key,
            previousPeriod.end_key
        );

        title =
            summaryType === "weekly"
                ? "Seu resumo da semana até agora ✦"
                : `Seu mês em números • ${periodLabel}`;

        if (current.pieces > 0) {
            message =
                summaryType === "weekly"
                    ? `${userName}, você já produziu ${formatSummaryNumber(
                          current.pieces
                      )} peça(s) em ${formatSummaryNumber(
                          current.demands
                      )} demanda(s) aprovadas nesta semana.`
                    : `Parabéns, ${userName}! Você fechou ${periodLabel} com ${formatSummaryNumber(
                          current.pieces
                      )} peça(s) em ${formatSummaryNumber(
                          current.demands
                      )} demanda(s) aprovadas.`;
        } else {
            message =
                summaryType === "weekly"
                    ? `${userName}, seu resumo parcial da semana está pronto. Ainda não houve peças aprovadas de segunda até agora.`
                    : `${userName}, seu resumo de ${periodLabel} está pronto. Não houve peças aprovadas registradas neste mês.`;
        }
    } else {
        current = contentSummaryForPeriod(
            user.id,
            startKey,
            endKey
        );

        previous = contentSummaryForPeriod(
            user.id,
            previousPeriod.start_key,
            previousPeriod.end_key
        );

        title =
            summaryType === "weekly"
                ? "Seu resumo da semana até agora ✦"
                : `Seu mês em números • ${periodLabel}`;

        if (current.contents > 0) {
            message =
                summaryType === "weekly"
                    ? `${userName}, você já colocou ${formatSummaryNumber(
                          current.contents
                      )} conteúdo(s) no ar nesta semana e alcançou ${formatSummaryNumber(
                          current.views
                      )} visualizações.`
                    : `Parabéns, ${userName}! Você fechou ${periodLabel} com ${formatSummaryNumber(
                          current.contents
                      )} conteúdo(s) no ar e ${formatSummaryNumber(
                          current.views
                      )} visualizações.`;
        } else {
            message =
                summaryType === "weekly"
                    ? `${userName}, seu resumo parcial da semana está pronto. Ainda não houve conteúdos marcados como NO AR de segunda até agora.`
                    : `${userName}, seu resumo de ${periodLabel} está pronto. Não houve conteúdos marcados como NO AR neste mês.`;
        }
    }

    const note = buildRecognitionText({
        roleType,
        summaryType,
        current,
        previous,
        achievementsUnlocked,
        nextAchievement,
    });

    const payload = {
        role_type: roleType,
        period_label: periodLabel,
        current,
        previous,
        achievements_unlocked: achievementsUnlocked,
        next_achievement: nextAchievement,
        schedule_label:
            summaryType === "weekly"
                ? "Quarta-feira • 10h"
                : "Último dia do mês • 17h",
    };

    const result = db
        .prepare(`
            INSERT INTO performance_summaries (
                user_id,
                summary_type,
                period_key,
                start_date,
                end_date,
                role_type,
                title,
                message,
                note,
                payload,
                generated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
            Number(user.id),
            summaryType,
            periodKey,
            startKey,
            endKey,
            roleType,
            title,
            message,
            note,
            JSON.stringify(payload),
            new Date().toISOString()
        );

    const summaryId = Number(result.lastInsertRowid);

    createManagerNotification({
        userId: user.id,
        category:
            roleType === "design" ? "design" : "social",
        eventType:
            summaryType === "weekly"
                ? "weekly_summary"
                : "monthly_summary",
        entityType: "summary",
        entityId: summaryId,
        title,
        message,
        note,
    });

    return summaryId;
}

function currentWeekMondayKey(now) {
    const daysSinceMonday =
        (Number(now.weekday) + 6) % 7;

    return dateKeyShift(
        now.date_key,
        -daysSinceMonday
    );
}

function eligibleWeeklyPerformancePeriod() {
    const now = localNowParts();

    /*
     * Segunda = 1, terça = 2, quarta = 3.
     * Antes de quarta às 10h ainda não existe resumo da semana.
     */
    if (Number(now.weekday) === 1 || Number(now.weekday) === 2) {
        return null;
    }

    if (
        Number(now.weekday) === 3 &&
        Number(now.hour) < 10
    ) {
        return null;
    }

    const monday = currentWeekMondayKey(now);
    const wednesday = dateKeyShift(monday, 2);

    return {
        period_key: wednesday,
        start_key: monday,
        end_key: wednesday,
    };
}

function lastDayKeyOfMonth(year, month) {
    const last = new Date(
        Date.UTC(Number(year), Number(month), 0)
    );

    return `${last.getUTCFullYear()}-${String(
        last.getUTCMonth() + 1
    ).padStart(2, "0")}-${String(
        last.getUTCDate()
    ).padStart(2, "0")}`;
}

function previousMonthPerformancePeriod(now) {
    const currentStart = `${now.year}-${String(
        now.month
    ).padStart(2, "0")}-01`;

    const previousEnd = dateKeyShift(
        currentStart,
        -1
    );

    const periodKey = String(previousEnd).slice(
        0,
        7
    );

    return {
        period_key: periodKey,
        start_key: `${periodKey}-01`,
        end_key: previousEnd,
    };
}

function eligibleMonthlyPerformancePeriod() {
    const now = localNowParts();
    const lastDayKey = lastDayKeyOfMonth(
        now.year,
        now.month
    );

    const currentMonthKey = `${now.year}-${String(
        now.month
    ).padStart(2, "0")}`;

    const currentStart = `${currentMonthKey}-01`;

    const isLastDay =
        now.date_key === lastDayKey;

    if (
        isLastDay &&
        Number(now.hour) >= 17
    ) {
        return {
            period_key: currentMonthKey,
            start_key: currentStart,
            end_key: lastDayKey,
        };
    }

    /*
     * Recuperação simples: se o servidor estava desligado no último dia,
     * ele ainda pode fechar o mês anterior nos três primeiros dias.
     * No meio do mês não cria resumo retroativo inesperado.
     */
    if (Number(now.day) <= 3) {
        return previousMonthPerformancePeriod(now);
    }

    return null;
}

function generateScheduledSummaries() {
    const users = db
        .prepare(`
            SELECT *
            FROM users
            WHERE active = 1
              AND lower(
                    trim(
                        COALESCE(
                            access_role,
                            'colaborador'
                        )
                    )
                  ) <> 'gerente'
            ORDER BY id
        `)
        .all()
        .map(serializeUser);

    const weekly =
        eligibleWeeklyPerformancePeriod();
    const monthly =
        eligibleMonthlyPerformancePeriod();

    let created = 0;

    users.forEach((user) => {
        if (
            weekly &&
            createPerformanceSummary({
                user,
                summaryType: "weekly",
                periodKey: weekly.period_key,
                startKey: weekly.start_key,
                endKey: weekly.end_key,
            })
        ) {
            created += 1;
        }

        if (
            monthly &&
            createPerformanceSummary({
                user,
                summaryType: "monthly",
                periodKey: monthly.period_key,
                startKey: monthly.start_key,
                endKey: monthly.end_key,
            })
        ) {
            created += 1;
        }
    });

    return created;
}

function achievementPercent(current, target) {
    const safeTarget = Math.max(1, Number(target || 1));
    const safeCurrent = Math.max(0, Number(current || 0));

    return Math.max(
        0,
        Math.min(
            100,
            Math.floor((safeCurrent / safeTarget) * 100)
        )
    );
}

function achievementItem({
    key,
    section,
    eyebrow,
    title,
    description,
    icon,
    current,
    target,
    unit,
}) {
    const safeCurrent = Math.max(0, Number(current || 0));
    const safeTarget = Math.max(1, Number(target || 1));

    return {
        key,
        section,
        eyebrow,
        title,
        description,
        icon,
        current: safeCurrent,
        target: safeTarget,
        unit,
        percent: achievementPercent(
            safeCurrent,
            safeTarget
        ),
        remaining: Math.max(
            0,
            safeTarget - safeCurrent
        ),
    };
}

function userJourneyDays(user) {
    const created = new Date(user?.created_at || "");
    if (Number.isNaN(created.getTime())) return 0;

    return Math.max(
        0,
        Math.floor(
            (Date.now() - created.getTime()) /
                (24 * 60 * 60 * 1000)
        )
    );
}

function monthKeyFromIso(value) {
    if (!value) return "";

    const dateKey = isoLocalDateKey(value);
    return dateKey ? dateKey.slice(0, 7) : "";
}

function maxMonthlyCount(items, getDate, getValue) {
    const totals = new Map();

    items.forEach((item) => {
        const month = monthKeyFromIso(getDate(item));
        if (!month) return;

        totals.set(
            month,
            Number(totals.get(month) || 0) +
                Number(getValue(item) || 0)
        );
    });

    return Math.max(
        0,
        ...Array.from(totals.values())
    );
}

function socialAchievementStats(userId, user) {
    const liveContents = db
        .prepare(`
            SELECT *
            FROM contents
            WHERE user_id = ?
              AND COALESCE(is_live, 0) = 1
              AND TRIM(COALESCE(deleted_at, '')) = ''
        `)
        .all(Number(userId));

    const metricContents = liveContents.filter(
        (item) => !isStoriesFormat(item.format)
    );

    return {
        publications: liveContents.length,
        views: metricContents.reduce(
            (total, item) =>
                total +
                normalizeInteger(item.metric_views),
            0
        ),
        shares: metricContents.reduce(
            (total, item) =>
                total +
                normalizeInteger(item.metric_shares),
            0
        ),
        best_month_publications: maxMonthlyCount(
            liveContents,
            (item) => item.published_at,
            () => 1
        ),
        journey_days: userJourneyDays(user),
    };
}

function designAchievementStats(userId, user) {
    const jobs = db
        .prepare(`
            SELECT *
            FROM creative_jobs
            WHERE creator_user_id = ?
              AND TRIM(COALESCE(approved_at, '')) <> ''
        `)
        .all(Number(userId));

    const brandTotals = new Map();

    jobs.forEach((item) => {
        const brand = String(item.brand || "").trim();
        if (!brand) return;

        const pieces = Math.max(
            1,
            Number(item.quantity || 1)
        );

        brandTotals.set(
            brand,
            Number(brandTotals.get(brand) || 0) + pieces
        );
    });

    const brandPieceTotals = Array.from(
        brandTotals.values()
    );

    return {
        approved_demands: jobs.length,
        pieces: jobs.reduce(
            (total, item) =>
                total +
                Math.max(1, Number(item.quantity || 1)),
            0
        ),
        best_month_pieces: maxMonthlyCount(
            jobs,
            (item) => item.approved_at,
            (item) =>
                Math.max(1, Number(item.quantity || 1))
        ),
        approved_brands: brandTotals.size,
        biggest_single_demand: Math.max(
            0,
            ...jobs.map((item) =>
                Math.max(1, Number(item.quantity || 1))
            )
        ),
        best_brand_pieces: Math.max(
            0,
            ...brandPieceTotals
        ),
        journey_days: userJourneyDays(user),
    };
}

function socialAchievementDefinitions(stats) {
    return [
        achievementItem({
            key: "social_publications_10_v2",
            section: "publications",
            eyebrow: "PRIMEIRO MARCO",
            title: "Primeiros 10 no ar",
            description:
                "Alcance 10 conteúdos publicados pelo SQUAD.",
            icon: "🚀",
            current: stats.publications,
            target: 10,
            unit: "publicações",
        }),
        achievementItem({
            key: "social_publications_50_v2",
            section: "publications",
            eyebrow: "CONSISTÊNCIA",
            title: "Ritmo 50",
            description:
                "Chegue a 50 conteúdos publicados.",
            icon: "⚡",
            current: stats.publications,
            target: 50,
            unit: "publicações",
        }),
        achievementItem({
            key: "social_publications_150_v2",
            section: "publications",
            eyebrow: "PRESENÇA",
            title: "Marca de 150",
            description:
                "Alcance 150 conteúdos colocados no ar.",
            icon: "📣",
            current: stats.publications,
            target: 150,
            unit: "publicações",
        }),
        achievementItem({
            key: "social_publications_300_v2",
            section: "publications",
            eyebrow: "MARCO ESPECIAL",
            title: "300 no ar",
            description:
                "Alcance 300 conteúdos publicados.",
            icon: "🏆",
            current: stats.publications,
            target: 300,
            unit: "publicações",
        }),
        achievementItem({
            key: "social_publications_600_v2",
            section: "publications",
            eyebrow: "GRANDE VOLUME",
            title: "Máquina de conteúdo",
            description:
                "Alcance 600 conteúdos publicados.",
            icon: "🔥",
            current: stats.publications,
            target: 600,
            unit: "publicações",
        }),
        achievementItem({
            key: "social_publications_1000_v2",
            section: "publications",
            eyebrow: "MARCA HISTÓRICA",
            title: "Lenda do Conteúdo",
            description:
                "Alcance 1.000 conteúdos publicados.",
            icon: "👑",
            current: stats.publications,
            target: 1000,
            unit: "publicações",
        }),
        achievementItem({
            key: "social_views_100000_v2",
            section: "impact",
            eyebrow: "ALCANCE",
            title: "Primeiros 100K",
            description:
                "Some 100 mil visualizações nos seus conteúdos.",
            icon: "👀",
            current: stats.views,
            target: 100000,
            unit: "views",
        }),
        achievementItem({
            key: "social_views_500000_v2",
            section: "impact",
            eyebrow: "ALCANCE",
            title: "Meio milhão",
            description:
                "Some 500 mil visualizações.",
            icon: "✨",
            current: stats.views,
            target: 500000,
            unit: "views",
        }),
        achievementItem({
            key: "social_views_1000000_v2",
            section: "impact",
            eyebrow: "IMPACTO",
            title: "Primeiro Milhão",
            description:
                "Ultrapasse 1 milhão de visualizações acumuladas.",
            icon: "🌟",
            current: stats.views,
            target: 1000000,
            unit: "views",
        }),
        achievementItem({
            key: "social_views_5000000_v2",
            section: "impact",
            eyebrow: "IMPACTO",
            title: "Impacto 5M",
            description:
                "Some 5 milhões de visualizações.",
            icon: "💥",
            current: stats.views,
            target: 5000000,
            unit: "views",
        }),
        achievementItem({
            key: "social_views_10000000_v2",
            section: "impact",
            eyebrow: "IMPACTO MÁXIMO",
            title: "10 Milhões de Views",
            description:
                "Alcance 10 milhões de visualizações acumuladas.",
            icon: "💎",
            current: stats.views,
            target: 10000000,
            unit: "views",
        }),
        achievementItem({
            key: "social_shares_1000_v2",
            section: "impact",
            eyebrow: "ENGAJAMENTO",
            title: "Conteúdo que circula",
            description:
                "Some 1.000 compartilhamentos.",
            icon: "🔁",
            current: stats.shares,
            target: 1000,
            unit: "compartilhamentos",
        }),
        achievementItem({
            key: "social_month_40_v2",
            section: "monthly",
            eyebrow: "MELHOR MÊS",
            title: "Mês acelerado",
            description:
                "Publique 40 conteúdos em um único mês.",
            icon: "📅",
            current: stats.best_month_publications,
            target: 40,
            unit: "publicações",
        }),
        achievementItem({
            key: "journey_90_v2",
            section: "journey",
            eyebrow: "JORNADA",
            title: "90 dias de SQUAD",
            description:
                "Complete 90 dias desde a criação do seu perfil.",
            icon: "🌱",
            current: stats.journey_days,
            target: 90,
            unit: "dias",
        }),
        achievementItem({
            key: "journey_365_v2",
            section: "journey",
            eyebrow: "JORNADA",
            title: "1 ano de SQUAD",
            description:
                "Complete 365 dias de jornada.",
            icon: "⭐",
            current: stats.journey_days,
            target: 365,
            unit: "dias",
        }),
        achievementItem({
            key: "journey_730_v2",
            section: "journey",
            eyebrow: "JORNADA",
            title: "2 anos de SQUAD",
            description:
                "Complete 730 dias de jornada.",
            icon: "🏅",
            current: stats.journey_days,
            target: 730,
            unit: "dias",
        }),
    ];
}

function designAchievementDefinitions(stats) {
    return [
        /* ==================================================
           PRODUÇÃO TOTAL
        ================================================== */
        achievementItem({
            key: "design_pieces_50_v4",
            section: "pieces",
            eyebrow: "PRIMEIRO GRANDE MARCO",
            title: "Primeiras 50",
            description:
                "Alcance 50 peças aprovadas pela gerência.",
            icon: "🎨",
            current: stats.pieces,
            target: 50,
            unit: "peças",
        }),
        achievementItem({
            key: "design_pieces_150_v4",
            section: "pieces",
            eyebrow: "PRODUÇÃO",
            title: "Ritmo 150",
            description:
                "Alcance 150 peças aprovadas.",
            icon: "🖌️",
            current: stats.pieces,
            target: 150,
            unit: "peças",
        }),
        achievementItem({
            key: "design_pieces_300_v4",
            section: "pieces",
            eyebrow: "PRODUÇÃO",
            title: "Biblioteca 300",
            description:
                "Alcance 300 peças aprovadas.",
            icon: "🧩",
            current: stats.pieces,
            target: 300,
            unit: "peças",
        }),
        achievementItem({
            key: "design_pieces_600_v4",
            section: "pieces",
            eyebrow: "CONSISTÊNCIA",
            title: "Marca de 600",
            description:
                "Alcance 600 peças aprovadas.",
            icon: "⚡",
            current: stats.pieces,
            target: 600,
            unit: "peças",
        }),
        achievementItem({
            key: "design_pieces_1200_v4",
            section: "pieces",
            eyebrow: "GRANDE VOLUME",
            title: "1.2K Criativo",
            description:
                "Alcance 1.200 peças aprovadas.",
            icon: "🔥",
            current: stats.pieces,
            target: 1200,
            unit: "peças",
        }),
        achievementItem({
            key: "design_pieces_2500_v4",
            section: "pieces",
            eyebrow: "MARCO ESPECIAL",
            title: "Elite 2.5K",
            description:
                "Alcance 2.500 peças aprovadas.",
            icon: "🏆",
            current: stats.pieces,
            target: 2500,
            unit: "peças",
        }),
        achievementItem({
            key: "design_pieces_5000_v4",
            section: "pieces",
            eyebrow: "MARCA HISTÓRICA",
            title: "5 mil peças",
            description:
                "Alcance 5.000 peças aprovadas.",
            icon: "💎",
            current: stats.pieces,
            target: 5000,
            unit: "peças",
        }),
        achievementItem({
            key: "design_pieces_7500_v4",
            section: "pieces",
            eyebrow: "ALTO NÍVEL",
            title: "7.5K Criativo",
            description:
                "Alcance 7.500 peças aprovadas.",
            icon: "🌟",
            current: stats.pieces,
            target: 7500,
            unit: "peças",
        }),
        achievementItem({
            key: "design_pieces_10000_v4",
            section: "pieces",
            eyebrow: "LENDÁRIO",
            title: "10 mil peças",
            description:
                "Alcance 10.000 peças aprovadas.",
            icon: "👑",
            current: stats.pieces,
            target: 10000,
            unit: "peças",
        }),
        achievementItem({
            key: "design_pieces_20000_v4",
            section: "pieces",
            eyebrow: "MARCO SUPREMO",
            title: "20K Master",
            description:
                "Alcance 20.000 peças aprovadas.",
            icon: "🏅",
            current: stats.pieces,
            target: 20000,
            unit: "peças",
        }),

        /* ==================================================
           DEMANDAS APROVADAS
        ================================================== */
        achievementItem({
            key: "design_demands_200_v4",
            section: "demands",
            eyebrow: "FLUXO",
            title: "200 demandas",
            description:
                "Conclua 200 demandas aprovadas pela gerência.",
            icon: "✅",
            current: stats.approved_demands,
            target: 200,
            unit: "demandas",
        }),
        achievementItem({
            key: "design_demands_500_v4",
            section: "demands",
            eyebrow: "FLUXO",
            title: "500 demandas",
            description:
                "Conclua 500 demandas aprovadas pela gerência.",
            icon: "📦",
            current: stats.approved_demands,
            target: 500,
            unit: "demandas",
        }),
        achievementItem({
            key: "design_demands_1000_v4",
            section: "demands",
            eyebrow: "ALTO VOLUME",
            title: "Mil demandas",
            description:
                "Conclua 1.000 demandas aprovadas pela gerência.",
            icon: "🚀",
            current: stats.approved_demands,
            target: 1000,
            unit: "demandas",
        }),
        achievementItem({
            key: "design_demands_2000_v4",
            section: "demands",
            eyebrow: "MARCA HISTÓRICA",
            title: "2 mil demandas",
            description:
                "Conclua 2.000 demandas aprovadas pela gerência.",
            icon: "🏁",
            current: stats.approved_demands,
            target: 2000,
            unit: "demandas",
        }),

        /* ==================================================
           MELHOR MÊS
        ================================================== */
        achievementItem({
            key: "design_month_150_v4",
            section: "monthly",
            eyebrow: "MELHOR MÊS",
            title: "Mês 150",
            description:
                "Tenha 150 peças aprovadas em um único mês.",
            icon: "📅",
            current: stats.best_month_pieces,
            target: 150,
            unit: "peças",
        }),
        achievementItem({
            key: "design_month_250_v4",
            section: "monthly",
            eyebrow: "MELHOR MÊS",
            title: "Mês 250",
            description:
                "Tenha 250 peças aprovadas em um único mês.",
            icon: "🔥",
            current: stats.best_month_pieces,
            target: 250,
            unit: "peças",
        }),
        achievementItem({
            key: "design_month_400_v4",
            section: "monthly",
            eyebrow: "MÊS EXCEPCIONAL",
            title: "Mês 400",
            description:
                "Tenha 400 peças aprovadas em um único mês.",
            icon: "💥",
            current: stats.best_month_pieces,
            target: 400,
            unit: "peças",
        }),
        achievementItem({
            key: "design_month_600_v4",
            section: "monthly",
            eyebrow: "RECORDE",
            title: "Mês 600",
            description:
                "Tenha 600 peças aprovadas em um único mês.",
            icon: "💫",
            current: stats.best_month_pieces,
            target: 600,
            unit: "peças",
        }),

        /* ==================================================
           DESAFIOS ESPECIAIS
        ================================================== */
        achievementItem({
            key: "design_brands_5_v4",
            section: "special",
            eyebrow: "VERSATILIDADE",
            title: "Multimarcas",
            description:
                "Tenha peças aprovadas para 5 marcas diferentes.",
            icon: "🎯",
            current: stats.approved_brands,
            target: 5,
            unit: "marcas",
        }),
        achievementItem({
            key: "design_brands_7_v4",
            section: "special",
            eyebrow: "VERSATILIDADE",
            title: "Designer 360°",
            description:
                "Tenha peças aprovadas para 7 marcas diferentes.",
            icon: "🌐",
            current: stats.approved_brands,
            target: 7,
            unit: "marcas",
        }),
        achievementItem({
            key: "design_single_demand_25_v4",
            section: "special",
            eyebrow: "MEGA ENTREGA",
            title: "Pacote 25",
            description:
                "Tenha uma única demanda aprovada com 25 peças.",
            icon: "📚",
            current: stats.biggest_single_demand,
            target: 25,
            unit: "peças",
        }),
        achievementItem({
            key: "design_single_demand_50_v4",
            section: "special",
            eyebrow: "MEGA ENTREGA",
            title: "Pacote 50",
            description:
                "Tenha uma única demanda aprovada com 50 peças.",
            icon: "🗂️",
            current: stats.biggest_single_demand,
            target: 50,
            unit: "peças",
        }),
        achievementItem({
            key: "design_single_demand_100_v4",
            section: "special",
            eyebrow: "ENTREGA GIGANTE",
            title: "Pacote 100",
            description:
                "Tenha uma única demanda aprovada com 100 peças.",
            icon: "🚚",
            current: stats.biggest_single_demand,
            target: 100,
            unit: "peças",
        }),
        achievementItem({
            key: "design_brand_1000_v4",
            section: "special",
            eyebrow: "DOMÍNIO DE MARCA",
            title: "Especialista 1K",
            description:
                "Acumule 1.000 peças aprovadas para uma única marca.",
            icon: "🛡️",
            current: stats.best_brand_pieces,
            target: 1000,
            unit: "peças",
        }),
        achievementItem({
            key: "design_brand_2500_v4",
            section: "special",
            eyebrow: "DOMÍNIO DE MARCA",
            title: "Especialista 2.5K",
            description:
                "Acumule 2.500 peças aprovadas para uma única marca.",
            icon: "⚜️",
            current: stats.best_brand_pieces,
            target: 2500,
            unit: "peças",
        }),

        /* ==================================================
           JORNADA
        ================================================== */
        achievementItem({
            key: "journey_180_v4_design",
            section: "journey",
            eyebrow: "JORNADA",
            title: "6 meses de SQUAD",
            description:
                "Complete 180 dias desde a criação do seu perfil.",
            icon: "🌱",
            current: stats.journey_days,
            target: 180,
            unit: "dias",
        }),
        achievementItem({
            key: "journey_730_v4_design",
            section: "journey",
            eyebrow: "JORNADA",
            title: "2 anos de SQUAD",
            description:
                "Complete 730 dias de jornada.",
            icon: "⭐",
            current: stats.journey_days,
            target: 730,
            unit: "dias",
        }),
        achievementItem({
            key: "journey_1460_v4_design",
            section: "journey",
            eyebrow: "JORNADA",
            title: "4 anos de SQUAD",
            description:
                "Complete 1.460 dias de jornada.",
            icon: "🏅",
            current: stats.journey_days,
            target: 1460,
            unit: "dias",
        }),
    ];
}

function personalAchievementDefinitions(user) {
    const roleType = summaryUserType(user);

    if (roleType === "design") {
        return {
            role_type: "design",
            role_label: "Design",
            items: designAchievementDefinitions(
                designAchievementStats(user.id, user)
            ),
        };
    }

    return {
        role_type: "social",
        role_label: "Social Media",
        items: socialAchievementDefinitions(
            socialAchievementStats(user.id, user)
        ),
    };
}

function squadAchievementDefinitions() {
    const liveContents = db
        .prepare(`
            SELECT *
            FROM contents
            WHERE COALESCE(is_live, 0) = 1
              AND TRIM(COALESCE(deleted_at, '')) = ''
        `)
        .all();

    const metricContents = liveContents.filter(
        (item) => !isStoriesFormat(item.format)
    );

    const designJobs = db
        .prepare(`
            SELECT quantity
            FROM creative_jobs
            WHERE TRIM(COALESCE(approved_at, '')) <> ''
        `)
        .all();

    const publications = liveContents.length;
    const views = metricContents.reduce(
        (total, item) =>
            total + normalizeInteger(item.metric_views),
        0
    );
    const pieces = designJobs.reduce(
        (total, item) =>
            total +
            Math.max(1, Number(item.quantity || 1)),
        0
    );

    return [
        achievementItem({
            key: "squad_publications_500_v2",
            section: "squad_publications",
            eyebrow: "TIME",
            title: "SQUAD 500",
            description:
                "O time alcançou 500 conteúdos publicados.",
            icon: "🚀",
            current: publications,
            target: 500,
            unit: "publicações",
        }),
        achievementItem({
            key: "squad_publications_1000_v2",
            section: "squad_publications",
            eyebrow: "TIME",
            title: "SQUAD 1K",
            description:
                "O time alcançou 1.000 conteúdos publicados.",
            icon: "🏁",
            current: publications,
            target: 1000,
            unit: "publicações",
        }),
        achievementItem({
            key: "squad_publications_2500_v2",
            section: "squad_publications",
            eyebrow: "TIME",
            title: "SQUAD 2.5K",
            description:
                "O time alcançou 2.500 conteúdos publicados.",
            icon: "🏆",
            current: publications,
            target: 2500,
            unit: "publicações",
        }),
        achievementItem({
            key: "squad_views_5000000_v2",
            section: "squad_impact",
            eyebrow: "IMPACTO COLETIVO",
            title: "5 milhões de views",
            description:
                "O time somou 5 milhões de visualizações.",
            icon: "🌟",
            current: views,
            target: 5000000,
            unit: "views",
        }),
        achievementItem({
            key: "squad_views_25000000_v2",
            section: "squad_impact",
            eyebrow: "IMPACTO COLETIVO",
            title: "25 milhões de views",
            description:
                "O time somou 25 milhões de visualizações.",
            icon: "💎",
            current: views,
            target: 25000000,
            unit: "views",
        }),
        achievementItem({
            key: "squad_design_1000_v2",
            section: "squad_creative",
            eyebrow: "CENTRAL CRIATIVA",
            title: "1.000 peças criadas",
            description:
                "O Design alcançou 1.000 peças aprovadas.",
            icon: "🎨",
            current: pieces,
            target: 1000,
            unit: "peças",
        }),
        achievementItem({
            key: "squad_design_5000_v2",
            section: "squad_creative",
            eyebrow: "CENTRAL CRIATIVA",
            title: "Central Criativa 5K",
            description:
                "O Design alcançou 5.000 peças aprovadas.",
            icon: "👑",
            current: pieces,
            target: 5000,
            unit: "peças",
        }),
    ];
}

function groupAchievementSections(items, roleType, collective = false) {
    const definitions = collective
        ? [
              {
                  key: "squad_publications",
                  eyebrow: "PUBLICAÇÃO",
                  title: "Presença do time",
                  description:
                      "Marcos coletivos de conteúdos publicados.",
              },
              {
                  key: "squad_impact",
                  eyebrow: "RESULTADO",
                  title: "Impacto coletivo",
                  description:
                      "Visualizações acumuladas pelo SQUAD.",
              },
              {
                  key: "squad_creative",
                  eyebrow: "DESIGN",
                  title: "Central Criativa",
                  description:
                      "Produção visual aprovada pelo time.",
              },
          ]
        : roleType === "design"
          ? [
                {
                    key: "pieces",
                    eyebrow: "TRILHA 01",
                    title: "Produção criativa",
                    description:
                        "Marcos de longo prazo pelo número real de peças aprovadas.",
                },
                {
                    key: "demands",
                    eyebrow: "TRILHA 02",
                    title: "Demandas concluídas",
                    description:
                        "Volume acumulado de demandas aprovadas pela gerência.",
                },
                {
                    key: "monthly",
                    eyebrow: "TRILHA 03",
                    title: "Meses de alta performance",
                    description:
                        "Grandes volumes de produção dentro de um único mês.",
                },
                {
                    key: "special",
                    eyebrow: "TRILHA 04",
                    title: "Desafios especiais",
                    description:
                        "Marcos raros de versatilidade, grandes entregas e domínio de marca.",
                },
                {
                    key: "journey",
                    eyebrow: "TRILHA 05",
                    title: "Jornada no SQUAD",
                    description:
                        "Marcos de permanência e construção de história no SQUAD.",
                },
            ]
          : [
                {
                    key: "publications",
                    eyebrow: "TRILHA 01",
                    title: "Publicações",
                    description:
                        "Sua evolução pela quantidade de conteúdos no ar.",
                },
                {
                    key: "impact",
                    eyebrow: "TRILHA 02",
                    title: "Impacto",
                    description:
                        "Views e compartilhamentos acumulados.",
                },
                {
                    key: "monthly",
                    eyebrow: "TRILHA 03",
                    title: "Melhores meses",
                    description:
                        "Marcos alcançados dentro de um único mês.",
                },
                {
                    key: "journey",
                    eyebrow: "TRILHA 04",
                    title: "Jornada no SQUAD",
                    description:
                        "Marcos de tempo desde a criação do seu perfil.",
                },
            ];

    return definitions
        .map((section) => ({
            ...section,
            items: items.filter(
                (item) => item.section === section.key
            ),
        }))
        .filter((section) => section.items.length);
}

function achievementUnlockMap(userId) {
    const rows = db
        .prepare(`
            SELECT *
            FROM achievement_unlocks
            WHERE user_id = ?
        `)
        .all(Number(userId));

    return new Map(
        rows.map((row) => [
            row.achievement_key,
            row,
        ])
    );
}

function achievementTrackingInitialized(userId) {
    const row = db.prepare(`
        SELECT user_id, catalog_version
        FROM achievement_sync_state
        WHERE user_id = ?
    `).get(Number(userId));

    return Boolean(
        row &&
            String(row.catalog_version || "") ===
                ACHIEVEMENT_CATALOG_VERSION
    );
}

function initializeAchievementTracking(user, definitions) {
    const transaction = db.transaction(() => {
        definitions.forEach((achievement) => {
            if (
                Number(achievement.current) >=
                Number(achievement.target)
            ) {
                db.prepare(`
                    INSERT OR IGNORE INTO achievement_unlocks (
                        user_id,
                        achievement_key,
                        unlocked_at
                    )
                    VALUES (?, ?, ?)
                `).run(
                    Number(user.id),
                    achievement.key,
                    new Date().toISOString()
                );
            }
        });

        db.prepare(`
            INSERT INTO achievement_sync_state (
                user_id,
                initialized_at,
                catalog_version
            )
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                initialized_at = excluded.initialized_at,
                catalog_version = excluded.catalog_version
        `).run(
            Number(user.id),
            new Date().toISOString(),
            ACHIEVEMENT_CATALOG_VERSION
        );
    });

    transaction();
}

function syncUserAchievementUnlocks(user) {
    if (!user || isManagerUserId(user.id)) {
        return [];
    }

    const personal =
        personalAchievementDefinitions(user);
    const definitions = personal.items;

    if (!achievementTrackingInitialized(user.id)) {
        initializeAchievementTracking(
            user,
            definitions
        );
        return [];
    }

    const unlocked = achievementUnlockMap(user.id);
    const newlyUnlocked = [];

    definitions.forEach((achievement) => {
        if (
            unlocked.has(achievement.key) ||
            Number(achievement.current) <
                Number(achievement.target)
        ) {
            return;
        }

        const result = db.prepare(`
            INSERT OR IGNORE INTO achievement_unlocks (
                user_id,
                achievement_key,
                unlocked_at
            )
            VALUES (?, ?, ?)
        `).run(
            Number(user.id),
            achievement.key,
            new Date().toISOString()
        );

        if (!result.changes) return;

        const unlockId = Number(
            result.lastInsertRowid
        );

        createManagerNotification({
            userId: user.id,
            category:
                personal.role_type === "design"
                    ? "design"
                    : "social",
            eventType: "achievement_unlocked",
            entityType: "achievement",
            entityId: unlockId,
            title: "Nova conquista desbloqueada 🏆",
            message: `${achievement.title}: ${achievement.description}`,
            note: `Você alcançou ${formatSummaryNumber(
                achievement.target
            )} ${achievement.unit}. Esse selo agora faz parte das suas conquistas.`,
        });

        newlyUnlocked.push(achievement.key);
    });

    return newlyUnlocked;
}

function syncAllAchievementUnlocks() {
    const users = db
        .prepare(`
            SELECT *
            FROM users
            WHERE active = 1
              AND lower(
                    trim(
                        COALESCE(
                            access_role,
                            'colaborador'
                        )
                    )
                  ) <> 'gerente'
            ORDER BY id
        `)
        .all()
        .map(serializeUser);

    let total = 0;

    users.forEach((user) => {
        total += syncUserAchievementUnlocks(
            user
        ).length;
    });

    return total;
}

function decoratePersonalAchievements(user) {
    const personal =
        personalAchievementDefinitions(user);

    syncUserAchievementUnlocks(user);

    const unlockMap = achievementUnlockMap(
        user.id
    );

    const items = personal.items.map(
        (achievement) => {
            const unlock = unlockMap.get(
                achievement.key
            );

            return {
                ...achievement,
                unlocked: Boolean(unlock),
                unlocked_at:
                    unlock?.unlocked_at || "",
            };
        }
    );

    const unlockedItems = items.filter(
        (item) => item.unlocked
    );

    const lockedItems = items.filter(
        (item) => !item.unlocked
    );

    const next =
        lockedItems
            .slice()
            .sort(
                (a, b) =>
                    b.percent - a.percent ||
                    a.target - b.target
            )[0] || null;

    const recentUnlocked = unlockedItems
        .slice()
        .sort((a, b) =>
            String(b.unlocked_at).localeCompare(
                String(a.unlocked_at)
            )
        )
        .slice(0, 3);

    return {
        role_type: personal.role_type,
        role_label: personal.role_label,
        summary: {
            unlocked: unlockedItems.length,
            total: items.length,
            percent: items.length
                ? Math.round(
                      (unlockedItems.length /
                          items.length) *
                          100
                  )
                : 0,
            next,
        },
        sections: groupAchievementSections(
            items,
            personal.role_type,
            false
        ),
        recent_unlocked: recentUnlocked,
    };
}

function decorateSquadAchievements() {
    const items = squadAchievementDefinitions().map(
        (achievement) => ({
            ...achievement,
            unlocked:
                Number(achievement.current) >=
                Number(achievement.target),
            unlocked_at: "",
        })
    );

    const unlocked = items.filter(
        (item) => item.unlocked
    ).length;

    return {
        unlocked,
        total: items.length,
        percent: items.length
            ? Math.round(
                  (unlocked / items.length) * 100
              )
            : 0,
        sections: groupAchievementSections(
            items,
            "",
            true
        ),
    };
}

function achievementsPayloadForUser(user) {
    const personal =
        decoratePersonalAchievements(user);

    return {
        mode: "collaborator",
        ...personal,
    };
}

function createManagerNotification({
    userId,
    category,
    eventType,
    entityType,
    entityId,
    title,
    message,
    note = "",
    managerUserId = null,
}) {
    const targetUserId = Number(userId);
    const targetEntityId = Number(entityId);

    if (!targetUserId || !targetEntityId) return null;

    const now = new Date().toISOString();

    /*
     * Se houve uma nova decisão sobre o MESMO item antes do colaborador
     * abrir a anterior, somente a decisão mais recente continua no badge.
     * A antiga permanece no histórico, mas é marcada como lida.
     */
    db.prepare(`
        UPDATE notifications
        SET read_at = ?
        WHERE user_id = ?
          AND entity_type = ?
          AND entity_id = ?
          AND TRIM(COALESCE(read_at, '')) = ''
    `).run(now, targetUserId, entityType, targetEntityId);

    const result = db
        .prepare(`
            INSERT INTO notifications (
                user_id,
                category,
                event_type,
                entity_type,
                entity_id,
                title,
                message,
                note,
                manager_user_id,
                read_at,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)
        `)
        .run(
            targetUserId,
            category,
            eventType,
            entityType,
            targetEntityId,
            title,
            message,
            note,
            managerUserId ? Number(managerUserId) : null,
            now
        );

    return Number(result.lastInsertRowid);
}

function purgeExpiredNotifications() {
    /*
     * Regra das notificações:
     *
     * - NÃO LIDA:
     *   permanece disponível por até 30 dias para não perder um retorno
     *   importante da gerência.
     *
     * - LIDA:
     *   permanece visível por mais 12 horas após a leitura e depois é
     *   removida automaticamente do histórico.
     *
     * Isso evita acumular vários retornos antigos na tela, mas ainda dá
     * tempo suficiente para o colaborador consultar novamente uma decisão
     * que acabou de abrir.
     */
    const result = db
        .prepare(`
            DELETE FROM notifications
            WHERE (
                    TRIM(COALESCE(read_at, '')) <> ''
                    AND datetime(read_at) <= datetime('now', '-12 hours')
                  )
               OR (
                    TRIM(COALESCE(read_at, '')) = ''
                    AND datetime(created_at) <= datetime('now', '-30 days')
                  )
        `)
        .run();

    return Number(result.changes || 0);
}

function notificationCounts(userId) {
    const rows = db
        .prepare(`
            SELECT category, COUNT(*) AS total
            FROM notifications
            WHERE user_id = ?
              AND TRIM(COALESCE(read_at, '')) = ''
            GROUP BY category
        `)
        .all(Number(userId));

    const social =
        rows.find((item) => item.category === "social")?.total || 0;
    const design =
        rows.find((item) => item.category === "design")?.total || 0;

    return {
        unread_social: Number(social),
        unread_design: Number(design),
        unread_total: Number(social) + Number(design),
    };
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

function completeLinkedManagerRequestByContent(
    contentId,
    actorUserId,
    message = ""
) {
    const requestRow = db
        .prepare(`
            SELECT *
            FROM manager_requests
            WHERE assigned_content_id = ?
              AND TRIM(COALESCE(deleted_at, '')) = ''
            ORDER BY id DESC
            LIMIT 1
        `)
        .get(Number(contentId));

    if (!requestRow) return null;

    if (requestRow.status === "Concluído") {
        return requestRow;
    }

    if (
        actorUserId &&
        Number(requestRow.assigned_user_id || 0) !==
            Number(actorUserId)
    ) {
        return null;
    }

    db.prepare(`
        UPDATE manager_requests
        SET status = 'Concluído',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(requestRow.id);

    if (actorUserId) {
        db.prepare(`
            INSERT INTO manager_request_updates (
                request_id, author_id, message
            )
            VALUES (?, ?, ?)
        `).run(
            requestRow.id,
            Number(actorUserId),
            message ||
                "✓ Demanda concluída automaticamente pelo responsável do SQUAD."
        );
    }

    return db
        .prepare(`SELECT * FROM manager_requests WHERE id = ?`)
        .get(requestRow.id);
}

function getManagerRequestLinkForContent(contentId) {
    if (!contentId) return null;

    const row = db
        .prepare(`
            SELECT r.id, r.status, r.requester_id, r.desired_date,
                   r.final_deadline, r.assigned_user_id,
                   u.name requester_name, u.nickname requester_nickname
            FROM manager_requests r
            LEFT JOIN users u ON u.id = r.requester_id
            WHERE r.assigned_content_id = ?
              AND TRIM(COALESCE(r.deleted_at, '')) = ''
            ORDER BY r.id DESC
            LIMIT 1
        `)
        .get(Number(contentId));

    if (!row) return null;

    return {
        id: Number(row.id),
        status: row.status || "",
        requester_id: Number(row.requester_id || 0),
        requester_name:
            row.requester_nickname || row.requester_name || "Gestor",
        desired_date: row.desired_date || "",
        final_deadline: row.final_deadline || "",
        assigned_user_id: Number(row.assigned_user_id || 0),
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
        manager_request: getManagerRequestLinkForContent(row.id),
        publisher,
        owner,
        metric_total_interactions: normalizeInteger(
            row.metric_total_interactions || engagementData.totalInteractions
        ),
        metric_engagement: normalizeFloat(
            row.metric_engagement || engagementData.engagement
        ),
        engagement_base: engagementData.engagementBase,
        approval_required:
            Number(row.approval_required ?? 1) !== 0,
        is_live: Boolean(Number(row.is_live || 0)),
        trash_expires_at: row.deleted_at
            ? new Date(
                  new Date(row.deleted_at).getTime() +
                      24 * 60 * 60 * 1000
              ).toISOString()
            : "",
        video_retention_expires_at:
            row.published_at && !row.video_files_purged_at
                ? new Date(
                      new Date(row.published_at).getTime() +
                          30 * 24 * 60 * 60 * 1000
                  ).toISOString()
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
            download_url: `/api/creative/files/${file.id}/download`,
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
        approval_required: Number(row.approval_required ?? 1) !== 0,
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
        manager_request: getCreativeManagerRequest(row),
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
    if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 16) return false;
    const received = Buffer.from(String(password || ""));
    const expected = Buffer.from(String(ADMIN_PASSWORD || ""));
    if (received.length !== expected.length) return false;
    return crypto.timingSafeEqual(received, expected);
}

function normalizePassword(password) {
    return String(password || "");
}

function validateNewPassword(password) {
    const value = normalizePassword(password);
    if (value.length < 12) {
        return "A senha precisa ter pelo menos 12 caracteres.";
    }
    if (value.length > 128) {
        return "A senha é muito longa.";
    }
    return "";
}

function createPasswordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
    const hash = crypto.scryptSync(normalizePassword(password), salt, 64).toString("hex");
    return { salt, hash };
}

function verifyUserPassword(row, password) {
    if (!row?.password_hash || !row?.password_salt) return false;
    try {
        const candidate = createPasswordHash(password, row.password_salt).hash;
        const received = Buffer.from(candidate, "hex");
        const expected = Buffer.from(String(row.password_hash), "hex");
        if (received.length !== expected.length) return false;
        return crypto.timingSafeEqual(received, expected);
    } catch {
        return false;
    }
}

function updateUserPassword(userId, password) {
    const { salt, hash } = createPasswordHash(password);
    db.prepare(`
        UPDATE users
        SET password_hash = ?,
            password_salt = ?,
            password_updated_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(hash, salt, Number(userId));
}

function clearUserPassword(userId) {
    db.prepare(`
        UPDATE users
        SET password_hash = '',
            password_salt = '',
            password_updated_at = '',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(Number(userId));

    db.prepare(`DELETE FROM auth_sessions WHERE user_id = ?`).run(Number(userId));
}

function sessionTokenHash(token) {
    return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function createAuthSession({ userId = null, sessionType = "user", hours = 24 }) {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = sessionTokenHash(token);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    db.prepare(`
        INSERT INTO auth_sessions (token_hash, session_type, user_id, expires_at)
        VALUES (?, ?, ?, ?)
    `).run(tokenHash, sessionType, userId ? Number(userId) : null, expiresAt);

    return { token, expires_at: expiresAt };
}

function findAuthSession(token, sessionType = "") {
    if (!token) return null;
    const hash = sessionTokenHash(token);
    const row = db.prepare(`
        SELECT s.*,
               u.name AS user_name,
               u.active AS user_active,
               u.access_role AS user_access_role
        FROM auth_sessions s
        LEFT JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?
          AND datetime(s.expires_at) > datetime('now')
          ${sessionType ? "AND s.session_type = ?" : ""}
        LIMIT 1
    `).get(...(sessionType ? [hash, sessionType] : [hash]));

    if (!row) return null;
    if (row.session_type === "user" && Number(row.user_active) !== 1) return null;

    db.prepare(`
        UPDATE auth_sessions
        SET last_seen_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(row.id);

    return row;
}

function bearerToken(req) {
    const header = String(req.headers.authorization || "");
    if (!header.toLowerCase().startsWith("bearer ")) return "";
    return header.slice(7).trim();
}

function adminToken(req) {
    return String(req.headers["x-squad-admin-token"] || "").trim();
}

function hydrateRequestSessions(req) {
    const userSession = findAuthSession(bearerToken(req), "user");
    const adminSession = findAuthSession(adminToken(req), "admin");

    req.userSession = userSession || null;
    req.adminSession = adminSession || null;
    req.authUser = userSession?.user_id ? getActiveUserRowById(userSession.user_id) : null;
}

function requireAuthenticatedApi(req, res, next) {
    hydrateRequestSessions(req);
    if (req.userSession || req.adminSession) return next();
    return res.status(401).json({ error: "Sessão expirada. Entre novamente no SQUAD." });
}

function requireAdminRequest(req, res) {
    if (req.adminSession) return true;
    res.status(403).json({ error: "Acesso exclusivo da Área ADM." });
    return false;
}

function requireManagerRequest(req, res, requestedManagerId = null) {
    const authenticatedId = Number(req.userSession?.user_id);
    if (!authenticatedId || !isManagerUserId(authenticatedId)) {
        res.status(403).json({ error: "Acesso exclusivo do Portal de Gestores." });
        return false;
    }
    if (requestedManagerId && authenticatedId !== Number(requestedManagerId)) {
        res.status(403).json({ error: "Sessão de gestor incompatível com a solicitação." });
        return false;
    }
    return true;
}

function isExternalManagerUser(user) {
    return String(user?.access_role || "").toLowerCase() === "gestor_externo";
}

function requireMarketingManagerRequest(req, res) {
    const user = req.authUser;
    if (!user || String(user.access_role || "").toLowerCase() !== "gerente") {
        res.status(403).json({ error: "Acesso exclusivo do Gerente de Marketing." });
        return false;
    }
    return true;
}

function managerRequestTimeline(row) {
    const content = row?.assigned_content_id ? getContent(row.assigned_content_id) : null;

    const creativeJob = row?.id
        ? db
              .prepare(`
                  SELECT *
                  FROM creative_jobs
                  WHERE manager_request_id = ?
                     OR (
                          linked_content_id = ?
                          AND creator_user_id = ?
                     )
                  ORDER BY id DESC
                  LIMIT 1
              `)
              .get(
                  Number(row.id),
                  Number(row.assigned_content_id || 0),
                  Number(row.assigned_user_id || 0)
              )
        : null;

    const requestStatus = String(row?.status || "Recebido");
    const assigned = Boolean(Number(row?.assigned_content_id || 0));
    const rejected = requestStatus === "Reprovado";
    const cancelled = requestStatus === "Cancelado";
    const completed = requestStatus === "Concluído" || Boolean(content?.is_live);

    let currentIndex = 0;
    if (["Recebido", "Revisão solicitada"].includes(requestStatus)) currentIndex = 1;
    if (requestStatus === "Aprovado") currentIndex = 2;
    if (assigned) currentIndex = 3;

    const inValidation = Boolean(
        (content && (
            content.approval_stage === "idea" ||
            content.approval_stage === "final" ||
            content.idea_approval_status === "alteracao" ||
            content.approval_status === "alteracao" ||
            content.approval_status === "aprovado" ||
            ["Aguardando aprovação da ideia", "Aguardando aprovação final", "Ajuste solicitado", "Aprovado"].includes(String(content.status || ""))
        )) ||
        ["aguardando_aprovacao", "ajuste"].includes(
            String(creativeJob?.status || "")
        )
    );
    if (inValidation) currentIndex = 4;
    if (completed) currentIndex = 5;
    if (rejected) currentIndex = 1;

    const formatTimelineDate = (value) => {
        if (!value) return "";
        const raw = String(value).trim();
        const isoDay = raw.slice(0, 10);
        const date = /^\d{4}-\d{2}-\d{2}$/.test(isoDay)
            ? new Date(`${isoDay}T12:00:00`)
            : new Date(raw);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleDateString("pt-BR");
    };

    let validationDescription = "A etapa de validação será atualizada quando o material entrar em aprovação ou ajustes.";
    if (content?.approval_stage === "idea") validationDescription = "Ideia em validação pelo Gerente de Marketing.";
    else if (content?.idea_approval_status === "alteracao") validationDescription = "A ideia voltou para ajustes do SQUAD.";
    else if (content?.approval_stage === "final") validationDescription = "Material final em validação pelo Gerente de Marketing.";
    else if (content?.approval_status === "alteracao") validationDescription = "Material final voltou para ajustes do SQUAD.";
    else if (content?.approval_status === "aprovado") validationDescription = "Material final aprovado. Aguardando conclusão/publicação da demanda.";

    const steps = [
        {
            key: "sent",
            label: "Pedido enviado",
            description: "A solicitação foi registrada e enviada ao Marketing.",
            date: formatTimelineDate(row?.created_at),
        },
        {
            key: "analysis",
            label: requestStatus === "Revisão solicitada" ? "Revisão solicitada" : rejected ? "Pedido reprovado" : "Análise do Marketing",
            description: requestStatus === "Revisão solicitada"
                ? "O Gerente de Marketing solicitou informações ou ajustes antes de seguir."
                : rejected
                  ? "A solicitação foi analisada e não seguirá para execução."
                  : "O Gerente de Marketing analisa escopo, prioridade e viabilidade.",
            date: ["Aprovado", "Em andamento", "Concluído", "Reprovado", "Revisão solicitada"].includes(requestStatus)
                ? formatTimelineDate(row?.updated_at)
                : "",
        },
        {
            key: "planning",
            label: "Planejamento e prazo oficial",
            description: row?.final_deadline
                ? `Prazo oficial definido para ${formatTimelineDate(row.final_deadline)}.`
                : "O prazo desejado é apenas referência. O Marketing ainda definirá o prazo oficial.",
            date: formatTimelineDate(row?.final_deadline_set_at),
        },
        {
            key: "production",
            label: "Em produção",
            description: assigned
                ? `${row?.assigned_user_name || "SQUAD"} está com a demanda${content?.status ? ` • ${content.status}` : ""}.`
                : "A demanda ainda não foi encaminhada para execução.",
            date: formatTimelineDate(row?.assigned_at),
        },
        {
            key: "validation",
            label: "Validação / ajustes",
            description: validationDescription,
            date: inValidation ? formatTimelineDate(content?.updated_at) : "",
        },
        {
            key: "done",
            label: "Concluído",
            description: completed
                ? "A demanda foi finalizada pelo Marketing."
                : "Esta etapa será concluída quando o trabalho for finalizado.",
            date: completed ? formatTimelineDate(content?.published_at || row?.updated_at) : "",
        },
    ];

    steps.forEach((step, index) => {
        if (rejected) {
            step.state = index < 1 ? "done" : index === 1 ? "rejected" : "blocked";
        } else if (cancelled) {
            step.state = index < currentIndex ? "done" : index === currentIndex ? "rejected" : "blocked";
        } else {
            step.state = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
        }
    });

    return {
        current_index: currentIndex,
        current_label: steps[currentIndex]?.label || requestStatus,
        content_status: content?.status || "",
        creative_status: creativeJob?.status || "",
        creative_approval_required:
            creativeJob
                ? Number(creativeJob.approval_required ?? 1) !== 0
                : null,
        steps,
    };
}

function getManagerRequestFiles(requestId) {
    return db
        .prepare(`
            SELECT id, request_id, original_name, filename, mime_type,
                   file_size, uploaded_by_user_id, created_at
            FROM manager_request_files
            WHERE request_id = ?
            ORDER BY id
        `)
        .all(Number(requestId))
        .map((file) => ({
            ...file,
            url: `/uploads/${file.filename}`,
            download_url: `/api/manager-request-files/${file.id}/download`,
        }));
}

function serializeManagerRequest(row) {
    return {
        id: row.id,
        requester_id: row.requester_id,
        requester_name: row.requester_name || "",
        requester_role: row.requester_role || "",
        requester_department: row.requester_department || "",
        title: row.title || "",
        brand: row.brand || "",
        request_type: row.request_type || "",
        desired_date: row.desired_date || "",
        final_deadline: row.final_deadline || "",
        final_deadline_set_at: row.final_deadline_set_at || "",
        priority: row.priority || "Normal",
        objective: row.objective || "",
        target_audience: row.target_audience || "",
        required_info: row.required_info || "",
        channels: parseJsonArray(row.channels),
        print_dimensions: row.print_dimensions || "",
        description: row.description || "",
        references_text: row.references_text || "",
        status: row.status || "Recebido",
        manager_response: row.manager_response || "",
        assigned_user_id: row.assigned_user_id ? Number(row.assigned_user_id) : null,
        assigned_user_name: row.assigned_user_name || "",
        assigned_user_role: row.assigned_user_role || "",
        assigned_date: row.assigned_date || "",
        assigned_urgency: row.assigned_urgency || "",
        assigned_content_id: row.assigned_content_id ? Number(row.assigned_content_id) : null,
        assigned_at: row.assigned_at || "",
        deleted_at: row.deleted_at || "",
        deleted_previous_status: row.deleted_previous_status || "",
        trash_expires_at: row.deleted_at
            ? new Date(new Date(row.deleted_at).getTime() + 24 * 60 * 60 * 1000).toISOString()
            : "",
        created_at: row.created_at || "",
        updated_at: row.updated_at || "",
        files: getManagerRequestFiles(row.id),
        timeline: managerRequestTimeline(row),
    };
}

function canEditUser(req, userId) {
    if (req.adminSession) return true;
    return Number(req.userSession?.user_id) === Number(userId);
}

function auditAdmin(action, user = null, detail = "") {
    try {
        db.prepare(`
            INSERT INTO admin_audit_log (
                action,
                target_user_id,
                target_user_name,
                detail
            ) VALUES (?, ?, ?, ?)
        `).run(
            String(action || ""),
            user?.id ? Number(user.id) : null,
            String(user?.name || ""),
            String(detail || "")
        );
    } catch (error) {
        console.error("Histórico ADM:", error.message);
    }
}

/* Remove sessões antigas sem afetar dados de usuários. */
db.prepare(`DELETE FROM auth_sessions WHERE datetime(expires_at) <= datetime('now')`).run();

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

const allowedContentExtensions = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".mp4",
    ".mov",
    ".webm",
    ".pdf",
]);

const upload = multer({
    storage: contentStorage,
    limits: {
        fileSize: 500 * 1024 * 1024,
        files: 10,
    },
    fileFilter: (req, file, callback) => {
        const extension = path
            .extname(file.originalname || "")
            .toLowerCase();

        const mime = String(
            file.mimetype || ""
        ).toLowerCase();

        const extensionAllowed =
            allowedContentExtensions.has(extension);

        const mimeAllowed =
            allowedContentMimeTypes.has(mime) ||
            mime === "application/octet-stream";

        if (extensionAllowed && mimeAllowed) {
            callback(null, true);
            return;
        }

        callback(
            new Error(
                `Arquivo não permitido: ${file.originalname}. Use JPG, JPEG, PNG, WEBP, GIF, MP4, MOV, WEBM ou PDF.`
            )
        );
    },
});

const allowedManagerRequestReferenceExtensions = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".mp4",
    ".mov",
    ".webm",
]);

const allowedManagerRequestReferenceMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/quicktime",
    "video/webm",
]);

const managerRequestReferenceUpload = multer({
    storage: contentStorage,
    limits: {
        fileSize: 30 * 1024 * 1024,
        files: 5,
    },
    fileFilter: (req, file, callback) => {
        const extension = path.extname(file.originalname || "").toLowerCase();
        const mime = String(file.mimetype || "").toLowerCase();
        const extensionAllowed = allowedManagerRequestReferenceExtensions.has(extension);
        const mimeAllowed =
            allowedManagerRequestReferenceMimeTypes.has(mime) ||
            mime === "application/octet-stream";

        if (extensionAllowed && mimeAllowed) {
            callback(null, true);
            return;
        }

        callback(
            new Error(
                "Referência não permitida. Use JPG, JPEG, PNG, WEBP, MP4, MOV ou WEBM."
            )
        );
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
            !isStoriesFormat(item.format) &&
            (normalizeInteger(item.metric_views) > 0 ||
                normalizeInteger(item.metric_likes) > 0 ||
                normalizeInteger(item.metric_shares) > 0)
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
    const storiesPublished = published.filter((item) =>
        isStoriesFormat(item.format)
    );
    const metricEligible = published.filter(
        (item) => !isStoriesFormat(item.format)
    );

    const withMetrics = metricEligible.filter(
        (item) =>
            normalizeInteger(item.metric_views) > 0 ||
            normalizeInteger(item.metric_total_interactions) > 0
    );
    const withViews = metricEligible.filter(
        (item) => normalizeInteger(item.metric_views) > 0
    );
    const withEngagement = metricEligible.filter(
        (item) => normalizeFloat(item.metric_engagement) > 0
    );

    return {
        planned: items.length,
        published: published.length,
        storiesPublished: storiesPublished.length,
        metricEligiblePublished: metricEligible.length,
        approved: items.filter(
            (item) => item.approval_status === "aprovado"
        ).length,
        views: sum(withViews, (item) => item.metric_views),
        reach: sum(withMetrics, (item) => item.metric_reach),
        interactions: sum(withMetrics, (item) => item.metric_total_interactions),
        likes: sum(withMetrics, (item) => item.metric_likes),
        comments: sum(withMetrics, (item) => item.metric_comments),
        shares: sum(withMetrics, (item) => item.metric_shares),
        saves: sum(withMetrics, (item) => item.metric_saves),
        engagement: Number(
            average(withEngagement, (item) => item.metric_engagement).toFixed(2)
        ),
        metricsCoverage: metricEligible.length
            ? Number(((withMetrics.length / metricEligible.length) * 100).toFixed(1))
            : 0,
        viewsCoverage: metricEligible.length
            ? Number(((withViews.length / metricEligible.length) * 100).toFixed(1))
            : 0,
        engagementCoverage: metricEligible.length
            ? Number(((withEngagement.length / metricEligible.length) * 100).toFixed(1))
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
    const metricEligible = published.filter(
        (item) => !isStoriesFormat(item.format)
    );

    const withoutCoreMetrics = metricEligible.filter(
        (item) =>
            normalizeInteger(item.metric_views) === 0 &&
            normalizeInteger(item.metric_likes) === 0 &&
            normalizeInteger(item.metric_shares) === 0
    );

    const pendingApproval = items.filter(
        (item) =>
            (
                (item.approval_stage === "idea" &&
                    item.idea_approval_status === "pendente") ||
                (item.approval_stage === "final" &&
                    item.approval_status === "pendente")
            ) &&
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

let weatherRefreshPromise = null;

function joinvilleTodayKey() {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: WEATHER_LOCATION.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const values = {};
    parts.forEach((part) => {
        if (part.type !== "literal") {
            values[part.type] = part.value;
        }
    });

    return `${values.year}-${values.month}-${values.day}`;
}

function addDateDays(dateKey, amount) {
    const [year, month, day] = String(dateKey)
        .split("-")
        .map(Number);

    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + amount);

    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, "0"),
        String(date.getUTCDate()).padStart(2, "0"),
    ].join("-");
}

function currentMondayKey() {
    const todayKey = joinvilleTodayKey();
    const [year, month, day] = todayKey.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const weekday = date.getUTCDay();
    const daysSinceMonday = (weekday + 6) % 7;

    return addDateDays(todayKey, -daysSinceMonday);
}

function weatherCodeInfo(code) {
    const value = Number(code);

    if (value === 0) {
        return { icon: "☀️", condition: "Céu limpo" };
    }
    if (value === 1) {
        return { icon: "🌤️", condition: "Predominantemente limpo" };
    }
    if (value === 2) {
        return { icon: "⛅", condition: "Parcialmente nublado" };
    }
    if (value === 3) {
        return { icon: "☁️", condition: "Nublado" };
    }
    if ([45, 48].includes(value)) {
        return { icon: "🌫️", condition: "Neblina" };
    }
    if ([51, 53, 55, 56, 57].includes(value)) {
        return { icon: "🌦️", condition: "Garoa" };
    }
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(value)) {
        return { icon: "🌧️", condition: "Chuva" };
    }
    if ([71, 73, 75, 77, 85, 86].includes(value)) {
        return { icon: "❄️", condition: "Neve" };
    }
    if ([95, 96, 99].includes(value)) {
        return { icon: "⛈️", condition: "Trovoadas" };
    }

    return { icon: "☁️", condition: "Tempo variável" };
}

function calendarWeatherIcon(code) {
    const value = Number(code);

    if ([0, 1].includes(value)) {
        return "☀️";
    }

    if ([2, 3, 45, 48].includes(value)) {
        return "☁️";
    }

    if (
        [
            51, 53, 55, 56, 57,
            61, 63, 65, 66, 67,
            71, 73, 75, 77,
            80, 81, 82, 85, 86,
        ].includes(value)
    ) {
        return "🌧️";
    }

    if ([95, 96, 99].includes(value)) {
        return "⛈️";
    }

    return "☁️";
}

function loadWeatherCache() {
    const row = db
        .prepare(`
            SELECT payload, updated_at
            FROM app_cache
            WHERE cache_key = ?
        `)
        .get(WEATHER_CACHE_KEY);

    if (!row) return null;

    try {
        return {
            payload: JSON.parse(row.payload),
            updated_at: row.updated_at,
        };
    } catch {
        return null;
    }
}

function saveWeatherCache(payload) {
    const now = new Date().toISOString();

    db.prepare(`
        INSERT INTO app_cache (
            cache_key,
            payload,
            updated_at
        )
        VALUES (?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
            payload = excluded.payload,
            updated_at = excluded.updated_at
    `).run(
        WEATHER_CACHE_KEY,
        JSON.stringify(payload),
        now
    );

    return now;
}

function weatherCacheIsFresh(cache) {
    if (!cache?.updated_at) return false;

    const updated = new Date(cache.updated_at).getTime();
    if (!Number.isFinite(updated)) return false;

    return Date.now() - updated < WEATHER_CACHE_MS;
}

function buildWeatherWeek(raw) {
    const daily = raw?.daily || {};
    const times = Array.isArray(daily.time) ? daily.time : [];
    const codes = Array.isArray(daily.weather_code)
        ? daily.weather_code
        : [];
    const maxTemps = Array.isArray(daily.temperature_2m_max)
        ? daily.temperature_2m_max
        : [];
    const minTemps = Array.isArray(daily.temperature_2m_min)
        ? daily.temperature_2m_min
        : [];
    const precipitation = Array.isArray(
        daily.precipitation_probability_max
    )
        ? daily.precipitation_probability_max
        : [];

    if (!times.length) {
        throw new Error("A API de clima não retornou dados diários.");
    }

    const todayKey = joinvilleTodayKey();
    const mondayKey = currentMondayKey();
    const weekdayLabels = [
        "SEG",
        "TER",
        "QUA",
        "QUI",
        "SEX",
        "SÁB",
        "DOM",
    ];

    const days = Array.from({ length: 7 }).map((_, index) => {
        const dateKey = addDateDays(mondayKey, index);
        const sourceIndex = times.indexOf(dateKey);

        if (sourceIndex < 0) {
            return null;
        }

        const info = weatherCodeInfo(codes[sourceIndex]);

        return {
            date: dateKey,
            weekday: weekdayLabels[index],
            day: Number(dateKey.slice(-2)),
            icon: info.icon,
            condition: info.condition,
            max: Math.round(Number(maxTemps[sourceIndex] || 0)),
            min: Math.round(Number(minTemps[sourceIndex] || 0)),
            precipitation_probability: Math.round(
                Number(precipitation[sourceIndex] || 0)
            ),
            is_today: dateKey === todayKey,
            is_past: dateKey < todayKey,
        };
    }).filter(Boolean);

    if (!days.length) {
        throw new Error("Não foi possível montar a semana atual.");
    }

    /*
     * Ícones exibidos dentro das células do calendário:
     * hoje + os próximos 7 dias.
     *
     * Mantemos somente quatro leituras visuais bem simples:
     * sol, nuvem, chuva e trovoada.
     */
    const calendarDays = Array.from({ length: 8 })
        .map((_, index) => {
            const dateKey = addDateDays(todayKey, index);
            const sourceIndex = times.indexOf(dateKey);

            if (sourceIndex < 0) {
                return null;
            }

            const info = weatherCodeInfo(codes[sourceIndex]);

            return {
                date: dateKey,
                icon: calendarWeatherIcon(codes[sourceIndex]),
                condition: info.condition,
                max: Math.round(
                    Number(maxTemps[sourceIndex] || 0)
                ),
                min: Math.round(
                    Number(minTemps[sourceIndex] || 0)
                ),
            };
        })
        .filter(Boolean);

    return {
        city: WEATHER_LOCATION.city,
        timezone: WEATHER_LOCATION.timezone,
        week_start: mondayKey,
        week_end: addDateDays(mondayKey, 6),
        days,
        calendar_days: calendarDays,
        source: "Open-Meteo",
    };
}

async function refreshJoinvilleWeather(force = false) {
    const cached = loadWeatherCache();

    if (!force && weatherCacheIsFresh(cached)) {
        return {
            ...cached.payload,
            updated_at: cached.updated_at,
            stale: false,
        };
    }

    if (weatherRefreshPromise) {
        return weatherRefreshPromise;
    }

    weatherRefreshPromise = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);

        try {
            const params = new URLSearchParams({
                latitude: String(WEATHER_LOCATION.latitude),
                longitude: String(WEATHER_LOCATION.longitude),
                timezone: WEATHER_LOCATION.timezone,
                daily:
                    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
                past_days: "7",
                forecast_days: "10",
            });

            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
                {
                    signal: controller.signal,
                    headers: {
                        Accept: "application/json",
                    },
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Serviço de clima respondeu ${response.status}.`
                );
            }

            const raw = await response.json();
            const payload = buildWeatherWeek(raw);
            const updatedAt = saveWeatherCache(payload);

            return {
                ...payload,
                updated_at: updatedAt,
                stale: false,
            };
        } catch (error) {
            const fallback = loadWeatherCache();

            if (fallback?.payload) {
                return {
                    ...fallback.payload,
                    updated_at: fallback.updated_at,
                    stale: true,
                };
            }

            throw error;
        } finally {
            clearTimeout(timeout);
            weatherRefreshPromise = null;
        }
    })();

    return weatherRefreshPromise;
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
                  AND lower(trim(COALESCE(format, ''))) NOT IN ('stories', 'story', 'storys')
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

app.get("/api/weather/week", async (req, res) => {
    try {
        const force = String(req.query.refresh || "") === "1";
        const data = await refreshJoinvilleWeather(force);
        res.json(data);
    } catch (error) {
        console.error("Previsão do tempo:", error.message);
        res.status(503).json({
            error:
                "Previsão do tempo temporariamente indisponível.",
        });
    }
});

app.get("/api/auth/users", (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT *
            FROM users
            WHERE active = 1
            ORDER BY CASE WHEN access_role = 'gerente' THEN 0 ELSE 1 END, name
        `).all();
        res.json(rows.map(serializeUser));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao carregar os perfis do SQUAD." });
    }
});

app.post("/api/auth/setup-password", (req, res) => {
    try {
        hydrateRequestSessions(req);
        if (!requireAdminRequest(req, res)) return;
        const userId = Number(req.body?.user_id);
        const password = normalizePassword(req.body?.password);
        const confirmPassword = normalizePassword(req.body?.confirm_password);
        const user = getActiveUserRowById(userId);

        if (!user) return res.status(404).json({ error: "Perfil não encontrado." });
        if (String(user.password_hash || "").trim()) {
            return res.status(409).json({ error: "Este perfil já possui senha. Use Entrar." });
        }

        const passwordError = validateNewPassword(password);
        if (passwordError) return res.status(400).json({ error: passwordError });
        if (password !== confirmPassword) {
            return res.status(400).json({ error: "As senhas não conferem." });
        }

        updateUserPassword(user.id, password);
        const session = createAuthSession({ userId: user.id, sessionType: "user", hours: 24 });
        const updated = getActiveUserRowById(user.id);

        res.status(201).json({
            token: session.token,
            expires_at: session.expires_at,
            user: serializeUser(updated),
            first_access: true,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao criar a senha do perfil." });
    }
});

app.post("/api/auth/login", (req, res) => {
    try {
        const userId = Number(req.body?.user_id);
        const password = normalizePassword(req.body?.password);
        const user = getActiveUserRowById(userId);

        if (!user) return res.status(404).json({ error: "Perfil não encontrado." });
        if (!String(user.password_hash || "").trim()) {
            return res.status(409).json({
                error: "Este é o primeiro acesso. Crie uma senha para continuar.",
                needs_password_setup: true,
            });
        }
        if (!verifyUserPassword(user, password)) {
            return res.status(401).json({ error: "Senha incorreta." });
        }

        db.prepare(`DELETE FROM auth_sessions WHERE user_id = ? AND session_type = 'user'`).run(user.id);
        const session = createAuthSession({ userId: user.id, sessionType: "user", hours: 24 });

        res.json({
            token: session.token,
            expires_at: session.expires_at,
            user: serializeUser(user),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao entrar no SQUAD." });
    }
});

app.post("/api/admin/login", (req, res) => {
    try {
        if (!validateAdmin(req.body?.password)) {
            return res.status(401).json({ error: "Senha administrativa incorreta." });
        }

        db.prepare(`DELETE FROM auth_sessions WHERE session_type = 'admin'`).run();
        const session = createAuthSession({ sessionType: "admin", hours: 8 });
        auditAdmin("login_admin", null, "Acesso à Área ADM");

        res.json({
            success: true,
            admin_token: session.token,
            expires_at: session.expires_at,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao acessar a Área ADM." });
    }
});

app.get("/api/status", (req, res) => {
    res.json({
        status: "online",
        app: "SQUAD Social Planner",
        meta_configured: loadMetaConfig().enabled,
        time: new Date().toISOString(),
    });
});

app.use("/api", requireAuthenticatedApi);

app.get("/api/auth/me", (req, res) => {
    if (!req.userSession?.user_id) {
        return res.status(401).json({ error: "Sessão de usuário inválida." });
    }
    const user = getActiveUserRowById(req.userSession.user_id);
    if (!user) return res.status(401).json({ error: "Perfil indisponível." });
    res.json({ user: serializeUser(user) });
});

app.get("/api/manager-requests", (req, res) => {
    try {
        const user = req.authUser;
        if (!user) return res.status(401).json({ error: "Sessão inválida." });
        const role = String(user.access_role || "").toLowerCase();
        let rows = [];
        if (role === "gerente") {
            rows = db.prepare(`
                SELECT r.*, u.name requester_name, u.role requester_role, u.department requester_department,
                       au.name assigned_user_name, au.role assigned_user_role
                FROM manager_requests r
                JOIN users u ON u.id = r.requester_id
                LEFT JOIN users au ON au.id = r.assigned_user_id
                WHERE TRIM(COALESCE(r.deleted_at, '')) = ''
                ORDER BY CASE r.status
                    WHEN 'Recebido' THEN 0
                    WHEN 'Revisão solicitada' THEN 1
                    WHEN 'Aprovado' THEN 2
                    WHEN 'Em andamento' THEN 3
                    WHEN 'Concluído' THEN 4
                    ELSE 5
                END,
                datetime(r.created_at) DESC
            `).all();
        } else if (role === "gestor_externo") {
            rows = db.prepare(`
                SELECT r.*, u.name requester_name, u.role requester_role, u.department requester_department,
                       au.name assigned_user_name, au.role assigned_user_role
                FROM manager_requests r
                JOIN users u ON u.id = r.requester_id
                LEFT JOIN users au ON au.id = r.assigned_user_id
                WHERE r.requester_id = ?
                  AND (
                        TRIM(COALESCE(r.deleted_at, '')) = ''
                        OR datetime(r.deleted_at) > datetime('now', '-24 hours')
                      )
                ORDER BY datetime(r.created_at) DESC
            `).all(user.id);
        } else {
            return res.status(403).json({ error: "Este recurso é exclusivo dos gerentes." });
        }
        res.json(rows.map(serializeManagerRequest));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao carregar pedidos." });
    }
});

app.post("/api/manager-requests", (req, res) => {
    try {
        const user = req.authUser;
        if (!isExternalManagerUser(user)) {
            return res.status(403).json({ error: "Somente Outros Gerentes podem criar pedidos." });
        }
        const title = String(req.body?.title || "").trim();
        const requestType = String(req.body?.request_type || "").trim();
        const desiredDate = String(req.body?.desired_date || "").trim();
        const objective = String(req.body?.objective || "").trim();
        const targetAudience = String(req.body?.target_audience || "").trim();
        const requiredInfo = String(req.body?.required_info || "").trim();
        const description = String(req.body?.description || "").trim();
        const printDimensions = String(req.body?.print_dimensions || "").trim();
        const channels = Array.isArray(req.body?.channels)
            ? [...new Set(req.body.channels.map((item) => String(item || "").trim()).filter(Boolean))]
            : [];
        const assignedBrands = parseJsonArray(user.brands).map((x)=>String(x || "").trim()).filter(Boolean);
        if (!assignedBrands.length) return res.status(400).json({ error: "Sua conta ainda não possui uma marca definida. Solicite ao administrador do SQUAD." });
        const requestedBrand = String(req.body?.brand || "").trim();
        const assignedBrand = assignedBrands.length === 1 ? assignedBrands[0] : requestedBrand;
        if (!assignedBrands.includes(assignedBrand)) return res.status(403).json({ error: "Esta marca não está autorizada para a sua conta." });
        if (!title) return res.status(400).json({ error: "Digite o título do pedido." });
        if (!requestType) return res.status(400).json({ error: "Informe o que precisamos produzir." });
        if (!objective) return res.status(400).json({ error: "Informe o objetivo da solicitação." });
        if (!targetAudience) return res.status(400).json({ error: "Informe o público-alvo." });
        if (!description) return res.status(400).json({ error: "Descreva o contexto do pedido." });
        if (!desiredDate) return res.status(400).json({ error: "Informe o prazo desejado." });
        if (!channels.length) return res.status(400).json({ error: "Selecione pelo menos um canal de divulgação." });
        if (requestType === "Material impresso" && !printDimensions) {
            return res.status(400).json({ error: "Informe as medidas do material impresso." });
        }
        const result = db.prepare(`
            INSERT INTO manager_requests (
                requester_id, title, brand, request_type, desired_date,
                priority, objective, target_audience, required_info, channels,
                print_dimensions, description, references_text, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Recebido')
        `).run(
            user.id, title, assignedBrand,
            requestType, desiredDate,
            String(req.body?.priority || "Normal").trim(),
            objective, targetAudience, requiredInfo, JSON.stringify(channels),
            printDimensions, description,
            String(req.body?.references_text || "").trim()
        );
        const row = db.prepare(`
            SELECT r.*, u.name requester_name, u.role requester_role, u.department requester_department,
                   au.name assigned_user_name, au.role assigned_user_role
            FROM manager_requests r
            JOIN users u ON u.id = r.requester_id
            LEFT JOIN users au ON au.id = r.assigned_user_id
            WHERE r.id = ?
        `).get(result.lastInsertRowid);
        res.status(201).json(serializeManagerRequest(row));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao enviar pedido ao Marketing." });
    }
});

app.post(
    "/api/manager-requests/:id/files",
    managerRequestReferenceUpload.array("files", 5),
    (req, res) => {
        try {
            const user = req.authUser;
            const requestId = Number(req.params.id);
            const requestRow = db
                .prepare(`SELECT * FROM manager_requests WHERE id = ?`)
                .get(requestId);

            if (!requestRow) {
                req.files?.forEach((file) =>
                    removeContentPhysicalFile(file.filename)
                );
                return res.status(404).json({ error: "Pedido não encontrado." });
            }

            const role = String(user?.access_role || "").toLowerCase();
            const isRequester =
                role === "gestor_externo" &&
                Number(requestRow.requester_id) === Number(user?.id);
            const isMarketingManager = role === "gerente";

            if (!isRequester && !isMarketingManager) {
                req.files?.forEach((file) =>
                    removeContentPhysicalFile(file.filename)
                );
                return res.status(403).json({
                    error: "Você não tem permissão para anexar referências neste pedido.",
                });
            }

            const files = Array.isArray(req.files) ? req.files : [];
            if (!files.length) {
                return res.status(400).json({
                    error: "Selecione pelo menos um arquivo de referência.",
                });
            }

            const existingCount = db
                .prepare(
                    `SELECT COUNT(*) AS total FROM manager_request_files WHERE request_id = ?`
                )
                .get(requestId)?.total || 0;

            if (Number(existingCount) + files.length > 5) {
                files.forEach((file) =>
                    removeContentPhysicalFile(file.filename)
                );
                return res.status(400).json({
                    error: "O pedido pode ter no máximo 5 arquivos de referência.",
                });
            }

            const insertFile = db.prepare(`
                INSERT INTO manager_request_files (
                    request_id, original_name, filename, mime_type,
                    file_size, uploaded_by_user_id
                ) VALUES (?, ?, ?, ?, ?, ?)
            `);

            const transaction = db.transaction(() => {
                files.forEach((file) => {
                    insertFile.run(
                        requestId,
                        String(file.originalname || file.filename || "arquivo"),
                        file.filename,
                        String(file.mimetype || ""),
                        Number(file.size || 0),
                        user?.id ? Number(user.id) : null
                    );
                });

                db.prepare(`
                    UPDATE manager_requests
                    SET updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(requestId);
            });

            transaction();

            const row = db.prepare(`
                SELECT r.*, u.name requester_name, u.role requester_role,
                       u.department requester_department,
                       au.name assigned_user_name, au.role assigned_user_role
                FROM manager_requests r
                JOIN users u ON u.id = r.requester_id
                LEFT JOIN users au ON au.id = r.assigned_user_id
                WHERE r.id = ?
            `).get(requestId);

            res.status(201).json(serializeManagerRequest(row));
        } catch (error) {
            console.error(error);
            req.files?.forEach((file) =>
                removeContentPhysicalFile(file.filename)
            );
            res.status(500).json({
                error: "Erro ao enviar arquivos de referência.",
            });
        }
    }
);

app.get("/api/manager-request-files/:id/download", (req, res) => {
    try {
        const user = req.authUser;
        const fileId = Number(req.params.id);
        const file = db
            .prepare(`
                SELECT f.*, r.requester_id
                FROM manager_request_files f
                JOIN manager_requests r ON r.id = f.request_id
                WHERE f.id = ?
            `)
            .get(fileId);

        if (!file) {
            return res.status(404).json({ error: "Arquivo não encontrado." });
        }

        const role = String(user?.access_role || "").toLowerCase();
        const canAccess =
            role === "gerente" ||
            (role === "gestor_externo" &&
                Number(file.requester_id) === Number(user?.id));

        if (!canAccess) {
            return res.status(403).json({
                error: "Você não tem permissão para acessar este arquivo.",
            });
        }

        const filePath = path.join(uploadDirectory, file.filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                error: "O arquivo não está mais disponível no servidor.",
            });
        }

        return downloadOriginalFile(res, filePath, file.original_name);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Erro ao baixar arquivo de referência.",
        });
    }
});

app.post("/api/manager-requests/:id/remove", (req, res) => {
    try {
        const user = req.authUser;
        if (!isExternalManagerUser(user)) {
            return res.status(403).json({ error: "Somente o gerente solicitante pode excluir este pedido." });
        }

        const id = Number(req.params.id);
        const requestRow = db.prepare(`SELECT * FROM manager_requests WHERE id = ?`).get(id);
        if (!requestRow || Number(requestRow.requester_id) !== Number(user.id)) {
            return res.status(404).json({ error: "Pedido não encontrado." });
        }

        if (String(requestRow.deleted_at || "").trim()) {
            return res.status(409).json({ error: "Este pedido já está na lixeira." });
        }

        const linkedContent = requestRow.assigned_content_id
            ? db.prepare(`SELECT * FROM contents WHERE id = ?`).get(Number(requestRow.assigned_content_id))
            : null;

        const previousStatus = String(requestRow.status || "Recebido");
        const previousContentStatus = linkedContent ? String(linkedContent.status || "") : "";
        const now = new Date().toISOString();
        const hadAssignment = Boolean(Number(requestRow.assigned_content_id || 0));

        if (linkedContent) {
            db.prepare(`
                UPDATE contents
                SET status = 'Cancelado', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(linkedContent.id);
        }

        db.prepare(`
            UPDATE manager_requests
            SET status = ?,
                deleted_at = ?,
                deleted_previous_status = ?,
                deleted_content_previous_status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            hadAssignment ? "Cancelado" : previousStatus,
            now,
            previousStatus,
            previousContentStatus,
            id
        );

        db.prepare(`
            INSERT INTO manager_request_updates (request_id, author_id, message)
            VALUES (?, ?, ?)
        `).run(
            id,
            user.id,
            hadAssignment
                ? "Pedido cancelado pelo gerente solicitante. A demanda vinculada também foi cancelada."
                : "Pedido excluído pelo gerente solicitante."
        );

        res.json({
            success: true,
            mode: hadAssignment ? "cancelled" : "deleted",
            trash_expires_at: new Date(new Date(now).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao excluir/cancelar pedido." });
    }
});

app.post("/api/manager-requests/:id/restore", (req, res) => {
    try {
        const user = req.authUser;
        if (!isExternalManagerUser(user)) {
            return res.status(403).json({ error: "Somente o gerente solicitante pode restaurar este pedido." });
        }

        const id = Number(req.params.id);
        const requestRow = db.prepare(`SELECT * FROM manager_requests WHERE id = ?`).get(id);

        if (!requestRow || Number(requestRow.requester_id) !== Number(user.id)) {
            return res.status(404).json({ error: "Pedido não encontrado." });
        }

        if (!String(requestRow.deleted_at || "").trim()) {
            return res.status(409).json({ error: "Este pedido não está na lixeira." });
        }

        const deletedAt = new Date(requestRow.deleted_at);
        if (Number.isNaN(deletedAt.getTime()) || Date.now() - deletedAt.getTime() > 24 * 60 * 60 * 1000) {
            return res.status(410).json({ error: "O prazo de 24 horas para restaurar este pedido expirou." });
        }

        const restoredStatus = String(requestRow.deleted_previous_status || "Recebido");
        if (requestRow.assigned_content_id) {
            const contentStatus = String(requestRow.deleted_content_previous_status || "Ideia");
            db.prepare(`
                UPDATE contents
                SET status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(contentStatus, Number(requestRow.assigned_content_id));
        }

        db.prepare(`
            UPDATE manager_requests
            SET status = ?,
                deleted_at = '',
                deleted_previous_status = '',
                deleted_content_previous_status = '',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(restoredStatus, id);

        db.prepare(`
            INSERT INTO manager_request_updates (request_id, author_id, message)
            VALUES (?, ?, ?)
        `).run(id, user.id, "Pedido restaurado pelo gerente solicitante.");

        const row = db.prepare(`
            SELECT r.*, u.name requester_name, u.role requester_role, u.department requester_department,
                   au.name assigned_user_name, au.role assigned_user_role
            FROM manager_requests r
            JOIN users u ON u.id = r.requester_id
            LEFT JOIN users au ON au.id = r.assigned_user_id
            WHERE r.id = ?
        `).get(id);

        res.json(serializeManagerRequest(row));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao restaurar pedido." });
    }
});

app.get("/api/manager-requests/:id/updates", (req, res) => {
    try {
        const user = req.authUser;
        const requestRow = db.prepare(`SELECT * FROM manager_requests WHERE id = ?`).get(Number(req.params.id));
        if (!requestRow) return res.status(404).json({ error: "Pedido não encontrado." });
        const role = String(user?.access_role || "").toLowerCase();
        if (role !== "gerente" && !(role === "gestor_externo" && Number(requestRow.requester_id) === Number(user.id))) {
            return res.status(403).json({ error: "Sem acesso a este pedido." });
        }
        const rows = db.prepare(`
            SELECT m.*, u.name author_name, u.access_role author_access_role
            FROM manager_request_updates m JOIN users u ON u.id = m.author_id
            WHERE m.request_id = ? ORDER BY datetime(m.created_at), m.id
        `).all(requestRow.id);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Erro ao carregar atualizações." });
    }
});

app.post("/api/manager-requests/:id/updates", (req, res) => {
    try {
        const user = req.authUser;
        const requestRow = db.prepare(`SELECT * FROM manager_requests WHERE id = ?`).get(Number(req.params.id));
        if (!requestRow) return res.status(404).json({ error: "Pedido não encontrado." });
        const role = String(user?.access_role || "").toLowerCase();
        if (role !== "gerente" && !(role === "gestor_externo" && Number(requestRow.requester_id) === Number(user.id))) {
            return res.status(403).json({ error: "Sem acesso a este pedido." });
        }
        const message = String(req.body?.message || "").trim();
        if (!message) return res.status(400).json({ error: "Digite a informação." });
        const result = db.prepare(`INSERT INTO manager_request_updates (request_id, author_id, message) VALUES (?, ?, ?)`)
            .run(requestRow.id, user.id, message);

        let requestStatus = requestRow.status;
        if (role === "gestor_externo" && requestRow.status === "Revisão solicitada") {
            requestStatus = "Recebido";
            db.prepare(`
                UPDATE manager_requests
                SET status = 'Recebido', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(requestRow.id);
        } else {
            db.prepare(`UPDATE manager_requests SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(requestRow.id);
        }

        const created = db.prepare(`
            SELECT m.*, u.name author_name, u.access_role author_access_role
            FROM manager_request_updates m JOIN users u ON u.id = m.author_id WHERE m.id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json({
            ...created,
            request_status: requestStatus,
        });
    } catch (error) {
        res.status(500).json({ error: "Erro ao adicionar informação." });
    }
});


app.post("/api/manager-requests/:id/decision", (req, res) => {
    if (!requireMarketingManagerRequest(req, res)) return;

    try {
        const id = Number(req.params.id);
        const existing = db.prepare(`SELECT * FROM manager_requests WHERE id = ?`).get(id);
        if (!existing) return res.status(404).json({ error: "Pedido não encontrado." });

        const action = String(req.body?.action || "").trim().toLowerCase();
        const note = String(req.body?.note || "").trim();

        if (!["approve", "review", "reject"].includes(action)) {
            return res.status(400).json({ error: "Decisão inválida." });
        }

        if (action === "review" && !note) {
            return res.status(400).json({
                error: "Escreva o que o gerente solicitante precisa revisar.",
            });
        }

        if (["Em andamento", "Concluído"].includes(existing.status) && Number(existing.assigned_content_id || 0)) {
            return res.status(409).json({
                error: "Este pedido já foi encaminhado para o SQUAD.",
            });
        }

        let status = "Recebido";
        let managerResponse = "";
        let historyMessage = "";

        if (action === "approve") {
            status = "Aprovado";
            managerResponse = "";
            historyMessage = "✓ Pedido aprovado pelo Gerente de Marketing.";
        } else if (action === "review") {
            status = "Revisão solicitada";
            managerResponse = note;
            historyMessage = `↻ Revisão solicitada pelo Gerente de Marketing: ${note}`;
        } else {
            status = "Reprovado";
            managerResponse = "";
            historyMessage = "✕ Pedido reprovado pelo Gerente de Marketing.";
        }

        db.prepare(`
            UPDATE manager_requests
            SET status = ?, manager_response = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(status, managerResponse, id);

        db.prepare(`
            INSERT INTO manager_request_updates (request_id, author_id, message)
            VALUES (?, ?, ?)
        `).run(id, req.authUser.id, historyMessage);

        const row = db.prepare(`
            SELECT r.*, u.name requester_name, u.role requester_role, u.department requester_department,
                   au.name assigned_user_name, au.role assigned_user_role
            FROM manager_requests r
            JOIN users u ON u.id = r.requester_id
            LEFT JOIN users au ON au.id = r.assigned_user_id
            WHERE r.id = ?
        `).get(id);

        res.json(serializeManagerRequest(row));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao registrar decisão do pedido." });
    }
});

app.get("/api/manager-requests/assignment-options", (req, res) => {
    if (!requireMarketingManagerRequest(req, res)) return;
    try {
        const users = db.prepare(`
            SELECT * FROM users
            WHERE active = 1
              AND lower(trim(COALESCE(access_role, 'colaborador'))) = 'colaborador'
            ORDER BY name COLLATE NOCASE
        `).all().map(serializeUser);

        const eligible = users.filter((user) => {
            const role = String(user.role || "")
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .toLowerCase();
            return role.includes("social") || role.includes("design");
        });

        res.json(eligible);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao carregar Social Media e Designer." });
    }
});

app.post("/api/manager-requests/:id/forward", (req, res) => {
    if (!requireMarketingManagerRequest(req, res)) return;
    try {
        const id = Number(req.params.id);
        const requestRow = db.prepare(`SELECT * FROM manager_requests WHERE id = ?`).get(id);
        if (!requestRow) return res.status(404).json({ error: "Pedido não encontrado." });

        const canForward =
            requestRow.status === "Aprovado" ||
            (["Em andamento", "Concluído"].includes(requestRow.status) && Number(requestRow.assigned_content_id || 0));

        if (!canForward) {
            return res.status(409).json({
                error: "Aprove o pedido antes de encaminhá-lo para Social Media ou Designer.",
            });
        }

        const assignedUserId = Number(req.body?.user_id);
        const assignedDate = String(req.body?.date || "").trim();
        const finalDeadline = String(req.body?.deadline || "").trim();
        const urgency = String(req.body?.urgency || "").trim().toLowerCase();
        const allowedUrgencies = new Set(["verde", "amarelo", "vermelho"]);

        if (!assignedUserId) return res.status(400).json({ error: "Escolha um Social Media ou Designer." });
        if (!assignedDate) return res.status(400).json({ error: "Escolha a data de início na agenda do colaborador." });
        if (!finalDeadline) return res.status(400).json({ error: "Defina o prazo oficial de entrega." });
        if (finalDeadline < assignedDate) return res.status(400).json({ error: "O prazo oficial não pode ser anterior ao início na agenda." });
        if (!allowedUrgencies.has(urgency)) return res.status(400).json({ error: "Urgência inválida." });

        const assignedRow = getActiveUserRowById(assignedUserId);
        if (!assignedRow) return res.status(404).json({ error: "Colaborador não encontrado." });
        const assignedUser = serializeUser(assignedRow);
        const normalizedRole = String(assignedUser.role || "")
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
        const isSocial = normalizedRole.includes("social");
        const isDesigner = normalizedRole.includes("design");
        if (!isSocial && !isDesigner) {
            return res.status(400).json({ error: "O pedido só pode ser encaminhado para Social Media ou Designer." });
        }

        let contentId = Number(requestRow.assigned_content_id || 0);
        const requestChannels = parseJsonArray(requestRow.channels);
        const descriptionParts = [
            `PEDIDO DE GERENTE #${String(requestRow.id).padStart(4, "0")}`,
            requestRow.objective ? `OBJETIVO:
${requestRow.objective}` : "",
            requestRow.target_audience ? `PÚBLICO-ALVO:
${requestRow.target_audience}` : "",
            requestRow.required_info ? `INFORMAÇÕES OBRIGATÓRIAS:
${requestRow.required_info}` : "",
            requestChannels.length ? `CANAIS DE DIVULGAÇÃO:
${requestChannels.join(", ")}` : "",
            requestRow.print_dimensions ? `MEDIDAS DO MATERIAL IMPRESSO:
${requestRow.print_dimensions}` : "",
            requestRow.description ? `DETALHES / CONTEXTO:
${requestRow.description}` : "",
            `PRAZO OFICIAL DE ENTREGA:
${finalDeadline.split("-").reverse().join("/")}`,
        ];
        if (requestRow.references_text) descriptionParts.push(`Referências / Links:
${requestRow.references_text}`);
        const contentDescription = descriptionParts.filter(Boolean).join("\n\n");
        const contentFormat = isDesigner ? "Arte / Material gráfico" : (requestRow.request_type || "Conteúdo");

        if (contentId) {
            const existingContent = db.prepare(`SELECT id FROM contents WHERE id = ? AND deleted_at = ''`).get(contentId);
            if (existingContent) {
                db.prepare(`
                    UPDATE contents
                    SET user_id = ?, date = ?, brands = ?, format = ?, responsible = ?, urgency = ?,
                        reference_link = ?, description = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(
                    assignedUserId, assignedDate, JSON.stringify([requestRow.brand || "Grupo / Geral"]),
                    contentFormat, assignedUser.name, urgency, requestRow.references_text || "",
                    contentDescription, contentId
                );
            } else {
                contentId = 0;
            }
        }

        if (!contentId) {
            const result = db.prepare(`
                INSERT INTO contents (
                    user_id, title, date, brands, format, status, responsible, urgency,
                    reference_link, description, copy_text, approval_required,
                    approval_stage, idea_approval_status, approval_status,
                    published_by_user_id
                )
                VALUES (?, ?, ?, ?, ?, 'Ideia', ?, ?, ?, ?, '', 1, 'none', 'nao_enviada', 'nao_enviada', ?)
            `).run(
                assignedUserId,
                requestRow.title,
                assignedDate,
                JSON.stringify([requestRow.brand || "Grupo / Geral"]),
                contentFormat,
                assignedUser.name,
                urgency,
                requestRow.references_text || "",
                contentDescription,
                assignedUserId
            );
            contentId = Number(result.lastInsertRowid);
        }

        const forwardedReferenceCount =
            copyManagerRequestReferencesToContent(id, contentId);

        let linkedCreativeJob = null;

        if (isDesigner) {
            linkedCreativeJob =
                ensureCreativeJobForManagerRequest(
                    {
                        ...requestRow,
                        assigned_user_id: assignedUserId,
                        assigned_content_id: contentId,
                        assigned_date: assignedDate,
                        final_deadline: finalDeadline,
                    },
                    assignedUser,
                    contentId,
                    finalDeadline
                );
        }

        const now = new Date().toISOString();
        const deadlineSetAt =
            !requestRow.final_deadline_set_at || requestRow.final_deadline !== finalDeadline
                ? now
                : requestRow.final_deadline_set_at;
        db.prepare(`
            UPDATE manager_requests
            SET assigned_user_id = ?, assigned_date = ?, assigned_urgency = ?,
                assigned_content_id = ?, assigned_at = ?, final_deadline = ?,
                final_deadline_set_at = ?, status = 'Em andamento',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            assignedUserId,
            assignedDate,
            urgency,
            contentId,
            now,
            finalDeadline,
            deadlineSetAt,
            id
        );

        db.prepare(`
            INSERT INTO manager_request_updates (request_id, author_id, message)
            VALUES (?, ?, ?)
        `).run(
            id,
            req.authUser.id,
            `Pedido encaminhado para ${assignedUser.name} (${isDesigner ? "Designer" : "Social Media"}) • início na agenda ${assignedDate.split("-").reverse().join("/")} • prazo oficial ${finalDeadline.split("-").reverse().join("/")} • urgência ${urgency}.${forwardedReferenceCount ? ` ${forwardedReferenceCount} arquivo(s) de referência enviado(s) junto com a demanda.` : ""}${linkedCreativeJob ? " Produção criada/vinculada automaticamente na Central Criativa do Designer." : ""}`
        );

        const row = db.prepare(`
            SELECT r.*, u.name requester_name, u.role requester_role, u.department requester_department,
                   au.name assigned_user_name, au.role assigned_user_role
            FROM manager_requests r
            JOIN users u ON u.id = r.requester_id
            LEFT JOIN users au ON au.id = r.assigned_user_id
            WHERE r.id = ?
        `).get(id);

        res.status(201).json({
            request: serializeManagerRequest(row),
            content: getContent(contentId),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao encaminhar pedido para o SQUAD." });
    }
});

app.post("/api/manager-requests/by-content/:contentId/finish", (req, res) => {
    try {
        const contentId = Number(req.params.contentId);
        const user = req.authUser;
        const userId = Number(user?.id);

        if (!userId) {
            return res.status(401).json({
                error: "Entre novamente no SQUAD.",
            });
        }

        const content = db
            .prepare(`
                SELECT *
                FROM contents
                WHERE id = ?
                  AND TRIM(COALESCE(deleted_at, '')) = ''
            `)
            .get(contentId);

        if (!content) {
            return res.status(404).json({
                error: "Demanda não encontrada.",
            });
        }

        const requestRow = db
            .prepare(`
                SELECT *
                FROM manager_requests
                WHERE assigned_content_id = ?
                  AND TRIM(COALESCE(deleted_at, '')) = ''
                ORDER BY id DESC
                LIMIT 1
            `)
            .get(contentId);

        if (!requestRow) {
            return res.status(404).json({
                error: "Esta demanda não está vinculada a um pedido de gestor.",
            });
        }

        if (
            Number(content.user_id) !== userId ||
            Number(requestRow.assigned_user_id) !== userId
        ) {
            return res.status(403).json({
                error: "Somente o Social Media ou Designer responsável pode finalizar esta demanda.",
            });
        }

        if (requestRow.status === "Concluído") {
            return res.json({
                request: serializeManagerRequest(
                    db.prepare(`
                        SELECT r.*, u.name requester_name, u.role requester_role,
                               u.department requester_department,
                               au.name assigned_user_name, au.role assigned_user_role
                        FROM manager_requests r
                        JOIN users u ON u.id = r.requester_id
                        LEFT JOIN users au ON au.id = r.assigned_user_id
                        WHERE r.id = ?
                    `).get(requestRow.id)
                ),
                content: getContent(contentId),
            });
        }

        if (
            Number(content.approval_required ?? 1) !== 0 &&
            content.approval_status !== "aprovado" &&
            !Boolean(Number(content.is_live || 0))
        ) {
            return res.status(409).json({
                error: "O material precisa passar pela aprovação final antes de ser finalizado.",
            });
        }

        const nowIso = new Date().toISOString();

        const transaction = db.transaction(() => {
            db.prepare(`
                UPDATE manager_requests
                SET status = 'Concluído',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(requestRow.id);

            if (!Boolean(Number(content.is_live || 0))) {
                db.prepare(`
                    UPDATE contents
                    SET status = 'Finalizado',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(contentId);
            }

            db.prepare(`
                INSERT INTO manager_request_updates (
                    request_id, author_id, message
                )
                VALUES (?, ?, ?)
            `).run(
                requestRow.id,
                userId,
                `✓ Demanda finalizada por ${user.nickname || user.name || "responsável do SQUAD"}.`
            );
        });

        transaction();

        const row = db.prepare(`
            SELECT r.*, u.name requester_name, u.role requester_role,
                   u.department requester_department,
                   au.name assigned_user_name, au.role assigned_user_role
            FROM manager_requests r
            JOIN users u ON u.id = r.requester_id
            LEFT JOIN users au ON au.id = r.assigned_user_id
            WHERE r.id = ?
        `).get(requestRow.id);

        res.json({
            request: serializeManagerRequest(row),
            content: getContent(contentId),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Erro ao finalizar demanda vinculada ao pedido.",
        });
    }
});

app.put("/api/manager-requests/:id", (req, res) => {
    if (!requireMarketingManagerRequest(req, res)) return;
    try {
        const id = Number(req.params.id);
        const existing = db.prepare(`SELECT * FROM manager_requests WHERE id = ?`).get(id);
        if (!existing) return res.status(404).json({ error: "Pedido não encontrado." });
        const allowed = new Set(["Aprovado", "Em andamento"]);
        const status = String(req.body?.status || existing.status).trim();
        if (!allowed.has(status)) return res.status(400).json({ error: "Status inválido." });
        const response = String(req.body?.manager_response ?? existing.manager_response ?? "").trim();
        db.prepare(`UPDATE manager_requests SET status = ?, manager_response = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(status, response, id);
        const row = db.prepare(`
            SELECT r.*, u.name requester_name, u.role requester_role, u.department requester_department,
                   au.name assigned_user_name, au.role assigned_user_role
            FROM manager_requests r
            JOIN users u ON u.id = r.requester_id
            LEFT JOIN users au ON au.id = r.assigned_user_id
            WHERE r.id = ?
        `).get(id);
        res.json(serializeManagerRequest(row));
    } catch (error) {
        res.status(500).json({ error: "Erro ao atualizar pedido." });
    }
});

app.post("/api/auth/logout", (req, res) => {
    if (req.userSession?.id) {
        db.prepare(`DELETE FROM auth_sessions WHERE id = ?`).run(req.userSession.id);
    }
    res.json({ success: true });
});

app.post("/api/auth/change-password", (req, res) => {
    try {
        if (!req.userSession?.user_id) {
            return res.status(401).json({ error: "Entre novamente para alterar a senha." });
        }

        const user = getActiveUserRowById(req.userSession.user_id);
        const currentPassword = normalizePassword(req.body?.current_password);
        const newPassword = normalizePassword(req.body?.new_password);
        const confirmPassword = normalizePassword(req.body?.confirm_password);

        if (!user || !verifyUserPassword(user, currentPassword)) {
            return res.status(401).json({ error: "Senha atual incorreta." });
        }

        const passwordError = validateNewPassword(newPassword);
        if (passwordError) return res.status(400).json({ error: passwordError });
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: "As novas senhas não conferem." });
        }
        if (verifyUserPassword(user, newPassword)) {
            return res.status(400).json({ error: "Escolha uma senha diferente da atual." });
        }

        updateUserPassword(user.id, newPassword);
        db.prepare(`DELETE FROM auth_sessions WHERE user_id = ? AND id <> ?`).run(
            user.id,
            req.userSession.id
        );

        res.json({ success: true, user: getUserById(user.id) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao alterar a senha." });
    }
});

app.post("/api/admin/logout", (req, res) => {
    if (!requireAdminRequest(req, res)) return;
    if (req.adminSession?.id) {
        db.prepare(`DELETE FROM auth_sessions WHERE id = ?`).run(req.adminSession.id);
    }
    res.json({ success: true });
});

app.get("/api/admin/history", (req, res) => {
    if (!requireAdminRequest(req, res)) return;
    try {
        const rows = db.prepare(`
            SELECT *
            FROM admin_audit_log
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT 250
        `).all();
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao carregar o histórico administrativo." });
    }
});

app.post("/api/admin/users/:id/impersonate", (req, res) => {
    if (!requireAdminRequest(req, res)) return;
    try {
        const user = getActiveUserRowById(Number(req.params.id));
        if (!user) {
            return res.status(404).json({ error: "Usuário ativo não encontrado." });
        }

        const session = createAuthSession({
            userId: user.id,
            sessionType: "user",
            hours: 8,
        });

        auditAdmin(
            "acessar_como_usuario",
            user,
            "Acesso de suporte iniciado pela Área ADM"
        );

        res.json({
            success: true,
            token: session.token,
            expires_at: session.expires_at,
            user: serializeUser(user),
            impersonated: true,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao acessar a conta do usuário." });
    }
});

app.post("/api/admin/impersonation-stop", (req, res) => {
    if (!requireAdminRequest(req, res)) return;
    try {
        const userId = Number(req.body?.user_id);
        const user = userId
            ? db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId)
            : null;
        auditAdmin(
            "encerrar_acesso_usuario",
            user || null,
            "Acesso de suporte encerrado e retorno à Área ADM"
        );
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao encerrar o acesso de suporte." });
    }
});

app.post("/api/admin/users/:id/reset-password", (req, res) => {
    if (!requireAdminRequest(req, res)) return;
    try {
        const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(Number(req.params.id));
        if (!user) return res.status(404).json({ error: "Colaborador não encontrado." });
        clearUserPassword(user.id);
        auditAdmin("reset_senha", user, "Senha redefinida para primeiro acesso");
        res.json({ success: true, user: getUserById(user.id) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao redefinir a senha." });
    }
});

app.post("/api/admin/users/:id/reactivate", (req, res) => {
    if (!requireAdminRequest(req, res)) return;
    try {
        const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(Number(req.params.id));
        if (!user) return res.status(404).json({ error: "Colaborador não encontrado." });

        if (String(user.access_role || "").toLowerCase() === "gerente") {
            const otherManager = db.prepare(`
                SELECT id, name FROM users
                WHERE active = 1 AND access_role = 'gerente' AND id <> ?
                LIMIT 1
            `).get(user.id);
            if (otherManager) {
                return res.status(409).json({ error: `Já existe um gerente ativo: ${otherManager.name}.` });
            }
        }

        db.prepare(`UPDATE users SET active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(user.id);
        auditAdmin("reativar_usuario", user, "Perfil reativado");
        res.json({ success: true, user: getUserById(user.id) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao reativar colaborador." });
    }
});

app.get("/api/meta/status", (req, res) => {
    res.json({
        configured: false,
        metrics_mode: "manual",
        message: "Métricas manuais ativas. O link da publicação é opcional.",
    });
});

app.post("/api/admin/verify", (req, res) => {
    if (!requireAdminRequest(req, res)) return;
    res.json({ success: true });
});

app.get("/api/users", (req, res) => {
    try {
        const includeInactive = String(req.query.include_inactive || "") === "1";
        if (includeInactive && !requireAdminRequest(req, res)) return;
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
    if (!requireAdminRequest(req, res)) return;
    try {
        const name = String(req.body?.name || "").trim();
        const requestedRole = String(req.body?.access_role || "colaborador").toLowerCase();
        let accessRole = requestedRole === "gerente"
            ? "gerente"
            : requestedRole === "gestor_externo"
                ? "gestor_externo"
                : "colaborador";
        const role = String(req.body?.role || "").trim();
        const department = String(req.body?.department || "").trim();
        const requestedBrands = Array.isArray(req.body?.brands)
            ? req.body.brands.map((item) => String(item || "").trim()).filter(Boolean)
            : [];
        const allowedExternalManagerBrands = new Set([
            "Jeep", "RAM", "Kia", "Honda", "Premier Seminovos",
            "Shineray", "YADEA", "Grupo / Geral"
        ]);
        const assignedBrands = accessRole === "gestor_externo"
            ? requestedBrands.slice(0, 1)
            : [];

        if (!name) {
            return res.status(400).json({ error: "Digite o nome do colaborador." });
        }

        if (accessRole === "gestor_externo") {
            if (assignedBrands.length !== 1 || !allowedExternalManagerBrands.has(assignedBrands[0])) {
                return res.status(400).json({
                    error: "Selecione a marca do gerente antes de criar o perfil.",
                });
            }
        }

        if (accessRole === "gerente") {
            const activeManager = db
                .prepare(`
                    SELECT id, name
                    FROM users
                    WHERE active = 1
                      AND access_role = 'gerente'
                    LIMIT 1
                `)
                .get();

            if (activeManager && activeManager.name.toLowerCase() !== name.toLowerCase()) {
                return res.status(409).json({
                    error: `Já existe um gerente ativo: ${activeManager.name}.`,
                });
            }
        }

        const existing = db
            .prepare(`SELECT * FROM users WHERE LOWER(name) = LOWER(?)`)
            .get(name);

        if (existing) {
            if (existing.active === 0) {
                db.prepare(`
                    UPDATE users
                    SET active = 1,
                        access_role = ?,
                        role = ?,
                        department = ?,
                        brands = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(accessRole, role, department, JSON.stringify(assignedBrands), existing.id);
                const reactivated = db.prepare(`SELECT * FROM users WHERE id = ?`).get(existing.id);
                auditAdmin("reativar_usuario", reactivated, `Tipo de acesso: ${accessRole}`);

                return res.status(201).json(getUserById(existing.id));
            }

            return res.status(409).json({ error: "Esse colaborador já existe." });
        }

        const result = db
            .prepare(`
                INSERT INTO users (name, active, access_role, role, department, brands)
                VALUES (?, 1, ?, ?, ?, ?)
            `)
            .run(name, accessRole, role, department, JSON.stringify(assignedBrands));

        const createdUser = db.prepare(`SELECT * FROM users WHERE id = ?`).get(result.lastInsertRowid);
        auditAdmin("criar_usuario", createdUser, `Tipo de acesso: ${accessRole}`);
        res.status(201).json(getUserById(result.lastInsertRowid));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao criar colaborador." });
    }
});

app.put("/api/admin/users/:id", (req, res) => {
    if (!requireAdminRequest(req, res)) return;
    try {
        const id = Number(req.params.id);
        const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
        if (!existing) return res.status(404).json({ error: "Usuário não encontrado." });
        const name = String(req.body?.name ?? existing.name).trim();
        const role = String(req.body?.role ?? existing.role ?? "").trim();
        const department = String(req.body?.department ?? existing.department ?? "").trim();
        const accessRole = String(existing.access_role || "colaborador").toLowerCase();
        const allowed = new Set(["Jeep","RAM","Kia","Honda","Premier Seminovos","Shineray","YADEA","Grupo / Geral"]);
        const requested = Array.isArray(req.body?.brands) ? [...new Set(req.body.brands.map((x)=>String(x || "").trim()).filter(Boolean))] : parseJsonArray(existing.brands);
        const brands = accessRole === "gestor_externo" ? requested.filter((x)=>allowed.has(x)) : parseJsonArray(existing.brands);
        if (!name) return res.status(400).json({ error: "Nome obrigatório." });
        if (accessRole === "gestor_externo" && !brands.length) return res.status(400).json({ error: "Selecione pelo menos uma marca para este gerente." });
        const duplicate = db.prepare(`SELECT id FROM users WHERE LOWER(name)=LOWER(?) AND id<>?`).get(name,id);
        if (duplicate) return res.status(409).json({ error: "Já existe outro usuário com esse nome." });
        db.prepare(`UPDATE users SET name=?, role=?, department=?, brands=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(name,role,department,JSON.stringify(brands),id);
        const updated=db.prepare(`SELECT * FROM users WHERE id=?`).get(id);
        auditAdmin("editar_usuario",updated,accessRole==="gestor_externo" ? `Marcas autorizadas: ${brands.join(", ")}` : "Dados atualizados");
        res.json(getUserById(id));
    } catch(error) { console.error(error); res.status(500).json({ error:"Erro ao editar usuário." }); }
});

app.put("/api/users/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
        if (!existing) return res.status(404).json({ error: "Colaborador não encontrado." });
        if (!canEditUser(req, id)) {
            return res.status(403).json({ error: "Você só pode editar o próprio perfil." });
        }

        const name = String(req.body?.name ?? existing.name).trim();
        const nickname = String(req.body?.nickname ?? existing.nickname ?? "").trim();
        const role = String(req.body?.role ?? existing.role ?? "").trim();
        const requestedBrands = Array.isArray(req.body?.brands) ? req.body.brands : parseJsonArray(existing.brands);
        const brands = String(existing.access_role || "").toLowerCase() === "gestor_externo" && !req.adminSession ? parseJsonArray(existing.brands) : requestedBrands;

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
        if (!canEditUser(req, id)) {
            if (req.file) removeProfilePhysicalFile(req.file.filename);
            return res.status(403).json({ error: "Você só pode editar o próprio perfil." });
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
        if (!canEditUser(req, id)) {
            return res.status(403).json({ error: "Você só pode editar o próprio perfil." });
        }

        db.prepare(`UPDATE users SET photo_filename = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
        if (existing.photo_filename) removeProfilePhysicalFile(existing.photo_filename);
        res.json(getUserById(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao remover foto." });
    }
});

app.delete("/api/users/:id", (req, res) => {
    if (!requireAdminRequest(req, res)) return;
    try {
        const id = Number(req.params.id);
        const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
        if (!user) return res.status(404).json({ error: "Colaborador não encontrado." });

        db.prepare(`UPDATE users SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
        db.prepare(`DELETE FROM auth_sessions WHERE user_id = ?`).run(id);
        auditAdmin("desativar_usuario", user, "Perfil desativado; histórico preservado");
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


app.get("/api/performance/month-overview", (req, res) => {
    try {
        const userId = Number(req.query.user_id);
        const authenticatedUserId = Number(req.authUser?.id || 0);

        if (!userId || !authenticatedUserId) {
            return res.status(400).json({ error: "Usuário inválido." });
        }

        if (userId !== authenticatedUserId) {
            return res.status(403).json({
                error: "Este resumo é individual e só pode ser visto pelo próprio colaborador.",
            });
        }

        const user = getActiveUserRowById(userId);
        if (!user) {
            return res.status(404).json({ error: "Colaborador não encontrado." });
        }

        if (String(user.access_role || "").toLowerCase() !== "colaborador") {
            return res.status(403).json({
                error: "Este painel é exclusivo dos colaboradores do SQUAD.",
            });
        }

        const now = new Date();
        const year = Number(req.query.year || now.getFullYear());
        const month = Number(req.query.month || now.getMonth() + 1);

        if (!year || month < 1 || month > 12) {
            return res.status(400).json({ error: "Período inválido." });
        }

        const monthStart = `${year}-${pad2(month)}-01`;
        const daysInMonth = new Date(year, month, 0).getDate();
        const monthEnd = `${year}-${pad2(month)}-${pad2(daysInMonth)}`;

        const previous = previousMonth(year, month);
        const previousDays = new Date(previous.year, previous.month, 0).getDate();
        const previousStart = `${previous.year}-${pad2(previous.month)}-01`;
        const previousEnd = `${previous.year}-${pad2(previous.month)}-${pad2(previousDays)}`;

        const roleType = summaryUserType(user);
        const current =
            roleType === "design"
                ? designSummaryForPeriod(userId, monthStart, monthEnd)
                : contentSummaryForPeriod(userId, monthStart, monthEnd);
        const previousSummary =
            roleType === "design"
                ? designSummaryForPeriod(userId, previousStart, previousEnd)
                : contentSummaryForPeriod(userId, previousStart, previousEnd);

        const monthNames = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];

        const isCurrentMonth =
            year === now.getFullYear() &&
            month === now.getMonth() + 1;

        const elapsedDays = isCurrentMonth
            ? Math.max(1, Math.min(daysInMonth, now.getDate()))
            : daysInMonth;

        function percentDelta(value, previousValue) {
            const currentValue = Number(value || 0);
            const oldValue = Number(previousValue || 0);
            if (oldValue === 0) return currentValue > 0 ? 100 : 0;
            return Number((((currentValue - oldValue) / oldValue) * 100).toFixed(1));
        }

        function groupRows(rows, keyFn, valueFn = () => 1) {
            const map = new Map();

            rows.forEach((row) => {
                const keys = keyFn(row);
                const list = Array.isArray(keys) ? keys : [keys];

                list.filter(Boolean).forEach((key) => {
                    const name = String(key || "Não informado").trim() || "Não informado";
                    map.set(name, Number(map.get(name) || 0) + Number(valueFn(row) || 0));
                });
            });

            const total = [...map.values()].reduce((sum, value) => sum + value, 0);

            return [...map.entries()]
                .map(([name, value]) => ({
                    name,
                    value,
                    share: total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0,
                }))
                .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR"));
        }

        function weekRanges() {
            return [
                { start: 1, end: Math.min(7, daysInMonth) },
                { start: 8, end: Math.min(14, daysInMonth) },
                { start: 15, end: Math.min(21, daysInMonth) },
                { start: 22, end: daysInMonth },
            ];
        }

        function weekdayName(index) {
            return [
                "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
                "Quinta-feira", "Sexta-feira", "Sábado"
            ][index] || "—";
        }

        if (roleType === "design") {
            const jobs = db.prepare(`
                SELECT *
                FROM creative_jobs
                WHERE creator_user_id = ?
                  AND TRIM(COALESCE(approved_at, '')) <> ''
            `).all(userId).filter((item) => {
                const key = isoLocalDateKey(item.approved_at);
                return key >= monthStart && key <= monthEnd;
            });

            const weekly = weekRanges().map((range, index) => {
                const weekJobs = jobs.filter((item) => {
                    const key = isoLocalDateKey(item.approved_at);
                    const day = Number(key.slice(8, 10));
                    return day >= range.start && day <= range.end;
                });

                return {
                    label: `Semana ${index + 1}`,
                    short_label: `SEM ${index + 1}`,
                    period: `${pad2(range.start)}–${pad2(range.end)}`,
                    demands: weekJobs.length,
                    pieces: weekJobs.reduce(
                        (total, item) => total + Math.max(1, Number(item.quantity || 1)),
                        0
                    ),
                };
            });

            const byBrand = groupRows(
                jobs,
                (item) => item.brand || "Sem marca",
                (item) => Math.max(1, Number(item.quantity || 1))
            );

            const byType = groupRows(
                jobs,
                (item) => item.creative_type || "Outro",
                (item) => Math.max(1, Number(item.quantity || 1))
            );

            const projectedPieces = isCurrentMonth
                ? Math.round((Number(current.pieces || 0) / elapsedDays) * daysInMonth)
                : Number(current.pieces || 0);

            const topJobs = jobs
                .slice()
                .sort(
                    (a, b) =>
                        Number(b.quantity || 1) - Number(a.quantity || 1) ||
                        Number(b.id) - Number(a.id)
                )
                .slice(0, 3)
                .map((item) => ({
                    id: Number(item.id),
                    title: item.title || "Demanda",
                    brand: item.brand || "Sem marca",
                    type: item.creative_type || "Outro",
                    date: isoLocalDateKey(item.approved_at),
                    value: Math.max(1, Number(item.quantity || 1)),
                    value_label: "peças",
                }));

            const dateCounts = new Map();
            jobs.forEach((item) => {
                const key = isoLocalDateKey(item.approved_at);
                dateCounts.set(key, Number(dateCounts.get(key) || 0) + Math.max(1, Number(item.quantity || 1)));
            });

            const bestDay = [...dateCounts.entries()]
                .sort((a, b) => b[1] - a[1])[0] || null;

            const approvedDates = jobs
                .map((item) => new Date(item.approved_at).getTime())
                .filter(Number.isFinite)
                .sort((a, b) => a - b);

            const gaps = approvedDates.slice(1).map((value, index) =>
                Math.max(0, (value - approvedDates[index]) / (24 * 60 * 60 * 1000))
            );

            const avgGap = gaps.length
                ? Number((gaps.reduce((sum, value) => sum + value, 0) / gaps.length).toFixed(1))
                : 0;

            return res.json({
                role_type: "design",
                role_label: "Design",
                period: { year, month },
                period_label: `${monthNames[month - 1]} ${year}`,
                is_current_month: isCurrentMonth,
                summary: current,
                comparison: {
                    pieces: percentDelta(current.pieces, previousSummary.pieces),
                    demands: percentDelta(current.demands, previousSummary.demands),
                    brands: percentDelta(current.brands, previousSummary.brands),
                },
                rhythm: {
                    elapsed_days: elapsedDays,
                    days_in_month: daysInMonth,
                    projected: projectedPieces,
                    projected_label: "peças",
                },
                weekly,
                by_brand: byBrand,
                by_type: byType,
                top_results: topJobs,
                highlight: current.biggest_demand
                    ? {
                          title: current.biggest_demand.title,
                          value: current.biggest_demand.pieces,
                          value_label: "peças",
                          eyebrow: "MAIOR DEMANDA DO MÊS",
                      }
                    : null,
                productivity: {
                    average_per_week: Number((Number(current.pieces || 0) / 4).toFixed(1)),
                    average_gap_days: avgGap,
                    best_day: bestDay
                        ? new Date(`${bestDay[0]}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" })
                        : "—",
                    best_day_value: bestDay ? bestDay[1] : 0,
                    best_type: byType[0]?.name || "—",
                    best_type_share: byType[0]?.share || 0,
                },
            });
        }

        const contents = db.prepare(`
            SELECT *
            FROM contents
            WHERE user_id = ?
              AND COALESCE(is_live, 0) = 1
              AND TRIM(COALESCE(published_at, '')) <> ''
              AND TRIM(COALESCE(deleted_at, '')) = ''
        `).all(userId).filter((item) => {
            const key = isoLocalDateKey(item.published_at);
            return key >= monthStart && key <= monthEnd;
        });

        const weekly = weekRanges().map((range, index) => {
            const weekItems = contents.filter((item) => {
                const key = isoLocalDateKey(item.published_at);
                const day = Number(key.slice(8, 10));
                return day >= range.start && day <= range.end;
            });

            const metricItems = weekItems.filter((item) => !isStoriesFormat(item.format));

            return {
                label: `Semana ${index + 1}`,
                short_label: `SEM ${index + 1}`,
                period: `${pad2(range.start)}–${pad2(range.end)}`,
                contents: weekItems.length,
                views: metricItems.reduce(
                    (total, item) => total + normalizeInteger(item.metric_views),
                    0
                ),
            };
        });

        const byBrand = groupRows(
            contents,
            (item) => {
                const brands = parseJsonArray(item.brands);
                return brands.length ? brands : ["Sem marca"];
            }
        );

        const byFormat = groupRows(
            contents,
            (item) => item.format || "Outro"
        );

        const projectedContents = isCurrentMonth
            ? Math.round((Number(current.contents || 0) / elapsedDays) * daysInMonth)
            : Number(current.contents || 0);

        const metricContents = contents.filter((item) => !isStoriesFormat(item.format));

        const topResults = metricContents
            .slice()
            .sort(
                (a, b) =>
                    normalizeInteger(b.metric_views) - normalizeInteger(a.metric_views) ||
                    Number(b.id) - Number(a.id)
            )
            .slice(0, 3)
            .map((item) => {
                const brands = parseJsonArray(item.brands);
                return {
                    id: Number(item.id),
                    title: item.title || "Conteúdo",
                    brand: brands[0] || "Sem marca",
                    format: item.format || "Conteúdo",
                    date: isoLocalDateKey(item.published_at),
                    views: normalizeInteger(item.metric_views),
                    likes: normalizeInteger(item.metric_likes),
                    shares: normalizeInteger(item.metric_shares),
                    comments: normalizeInteger(item.metric_comments),
                };
            });

        const dateCounts = new Map();
        contents.forEach((item) => {
            const key = isoLocalDateKey(item.published_at);
            dateCounts.set(key, Number(dateCounts.get(key) || 0) + 1);
        });

        const bestDayEntry = [...dateCounts.entries()]
            .sort((a, b) => b[1] - a[1])[0] || null;

        const publishDates = contents
            .map((item) => new Date(item.published_at).getTime())
            .filter(Number.isFinite)
            .sort((a, b) => a - b);

        const gaps = publishDates.slice(1).map((value, index) =>
            Math.max(0, (value - publishDates[index]) / (24 * 60 * 60 * 1000))
        );

        const avgGap = gaps.length
            ? Number((gaps.reduce((sum, value) => sum + value, 0) / gaps.length).toFixed(1))
            : 0;

        const best = topResults[0] || null;

        res.json({
            role_type: "social",
            role_label: "Social Media",
            period: { year, month },
            period_label: `${monthNames[month - 1]} ${year}`,
            is_current_month: isCurrentMonth,
            summary: current,
            comparison: {
                contents: percentDelta(current.contents, previousSummary.contents),
                views: percentDelta(current.views, previousSummary.views),
                likes: percentDelta(current.likes, previousSummary.likes),
                shares: percentDelta(current.shares, previousSummary.shares),
            },
            rhythm: {
                elapsed_days: elapsedDays,
                days_in_month: daysInMonth,
                projected: projectedContents,
                projected_label: "conteúdos",
            },
            weekly,
            by_brand: byBrand,
            by_format: byFormat,
            top_results: topResults,
            highlight: best
                ? {
                      title: best.title,
                      brand: best.brand,
                      format: best.format,
                      date: best.date,
                      value: best.views,
                      value_label: "visualizações",
                      likes: best.likes,
                      shares: best.shares,
                      comments: best.comments,
                      eyebrow: "DESTAQUE DO MÊS",
                  }
                : null,
            productivity: {
                average_per_week: Number((Number(current.contents || 0) / 4).toFixed(1)),
                average_gap_days: avgGap,
                best_day: bestDayEntry
                    ? new Date(`${bestDayEntry[0]}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" })
                    : "—",
                best_day_value: bestDayEntry ? bestDayEntry[1] : 0,
                best_format: byFormat[0]?.name || "—",
                best_format_share: byFormat[0]?.share || 0,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao carregar o resumo mensal do colaborador." });
    }
});
app.get("/api/performance-summaries", (req, res) => {
    try {
        const userId = Number(req.query.user_id);
        const row = getActiveUserRowById(userId);

        if (!userId || !row) {
            return res.status(400).json({
                error:
                    "Usuário inválido para carregar o desempenho.",
            });
        }

        const user = serializeUser(row);

        if (isManagerUserId(user.id)) {
            return res.status(403).json({
                error:
                    "O histórico de desempenho é individual do colaborador.",
            });
        }

        res.json({
            user_id: user.id,
            role_type: summaryUserType(user),
            ...getPerformanceSummaries(user.id, 18),
        });
    } catch (error) {
        console.error("Meu desempenho:", error);
        res.status(500).json({
            error:
                "Erro ao carregar o histórico de desempenho.",
        });
    }
});

app.get("/api/achievements", (req, res) => {
    try {
        const userId = Number(req.query.user_id);
        const row = getActiveUserRowById(userId);

        if (!userId || !row) {
            return res.status(400).json({
                error:
                    "Usuário inválido para carregar conquistas.",
            });
        }

        const user = serializeUser(row);

        if (isManagerUserId(user.id)) {
            return res.status(403).json({
                error:
                    "Conquistas são individuais para Social Media e Design.",
            });
        }

        res.json(
            achievementsPayloadForUser(user)
        );
    } catch (error) {
        console.error("Conquistas:", error);
        res.status(500).json({
            error:
                "Erro ao carregar as conquistas do SQUAD.",
        });
    }
});

app.get("/api/chat", (req, res) => {
    try {
        const userId = Number(req.query.user_id);

        if (!userId || !getActiveUserRowById(userId)) {
            return res.status(400).json({
                error: "Usuário inválido para o Chat.",
            });
        }

        if (String(req.query.mark_read || "") === "1") {
            markChatRead(userId);
        }

        const rows = db
            .prepare(`
                SELECT *
                FROM chat_messages
                ORDER BY id DESC
                LIMIT 200
            `)
            .all()
            .reverse()
            .map(serializeChatMessage);

        res.json({
            messages: rows,
            unread_count: getChatUnreadCount(userId),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Erro ao carregar o Chat do SQUAD.",
        });
    }
});

app.post("/api/chat/messages", (req, res) => {
    try {
        const userId = Number(req.body?.user_id);
        const message = String(req.body?.message || "").trim();

        if (!userId || !getActiveUserRowById(userId)) {
            return res.status(400).json({
                error: "Usuário inválido.",
            });
        }

        if (!message) {
            return res.status(400).json({
                error: "Digite uma mensagem.",
            });
        }

        if (message.length > 2000) {
            return res.status(400).json({
                error: "A mensagem pode ter no máximo 2.000 caracteres.",
            });
        }

        const result = db.prepare(`
            INSERT INTO chat_messages (
                sender_user_id,
                message,
                created_at
            )
            VALUES (?, ?, ?)
        `).run(
            userId,
            message,
            new Date().toISOString()
        );

        markChatRead(userId);

        res.status(201).json(
            serializeChatMessage(
                db.prepare(`
                    SELECT *
                    FROM chat_messages
                    WHERE id = ?
                `).get(Number(result.lastInsertRowid))
            )
        );
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Erro ao enviar mensagem.",
        });
    }
});

app.post("/api/chat/read", (req, res) => {
    try {
        const userId = Number(req.body?.user_id);

        if (!userId || !getActiveUserRowById(userId)) {
            return res.status(400).json({
                error: "Usuário inválido.",
            });
        }

        markChatRead(userId);

        res.json({
            ok: true,
            unread_count: 0,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Erro ao atualizar leitura do Chat.",
        });
    }
});

app.get("/api/notifications", (req, res) => {
    try {
        const userId = Number(req.query.user_id);

        if (!userId) {
            return res.status(400).json({
                error: "Informe o usuário.",
            });
        }

        const user = getActiveUserRowById(userId);

        if (!user) {
            return res.status(404).json({
                error: "Usuário não encontrado.",
            });
        }

        purgeExpiredNotifications();

        const items = db
            .prepare(`
                SELECT *
                FROM notifications
                WHERE user_id = ?
                ORDER BY datetime(created_at) DESC, id DESC
                LIMIT 100
            `)
            .all(userId);

        res.json({
            items,
            ...notificationCounts(userId),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Erro ao carregar notificações.",
        });
    }
});

app.post("/api/notifications/:id/read", (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.body?.user_id);

        if (!id || !userId) {
            return res.status(400).json({
                error: "Dados inválidos.",
            });
        }

        db.prepare(`
            UPDATE notifications
            SET read_at = CASE
                WHEN TRIM(COALESCE(read_at, '')) = ''
                    THEN ?
                ELSE read_at
            END
            WHERE id = ?
              AND user_id = ?
        `).run(new Date().toISOString(), id, userId);

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Erro ao marcar notificação como lida.",
        });
    }
});

app.post("/api/notifications/entity/read", (req, res) => {
    try {
        const userId = Number(req.body?.user_id);
        const entityType = String(req.body?.entity_type || "");
        const entityId = Number(req.body?.entity_id);

        if (!userId || !entityId || !["content", "creative"].includes(entityType)) {
            return res.status(400).json({
                error: "Dados da notificação inválidos.",
            });
        }

        db.prepare(`
            UPDATE notifications
            SET read_at = ?
            WHERE user_id = ?
              AND entity_type = ?
              AND entity_id = ?
              AND TRIM(COALESCE(read_at, '')) = ''
        `).run(
            new Date().toISOString(),
            userId,
            entityType,
            entityId
        );

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Erro ao atualizar notificações.",
        });
    }
});

app.post("/api/notifications/read-all", (req, res) => {
    try {
        const userId = Number(req.body?.user_id);
        const category = String(req.body?.category || "");

        if (!userId) {
            return res.status(400).json({
                error: "Informe o usuário.",
            });
        }

        const now = new Date().toISOString();

        if (["social", "design"].includes(category)) {
            db.prepare(`
                UPDATE notifications
                SET read_at = ?
                WHERE user_id = ?
                  AND category = ?
                  AND TRIM(COALESCE(read_at, '')) = ''
            `).run(now, userId, category);
        } else {
            db.prepare(`
                UPDATE notifications
                SET read_at = ?
                WHERE user_id = ?
                  AND TRIM(COALESCE(read_at, '')) = ''
            `).run(now, userId);
        }

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Erro ao marcar notificações como lidas.",
        });
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
            approval_required,
        } = req.body || {};

        if (!user_id) return res.status(400).json({ error: "Usuário obrigatório." });
        if (!String(title || "").trim()) return res.status(400).json({ error: "Título obrigatório." });
        if (!date) return res.status(400).json({ error: "Data obrigatória." });
        if (!Array.isArray(brands) || brands.length === 0) {
            return res.status(400).json({ error: "Selecione uma marca." });
        }

        const approvalRequired =
            approval_required === undefined
                ? true
                : Boolean(approval_required);

        const bypassedAt = approvalRequired
            ? ""
            : new Date().toISOString();

        const result = db
            .prepare(`
                INSERT INTO contents (
                    user_id, title, date, brands, format, status, responsible, urgency,
                    reference_link, description, copy_text,
                    approval_required, approval_bypassed_at,
                    approval_bypassed_by_user_id,
                    approval_stage, idea_approval_status, approval_status,
                    idea_manager_note, manager_note, published_by_user_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'none', 'nao_enviada', 'nao_enviada', '', '', ?)
            `)
            .run(
                Number(user_id),
                String(title).trim(),
                date,
                JSON.stringify(brands),
                format || "Reels",
                "Ideia",
                responsible || "",
                urgency || "verde",
                reference_link || "",
                description || "",
                copy_text || "",
                approvalRequired ? 1 : 0,
                bypassedAt,
                approvalRequired ? null : Number(user_id),
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

        const linkedManagerRequest = db
            .prepare(`
                SELECT *
                FROM manager_requests
                WHERE assigned_content_id = ?
                  AND TRIM(COALESCE(deleted_at, '')) = ''
                ORDER BY id DESC
                LIMIT 1
            `)
            .get(id);

        const responsible = body.responsible !== undefined ? body.responsible : existing.responsible;
        const urgency = body.urgency !== undefined ? body.urgency : existing.urgency;
        const referenceLink =
            body.reference_link !== undefined ? body.reference_link : existing.reference_link;
        const description = body.description !== undefined ? body.description : existing.description;
        const copyText = body.copy_text !== undefined ? body.copy_text : existing.copy_text;
        /*
         * Aprovação é controlada somente pelos endpoints específicos.
         * O colaborador pode editar o conteúdo, mas não aprovar a si mesmo.
         */
        const approvalStatus = existing.approval_status;
        const managerNote = existing.manager_note;
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
        let effectiveStatus = status;

        if (Boolean(Number(existing.is_live || 0))) {
            effectiveStatus = "Publicado";
        } else if (Number(existing.approval_required ?? 1) === 0) {
            const allowed = new Set([
                "Ideia",
                "Planejado",
                "Em produção",
                "Em edição",
                "Aprovado",
                "Agendado",
                "Cancelado",
            ]);

            if (linkedManagerRequest) {
                allowed.add("Finalizado");
            }

            effectiveStatus = allowed.has(status)
                ? status
                : existing.status;
        } else if (existing.approval_stage === "idea") {
            effectiveStatus = "Aguardando aprovação da ideia";
        } else if (existing.approval_stage === "final") {
            effectiveStatus = "Aguardando aprovação final";
        } else if (existing.approval_status === "aprovado") {
            const allowed = new Set(["Aprovado", "Agendado", "Cancelado"]);

            if (linkedManagerRequest) {
                allowed.add("Finalizado");
            }

            effectiveStatus = allowed.has(status) ? status : existing.status;
        } else if (existing.approval_status === "alteracao") {
            const allowed = new Set(["Ajuste solicitado", "Em edição", "Cancelado"]);
            effectiveStatus = allowed.has(status) ? status : existing.status;
        } else if (existing.idea_approval_status === "aprovado") {
            const allowed = new Set(["Planejado", "Em produção", "Em edição", "Cancelado"]);
            effectiveStatus = allowed.has(status) ? status : existing.status;
        } else {
            const allowed = new Set(["Ideia", "Cancelado"]);
            effectiveStatus = allowed.has(status) ? status : existing.status;
        }

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

        if (
            effectiveStatus === "Finalizado" &&
            linkedManagerRequest
        ) {
            const actorUserId =
                Number(req.authUser?.id) ||
                Number(existing.user_id);

            if (
                Number(linkedManagerRequest.assigned_user_id || 0) !==
                Number(actorUserId)
            ) {
                return res.status(403).json({
                    error:
                        "Somente o Social Media ou Designer responsável pode finalizar esta demanda.",
                });
            }

            completeLinkedManagerRequestByContent(
                id,
                actorUserId,
                `✓ Demanda finalizada automaticamente por ${
                    req.authUser?.nickname ||
                    req.authUser?.name ||
                    existing.responsible ||
                    "responsável do SQUAD"
                }.`
            );
        }

        res.json(getContent(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao atualizar conteúdo." });
    }
});

app.put("/api/contents/:id/approval-requirement", (req, res) => {
    try {
        const id = Number(req.params.id);
        const existing = db
            .prepare(`SELECT * FROM contents WHERE id = ?`)
            .get(id);

        if (!existing) {
            return res.status(404).json({
                error: "Conteúdo não encontrado.",
            });
        }

        if (Boolean(Number(existing.is_live || 0))) {
            return res.status(409).json({
                error:
                    "Retire o conteúdo do NO AR antes de alterar a necessidade de aprovação.",
            });
        }

        const approvalRequired =
            req.body?.approval_required === undefined
                ? true
                : Boolean(req.body.approval_required);

        const changedByUserId =
            Number(req.body?.user_id) ||
            Number(existing.user_id);

        const currentRequired =
            Number(existing.approval_required ?? 1) !== 0;

        if (currentRequired === approvalRequired) {
            return res.json(getContent(id));
        }

        let nextStatus = String(existing.status || "Ideia");

        if (!approvalRequired) {
            if (existing.approval_stage === "idea") {
                nextStatus = "Planejado";
            } else if (
                existing.approval_stage === "final" ||
                existing.approval_status === "alteracao" ||
                nextStatus === "Aguardando aprovação final"
            ) {
                nextStatus = "Em edição";
            } else if (
                nextStatus === "Aguardando aprovação da ideia"
            ) {
                nextStatus = "Planejado";
            }

            db.prepare(`
                UPDATE contents
                SET approval_required = 0,
                    approval_bypassed_at = ?,
                    approval_bypassed_by_user_id = ?,
                    approval_stage = 'none',
                    idea_approval_status = 'nao_enviada',
                    idea_manager_note = '',
                    idea_approved_at = '',
                    idea_approved_by_manager_id = NULL,
                    approval_status = 'nao_enviada',
                    manager_note = '',
                    approved_at = '',
                    approved_by_manager_id = NULL,
                    status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                new Date().toISOString(),
                changedByUserId,
                nextStatus,
                id
            );
        } else {
            nextStatus =
                nextStatus === "Cancelado"
                    ? "Cancelado"
                    : "Ideia";

            db.prepare(`
                UPDATE contents
                SET approval_required = 1,
                    approval_bypassed_at = '',
                    approval_bypassed_by_user_id = NULL,
                    approval_stage = 'none',
                    idea_approval_status = 'nao_enviada',
                    idea_manager_note = '',
                    idea_approved_at = '',
                    idea_approved_by_manager_id = NULL,
                    approval_status = 'nao_enviada',
                    manager_note = '',
                    approved_at = '',
                    approved_by_manager_id = NULL,
                    status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(nextStatus, id);
        }

        res.json(getContent(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error:
                "Erro ao alterar a necessidade de aprovação.",
        });
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
        const approvalRequired =
            req.body?.approval_required === undefined
                ? true
                : Boolean(req.body.approval_required);

        if (!creator) return res.status(400).json({ error: "Criador inválido." });
        if (!recipient) return res.status(400).json({ error: "Selecione um destinatário válido." });
        if (!title) return res.status(400).json({ error: "Título obrigatório." });
        if (!brand) return res.status(400).json({ error: "Marca obrigatória." });
        if (!deadline) return res.status(400).json({ error: "Prazo obrigatório." });

        const result = db.prepare(`
            INSERT INTO creative_jobs (
                creator_user_id, recipient_user_id, creator_name, recipient_name,
                title, brand, creative_type, quantity, deadline, briefing,
                approval_required, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'em_producao')
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
            briefing,
            approvalRequired ? 1 : 0
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
        const approvalRequired =
            req.body?.approval_required === undefined
                ? Number(existing.approval_required ?? 1) !== 0
                : Boolean(req.body.approval_required);

        db.prepare(`
            UPDATE creative_jobs
            SET recipient_user_id = ?, recipient_name = ?, title = ?, brand = ?,
                creative_type = ?, quantity = ?, deadline = ?, briefing = ?,
                approval_required = ?,
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
            approvalRequired ? 1 : 0,
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
        const duplicateAction = String(
            req.body?.duplicate_action || "keep"
        )
            .trim()
            .toLowerCase();

        const job = db
            .prepare(`SELECT * FROM creative_jobs WHERE id = ?`)
            .get(id);

        if (!job) {
            req.files?.forEach((file) =>
                removeContentPhysicalFile(file.filename)
            );
            return res
                .status(404)
                .json({ error: "Produção não encontrada." });
        }

        if (Number(job.creator_user_id) !== userId) {
            req.files?.forEach((file) =>
                removeContentPhysicalFile(file.filename)
            );
            return res.status(403).json({
                error:
                    "Somente quem criou a produção pode enviar arquivos.",
            });
        }

        if (!["em_producao", "ajuste"].includes(job.status)) {
            req.files?.forEach((file) =>
                removeContentPhysicalFile(file.filename)
            );
            return res.status(409).json({
                error:
                    "Arquivos não podem mais ser alterados nesta etapa.",
            });
        }

        if (!req.files?.length) {
            return res
                .status(400)
                .json({ error: "Nenhum arquivo selecionado." });
        }

        if (!["keep", "replace"].includes(duplicateAction)) {
            req.files?.forEach((file) =>
                removeContentPhysicalFile(file.filename)
            );
            return res.status(400).json({
                error: "Ação para arquivos duplicados inválida.",
            });
        }

        const uploadedNames = [
            ...new Set(
                req.files.map((file) =>
                    String(file.originalname || "")
                        .trim()
                        .toLocaleLowerCase("pt-BR")
                )
            ),
        ];

        const existingFiles = db
            .prepare(`
                SELECT *
                FROM creative_files
                WHERE job_id = ?
                ORDER BY id
            `)
            .all(id);

        const existingToReplace =
            duplicateAction === "replace"
                ? existingFiles.filter((file) =>
                      uploadedNames.includes(
                          String(file.original_name || "")
                              .trim()
                              .toLocaleLowerCase("pt-BR")
                      )
                  )
                : [];

        const insert = db.prepare(`
            INSERT INTO creative_files (
                job_id,
                original_name,
                filename,
                mime_type,
                file_size
            )
            VALUES (?, ?, ?, ?, ?)
        `);

        const deleteExisting = db.prepare(`
            DELETE FROM creative_files
            WHERE id = ?
        `);

        const transaction = db.transaction(() => {
            existingToReplace.forEach((file) =>
                deleteExisting.run(file.id)
            );

            req.files.forEach((file) =>
                insert.run(
                    id,
                    file.originalname,
                    file.filename,
                    file.mimetype,
                    file.size
                )
            );
        });

        transaction();

        /*
         * Só remove os arquivos físicos antigos depois que a
         * transação de banco termina com sucesso. Se houver erro
         * no INSERT, o arquivo anterior continua preservado.
         */
        existingToReplace.forEach((file) =>
            removeContentPhysicalFile(file.filename)
        );

        res.json(getCreativeJob(id));
    } catch (error) {
        console.error(error);

        req.files?.forEach((file) =>
            removeContentPhysicalFile(file.filename)
        );

        res.status(500).json({
            error: "Erro ao enviar arquivos da produção.",
        });
    }
});
app.get("/api/files/:id/download", (req, res) => {
    try {
        const id = Number(req.params.id);
        const file = db
            .prepare(`
                SELECT id, content_id, original_name, filename, mime_type, file_size
                FROM files
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

        return downloadOriginalFile(
            res,
            filePath,
            file.original_name
        );
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao baixar o arquivo." });
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

        return downloadOriginalFile(
            res,
            filePath,
            file.original_name
        );
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao baixar o arquivo." });
    }
});

app.delete("/api/creative/jobs/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.body?.user_id);

        const job = db
            .prepare(`SELECT * FROM creative_jobs WHERE id = ?`)
            .get(id);

        if (!job) {
            return res
                .status(404)
                .json({ error: "Demanda criativa não encontrada." });
        }

        if (Number(job.creator_user_id) !== userId) {
            return res.status(403).json({
                error:
                    "Somente o Designer que criou esta demanda pode excluí-la.",
            });
        }

        const approvalRequired =
            Number(job.approval_required ?? 1) !== 0;

        const neverSubmittedToManager =
            approvalRequired &&
            job.status === "em_producao" &&
            !String(job.submitted_at || "").trim();

        const createdWithoutApproval =
            !approvalRequired;

        if (
            !neverSubmittedToManager &&
            !createdWithoutApproval
        ) {
            return res.status(409).json({
                error:
                    "Esta demanda já entrou no fluxo de aprovação do Gerente de Marketing e não pode mais ser excluída.",
            });
        }

        const files = db
            .prepare(`
                SELECT id, filename
                FROM creative_files
                WHERE job_id = ?
            `)
            .all(id);

        /*
         * Apaga primeiro os registros auxiliares que podem continuar
         * apontando para a demanda. Não existe histórico gerencial em
         * demandas que nunca foram enviadas ou que nasceram sem aprovação.
         */
        const transaction = db.transaction(() => {
            db.prepare(`
                DELETE FROM notifications
                WHERE entity_type = 'creative'
                  AND entity_id = ?
            `).run(id);

            db.prepare(`
                DELETE FROM creative_files
                WHERE job_id = ?
            `).run(id);

            db.prepare(`
                DELETE FROM creative_jobs
                WHERE id = ?
            `).run(id);
        });

        transaction();

        files.forEach((file) =>
            removeContentPhysicalFile(file.filename)
        );

        res.json({
            success: true,
            id,
            deleted_files: files.length,
            mode: createdWithoutApproval
                ? "without_approval"
                : "before_manager",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Erro ao excluir a demanda criativa.",
        });
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

        if (!job) {
            return res.status(404).json({ error: "Produção não encontrada." });
        }

        if (Number(job.creator_user_id) !== userId) {
            return res.status(403).json({
                error: "Somente quem criou a produção pode concluir esta etapa.",
            });
        }

        if (!["em_producao", "ajuste"].includes(job.status)) {
            return res.status(409).json({
                error: "Esta produção já foi enviada ou entregue.",
            });
        }

        const fileCount = db
            .prepare(`SELECT COUNT(*) AS total FROM creative_files WHERE job_id = ?`)
            .get(id).total;

        if (!fileCount) {
            return res.status(400).json({
                error: "Adicione pelo menos um arquivo antes de concluir a produção.",
            });
        }

        const approvalRequired =
            Number(job.approval_required ?? 1) !== 0;

        if (approvalRequired) {
            db.prepare(`
                UPDATE creative_jobs
                SET status = 'aguardando_aprovacao',
                    submitted_at = ?,
                    manager_note = '',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(new Date().toISOString(), id);

            return res.json(getCreativeJob(id));
        }

        let recipient = job.recipient_user_id
            ? getActiveUserRowById(job.recipient_user_id)
            : null;

        if (!recipient) {
            recipient = repairCreativeRecipientLink(id);
        }

        if (!recipient) {
            return res.status(409).json({
                error:
                    "Não foi possível localizar o destinatário. Selecione novamente 'Entregar para' antes de finalizar.",
            });
        }

        const now = new Date().toISOString();

        db.prepare(`
            UPDATE creative_jobs
            SET status = 'aprovado',
                recipient_user_id = ?,
                recipient_name = ?,
                submitted_at = '',
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

        const recipientSerialized = serializeUser(recipient);
        const recipientCategory =
            summaryUserType(recipientSerialized) === "design"
                ? "design"
                : "social";

        createManagerNotification({
            userId: recipient.id,
            category: recipientCategory,
            eventType: "creative_direct_delivery",
            entityType: "creative",
            entityId: id,
            title: "Nova produção recebida",
            message: `A produção “${job.title}” foi entregue diretamente por ${job.creator_name || "Design"}.`,
            note: "Este material foi marcado como sem necessidade de aprovação gerencial.",
        });

        return res.json(getCreativeJob(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Erro ao concluir a produção criativa.",
        });
    }
});
app.post("/api/contents/:id/submit-approval", (req, res) => {
    try {
        const id = Number(req.params.id);
        const stage = String(req.body?.stage || "").trim().toLowerCase();
        const existing = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id);

        if (!existing) {
            return res.status(404).json({ error: "Conteúdo não encontrado." });
        }

        if (Boolean(Number(existing.is_live || 0))) {
            return res.status(409).json({
                error: "Um conteúdo que já está NO AR não pode entrar em aprovação.",
            });
        }

        if (Number(existing.approval_required ?? 1) === 0) {
            return res.status(409).json({
                error:
                    "Este conteúdo está marcado como publicação sem aprovação gerencial.",
            });
        }

        if (!["idea", "final"].includes(stage)) {
            return res.status(400).json({
                error: "Etapa de aprovação inválida.",
            });
        }

        if (stage === "idea") {
            if (existing.approval_status === "aprovado") {
                return res.status(409).json({
                    error: "O conteúdo final já foi aprovado.",
                });
            }

            if (existing.status === "Cancelado") {
                return res.status(409).json({
                    error: "Um conteúdo cancelado não pode ser enviado para aprovação.",
                });
            }

            db.prepare(`
                UPDATE contents
                SET approval_stage = 'idea',
                    idea_approval_status = 'pendente',
                    idea_manager_note = '',
                    status = 'Aguardando aprovação da ideia',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(id);
        } else {
            if (existing.idea_approval_status !== "aprovado") {
                return res.status(409).json({
                    error: "A ideia precisa ser aprovada antes do conteúdo final.",
                });
            }

            if (
                ![
                    "Planejado",
                    "Em produção",
                    "Em edição",
                    "Ajuste solicitado",
                ].includes(existing.status)
            ) {
                return res.status(409).json({
                    error:
                        "Este conteúdo ainda não está em uma etapa válida para aprovação final.",
                });
            }

            const files = getFiles(id);

            if (!files.length) {
                return res.status(409).json({
                    error:
                        "Anexe pelo menos um arquivo final antes de enviar para aprovação.",
                });
            }

            db.prepare(`
                UPDATE contents
                SET approval_stage = 'final',
                    approval_status = 'pendente',
                    manager_note = '',
                    status = 'Aguardando aprovação final',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(id);
        }

        res.json(getContent(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Erro ao enviar conteúdo para aprovação.",
        });
    }
});

app.get("/api/manager/approvals", (req, res) => {
    try {
        const managerId = Number(req.query.manager_id);
        if (!requireManagerRequest(req, res, managerId)) return;
        const requestedMonth = Number(req.query.month);
        const requestedYear = Number(req.query.year);

        if (!isManagerUserId(managerId)) {
            return res.status(403).json({
                error: "Este perfil não possui acesso ao painel gerencial.",
            });
        }

        const now = new Date();
        const year =
            Number.isInteger(requestedYear) &&
            requestedYear >= 2020 &&
            requestedYear <= 2100
                ? requestedYear
                : now.getFullYear();

        const month =
            Number.isInteger(requestedMonth) &&
            requestedMonth >= 0 &&
            requestedMonth <= 12
                ? requestedMonth
                : now.getMonth() + 1;

        function inSelectedPeriod(value) {
            if (!value) return false;

            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return false;

            const sameYear = date.getFullYear() === year;
            if (!sameYear) return false;

            return month === 0 || date.getMonth() + 1 === month;
        }

        function addCounter(map, key, amount = 1) {
            const name = String(key || "Não informado").trim() || "Não informado";
            map.set(name, Number(map.get(name) || 0) + Number(amount || 0));
        }

        const contents = db
            .prepare(`
                SELECT *
                FROM contents
                WHERE (
                        (approval_stage = 'idea' AND idea_approval_status = 'pendente')
                        OR
                        (approval_stage = 'final' AND approval_status = 'pendente')
                      )
                  AND COALESCE(approval_required, 1) = 1
                  AND COALESCE(is_live, 0) = 0
                  AND TRIM(COALESCE(deleted_at, '')) = ''
                ORDER BY datetime(updated_at) DESC, id DESC
            `)
            .all()
            .map(serializeContent);

        const creative = db
            .prepare(`
                SELECT *
                FROM creative_jobs
                WHERE status = 'aguardando_aprovacao'
                ORDER BY datetime(submitted_at) DESC, id DESC
            `)
            .all()
            .map(serializeCreativeJob);

        /*
         * ABA APROVADOS
         * Somente itens já liberados pelo gerente mas que ainda dependem
         * de uma ação da equipe.
         */
        const approvedContents = db
            .prepare(`
                SELECT *
                FROM contents
                WHERE approval_status = 'aprovado'
                  AND COALESCE(approval_required, 1) = 1
                  AND COALESCE(is_live, 0) = 0
                  AND TRIM(COALESCE(deleted_at, '')) = ''
                ORDER BY
                    datetime(COALESCE(NULLIF(approved_at, ''), updated_at)) DESC,
                    id DESC
            `)
            .all()
            .map(serializeContent);

        const approvedCreative = db
            .prepare(`
                SELECT *
                FROM creative_jobs
                WHERE status = 'aprovado'
                  AND TRIM(COALESCE(approved_at, '')) <> ''
                ORDER BY datetime(approved_at) DESC, id DESC
            `)
            .all()
            .map(serializeCreativeJob);

        /*
         * ABA CONCLUÍDOS
         * Filtrada pelo mês/ano escolhido.
         */
        const completedContents = db
            .prepare(`
                SELECT *
                FROM contents
                WHERE COALESCE(is_live, 0) = 1
                  AND TRIM(COALESCE(published_at, '')) <> ''
                  AND TRIM(COALESCE(deleted_at, '')) = ''
                ORDER BY datetime(published_at) DESC, id DESC
            `)
            .all()
            .filter((row) => inSelectedPeriod(row.published_at))
            .map(serializeContent);

        const completedCreative = db
            .prepare(`
                SELECT *
                FROM creative_jobs
                WHERE status IN ('finalizado', 'arquivado')
                ORDER BY
                    datetime(
                        COALESCE(
                            NULLIF(recipient_finished_at, ''),
                            NULLIF(files_purged_at, ''),
                            approved_at
                        )
                    ) DESC,
                    id DESC
            `)
            .all()
            .filter((row) =>
                inSelectedPeriod(
                    row.recipient_finished_at ||
                        row.files_purged_at ||
                        row.approved_at
                )
            )
            .map(serializeCreativeJob);

        /*
         * RELATÓRIO GERENCIAL DO PERÍODO
         * Aprovações usam a data real em que foram aprovadas.
         */
        const allContentsForReport = db
            .prepare(`
                SELECT *
                FROM contents
                WHERE TRIM(COALESCE(deleted_at, '')) = ''
            `)
            .all()
            .map(serializeContent);

        const allCreativeForReport = db
            .prepare(`
                SELECT *
                FROM creative_jobs
                WHERE TRIM(COALESCE(approved_at, '')) <> ''
            `)
            .all()
            .map(serializeCreativeJob);

        const ideaApproved = allContentsForReport.filter((item) =>
            inSelectedPeriod(item.idea_approved_at)
        );

        const finalApproved = allContentsForReport.filter((item) =>
            inSelectedPeriod(item.approved_at)
        );

        const designApproved = allCreativeForReport.filter((item) =>
            inSelectedPeriod(item.approved_at)
        );

        const reviewEvents = db
            .prepare(`
                SELECT *
                FROM manager_approval_events
                WHERE event_type IN (
                    'idea_changes',
                    'final_changes',
                    'design_changes'
                )
                ORDER BY datetime(created_at) DESC, id DESC
            `)
            .all()
            .filter((item) => inSelectedPeriod(item.created_at));

        const byBrand = new Map();
        const byCollaborator = new Map();
        const collaboratorUsers = new Map();

        function addSocialApproval(item) {
            const brands = Array.isArray(item.brands)
                ? item.brands
                : [];

            brands.forEach((brand) => addCounter(byBrand, brand));

            const person =
                item.owner?.nickname ||
                item.owner?.name ||
                item.responsible ||
                "Não informado";

            addCounter(byCollaborator, person);

            if (item.owner) {
                collaboratorUsers.set(person, item.owner);
            }
        }

        ideaApproved.forEach(addSocialApproval);
        finalApproved.forEach(addSocialApproval);

        designApproved.forEach((item) => {
            addCounter(byBrand, item.brand);

            const person =
                item.creator?.nickname ||
                item.creator?.name ||
                item.creator_name ||
                "Não informado";

            addCounter(byCollaborator, person);

            if (item.creator) {
                collaboratorUsers.set(person, item.creator);
            }
        });

        const byBrandRows = [...byBrand.entries()]
            .map(([name, total]) => ({ name, total }))
            .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

        const byCollaboratorRows = [...byCollaborator.entries()]
            .map(([name, total]) => ({
                name,
                total,
                user: collaboratorUsers.get(name) || null,
            }))
            .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

        const ideaCount = contents.filter(
            (item) => item.approval_stage === "idea"
        ).length;

        const finalCount = contents.filter(
            (item) => item.approval_stage === "final"
        ).length;

        res.json({
            contents,
            creative,

            approved_contents: approvedContents,
            approved_creative: approvedCreative,

            completed_contents: completedContents,
            completed_creative: completedCreative,

            social_count: contents.length,
            idea_count: ideaCount,
            final_count: finalCount,
            creative_count: creative.length,
            total: contents.length + creative.length,

            approved_social_count: approvedContents.length,
            approved_creative_count: approvedCreative.length,
            approved_total:
                approvedContents.length + approvedCreative.length,

            completed_social_count: completedContents.length,
            completed_creative_count: completedCreative.length,
            completed_total:
                completedContents.length + completedCreative.length,

            report: {
                month,
                year,
                summary: {
                    total_approved:
                        ideaApproved.length +
                        finalApproved.length +
                        designApproved.length,
                    idea_approved: ideaApproved.length,
                    final_approved: finalApproved.length,
                    design_approved: designApproved.length,
                    revisions_requested: reviewEvents.length,
                },
                by_brand: byBrandRows,
                by_collaborator: byCollaboratorRows,
            },

            updated_at: new Date().toISOString(),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Erro ao carregar solicitações de aprovação.",
        });
    }
});

app.post("/api/manager/contents/:id/approve", (req, res) => {
    try {
        const managerId = Number(req.body?.manager_id);
        if (!requireManagerRequest(req, res, managerId)) return;

        if (!isManagerUserId(managerId)) {
            return res.status(403).json({
                error: "Apenas o perfil Gerente pode aprovar conteúdos.",
            });
        }

        const id = Number(req.params.id);
        const existing = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id);

        if (!existing) {
            return res.status(404).json({ error: "Conteúdo não encontrado." });
        }

        if (Number(existing.approval_required ?? 1) === 0) {
            return res.status(409).json({
                error:
                    "Este conteúdo não exige aprovação gerencial.",
            });
        }

        if (String(existing.deleted_at || "").trim()) {
            return res.status(409).json({
                error: "Este conteúdo está na lixeira e não pode ser aprovado.",
            });
        }

        const requestedStage = String(req.body?.stage || "")
            .trim()
            .toLowerCase();

        const stage =
            ["idea", "final"].includes(requestedStage)
                ? requestedStage
                : String(existing.approval_stage || "none");

        const now = new Date().toISOString();

        if (stage === "idea") {
            if (existing.idea_approval_status === "aprovado") {
                return res.json(getContent(id));
            }

            if (
                existing.approval_stage !== "idea" ||
                existing.idea_approval_status !== "pendente"
            ) {
                return res.status(409).json({
                    error:
                        "A ideia ainda não foi enviada para aprovação do gerente.",
                });
            }

            db.prepare(`
                UPDATE contents
                SET approval_stage = 'none',
                    idea_approval_status = 'aprovado',
                    idea_manager_note = '',
                    idea_approved_at = ?,
                    idea_approved_by_manager_id = ?,
                    status = 'Planejado',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(now, managerId, id);

            createManagerNotification({
                userId: existing.user_id,
                category: "social",
                eventType: "idea_approved",
                entityType: "content",
                entityId: id,
                title: "Ideia aprovada",
                message: `A ideia “${existing.title}” foi aprovada. O conteúdo está liberado para produção.`,
                managerUserId: managerId,
            });

            logManagerApprovalEvent({
                managerUserId: managerId,
                category: "social",
                eventType: "idea_approved",
                entityType: "content",
                entityId: id,
                title: existing.title,
                collaboratorUserId: existing.user_id,
                collaboratorName:
                    getUserById(existing.user_id)?.nickname ||
                    getUserById(existing.user_id)?.name ||
                    existing.responsible ||
                    "Equipe",
                brands: parseJsonArray(existing.brands),
            });
        } else if (stage === "final") {
            if (existing.approval_status === "aprovado") {
                return res.json(getContent(id));
            }

            if (existing.idea_approval_status !== "aprovado") {
                return res.status(409).json({
                    error:
                        "A ideia precisa ser aprovada antes do conteúdo final.",
                });
            }

            const files = getFiles(id);

            if (!files.length) {
                return res.status(409).json({
                    error:
                        "Ainda não existe arquivo final anexado para esta aprovação.",
                });
            }

            /*
             * O gerente pode tomar a decisão final em dois cenários:
             * 1. o Social Media já enviou formalmente a aprovação final;
             * 2. a ideia já foi aprovada e o arquivo final já está anexado.
             *
             * O segundo cenário resolve produções que já ficaram prontas antes
             * do colaborador clicar em "Enviar conteúdo final".
             */
            db.prepare(`
                UPDATE contents
                SET approval_stage = 'none',
                    approval_status = 'aprovado',
                    manager_note = '',
                    approved_at = ?,
                    approved_by_manager_id = ?,
                    status = 'Aprovado',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(now, managerId, id);

            createManagerNotification({
                userId: existing.user_id,
                category: "social",
                eventType: "final_approved",
                entityType: "content",
                entityId: id,
                title: "Conteúdo final aprovado",
                message: `O conteúdo “${existing.title}” foi aprovado pelo gerente e está liberado para agendamento.`,
                managerUserId: managerId,
            });

            logManagerApprovalEvent({
                managerUserId: managerId,
                category: "social",
                eventType: "final_approved",
                entityType: "content",
                entityId: id,
                title: existing.title,
                collaboratorUserId: existing.user_id,
                collaboratorName:
                    getUserById(existing.user_id)?.nickname ||
                    getUserById(existing.user_id)?.name ||
                    existing.responsible ||
                    "Equipe",
                brands: parseJsonArray(existing.brands),
            });
        } else {
            return res.status(409).json({
                error:
                    "Este conteúdo ainda não possui uma etapa disponível para aprovação.",
            });
        }

        res.json(getContent(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao aprovar conteúdo." });
    }
});

app.post("/api/manager/contents/:id/reject", (req, res) => {
    try {
        const managerId = Number(req.body?.manager_id);
        if (!requireManagerRequest(req, res, managerId)) return;

        if (!isManagerUserId(managerId)) {
            return res.status(403).json({
                error: "Apenas o Gerente de Marketing pode recusar conteúdos.",
            });
        }

        const stage = String(req.body?.stage || "").trim().toLowerCase();
        if (!["idea", "final"].includes(stage)) {
            return res.status(400).json({ error: "Etapa inválida." });
        }

        const id = Number(req.params.id);
        const existing = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id);

        if (!existing) {
            return res.status(404).json({ error: "Conteúdo não encontrado." });
        }

        if (Number(existing.approval_required ?? 1) === 0) {
            return res.status(409).json({
                error: "Este conteúdo não exige aprovação gerencial.",
            });
        }

        if (String(existing.deleted_at || "").trim()) {
            return res.status(409).json({
                error: "Este conteúdo está na lixeira.",
            });
        }

        if (stage === "idea") {
            if (
                existing.approval_stage !== "idea" ||
                existing.idea_approval_status !== "pendente"
            ) {
                return res.status(409).json({
                    error: "A ideia não está aguardando decisão do gerente.",
                });
            }

            db.prepare(`
                UPDATE contents
                SET approval_stage = 'none',
                    idea_approval_status = 'reprovado',
                    idea_manager_note = 'Ideia recusada pelo Gerente de Marketing.',
                    approval_status = 'nao_enviada',
                    status = 'Cancelado',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(id);

            createManagerNotification({
                userId: existing.user_id,
                category: "social",
                eventType: "idea_rejected",
                entityType: "content",
                entityId: id,
                title: "Ideia recusada",
                message: `A ideia “${existing.title}” foi recusada pelo Gerente de Marketing.`,
                note: "A solicitação foi encerrada.",
                managerUserId: managerId,
            });

            logManagerApprovalEvent({
                managerUserId: managerId,
                category: "social",
                eventType: "idea_rejected",
                entityType: "content",
                entityId: id,
                title: existing.title,
                collaboratorUserId: existing.user_id,
                collaboratorName:
                    getUserById(existing.user_id)?.nickname ||
                    getUserById(existing.user_id)?.name ||
                    existing.responsible ||
                    "Equipe",
                brands: parseJsonArray(existing.brands),
            });
        } else {
            if (existing.idea_approval_status !== "aprovado") {
                return res.status(409).json({
                    error: "A ideia precisa estar aprovada antes da decisão final.",
                });
            }

            if (
                existing.approval_stage !== "final" &&
                existing.approval_status !== "pendente"
            ) {
                const files = getFiles(id);
                if (!files.length) {
                    return res.status(409).json({
                        error: "Ainda não existe conteúdo final para recusar.",
                    });
                }
            }

            db.prepare(`
                UPDATE contents
                SET approval_stage = 'none',
                    approval_status = 'reprovado',
                    manager_note = 'Conteúdo final recusado pelo Gerente de Marketing.',
                    status = 'Cancelado',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(id);

            createManagerNotification({
                userId: existing.user_id,
                category: "social",
                eventType: "final_rejected",
                entityType: "content",
                entityId: id,
                title: "Conteúdo final recusado",
                message: `O conteúdo final “${existing.title}” foi recusado pelo Gerente de Marketing.`,
                note: "A solicitação foi encerrada.",
                managerUserId: managerId,
            });

            logManagerApprovalEvent({
                managerUserId: managerId,
                category: "social",
                eventType: "final_rejected",
                entityType: "content",
                entityId: id,
                title: existing.title,
                collaboratorUserId: existing.user_id,
                collaboratorName:
                    getUserById(existing.user_id)?.nickname ||
                    getUserById(existing.user_id)?.name ||
                    existing.responsible ||
                    "Equipe",
                brands: parseJsonArray(existing.brands),
            });
        }

        res.json(getContent(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao recusar conteúdo." });
    }
});

app.post("/api/manager/contents/:id/request-changes", (req, res) => {
    try {
        const managerId = Number(req.body?.manager_id);
        if (!requireManagerRequest(req, res, managerId)) return;
        const stage = String(req.body?.stage || "").trim().toLowerCase();
        const note = String(req.body?.note || "").trim();

        if (!isManagerUserId(managerId)) {
            return res.status(403).json({
                error: "Apenas o perfil Gerente pode solicitar alterações.",
            });
        }

        if (!["idea", "final"].includes(stage)) {
            return res.status(400).json({ error: "Etapa inválida." });
        }

        if (!note) {
            return res.status(400).json({
                error: "Escreva a orientação para o colaborador.",
            });
        }

        const id = Number(req.params.id);
        const existing = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id);

        if (!existing) {
            return res.status(404).json({ error: "Conteúdo não encontrado." });
        }

        if (Number(existing.approval_required ?? 1) === 0) {
            return res.status(409).json({
                error:
                    "Este conteúdo não exige aprovação gerencial.",
            });
        }

        if (stage === "idea") {
            if (
                existing.approval_stage !== "idea" ||
                existing.idea_approval_status !== "pendente"
            ) {
                return res.status(409).json({
                    error: "A ideia não está aguardando aprovação.",
                });
            }

            db.prepare(`
                UPDATE contents
                SET approval_stage = 'none',
                    idea_approval_status = 'alteracao',
                    idea_manager_note = ?,
                    status = 'Ideia',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(note, id);

            createManagerNotification({
                userId: existing.user_id,
                category: "social",
                eventType: "idea_changes",
                entityType: "content",
                entityId: id,
                title: "Ajuste solicitado na ideia",
                message: `O gerente pediu alterações na ideia “${existing.title}”.`,
                note,
                managerUserId: managerId,
            });

            logManagerApprovalEvent({
                managerUserId: managerId,
                category: "social",
                eventType: "idea_changes",
                entityType: "content",
                entityId: id,
                title: existing.title,
                collaboratorUserId: existing.user_id,
                collaboratorName:
                    getUserById(existing.user_id)?.nickname ||
                    getUserById(existing.user_id)?.name ||
                    existing.responsible ||
                    "Equipe",
                brands: parseJsonArray(existing.brands),
            });
        } else {
            if (existing.idea_approval_status !== "aprovado") {
                return res.status(409).json({
                    error:
                        "A ideia precisa ser aprovada antes de revisar o conteúdo final.",
                });
            }

            const files = getFiles(id);

            if (!files.length) {
                return res.status(409).json({
                    error:
                        "Ainda não existe arquivo final anexado para solicitar revisão.",
                });
            }

            db.prepare(`
                UPDATE contents
                SET approval_stage = 'none',
                    approval_status = 'alteracao',
                    manager_note = ?,
                    status = 'Ajuste solicitado',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(note, id);

            createManagerNotification({
                userId: existing.user_id,
                category: "social",
                eventType: "final_changes",
                entityType: "content",
                entityId: id,
                title: "Ajuste solicitado no conteúdo final",
                message: `O gerente pediu alterações no conteúdo final “${existing.title}”.`,
                note,
                managerUserId: managerId,
            });

            logManagerApprovalEvent({
                managerUserId: managerId,
                category: "social",
                eventType: "final_changes",
                entityType: "content",
                entityId: id,
                title: existing.title,
                collaboratorUserId: existing.user_id,
                collaboratorName:
                    getUserById(existing.user_id)?.nickname ||
                    getUserById(existing.user_id)?.name ||
                    existing.responsible ||
                    "Equipe",
                brands: parseJsonArray(existing.brands),
            });
        }

        res.json(getContent(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Erro ao solicitar alterações.",
        });
    }
});

app.post("/api/manager/contents/:id/revoke-approval", (req, res) => {
    try {
        const managerId = Number(req.body?.manager_id);
        if (!requireManagerRequest(req, res, managerId)) return;
        const stage = String(req.body?.stage || "final").trim().toLowerCase();

        if (!isManagerUserId(managerId)) {
            return res.status(403).json({
                error: "Apenas o perfil Gerente pode desfazer uma aprovação.",
            });
        }

        if (!["idea", "final"].includes(stage)) {
            return res.status(400).json({ error: "Etapa inválida." });
        }

        const id = Number(req.params.id);
        const existing = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id);

        if (!existing) {
            return res.status(404).json({ error: "Conteúdo não encontrado." });
        }

        if (Number(existing.approval_required ?? 1) === 0) {
            return res.status(409).json({
                error:
                    "Este conteúdo não exige aprovação gerencial.",
            });
        }

        if (Boolean(Number(existing.is_live || 0))) {
            return res.status(409).json({
                error:
                    "Este conteúdo já está NO AR. Retire-o do ar antes de desfazer a aprovação.",
            });
        }

        if (stage === "idea") {
            if (existing.idea_approval_status !== "aprovado") {
                return res.status(409).json({
                    error: "A ideia não está aprovada no momento.",
                });
            }

            if (existing.approval_status === "aprovado") {
                return res.status(409).json({
                    error:
                        "O conteúdo final já foi aprovado. Desfaça primeiro a aprovação final.",
                });
            }

            db.prepare(`
                UPDATE contents
                SET approval_stage = 'idea',
                    idea_approval_status = 'pendente',
                    idea_manager_note = '',
                    idea_approved_at = '',
                    idea_approved_by_manager_id = NULL,
                    approval_status = 'nao_enviada',
                    manager_note = '',
                    approved_at = '',
                    approved_by_manager_id = NULL,
                    status = 'Aguardando aprovação da ideia',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(id);

            createManagerNotification({
                userId: existing.user_id,
                category: "social",
                eventType: "idea_reopened",
                entityType: "content",
                entityId: id,
                title: "Aprovação da ideia desfeita",
                message: `O gerente voltou atrás na aprovação da ideia “${existing.title}”. Ela retornou para análise.`,
                managerUserId: managerId,
            });
        } else {
            if (existing.approval_status !== "aprovado") {
                return res.status(409).json({
                    error: "O conteúdo final não está aprovado no momento.",
                });
            }

            db.prepare(`
                UPDATE contents
                SET approval_stage = 'final',
                    approval_status = 'pendente',
                    manager_note = '',
                    approved_at = '',
                    approved_by_manager_id = NULL,
                    status = 'Aguardando aprovação final',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(id);

            createManagerNotification({
                userId: existing.user_id,
                category: "social",
                eventType: "final_reopened",
                entityType: "content",
                entityId: id,
                title: "Aprovação final desfeita",
                message: `O gerente voltou atrás na aprovação de “${existing.title}”. O conteúdo voltou para análise final.`,
                managerUserId: managerId,
            });
        }

        res.json(getContent(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao desfazer aprovação." });
    }
});

app.get("/api/creative/manager-jobs", (req, res) => {
    try {
        if (!requireManagerRequest(req, res)) return;
        const rows = db
            .prepare(`
                SELECT * FROM creative_jobs
                WHERE status = 'aguardando_aprovacao'
                  AND COALESCE(approval_required, 1) = 1
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
        const managerId = Number(req.body?.manager_id);
        if (!requireManagerRequest(req, res, managerId)) return;
        if (!isManagerUserId(managerId)) {
            return res.status(403).json({
                error: "Apenas o perfil Gerente pode aprovar ou solicitar ajustes.",
            });
        }

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

            createManagerNotification({
                userId: job.creator_user_id,
                category: "design",
                eventType: "design_approved",
                entityType: "creative",
                entityId: id,
                title: "Produção aprovada",
                message: `A produção “${job.title}” foi aprovada pelo gerente e entregue ao destinatário.`,
                managerUserId: managerId,
            });

            logManagerApprovalEvent({
                managerUserId: managerId,
                category: "design",
                eventType: "design_approved",
                entityType: "creative",
                entityId: id,
                title: job.title,
                collaboratorUserId: job.creator_user_id,
                collaboratorName:
                    job.creator_name ||
                    getUserById(job.creator_user_id)?.nickname ||
                    getUserById(job.creator_user_id)?.name ||
                    "Design",
                brands: [job.brand],
            });
        } else if (action === "adjust") {
            if (!note) return res.status(400).json({ error: "Descreva o ajuste solicitado." });
            db.prepare(`
                UPDATE creative_jobs
                SET status = 'ajuste', manager_note = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(note, id);

            createManagerNotification({
                userId: job.creator_user_id,
                category: "design",
                eventType: "design_changes",
                entityType: "creative",
                entityId: id,
                title: "Ajuste solicitado no Design",
                message: `O gerente pediu alterações na produção “${job.title}”.`,
                note,
                managerUserId: managerId,
            });

            logManagerApprovalEvent({
                managerUserId: managerId,
                category: "design",
                eventType: "design_changes",
                entityType: "creative",
                entityId: id,
                title: job.title,
                collaboratorUserId: job.creator_user_id,
                collaboratorName:
                    job.creator_name ||
                    getUserById(job.creator_user_id)?.nickname ||
                    getUserById(job.creator_user_id)?.name ||
                    "Design",
                brands: [job.brand],
            });
        } else {
            return res.status(400).json({ error: "Ação inválida." });
        }

        res.json(getCreativeJob(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao revisar produção." });
    }
});

app.post("/api/creative/jobs/:id/revoke-approval", (req, res) => {
    try {
        const managerId = Number(req.body?.manager_id);
        if (!requireManagerRequest(req, res, managerId)) return;

        if (!isManagerUserId(managerId)) {
            return res.status(403).json({
                error: "Apenas o perfil Gerente pode desfazer uma aprovação.",
            });
        }

        const id = Number(req.params.id);
        const job = db.prepare(`SELECT * FROM creative_jobs WHERE id = ?`).get(id);

        if (!job) {
            return res.status(404).json({ error: "Produção não encontrada." });
        }

        if (job.status !== "aprovado") {
            if (["finalizado", "arquivado"].includes(job.status)) {
                return res.status(409).json({
                    error:
                        "Esta entrega já foi finalizada pelo destinatário. A aprovação não pode mais ser desfeita.",
                });
            }

            return res.status(409).json({
                error: "Esta produção não está aprovada no momento.",
            });
        }

        db.prepare(`
            UPDATE creative_jobs
            SET status = 'aguardando_aprovacao',
                manager_note = '',
                approved_at = '',
                delivered_at = '',
                recipient_read_at = '',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(id);

        createManagerNotification({
            userId: job.creator_user_id,
            category: "design",
            eventType: "design_reopened",
            entityType: "creative",
            entityId: id,
            title: "Aprovação do Design desfeita",
            message: `O gerente voltou atrás na aprovação da produção “${job.title}”. Ela retornou para análise.`,
            managerUserId: managerId,
        });

        res.json(getCreativeJob(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Erro ao desfazer aprovação da produção criativa.",
        });
    }
});

app.post("/api/creative/jobs/:id/finalize-manager-request", (req, res) => {
    try {
        const id = Number(req.params.id);
        const user = req.authUser;
        const userId = Number(user?.id);

        if (!userId) {
            return res.status(401).json({
                error: "Entre novamente no SQUAD.",
            });
        }

        const job = db
            .prepare(`
                SELECT *
                FROM creative_jobs
                WHERE id = ?
            `)
            .get(id);

        if (!job) {
            return res.status(404).json({
                error: "Produção não encontrada.",
            });
        }

        if (Number(job.creator_user_id) !== userId) {
            return res.status(403).json({
                error:
                    "Somente o Designer responsável pode finalizar este pedido.",
            });
        }

        let requestRow = Number(job.manager_request_id || 0)
            ? db
                  .prepare(`
                      SELECT *
                      FROM manager_requests
                      WHERE id = ?
                  `)
                  .get(Number(job.manager_request_id))
            : null;

        if (
            !requestRow &&
            Number(job.linked_content_id || 0)
        ) {
            requestRow = db
                .prepare(`
                    SELECT *
                    FROM manager_requests
                    WHERE assigned_content_id = ?
                      AND TRIM(COALESCE(deleted_at, '')) = ''
                    ORDER BY id DESC
                    LIMIT 1
                `)
                .get(Number(job.linked_content_id));
        }

        if (!requestRow) {
            return res.status(404).json({
                error:
                    "Esta produção não está vinculada a um pedido de gestor.",
            });
        }

        if (
            Number(requestRow.assigned_user_id || 0) !==
            userId
        ) {
            return res.status(403).json({
                error:
                    "Este pedido está atribuído a outro responsável.",
            });
        }

        if (requestRow.status === "Concluído") {
            return res.json({
                job: getCreativeJob(id),
                request: serializeManagerRequest(
                    getManagerRequestRowWithPeople(
                        requestRow.id
                    )
                ),
            });
        }

        if (job.status !== "aprovado") {
            return res.status(409).json({
                error:
                    "Conclua a produção antes de finalizar o pedido do gestor.",
            });
        }

        const approvalRequired =
            Number(job.approval_required ?? 1) !== 0;

        if (
            approvalRequired &&
            !String(job.approved_at || "").trim()
        ) {
            return res.status(409).json({
                error:
                    "A produção ainda precisa da aprovação do Gerente de Marketing.",
            });
        }

        const now = new Date().toISOString();
        const linkedContentId =
            Number(job.linked_content_id || 0);

        const transaction = db.transaction(() => {
            db.prepare(`
                UPDATE manager_requests
                SET status = 'Concluído',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(requestRow.id);

            db.prepare(`
                UPDATE creative_jobs
                SET status = 'finalizado',
                    recipient_finished_at = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(now, id);

            if (linkedContentId) {
                const linkedContent = db
                    .prepare(`
                        SELECT *
                        FROM contents
                        WHERE id = ?
                    `)
                    .get(linkedContentId);

                if (
                    linkedContent &&
                    !Boolean(
                        Number(linkedContent.is_live || 0)
                    )
                ) {
                    db.prepare(`
                        UPDATE contents
                        SET status = 'Finalizado',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(linkedContentId);
                }
            }

            db.prepare(`
                INSERT INTO manager_request_updates (
                    request_id,
                    author_id,
                    message
                )
                VALUES (?, ?, ?)
            `).run(
                requestRow.id,
                userId,
                approvalRequired
                    ? `✓ Pedido finalizado pelo Designer ${
                          user.nickname ||
                          user.name ||
                          ""
                      } após aprovação do Gerente de Marketing.`
                    : `✓ Pedido finalizado pelo Designer ${
                          user.nickname ||
                          user.name ||
                          ""
                      } sem necessidade de aprovação gerencial.`
            );
        });

        transaction();

        return res.json({
            job: getCreativeJob(id),
            request: serializeManagerRequest(
                getManagerRequestRowWithPeople(
                    requestRow.id
                )
            ),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error:
                "Erro ao finalizar pedido do gestor.",
        });
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
        const linkedContentId = Number(job.linked_content_id || 0);

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

        if (linkedContentId) {
            completeLinkedManagerRequestByContent(
                linkedContentId,
                userId,
                `✓ Entrega criativa finalizada automaticamente por ${
                    req.authUser?.nickname ||
                    req.authUser?.name ||
                    "responsável do SQUAD"
                }.`
            );
        }

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

app.post("/api/contents/:id/files", (req, res) => {
    upload.array("files", 10)(req, res, (uploadError) => {
        if (uploadError) {
            console.error(
                "Upload de conteúdo:",
                uploadError.message
            );

            const isLimit =
                uploadError instanceof multer.MulterError &&
                uploadError.code === "LIMIT_FILE_SIZE";

            return res.status(400).json({
                error: isLimit
                    ? "Arquivo muito grande. Limite de 500 MB por arquivo."
                    : uploadError.message ||
                      "Não foi possível receber o arquivo.",
            });
        }

        const uploadedFiles = Array.isArray(req.files)
            ? req.files
            : [];

        try {
            const contentId = Number(req.params.id);

            if (!Number.isInteger(contentId) || contentId <= 0) {
                uploadedFiles.forEach((file) =>
                    removeContentPhysicalFile(file.filename)
                );

                return res.status(400).json({
                    error: "Demanda inválida para upload.",
                });
            }

            const content = db
                .prepare(`
                    SELECT *
                    FROM contents
                    WHERE id = ?
                      AND TRIM(COALESCE(deleted_at, '')) = ''
                `)
                .get(contentId);

            if (!content) {
                uploadedFiles.forEach((file) =>
                    removeContentPhysicalFile(file.filename)
                );

                return res.status(404).json({
                    error:
                        "A demanda não foi encontrada ou foi removida.",
                });
            }

            if (!uploadedFiles.length) {
                return res.status(400).json({
                    error:
                        "Nenhum arquivo foi recebido pelo servidor.",
                });
            }

            const insertFile = db.prepare(`
                INSERT INTO files (
                    content_id,
                    original_name,
                    filename,
                    mime_type,
                    file_size,
                    source_type,
                    source_id
                )
                VALUES (?, ?, ?, ?, ?, '', 0)
            `);

            const saveFiles = db.transaction(() => {
                uploadedFiles.forEach((file) => {
                    insertFile.run(
                        contentId,
                        file.originalname,
                        file.filename,
                        file.mimetype,
                        file.size
                    );
                });

                const uploadedVideo =
                    uploadedFiles.some(
                        (file) =>
                            String(file.mimetype || "")
                                .toLowerCase()
                                .startsWith("video/") ||
                            /\.(mp4|mov|webm)$/i.test(
                                String(
                                    file.originalname || ""
                                )
                            )
                    );

                if (uploadedVideo) {
                    db.prepare(`
                        UPDATE contents
                        SET video_files_purged_at = '',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(contentId);
                }

                /*
                 * Quando a ideia já foi aprovada, o primeiro
                 * material anexado coloca automaticamente a
                 * demanda em edição.
                 */
                if (
                    Number(
                        content.approval_required ?? 1
                    ) !== 0 &&
                    content.idea_approval_status ===
                        "aprovado" &&
                    content.approval_stage !== "final" &&
                    content.approval_status !==
                        "aprovado" &&
                    ["Planejado", "Em produção"].includes(
                        String(content.status || "")
                    )
                ) {
                    db.prepare(`
                        UPDATE contents
                        SET status = 'Em edição',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(contentId);
                }

                /*
                 * A serialização acontece DENTRO da
                 * transação. Se houver qualquer erro ao montar
                 * a resposta, o banco também volta ao estado
                 * anterior, evitando arquivo fantasma.
                 */
                const updated = getContent(contentId);

                if (!updated) {
                    throw new Error(
                        "A demanda não pôde ser recarregada após o upload."
                    );
                }

                return updated;
            });

            const updatedContent = saveFiles();

            return res.json(updatedContent);
        } catch (error) {
            console.error(
                "Erro ao salvar arquivo do conteúdo:",
                error
            );

            /*
             * Se o banco falhar, remove os arquivos físicos
             * recebidos nesta tentativa.
             */
            uploadedFiles.forEach((file) =>
                removeContentPhysicalFile(
                    file.filename
                )
            );

            return res.status(500).json({
                error:
                    error?.message ||
                    "Erro ao salvar arquivos.",
            });
        }
    });
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

        if (isStoriesFormat(existing.format)) {
            db.prepare(`
                UPDATE contents
                SET metrics_status = 'not_required',
                    metrics_message = 'Stories não exigem métricas manuais.',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(id);

            return res.json(getContent(id));
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

        if (
            isLive &&
            Number(existing.approval_required ?? 1) !== 0 &&
            existing.approval_status !== "aprovado"
        ) {
            return res.status(409).json({
                error:
                    "O conteúdo final precisa ser aprovado pelo gerente antes de ser marcado como NO AR.",
            });
        }

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

            completeLinkedManagerRequestByContent(
                id,
                Number(existing.user_id),
                "✓ Demanda concluída automaticamente após a publicação ser marcada como NO AR."
            );
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

const REPORT_MONTH_NAMES = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
];

function getManagerRequestReportRows(year, month) {
    const periodKey = `${year}-${pad2(month)}`;

    return db.prepare(`
        SELECT
            r.*,
            u.name AS requester_name,
            u.nickname AS requester_nickname,
            u.role AS requester_role,
            u.department AS requester_department,
            au.name AS assigned_user_name,
            au.role AS assigned_user_role
        FROM manager_requests r
        JOIN users u ON u.id = r.requester_id
        LEFT JOIN users au ON au.id = r.assigned_user_id
        WHERE substr(r.created_at, 1, 7) = ?
        ORDER BY datetime(r.created_at), r.id
    `).all(periodKey);
}

function buildManagerRequestsReport(year, month) {
    const rows = getManagerRequestReportRows(year, month);
    const previous = previousMonth(year, month);
    const previousRows = getManagerRequestReportRows(previous.year, previous.month);

    const activeStatuses = new Set([
        "Recebido",
        "Revisão solicitada",
        "Aprovado",
        "Em andamento",
    ]);

    const approvedStatuses = new Set([
        "Aprovado",
        "Em andamento",
        "Concluído",
    ]);

    const total = rows.length;
    const active = rows.filter((item) => activeStatuses.has(item.status)).length;
    const approved = rows.filter((item) => approvedStatuses.has(item.status)).length;
    const completed = rows.filter((item) => item.status === "Concluído").length;
    const inReview = rows.filter((item) => item.status === "Revisão solicitada").length;
    const rejected = rows.filter((item) => item.status === "Reprovado").length;
    const cancelled = rows.filter(
        (item) =>
            item.status === "Cancelado" ||
            String(item.deleted_at || "").trim()
    ).length;
    const forwardedRows = rows.filter((item) => Number(item.assigned_content_id || 0) > 0);
    const forwarded = forwardedRows.length;

    const completionDurations = rows
        .filter((item) => item.status === "Concluído" && item.created_at && item.updated_at)
        .map((item) => {
            const start = new Date(item.created_at).getTime();
            const end = new Date(item.updated_at).getTime();
            return Number.isFinite(start) && Number.isFinite(end) && end >= start
                ? (end - start) / (24 * 60 * 60 * 1000)
                : null;
        })
        .filter((value) => value !== null);

    const forwardDurations = forwardedRows
        .filter((item) => item.created_at && item.assigned_at)
        .map((item) => {
            const start = new Date(item.created_at).getTime();
            const end = new Date(item.assigned_at).getTime();
            return Number.isFinite(start) && Number.isFinite(end) && end >= start
                ? (end - start) / (24 * 60 * 60 * 1000)
                : null;
        })
        .filter((value) => value !== null);

    const average = (items) =>
        items.length
            ? Number((items.reduce((sum, value) => sum + value, 0) / items.length).toFixed(1))
            : 0;

    function grouped(items, keyFn) {
        const map = new Map();

        items.forEach((item) => {
            const raw = keyFn(item);
            const key = String(raw || "Não informado").trim() || "Não informado";
            map.set(key, Number(map.get(key) || 0) + 1);
        });

        return [...map.entries()]
            .map(([name, count]) => ({
                name,
                count,
                share: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
            }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
    }

    const requesterMap = new Map();

    rows.forEach((item) => {
        const key = Number(item.requester_id);
        const current = requesterMap.get(key) || {
            id: key,
            name: item.requester_nickname || item.requester_name || "Não informado",
            full_name: item.requester_name || "",
            role: item.requester_role || "Gerente",
            department: item.requester_department || "",
            count: 0,
            completed: 0,
            active: 0,
            in_review: 0,
            rejected: 0,
            forwarded: 0,
        };

        current.count += 1;
        if (item.status === "Concluído") current.completed += 1;
        if (activeStatuses.has(item.status)) current.active += 1;
        if (item.status === "Revisão solicitada") current.in_review += 1;
        if (item.status === "Reprovado") current.rejected += 1;
        if (Number(item.assigned_content_id || 0) > 0) current.forwarded += 1;

        requesterMap.set(key, current);
    });

    const byRequester = [...requesterMap.values()]
        .map((item) => ({
            ...item,
            share: total > 0 ? Number(((item.count / total) * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));

    const byBrand = grouped(rows, (item) => item.brand || "Grupo / Geral");
    const byType = grouped(rows, (item) => item.request_type || "Outro");
    const byPriority = grouped(rows, (item) => item.priority || "Normal");

    const destinationCounts = {
        "Social Media": 0,
        "Design": 0,
        "Aguardando encaminhamento": 0,
    };

    rows.forEach((item) => {
        if (!Number(item.assigned_content_id || 0)) {
            if (approvedStatuses.has(item.status)) {
                destinationCounts["Aguardando encaminhamento"] += 1;
            }
            return;
        }

        const role = String(item.assigned_user_role || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();

        if (role.includes("design")) {
            destinationCounts["Design"] += 1;
        } else {
            destinationCounts["Social Media"] += 1;
        }
    });

    const byDestination = Object.entries(destinationCounts)
        .map(([name, count]) => ({
            name,
            count,
            share: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
        }))
        .filter((item) => item.count > 0);

    const byStatus = grouped(rows, (item) => item.status || "Recebido");

    const yearRows = db.prepare(`
        SELECT created_at
        FROM manager_requests
        WHERE substr(created_at, 1, 4) = ?
    `).all(String(year));

    const yearly = Array.from({ length: 12 }, (_, index) => {
        const monthNumber = index + 1;
        const count = yearRows.filter(
            (item) => Number(String(item.created_at || "").slice(5, 7)) === monthNumber
        ).length;

        return { month: monthNumber, requests: count };
    });

    return {
        summary: {
            total,
            active,
            approved,
            forwarded,
            completed,
            in_review: inReview,
            rejected,
            cancelled,
            completion_rate:
                total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0,
            forward_rate:
                total > 0 ? Number(((forwarded / total) * 100).toFixed(1)) : 0,
            avg_completion_days: average(completionDurations),
            avg_forward_days: average(forwardDurations),
        },
        comparison: {
            total: percentChange(total, previousRows.length),
        },
        highlights: {
            top_requester: byRequester[0] || null,
            top_brand: byBrand[0] || null,
            top_type: byType[0] || null,
        },
        by_requester: byRequester,
        by_brand: byBrand,
        by_type: byType,
        by_priority: byPriority,
        by_destination: byDestination,
        by_status: byStatus,
        yearly,
    };
}

function buildMarketingReportData(year, month) {
    const currentItems = getReportContents(year, month);
    const previous = previousMonth(year, month);
    const previousItems = getReportContents(previous.year, previous.month);
    const currentSummary = buildReportSummary(currentItems);
    const previousSummary = buildReportSummary(previousItems);

    const publishedItems = currentItems.filter((item) => Boolean(item.is_live));
    const performanceItems = publishedItems.filter(
        (item) => !isStoriesFormat(item.format)
    );
    const ranking = buildRanking(performanceItems);
    const byBrand = groupPerformance(performanceItems, (item) => item.brands);
    const byFormat = groupPerformance(performanceItems, (item) => item.format);
    const byCollaborator = groupPerformance(
        performanceItems,
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

    return {
        period: { year, month },
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
        },
        by_brand: byBrand,
        by_format: byFormat,
        by_collaborator: byCollaborator,
        creative: buildCreativeReport(year, month),
        manager_requests: buildManagerRequestsReport(year, month),
        attention: buildAttention(currentItems, ranking),
    };
}

function pdfNumber(value) {
    return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function pdfPercent(value) {
    return `${Number(value || 0).toFixed(1).replace(".", ",")}%`;
}

function addPdfSectionTitle(doc, title, subtitle = "") {
    if (doc.y > doc.page.height - 110) doc.addPage();

    doc.moveDown(0.7);
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#17191d").text(title);

    if (subtitle) {
        doc.moveDown(0.15);
        doc.font("Helvetica").fontSize(8.5).fillColor("#6f7379").text(subtitle);
    }

    doc.moveDown(0.45);
    doc.strokeColor("#d1b274").lineWidth(1).moveTo(42, doc.y).lineTo(doc.page.width - 42, doc.y).stroke();
    doc.moveDown(0.55);
}

function addPdfKpi(doc, x, y, width, label, value, detail = "") {
    doc.roundedRect(x, y, width, 70, 8).fillAndStroke("#f4f1eb", "#ded8cd");
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#8f7440").text(label, x + 11, y + 10, {
        width: width - 22,
    });
    doc.font("Helvetica-Bold").fontSize(20).fillColor("#17191d").text(String(value), x + 11, y + 25, {
        width: width - 22,
    });
    if (detail) {
        doc.font("Helvetica").fontSize(7).fillColor("#777b81").text(detail, x + 11, y + 52, {
            width: width - 22,
        });
    }
}

function addPdfTableRow(doc, columns, widths, options = {}) {
    const startX = 42;
    const rowHeight = options.height || 22;

    if (doc.y + rowHeight > doc.page.height - 48) doc.addPage();

    const rowY = doc.y;
    let x = startX;

    columns.forEach((value, index) => {
        const width = widths[index];

        if (options.header) {
            doc.rect(x, rowY, width, rowHeight).fill("#20252c");
            doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#ffffff");
        } else {
            doc.rect(x, rowY, width, rowHeight).fillAndStroke(
                options.alt ? "#f7f5f1" : "#ffffff",
                "#e5e1da"
            );
            doc.font("Helvetica").fontSize(7.5).fillColor("#272b30");
        }

        doc.text(String(value ?? ""), x + 6, rowY + 7, {
            width: width - 12,
            height: rowHeight - 8,
            ellipsis: true,
            lineBreak: false,
        });

        x += width;
    });

    doc.y = rowY + rowHeight;
}

function renderMarketingPdf(res, report) {
    const doc = new PDFDocument({
        size: "A4",
        margin: 42,
        info: {
            Title: `SQUAD - Relatório ${REPORT_MONTH_NAMES[report.period.month - 1]} ${report.period.year}`,
            Author: "SQUAD Social Planner",
        },
    });

    const filename = `SQUAD-Relatorio-${REPORT_MONTH_NAMES[report.period.month - 1]}-${report.period.year}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    const pageWidth = doc.page.width;
    doc.rect(0, 0, pageWidth, 104).fill("#12171e");
    doc.rect(0, 100, pageWidth, 4).fill("#c9a35e");

    doc.font("Helvetica-Bold").fontSize(10).fillColor("#d5b879").text("SQUAD", 42, 28);
    doc.font("Helvetica-Bold").fontSize(24).fillColor("#ffffff").text("Relatório mensal de Marketing", 42, 45);
    doc.font("Helvetica").fontSize(10).fillColor("#c9cdd2").text(
        `${REPORT_MONTH_NAMES[report.period.month - 1]} de ${report.period.year}`,
        42,
        76
    );

    doc.y = 124;

    addPdfSectionTitle(doc, "Resumo executivo", "Visão consolidada do desempenho e da produção do mês.");

    const gap = 8;
    const kpiWidth = (pageWidth - 84 - gap * 2) / 3;
    let kpiY = doc.y;
    addPdfKpi(doc, 42, kpiY, kpiWidth, "CONTEÚDOS PUBLICADOS", pdfNumber(report.summary.published));
    addPdfKpi(doc, 42 + kpiWidth + gap, kpiY, kpiWidth, "VISUALIZAÇÕES", pdfNumber(report.summary.views));
    addPdfKpi(doc, 42 + (kpiWidth + gap) * 2, kpiY, kpiWidth, "CURTIDAS", pdfNumber(report.summary.likes));
    kpiY += 78;
    addPdfKpi(doc, 42, kpiY, kpiWidth, "COMPARTILHAMENTOS", pdfNumber(report.summary.shares));
    addPdfKpi(doc, 42 + kpiWidth + gap, kpiY, kpiWidth, "COBERTURA DE MÉTRICAS", pdfPercent(report.summary.metricsCoverage));
    addPdfKpi(doc, 42 + (kpiWidth + gap) * 2, kpiY, kpiWidth, "PEÇAS DE DESIGN", pdfNumber(report.creative?.summary?.pieces));
    doc.y = kpiY + 76;

    addPdfSectionTitle(doc, "Produção criativa", "Volume de trabalho aprovado pela gerência no período.");
    const creativeSummary = report.creative?.summary || {};
    doc.font("Helvetica").fontSize(9).fillColor("#35393f").text(
        `Demandas finalizadas: ${pdfNumber(creativeSummary.demands)}   |   Peças produzidas: ${pdfNumber(creativeSummary.pieces)}   |   Criadores ativos: ${pdfNumber(creativeSummary.creators)}   |   Tempo médio: ${Number(creativeSummary.avg_days || 0).toFixed(1).replace(".", ",")} dias`
    );
    doc.moveDown(0.7);

    if (report.creative?.by_brand?.length) {
        addPdfTableRow(doc, ["Marca", "Demandas", "Peças"], [290, 95, 95], { header: true });
        report.creative.by_brand.forEach((item, index) => {
            addPdfTableRow(doc, [item.name, pdfNumber(item.demands), pdfNumber(item.pieces)], [290, 95, 95], { alt: index % 2 === 1 });
        });
    }

    if (report.creative?.by_creator?.length) {
        doc.moveDown(0.55);
        addPdfTableRow(doc, ["Criador", "Demandas", "Peças"], [290, 95, 95], { header: true });
        report.creative.by_creator.forEach((item, index) => {
            addPdfTableRow(doc, [item.user?.nickname || item.name, pdfNumber(item.demands), pdfNumber(item.pieces)], [290, 95, 95], { alt: index % 2 === 1 });
        });
    }

    if (report.creative?.by_type?.length) {
        doc.moveDown(0.55);
        addPdfTableRow(doc, ["Tipo de peça", "Demandas", "Peças"], [290, 95, 95], { header: true });
        report.creative.by_type.forEach((item, index) => {
            addPdfTableRow(doc, [item.name, pdfNumber(item.demands), pdfNumber(item.pieces)], [290, 95, 95], { alt: index % 2 === 1 });
        });
    }

    const managerRequests = report.manager_requests || {};
    const managerRequestSummary = managerRequests.summary || {};

    addPdfSectionTitle(
        doc,
        "Demandas dos Gerentes",
        "Pedidos enviados pelos outros gerentes ao Marketing no período."
    );

    doc.font("Helvetica").fontSize(9).fillColor("#35393f").text(
        `Pedidos recebidos: ${pdfNumber(managerRequestSummary.total)}   |   Encaminhados ao SQUAD: ${pdfNumber(managerRequestSummary.forwarded)}   |   Concluídos: ${pdfNumber(managerRequestSummary.completed)}   |   Em revisão: ${pdfNumber(managerRequestSummary.in_review)}   |   Tempo médio para concluir: ${Number(managerRequestSummary.avg_completion_days || 0).toFixed(1).replace(".", ",")} dias`
    );
    doc.moveDown(0.7);

    if (managerRequests.by_requester?.length) {
        addPdfTableRow(
            doc,
            ["Gerente", "Pedidos", "Em aberto", "Concluídos", "% do total"],
            [220, 70, 70, 70, 70],
            { header: true }
        );

        managerRequests.by_requester.slice(0, 10).forEach((item, index) => {
            addPdfTableRow(
                doc,
                [
                    item.name,
                    pdfNumber(item.count),
                    pdfNumber(item.active),
                    pdfNumber(item.completed),
                    pdfPercent(item.share),
                ],
                [220, 70, 70, 70, 70],
                { alt: index % 2 === 1 }
            );
        });
    }

    addPdfSectionTitle(doc, "Performance por marca", "Views, curtidas e compartilhamentos das publicações do mês.");
    addPdfTableRow(doc, ["Marca", "Posts", "Views", "Curtidas", "Compart."], [180, 60, 95, 75, 70], { header: true });
    (report.by_brand || []).forEach((item, index) => {
        addPdfTableRow(
            doc,
            [item.name, pdfNumber(item.publications), pdfNumber(item.views), pdfNumber(item.likes), pdfNumber(item.shares)],
            [180, 60, 95, 75, 70],
            { alt: index % 2 === 1 }
        );
    });

    addPdfSectionTitle(doc, "Performance por formato");
    addPdfTableRow(doc, ["Formato", "Posts", "Views", "Curtidas", "Compart."], [180, 60, 95, 75, 70], { header: true });
    (report.by_format || []).forEach((item, index) => {
        addPdfTableRow(
            doc,
            [item.name, pdfNumber(item.publications), pdfNumber(item.views), pdfNumber(item.likes), pdfNumber(item.shares)],
            [180, 60, 95, 75, 70],
            { alt: index % 2 === 1 }
        );
    });

    addPdfSectionTitle(doc, "Ranking de conteúdos", "Índice SQUAD calculado por visualizações, curtidas e compartilhamentos.");
    addPdfTableRow(doc, ["#", "Conteúdo", "Marca", "Views", "Curtidas", "Compart.", "Índice"], [28, 160, 80, 60, 60, 58, 48], { header: true });
    (report.ranking || []).slice(0, 10).forEach((item, index) => {
        addPdfTableRow(
            doc,
            [
                `${index + 1}º`,
                item.title,
                (item.brands || []).join(" + "),
                pdfNumber(item.metric_views),
                pdfNumber(item.metric_likes),
                pdfNumber(item.metric_shares),
                `${item.squad_score}/100`,
            ],
            [28, 160, 80, 60, 60, 58, 48],
            { alt: index % 2 === 1 }
        );
    });

    addPdfSectionTitle(doc, "Performance por colaborador", "Resultados das publicações atribuídas a cada colaborador.");
    addPdfTableRow(doc, ["Colaborador", "Posts", "Views", "Curtidas", "Compart."], [185, 60, 95, 75, 65], { header: true });
    (report.by_collaborator || []).forEach((item, index) => {
        addPdfTableRow(
            doc,
            [item.user?.nickname || item.name, pdfNumber(item.publications), pdfNumber(item.views), pdfNumber(item.likes), pdfNumber(item.shares)],
            [185, 60, 95, 75, 65],
            { alt: index % 2 === 1 }
        );
    });

    if (report.attention?.length) {
        addPdfSectionTitle(doc, "Pontos de atenção");
        report.attention.forEach((item) => {
            if (doc.y > doc.page.height - 80) doc.addPage();
            const boxY = doc.y;
            doc.roundedRect(42, boxY, pageWidth - 84, 48, 7).fillAndStroke("#faf7f0", "#eadfc7");
            doc.font("Helvetica-Bold").fontSize(9).fillColor("#3b3020").text(item.title, 54, boxY + 10, { width: pageWidth - 108, lineBreak: false });
            doc.font("Helvetica").fontSize(8).fillColor("#6e6559").text(item.description || "", 54, boxY + 25, { width: pageWidth - 108, lineBreak: false, ellipsis: true });
            doc.y = boxY + 56;
        });
    }

    doc.moveDown(1.2);
    if (doc.y > doc.page.height - 60) doc.addPage();
    doc.font("Helvetica").fontSize(7.5).fillColor("#8a8e94").text(
        `Gerado pelo SQUAD Social Planner em ${new Date().toLocaleString("pt-BR")}.`,
        42,
        doc.y,
        { align: "center", width: pageWidth - 84 }
    );

    doc.end();
}

app.get("/api/reports/marketing", (req, res) => {
    try {
        if (!requireManagerRequest(req, res)) return;
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

        const publishedItems = currentItems.filter((item) => Boolean(item.is_live));
        const performanceItems = publishedItems.filter(
            (item) => !isStoriesFormat(item.format)
        );

        const ranking = buildRanking(performanceItems);
        const byBrand = groupPerformance(
            performanceItems,
            (item) => item.brands
        );
        const byFormat = groupPerformance(
            performanceItems,
            (item) => item.format
        );
        const byCollaborator = groupPerformance(
            performanceItems,
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
                    "Métricas manuais. Stories entram apenas pela quantidade publicada e não exigem métricas. O Índice SQUAD usa visualizações, curtidas e compartilhamentos dos demais formatos.",
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
            manager_requests: buildManagerRequestsReport(year, month),
            attention: buildAttention(currentItems, ranking),
            yearly,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao gerar relatório do Marketing." });
    }
});

app.get("/api/reports/marketing/pdf", (req, res) => {
    try {
        const managerId = Number(req.query.manager_id);
        if (!requireManagerRequest(req, res, managerId)) return;
        const year = Number(req.query.year);
        const month = Number(req.query.month);

        if (!isManagerUserId(managerId)) {
            return res.status(403).json({
                error: "Apenas o perfil Gerente pode baixar o relatório em PDF.",
            });
        }

        if (!year || month < 1 || month > 12) {
            return res.status(400).json({ error: "Ano e mês inválidos." });
        }

        if (!PDFDocument) {
            return res.status(503).json({
                error:
                    "O gerador de PDF ainda não está instalado. Execute uma vez o arquivo INSTALAR_PDF_RELATORIO.bat e reinicie o SQUAD.",
            });
        }

        const report = buildMarketingReportData(year, month);
        renderMarketingPdf(res, report);
    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Erro ao gerar relatório em PDF." });
        }
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

try {
    const linkedDesignerRequests =
        backfillDesignerManagerRequestJobs();

    if (linkedDesignerRequests > 0) {
        console.log(
            `Pedidos de gestores: ${linkedDesignerRequests} produção(ões) de Design criada(s)/vinculada(s) automaticamente.`
        );
    }
} catch (error) {
    console.error(
        "Vínculo automático dos pedidos de Design:",
        error.message
    );
}

try {
    syncAllAchievementUnlocks();
} catch (error) {
    console.error(
        "Conquistas automáticas no início:",
        error.message
    );
}

try {
    const summariesCreatedOnStart =
        generateScheduledSummaries();

    if (summariesCreatedOnStart > 0) {
        console.log(
            `SQUAD: ${summariesCreatedOnStart} resumo(s) de desempenho criado(s).`
        );
    }
} catch (error) {
    console.error(
        "Resumos automáticos no início:",
        error.message
    );
}

const purgedOnStart = purgeExpiredTrash();
if (purgedOnStart > 0) {
    console.log(`Lixeira: ${purgedOnStart} conteúdo(s) expirado(s) removido(s).`);
}

const notificationsPurgedOnStart = purgeExpiredNotifications();
if (notificationsPurgedOnStart > 0) {
    console.log(
        `Notificações: ${notificationsPurgedOnStart} registro(s) com mais de 30 dias foram removidos.`
    );
}

const contentVideosPurgedOnStart = purgeExpiredContentVideos();
if (contentVideosPurgedOnStart > 0) {
    console.log(
        `Social Media: ${contentVideosPurgedOnStart} vídeo(s) com mais de 30 dias após publicação foram removidos.`
    );
}

const creativePurgedOnStart = purgeExpiredCreativeFiles();
if (creativePurgedOnStart > 0) {
    console.log(
        `Central Criativa: arquivos de ${creativePurgedOnStart} entrega(s) expiradas foram removidos.`
    );
}

refreshJoinvilleWeather(false).catch((error) => {
    console.error(
        "Previsão inicial do tempo:",
        error.message
    );
});

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
        const unlocked =
            syncAllAchievementUnlocks();

        if (unlocked > 0) {
            console.log(
                `SQUAD: ${unlocked} nova(s) conquista(s) desbloqueada(s).`
            );
        }
    } catch (error) {
        console.error(
            "Conquistas automáticas:",
            error.message
        );
    }
}, 10 * 60 * 1000);

setInterval(() => {
    try {
        generateScheduledSummaries();
    } catch (error) {
        console.error(
            "Resumos automáticos:",
            error.message
        );
    }
}, 10 * 60 * 1000);

setInterval(() => {
    refreshJoinvilleWeather(true).catch((error) => {
        console.error(
            "Atualização automática da previsão:",
            error.message
        );
    });
}, WEATHER_CACHE_MS);

setInterval(() => {
    try {
        purgeExpiredNotifications();
    } catch (error) {
        console.error(
            "Limpeza automática de notificações:",
            error.message
        );
    }
}, 60 * 60 * 1000);

setInterval(() => {
    try {
        purgeExpiredTrash();
    } catch (error) {
        console.error("Limpeza automática da lixeira:", error.message);
    }
}, 60 * 60 * 1000);

setInterval(() => {
    try {
        purgeExpiredContentVideos();
    } catch (error) {
        console.error(
            "Limpeza automática de vídeos do Social Media:",
            error.message
        );
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
