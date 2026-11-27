import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const ANOS_CALENDARIO = [2026, 2027, 2028];
const MESES = [
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
const MARCAS = [
    "Jeep",
    "RAM",
    "Kia",
    "Honda",
    "Premier Seminovos",
    "Shineray",
    "YADEA",
    "Squad",
];
const FORMATOS = ["Reels", "Feed", "Carrossel", "Stories", "Vídeo", "Foto", "Campanha", "Outro"];

function isStoriesFormat(value) {
    const normalized = String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    return ["stories", "story", "storys"].includes(normalized);
}

const CREATIVE_TYPES = [
    "Feed",
    "Stories",
    "Carrossel",
    "Banner",
    "Impresso",
    "Outdoor",
    "Apresentação",
    "Material interno",
    "Vídeo",
    "Outro",
];
const STATUS = [
    "Ideia",
    "Aguardando aprovação da ideia",
    "Planejado",
    "Em produção",
    "Em edição",
    "Aguardando aprovação final",
    "Ajuste solicitado",
    "Aprovado",
    "Agendado",
    "Publicado",
    "Finalizado",
    "Cancelado",
];

const STATUS_PLANEJAMENTO = STATUS.filter(
    (item) =>
        ![
            "Aguardando aprovação da ideia",
            "Aguardando aprovação final",
            "Aprovado",
            "Publicado",
        ].includes(item)
);

function statusDisponiveisConteudo(conteudo) {
    if (!conteudo) return ["Ideia"];

    const manterAtual = (opcoes) => {
        if (
            conteudo.status &&
            !opcoes.includes(conteudo.status)
        ) {
            return [conteudo.status, ...opcoes];
        }

        return opcoes;
    };

    const vinculadoAoGestor = Boolean(conteudo.manager_request?.id);
    const pedidoConcluido =
        conteudo.manager_request?.status === "Concluído";

    const comFinalizado = (opcoes) =>
        vinculadoAoGestor && !pedidoConcluido
            ? [...opcoes, "Finalizado"]
            : opcoes;

    if (conteudo.is_live) return ["Publicado"];

    if (pedidoConcluido) {
        return manterAtual(["Finalizado"]);
    }

    if (conteudo.approval_required === false) {
        return manterAtual(
            comFinalizado([
                "Ideia",
                "Planejado",
                "Em produção",
                "Em edição",
                "Aprovado",
                "Agendado",
                "Cancelado",
            ])
        );
    }

    if (conteudo.approval_stage === "idea") {
        return manterAtual(["Aguardando aprovação da ideia"]);
    }

    if (conteudo.approval_stage === "final") {
        return manterAtual(["Aguardando aprovação final"]);
    }

    if (conteudo.approval_status === "aprovado") {
        return manterAtual(
            comFinalizado(["Aprovado", "Agendado", "Cancelado"])
        );
    }

    if (conteudo.approval_status === "alteracao") {
        return manterAtual(["Ajuste solicitado", "Em edição", "Cancelado"]);
    }

    if (conteudo.idea_approval_status === "aprovado") {
        return manterAtual([
            "Planejado",
            "Em produção",
            "Em edição",
            "Cancelado",
        ]);
    }

    return manterAtual(["Ideia", "Cancelado"]);
}
const URGENCIAS = [
    { value: "verde", label: "Baixa" },
    { value: "amarelo", label: "Média" },
    { value: "vermelho", label: "Alta" },
];

const BRAND_CLASS_MAP = {
    Jeep: "brand-jeep",
    RAM: "brand-ram",
    Kia: "brand-kia",
    Honda: "brand-honda",
    "Premier Seminovos": "brand-premier",
    Shineray: "brand-shineray",
    YADEA: "brand-yadea",
    Squad: "brand-squad",
};

function brandClassName(brand) {
    return BRAND_CLASS_MAP[brand] || "";
}

function isManagerProfile(user) {
    return String(user?.access_role || "colaborador").toLowerCase() === "gerente";
}

function isExternalManager(user) {
    return String(user?.access_role || "").toLowerCase() === "gestor_externo";
}

function creativeRecipients(users = []) {
    return users.filter((user) => !isManagerProfile(user));
}

function normalizeSquadRole(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function squadRoleGroup(user) {
    const originalRole = String(user?.role || "").trim();
    const normalized = normalizeSquadRole(originalRole);

    if (normalized.includes("design")) {
        return {
            key: "design",
            label: "Design",
            subtitle: "Criação visual e produção de peças",
            icon: "◆",
            order: 2,
        };
    }

    if (
        normalized.includes("audiovisual") ||
        normalized.includes("audio visual") ||
        normalized.includes("video") ||
        normalized.includes("motion")
    ) {
        return {
            key: "audiovisual",
            label: "Audiovisual",
            subtitle: "Vídeo, motion e produção audiovisual",
            icon: "▶",
            order: 3,
        };
    }

    if (
        normalized.includes("social") ||
        normalized.includes("conteudo") ||
        normalized.includes("conteúdo")
    ) {
        return {
            key: "social-media",
            label: "Social Media",
            subtitle: "Planejamento, publicação e performance",
            icon: "●",
            order: 1,
        };
    }

    if (
        normalized.includes("trafego") ||
        normalized.includes("tráfego") ||
        normalized.includes("midia") ||
        normalized.includes("mídia")
    ) {
        return {
            key: "trafego",
            label: "Tráfego",
            subtitle: "Mídia paga e performance",
            icon: "↗",
            order: 4,
        };
    }

    if (normalized.includes("crm")) {
        return {
            key: "crm",
            label: "CRM",
            subtitle: "Relacionamento, leads e jornada",
            icon: "◎",
            order: 5,
        };
    }

    if (originalRole) {
        return {
            key: `cargo-${normalizeSquadRole(originalRole).replace(/[^a-z0-9]+/g, "-")}`,
            label: originalRole,
            subtitle: "Equipe de Marketing",
            icon: "•",
            order: 20,
        };
    }

    return {
        key: "equipe",
        label: "Equipe",
        subtitle: "Colaboradores do SQUAD",
        icon: "•",
        order: 30,
    };
}

function groupSquadMembersByRole(users) {
    const map = new Map();

    users.forEach((user) => {
        const group = squadRoleGroup(user);

        if (!map.has(group.key)) {
            map.set(group.key, {
                ...group,
                users: [],
            });
        }

        map.get(group.key).users.push(user);
    });

    return Array.from(map.values())
        .map((group) => ({
            ...group,
            users: group.users.sort((a, b) =>
                String(a.nickname || a.name || "").localeCompare(
                    String(b.nickname || b.name || ""),
                    "pt-BR"
                )
            ),
        }))
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "pt-BR"));
}

function chaveData(data) {
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
        data.getDate()
    ).padStart(2, "0")}`;
}

function dataDaChave(chave) {
    const [ano, mes, dia] = String(chave).slice(0, 10).split("-").map(Number);
    return new Date(ano, mes - 1, dia);
}

function inicioDaSemana(data) {
    const nova = new Date(data);
    const dia = (nova.getDay() + 6) % 7;
    nova.setDate(nova.getDate() - dia);
    nova.setHours(0, 0, 0, 0);
    return nova;
}

function mesmoDia(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function nomeUrgencia(value) {
    if (value === "vermelho") return "Alta";
    if (value === "amarelo") return "Média";
    return "Baixa";
}

function labelAprovacao(value) {
    switch (value) {
        case "aprovado":
            return "Aprovado";
        case "alteracao":
            return "Alteração solicitada";
        case "reprovado":
            return "Reprovado";
        case "nao_enviada":
            return "Ainda não enviado";
        default:
            return "Aguardando aprovação";
    }
}

function etapaAprovacaoGerente(conteudo) {
    return conteudo?.manager_view_stage || conteudo?.approval_stage || "none";
}

function labelEtapaAprovacao(conteudo) {
    return etapaAprovacaoGerente(conteudo) === "idea"
        ? "Aprovação de ideia"
        : "Aprovação final";
}

function labelAprovacaoConteudo(conteudo) {
    if (!conteudo) return "Ideia em preparação";
    if (conteudo.is_live) return "No ar";

    if (conteudo.approval_required === false) {
        return "Liberado para publicar";
    }

    if (
        conteudo.approval_stage === "idea" &&
        conteudo.idea_approval_status === "pendente"
    ) {
        return "Ideia aguardando aprovação";
    }

    if (conteudo.idea_approval_status === "alteracao") {
        return "Ajuste na ideia solicitado";
    }

    if (
        conteudo.approval_stage === "final" &&
        conteudo.approval_status === "pendente"
    ) {
        return "Conteúdo final aguardando aprovação";
    }

    if (conteudo.approval_status === "alteracao") {
        return "Ajuste no conteúdo final";
    }

    if (conteudo.approval_status === "aprovado") {
        return "Conteúdo final aprovado";
    }

    if (conteudo.idea_approval_status === "aprovado") {
        return "Ideia aprovada";
    }

    return "Ideia em preparação";
}

function classeAprovacaoConteudo(conteudo) {
    if (!conteudo) return "approval-draft";
    if (conteudo.is_live) return "approval-aprovado";

    if (conteudo.approval_required === false) {
        return "approval-aprovado";
    }

    if (
        conteudo.approval_stage === "idea" ||
        conteudo.approval_stage === "final"
    ) {
        return "approval-pendente";
    }

    if (
        conteudo.idea_approval_status === "alteracao" ||
        conteudo.approval_status === "alteracao"
    ) {
        return "approval-alteracao";
    }

    if (conteudo.approval_status === "aprovado") {
        return "approval-aprovado";
    }

    if (conteudo.idea_approval_status === "aprovado") {
        return "approval-idea-approved";
    }

    return "approval-draft";
}

function classeProcesso(conteudo) {
    if (conteudo?.is_live) return "process-live";
    if (conteudo?.approval_required === false) return "process-approved";
    if (conteudo?.approval_status === "aprovado") return "process-approved";
    if (
        conteudo?.approval_status === "alteracao" ||
        conteudo?.idea_approval_status === "alteracao"
    ) {
        return "process-review";
    }
    if (conteudo?.approval_stage === "idea" || conteudo?.approval_stage === "final") {
        return "process-pending";
    }
    if (conteudo?.idea_approval_status === "aprovado") return "process-planned";
    return "process-draft";
}

function labelProcesso(conteudo) {
    if (conteudo?.is_live) return "No ar";
    return labelAprovacaoConteudo(conteudo);
}

function creativeStatusLabel(status) {
    switch (status) {
        case "aguardando_aprovacao":
            return "Aguardando aprovação";
        case "ajuste":
            return "Ajustes solicitados";
        case "aprovado":
            return "Aprovado e entregue";
        case "finalizado":
            return "Finalizado pelo destinatário";
        case "arquivado":
            return "Arquivado";
        default:
            return "Em produção";
    }
}

function creativeStatusClass(status) {
    if (status === "aprovado") return "creative-approved";
    if (status === "finalizado") return "creative-finished";
    if (status === "arquivado") return "creative-archived";
    if (status === "aguardando_aprovacao") return "creative-waiting";
    if (status === "ajuste") return "creative-adjust";
    return "creative-producing";
}

function dataPublicacaoConteudo(conteudo) {
    const publicada = String(conteudo?.published_at || "").trim().slice(0, 10);
    if (conteudo?.is_live && publicada) return publicada;
    return conteudo?.date || "";
}

function tempoRestanteLixeira(deletedAt, agora = Date.now()) {
    if (!deletedAt) return "";
    const apagadoEm = new Date(deletedAt).getTime();
    if (!Number.isFinite(apagadoEm)) return "";
    const restante = apagadoEm + 24 * 60 * 60 * 1000 - agora;
    if (restante <= 0) return "Expirando";
    const horas = Math.floor(restante / (60 * 60 * 1000));
    const minutos = Math.max(0, Math.ceil((restante % (60 * 60 * 1000)) / (60 * 1000)));
    if (horas <= 0) return `${minutos} min`;
    return `${horas}h ${minutos}min`;
}

function tempoRestanteTemporario(expiresAt, agora = Date.now()) {
    if (!expiresAt) return "";

    const expiraEm = new Date(expiresAt).getTime();
    if (!Number.isFinite(expiraEm)) return "";

    const restante = expiraEm - agora;
    if (restante <= 0) return "Expirando";

    const dias = Math.floor(restante / (24 * 60 * 60 * 1000));
    const horas = Math.floor(
        (restante % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)
    );

    if (dias > 0) return `${dias}d ${horas}h`;

    const minutos = Math.max(
        0,
        Math.ceil((restante % (60 * 60 * 1000)) / (60 * 1000))
    );

    if (horas > 0) return `${horas}h ${minutos}min`;
    return `${minutos} min`;
}

function linksValidos(value) {
    return String(value || "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter((item) => /^https?:\/\//i.test(item));
}

function initials(name) {
    return String(name || "?")
        .split(" ")
        .filter(Boolean)
        .map((item) => item[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function formatPercent(value, digits = 2) {
    return `${Number(value || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    })}%`;
}

function formatDateTime(value) {
    if (!value) return "Ainda não atualizado";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function isCreativeImage(file) {
    const mime = String(file?.mime_type || "").toLowerCase();
    const name = String(file?.original_name || file?.filename || "").toLowerCase();

    return mime.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(name);
}

function isCreativeVideo(file) {
    const mime = String(file?.mime_type || "").toLowerCase();
    const name = String(file?.original_name || file?.filename || "").toLowerCase();

    return mime.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(name);
}

function isCreativePdf(file) {
    const mime = String(file?.mime_type || "").toLowerCase();
    const name = String(file?.original_name || file?.filename || "").toLowerCase();

    return mime === "application/pdf" || /\.pdf$/i.test(name);
}

function creativeDownloadUrl(file) {
    return file?.download_url || file?.url || "#";
}

function comparisonText(value) {
    const number = Number(value || 0);
    if (number > 0) return `+${number.toLocaleString("pt-BR")}%`;
    return `${number.toLocaleString("pt-BR")}%`;
}

const AUTH_TOKEN_KEY = "squad_auth_token";
const ADMIN_TOKEN_KEY = "squad_admin_token";
const ADMIN_IMPERSONATION_KEY = "squad_admin_impersonation";

function storedAuthToken() {
    try {
        return window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
    } catch {
        return "";
    }
}

function storedAdminToken() {
    try {
        return window.sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
    } catch {
        return "";
    }
}

function storedAdminImpersonation() {
    try {
        const raw = window.sessionStorage.getItem(ADMIN_IMPERSONATION_KEY) || "";
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

async function request(url, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = storedAuthToken();
    const adminToken = storedAdminToken();

    if (url.startsWith("/api/") && token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
    }
    if (
        url.startsWith("/api/") &&
        adminToken &&
        (!token || url.startsWith("/api/admin/")) &&
        !headers.has("X-Squad-Admin-Token")
    ) {
        headers.set("X-Squad-Admin-Token", adminToken);
    }

    const response = await fetch(url, { ...options, headers });
    let data = {};
    try {
        data = await response.json();
    } catch {
        data = {};
    }
    if (!response.ok) {
        const error = new Error(data.error || "Erro na operação.");
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}

function nomeOriginalParaDownload(file, fallback = "arquivo") {
    const original = String(file?.original_name || "").trim();
    if (original) return original;

    const filename = String(file?.filename || "").trim();
    if (filename) return filename;

    return fallback;
}

async function baixarArquivoComNomeOriginal(file, kind = "content") {
    if (!file) return;

    const originalName = nomeOriginalParaDownload(
        file,
        kind === "creative" ? "arquivo-criativo" : "arquivo-conteudo"
    );

    const endpoint =
        file.download_url ||
        (kind === "creative"
            ? `/api/creative/files/${file.id}/download`
            : `/api/files/${file.id}/download`);

    if (!endpoint || endpoint === "#") {
        throw new Error("Não foi possível localizar o arquivo para download.");
    }

    const headers = new Headers();
    const token = storedAuthToken();
    const adminToken = storedAdminToken();

    if (endpoint.startsWith("/api/") && token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    if (
        endpoint.startsWith("/api/") &&
        adminToken &&
        (!token || endpoint.startsWith("/api/admin/"))
    ) {
        headers.set("X-Squad-Admin-Token", adminToken);
    }

    const response = await fetch(endpoint, { headers });

    if (!response.ok) {
        let message = "Erro ao baixar o arquivo.";
        try {
            const data = await response.json();
            message = data.error || message;
        } catch {
            // resposta de download pode não ser JSON
        }
        throw new Error(message);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    /*
     * O download é disparado a partir de um Blob local.
     * Isso impede o navegador de usar o nome interno/UUID da URL
     * e força o nome original salvo no banco.
     */
    link.href = objectUrl;
    link.download = originalName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}


function Avatar({ user, size = "medium", className = "" }) {
    const displayName = user?.nickname || user?.name || "Perfil";
    return (
        <div className={`avatar avatar-${size} ${className}`} title={displayName}>
            {user?.photo_url ? <img src={user.photo_url} alt={displayName} /> : <span>{initials(displayName)}</span>}
        </div>
    );
}

function App() {
    const hoje = new Date();
    const anoInicial = ANOS_CALENDARIO.includes(hoje.getFullYear()) ? hoje.getFullYear() : 2026;

    const [usuarios, setUsuarios] = useState([]);
    const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
    const [loginUsuario, setLoginUsuario] = useState(null);
    const [loginSenha, setLoginSenha] = useState("");
    const [loginConfirmacao, setLoginConfirmacao] = useState("");
    const [loginErro, setLoginErro] = useState("");
    const [loginProcessando, setLoginProcessando] = useState(false);
    const [areaAdminAtiva, setAreaAdminAtiva] = useState(false);
    const [portalEntrada, setPortalEntrada] = useState("home");
    const [pedidosGerentes, setPedidosGerentes] = useState([]);
    const [pedidoAberto, setPedidoAberto] = useState(null);
    const [pedidoUpdates, setPedidoUpdates] = useState([]);
    const [pedidoMensagem, setPedidoMensagem] = useState("");
    const [pedidoRevisaoAberta, setPedidoRevisaoAberta] = useState(false);
    const [pedidoRevisaoNota, setPedidoRevisaoNota] = useState("");
    const [pedidoDecidindo, setPedidoDecidindo] = useState(false);
    const [pedidoFiltro, setPedidoFiltro] = useState("Todos");
    const [managerPedidosAba, setManagerPedidosAba] = useState("analise");
    const [novoPedidoAberto, setNovoPedidoAberto] = useState(false);
    const [portalGestorAba, setPortalGestorAba] = useState("pedidos");
    const [pedidoCarregando, setPedidoCarregando] = useState(false);
    const [pedidoEncaminhamento, setPedidoEncaminhamento] = useState({ user_id: "", date: "", deadline: "", urgency: "verde" });
    const [pedidoDestinatarios, setPedidoDestinatarios] = useState([]);
    const [pedidoEncaminhando, setPedidoEncaminhando] = useState(false);
    const [pedidoForm, setPedidoForm] = useState({
        title: "",
        brand: "",
        request_type: "Arte / Material gráfico",
        desired_date: "",
        priority: "Normal",
        objective: "",
        target_audience: "",
        required_info: "",
        channels: [],
        print_dimensions: "",
        description: "",
        references_text: "",
    });
    const [pedidoReferenceFiles, setPedidoReferenceFiles] = useState([]);
    const pedidoReferenceInputRef = useRef(null);
    const [usuariosAdmin, setUsuariosAdmin] = useState([]);
    const [adminHistorico, setAdminHistorico] = useState([]);
    const [adminAba, setAdminAba] = useState("usuarios");
    const [adminImpersonando, setAdminImpersonando] = useState(() => storedAdminImpersonation());
    const [abaAtiva, setAbaAtiva] = useState("calendario");
    const [conteudos, setConteudos] = useState([]);
    const [lembretes, setLembretes] = useState([]);
    const [dataAtual, setDataAtual] = useState(new Date(anoInicial, hoje.getMonth(), 1));
    const [modo, setModo] = useState("mensal");
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");

    const [diaSelecionado, setDiaSelecionado] = useState(null);
    const [planejamentoAberto, setPlanejamentoAberto] = useState(false);
    const [tipoPlanejamento, setTipoPlanejamento] = useState("social");
    const [salvando, setSalvando] = useState(false);
    const [form, setForm] = useState({
        titulo: "",
        marcas: [],
        formato: "Reels",
        status: "Ideia",
        responsavel: "",
        urgencia: "verde",
        approval_required: true,
    });

    const [filtroMarca, setFiltroMarca] = useState("");
    const [filtroFormato, setFiltroFormato] = useState("");
    const [filtroStatus, setFiltroStatus] = useState("");

    const [weatherWeek, setWeatherWeek] = useState({
        city: "Joinville",
        days: [],
        calendar_days: [],
        updated_at: "",
        stale: false,
    });
    const [weatherLoading, setWeatherLoading] = useState(false);
    const [weatherError, setWeatherError] = useState("");

    const [draggedContentId, setDraggedContentId] = useState(null);
    const [dragOverDate, setDragOverDate] = useState("");
    const [calendarMoveNotice, setCalendarMoveNotice] = useState("");

    const [chatData, setChatData] = useState({
        messages: [],
        unread_count: 0,
    });
    const [chatText, setChatText] = useState("");
    const [chatSending, setChatSending] = useState(false);
    const [chatAberto, setChatAberto] = useState(false);
    const chatEndRef = useRef(null);

    const [achievementsData, setAchievementsData] = useState({
        mode: "collaborator",
        role_type: "",
        role_label: "",
        summary: {
            unlocked: 0,
            total: 0,
            percent: 0,
            next: null,
        },
        sections: [],
        squad: {
            unlocked: 0,
            total: 0,
            percent: 0,
            sections: [],
        },
        recent_unlocked: [],
    });
    const [achievementsLoading, setAchievementsLoading] = useState(false);
    const [achievementsError, setAchievementsError] = useState("");

    const [performanceData, setPerformanceData] = useState({
        role_type: "",
        weekly: [],
        monthly: [],
    });
    const [monthlyOverview, setMonthlyOverview] = useState(null);
    const [monthlyOverviewLoading, setMonthlyOverviewLoading] = useState(false);
    const [monthlyOverviewError, setMonthlyOverviewError] = useState("");
    const [monthlyOverviewMonth, setMonthlyOverviewMonth] = useState(hoje.getMonth() + 1);
    const [monthlyOverviewYear, setMonthlyOverviewYear] = useState(anoInicial);
    const [performanceTab, setPerformanceTab] = useState("weekly");
    const [performanceLoading, setPerformanceLoading] = useState(false);
    const [performanceError, setPerformanceError] = useState("");

    const [novoColaboradorAberto, setNovoColaboradorAberto] = useState(false);
    const [novoColaboradorNome, setNovoColaboradorNome] = useState("");
    const [novoColaboradorTipo, setNovoColaboradorTipo] = useState("colaborador");
    const [novoColaboradorCargo, setNovoColaboradorCargo] = useState("");
    const [novoColaboradorSetor, setNovoColaboradorSetor] = useState("");
    const [novoColaboradorMarca, setNovoColaboradorMarca] = useState("");
    const [adminUsuarioEditando, setAdminUsuarioEditando] = useState(null);
    const [adminEditNome, setAdminEditNome] = useState("");
    const [adminEditCargo, setAdminEditCargo] = useState("");
    const [adminEditSetor, setAdminEditSetor] = useState("");
    const [adminEditMarcas, setAdminEditMarcas] = useState([]);

    const [buscaConteudo, setBuscaConteudo] = useState("");
    const [conteudosMes, setConteudosMes] = useState(hoje.getMonth() + 1);
    const [conteudosAno, setConteudosAno] = useState(anoInicial);
    const [conteudosTab, setConteudosTab] = useState("andamento");
    const [retornosSocialAberto, setRetornosSocialAberto] = useState(false);
    const [lixeiraConteudos, setLixeiraConteudos] = useState([]);
    const [lixeiraAberta, setLixeiraAberta] = useState(false);
    const [relogioLixeira, setRelogioLixeira] = useState(Date.now());
    const [conteudoAberto, setConteudoAberto] = useState(null);
    const [detalheForm, setDetalheForm] = useState(null);
    const [arquivosSelecionados, setArquivosSelecionados] = useState([]);
    const [enviandoArquivo, setEnviandoArquivo] = useState(false);

    const [revisaoAberta, setRevisaoAberta] = useState(false);
    const [revisaoId, setRevisaoId] = useState(null);
    const [revisaoTipo, setRevisaoTipo] = useState("alteracao");
    const [revisaoNota, setRevisaoNota] = useState("");

    const [adminLiberado, setAdminLiberado] = useState(false);
    const [senhaAdmin, setSenhaAdmin] = useState("");
    const [adminErro, setAdminErro] = useState("");
    const [adminCarregando, setAdminCarregando] = useState(false);
    const [senhaAtualPerfil, setSenhaAtualPerfil] = useState("");
    const [novaSenhaPerfil, setNovaSenhaPerfil] = useState("");
    const [confirmarSenhaPerfil, setConfirmarSenhaPerfil] = useState("");
    const [salvandoSenhaPerfil, setSalvandoSenhaPerfil] = useState(false);

    const [anoLembretes, setAnoLembretes] = useState(anoInicial);
    const [novoLembreteAberto, setNovoLembreteAberto] = useState(false);
    const [lembreteForm, setLembreteForm] = useState({
        title: "",
        date: `${anoInicial}-01-01`,
        type: "Personalizado",
        city: "",
        note: "",
    });

    const [perfilForm, setPerfilForm] = useState({ name: "", nickname: "", role: "", brands: [] });
    const [fotoPerfil, setFotoPerfil] = useState(null);
    const [salvandoPerfil, setSalvandoPerfil] = useState(false);

    const [relatorioMes, setRelatorioMes] = useState(hoje.getMonth() + 1);
    const [relatorioAno, setRelatorioAno] = useState(anoInicial);
    const [relatorioAba, setRelatorioAba] = useState("social");
    const [relatorio, setRelatorio] = useState(null);
    const [relatorioCarregando, setRelatorioCarregando] = useState(false);
    const [relatorioErro, setRelatorioErro] = useState("");
    const [ultimaLeituraRelatorio, setUltimaLeituraRelatorio] = useState("");

    const [metricasForm, setMetricasForm] = useState({
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        reach: 0,
    });

    const [creativeData, setCreativeData] = useState({
        created: [],
        received: [],
        temporary: [],
        unread_count: 0,
    });
    const [creativeTab, setCreativeTab] = useState("recebidos");
    const [creativeBusca, setCreativeBusca] = useState("");
    const [creativeMes, setCreativeMes] = useState(hoje.getMonth() + 1);
    const [creativeAno, setCreativeAno] = useState(anoInicial);
    const [creativeModalOpen, setCreativeModalOpen] = useState(false);
    const [creativeActiveJob, setCreativeActiveJob] = useState(null);
    const [creativeForm, setCreativeForm] = useState({
        title: "",
        brand: "Honda",
        creative_type: "Feed",
        quantity: 1,
        deadline: chaveData(new Date()),
        recipient_user_id: "",
        briefing: "",
        approval_required: true,
    });
    const [creativeFilesSelected, setCreativeFilesSelected] = useState([]);
    const [creativeSelectedFileIds, setCreativeSelectedFileIds] = useState([]);
    const [creativeDuplicateDialog, setCreativeDuplicateDialog] = useState(null);
    const creativeFileInputRef = useRef(null);
    const [creativeSaving, setCreativeSaving] = useState(false);
    const [creativeUploading, setCreativeUploading] = useState(false);
    const [creativeExpandedId, setCreativeExpandedId] = useState(null);
    const [creativeGallery, setCreativeGallery] = useState(null);
    const [creativeManagerJobs, setCreativeManagerJobs] = useState([]);
    const [managerApprovals, setManagerApprovals] = useState({
        contents: [],
        creative: [],
        approved_contents: [],
        approved_creative: [],
        completed_contents: [],
        completed_creative: [],
        total: 0,
        social_count: 0,
        idea_count: 0,
        final_count: 0,
        creative_count: 0,
        approved_total: 0,
        approved_social_count: 0,
        approved_creative_count: 0,
        completed_total: 0,
        completed_social_count: 0,
        completed_creative_count: 0,
        report: {
            summary: {
                total_approved: 0,
                idea_approved: 0,
                final_approved: 0,
                design_approved: 0,
                revisions_requested: 0,
            },
            by_brand: [],
            by_collaborator: [],
        },
    });
    const [managerApprovalTab, setManagerApprovalTab] = useState("pendentes");
    const [managerReportMonth, setManagerReportMonth] = useState(
        hoje.getMonth() + 1
    );
    const [managerReportYear, setManagerReportYear] = useState(anoInicial);
    const [managerApprovalsLoading, setManagerApprovalsLoading] = useState(false);
    const [managerDetailContent, setManagerDetailContent] = useState(null);

    const [notificationsData, setNotificationsData] = useState({
        items: [],
        unread_total: 0,
        unread_social: 0,
        unread_design: 0,
    });
    const [toastNotification, setToastNotification] = useState(null);
    const notificationSeenIds = useRef(new Set());
    const notificationToastTimer = useRef(null);

    const usuarioEhGerente = isManagerProfile(usuarioSelecionado);
    const usuarioEhGestorExterno = isExternalManager(usuarioSelecionado);

    useEffect(() => {
        document.title = "SQUAD";
        carregarInicial();
    }, []);

    useEffect(() => {
        if (
            !usuarioSelecionado ||
            usuarioEhGerente ||
            abaAtiva !== "calendario"
        ) {
            return undefined;
        }

        carregarPrevisaoTempo(false);

        const timer = setInterval(() => {
            carregarPrevisaoTempo(true);
        }, 30 * 60 * 1000);

        return () => clearInterval(timer);
    }, [usuarioSelecionado, usuarioEhGerente, abaAtiva]);

    useEffect(() => {
        if (!usuarioSelecionado?.id || usuarioEhGerente) return;
        carregarConquistas(true);
        carregarPerformanceSummaries(true);
        carregarMonthlyOverview(true);
    }, [usuarioSelecionado?.id, usuarioEhGerente]);

    useEffect(() => {
        const acompanhandoPedidos =
            Boolean(usuarioSelecionado?.id) &&
            (
                usuarioEhGestorExterno ||
                (usuarioEhGerente && abaAtiva === "pedidos-gerentes")
            );

        if (!acompanhandoPedidos) return undefined;

        carregarPedidosGerentes(true);

        const timer = setInterval(() => {
            carregarPedidosGerentes(true);
        }, 15000);

        return () => clearInterval(timer);
    }, [
        usuarioSelecionado?.id,
        usuarioEhGestorExterno,
        usuarioEhGerente,
        abaAtiva,
    ]);

    useEffect(() => {
        if (!usuarioSelecionado) {
            setConteudos([]);
            setCreativeData({ created: [], received: [], temporary: [], unread_count: 0 });
            setChatData({ messages: [], unread_count: 0 });
            setChatText("");
            setAchievementsData({
                mode: "collaborator",
                role_type: "",
                role_label: "",
                summary: {
                    unlocked: 0,
                    total: 0,
                    percent: 0,
                    next: null,
                },
                sections: [],
                squad: {
                    unlocked: 0,
                    total: 0,
                    percent: 0,
                    sections: [],
                },
                recent_unlocked: [],
            });
            setAchievementsError("");
            setPerformanceData({
                role_type: "",
                weekly: [],
                monthly: [],
            });
            setMonthlyOverview(null);
            setMonthlyOverviewError("");
            setPerformanceTab("weekly");
            setPerformanceError("");
            setNotificationsData({
                items: [],
                unread_total: 0,
                unread_social: 0,
                unread_design: 0,
            });
            setToastNotification(null);
            notificationSeenIds.current = new Set();
            setManagerApprovals({
                contents: [],
                creative: [],
                approved_contents: [],
                approved_creative: [],
                completed_contents: [],
                completed_creative: [],
                total: 0,
                social_count: 0,
                idea_count: 0,
                final_count: 0,
                creative_count: 0,
                approved_total: 0,
                approved_social_count: 0,
                approved_creative_count: 0,
                completed_total: 0,
                completed_social_count: 0,
                completed_creative_count: 0,
                report: {
                    summary: {
                        total_approved: 0,
                        idea_approved: 0,
                        final_approved: 0,
                        design_approved: 0,
                        revisions_requested: 0,
                    },
                    by_brand: [],
                    by_collaborator: [],
                },
            });
            return;
        }

        preencherPerfil(usuarioSelecionado);

        if (isManagerProfile(usuarioSelecionado)) {
            setConteudos([]);
            setCreativeData({ created: [], received: [], temporary: [], unread_count: 0 });
            setNotificationsData({
                items: [],
                unread_total: 0,
                unread_social: 0,
                unread_design: 0,
            });
            setToastNotification(null);
            notificationSeenIds.current = new Set();
            carregarAprovacoesGerente(usuarioSelecionado.id);
            return;
        }

        notificationSeenIds.current = new Set();
        setToastNotification(null);
        carregarConteudos(usuarioSelecionado.id);
        carregarLixeira(usuarioSelecionado.id, true);
        carregarCreative(usuarioSelecionado.id, true);
        carregarNotificacoes(usuarioSelecionado.id, false, true);
    }, [usuarioSelecionado]);

    useEffect(() => {
        if (!usuarioSelecionado || isManagerProfile(usuarioSelecionado)) return undefined;
        const timer = setInterval(() => carregarConteudos(usuarioSelecionado.id, true), 5000);
        return () => clearInterval(timer);
    }, [usuarioSelecionado]);

    useEffect(() => {
        if (!usuarioSelecionado) return undefined;

        carregarChat(true, chatAberto);

        const timer = setInterval(() => {
            carregarChat(true, chatAberto);
        }, 5000);

        return () => clearInterval(timer);
    }, [usuarioSelecionado, chatAberto]);

    useEffect(() => {
        if (!chatAberto || !usuarioSelecionado?.id) return;

        request("/api/chat/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: usuarioSelecionado.id }),
        })
            .then(() => setChatData((current) => ({ ...current, unread_count: 0 })))
            .catch(() => {});

        setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }, 60);
    }, [chatAberto, usuarioSelecionado?.id, chatData.messages.length]);

    useEffect(() => {
        if (!usuarioSelecionado || isManagerProfile(usuarioSelecionado)) return undefined;

        const timer = setInterval(() => {
            carregarCreative(usuarioSelecionado.id, true);
        }, 5000);

        return () => clearInterval(timer);
    }, [usuarioSelecionado]);

    useEffect(() => {
        if (!usuarioSelecionado || isManagerProfile(usuarioSelecionado)) {
            return undefined;
        }

        const timer = setInterval(() => {
            carregarNotificacoes(usuarioSelecionado.id, true, true);
        }, 5000);

        return () => clearInterval(timer);
    }, [usuarioSelecionado]);

    useEffect(() => {
        return () => {
            if (notificationToastTimer.current) {
                clearTimeout(notificationToastTimer.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!usuarioSelecionado || isManagerProfile(usuarioSelecionado)) return undefined;

        const timer = setInterval(() => {
            setRelogioLixeira(Date.now());
            if (lixeiraAberta) carregarLixeira(usuarioSelecionado.id, true);
        }, 60000);

        return () => clearInterval(timer);
    }, [usuarioSelecionado, lixeiraAberta]);

    useEffect(() => {
        if (
            abaAtiva !== "desempenho" ||
            !usuarioSelecionado ||
            isManagerProfile(usuarioSelecionado)
        ) {
            return undefined;
        }

        carregarMonthlyOverview(
            true,
            monthlyOverviewMonth,
            monthlyOverviewYear
        );

        return undefined;
    }, [
        abaAtiva,
        monthlyOverviewMonth,
        monthlyOverviewYear,
        usuarioSelecionado?.id,
    ]);

    useEffect(() => {
        if (
            abaAtiva !== "relatorios" ||
            !usuarioSelecionado ||
            !isManagerProfile(usuarioSelecionado)
        ) {
            return undefined;
        }

        carregarRelatorio();

        const timer = setInterval(() => {
            carregarRelatorio(true);
        }, 60000);

        return () => clearInterval(timer);
    }, [abaAtiva, relatorioMes, relatorioAno, usuarioSelecionado]);

    useEffect(() => {
        if (!usuarioSelecionado || !isManagerProfile(usuarioSelecionado)) {
            return undefined;
        }

        carregarAprovacoesGerente(
            usuarioSelecionado.id,
            true,
            managerReportMonth,
            managerReportYear
        );

        const timer = setInterval(() => {
            carregarAprovacoesGerente(
                usuarioSelecionado.id,
                true,
                managerReportMonth,
                managerReportYear
            );
        }, 5000);

        return () => clearInterval(timer);
    }, [
        usuarioSelecionado,
        abaAtiva,
        managerReportMonth,
        managerReportYear,
    ]);

    async function carregarInicial() {
        try {
            setCarregando(true);
            setErro("");

            const users = await request("/api/auth/users");
            setUsuarios(users);

            if (storedAuthToken()) {
                try {
                    const session = await request("/api/auth/me");
                    const authenticatedUser = session?.user || null;
                    if (authenticatedUser) {
                        const impersonation = storedAdminImpersonation();
                        if (impersonation && Number(impersonation.user_id) === Number(authenticatedUser.id)) {
                            setAdminImpersonando(impersonation);
                        } else if (impersonation) {
                            window.sessionStorage.removeItem(ADMIN_IMPERSONATION_KEY);
                            setAdminImpersonando(null);
                        }
                        setUsuarioSelecionado(authenticatedUser);
                        setAbaAtiva(
                            isManagerProfile(authenticatedUser)
                                ? "aprovacoes"
                                : isExternalManager(authenticatedUser)
                                    ? "pedidos"
                                    : "calendario"
                        );
                        if (isExternalManager(authenticatedUser)) {
                            await carregarPedidosGerentes(true);
                        } else {
                            await recarregarLembretes();
                        }
                    }
                } catch {
                    window.localStorage.removeItem(AUTH_TOKEN_KEY);
                    window.sessionStorage.removeItem(ADMIN_IMPERSONATION_KEY);
                    setAdminImpersonando(null);
                }
            }
        } catch (error) {
            setErro(error.message);
        } finally {
            setCarregando(false);
        }
    }

    async function recarregarUsuarios() {
        const users = await request("/api/users");
        setUsuarios(users);
        if (usuarioSelecionado) {
            const atualizado = users.find((item) => item.id === usuarioSelecionado.id);
            if (atualizado) {
                setUsuarioSelecionado(atualizado);
                preencherPerfil(atualizado);
            }
        }
    }

    async function recarregarLembretes() {
        const years = await Promise.all(
            ANOS_CALENDARIO.map((year) => request(`/api/reminders?year=${year}`))
        );
        setLembretes(years.flat().sort((a, b) => a.date.localeCompare(b.date)));
    }

    async function carregarConteudos(userId, silencioso = false) {
        try {
            const data = await request(`/api/contents?user_id=${userId}`);
            setConteudos(data);
            if (conteudoAberto) {
                const atualizado = data.find((item) => item.id === conteudoAberto.id);
                if (atualizado) setConteudoAberto(atualizado);
            }
        } catch (error) {
            if (!silencioso) setErro(error.message);
        }
    }

    async function carregarLixeira(userId, silencioso = false) {
        try {
            const data = await request(`/api/trash?user_id=${userId}`);
            setLixeiraConteudos(data);
            setRelogioLixeira(Date.now());
        } catch (error) {
            if (!silencioso) alert(error.message);
        }
    }

    async function carregarCreative(userId, silencioso = false) {
        try {
            const data = await request(`/api/creative/jobs?user_id=${userId}`);
            setCreativeData(data);

            if (creativeActiveJob) {
                const atualizado = [
                    ...(data.created || []),
                    ...(data.received || []),
                    ...(data.temporary || []),
                ].find((item) => item.id === creativeActiveJob.id);
                if (atualizado) setCreativeActiveJob(atualizado);
            }
        } catch (error) {
            if (!silencioso) alert(error.message);
        }
    }

    async function carregarCreativeManager(silencioso = false) {
        try {
            const data = await request("/api/creative/manager-jobs");
            setCreativeManagerJobs(data);
        } catch (error) {
            if (!silencioso) alert(error.message);
        }
    }

    async function carregarAprovacoesGerente(
        managerId = usuarioSelecionado?.id,
        silencioso = false,
        month = managerReportMonth,
        year = managerReportYear
    ) {
        if (!managerId) return;

        try {
            if (!silencioso) setManagerApprovalsLoading(true);

            const params = new URLSearchParams({
                manager_id: String(managerId),
                month: String(month),
                year: String(year),
            });

            const data = await request(
                `/api/manager/approvals?${params.toString()}`
            );

            setManagerApprovals(data);
        } catch (error) {
            if (!silencioso) alert(error.message);
        } finally {
            if (!silencioso) setManagerApprovalsLoading(false);
        }
    }

    async function carregarPerformanceSummaries(
        silencioso = false
    ) {
        if (!usuarioSelecionado?.id || usuarioEhGerente) return;

        try {
            if (!silencioso) {
                setPerformanceLoading(true);
            }

            const data = await request(
                `/api/performance-summaries?user_id=${usuarioSelecionado.id}`
            );

            setPerformanceData({
                role_type: data.role_type || "",
                weekly: Array.isArray(data.weekly)
                    ? data.weekly
                    : [],
                monthly: Array.isArray(data.monthly)
                    ? data.monthly
                    : [],
            });

            setPerformanceError("");
        } catch (error) {
            setPerformanceError(error.message);

            if (!silencioso) {
                console.error(
                    "Meu desempenho:",
                    error.message
                );
            }
        } finally {
            if (!silencioso) {
                setPerformanceLoading(false);
            }
        }
    }

    async function carregarMonthlyOverview(
        silencioso = false,
        month = monthlyOverviewMonth,
        year = monthlyOverviewYear
    ) {
        if (!usuarioSelecionado?.id || isManagerProfile(usuarioSelecionado)) return;

        try {
            if (!silencioso) setMonthlyOverviewLoading(true);

            const data = await request(
                `/api/performance/month-overview?user_id=${usuarioSelecionado.id}&year=${year}&month=${month}`
            );

            setMonthlyOverview(data);
            setMonthlyOverviewError("");
        } catch (error) {
            setMonthlyOverviewError(error.message);
            if (!silencioso) {
                console.error("Resumo mensal:", error.message);
            }
        } finally {
            if (!silencioso) setMonthlyOverviewLoading(false);
        }
    }

    async function carregarConquistas(silencioso = false) {
        if (!usuarioSelecionado?.id) return;

        try {
            if (!silencioso) {
                setAchievementsLoading(true);
            }

            const data = await request(
                `/api/achievements?user_id=${usuarioSelecionado.id}`
            );

            setAchievementsData(data);
            setAchievementsError("");
        } catch (error) {
            setAchievementsError(error.message);

            if (!silencioso) {
                console.error("Conquistas:", error.message);
            }
        } finally {
            if (!silencioso) {
                setAchievementsLoading(false);
            }
        }
    }

    async function carregarChat(
        silencioso = false,
        marcarComoLido = false
    ) {
        if (!usuarioSelecionado?.id) return;

        try {
            const params = new URLSearchParams({
                user_id: String(usuarioSelecionado.id),
            });

            if (marcarComoLido) {
                params.set("mark_read", "1");
            }

            const data = await request(
                `/api/chat?${params.toString()}`
            );

            setChatData({
                messages: Array.isArray(data.messages)
                    ? data.messages
                    : [],
                unread_count: Number(data.unread_count || 0),
            });
        } catch (error) {
            if (!silencioso) {
                alert(error.message);
            }
        }
    }

    async function enviarMensagemChat(event) {
        event.preventDefault();

        const message = chatText.trim();
        if (!message || !usuarioSelecionado?.id) return;

        try {
            setChatSending(true);

            await request("/api/chat/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: usuarioSelecionado.id,
                    message,
                }),
            });

            setChatText("");
            await carregarChat(true, true);

            setTimeout(() => {
                chatEndRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "end",
                });
            }, 40);
        } catch (error) {
            alert(error.message);
        } finally {
            setChatSending(false);
        }
    }

    async function carregarNotificacoes(
        userId = usuarioSelecionado?.id,
        silencioso = false,
        mostrarToast = false
    ) {
        if (!userId || isManagerProfile(usuarioSelecionado)) return;

        try {
            const data = await request(`/api/notifications?user_id=${userId}`);
            setNotificationsData(data);

            const unread = (data.items || []).filter(
                (item) => !item.read_at
            );

            const novas = unread.filter(
                (item) => !notificationSeenIds.current.has(item.id)
            );

            unread.forEach((item) => {
                notificationSeenIds.current.add(item.id);
            });

            if (mostrarToast && novas.length > 0) {
                const maisNova = novas[0];
                setToastNotification(maisNova);

                if (notificationToastTimer.current) {
                    clearTimeout(notificationToastTimer.current);
                }

                notificationToastTimer.current = setTimeout(() => {
                    setToastNotification(null);
                }, 5500);
            }
        } catch (error) {
            if (!silencioso) {
                console.error("Notificações:", error.message);
            }
        }
    }

    async function marcarNotificacaoComoLida(id) {
        if (!usuarioSelecionado?.id || !id) return;

        try {
            await request(`/api/notifications/${id}/read`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: usuarioSelecionado.id,
                }),
            });

            await carregarNotificacoes(
                usuarioSelecionado.id,
                true,
                false
            );
        } catch (error) {
            console.error("Marcar notificação:", error.message);
        }
    }

    async function marcarNotificacoesEntidadeComoLidas(
        entityType,
        entityId
    ) {
        if (!usuarioSelecionado?.id || !entityId) return;

        try {
            await request("/api/notifications/entity/read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: usuarioSelecionado.id,
                    entity_type: entityType,
                    entity_id: Number(entityId),
                }),
            });

            await carregarNotificacoes(
                usuarioSelecionado.id,
                true,
                false
            );
        } catch (error) {
            console.error("Leitura da notificação:", error.message);
        }
    }

    async function marcarTodasNotificacoesComoLidas(category) {
        if (!usuarioSelecionado?.id) return;

        try {
            await request("/api/notifications/read-all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: usuarioSelecionado.id,
                    category,
                }),
            });

            await carregarNotificacoes(
                usuarioSelecionado.id,
                true,
                false
            );
        } catch (error) {
            alert(error.message);
        }
    }

    async function abrirNotificacao(notification) {
        if (!notification) return;

        setToastNotification(null);
        await marcarNotificacaoComoLida(notification.id);

        try {
            if (notification.entity_type === "summary") {
                setPerformanceTab(
                    notification.event_type === "monthly_summary"
                        ? "monthly"
                        : "weekly"
                );
                setAbaAtiva("desempenho");
                await carregarPerformanceSummaries(true);
                await carregarMonthlyOverview(true);
                return;
            }

            if (notification.entity_type === "achievement") {
                setAbaAtiva("conquistas");
                await carregarConquistas(true);
                return;
            }

            if (notification.entity_type === "content") {
                const content = await request(
                    `/api/contents/${notification.entity_id}`
                );

                setAbaAtiva("conteudos");
                abrirConteudo(content, true);
                return;
            }

            if (notification.entity_type === "creative") {
                const data = await request(
                    `/api/creative/jobs?user_id=${usuarioSelecionado.id}`
                );

                setCreativeData(data);

                const job = [
                    ...(data.created || []),
                    ...(data.received || []),
                    ...(data.temporary || []),
                ].find(
                    (item) =>
                        Number(item.id) ===
                        Number(notification.entity_id)
                );

                setAbaAtiva("criativa");
                setCreativeTab("producoes");

                if (job) {
                    abrirProducaoCriativa(job, true);
                }
            }
        } catch (error) {
            alert(error.message);
        }
    }

    function notificacoesDaCategoria(category) {
        return (notificationsData.items || []).filter(
            (item) => item.category === category
        );
    }

    function renderRetornosGerencia(category) {
        const items = notificacoesDaCategoria(category).slice(0, 8);
        const unread =
            category === "social"
                ? Number(notificationsData.unread_social || 0)
                : Number(notificationsData.unread_design || 0);

        if (!items.length) return null;

        return (
            <section
                className={`manager-feedback-panel feedback-${category}`}
            >
                <div className="manager-feedback-heading">
                    <div>
                        <span>ATUALIZAÇÕES DO SQUAD</span>
                        <h2>
                            {category === "social"
                                ? "Conteúdos, conquistas e desempenho"
                                : "Produções, conquistas e desempenho"}
                        </h2>
                        <p>
                            {unread > 0
                                ? `${unread} ${
                                      unread === 1
                                          ? "retorno ainda não lido"
                                          : "retornos ainda não lidos"
                                  }.`
                                : "Você já viu todos os retornos recentes."}
                        </p>
                    </div>

                    {unread > 0 && (
                        <button
                            type="button"
                            onClick={() =>
                                marcarTodasNotificacoesComoLidas(
                                    category
                                )
                            }
                        >
                            Marcar todas como lidas
                        </button>
                    )}
                </div>

                <div className="manager-feedback-list">
                    {items.map((notification) => (
                        <button
                            type="button"
                            className={`manager-feedback-item ${
                                notification.read_at ? "read" : "unread"
                            } feedback-event-${notification.event_type}`}
                            key={notification.id}
                            onClick={() =>
                                abrirNotificacao(notification)
                            }
                        >
                            <div className="manager-feedback-icon">
                                {notification.entity_type ===
                                "achievement"
                                    ? "🏆"
                                    : notification.entity_type === "summary"
                                      ? "★"
                                      : notification.event_type.includes(
                                            "approved"
                                      )
                                      ? "✓"
                                      : notification.event_type.includes(
                                              "changes"
                                        )
                                        ? "!"
                                        : "↶"}
                            </div>

                            <div className="manager-feedback-copy">
                                <div>
                                    <strong>
                                        {notification.title}
                                    </strong>
                                    {!notification.read_at && <i />}
                                </div>
                                <p>{notification.message}</p>
                                {notification.note && (
                                    <blockquote>
                                        {notification.note}
                                    </blockquote>
                                )}
                                <small>
                                    {formatDateTime(
                                        notification.created_at
                                    )}
                                </small>
                            </div>

                            <span className="manager-feedback-open">
                                {notification.entity_type === "summary"
                                    ? "Ver desempenho →"
                                    : "Abrir →"}
                            </span>
                        </button>
                    ))}
                </div>
            </section>
        );
    }

    async function carregarRelatorio(silencioso = false) {
        try {
            if (!silencioso) setRelatorioCarregando(true);
            setRelatorioErro("");
            const data = await request(`/api/reports/marketing?year=${relatorioAno}&month=${relatorioMes}`);
            setRelatorio(data);
            setUltimaLeituraRelatorio(new Date().toISOString());
        } catch (error) {
            setRelatorioErro(error.message);
        } finally {
            if (!silencioso) setRelatorioCarregando(false);
        }
    }

    function preencherPerfil(user) {
        setPerfilForm({
            name: user?.name || "",
            nickname: user?.nickname || "",
            role: user?.role || "",
            brands: Array.isArray(user?.brands) ? user.brands : [],
        });
        setFotoPerfil(null);
    }

    async function carregarAdminData(silencioso = false) {
        try {
            if (!silencioso) setAdminCarregando(true);
            setAdminErro("");
            const [allUsers, history] = await Promise.all([
                request("/api/users?include_inactive=1"),
                request("/api/admin/history"),
            ]);
            setUsuariosAdmin(allUsers);
            setAdminHistorico(history);
            setUsuarios(
                allUsers
                    .filter((item) => Number(item.active) === 1)
                    .sort((a, b) => a.name.localeCompare(b.name))
            );
        } catch (error) {
            setAdminErro(error.message);
        } finally {
            if (!silencioso) setAdminCarregando(false);
        }
    }

    async function criarColaborador(event) {
        event.preventDefault();
        const nome = novoColaboradorNome.trim();
        if (!nome) return alert("Digite o nome do colaborador.");
        if (novoColaboradorTipo === "outros_gerentes" && !novoColaboradorMarca) {
            return alert("Selecione a marca deste gerente.");
        }

        const accessRole =
            novoColaboradorTipo === "gerente_marketing"
                ? "gerente"
                : novoColaboradorTipo === "outros_gerentes"
                    ? "gestor_externo"
                    : "colaborador";

        try {
            const user = await request("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: nome,
                    access_role: accessRole,
                    role: novoColaboradorCargo.trim(),
                    department: novoColaboradorSetor.trim(),
                    brands:
                        novoColaboradorTipo === "outros_gerentes"
                            ? [novoColaboradorMarca]
                            : [],
                }),
            });
            setUsuarios((anteriores) =>
                [...anteriores.filter((item) => item.id !== user.id), user].sort((a, b) =>
                    a.name.localeCompare(b.name)
                )
            );
            setNovoColaboradorNome("");
            setNovoColaboradorTipo("colaborador");
            setNovoColaboradorCargo("");
            setNovoColaboradorSetor("");
            setNovoColaboradorMarca("");
            setNovoColaboradorAberto(false);
            if (areaAdminAtiva) await carregarAdminData(true);
        } catch (error) {
            alert(error.message);
        }
    }

    function abrirEdicaoAdminUsuario(user) {
        setAdminUsuarioEditando(user);
        setAdminEditNome(user?.name || "");
        setAdminEditCargo(user?.role || "");
        setAdminEditSetor(user?.department || "");
        setAdminEditMarcas(Array.isArray(user?.brands) ? user.brands : []);
    }

    function alternarMarcaAdmin(marca) {
        setAdminEditMarcas((atual) => atual.includes(marca) ? atual.filter((x) => x !== marca) : [...atual, marca]);
    }

    async function salvarEdicaoAdminUsuario(event) {
        event.preventDefault();
        if (!adminUsuarioEditando?.id) return;
        if (!adminEditNome.trim()) return alert("Digite o nome do usuário.");
        if (isExternalManager(adminUsuarioEditando) && !adminEditMarcas.length) return alert("Selecione pelo menos uma marca para este gerente.");
        try {
            setAdminCarregando(true);
            const atualizado = await request(`/api/admin/users/${adminUsuarioEditando.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: adminEditNome.trim(), role: adminEditCargo.trim(), department: adminEditSetor.trim(), brands: adminEditMarcas }),
            });
            setUsuarios((atuais) => atuais.map((x) => x.id === atualizado.id ? atualizado : x));
            setAdminUsuarioEditando(null);
            await carregarAdminData(true);
        } catch (error) { alert(error.message); }
        finally { setAdminCarregando(false); }
    }

    async function removerUsuario(user) {
        const activeCount = usuariosAdmin.length
            ? usuariosAdmin.filter((item) => Number(item.active) === 1).length
            : usuarios.length;
        if (activeCount <= 1) {
            return alert("O sistema precisa ter pelo menos um colaborador ativo.");
        }

        const confirmar = window.confirm(
            `Desativar ${user.name}?\n\nO perfil sairá da tela de login, mas todo o histórico será preservado.`
        );
        if (!confirmar) return;

        try {
            await request(`/api/users/${user.id}`, {
                method: "DELETE",
            });
            await carregarAdminData(true);
        } catch (error) {
            alert(error.message);
        }
    }

    async function reativarUsuario(user) {
        try {
            await request(`/api/admin/users/${user.id}/reactivate`, {
                method: "POST",
            });
            await carregarAdminData(true);
        } catch (error) {
            alert(error.message);
        }
    }

    async function redefinirSenhaUsuario(user) {
        const confirmar = window.confirm(
            `Redefinir a senha de ${user.nickname || user.name}?\n\nNo próximo acesso, essa pessoa deverá criar uma nova senha.`
        );
        if (!confirmar) return;

        try {
            await request(`/api/admin/users/${user.id}/reset-password`, {
                method: "POST",
            });
            await carregarAdminData(true);
        } catch (error) {
            alert(error.message);
        }
    }

    async function entrarComoUsuario(user) {
        if (!user?.id || Number(user.active) !== 1) {
            return alert("Reative este usuário antes de acessar a conta.");
        }

        try {
            setAdminCarregando(true);
            setAdminErro("");
            const data = await request(`/api/admin/users/${user.id}/impersonate`, {
                method: "POST",
            });

            window.localStorage.setItem(AUTH_TOKEN_KEY, data.token);
            const impersonation = {
                user_id: data.user.id,
                name: data.user.nickname || data.user.name,
                started_at: new Date().toISOString(),
            };
            window.sessionStorage.setItem(
                ADMIN_IMPERSONATION_KEY,
                JSON.stringify(impersonation)
            );
            setAdminImpersonando(impersonation);
            setUsuarioSelecionado(data.user);
            setAreaAdminAtiva(false);
            setAbaAtiva(isManagerProfile(data.user) ? "aprovacoes" : "calendario");
            preencherPerfil(data.user);
            await recarregarLembretes();
        } catch (error) {
            setAdminErro(error.message);
        } finally {
            setAdminCarregando(false);
        }
    }

    async function voltarParaAreaAdmin() {
        const impersonation = adminImpersonando || storedAdminImpersonation();

        try {
            if (storedAdminToken()) {
                try {
                    await request("/api/admin/impersonation-stop", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ user_id: impersonation?.user_id || usuarioSelecionado?.id }),
                    });
                } catch {}
            }

            if (storedAuthToken()) {
                try {
                    await request("/api/auth/logout", { method: "POST" });
                } catch {}
            }

            window.localStorage.removeItem(AUTH_TOKEN_KEY);
            window.sessionStorage.removeItem(ADMIN_IMPERSONATION_KEY);
            setAdminImpersonando(null);
            setUsuarioSelecionado(null);
            setConteudos([]);
            setCreativeData({ created: [], received: [], temporary: [], unread_count: 0 });
            setChatData({ messages: [], unread_count: 0 });
            setChatText("");

            if (!storedAdminToken()) {
                setAdminLiberado(false);
                setAreaAdminAtiva(true);
                setAdminErro("Sua sessão administrativa expirou. Digite a senha ADM novamente.");
                return;
            }

            await request("/api/admin/verify", { method: "POST" });
            setAdminLiberado(true);
            setAreaAdminAtiva(true);
            setAdminAba("usuarios");
            await carregarAdminData(true);
        } catch (error) {
            window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
            window.sessionStorage.removeItem(ADMIN_IMPERSONATION_KEY);
            setAdminImpersonando(null);
            setAdminLiberado(false);
            setAreaAdminAtiva(true);
            setAdminErro("Sua sessão administrativa expirou. Digite a senha ADM novamente.");
        }
    }

    async function acessarAdmin(event) {
        event.preventDefault();
        try {
            setAdminErro("");
            setAdminCarregando(true);
            const data = await request("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: senhaAdmin }),
            });
            window.sessionStorage.setItem(ADMIN_TOKEN_KEY, data.admin_token);
            window.sessionStorage.removeItem(ADMIN_IMPERSONATION_KEY);
            window.localStorage.removeItem(AUTH_TOKEN_KEY);
            setAdminImpersonando(null);
            setSenhaAdmin("");
            setAdminLiberado(true);
            setAdminAba("usuarios");
            await carregarAdminData(true);
        } catch (error) {
            setAdminErro(error.message);
        } finally {
            setAdminCarregando(false);
        }
    }

    async function sairAdmin() {
        try {
            if (storedAdminToken()) {
                await request("/api/admin/logout", { method: "POST" });
            }
        } catch {}
        window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        window.sessionStorage.removeItem(ADMIN_IMPERSONATION_KEY);
        setAdminImpersonando(null);
        setAdminLiberado(false);
        setAreaAdminAtiva(false);
        setSenhaAdmin("");
        setAdminErro("");
        setUsuariosAdmin([]);
        setAdminHistorico([]);
        try {
            const users = await request("/api/auth/users");
            setUsuarios(users);
        } catch {}
    }

    function abrirLoginUsuario(user) {
        setLoginUsuario(user);
        setLoginSenha("");
        setLoginConfirmacao("");
        setLoginErro("");
    }

    function fecharLoginUsuario() {
        setLoginUsuario(null);
        setLoginSenha("");
        setLoginConfirmacao("");
        setLoginErro("");
    }

    async function autenticarUsuario(event) {
        event.preventDefault();
        if (!loginUsuario?.id) return;

        try {
            setLoginProcessando(true);
            setLoginErro("");
            const firstAccess = !loginUsuario.password_set;
            const data = await request(
                firstAccess ? "/api/auth/setup-password" : "/api/auth/login",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        user_id: loginUsuario.id,
                        password: loginSenha,
                        confirm_password: loginConfirmacao,
                    }),
                }
            );

            window.localStorage.setItem(AUTH_TOKEN_KEY, data.token);
            window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
            window.sessionStorage.removeItem(ADMIN_IMPERSONATION_KEY);
            setAdminImpersonando(null);
            const authenticatedUser = data.user;
            setUsuarios((current) =>
                current.map((item) =>
                    item.id === authenticatedUser.id ? authenticatedUser : item
                )
            );
            setUsuarioSelecionado(authenticatedUser);
            setAbaAtiva(
                isManagerProfile(authenticatedUser)
                    ? "aprovacoes"
                    : isExternalManager(authenticatedUser)
                        ? "pedidos"
                        : "calendario"
            );
            fecharLoginUsuario();
            if (isExternalManager(authenticatedUser)) {
                await carregarPedidosGerentes(true);
            } else {
                await recarregarLembretes();
            }
        } catch (error) {
            if (error?.data?.needs_password_setup) {
                setLoginUsuario((current) =>
                    current ? { ...current, password_set: false } : current
                );
                setLoginSenha("");
                setLoginConfirmacao("");
            }
            setLoginErro(error.message);
        } finally {
            setLoginProcessando(false);
        }
    }

    async function sairUsuario() {
        try {
            if (storedAuthToken()) {
                await request("/api/auth/logout", { method: "POST" });
            }
        } catch {}

        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        setUsuarioSelecionado(null);
        setConteudos([]);
        setCreativeData({ created: [], received: [], temporary: [], unread_count: 0 });
        setChatData({ messages: [], unread_count: 0 });
        setChatText("");
        setAchievementsData({
            mode: "collaborator",
            role_type: "",
            role_label: "",
            summary: { unlocked: 0, total: 0, percent: 0, next: null },
            sections: [],
            squad: { unlocked: 0, total: 0, percent: 0, sections: [] },
            recent_unlocked: [],
        });
        setAchievementsError("");
        setPerformanceData({ role_type: "", weekly: [], monthly: [] });
        setPerformanceTab("weekly");
        setPerformanceError("");
        setCreativeManagerJobs([]);
        setManagerApprovals({
            contents: [], creative: [], approved_contents: [], approved_creative: [],
            completed_contents: [], completed_creative: [], total: 0, social_count: 0,
            idea_count: 0, final_count: 0, creative_count: 0, approved_total: 0,
            approved_social_count: 0, approved_creative_count: 0, completed_total: 0,
            completed_social_count: 0, completed_creative_count: 0,
            report: {
                summary: { total_approved: 0, idea_approved: 0, final_approved: 0, design_approved: 0, revisions_requested: 0 },
                by_brand: [], by_collaborator: [],
            },
        });

        try {
            const users = await request("/api/auth/users");
            setUsuarios(users);
        } catch {}
    }

    async function alterarSenhaPerfil(event) {
        event.preventDefault();
        try {
            setSalvandoSenhaPerfil(true);
            await request("/api/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    current_password: senhaAtualPerfil,
                    new_password: novaSenhaPerfil,
                    confirm_password: confirmarSenhaPerfil,
                }),
            });
            setSenhaAtualPerfil("");
            setNovaSenhaPerfil("");
            setConfirmarSenhaPerfil("");
            alert("Senha alterada com sucesso.");
        } catch (error) {
            alert(error.message);
        } finally {
            setSalvandoSenhaPerfil(false);
        }
    }

    const celulas = useMemo(() => {
        if (modo === "semanal") {
            const inicio = inicioDaSemana(dataAtual);
            return Array.from({ length: 7 }, (_, index) => {
                const data = new Date(inicio);
                data.setDate(inicio.getDate() + index);
                return data;
            });
        }

        const ano = dataAtual.getFullYear();
        const mes = dataAtual.getMonth();
        const primeiro = new Date(ano, mes, 1);
        const ultimo = new Date(ano, mes + 1, 0);
        const offset = (primeiro.getDay() + 6) % 7;
        const lista = [];

        for (let i = 0; i < offset; i += 1) lista.push(null);
        for (let dia = 1; dia <= ultimo.getDate(); dia += 1) lista.push(new Date(ano, mes, dia));
        while (lista.length % 7 !== 0) lista.push(null);
        return lista;
    }, [dataAtual, modo]);

    const tituloPeriodo = useMemo(() => {
        if (modo === "mensal") {
            return dataAtual.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        }
        const inicio = inicioDaSemana(dataAtual);
        const fim = new Date(inicio);
        fim.setDate(inicio.getDate() + 6);
        return `${inicio.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
        })} — ${fim.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })}`;
    }, [dataAtual, modo]);

    function mudarMes(month) {
        setDataAtual(new Date(dataAtual.getFullYear(), Number(month), 1));
    }

    function mudarAno(year) {
        setDataAtual(new Date(Number(year), dataAtual.getMonth(), 1));
    }

    function periodoAnterior() {
        const nova = new Date(dataAtual);
        if (modo === "mensal") nova.setMonth(nova.getMonth() - 1);
        else nova.setDate(nova.getDate() - 7);
        if (nova.getFullYear() < ANOS_CALENDARIO[0]) return;
        setDataAtual(nova);
    }

    function periodoProximo() {
        const nova = new Date(dataAtual);
        if (modo === "mensal") nova.setMonth(nova.getMonth() + 1);
        else nova.setDate(nova.getDate() + 7);
        if (nova.getFullYear() > ANOS_CALENDARIO[ANOS_CALENDARIO.length - 1]) return;
        setDataAtual(nova);
    }

    function irHoje() {
        if (ANOS_CALENDARIO.includes(hoje.getFullYear())) {
            setDataAtual(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
        }
    }

    const conteudosFiltrados = useMemo(
        () =>
            conteudos.filter((conteudo) => {
                if (filtroMarca && !conteudo.brands.includes(filtroMarca)) return false;
                if (filtroFormato && conteudo.format !== filtroFormato) return false;
                if (filtroStatus && conteudo.status !== filtroStatus) return false;
                return true;
            }),
        [conteudos, filtroMarca, filtroFormato, filtroStatus]
    );

    function conteudosDoDia(data) {
        if (!data) return [];
        const key = chaveData(data);
        return conteudosFiltrados.filter((conteudo) => conteudo.date === key);
    }

    function todosConteudosDoDia() {
        if (!diaSelecionado) return [];
        return conteudos.filter((conteudo) => conteudo.date === diaSelecionado);
    }

    function limparFiltros() {
        setFiltroMarca("");
        setFiltroFormato("");
        setFiltroStatus("");
    }

    function lembretesDoDia(data) {
        if (!data) return [];
        const key = chaveData(data);
        return lembretes.filter((item) => item.date === key);
    }

    const lembretesHoje = useMemo(() => {
        const key = chaveData(hoje);
        return lembretes.filter((item) => item.date === key);
    }, [lembretes]);

    const lembretesAno = useMemo(
        () => lembretes.filter((item) => Number(item.date.slice(0, 4)) === Number(anoLembretes)),
        [lembretes, anoLembretes]
    );

    const lembretesPorMes = useMemo(
        () =>
            MESES.map((mes, index) => ({
                mes,
                index,
                itens: lembretesAno.filter((item) => Number(item.date.slice(5, 7)) === index + 1),
            })).filter((grupo) => grupo.itens.length > 0),
        [lembretesAno]
    );

    const lembretesMetricas = useMemo(() => {
        const agora = new Date(relogioLixeira);
        const anoAtual = agora.getFullYear();
        const mesAtual = agora.getMonth();
        const ultimoDia = new Date(anoAtual, mesAtual + 1, 0).getDate();
        const diasParaFecharMes = ultimoDia - agora.getDate();
        const fechamentoProximo = diasParaFecharMes <= 5;

        return conteudos
            .filter((conteudo) => {
                if (!conteudo.is_live) return false;
                if (isStoriesFormat(conteudo.format)) return false;

                const chave = dataPublicacaoConteudo(conteudo);
                if (!chave) return false;

                const publicada = dataDaChave(chave);

                return (
                    publicada.getFullYear() === anoAtual &&
                    publicada.getMonth() === mesAtual
                );
            })
            .map((conteudo) => {
                const updatedAt = String(conteudo.metrics_updated_at || "").trim();
                const atualizada = updatedAt ? new Date(updatedAt) : null;
                const atualizacaoValida =
                    atualizada && !Number.isNaN(atualizada.getTime());

                const diasSemAtualizar = atualizacaoValida
                    ? Math.floor(
                          Math.max(0, agora.getTime() - atualizada.getTime()) /
                              (24 * 60 * 60 * 1000)
                      )
                    : null;

                let precisaLembrar = false;
                let nivel = "normal";
                let motivo = "";

                if (!atualizacaoValida) {
                    precisaLembrar = true;
                    nivel = fechamentoProximo ? "fechamento" : "pendente";
                    motivo = fechamentoProximo
                        ? "Fechamento do mês: esta publicação ainda não recebeu métricas."
                        : "Esta publicação ainda não recebeu a primeira atualização de métricas.";
                } else if (fechamentoProximo && diasSemAtualizar >= 2) {
                    precisaLembrar = true;
                    nivel = "fechamento";
                    motivo = `Fechamento do mês: métricas sem atualização há ${diasSemAtualizar} dia(s).`;
                } else if (diasSemAtualizar >= 7) {
                    precisaLembrar = true;
                    nivel = "pendente";
                    motivo = `Métricas sem atualização há ${diasSemAtualizar} dia(s).`;
                }

                if (!precisaLembrar) return null;

                return {
                    id: `metric-${conteudo.id}`,
                    content_id: conteudo.id,
                    conteudo,
                    nivel,
                    motivo,
                    last_update: atualizacaoValida
                        ? conteudo.metrics_updated_at
                        : "",
                    days_to_close: diasParaFecharMes,
                };
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (a.nivel === "fechamento" && b.nivel !== "fechamento") return -1;
                if (a.nivel !== "fechamento" && b.nivel === "fechamento") return 1;
                return dataPublicacaoConteudo(b.conteudo).localeCompare(
                    dataPublicacaoConteudo(a.conteudo)
                );
            });
    }, [conteudos, relogioLixeira]);

    const idsMetricasPendentes = useMemo(
        () => new Set(lembretesMetricas.map((item) => item.content_id)),
        [lembretesMetricas]
    );

    const totalLembretesAtivos = lembretesHoje.length + lembretesMetricas.length;

    async function criarLembrete(event) {
        event.preventDefault();
        if (!lembreteForm.title.trim()) return alert("Digite um título.");

        try {
            await request("/api/reminders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...lembreteForm, created_by: usuarioSelecionado?.name || "" }),
            });
            await recarregarLembretes();
            setNovoLembreteAberto(false);
            setLembreteForm({
                title: "",
                date: `${anoLembretes}-01-01`,
                type: "Personalizado",
                city: "",
                note: "",
            });
        } catch (error) {
            alert(error.message);
        }
    }

    async function removerLembrete(reminder) {
        if (reminder.system || !reminder.db_id) return;
        if (!window.confirm(`Excluir o lembrete "${reminder.title}"?`)) return;
        try {
            await request(`/api/reminders/${reminder.db_id}`, { method: "DELETE" });
            await recarregarLembretes();
        } catch (error) {
            alert(error.message);
        }
    }

    function abrirDia(data) {
        setDiaSelecionado(chaveData(data));
        setTipoPlanejamento("social");

        setForm({
            titulo: "",
            marcas: [],
            formato: "Reels",
            status: "Ideia",
            responsavel: usuarioSelecionado?.name || "",
            urgencia: "verde",
            approval_required: true,
        });

        setPlanejamentoAberto(true);
    }

    function abrirDesignerDoDia() {
        if (!diaSelecionado || !usuarioSelecionado) return;

        setTipoPlanejamento("designer");

        setCreativeActiveJob(null);
        setCreativeFilesSelected([]);
        setCreativeSelectedFileIds([]);
        setCreativeDuplicateDialog(null);

        setCreativeForm({
            title: "",
            brand: usuarioSelecionado?.brands?.[0] || "Honda",
            creative_type: "Feed",
            quantity: 1,
            deadline: diaSelecionado,
            recipient_user_id:
                creativeRecipients(usuarios).find(
                    (item) => item.id !== usuarioSelecionado.id
                )?.id || "",
            briefing: "",
        });

        setPlanejamentoAberto(false);
        setCreativeTab("producoes");
        setAbaAtiva("criativa");
        setCreativeModalOpen(true);
    }

    function alternarMarca(marca) {
        setForm((anterior) => ({
            ...anterior,
            marcas: anterior.marcas.includes(marca)
                ? anterior.marcas.filter((item) => item !== marca)
                : [...anterior.marcas, marca],
        }));
    }

    async function salvarConteudo(event) {
        event.preventDefault();
        if (!form.titulo.trim()) return alert("Digite o título.");
        if (!form.marcas.length) return alert("Selecione uma marca.");

        try {
            setSalvando(true);
            const novo = await request("/api/contents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: usuarioSelecionado.id,
                    title: form.titulo,
                    date: diaSelecionado,
                    brands: form.marcas,
                    format: form.formato,
                    status: form.status,
                    responsible: usuarioSelecionado.name,
                    urgency: form.urgencia,
                    approval_required: form.approval_required,
                }),
            });
            setConteudos((anteriores) => [...anteriores, novo]);
            setForm({
                titulo: "",
                marcas: [],
                formato: "Reels",
                status: "Ideia",
                responsavel: usuarioSelecionado.name,
                urgencia: "verde",
                approval_required: true,
            });
        } catch (error) {
            alert(error.message);
        } finally {
            setSalvando(false);
        }
    }

    async function removerConteudo(id) {
        const confirmar = window.confirm(
            "Mover este conteúdo para a lixeira?\n\nEle poderá ser restaurado durante 24 horas. Depois disso será excluído definitivamente."
        );

        if (!confirmar) return;

        try {
            await request(`/api/contents/${id}`, { method: "DELETE" });

            setConteudos((anteriores) => anteriores.filter((item) => item.id !== id));

            if (conteudoAberto?.id === id) {
                setConteudoAberto(null);
                setDetalheForm(null);
            }

            if (usuarioSelecionado) {
                await carregarLixeira(usuarioSelecionado.id, true);
            }

            if (abaAtiva === "relatorios") carregarRelatorio(true);
        } catch (error) {
            alert(error.message);
        }
    }

    async function restaurarConteudo(id) {
        try {
            const restaurado = await request(`/api/trash/${id}/restore`, {
                method: "POST",
            });

            setLixeiraConteudos((anteriores) =>
                anteriores.filter((item) => item.id !== id)
            );

            setConteudos((anteriores) => {
                const semDuplicar = anteriores.filter((item) => item.id !== restaurado.id);
                return [...semDuplicar, restaurado];
            });

            if (abaAtiva === "relatorios") carregarRelatorio(true);
        } catch (error) {
            alert(error.message);
            if (usuarioSelecionado) carregarLixeira(usuarioSelecionado.id, true);
        }
    }

    function abrirNovaProducaoCriativa() {
        setCreativeActiveJob(null);
        setCreativeFilesSelected([]);
        setCreativeForm({
            title: "",
            brand: usuarioSelecionado?.brands?.[0] || "Honda",
            creative_type: "Feed",
            quantity: 1,
            deadline: chaveData(new Date()),
            recipient_user_id:
                creativeRecipients(usuarios).find(
                    (item) => item.id !== usuarioSelecionado?.id
                )?.id || "",
            briefing: "",
            approval_required: true,
        });
        setCreativeModalOpen(true);
    }

    function podeExcluirDemandaCriativa(job) {
        if (!job) return false;

        const semAprovacao =
            job.approval_required === false;

        const aindaNaoEnviadaAoGerente =
            job.approval_required !== false &&
            job.status === "em_producao" &&
            !String(job.submitted_at || "").trim();

        return semAprovacao || aindaNaoEnviadaAoGerente;
    }

    async function excluirDemandaCriativa(job) {
        if (!job?.id) return;

        if (!podeExcluirDemandaCriativa(job)) {
            return alert(
                "Esta demanda não pode mais ser excluída porque já entrou no fluxo de aprovação do Gerente de Marketing."
            );
        }

        const semAprovacao =
            job.approval_required === false;

        const aviso = semAprovacao
            ? `Excluir a demanda “${job.title}”?\\n\\nEla foi criada sem aprovação gerencial. A produção e todos os arquivos serão removidos${job.status === "aprovado" || job.status === "finalizado" ? " e deixarão de aparecer para o colaborador que recebeu o material" : ""}.`
            : `Excluir a demanda “${job.title}”?\\n\\nEla ainda não foi enviada ao Gerente de Marketing. A produção e todos os arquivos anexados serão removidos.`;

        if (!window.confirm(aviso)) return;

        try {
            await request(
                `/api/creative/jobs/${job.id}`,
                {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        user_id: usuarioSelecionado.id,
                    }),
                }
            );

            if (
                creativeActiveJob &&
                Number(creativeActiveJob.id) ===
                    Number(job.id)
            ) {
                setCreativeActiveJob(null);
                setCreativeModalOpen(false);
            }

            setCreativeSelectedFileIds([]);
            setCreativeFilesSelected([]);

            await carregarCreative(
                usuarioSelecionado.id,
                true
            );
        } catch (error) {
            alert(error.message);
        }
    }

    function abrirProducaoCriativa(job, notificationAlreadyRead = false) {
        setCreativeActiveJob(job);
        setCreativeSelectedFileIds([]);
        setCreativeDuplicateDialog(null);

        if (!notificationAlreadyRead && !usuarioEhGerente) {
            marcarNotificacoesEntidadeComoLidas(
                "creative",
                job.id
            );
        }
        setCreativeFilesSelected([]);
        setCreativeForm({
            title: job.title || "",
            brand: job.brand || "Honda",
            creative_type: job.creative_type || "Feed",
            quantity: Number(job.quantity || 1),
            deadline: job.deadline || chaveData(new Date()),
            recipient_user_id: job.recipient_user_id || "",
            briefing: job.briefing || "",
            approval_required: job.approval_required !== false,
        });
        setCreativeModalOpen(true);
    }

    async function salvarProducaoCriativa(event) {
        event?.preventDefault?.();
        if (!usuarioSelecionado) return;
        if (!creativeForm.title.trim()) return alert("Digite o título da produção.");
        if (!creativeForm.recipient_user_id) {
            return alert("Selecione para qual colaborador a arte será entregue.");
        }

        const destinatarioCriativo = creativeRecipients(usuarios).find(
            (user) => Number(user.id) === Number(creativeForm.recipient_user_id)
        );

        if (!destinatarioCriativo) {
            return alert(
                "O destinatário precisa ser um colaborador. O gerente recebe a solicitação automaticamente para aprovação."
            );
        }

        try {
            setCreativeSaving(true);
            const payload = {
                ...creativeForm,
                quantity: Math.max(1, Number(creativeForm.quantity || 1)),
                recipient_user_id: Number(creativeForm.recipient_user_id),
                user_id: usuarioSelecionado.id,
                creator_user_id: usuarioSelecionado.id,
            };

            const job = creativeActiveJob
                ? await request(`/api/creative/jobs/${creativeActiveJob.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                  })
                : await request("/api/creative/jobs", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                  });

            setCreativeActiveJob(job);
            setCreativeForm({
                title: job.title,
                brand: job.brand,
                creative_type: job.creative_type,
                quantity: Number(job.quantity || 1),
                deadline: job.deadline,
                recipient_user_id: job.recipient_user_id || "",
                briefing: job.briefing || "",
                approval_required: job.approval_required !== false,
            });
            await carregarCreative(usuarioSelecionado.id, true);
        } catch (error) {
            alert(error.message);
        } finally {
            setCreativeSaving(false);
        }
    }

    async function enviarArquivosCriativosComAcao(
        files,
        duplicateAction = "keep"
    ) {
        if (!creativeActiveJob) {
            return alert("Salve a produção antes de anexar arquivos.");
        }

        const lista = Array.isArray(files) ? files : [];
        if (!lista.length) {
            return alert("Selecione pelo menos um arquivo.");
        }

        try {
            setCreativeUploading(true);

            const body = new FormData();
            body.append("user_id", String(usuarioSelecionado.id));
            body.append("duplicate_action", duplicateAction);

            lista.forEach((file) => body.append("files", file));

            const job = await request(
                `/api/creative/jobs/${creativeActiveJob.id}/files`,
                {
                    method: "POST",
                    body,
                }
            );

            setCreativeActiveJob(job);
            setCreativeFilesSelected([]);
            setCreativeSelectedFileIds([]);
            setCreativeDuplicateDialog(null);

            if (creativeFileInputRef.current) {
                creativeFileInputRef.current.value = "";
            }

            await carregarCreative(usuarioSelecionado.id, true);
        } catch (error) {
            alert(error.message);
        } finally {
            setCreativeUploading(false);
        }
    }

    async function enviarArquivosCriativos() {
        if (!creativeActiveJob) {
            return alert("Salve a produção antes de anexar arquivos.");
        }

        if (!creativeFilesSelected.length) {
            return alert("Selecione pelo menos um arquivo.");
        }

        const existentes = new Set(
            (creativeActiveJob.files || []).map((file) =>
                String(file.original_name || "")
                    .trim()
                    .toLocaleLowerCase("pt-BR")
            )
        );

        const duplicados = creativeFilesSelected.filter((file) =>
            existentes.has(
                String(file.name || "")
                    .trim()
                    .toLocaleLowerCase("pt-BR")
            )
        );

        if (duplicados.length) {
            setCreativeDuplicateDialog({
                files: [...creativeFilesSelected],
                names: [
                    ...new Set(
                        duplicados.map((file) =>
                            String(file.name || "").trim()
                        )
                    ),
                ],
            });
            return;
        }

        await enviarArquivosCriativosComAcao(
            creativeFilesSelected,
            "keep"
        );
    }

    async function resolverDuplicidadeCriativa(action) {
        const pendingFiles =
            creativeDuplicateDialog?.files || creativeFilesSelected;

        setCreativeDuplicateDialog(null);

        if (action === "cancel") return;

        await enviarArquivosCriativosComAcao(
            pendingFiles,
            action === "replace" ? "replace" : "keep"
        );
    }

    function alternarSelecaoArquivoCriativo(fileId) {
        const id = Number(fileId);

        setCreativeSelectedFileIds((current) =>
            current.includes(id)
                ? current.filter((item) => item !== id)
                : [...current, id]
        );
    }

    function selecionarTodosArquivosCriativos(files = []) {
        const ids = (files || [])
            .map((file) => Number(file.id))
            .filter(Boolean);

        setCreativeSelectedFileIds(ids);
    }

    function limparSelecaoArquivosCriativos() {
        setCreativeSelectedFileIds([]);
    }

    function baixarArquivosCriativosSelecionados(files = []) {
        const selected = (files || []).filter((file) =>
            creativeSelectedFileIds.includes(Number(file.id))
        );

        if (!selected.length) {
            return alert("Selecione pelo menos uma arte ou arquivo.");
        }

        baixarTodosCriativos(selected);
    }

    async function removerArquivosCriativosSelecionados(files = []) {
        const selected = (files || []).filter((file) =>
            creativeSelectedFileIds.includes(Number(file.id))
        );

        if (!selected.length) {
            return alert("Selecione pelo menos uma arte ou arquivo.");
        }

        const confirmar = window.confirm(
            `Remover ${selected.length} arquivo(s) selecionado(s) da produção?`
        );

        if (!confirmar) return;

        try {
            const resultados = [];

            for (const file of selected) {
                const job = await request(
                    `/api/creative/files/${file.id}`,
                    {
                        method: "DELETE",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            user_id: usuarioSelecionado.id,
                        }),
                    }
                );
                resultados.push(job);
            }

            const jobAtualizado =
                resultados[resultados.length - 1] ||
                creativeActiveJob;

            setCreativeActiveJob(jobAtualizado);
            setCreativeSelectedFileIds([]);
            await carregarCreative(usuarioSelecionado.id, true);
        } catch (error) {
            alert(error.message);
        }
    }

    async function removerArquivoCriativo(fileId) {
        if (!window.confirm("Remover este arquivo da produção?")) return;
        try {
            const job = await request(`/api/creative/files/${fileId}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: usuarioSelecionado.id }),
            });
            setCreativeActiveJob(job);
            setCreativeSelectedFileIds((current) =>
                current.filter((id) => id !== Number(fileId))
            );
            await carregarCreative(usuarioSelecionado.id, true);
        } catch (error) {
            alert(error.message);
        }
    }

    async function enviarCriativoParaAprovacao() {
        if (!creativeActiveJob) return;

        const precisaAprovacao =
            creativeActiveJob.approval_required !== false;

        const confirmar = precisaAprovacao
            ? "Enviar esta produção para aprovação do Gerente de Marketing?"
            : "Finalizar e entregar esta produção diretamente ao colaborador?\n\nEla não passará pela aprovação do Gerente de Marketing.";

        if (!window.confirm(confirmar)) return;

        try {
            const job = await request(`/api/creative/jobs/${creativeActiveJob.id}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: usuarioSelecionado.id }),
            });
            setCreativeActiveJob(job);
            await carregarCreative(usuarioSelecionado.id, true);
            if (creativeTab === "gerencia") await carregarCreativeManager(true);
        } catch (error) {
            alert(error.message);
        }
    }

    async function revisarProducaoCriativa(job, action) {
        let note = "";
        if (action === "adjust") {
            note = window.prompt("Descreva o que precisa ser ajustado:") || "";
            if (!note.trim()) return;
        }

        const message =
            action === "approve"
                ? `Aprovar e entregar “${job.title}” para ${job.recipient?.nickname || job.recipient?.name || job.recipient_name || "o destinatário"}?`
                : `Enviar “${job.title}” de volta para ajustes?`;

        if (!window.confirm(message)) return;

        try {
            await request(`/api/creative/jobs/${job.id}/review`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action,
                    note,
                    manager_id: usuarioEhGerente ? usuarioSelecionado.id : null,
                }),
            });

            if (usuarioEhGerente) {
                await carregarAprovacoesGerente(usuarioSelecionado.id, true);
            } else {
                await carregarCreativeManager();
                await carregarCreative(usuarioSelecionado.id, true);
            }

            if (abaAtiva === "relatorios") carregarRelatorio(true);
        } catch (error) {
            alert(error.message);
        }
    }

    async function abrirEntregaCriativa(job) {
        setCreativeExpandedId((atual) => (atual === job.id ? null : job.id));

        if (!job.recipient_read_at && job.status === "aprovado") {
            try {
                await request(`/api/creative/jobs/${job.id}/read`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ user_id: usuarioSelecionado.id }),
                });
                await carregarCreative(usuarioSelecionado.id, true);
            } catch {
                // Não bloqueia a visualização se a marcação de leitura falhar.
            }
        }
    }

    async function baixarTodosCriativos(files = []) {
        for (let index = 0; index < files.length; index += 1) {
            const file = files[index];

            try {
                await baixarArquivoComNomeOriginal(
                    file,
                    "creative"
                );
            } catch (error) {
                alert(
                    `Não foi possível baixar “${nomeOriginalParaDownload(
                        file,
                        `arquivo-${index + 1}`
                    )}”.\n\n${error.message}`
                );
                break;
            }

            if (index < files.length - 1) {
                await new Promise((resolve) =>
                    window.setTimeout(resolve, 180)
                );
            }
        }
    }

    async function finalizarEntregaCriativa(job) {
        const confirmar = window.confirm(
            "Finalizar esta entrega?\n\nEla sairá de 'Recebidos para mim' e ficará em 'Temporários' por 7 dias. Depois, os arquivos serão removidos automaticamente do servidor.\n\nConfirme somente depois de baixar o que precisa."
        );

        if (!confirmar) return;

        try {
            await request(`/api/creative/jobs/${job.id}/finish`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: usuarioSelecionado.id,
                }),
            });

            setCreativeExpandedId(null);
            await carregarCreative(usuarioSelecionado.id, true);
        } catch (error) {
            alert(error.message);
        }
    }

    function abrirConteudo(conteudo, notificationAlreadyRead = false) {
        setConteudoAberto(conteudo);

        if (!notificationAlreadyRead && !usuarioEhGerente) {
            marcarNotificacoesEntidadeComoLidas(
                "content",
                conteudo.id
            );
        }
        setDetalheForm({
            title: conteudo.title,
            date: conteudo.date,
            brands: [...conteudo.brands],
            format: conteudo.format,
            status: conteudo.status,
            responsible: conteudo.responsible || "",
            urgency: conteudo.urgency || "verde",
            reference_link: conteudo.reference_link || "",
            description: conteudo.description || "",
            copy_text: conteudo.copy_text || "",
            published_url: conteudo.published_url || "",
            published_by_user_id: Number(conteudo.published_by_user_id || conteudo.user_id),
            platform: conteudo.platform || "Instagram",
            is_live: Boolean(conteudo.is_live),
            approval_required:
                conteudo.approval_required !== false,
        });
        setMetricasForm({
            views: Number(conteudo.metric_views || 0),
            likes: Number(conteudo.metric_likes || 0),
            comments: Number(conteudo.metric_comments || 0),
            shares: Number(conteudo.metric_shares || 0),
            saves: Number(conteudo.metric_saves || 0),
            reach: Number(conteudo.metric_reach || 0),
        });
        setArquivosSelecionados([]);
    }

    function atualizarConteudoLocal(atualizado) {
        setConteudos((anteriores) =>
            anteriores.map((item) => (item.id === atualizado.id ? atualizado : item))
        );
        if (conteudoAberto?.id === atualizado.id) setConteudoAberto(atualizado);
    }

    function alternarMarcaDetalhe(marca) {
        setDetalheForm((anterior) => ({
            ...anterior,
            brands: anterior.brands.includes(marca)
                ? anterior.brands.filter((item) => item !== marca)
                : [...anterior.brands, marca],
        }));
    }

    async function salvarDetalhes(event) {
        event.preventDefault();
        try {
            const atualizado = await request(`/api/contents/${conteudoAberto.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(detalheForm),
            });
            atualizarConteudoLocal(atualizado);

            if (
                atualizado.manager_request?.status === "Concluído"
            ) {
                await carregarPedidosGerentes(true);
            }

            setMetricasForm({
                views: Number(atualizado.metric_views || 0),
                likes: Number(atualizado.metric_likes || 0),
                comments: Number(atualizado.metric_comments || 0),
                shares: Number(atualizado.metric_shares || 0),
                saves: Number(atualizado.metric_saves || 0),
                reach: Number(atualizado.metric_reach || 0),
            });
            alert("Conteúdo salvo.");
        } catch (error) {
            alert(error.message);
        }
    }

    async function enviarArquivos() {
        if (!conteudoAberto || !arquivosSelecionados.length) return;
        try {
            setEnviandoArquivo(true);
            const formData = new FormData();
            arquivosSelecionados.forEach((arquivo) => formData.append("files", arquivo));
            const atualizado = await request(`/api/contents/${conteudoAberto.id}/files`, {
                method: "POST",
                body: formData,
            });
            atualizarConteudoLocal(atualizado);
            setDetalheForm((anterior) => ({
                ...anterior,
                status: atualizado.status,
            }));
            setArquivosSelecionados([]);
        } catch (error) {
            alert(error.message);
        } finally {
            setEnviandoArquivo(false);
        }
    }

    async function removerArquivo(arquivo) {
        if (!window.confirm(`Remover ${arquivo.original_name}?`)) return;
        try {
            await request(`/api/files/${arquivo.id}`, { method: "DELETE" });
            atualizarConteudoLocal({
                ...conteudoAberto,
                files: conteudoAberto.files.filter((item) => item.id !== arquivo.id),
            });
        } catch (error) {
            alert(error.message);
        }
    }

    async function alterarNecessidadeAprovacao(required) {
        if (!conteudoAberto || usuarioEhGerente) return;

        if (conteudoAberto.is_live) {
            return alert(
                "Retire o conteúdo do NO AR antes de alterar a necessidade de aprovação."
            );
        }

        const atual =
            conteudoAberto.approval_required !== false;

        if (atual === required) return;

        if (
            !required &&
            ["idea", "final"].includes(
                String(conteudoAberto.approval_stage || "")
            ) &&
            !window.confirm(
                "Este conteúdo está em aprovação.\n\nAo marcar como “Não necessária”, ele sairá da fila do gerente e ficará liberado para publicação. Deseja continuar?"
            )
        ) {
            return;
        }

        try {
            const atualizado = await request(
                `/api/contents/${conteudoAberto.id}/approval-requirement`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        approval_required: required,
                        user_id: usuarioSelecionado?.id,
                    }),
                }
            );

            atualizarConteudoLocal(atualizado);

            setDetalheForm((anterior) => ({
                ...anterior,
                approval_required:
                    atualizado.approval_required !== false,
                status: atualizado.status,
            }));
        } catch (error) {
            alert(error.message);
        }
    }

    async function enviarConteudoParaAprovacao(conteudo, stage) {
        if (!conteudo || usuarioEhGerente) return;

        if (conteudo.approval_required === false) {
            return alert(
                "Este conteúdo está marcado como publicação sem aprovação gerencial."
            );
        }

        if (stage === "final" && !(conteudo.files || []).length) {
            return alert(
                "Anexe pelo menos um arquivo final antes de enviar o conteúdo para aprovação do gerente."
            );
        }

        const texto =
            stage === "idea"
                ? "Enviar esta ideia para aprovação do gerente?"
                : "Enviar o conteúdo final para aprovação do gerente?\n\nConfirme se o arquivo final já está anexado e pronto para revisão.";

        if (!window.confirm(texto)) return;

        try {
            let conteudoAtual = conteudo;

            /*
             * Se o colaborador estiver com o modal aberto, salva briefing,
             * copy, referências e status antes de mandar para o gerente.
             */
            if (
                conteudoAberto?.id === conteudo.id &&
                detalheForm
            ) {
                conteudoAtual = await request(
                    `/api/contents/${conteudo.id}`,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(detalheForm),
                    }
                );

                atualizarConteudoLocal(conteudoAtual);
            }

            if (stage === "final" && !(conteudoAtual.files || []).length) {
                return alert(
                    "Anexe pelo menos um arquivo final antes de enviar o conteúdo para aprovação do gerente."
                );
            }

            const atualizado = await request(
                `/api/contents/${conteudo.id}/submit-approval`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ stage }),
                }
            );

            atualizarConteudoLocal(atualizado);

            alert(
                stage === "idea"
                    ? "Ideia enviada para aprovação do gerente."
                    : "Conteúdo final enviado para aprovação do gerente."
            );
        } catch (error) {
            alert(error.message);
        }
    }

    async function aprovarConteudo(id, stage = null) {
        if (!usuarioEhGerente) {
            return alert("A aprovação é exclusiva do perfil Gerente.");
        }

        try {
            const atualizado = await request(
                `/api/manager/contents/${id}/approve`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        manager_id: usuarioSelecionado.id,
                        stage,
                    }),
                }
            );

            atualizarConteudoLocal(atualizado);

            /*
             * Se o gerente estiver com Detalhes aberto, mantemos o modal
             * aberto e atualizamos o conteúdo. Assim, depois de aprovar a
             * ideia, a segunda decisão aparece imediatamente se o arquivo
             * final já tiver sido anexado.
             */
            if (
                managerDetailContent &&
                Number(managerDetailContent.id) === Number(id)
            ) {
                setManagerDetailContent({
                    ...atualizado,
                    manager_view_stage:
                        stage ||
                        managerDetailContent.manager_view_stage ||
                        atualizado.approval_stage,
                });
            }

            await carregarAprovacoesGerente(usuarioSelecionado.id, true);
        } catch (error) {
            alert(error.message);
        }
    }

    async function desfazerAprovacaoConteudo(content, stage = "final") {
        if (!usuarioEhGerente) return;

        if (content.is_live) {
            return alert(
                "Este conteúdo já está NO AR. Retire-o do ar antes de desfazer qualquer aprovação."
            );
        }

        const etapa =
            stage === "idea" ? "aprovação da ideia" : "aprovação final";

        if (
            !window.confirm(
                `Desfazer a ${etapa} de “${content.title}”?\n\nA decisão voltará para a aba Pendentes do gerente.`
            )
        ) {
            return;
        }

        try {
            const atualizado = await request(
                `/api/manager/contents/${content.id}/revoke-approval`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        manager_id: usuarioSelecionado.id,
                        stage,
                    }),
                }
            );

            atualizarConteudoLocal(atualizado);
            setManagerDetailContent(null);
            await carregarAprovacoesGerente(usuarioSelecionado.id, true);
        } catch (error) {
            alert(error.message);
        }
    }

    async function desfazerAprovacaoCriativa(job) {
        if (!usuarioEhGerente) return;

        if (["finalizado", "arquivado"].includes(job.status)) {
            return alert(
                "Esta entrega já foi finalizada pelo destinatário e não pode mais ter a aprovação desfeita."
            );
        }

        const confirmar = window.confirm(
            `Desfazer a aprovação de “${job.title}”?\n\nA arte voltará para Pendentes e deixará de aparecer em Recebidos para o colaborador.\n\nSe ele já tiver baixado algum arquivo, esse download não pode ser desfeito.`
        );

        if (!confirmar) return;

        try {
            await request(
                `/api/creative/jobs/${job.id}/revoke-approval`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        manager_id: usuarioSelecionado.id,
                    }),
                }
            );

            await carregarAprovacoesGerente(usuarioSelecionado.id, true);
        } catch (error) {
            alert(error.message);
        }
    }

    async function reenviarConteudoAprovacao(id, stage) {
        const conteudo =
            conteudos.find((item) => item.id === id) || conteudoAberto;

        if (!conteudo) return;

        await enviarConteudoParaAprovacao(conteudo, stage);
    }

    function abrirRevisao(id, stage = "final") {
        setRevisaoId(id);
        setRevisaoTipo(stage);
        setRevisaoNota("");
        setRevisaoAberta(true);
    }

    async function salvarRevisao(event) {
        event.preventDefault();
        if (!revisaoNota.trim()) return alert("Escreva a observação.");

        try {
            const atualizado = await request(
                `/api/manager/contents/${revisaoId}/request-changes`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        manager_id: usuarioSelecionado.id,
                        stage: revisaoTipo,
                        note: revisaoNota,
                    }),
                }
            );

            atualizarConteudoLocal(atualizado);
            setRevisaoAberta(false);
            setManagerDetailContent(null);

            if (usuarioEhGerente) {
                await carregarAprovacoesGerente(usuarioSelecionado.id, true);
            }
        } catch (error) {
            alert(error.message);
        }
    }

    async function recusarConteudo(id, stage = "idea") {
        if (!usuarioEhGerente) {
            return alert("A recusa é exclusiva do Gerente de Marketing.");
        }

        const etapa = stage === "idea" ? "esta ideia" : "este conteúdo final";
        if (!window.confirm(`Recusar ${etapa}?\n\nO colaborador será avisado e esta solicitação sairá das aprovações pendentes.`)) {
            return;
        }

        try {
            const atualizado = await request(
                `/api/manager/contents/${id}/reject`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        manager_id: usuarioSelecionado.id,
                        stage,
                    }),
                }
            );

            atualizarConteudoLocal(atualizado);
            setManagerDetailContent(null);
            await carregarAprovacoesGerente(usuarioSelecionado.id, true);
        } catch (error) {
            alert(error.message);
        }
    }

    async function salvarMetricasManuais(event) {
        event?.preventDefault?.();
        if (!conteudoAberto) return;

        if (isStoriesFormat(conteudoAberto.format)) {
            return alert(
                "Stories não precisam de métricas manuais. Eles entram no relatório apenas pela quantidade publicada."
            );
        }

        try {
            const atualizado = await request(`/api/contents/${conteudoAberto.id}/metrics`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(metricasForm),
            });

            atualizarConteudoLocal(atualizado);

            setDetalheForm((anterior) => ({
                ...anterior,
                status: atualizado.status || anterior.status,
                is_live: Boolean(atualizado.is_live),
                published_url: atualizado.published_url || anterior.published_url,
                published_by_user_id:
                    atualizado.published_by_user_id ||
                    anterior.published_by_user_id ||
                    atualizado.user_id,
            }));

            setMetricasForm({
                views: Number(atualizado.metric_views || 0),
                likes: Number(atualizado.metric_likes || 0),
                comments: Number(atualizado.metric_comments || 0),
                shares: Number(atualizado.metric_shares || 0),
                saves: Number(atualizado.metric_saves || 0),
                reach: Number(atualizado.metric_reach || 0),
            });

            await carregarRelatorio(true);
        } catch (error) {
            alert(error.message);
        }
    }

    async function alternarNoAr() {
        if (!conteudoAberto) return;

        const estaNoAr = Boolean(conteudoAberto.is_live);

        if (
            estaNoAr &&
            !window.confirm(
                "Desmarcar esta publicação como NO AR?\n\nEla sairá da área de publicações no ar e dos relatórios até ser marcada novamente."
            )
        ) {
            return;
        }

        try {
            const atualizado = await request(`/api/contents/${conteudoAberto.id}/live`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    is_live: !estaNoAr,
                    published_by_user_id:
                        Number(detalheForm?.published_by_user_id) ||
                        conteudoAberto.published_by_user_id ||
                        conteudoAberto.user_id,
                }),
            });

            atualizarConteudoLocal(atualizado);

            setDetalheForm((anterior) => ({
                ...anterior,
                status: atualizado.status,
                is_live: Boolean(atualizado.is_live),
                published_by_user_id:
                    atualizado.published_by_user_id ||
                    anterior.published_by_user_id ||
                    atualizado.user_id,
            }));

            await carregarRelatorio(true);
        } catch (error) {
            alert(error.message);
        }
    }

    const conteudosDoMesSelecionado = useMemo(() => {
        const busca = buscaConteudo.trim().toLowerCase();

        return conteudos.filter((conteudo) => {
            const correspondeBusca =
                !busca ||
                conteudo.title.toLowerCase().includes(busca) ||
                conteudo.brands.join(" ").toLowerCase().includes(busca) ||
                String(conteudo.description || "").toLowerCase().includes(busca);

            if (!correspondeBusca) return false;

            const chave =
                conteudo.is_live
                    ? dataPublicacaoConteudo(conteudo)
                    : conteudo.date;

            if (!chave) return false;

            const data = dataDaChave(chave);

            return (
                data.getFullYear() === Number(conteudosAno) &&
                data.getMonth() + 1 === Number(conteudosMes)
            );
        });
    }, [conteudos, buscaConteudo, conteudosMes, conteudosAno]);

    const conteudosAguardandoAprovacao = useMemo(
        () =>
            conteudosDoMesSelecionado
                .filter(
                    (conteudo) =>
                        !conteudo.is_live &&
                        (
                            (conteudo.approval_stage === "idea" &&
                                conteudo.idea_approval_status === "pendente") ||
                            (conteudo.approval_stage === "final" &&
                                conteudo.approval_status === "pendente")
                        )
                )
                .sort(
                    (a, b) =>
                        a.date.localeCompare(b.date) ||
                        a.title.localeCompare(b.title)
                ),
        [conteudosDoMesSelecionado]
    );

    const conteudosAprovadosParaPublicar = useMemo(
        () =>
            conteudosDoMesSelecionado
                .filter(
                    (conteudo) =>
                        !conteudo.is_live &&
                        (
                            conteudo.approval_status === "aprovado" ||
                            conteudo.approval_required === false
                        )
                )
                .sort(
                    (a, b) =>
                        a.date.localeCompare(b.date) ||
                        a.title.localeCompare(b.title)
                ),
        [conteudosDoMesSelecionado]
    );

    const conteudosEmAndamento = useMemo(
        () =>
            conteudosDoMesSelecionado
                .filter((conteudo) => {
                    if (conteudo.is_live) return false;

                    const aguardando =
                        (conteudo.approval_stage === "idea" &&
                            conteudo.idea_approval_status === "pendente") ||
                        (conteudo.approval_stage === "final" &&
                            conteudo.approval_status === "pendente");

                    if (aguardando) return false;

                    if (
                        conteudo.approval_status === "aprovado" ||
                        conteudo.approval_required === false
                    ) {
                        return false;
                    }

                    return true;
                })
                .sort(
                    (a, b) =>
                        a.date.localeCompare(b.date) ||
                        a.title.localeCompare(b.title)
                ),
        [conteudosDoMesSelecionado]
    );

    const conteudosNoAr = useMemo(
        () =>
            conteudosDoMesSelecionado
                .filter((conteudo) => conteudo.is_live)
                .sort(
                    (a, b) =>
                        dataPublicacaoConteudo(b).localeCompare(
                            dataPublicacaoConteudo(a)
                        ) || b.id - a.id
                ),
        [conteudosDoMesSelecionado]
    );

    const conteudosPeriodo = useMemo(
        () =>
            conteudos.filter((conteudo) => {
                const data = dataDaChave(conteudo.date);
                if (modo === "mensal") {
                    return (
                        data.getFullYear() === dataAtual.getFullYear() &&
                        data.getMonth() === dataAtual.getMonth()
                    );
                }
                const inicio = inicioDaSemana(dataAtual);
                const fim = new Date(inicio);
                fim.setDate(inicio.getDate() + 6);
                fim.setHours(23, 59, 59, 999);
                return data >= inicio && data <= fim;
            }),
        [conteudos, dataAtual, modo]
    );

    function alternarMarcaPerfil(marca) {
        setPerfilForm((anterior) => ({
            ...anterior,
            brands: anterior.brands.includes(marca)
                ? anterior.brands.filter((item) => item !== marca)
                : [...anterior.brands, marca],
        }));
    }

    async function salvarPerfil(event) {
        event.preventDefault();
        if (!perfilForm.name.trim()) return alert("Digite seu nome.");

        try {
            setSalvandoPerfil(true);
            let atualizado = await request(`/api/users/${usuarioSelecionado.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(perfilForm),
            });

            if (fotoPerfil) {
                const formData = new FormData();
                formData.append("photo", fotoPerfil);
                atualizado = await request(`/api/users/${usuarioSelecionado.id}/photo`, {
                    method: "POST",
                    body: formData,
                });
            }

            setUsuarioSelecionado(atualizado);
            setUsuarios((anteriores) =>
                anteriores
                    .map((item) => (item.id === atualizado.id ? atualizado : item))
                    .sort((a, b) => a.name.localeCompare(b.name))
            );
            preencherPerfil(atualizado);
            await carregarConteudos(atualizado.id, true);
            alert("Perfil atualizado.");
        } catch (error) {
            alert(error.message);
        } finally {
            setSalvandoPerfil(false);
        }
    }

    async function removerFotoPerfil() {
        if (!usuarioSelecionado?.photo_url) return;
        if (!window.confirm("Remover sua foto de perfil?")) return;
        try {
            const atualizado = await request(`/api/users/${usuarioSelecionado.id}/photo`, {
                method: "DELETE",
            });
            setUsuarioSelecionado(atualizado);
            setUsuarios((anteriores) =>
                anteriores.map((item) => (item.id === atualizado.id ? atualizado : item))
            );
        } catch (error) {
            alert(error.message);
        }
    }

    async function carregarPedidosGerentes(silencioso = false) {
        try {
            if (!silencioso) setPedidoCarregando(true);
            const data = await request("/api/manager-requests");
            setPedidosGerentes(Array.isArray(data) ? data : []);
            if (pedidoAberto?.id) {
                const refreshed = (Array.isArray(data) ? data : []).find((item) => item.id === pedidoAberto.id);
                if (refreshed) setPedidoAberto(refreshed);
            }
        } catch (error) {
            if (!silencioso) alert(error.message);
        } finally {
            if (!silencioso) setPedidoCarregando(false);
        }
    }

    async function removerPedidoGestor(pedido) {
        const encaminhado = Boolean(Number(pedido.assigned_content_id || 0));
        const mensagem = encaminhado
            ? `Cancelar o pedido “${pedido.title}”?\n\nA demanda vinculada também será cancelada e o pedido irá para a Lixeira por 24 horas.`
            : `Excluir o pedido “${pedido.title}”?\n\nEle irá para a Lixeira por 24 horas e poderá ser restaurado nesse período.`;

        if (!window.confirm(mensagem)) return;

        try {
            await request(`/api/manager-requests/${pedido.id}/remove`, {
                method: "POST",
            });
            await carregarPedidosGerentes(true);
            if (pedidoAberto?.id === pedido.id) setPedidoAberto(null);
        } catch (error) {
            alert(error.message);
        }
    }

    async function restaurarPedidoGestor(pedido) {
        try {
            await request(`/api/manager-requests/${pedido.id}/restore`, {
                method: "POST",
            });
            await carregarPedidosGerentes(true);
        } catch (error) {
            alert(error.message);
        }
    }

    async function abrirPedidoGerente(pedido) {
        setPedidoAberto(pedido);
        setPedidoMensagem("");
        setPedidoEncaminhamento({
            user_id: pedido.assigned_user_id ? String(pedido.assigned_user_id) : "",
            date: pedido.assigned_date || "",
            deadline: pedido.final_deadline || "",
            urgency: pedido.assigned_urgency || (pedido.priority === "Urgente" ? "vermelho" : pedido.priority === "Alta" ? "amarelo" : "verde"),
        });
        if (isManagerProfile(usuarioSelecionado)) carregarDestinatariosPedido();
        try {
            const updates = await request(`/api/manager-requests/${pedido.id}/updates`);
            setPedidoUpdates(Array.isArray(updates) ? updates : []);
        } catch {
            setPedidoUpdates([]);
        }
    }

    function selecionarReferenciasPedido(event) {
        const incoming = Array.from(event.target.files || []);
        if (!incoming.length) return;

        const allowedExtensions = new Set([
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".mp4",
            ".mov",
            ".webm",
        ]);
        const maxBytes = 30 * 1024 * 1024;
        const current = [...pedidoReferenceFiles];

        for (const file of incoming) {
            const extension = `.${String(file.name || "")
                .split(".")
                .pop()
                .toLowerCase()}`;

            if (!allowedExtensions.has(extension)) {
                alert(
                    `${file.name}: formato não permitido. Use JPG, JPEG, PNG, WEBP, MP4, MOV ou WEBM.`
                );
                continue;
            }

            if (Number(file.size || 0) > maxBytes) {
                alert(`${file.name}: o arquivo ultrapassa 30 MB.`);
                continue;
            }

            const duplicate = current.some(
                (item) =>
                    item.name === file.name &&
                    Number(item.size) === Number(file.size)
            );
            if (!duplicate) current.push(file);
        }

        if (current.length > 5) {
            alert("Você pode anexar no máximo 5 arquivos de referência por pedido.");
        }

        setPedidoReferenceFiles(current.slice(0, 5));
        event.target.value = "";
    }

    function removerReferenciaPedidoSelecionada(index) {
        setPedidoReferenceFiles((current) =>
            current.filter((_, itemIndex) => itemIndex !== index)
        );
    }

    async function enviarReferenciasDoPedido(requestId, files) {
        if (!requestId || !files?.length) return null;
        const body = new FormData();
        files.forEach((file) => body.append("files", file));
        return request(`/api/manager-requests/${requestId}/files`, {
            method: "POST",
            body,
        });
    }

    async function criarPedidoGerente(event) {
        event.preventDefault();
        try {
            setPedidoCarregando(true);
            const created = await request("/api/manager-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...pedidoForm,
                    brand: (usuarioSelecionado?.brands || []).length > 1 ? (pedidoForm.brand || usuarioSelecionado.brands[0]) : (usuarioSelecionado?.brands?.[0] || ""),
                }),
            });

            let finalCreated = created;
            if (pedidoReferenceFiles.length) {
                try {
                    finalCreated =
                        (await enviarReferenciasDoPedido(
                            created.id,
                            pedidoReferenceFiles
                        )) || created;
                } catch (uploadError) {
                    alert(
                        `O pedido foi criado, mas os anexos não foram enviados: ${uploadError.message}`
                    );
                }
            }

            setPedidosGerentes((current) => [finalCreated, ...current]);
            setPedidoForm({
                title: "",
                brand: "",
                request_type: "Arte / Material gráfico",
                desired_date: "",
                priority: "Normal",
                objective: "",
                target_audience: "",
                required_info: "",
                channels: [],
                print_dimensions: "",
                description: "",
                references_text: "",
            });
            setPedidoReferenceFiles([]);
            setNovoPedidoAberto(false);
            await abrirPedidoGerente(finalCreated);
        } catch (error) {
            alert(error.message);
        } finally {
            setPedidoCarregando(false);
        }
    }

    async function decidirPedidoGerente(action, note = "") {
        if (!pedidoAberto?.id) return;

        if (action === "reject") {
            const confirmar = window.confirm(
                "Reprovar este pedido?\n\nEle não poderá ser encaminhado para o SQUAD enquanto estiver reprovado."
            );
            if (!confirmar) return;
        }

        try {
            setPedidoDecidindo(true);
            const atualizado = await request(
                `/api/manager-requests/${pedidoAberto.id}/decision`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action, note }),
                }
            );

            setPedidoAberto(atualizado);
            setPedidosGerentes((current) =>
                current.map((item) =>
                    Number(item.id) === Number(atualizado.id)
                        ? atualizado
                        : item
                )
            );

            const updates = await request(
                `/api/manager-requests/${pedidoAberto.id}/updates`
            );
            setPedidoUpdates(Array.isArray(updates) ? updates : []);

            if (action === "review") {
                setPedidoRevisaoAberta(false);
                setPedidoRevisaoNota("");
            }
        } catch (error) {
            alert(error.message);
        } finally {
            setPedidoDecidindo(false);
        }
    }

    async function enviarRevisaoPedido(event) {
        event.preventDefault();
        const note = pedidoRevisaoNota.trim();
        if (!note) return alert("Escreva o que precisa ser revisado.");
        await decidirPedidoGerente("review", note);
    }

    async function adicionarAtualizacaoPedido(event) {
        event.preventDefault();
        if (!pedidoAberto?.id || !pedidoMensagem.trim()) return;
        try {
            const created = await request(`/api/manager-requests/${pedidoAberto.id}/updates`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: pedidoMensagem }),
            });
            setPedidoUpdates((current) => [...current, created]);
            if (created.request_status) {
                setPedidoAberto((current) => ({
                    ...current,
                    status: created.request_status,
                }));
            }
            setPedidoMensagem("");
            await carregarPedidosGerentes(true);
        } catch (error) {
            alert(error.message);
        }
    }

    async function atualizarPedidoComoMarketing(patch) {
        if (!pedidoAberto?.id) return;
        try {
            const updated = await request(`/api/manager-requests/${pedidoAberto.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            });
            setPedidoAberto(updated);
            setPedidosGerentes((current) => current.map((item) => item.id === updated.id ? updated : item));
        } catch (error) {
            alert(error.message);
        }
    }

    async function carregarDestinatariosPedido() {
        try {
            const data = await request("/api/manager-requests/assignment-options");
            setPedidoDestinatarios(Array.isArray(data) ? data : []);
        } catch (error) {
            setPedidoDestinatarios([]);
            alert(error.message);
        }
    }

    async function encaminharPedidoParaSquad(event) {
        event.preventDefault();
        if (!pedidoAberto?.id) return;
        if (!pedidoEncaminhamento.user_id) return alert("Escolha um Social Media ou Designer.");
        if (!pedidoEncaminhamento.date) return alert("Escolha a data de início na agenda.");
        if (!pedidoEncaminhamento.deadline) return alert("Defina o prazo oficial de entrega.");
        if (pedidoEncaminhamento.deadline < pedidoEncaminhamento.date) {
            return alert("O prazo oficial não pode ser anterior à data de início na agenda.");
        }
        try {
            setPedidoEncaminhando(true);
            const result = await request(`/api/manager-requests/${pedidoAberto.id}/forward`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(pedidoEncaminhamento),
            });
            setPedidoAberto(result.request);
            setPedidosGerentes((current) => current.map((item) => item.id === result.request.id ? result.request : item));
            const updates = await request(`/api/manager-requests/${pedidoAberto.id}/updates`);
            setPedidoUpdates(Array.isArray(updates) ? updates : []);
            alert(`Pedido encaminhado para ${result.request.assigned_user_name}. Já entrou na agenda do colaborador.`);
        } catch (error) {
            alert(error.message);
        } finally {
            setPedidoEncaminhando(false);
        }
    }

    function renderPedidoDetalhe(externo = false) {
        if (!pedidoAberto) return null;

        const podeDecidir = !externo && ["Recebido", "Revisão solicitada"].includes(pedidoAberto.status);
        const aprovadoParaEncaminhar =
            !externo &&
            ["Aprovado", "Em andamento", "Concluído"].includes(pedidoAberto.status);
        const revisaoSolicitada = pedidoAberto.status === "Revisão solicitada";
        const reprovado = pedidoAberto.status === "Reprovado";

        return (
            <div className="manager-request-detail-overlay" onMouseDown={() => setPedidoAberto(null)}>
                <section className="manager-request-detail manager-request-detail-modal" onMouseDown={(event) => event.stopPropagation()}>
                    <div className="manager-request-detail-head">
                        <div>
                            <span>PEDIDO #{String(pedidoAberto.id).padStart(4, "0")}</span>
                            <h2>{pedidoAberto.title}</h2>
                            <p>{externo ? "Acompanhamento com o Gerente de Marketing" : `${pedidoAberto.requester_name} • ${pedidoAberto.requester_role || "Gerente"}`}</p>
                        </div>
                        <button type="button" onClick={() => setPedidoAberto(null)}>×</button>
                    </div>

                    <div className="manager-request-meta manager-request-meta-expanded">
                        <div><small>Status</small><strong>{pedidoAberto.status}</strong></div>
                        <div><small>Marca</small><strong>{pedidoAberto.brand || "—"}</strong></div>
                        <div><small>Solicitante</small><strong>{pedidoAberto.requester_name || "—"}</strong></div>
                        <div><small>O que precisamos?</small><strong>{pedidoAberto.request_type || "—"}</strong></div>
                        <div>
                            <small>Prazo desejado</small>
                            <strong>{pedidoAberto.desired_date ? new Date(`${pedidoAberto.desired_date}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</strong>
                        </div>
                        <div className={pedidoAberto.final_deadline ? "official-deadline-set" : ""}>
                            <small>Prazo oficial</small>
                            <strong>{pedidoAberto.final_deadline ? new Date(`${pedidoAberto.final_deadline}T12:00:00`).toLocaleDateString("pt-BR") : "A definir pelo Marketing"}</strong>
                        </div>
                    </div>

                    <div className="manager-request-brief manager-request-brief-expanded">
                        <div className="manager-request-brief-grid">
                            <div>
                                <span>OBJETIVO</span>
                                <p>{pedidoAberto.objective || "Não informado."}</p>
                            </div>
                            <div>
                                <span>PÚBLICO-ALVO</span>
                                <p>{pedidoAberto.target_audience || "Não informado."}</p>
                            </div>
                        </div>

                        <span>INFORMAÇÕES OBRIGATÓRIAS</span>
                        <p>{pedidoAberto.required_info || "Nenhuma informação obrigatória informada."}</p>

                        <span>CANAIS DE DIVULGAÇÃO</span>
                        <div className="manager-request-channel-readonly">
                            {(pedidoAberto.channels || []).length
                                ? pedidoAberto.channels.map((canal) => <b key={canal}>{canal}</b>)
                                : <p>Nenhum canal informado.</p>}
                        </div>

                        {pedidoAberto.print_dimensions && (
                            <>
                                <span>MEDIDAS DO MATERIAL IMPRESSO</span>
                                <p>{pedidoAberto.print_dimensions}</p>
                            </>
                        )}

                        <span>DETALHES / CONTEXTO</span>
                        <p>{pedidoAberto.description}</p>

                        {pedidoAberto.references_text && (
                            <>
                                <span>REFERÊNCIAS / LINKS</span>
                                <p>{pedidoAberto.references_text}</p>
                            </>
                        )}

                        {(pedidoAberto.files || []).length > 0 && (
                            <div className="manager-request-reference-gallery">
                                <div className="manager-request-reference-gallery-head">
                                    <span>ARQUIVOS DE REFERÊNCIA</span>
                                    <strong>
                                        {pedidoAberto.files.length} arquivo(s)
                                    </strong>
                                </div>
                                <div className="manager-request-reference-grid">
                                    {pedidoAberto.files.map((file) => {
                                        const isVideo = String(
                                            file.mime_type || ""
                                        ).startsWith("video/");
                                        const isImage = String(
                                            file.mime_type || ""
                                        ).startsWith("image/");

                                        return (
                                            <article
                                                className="manager-request-reference-card"
                                                key={file.id}
                                            >
                                                <div className="manager-request-reference-preview">
                                                    {isImage ? (
                                                        <img
                                                            src={file.url}
                                                            alt={file.original_name}
                                                        />
                                                    ) : isVideo ? (
                                                        <video
                                                            src={file.url}
                                                            controls
                                                            preload="metadata"
                                                        />
                                                    ) : (
                                                        <span>ARQUIVO</span>
                                                    )}
                                                </div>
                                                <div className="manager-request-reference-file-copy">
                                                    <strong>
                                                        {file.original_name}
                                                    </strong>
                                                    <small>
                                                        {(Number(file.file_size || 0) /
                                                            1024 /
                                                            1024).toFixed(1)} MB
                                                    </small>
                                                </div>
                                                <div className="manager-request-reference-actions">
                                                    <a
                                                        href={file.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        Abrir
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            baixarArquivoComNomeOriginal(
                                                                file,
                                                                "manager_request"
                                                            ).catch((error) =>
                                                                alert(error.message)
                                                            )
                                                        }
                                                    >
                                                        Baixar
                                                    </button>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {pedidoAberto.timeline?.steps?.length > 0 && (
                        <section className="manager-request-timeline-section">
                            <div className="manager-request-timeline-head">
                                <div>
                                    <span>ACOMPANHAMENTO</span>
                                    <h3>Timeline da solicitação</h3>
                                    <p>Acompanhe em qual etapa a demanda está dentro do Marketing.</p>
                                </div>
                                <strong>{pedidoAberto.timeline.current_label}</strong>
                            </div>
                            <div className="manager-request-timeline">
                                {pedidoAberto.timeline.steps.map((step, index) => (
                                    <div className={`manager-request-timeline-step ${step.state}`} key={step.key}>
                                        <div className="manager-request-timeline-marker">
                                            <i>{step.state === "done" ? "✓" : step.state === "rejected" ? "×" : index + 1}</i>
                                            {index < pedidoAberto.timeline.steps.length - 1 && <span />}
                                        </div>
                                        <div className="manager-request-timeline-copy">
                                            <strong>{step.label}</strong>
                                            <p>{step.description}</p>
                                            {step.date && <small>{step.date}</small>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {!externo && (
                        <section className={`manager-request-decision status-${String(pedidoAberto.status).toLowerCase().replaceAll(" ","-").replaceAll("ã","a").replaceAll("ç","c")}`}>
                            <div className="manager-request-decision-head">
                                <div>
                                    <span>DECISÃO DO MARKETING</span>
                                    <h3>Analisar solicitação</h3>
                                    <p>Primeiro decida se o pedido está aprovado, precisa de revisão ou será reprovado.</p>
                                </div>
                                {!podeDecidir && (
                                    <strong className="manager-request-decision-state">
                                        {pedidoAberto.status}
                                    </strong>
                                )}
                            </div>

                            {podeDecidir ? (
                                <div className="manager-request-decision-actions">
                                    <button
                                        type="button"
                                        className="request-approve-button"
                                        disabled={pedidoDecidindo}
                                        onClick={() => decidirPedidoGerente("approve")}
                                    >
                                        ✓ Aprovado
                                    </button>

                                    <button
                                        type="button"
                                        className="request-review-button"
                                        disabled={pedidoDecidindo}
                                        onClick={() => {
                                            setPedidoRevisaoNota(pedidoAberto.manager_response || "");
                                            setPedidoRevisaoAberta(true);
                                        }}
                                    >
                                        ↻ Revisar
                                    </button>

                                    <button
                                        type="button"
                                        className="request-reject-button"
                                        disabled={pedidoDecidindo}
                                        onClick={() => decidirPedidoGerente("reject")}
                                    >
                                        ✕ Reprovado
                                    </button>
                                </div>
                            ) : pedidoAberto.status === "Aprovado" ? (
                                <div className="request-decision-message approved">
                                    <strong>✓ Pedido aprovado</strong>
                                    <span>Agora você pode encaminhar a demanda para um Social Media ou Designer.</span>
                                </div>
                            ) : revisaoSolicitada ? (
                                <div className="request-decision-message review">
                                    <strong>↻ Revisão solicitada</strong>
                                    <span>{pedidoAberto.manager_response || "Aguardando alteração do gerente solicitante."}</span>
                                </div>
                            ) : reprovado ? (
                                <div className="request-decision-message rejected">
                                    <strong>✕ Pedido reprovado</strong>
                                    <span>Este pedido não será encaminhado para o SQUAD.</span>
                                </div>
                            ) : (
                                <div className="request-decision-message approved">
                                    <strong>{pedidoAberto.status}</strong>
                                    <span>O pedido já passou pela decisão inicial do Marketing.</span>
                                </div>
                            )}
                        </section>
                    )}

                    {externo && revisaoSolicitada && (
                        <section className="external-request-review-alert">
                            <span>REVISÃO SOLICITADA PELO MARKETING</span>
                            <strong>{pedidoAberto.manager_response || "O Marketing solicitou uma alteração neste pedido."}</strong>
                            <p>Envie a correção ou informação solicitada abaixo. Ao responder, o pedido volta automaticamente para análise do Gerente de Marketing.</p>
                        </section>
                    )}

                    {externo && reprovado && (
                        <section className="external-request-rejected-alert">
                            <span>PEDIDO REPROVADO</span>
                            <strong>O Gerente de Marketing reprovou esta solicitação.</strong>
                        </section>
                    )}

                    {aprovadoParaEncaminhar && (
                        <section className="manager-request-forward">
                            <div className="manager-request-forward-head">
                                <div>
                                    <span>ENCAMINHAR PARA O SQUAD</span>
                                    <h3>Colocar na agenda do colaborador</h3>
                                    <p>O pedido já foi aprovado. Defina quem executará, quando entra na agenda e qual é o prazo oficial de entrega.</p>
                                    <small className="manager-request-desired-reference">
                                        Prazo desejado pelo solicitante: <b>{pedidoAberto.desired_date ? new Date(`${pedidoAberto.desired_date}T12:00:00`).toLocaleDateString("pt-BR") : "não informado"}</b>. Ele é apenas uma referência e não vira prazo oficial automaticamente.
                                    </small>
                                </div>
                                {pedidoAberto.assigned_user_name && (
                                    <div className="manager-request-assigned">
                                        <small>ENCAMINHADO PARA</small>
                                        <strong>{pedidoAberto.assigned_user_name}</strong>
                                        <span>{pedidoAberto.assigned_user_role} • {pedidoAberto.assigned_date ? new Date(`${pedidoAberto.assigned_date}T12:00:00`).toLocaleDateString("pt-BR") : ""}</span>
                                    </div>
                                )}
                            </div>

                            <form className="manager-request-forward-form manager-request-forward-form-v2" onSubmit={encaminharPedidoParaSquad}>
                                <div>
                                    <label>Responsável</label>
                                    <select value={pedidoEncaminhamento.user_id} onChange={(e)=>setPedidoEncaminhamento({...pedidoEncaminhamento,user_id:e.target.value})}>
                                        <option value="">Selecione...</option>
                                        {pedidoDestinatarios.map((user)=><option key={user.id} value={user.id}>{user.name} • {user.role}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label>Início na agenda</label>
                                    <input type="date" value={pedidoEncaminhamento.date} onChange={(e)=>setPedidoEncaminhamento({...pedidoEncaminhamento,date:e.target.value})}/>
                                </div>
                                <div className="official-deadline-field">
                                    <label>Prazo oficial de entrega</label>
                                    <input type="date" value={pedidoEncaminhamento.deadline} onChange={(e)=>setPedidoEncaminhamento({...pedidoEncaminhamento,deadline:e.target.value})}/>
                                    <small>Este é o prazo que passa a valer para a execução.</small>
                                </div>
                                <div>
                                    <label>Urgência</label>
                                    <select value={pedidoEncaminhamento.urgency} onChange={(e)=>setPedidoEncaminhamento({...pedidoEncaminhamento,urgency:e.target.value})}>
                                        <option value="verde">🟢 Normal</option>
                                        <option value="amarelo">🟡 Atenção</option>
                                        <option value="vermelho">🔴 Urgente</option>
                                    </select>
                                </div>
                                <button className="primary-button" type="submit" disabled={pedidoEncaminhando}>
                                    {pedidoEncaminhando ? "Salvando..." : pedidoAberto.assigned_content_id ? "Atualizar planejamento" : "Definir prazo e encaminhar"}
                                </button>
                            </form>

                            {pedidoAberto.assigned_content_id && (
                                <small className="manager-request-forward-link">
                                    Demanda vinculada ao pedido #{String(pedidoAberto.id).padStart(4,"0")} • Alterações aqui atualizam a agenda do colaborador.
                                </small>
                            )}

                            {pedidoAberto.status === "Concluído" && (
                                <div className="manager-request-complete-box completed">
                                    <div>
                                        <strong>✓ Pedido concluído</strong>
                                        <span>A timeline do solicitante já mostra a entrega como finalizada.</span>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    <div className="manager-request-thread">
                        <div className="manager-request-thread-title">
                            <span>ATUALIZAÇÕES DO PEDIDO</span>
                            <small>{externo ? "Você ↔ Gerente de Marketing" : "Gerente de Marketing ↔ Solicitante"}</small>
                        </div>
                        {!pedidoUpdates.length ? (
                            <div className="manager-request-empty-thread">Nenhuma atualização adicionada ainda.</div>
                        ) : pedidoUpdates.map((item) => (
                            <article key={item.id} className={`manager-request-update ${item.author_access_role === "gerente" ? "marketing" : "requester"}`}>
                                <strong>{item.author_access_role === "gerente" ? "Gerente de Marketing" : item.author_name}</strong>
                                <p>{item.message}</p>
                                <small>{formatDateTime(item.created_at)}</small>
                            </article>
                        ))}
                    </div>

                    {(!reprovado || !externo) && (
                        <form className="manager-request-reply" onSubmit={adicionarAtualizacaoPedido}>
                            <textarea
                                value={pedidoMensagem}
                                onChange={(event) => setPedidoMensagem(event.target.value)}
                                placeholder={
                                    externo && revisaoSolicitada
                                        ? "Escreva aqui a alteração solicitada pelo Marketing..."
                                        : externo
                                            ? "Adicionar informação ao seu pedido..."
                                            : "Responder ao gerente solicitante..."
                                }
                            />
                            <button className="primary-button" type="submit">
                                {externo && revisaoSolicitada ? "Reenviar para análise" : "Enviar atualização"}
                            </button>
                        </form>
                    )}
                </section>

                {pedidoRevisaoAberta && !externo && (
                    <div className="simple-overlay manager-request-review-overlay" onMouseDown={() => setPedidoRevisaoAberta(false)}>
                        <section className="small-modal manager-request-review-modal" onMouseDown={(event) => event.stopPropagation()}>
                            <div className="modal-top">
                                <div>
                                    <span>REVISAR PEDIDO</span>
                                    <h2>O que precisa ser alterado?</h2>
                                </div>
                                <button type="button" onClick={() => setPedidoRevisaoAberta(false)}>×</button>
                            </div>
                            <form onSubmit={enviarRevisaoPedido}>
                                <label>Orientação para o gerente solicitante</label>
                                <textarea
                                    autoFocus
                                    required
                                    value={pedidoRevisaoNota}
                                    onChange={(event) => setPedidoRevisaoNota(event.target.value)}
                                    placeholder="Ex.: Precisamos ajustar o prazo, detalhar o formato da peça e enviar a referência correta."
                                />
                                <small>A orientação ficará registrada no pedido e o solicitante poderá responder com a alteração.</small>
                                <button className="primary-button" type="submit" disabled={pedidoDecidindo}>
                                    {pedidoDecidindo ? "Enviando..." : "Solicitar revisão"}
                                </button>
                            </form>
                        </section>
                    </div>
                )}
            </div>
        );
    }

    function renderPerfilGestorExterno() {
        return <div className="external-manager-profile-page">
            <div className="external-profile-heading"><span>MEU PERFIL</span><h2>Dados da conta</h2><p>Atualize seu nome, apelido, foto e senha. As marcas são controladas pela Área ADM.</p></div>
            <div className="external-profile-grid">
                <section className="external-profile-preview"><Avatar user={usuarioSelecionado} size="xlarge"/><h3>{usuarioSelecionado.nickname || usuarioSelecionado.name}</h3>{usuarioSelecionado.nickname && <p>{usuarioSelecionado.name}</p>}<strong>{usuarioSelecionado.role || "Gerente"}</strong><div className="profile-brand-list">{(usuarioSelecionado.brands || []).map((m)=><span key={m} className={`brand-badge ${brandClassName(m)}`}>{m}</span>)}</div></section>
                <form className="profile-form-card external-profile-form" onSubmit={salvarPerfil}>
                    <div className="profile-section-title"><span>PERSONALIZAÇÃO</span><h2>Editar meu perfil</h2></div>
                    <label>Foto de perfil</label><div className="profile-photo-row"><Avatar user={usuarioSelecionado} size="large"/><div><input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(e)=>setFotoPerfil(e.target.files?.[0] || null)}/><small>JPG, PNG ou WEBP • até 5 MB</small></div>{usuarioSelecionado.photo_url && <button type="button" className="text-danger-button" onClick={removerFotoPerfil}>Remover foto</button>}</div>
                    <div className="two-fields"><div><label>Nome</label><input value={perfilForm.name} onChange={(e)=>setPerfilForm({...perfilForm,name:e.target.value})}/></div><div><label>Apelido</label><input value={perfilForm.nickname} onChange={(e)=>setPerfilForm({...perfilForm,nickname:e.target.value})}/></div></div>
                    <label>Marcas autorizadas</label><div className="external-profile-brands-locked">{(usuarioSelecionado.brands || []).length ? usuarioSelecionado.brands.map((m)=><span key={m}>{m}</span>) : <small>Nenhuma marca definida. Solicite o ajuste ao ADM.</small>}</div>
                    <button className="primary-button profile-save" disabled={salvandoPerfil}>{salvandoPerfil ? "Salvando..." : "Salvar alterações"}</button>
                </form>
            </div>
            
        </div>;
    }

    function renderPortalGestorExterno() {
        const agora = Date.now();

        const ativos = pedidosGerentes.filter(
            (item) =>
                !item.deleted_at &&
                item.status !== "Concluído"
        );

        const concluidos = pedidosGerentes.filter(
            (item) =>
                !item.deleted_at &&
                item.status === "Concluído"
        );

        const lixeira = pedidosGerentes.filter((item) => {
            if (!item.deleted_at) return false;
            const deleted = new Date(item.deleted_at).getTime();
            return Number.isFinite(deleted) && agora - deleted <= 24 * 60 * 60 * 1000;
        });

        const fonte =
            portalGestorAba === "concluidos"
                ? concluidos
                : portalGestorAba === "lixeira"
                    ? lixeira
                    : ativos;

        const filtered = fonte.filter(
            (item) =>
                pedidoFiltro === "Todos" ||
                item.status === pedidoFiltro
        );

        const prazoVisualPedido = (pedido) => {
            const official = String(pedido.final_deadline || "").trim();
            const desired = String(pedido.desired_date || "").trim();
            const key = official || desired;

            if (!key) {
                return {
                    label: "Prazo",
                    value: "A definir",
                    note: "Aguardando planejamento",
                    tone: "waiting",
                };
            }

            const deadline = new Date(`${key}T12:00:00`);
            const today = new Date();
            today.setHours(12, 0, 0, 0);

            const diff = Math.round(
                (deadline.getTime() - today.getTime()) /
                    (24 * 60 * 60 * 1000)
            );

            let note = "";
            let tone = "normal";

            if (!official) {
                note = "Prazo desejado • aguardando prazo oficial";
                tone = "desired";
            } else if (diff < 0) {
                const days = Math.abs(diff);
                note = `${days} dia${days === 1 ? "" : "s"} em atraso`;
                tone = "late";
            } else if (diff === 0) {
                note = "Prazo oficial vence hoje";
                tone = "today";
            } else if (diff <= 2) {
                note = `${diff} dia${diff === 1 ? "" : "s"} restante${diff === 1 ? "" : "s"}`;
                tone = "attention";
            } else {
                note = `${diff} dias restantes`;
            }

            return {
                label: official ? "Prazo oficial" : "Prazo desejado",
                value: deadline.toLocaleDateString("pt-BR"),
                note,
                tone,
            };
        };

        const renderPedidoTimelineCompacta = (pedido) => {
            const prazo = prazoVisualPedido(pedido);
            const contentStatus = String(
                pedido.timeline?.content_status || ""
            ).toLowerCase();

            const completed = pedido.status === "Concluído";
            const assigned = Boolean(pedido.assigned_content_id);
            const preparing =
                assigned &&
                (
                    contentStatus.includes("produção") ||
                    contentStatus.includes("producao") ||
                    contentStatus.includes("edição") ||
                    contentStatus.includes("edicao") ||
                    contentStatus.includes("ajuste") ||
                    contentStatus.includes("aprovação final") ||
                    contentStatus.includes("aprovacao final") ||
                    contentStatus === "aprovado" ||
                    contentStatus === "agendado" ||
                    contentStatus === "publicado" ||
                    contentStatus === "finalizado"
                );

            let currentIndex = 0;
            if (assigned) currentIndex = 1;
            if (preparing) currentIndex = 2;
            if (completed) currentIndex = 3;

            const compactSteps = [
                {
                    label: "Aguardando aprovação",
                    detail:
                        pedido.status === "Revisão solicitada"
                            ? "Marketing solicitou revisão"
                            : pedido.status === "Aprovado" && !assigned
                              ? "Aprovado • aguardando distribuição"
                              : "Em análise pelo Marketing",
                },
                {
                    label: "Enviado para produção",
                    detail: assigned
                        ? `${pedido.assigned_user_name || "SQUAD"} recebeu a demanda`
                        : "Aguardando responsável",
                },
                {
                    label: "Em preparação",
                    detail: assigned
                        ? pedido.timeline?.content_status || "Produção em andamento"
                        : "Aguardando produção",
                },
                {
                    label: "Finalizado",
                    detail: completed
                        ? "Entrega concluída"
                        : "Aguardando conclusão",
                },
            ].map((step, index) => ({
                ...step,
                state:
                    index < currentIndex
                        ? "done"
                        : index === currentIndex
                          ? "current"
                          : "upcoming",
            }));

            return (
                <div className="external-order-progress">
                    <div className="external-order-progress-head">
                        <div>
                            <span>ETAPA ATUAL</span>
                            <strong>
                                {compactSteps[currentIndex]?.label ||
                                    pedido.status}
                            </strong>
                            <small className="external-order-current-detail">
                                {compactSteps[currentIndex]?.detail}
                            </small>
                        </div>

                        <div className={`external-order-deadline tone-${prazo.tone}`}>
                            <span>{prazo.label}</span>
                            <strong>{prazo.value}</strong>
                            <small>{prazo.note}</small>
                        </div>
                    </div>

                    <div
                        className="external-order-timeline external-order-timeline-4"
                        aria-label="Timeline do pedido"
                    >
                        {compactSteps.map((step, index) => (
                            <div
                                className={`external-order-timeline-step ${step.state}`}
                                key={step.label}
                            >
                                <div className="external-order-timeline-marker">
                                    <i>
                                        {step.state === "done"
                                            ? "✓"
                                            : index + 1}
                                    </i>
                                    {index < compactSteps.length - 1 && <span />}
                                </div>

                                <div className="external-order-timeline-label">
                                    <strong>{step.label}</strong>
                                    <small>{step.detail}</small>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        className="external-order-progress-open"
                        onClick={() => abrirPedidoGerente(pedido)}
                    >
                        Ver detalhes da solicitação →
                    </button>
                </div>
            );
        };

        const renderPedidoCard = (pedido, mode = "active") => (
            <article
                className={`external-order-card-wrap mode-${mode}`}
                key={pedido.id}
            >
                <button
                    type="button"
                    className="external-order-card"
                    onClick={() => abrirPedidoGerente(pedido)}
                >
                    <div className="external-order-id">
                        #{String(pedido.id).padStart(4, "0")}
                    </div>

                    <div className="external-order-copy">
                        <strong>{pedido.title}</strong>
                        <span>
                            {pedido.brand || "Marketing"} •{" "}
                            {pedido.request_type || "Solicitação"}
                        </span>
                        <small>
                            Enviado em{" "}
                            {new Date(pedido.created_at).toLocaleDateString("pt-BR")}
                            {pedido.desired_date
                                ? ` • Desejado ${new Date(
                                      `${pedido.desired_date}T12:00:00`
                                  ).toLocaleDateString("pt-BR")}`
                                : ""}
                            {pedido.final_deadline
                                ? ` • Oficial ${new Date(
                                      `${pedido.final_deadline}T12:00:00`
                                  ).toLocaleDateString("pt-BR")}`
                                : ""}
                        </small>
                    </div>

                    <span
                        className={`external-order-status status-${String(
                            pedido.status
                        )
                            .toLowerCase()
                            .replaceAll(" ", "-")
                            .replaceAll("á", "a")
                            .replaceAll("ã", "a")
                            .replaceAll("ç", "c")}`}
                    >
                        {pedido.status}
                    </span>

                    <b>→</b>
                </button>

                {mode === "active" && (
                    <button
                        type="button"
                        className={`external-order-remove ${
                            pedido.assigned_content_id ? "cancel" : ""
                        }`}
                        title={
                            pedido.assigned_content_id
                                ? "Cancelar pedido"
                                : "Excluir pedido"
                        }
                        onClick={(event) => {
                            event.stopPropagation();
                            removerPedidoGestor(pedido);
                        }}
                    >
                        {pedido.assigned_content_id ? "Cancelar" : "Excluir"}
                    </button>
                )}

                {mode === "trash" && (
                    <button
                        type="button"
                        className="external-order-restore"
                        onClick={(event) => {
                            event.stopPropagation();
                            restaurarPedidoGestor(pedido);
                        }}
                    >
                        Restaurar
                    </button>
                )}

                {mode === "active" && renderPedidoTimelineCompacta(pedido)}
            </article>
        );

        return (
            <div className="external-request-portal">
                <header className="external-request-top">
                    <div>
                        <span>SQUAD • PORTAL DE GESTORES</span>
                        <h1>
                            Olá,{" "}
                            {usuarioSelecionado.nickname ||
                                usuarioSelecionado.name}.
                        </h1>
                        <p>
                            Envie e acompanhe seus pedidos diretamente com o
                            Gerente de Marketing.
                        </p>
                    </div>

                    <div className="external-portal-top-actions">
                        <button
                            type="button"
                            className={
                                portalGestorAba === "pedidos" ? "active" : ""
                            }
                            onClick={() => {
                                setPortalGestorAba("pedidos");
                                setPedidoFiltro("Todos");
                            }}
                        >
                            Meus pedidos
                            {ativos.length > 0 && <b>{ativos.length}</b>}
                        </button>

                        <button
                            type="button"
                            className={
                                portalGestorAba === "concluidos"
                                    ? "active"
                                    : ""
                            }
                            onClick={() => {
                                setPortalGestorAba("concluidos");
                                setPedidoFiltro("Todos");
                            }}
                        >
                            ✓ Concluídos
                            {concluidos.length > 0 && <b>{concluidos.length}</b>}
                        </button>

                        <button
                            type="button"
                            className={
                                portalGestorAba === "perfil" ? "active" : ""
                            }
                            onClick={() => {
                                preencherPerfil(usuarioSelecionado);
                                setPortalGestorAba("perfil");
                            }}
                        >
                            Perfil
                        </button>

                        <button
                            type="button"
                            className="switch-user"
                            onClick={
                                adminImpersonando
                                    ? voltarParaAreaAdmin
                                    : sairUsuario
                            }
                        >
                            {adminImpersonando
                                ? "← Voltar à Área ADM"
                                : "Sair"}
                        </button>
                    </div>
                </header>

                {portalGestorAba === "perfil" ? (
                    renderPerfilGestorExterno()
                ) : (
                    <main className="external-request-main">
                        {portalGestorAba === "pedidos" && (
                            <section className="external-request-actions">
                                <button
                                    type="button"
                                    className="external-new-request"
                                    onClick={() => {
                                        setPedidoReferenceFiles([]);
                                        setNovoPedidoAberto(true);
                                    }}
                                >
                                    <b>+</b>
                                    <div>
                                        <span>NOVO PEDIDO</span>
                                        <small>
                                            Enviar solicitação ao Gerente de
                                            Marketing
                                        </small>
                                    </div>
                                </button>

                                <div className="external-request-summary">
                                    <span>EM ACOMPANHAMENTO</span>
                                    <strong>{ativos.length}</strong>
                                    <small>
                                        pedidos que ainda precisam de
                                        acompanhamento
                                    </small>
                                </div>
                            </section>
                        )}

                        <section className="external-orders">
                            <div className="external-orders-head">
                                <div>
                                    <span>
                                        {portalGestorAba === "concluidos"
                                            ? "HISTÓRICO"
                                            : portalGestorAba === "lixeira"
                                              ? "LIXEIRA • 24 HORAS"
                                              : "ACOMPANHAMENTO"}
                                    </span>
                                    <h2>
                                        {portalGestorAba === "concluidos"
                                            ? "Pedidos concluídos"
                                            : portalGestorAba === "lixeira"
                                              ? "Pedidos excluídos"
                                              : "Meus pedidos"}
                                    </h2>
                                    {portalGestorAba === "concluidos" && (
                                        <p>
                                            Pedidos finalizados ficam
                                            separados do acompanhamento.
                                        </p>
                                    )}
                                </div>

                                {portalGestorAba === "pedidos" && (
                                    <div className="external-order-filters">
                                        {[
                                            "Todos",
                                            "Recebido",
                                            "Revisão solicitada",
                                            "Aprovado",
                                            "Em andamento",
                                            "Reprovado",
                                        ].map((status) => (
                                            <button
                                                type="button"
                                                key={status}
                                                className={
                                                    pedidoFiltro === status
                                                        ? "active"
                                                        : ""
                                                }
                                                onClick={() =>
                                                    setPedidoFiltro(status)
                                                }
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {pedidoCarregando ? (
                                <div className="loading">
                                    Carregando pedidos...
                                </div>
                            ) : !filtered.length ? (
                                <div className="empty-state">
                                    {portalGestorAba === "concluidos"
                                        ? "Nenhum pedido concluído ainda."
                                        : portalGestorAba === "lixeira"
                                          ? "A lixeira está vazia."
                                          : "Nenhum pedido em acompanhamento."}
                                </div>
                            ) : (
                                <div className="external-orders-list">
                                    {filtered.map((pedido) =>
                                        renderPedidoCard(
                                            pedido,
                                            portalGestorAba === "lixeira"
                                                ? "trash"
                                                : portalGestorAba ===
                                                    "concluidos"
                                                  ? "completed"
                                                  : "active"
                                        )
                                    )}
                                </div>
                            )}

                            {portalGestorAba !== "lixeira" && (
                                <button
                                    type="button"
                                    className="external-trash-link"
                                    onClick={() => {
                                        setPortalGestorAba("lixeira");
                                        setPedidoFiltro("Todos");
                                    }}
                                >
                                    Lixeira
                                    {lixeira.length > 0 && (
                                        <span>{lixeira.length}</span>
                                    )}
                                    <small>
                                        pedidos excluídos ficam disponíveis por
                                        24h
                                    </small>
                                </button>
                            )}
                        </section>
                    </main>
                )}

                {novoPedidoAberto && (
                    <div
                        className="simple-overlay"
                        onMouseDown={() => setNovoPedidoAberto(false)}
                    >
                        <section
                            className="manager-new-request-modal"
                            onMouseDown={(event) => event.stopPropagation()}
                        >
                            <div className="modal-top">
                                <div>
                                    <span>NOVO PEDIDO</span>
                                    <h2>Solicitação para o Marketing</h2>
                                    <p>
                                        O pedido será enviado exclusivamente ao
                                        Gerente de Marketing.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setNovoPedidoAberto(false)
                                    }
                                >
                                    ×
                                </button>
                            </div>
                            <form onSubmit={criarPedidoGerente} className="manager-request-smart-form">
                                <div className="manager-request-solicitante">
                                    <span>SOLICITANTE</span>
                                    <strong>{usuarioSelecionado?.name || "Gerente"}</strong>
                                    <small>
                                        {usuarioSelecionado?.role || "Gestor"}
                                        {usuarioSelecionado?.department
                                            ? ` • ${usuarioSelecionado.department}`
                                            : ""}
                                    </small>
                                </div>

                                <label>Título do pedido</label>
                                <input
                                    required
                                    value={pedidoForm.title}
                                    onChange={(e) =>
                                        setPedidoForm({
                                            ...pedidoForm,
                                            title: e.target.value,
                                        })
                                    }
                                    placeholder="Ex.: Campanha comercial de outubro"
                                />

                                <div className="manager-request-form-grid">
                                    <div>
                                        <label>O que precisamos?</label>
                                        <select
                                            required
                                            value={pedidoForm.request_type}
                                            onChange={(e) =>
                                                setPedidoForm({
                                                    ...pedidoForm,
                                                    request_type: e.target.value,
                                                    print_dimensions:
                                                        e.target.value === "Material impresso"
                                                            ? pedidoForm.print_dimensions
                                                            : "",
                                                })
                                            }
                                        >
                                            {[
                                                "Arte / Material gráfico",
                                                "Vídeo",
                                                "Foto / Vídeo",
                                                "Campanha",
                                                "Evento / Ação",
                                                "Redes Sociais",
                                                "Material impresso",
                                                "E-mail / CRM",
                                                "WhatsApp / Comunicação",
                                                "Comunicação interna",
                                                "Brinde / Material",
                                                "Outro",
                                            ].map((x) => (
                                                <option key={x}>{x}</option>
                                            ))}
                                        </select>
                                        <small className="manager-request-field-help">
                                            Escolha o formato principal da demanda.
                                        </small>
                                    </div>

                                    <div>
                                        <label>Marca</label>
                                        {(usuarioSelecionado?.brands || []).length > 1 ? (
                                            <select
                                                value={
                                                    pedidoForm.brand ||
                                                    usuarioSelecionado.brands[0]
                                                }
                                                onChange={(e) =>
                                                    setPedidoForm({
                                                        ...pedidoForm,
                                                        brand: e.target.value,
                                                    })
                                                }
                                            >
                                                {usuarioSelecionado.brands.map((marca) => (
                                                    <option key={marca} value={marca}>
                                                        {marca}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div className="manager-request-locked-brand">
                                                <strong>
                                                    {usuarioSelecionado?.brands?.[0] ||
                                                        "Marca não definida"}
                                                </strong>
                                                <span>🔒 Definida pelo ADM</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="manager-request-form-grid">
                                    <div>
                                        <label>Objetivo</label>
                                        <textarea
                                            required
                                            className="manager-request-short-textarea"
                                            value={pedidoForm.objective}
                                            onChange={(e) =>
                                                setPedidoForm({
                                                    ...pedidoForm,
                                                    objective: e.target.value,
                                                })
                                            }
                                            placeholder="O que queremos alcançar com esta solicitação?"
                                        />
                                    </div>

                                    <div>
                                        <label>Público-alvo</label>
                                        <textarea
                                            required
                                            className="manager-request-short-textarea"
                                            value={pedidoForm.target_audience}
                                            onChange={(e) =>
                                                setPedidoForm({
                                                    ...pedidoForm,
                                                    target_audience: e.target.value,
                                                })
                                            }
                                            placeholder="Quem precisa ser impactado?"
                                        />
                                    </div>
                                </div>

                                <label>Informações obrigatórias</label>
                                <textarea
                                    className="manager-request-info-textarea"
                                    value={pedidoForm.required_info}
                                    onChange={(e) =>
                                        setPedidoForm({
                                            ...pedidoForm,
                                            required_info: e.target.value,
                                        })
                                    }
                                    placeholder="Textos, datas, valores, condições comerciais, endereços, observações legais etc."
                                />
                                <small className="manager-request-field-help">
                                    Coloque aqui tudo o que obrigatoriamente precisa aparecer no material.
                                </small>

                                <div className="manager-request-channel-section">
                                    <label>Canais de divulgação</label>
                                    <div className="manager-request-channel-grid">
                                        {["Instagram", "Facebook", "WhatsApp", "E-mail", "Site", "Mídia paga", "Comunicação interna", "Impresso / PDV", "Outro"].map((canal) => {
                                            const selected = pedidoForm.channels.includes(canal);
                                            return (
                                                <button
                                                    type="button"
                                                    key={canal}
                                                    className={selected ? "selected" : ""}
                                                    onClick={() =>
                                                        setPedidoForm({
                                                            ...pedidoForm,
                                                            channels: selected
                                                                ? pedidoForm.channels.filter((item) => item !== canal)
                                                                : [...pedidoForm.channels, canal],
                                                        })
                                                    }
                                                >
                                                    {selected ? "✓ " : "+ "}{canal}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {pedidoForm.request_type === "Material impresso" && (
                                    <div className="manager-request-print-box">
                                        <label>Se o material for impresso, quais as medidas?</label>
                                        <input
                                            required
                                            value={pedidoForm.print_dimensions}
                                            onChange={(e) =>
                                                setPedidoForm({
                                                    ...pedidoForm,
                                                    print_dimensions: e.target.value,
                                                })
                                            }
                                            placeholder="Ex.: 90 x 120 cm, A4, 3 x 1 m..."
                                        />
                                    </div>
                                )}

                                <label>Detalhes / contexto do pedido</label>
                                <textarea
                                    required
                                    className="manager-request-description"
                                    value={pedidoForm.description}
                                    onChange={(e) =>
                                        setPedidoForm({
                                            ...pedidoForm,
                                            description: e.target.value,
                                        })
                                    }
                                    placeholder="Explique o contexto, mensagem principal, ação esperada e qualquer detalhe que ajude o Marketing a executar corretamente."
                                />

                                <div className="manager-request-form-grid manager-request-deadline-grid">
                                    <div>
                                        <label>Prazo desejado para entrega</label>
                                        <input
                                            required
                                            type="date"
                                            value={pedidoForm.desired_date}
                                            onChange={(e) =>
                                                setPedidoForm({
                                                    ...pedidoForm,
                                                    desired_date: e.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label>Prioridade percebida</label>
                                        <select
                                            value={pedidoForm.priority}
                                            onChange={(e) =>
                                                setPedidoForm({
                                                    ...pedidoForm,
                                                    priority: e.target.value,
                                                })
                                            }
                                        >
                                            <option>Normal</option>
                                            <option>Alta</option>
                                            <option>Urgente</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="manager-request-deadline-note">
                                    <strong>Importante sobre o prazo</strong>
                                    <p>
                                        A data informada acima é apenas o <b>prazo desejado</b> pelo solicitante.
                                        O prazo oficial será definido pelo Gerente de Marketing após a análise e o
                                        planejamento da demanda. Somente o prazo oficial passa a valer para a execução
                                        e ficará visível na timeline do pedido.
                                    </p>
                                </div>

                                <label>Referências / Links</label>
                                <textarea
                                    value={pedidoForm.references_text}
                                    onChange={(e) =>
                                        setPedidoForm({
                                            ...pedidoForm,
                                            references_text: e.target.value,
                                        })
                                    }
                                    placeholder="Links de referência, pastas, exemplos, páginas, campanhas anteriores etc."
                                />

                                <div className="manager-request-reference-upload">
                                    <div className="manager-request-reference-upload-head">
                                        <div>
                                            <label>Arquivos de referência</label>
                                            <small>
                                                Opcional • JPG, JPEG, PNG, WEBP ou vídeos MP4, MOV e WEBM • até 30 MB por arquivo • máximo 5 arquivos
                                            </small>
                                        </div>
                                        <button
                                            type="button"
                                            className="manager-request-attach-button"
                                            onClick={() =>
                                                pedidoReferenceInputRef.current?.click()
                                            }
                                        >
                                            ＋ Anexar referências
                                        </button>
                                    </div>

                                    <input
                                        ref={pedidoReferenceInputRef}
                                        className="manager-request-reference-input"
                                        type="file"
                                        multiple
                                        accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm,image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                                        onChange={selecionarReferenciasPedido}
                                    />

                                    {pedidoReferenceFiles.length > 0 ? (
                                        <div className="manager-request-selected-files">
                                            {pedidoReferenceFiles.map((file, index) => (
                                                <div
                                                    className="manager-request-selected-file"
                                                    key={`${file.name}-${file.size}-${index}`}
                                                >
                                                    <span>
                                                        {String(file.type || "").startsWith("video/")
                                                            ? "▶"
                                                            : "▧"}
                                                    </span>
                                                    <div>
                                                        <strong>{file.name}</strong>
                                                        <small>
                                                            {(Number(file.size || 0) / 1024 / 1024).toFixed(1)} MB
                                                        </small>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            removerReferenciaPedidoSelecionada(index)
                                                        }
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="manager-request-reference-empty">
                                            Você pode anexar uma arte, foto, print ou vídeo curto para mostrar exatamente a referência desejada.
                                        </p>
                                    )}
                                </div>

                                <button
                                    className="primary-button full manager-request-submit"
                                    type="submit"
                                    disabled={pedidoCarregando}
                                >
                                    {pedidoCarregando
                                        ? "ENVIANDO SOLICITAÇÃO..."
                                        : "ENVIAR AO GERENTE DE MARKETING"}
                                </button>
                            </form>
                        </section>
                    </div>
                )}

                {portalGestorAba !== "lixeira" && renderPedidoDetalhe(true)}
            </div>
        );
    }

    function renderPedidosGerentesMarketing() {
        const paraAnalisar = pedidosGerentes.filter(
            (item) => item.status === "Recebido"
        );

        const emRevisao = pedidosGerentes.filter(
            (item) => item.status === "Revisão solicitada"
        );

        const emAndamento = pedidosGerentes.filter(
            (item) =>
                item.status === "Aprovado" ||
                item.status === "Em andamento"
        );

        const concluidos = pedidosGerentes.filter(
            (item) => item.status === "Concluído"
        );

        const arquivados = pedidosGerentes.filter(
            (item) =>
                item.status === "Reprovado" ||
                item.status === "Cancelado"
        );

        const configAba = {
            analise: {
                eyebrow: "PRECISA DA SUA DECISÃO",
                title: "Para analisar",
                description:
                    "Pedidos novos ou que voltaram após uma revisão. Abra o pedido para aprovar, revisar ou reprovar.",
                items: paraAnalisar,
                empty: "Nenhum pedido aguardando sua análise.",
            },
            revisao: {
                eyebrow: "AGUARDANDO SOLICITANTE",
                title: "Em revisão",
                description:
                    "Pedidos devolvidos aos outros gerentes com uma orientação de alteração.",
                items: emRevisao,
                empty: "Nenhum pedido aguardando revisão do solicitante.",
            },
            andamento: {
                eyebrow: "APROVADOS E EM EXECUÇÃO",
                title: "Em andamento",
                description:
                    "Pedidos já aprovados. Aqui ficam os que aguardam encaminhamento ou já estão com Social Media/Designer.",
                items: emAndamento,
                empty: "Nenhum pedido em andamento.",
            },
            concluidos: {
                eyebrow: "HISTÓRICO",
                title: "Concluídos",
                description:
                    "Pedidos finalizados ficam separados das demandas que ainda exigem acompanhamento.",
                items: concluidos,
                empty: "Nenhum pedido concluído ainda.",
            },
            arquivados: {
                eyebrow: "HISTÓRICO DE DECISÕES",
                title: "Reprovados / Arquivados",
                description:
                    "Pedidos reprovados ou cancelados ficam disponíveis para consulta sem poluir o fluxo ativo.",
                items: arquivados,
                empty: "Nenhum pedido reprovado ou arquivado.",
            },
        };

        const aba = configAba[managerPedidosAba] || configAba.analise;

        function statusClass(status) {
            return String(status || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replaceAll(" ", "-");
        }

        function renderManagerOrderCard(pedido) {
            const encaminhado = Boolean(pedido.assigned_user_name);
            const dataAgenda = pedido.assigned_date
                ? new Date(`${pedido.assigned_date}T12:00:00`).toLocaleDateString(
                      "pt-BR"
                  )
                : "";

            return (
                <button
                    type="button"
                    key={pedido.id}
                    className="manager-order-card manager-order-card-v2"
                    onClick={() => abrirPedidoGerente(pedido)}
                >
                    <div className="manager-order-card-id">
                        <span>
                            #{String(pedido.id).padStart(4, "0")}
                        </span>
                        <small>{pedido.requester_name}</small>
                    </div>

                    <div className="manager-order-card-main">
                        <strong>{pedido.title}</strong>

                        <div className="manager-order-card-meta">
                            <span>{pedido.brand || "Geral"}</span>
                            <span>
                                {pedido.request_type || "Solicitação"}
                            </span>
                            <span>
                                {pedido.priority || "Normal"}
                            </span>
                        </div>

                        {managerPedidosAba === "andamento" && (
                            <div className="manager-order-assignment">
                                {encaminhado ? (
                                    <>
                                        <b>
                                            {pedido.assigned_user_name}
                                        </b>
                                        <span>
                                            {pedido.assigned_user_role ||
                                                "SQUAD"}
                                            {dataAgenda
                                                ? ` • Agenda ${dataAgenda}`
                                                : ""}
                                            {pedido.final_deadline
                                                ? ` • Prazo oficial ${new Date(`${pedido.final_deadline}T12:00:00`).toLocaleDateString("pt-BR")}`
                                                : ""}
                                            {pedido.assigned_urgency
                                                ? ` • ${nomeUrgencia(
                                                      pedido.assigned_urgency
                                                  )}`
                                                : ""}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <b>Aprovado</b>
                                        <span>
                                            Aguardando encaminhamento para
                                            Social Media ou Designer.
                                        </span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <span
                        className={`manager-order-status status-${statusClass(
                            pedido.status
                        )}`}
                    >
                        {pedido.status}
                    </span>

                    <b className="manager-order-arrow">→</b>
                </button>
            );
        }

        return (
            <div className="manager-orders-page manager-orders-page-v2">
                <div className="section-heading manager-orders-heading">
                    <div>
                        <span>PEDIDOS DE GERENTES</span>
                        <h1>Solicitações para o Marketing</h1>
                        <p>
                            Este espaço é exclusivo do Gerente de Marketing.
                            Organize os pedidos por etapa sem misturar solicitações
                            novas, revisões e demandas já encaminhadas.
                        </p>
                    </div>

                    <button
                        className="secondary-button"
                        onClick={() => carregarPedidosGerentes(false)}
                    >
                        Atualizar
                    </button>
                </div>

                <nav className="manager-orders-tabs">
                    <button
                        type="button"
                        className={
                            managerPedidosAba === "analise" ? "active" : ""
                        }
                        onClick={() => setManagerPedidosAba("analise")}
                    >
                        <span>Para analisar</span>
                        <b>{paraAnalisar.length}</b>
                    </button>

                    <button
                        type="button"
                        className={
                            managerPedidosAba === "revisao" ? "active" : ""
                        }
                        onClick={() => setManagerPedidosAba("revisao")}
                    >
                        <span>Em revisão</span>
                        <b>{emRevisao.length}</b>
                    </button>

                    <button
                        type="button"
                        className={
                            managerPedidosAba === "andamento" ? "active" : ""
                        }
                        onClick={() => setManagerPedidosAba("andamento")}
                    >
                        <span>Em andamento</span>
                        <b>{emAndamento.length}</b>
                    </button>

                    <button
                        type="button"
                        className={
                            managerPedidosAba === "concluidos" ? "active" : ""
                        }
                        onClick={() => setManagerPedidosAba("concluidos")}
                    >
                        <span>Concluídos</span>
                        <b>{concluidos.length}</b>
                    </button>
                </nav>

                <section className="manager-orders-stage">
                    <div className="manager-orders-stage-head">
                        <div>
                            <span>{aba.eyebrow}</span>
                            <h2>{aba.title}</h2>
                            <p>{aba.description}</p>
                        </div>

                        <strong>{aba.items.length}</strong>
                    </div>

                    {!aba.items.length ? (
                        <div className="empty-state manager-orders-empty">
                            {aba.empty}
                        </div>
                    ) : (
                        <div className="manager-orders-list manager-orders-list-v2">
                            {aba.items.map(renderManagerOrderCard)}
                        </div>
                    )}

                    {managerPedidosAba !== "arquivados" && (
                        <button
                            type="button"
                            className="manager-orders-archive-link"
                            onClick={() =>
                                setManagerPedidosAba("arquivados")
                            }
                        >
                            Reprovados / Arquivados
                            {arquivados.length > 0 && (
                                <span>{arquivados.length}</span>
                            )}
                        </button>
                    )}

                    {managerPedidosAba === "arquivados" && (
                        <button
                            type="button"
                            className="manager-orders-archive-link back"
                            onClick={() => setManagerPedidosAba("analise")}
                        >
                            ← Voltar para pedidos ativos
                        </button>
                    )}
                </section>

                {renderPedidoDetalhe(false)}
            </div>
        );
    }

    function renderLoginModalInline() {
        if (!loginUsuario) return null;
        return (
            <div className="simple-overlay login-overlay" onMouseDown={fecharLoginUsuario}>
                <section className="squad-login-card" onMouseDown={(event) => event.stopPropagation()}>
                    <button type="button" className="squad-login-close" onClick={fecharLoginUsuario}>×</button>
                    <div className="squad-login-user"><Avatar user={loginUsuario} size="xlarge"/><div><span>{isExternalManager(loginUsuario) ? "PORTAL DE GESTORES" : "SQUAD SOCIAL PLANNER"}</span><h2>{loginUsuario.nickname || loginUsuario.name}</h2><p>{loginUsuario.role || "Equipe de Marketing"}</p></div></div>
                    <form onSubmit={autenticarUsuario}>
                        {!loginUsuario.password_set ? <><div className="first-access-callout"><strong>Seu primeiro acesso</strong><p>Crie sua senha pessoal para proteger este perfil.</p></div><label>Crie sua senha</label><input type="password" autoFocus minLength={4} value={loginSenha} onChange={(e)=>setLoginSenha(e.target.value)} placeholder="Mínimo de 4 caracteres"/><label>Confirme sua senha</label><input type="password" minLength={4} value={loginConfirmacao} onChange={(e)=>setLoginConfirmacao(e.target.value)} placeholder="Digite novamente"/></> : <><label>Senha</label><input type="password" autoFocus value={loginSenha} onChange={(e)=>setLoginSenha(e.target.value)} placeholder="Digite sua senha"/></>}
                        {loginErro && <div className="login-error">{loginErro}</div>}
                        <button className="primary-button" type="submit" disabled={loginProcessando}>{loginProcessando ? "Entrando..." : loginUsuario.password_set ? "Entrar" : "Criar senha e entrar"}</button>
                    </form>
                </section>
            </div>
        );
    }

    if (!usuarioSelecionado) {
        if (areaAdminAtiva) {
            return (
                <div className="admin-access-screen">
                    <div className="admin-access-shell">
                        <div className="admin-access-topbar">
                            <div className="user-brand premium-user-brand">
                                <span>SQUAD</span>
                                <strong>Social Planner</strong>
                            </div>
                            <button
                                type="button"
                                className="admin-back-button"
                                onClick={adminLiberado ? sairAdmin : () => setAreaAdminAtiva(false)}
                            >
                                ← Voltar ao login
                            </button>
                        </div>

                        {!adminLiberado ? (
                            <section className="admin-gate-card">
                                <div className="admin-gate-mark">ADM</div>
                                <span>ACESSO RESTRITO</span>
                                <h1>Área Administrativa</h1>
                                <p>
                                    Gestão de usuários, senhas e histórico técnico do SQUAD.
                                    Este espaço é separado do Portal de Gestores.
                                </p>
                                <form onSubmit={acessarAdmin}>
                                    <label>Senha administrativa</label>
                                    <input
                                        type="password"
                                        autoFocus
                                        value={senhaAdmin}
                                        onChange={(event) => setSenhaAdmin(event.target.value)}
                                        placeholder="Digite a senha ADM"
                                    />
                                    <button
                                        className="primary-button admin-gate-submit"
                                        disabled={adminCarregando || !senhaAdmin}
                                    >
                                        {adminCarregando ? "Validando..." : "Entrar na Área ADM"}
                                    </button>
                                </form>
                                {adminErro && <div className="admin-error">{adminErro}</div>}
                            </section>
                        ) : (
                            <div className="admin-console">
                                <header className="admin-console-header">
                                    <div>
                                        <span>ÁREA ADM • SQUAD</span>
                                        <h1>Administração do sistema</h1>
                                        <p>
                                            Contas, acessos e histórico administrativo em um
                                            ambiente separado do Planner.
                                        </p>
                                    </div>
                                    <div className="admin-console-actions">
                                        <button
                                            type="button"
                                            className="secondary-button"
                                            onClick={() => carregarAdminData()}
                                            disabled={adminCarregando}
                                        >
                                            {adminCarregando ? "Atualizando..." : "↻ Atualizar"}
                                        </button>
                                        <button type="button" className="danger-button" onClick={sairAdmin}>
                                            Sair do ADM
                                        </button>
                                    </div>
                                </header>

                                {adminErro && <div className="admin-error admin-console-error">{adminErro}</div>}

                                <div className="admin-console-tabs">
                                    <button
                                        type="button"
                                        className={adminAba === "usuarios" ? "active" : ""}
                                        onClick={() => setAdminAba("usuarios")}
                                    >
                                        Usuários <b>{usuariosAdmin.length}</b>
                                    </button>
                                    <button
                                        type="button"
                                        className={adminAba === "historico" ? "active" : ""}
                                        onClick={() => setAdminAba("historico")}
                                    >
                                        Histórico ADM <b>{adminHistorico.length}</b>
                                    </button>
                                </div>

                                {adminAba === "usuarios" && (
                                    <section className="admin-console-panel">
                                        <div className="admin-panel-head admin-panel-head-modern">
                                            <div>
                                                <span>CONTAS DO SQUAD</span>
                                                <h2>Usuários e acessos</h2>
                                                <p>
                                                    Use “Entrar na conta” para suporte e ajustes sem precisar
                                                    da senha do usuário. Todo acesso administrativo fica registrado.
                                                </p>
                                            </div>
                                            <button
                                                className="primary-button compact"
                                                onClick={() => setNovoColaboradorAberto(true)}
                                            >
                                                + Novo usuário
                                            </button>
                                        </div>

                                        <div className="admin-users modern-admin-users">
                                            {usuariosAdmin.map((usuario) => {
                                                const ativo = Number(usuario.active) === 1;
                                                return (
                                                    <article
                                                        className={`admin-user-row modern-admin-user-row ${!ativo ? "inactive" : ""}`}
                                                        key={usuario.id}
                                                    >
                                                        <Avatar user={usuario} size="medium" />
                                                        <div className="admin-user-info">
                                                            <div className="admin-user-name-line">
                                                                <strong>{usuario.nickname || usuario.name}</strong>
                                                                <span className={`admin-status-pill ${ativo ? "active" : "inactive"}`}>
                                                                    {ativo ? "Ativo" : "Inativo"}
                                                                </span>
                                                                {isManagerProfile(usuario) && (
                                                                    <span className="admin-role-pill">Gestor</span>
                                                                )}
                                                            </div>
                                                            <span>
                                                                {usuario.role || (isManagerProfile(usuario) ? "Gerente" : "Cargo não definido")}
                                                            </span>
                                                            {isExternalManager(usuario) && <div className="admin-manager-brands">{(usuario.brands || []).length ? usuario.brands.map((m)=><b key={m}>{m}</b>) : <b className="missing">Marca não definida</b>}</div>}
                                                            <small>
                                                                {usuario.password_set
                                                                    ? "Senha configurada"
                                                                    : "Primeiro acesso pendente • sem senha"}
                                                            </small>
                                                        </div>
                                                        <div className="admin-user-actions">
                                                            <button type="button" className="secondary-button compact" onClick={()=>abrirEdicaoAdminUsuario(usuario)}>Editar</button>
                                                            {ativo && (
                                                                <button
                                                                    type="button"
                                                                    className="admin-enter-user-button"
                                                                    onClick={() => entrarComoUsuario(usuario)}
                                                                    disabled={adminCarregando}
                                                                    title={`Acessar o SQUAD como ${usuario.nickname || usuario.name}`}
                                                                >
                                                                    ↗ Entrar na conta
                                                                </button>
                                                            )}
                                                            {ativo && (
                                                                <button
                                                                    type="button"
                                                                    className="secondary-button compact"
                                                                    onClick={() => redefinirSenhaUsuario(usuario)}
                                                                >
                                                                    Redefinir senha
                                                                </button>
                                                            )}
                                                            {ativo ? (
                                                                <button
                                                                    type="button"
                                                                    className="danger-button"
                                                                    onClick={() => removerUsuario(usuario)}
                                                                >
                                                                    Desativar
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className="primary-button compact"
                                                                    onClick={() => reativarUsuario(usuario)}
                                                                >
                                                                    Reativar
                                                                </button>
                                                            )}
                                                        </div>
                                                    </article>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}

                                {adminAba === "historico" && (
                                    <section className="admin-console-panel admin-history-panel">
                                        <div className="admin-panel-head admin-panel-head-modern">
                                            <div>
                                                <span>REGISTRO ADMINISTRATIVO</span>
                                                <h2>Histórico da Área ADM</h2>
                                                <p>
                                                    Registro reservado das ações administrativas.
                                                    Este histórico não aparece no Portal de Gestores.
                                                </p>
                                            </div>
                                        </div>
                                        {!adminHistorico.length ? (
                                            <div className="empty-state">Nenhuma ação administrativa registrada ainda.</div>
                                        ) : (
                                            <div className="admin-history-list">
                                                {adminHistorico.map((item) => (
                                                    <article className="admin-history-item" key={item.id}>
                                                        <div className="admin-history-dot" />
                                                        <div>
                                                            <div className="admin-history-title">
                                                                <strong>{String(item.action || "ação").replaceAll("_", " ")}</strong>
                                                                <span>{formatDateTime(item.created_at)}</span>
                                                            </div>
                                                            {item.target_user_name && (
                                                                <p>Usuário: <strong>{item.target_user_name}</strong></p>
                                                            )}
                                                            {item.detail && <small>{item.detail}</small>}
                                                        </div>
                                                    </article>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                )}
                            </div>
                        )}

                        {adminUsuarioEditando && <div className="simple-overlay" onMouseDown={()=>setAdminUsuarioEditando(null)}><section className="small-modal admin-edit-user-modal" onMouseDown={(e)=>e.stopPropagation()}><div className="modal-top"><div><span>ÁREA ADM</span><h2>Editar usuário</h2></div><button type="button" onClick={()=>setAdminUsuarioEditando(null)}>×</button></div><form onSubmit={salvarEdicaoAdminUsuario}><label>Nome</label><input value={adminEditNome} onChange={(e)=>setAdminEditNome(e.target.value)}/><label>Cargo / Gerência</label><input value={adminEditCargo} onChange={(e)=>setAdminEditCargo(e.target.value)}/><label>Setor</label><input value={adminEditSetor} onChange={(e)=>setAdminEditSetor(e.target.value)}/>{isExternalManager(adminUsuarioEditando) && <><label>Marcas autorizadas</label><p className="admin-edit-brand-note">Pode selecionar uma ou várias. Com uma marca, ela fica fixa. Com várias, o gerente escolhe somente entre as autorizadas.</p><div className="admin-edit-brand-grid">{["Jeep","RAM","Kia","Honda","Premier Seminovos","Shineray","YADEA","Grupo / Geral"].map((m)=><button type="button" key={m} className={adminEditMarcas.includes(m) ? "selected" : ""} onClick={()=>alternarMarcaAdmin(m)}>{m}</button>)}</div></>}<button className="primary-button" disabled={adminCarregando}>{adminCarregando ? "Salvando..." : "Salvar alterações"}</button></form></section></div>}
                        {novoColaboradorAberto && renderNovoColaboradorModal()}
                    </div>
                </div>
            );
        }

        const gestores = usuarios.filter(isManagerProfile);
        const gestoresExternos = usuarios.filter(isExternalManager);
        const colaboradores = usuarios.filter((usuario) => !isManagerProfile(usuario) && !isExternalManager(usuario));

        if (portalEntrada === "home") {
            return (
                <div className="user-screen premium-user-screen squad-new-home">
                    <div className="squad-home-shell">
                        <div className="premium-entry-top">
                            <div className="user-brand premium-user-brand"><span>SQUAD</span><strong>Social Planner</strong></div>
                            <div className="premium-entry-signature"><span>GRUPO AUTO PREMIER</span><i /></div>
                        </div>
                        <div className="squad-home-hero"><span>ESCOLHA SEU AMBIENTE</span><h1>Bem-vindo ao SQUAD.</h1><p>Marketing e gestão de demandas em um só lugar.</p></div>
                        <div className="squad-home-portals">
                            <button type="button" className="squad-home-card squad-home-marketing" onClick={() => setPortalEntrada("marketing")}>
                                <span className="squad-home-card-kicker">EQUIPE INTERNA</span><strong>SQUAD MARKETING</strong><p>Planejamento, criação, aprovações e operação do Marketing.</p><b>ACESSAR SQUAD <i>→</i></b>
                            </button>
                            <button type="button" className="squad-home-card squad-home-managers" onClick={() => setPortalEntrada("gestores")}>
                                <span className="squad-home-card-kicker">OUTROS SETORES</span><strong>PORTAL DE GESTORES</strong><p>Solicitações e acompanhamento de demandas para o Marketing.</p><b>ACESSAR PORTAL <i>→</i></b>
                            </button>
                        </div>
                        <button type="button" className="admin-entry-link squad-home-admin" onClick={() => { setAreaAdminAtiva(true); setAdminLiberado(false); setAdminErro(""); setSenhaAdmin(""); }}>Área ADM</button>
                    </div>
                </div>
            );
        }

        if (portalEntrada === "gestores") {
            return (
                <div className="user-screen premium-user-screen">
                    <div className="user-box premium-user-box">
                        <button type="button" className="portal-back-button" onClick={() => setPortalEntrada("home")}>← Voltar</button>
                        <div className="user-intro premium-user-intro"><span>PORTAL DE GESTORES</span><h1>Quem está acessando?</h1><p>Selecione seu perfil para entrar no portal de solicitações.</p></div>
                        <div className="external-manager-grid">
                            {gestoresExternos.length ? gestoresExternos.map((usuario) => (
                                <button key={usuario.id} type="button" className="external-manager-card" onClick={() => abrirLoginUsuario(usuario)}>
                                    <span
                                        className="external-manager-choice-avatar"
                                        style={{
                                            width: 64,
                                            minWidth: 64,
                                            maxWidth: 64,
                                            height: 64,
                                            minHeight: 64,
                                            maxHeight: 64,
                                            flex: "0 0 64px",
                                            aspectRatio: "1 / 1",
                                            display: "grid",
                                            placeItems: "center",
                                            overflow: "hidden",
                                            borderRadius: "50%",
                                            border: "2px solid rgba(201, 163, 94, 0.34)",
                                            background: "#e9e9e6",
                                        }}
                                    >
                                        {usuario.photo_url ? (
                                            <img
                                                src={usuario.photo_url}
                                                alt={usuario.nickname || usuario.name}
                                                style={{
                                                    width: "100%",
                                                    height: "100%",
                                                    minWidth: "100%",
                                                    maxWidth: "100%",
                                                    minHeight: "100%",
                                                    maxHeight: "100%",
                                                    display: "block",
                                                    objectFit: "cover",
                                                    objectPosition: "center",
                                                    borderRadius: "50%",
                                                }}
                                            />
                                        ) : (
                                            <span
                                                style={{
                                                    width: "100%",
                                                    height: "100%",
                                                    display: "grid",
                                                    placeItems: "center",
                                                    borderRadius: "50%",
                                                    color: "#44433f",
                                                    fontSize: 15,
                                                    fontWeight: 900,
                                                    opacity: 1,
                                                }}
                                            >
                                                {initials(
                                                    usuario.nickname ||
                                                        usuario.name ||
                                                        "Perfil"
                                                )}
                                            </span>
                                        )}
                                    </span>
                                    <div className="external-manager-copy">
                                        <strong>{usuario.nickname || usuario.name}</strong>
                                        <span>{usuario.role || "Gerente"}</span>
                                        {usuario.department && <small>{usuario.department}</small>}
                                        {usuario.brands?.[0] && <small className="external-manager-brand">{usuario.brands[0]}</small>}
                                        {!usuario.password_set && <em>Primeiro acesso</em>}
                                    </div>
                                    <b>→</b>
                                </button>
                            )) : <div className="empty-state">Nenhum gerente de outro setor cadastrado ainda.</div>}
                        </div>
                        {loginUsuario && renderLoginModalInline()}
                    </div>
                </div>
            );
        }
        const gruposDaEquipe = groupSquadMembersByRole(colaboradores);

        return (
            <div className="user-screen premium-user-screen">
                <div className="user-box premium-user-box">
                    <button type="button" className="portal-back-button" onClick={() => setPortalEntrada("home")}>← Voltar</button>
                    <div className="premium-entry-top">
                        <div className="user-brand premium-user-brand">
                            <span>SQUAD</span>
                            <strong>Social Planner</strong>
                        </div>
                        <div className="premium-entry-signature">
                            <span>GRUPO AUTO PREMIER</span>
                            <i />
                        </div>
                    </div>

                    <div className="user-intro premium-user-intro">
                        <span>ACESSO AO SQUAD</span>
                        <h1>Quem está acessando?</h1>
                        <p>
                            Escolha seu perfil para entrar. No primeiro acesso,
                            você criará sua senha pessoal.
                        </p>
                    </div>

                    {carregando && <div className="loading">Carregando...</div>}
                    {erro && <div className="server-error">{erro}</div>}

                    <div className="squad-org-chart">
                        {gestores.length > 0 && (
                            <section className="squad-manager-zone">
                                <div className="squad-level-label">
                                    <span>GESTÃO DE MARKETING</span>
                                    <i />
                                </div>
                                <div className="squad-manager-center">
                                    {gestores.map((usuario) => (
                                        <button
                                            key={usuario.id}
                                            type="button"
                                            className="squad-manager-card"
                                            onClick={() => abrirLoginUsuario(usuario)}
                                        >
                                            <div className="squad-manager-avatar-ring">
                                                <Avatar user={usuario} size="large" />
                                            </div>
                                            <div className="squad-manager-card-copy">
                                                <small>GERENTE DE MARKETING</small>
                                                <strong>{usuario.nickname || usuario.name}</strong>
                                                <span>{usuario.role || "Gerente de Marketing"}</span>
                                                {!usuario.password_set && <em>Primeiro acesso</em>}
                                            </div>
                                            <span className="squad-card-enter">→</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="squad-hierarchy-connector"><span /></div>
                            </section>
                        )}

                        <section className="squad-team-zone">
                            <div className="squad-team-heading">
                                <div>
                                    <span>TIME DE MARKETING</span>
                                    <h2>Equipe SQUAD</h2>
                                </div>
                                <small>
                                    {colaboradores.length}{" "}
                                    {colaboradores.length === 1 ? "colaborador" : "colaboradores"}
                                </small>
                            </div>

                            {!gruposDaEquipe.length ? (
                                <div className="empty-state">Nenhum colaborador cadastrado.</div>
                            ) : (
                                <div className="squad-role-groups">
                                    {gruposDaEquipe.map((grupo) => (
                                        <section className={`squad-role-group role-${grupo.key}`} key={grupo.key}>
                                            <div className="squad-role-header">
                                                <div className="squad-role-symbol">{grupo.icon}</div>
                                                <div>
                                                    <strong>{grupo.label}</strong>
                                                    <span>{grupo.subtitle}</span>
                                                </div>
                                                <b>{grupo.users.length}</b>
                                            </div>
                                            <div className="squad-role-members">
                                                {grupo.users.map((usuario) => (
                                                    <button
                                                        key={usuario.id}
                                                        type="button"
                                                        className="squad-member-card"
                                                        onClick={() => abrirLoginUsuario(usuario)}
                                                    >
                                                        <Avatar user={usuario} size="medium" />
                                                        <div className="squad-member-copy">
                                                            <strong>{usuario.nickname || usuario.name}</strong>
                                                            <span>{usuario.role || grupo.label}</span>
                                                            {Array.isArray(usuario.brands) && usuario.brands.length > 0 && (
                                                                <small>
                                                                    {usuario.brands.slice(0, 3).join(" • ")}
                                                                    {usuario.brands.length > 3 ? ` +${usuario.brands.length - 3}` : ""}
                                                                </small>
                                                            )}
                                                            {!usuario.password_set && (
                                                                <em className="first-access-badge">Primeiro acesso</em>
                                                            )}
                                                        </div>
                                                        <span className="squad-member-arrow">→</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    <div className="premium-entry-footer premium-entry-footer-login">
                        <span>Selecione seu perfil para continuar</span>
                        <i />
                        <button
                            type="button"
                            className="admin-entry-link"
                            onClick={() => {
                                setAreaAdminAtiva(true);
                                setAdminLiberado(false);
                                setAdminErro("");
                                setSenhaAdmin("");
                            }}
                        >
                            Área ADM
                        </button>
                    </div>

                    {loginUsuario && (
                        <div className="simple-overlay login-overlay" onMouseDown={fecharLoginUsuario}>
                            <section className="squad-login-card" onMouseDown={(event) => event.stopPropagation()}>
                                <button type="button" className="squad-login-close" onClick={fecharLoginUsuario}>×</button>
                                <div className="squad-login-user">
                                    <Avatar user={loginUsuario} size="xlarge" />
                                    <div>
                                        <span>{isManagerProfile(loginUsuario) ? "PORTAL DE GESTORES" : "SQUAD SOCIAL PLANNER"}</span>
                                        <h2>{loginUsuario.nickname || loginUsuario.name}</h2>
                                        <p>{loginUsuario.role || "Equipe de Marketing"}</p>
                                    </div>
                                </div>
                                <form onSubmit={autenticarUsuario}>
                                    {!loginUsuario.password_set ? (
                                        <>
                                            <div className="first-access-callout">
                                                <strong>Seu primeiro acesso</strong>
                                                <p>Crie sua senha pessoal. A partir de agora, este perfil ficará protegido.</p>
                                            </div>
                                            <label>Crie sua senha</label>
                                            <input
                                                type="password"
                                                autoFocus
                                                minLength={4}
                                                value={loginSenha}
                                                onChange={(event) => setLoginSenha(event.target.value)}
                                                placeholder="Mínimo de 4 caracteres"
                                            />
                                            <label>Confirme sua senha</label>
                                            <input
                                                type="password"
                                                minLength={4}
                                                value={loginConfirmacao}
                                                onChange={(event) => setLoginConfirmacao(event.target.value)}
                                                placeholder="Digite novamente"
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <label>Senha</label>
                                            <input
                                                type="password"
                                                autoFocus
                                                value={loginSenha}
                                                onChange={(event) => setLoginSenha(event.target.value)}
                                                placeholder="Digite sua senha"
                                            />
                                        </>
                                    )}
                                    {loginErro && <div className="login-error">{loginErro}</div>}
                                    <button
                                        className="primary-button squad-login-submit"
                                        disabled={loginProcessando || !loginSenha || (!loginUsuario.password_set && !loginConfirmacao)}
                                    >
                                        {loginProcessando
                                            ? "Entrando..."
                                            : loginUsuario.password_set
                                              ? "Entrar no SQUAD"
                                              : "Criar senha e entrar"}
                                    </button>
                                </form>
                                <small className="login-help-text">
                                    Esqueceu sua senha? O ADM pode redefinir seu acesso.
                                </small>
                            </section>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    async function carregarPrevisaoTempo(silencioso = false) {
        try {
            if (!silencioso) {
                setWeatherLoading(true);
            }

            const data = await request("/api/weather/week");

            setWeatherWeek({
                city: data.city || "Joinville",
                days: Array.isArray(data.days) ? data.days : [],
                calendar_days: Array.isArray(data.calendar_days)
                    ? data.calendar_days
                    : [],
                updated_at: data.updated_at || "",
                stale: Boolean(data.stale),
            });
            setWeatherError("");
        } catch (error) {
            setWeatherError(
                "Não foi possível atualizar a previsão agora."
            );
        } finally {
            if (!silencioso) {
                setWeatherLoading(false);
            }
        }
    }

    function nivelHeatmapCalendario(count) {
        if (count >= 5) return 4;
        if (count >= 3) return 3;
        if (count >= 2) return 2;
        if (count >= 1) return 1;
        return 0;
    }

    async function moverConteudoCalendario(
        contentId,
        destinationDate
    ) {
        const content = conteudos.find(
            (item) => Number(item.id) === Number(contentId)
        );

        if (!content || content.is_live) return;

        const destinationKey = chaveData(destinationDate);

        if (content.date === destinationKey) {
            setDraggedContentId(null);
            setDragOverDate("");
            return;
        }

        try {
            const atualizado = await request(
                `/api/contents/${content.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        date: destinationKey,
                    }),
                }
            );

            atualizarConteudoLocal(atualizado);
            setCalendarMoveNotice(
                `“${content.title}” movido para ${destinationDate.toLocaleDateString(
                    "pt-BR"
                )}.`
            );

            setTimeout(() => {
                setCalendarMoveNotice("");
            }, 2600);
        } catch (error) {
            alert(error.message);
        } finally {
            setDraggedContentId(null);
            setDragOverDate("");
        }
    }

    function renderCalendario() {
        return (
            <>
                <header className="topbar calendar-topbar">
                    <div className="calendar-heading">
                        <p className="eyebrow">PLANEJAMENTO DE CONTEÚDO</p>
                        <h1>{tituloPeriodo}</h1>
                        <p className="page-subtitle">
                            Planeje, acompanhe e priorize os conteúdos.
                        </p>
                    </div>


                    <div className="top-actions">
                        <div className="calendar-selects">
                            <select value={dataAtual.getMonth()} onChange={(event) => mudarMes(event.target.value)}>
                                {MESES.map((mes, index) => (
                                    <option key={mes} value={index}>
                                        {mes}
                                    </option>
                                ))}
                            </select>
                            <select value={dataAtual.getFullYear()} onChange={(event) => mudarAno(event.target.value)}>
                                {ANOS_CALENDARIO.map((ano) => (
                                    <option key={ano} value={ano}>
                                        {ano}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="view-switch">
                            <button className={modo === "mensal" ? "selected" : ""} onClick={() => setModo("mensal")}>
                                Mensal
                            </button>
                            <button className={modo === "semanal" ? "selected" : ""} onClick={() => setModo("semanal")}>
                                Semanal
                            </button>
                        </div>

                        <div className="month-navigation">
                            <button onClick={periodoAnterior}>←</button>
                            <button onClick={irHoje}>Hoje</button>
                            <button onClick={periodoProximo}>→</button>
                        </div>
                    </div>
                </header>

                {lembretesHoje.length > 0 && (
                    <div className="today-reminder-banner" onClick={() => setAbaAtiva("lembretes")}>
                        <div className="notification-icon">!</div>
                        <div>
                            <strong>
                                {lembretesHoje.length === 1
                                    ? "Você tem um lembrete importante hoje"
                                    : `Você tem ${lembretesHoje.length} lembretes importantes hoje`}
                            </strong>
                            <span>{lembretesHoje.map((item) => item.title).join(" • ")}</span>
                        </div>
                        <button>Ver lembretes →</button>
                    </div>
                )}

                {lembretesMetricas.length > 0 && (
                    <div
                        className={`metrics-reminder-banner ${
                            lembretesMetricas.some((item) => item.nivel === "fechamento")
                                ? "closing"
                                : ""
                        }`}
                        onClick={() => setAbaAtiva("lembretes")}
                    >
                        <div className="metrics-reminder-icon">↻</div>
                        <div>
                            <strong>
                                {lembretesMetricas.length === 1
                                    ? "1 publicação precisa de atualização de métricas"
                                    : `${lembretesMetricas.length} publicações precisam de atualização de métricas`}
                            </strong>
                            <span>
                                {lembretesMetricas.some((item) => item.nivel === "fechamento")
                                    ? "Estamos perto do fechamento do mês. Atualize os números antes da reunião."
                                    : "O SQUAD vai lembrar quando uma publicação ficar 7 dias sem atualização."}
                            </span>
                        </div>
                        <button>Atualizar →</button>
                    </div>
                )}

                {calendarMoveNotice && (
                    <div className="calendar-move-notice">
                        <span>✓</span>
                        {calendarMoveNotice}
                    </div>
                )}

                <div className="calendar-summary-weather-row">
                    <section className="summary">
                        <div className="summary-item">
                            <span>Conteúdos</span>
                            <strong>{conteudosPeriodo.length}</strong>
                        </div>
                        <div className="summary-item">
                            <span>Em produção</span>
                            <strong>
                                {
                                    conteudosPeriodo.filter(
                                        (item) =>
                                            item.status === "Em produção"
                                    ).length
                                }
                            </strong>
                        </div>
                        <div className="summary-item">
                            <span>Aguardando aprovação</span>
                            <strong>
                                {
                                    conteudosPeriodo.filter(
                                        (item) =>
                                            (item.approval_stage === "idea" &&
                                                item.idea_approval_status ===
                                                    "pendente") ||
                                            (item.approval_stage === "final" &&
                                                item.approval_status ===
                                                    "pendente")
                                    ).length
                                }
                            </strong>
                        </div>
                        <div className="summary-item">
                            <span>Publicados</span>
                            <strong>
                                {
                                    conteudosPeriodo.filter(
                                        (item) => item.is_live
                                    ).length
                                }
                            </strong>
                        </div>
                    </section>

                    <section className="calendar-weather-panel calendar-weather-compact">
                        <div className="calendar-weather-head">
                            <div>
                                <span>PREVISÃO DA SEMANA</span>
                                <strong>
                                    {weatherWeek.city || "Joinville"}
                                </strong>
                            </div>

                            <small
                                className={
                                    weatherWeek.stale ? "stale" : ""
                                }
                            >
                                {weatherWeek.updated_at
                                    ? `${
                                          weatherWeek.stale
                                              ? "Última previsão"
                                              : "Atualizado"
                                      } ${new Date(
                                          weatherWeek.updated_at
                                      ).toLocaleTimeString("pt-BR", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                      })}`
                                    : weatherLoading
                                      ? "Atualizando..."
                                      : ""}
                            </small>
                        </div>

                        {weatherLoading &&
                        !weatherWeek.days?.length ? (
                            <div className="weather-week-loading">
                                {Array.from({ length: 7 }).map(
                                    (_, index) => (
                                        <i key={index} />
                                    )
                                )}
                            </div>
                        ) : weatherWeek.days?.length ? (
                            <div className="weather-week-days">
                                {weatherWeek.days.map((day) => (
                                    <div
                                        className={`weather-day ${
                                            day.is_today ? "today" : ""
                                        } ${
                                            day.is_past ? "past" : ""
                                        }`}
                                        key={day.date}
                                        title={`${day.condition} • Máx. ${day.max}° • Mín. ${day.min}°`}
                                    >
                                        <span>
                                            {day.weekday}{" "}
                                            <b>{day.day}</b>
                                        </span>

                                        <strong
                                            className="weather-day-icon"
                                            aria-label={day.condition}
                                        >
                                            {day.icon}
                                        </strong>

                                        <div>
                                            <b>{day.max}°</b>
                                            <small>{day.min}°</small>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <button
                                type="button"
                                className="weather-unavailable"
                                onClick={() =>
                                    carregarPrevisaoTempo(false)
                                }
                            >
                                <strong>Previsão indisponível</strong>
                                <span>
                                    {weatherError ||
                                        "Clique para tentar novamente."}
                                </span>
                            </button>
                        )}
                    </section>

                </div>

                <section className="toolbar">
                    <div className="filters">
                        <select value={filtroMarca} onChange={(event) => setFiltroMarca(event.target.value)}>
                            <option value="">Todas as marcas</option>
                            {MARCAS.map((marca) => (
                                <option key={marca}>{marca}</option>
                            ))}
                        </select>
                        <select value={filtroFormato} onChange={(event) => setFiltroFormato(event.target.value)}>
                            <option value="">Todos os formatos</option>
                            {FORMATOS.map((formato) => (
                                <option key={formato}>{formato}</option>
                            ))}
                        </select>
                        <select value={filtroStatus} onChange={(event) => setFiltroStatus(event.target.value)}>
                            <option value="">Todos os status</option>
                            {STATUS.map((status) => (
                                <option key={status}>{status}</option>
                            ))}
                        </select>
                        {(filtroMarca || filtroFormato || filtroStatus) && (
                            <button className="clear-filters" onClick={limparFiltros}>
                                Limpar
                            </button>
                        )}
                    </div>

                    <div className="calendar-toolbar-legends">
                        <div className="calendar-heatmap-legend">
                            <span>CARGA</span>
                            <i className="heat-dot heat-1" />
                            <i className="heat-dot heat-2" />
                            <i className="heat-dot heat-3" />
                            <i className="heat-dot heat-4" />
                        </div>

                        <div className="urgency-legend">
                        <span>URGÊNCIA</span>
                        <div>
                            <i className="dot green" /> Baixa
                        </div>
                        <div>
                            <i className="dot yellow" /> Média
                        </div>
                        <div>
                            <i className="dot red" /> Alta
                        </div>
                        </div>
                    </div>
                </section>

                <section className={`calendar ${modo}`}>
                    <div className="weekdays">
                        {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map((item) => <span key={item}>{item}</span>)}
                    </div>
                    <div className="days">
                        {celulas.map((data, index) => {
                            if (!data) return <div className="day empty-day" key={`empty-${index}`} />;
                            const itens = conteudosDoDia(data);
                            const reminders = lembretesDoDia(data);
                            const today = mesmoDia(data, hoje);
                            const dayKey = chaveData(data);
                            const heatCount = conteudos.filter(
                                (item) => item.date === dayKey
                            ).length;
                            const heatLevel =
                                nivelHeatmapCalendario(heatCount);
                            const weatherDay = (
                                weatherWeek.calendar_days || []
                            ).find(
                                (item) =>
                                    item.date === chaveData(data)
                            );

                            return (
                                <div
                                    className={`day ${
                                        reminders.length
                                            ? "has-reminder"
                                            : ""
                                    } calendar-heat-${heatLevel} ${
                                        dragOverDate === dayKey
                                            ? "calendar-drop-target"
                                            : ""
                                    }`}
                                    key={dayKey}
                                    title={
                                        heatCount === 1
                                            ? "1 conteúdo planejado neste dia"
                                            : `${heatCount} conteúdos planejados neste dia`
                                    }
                                    onClick={() => abrirDia(data)}
                                    onDragOver={(event) => {
                                        if (!draggedContentId) return;
                                        event.preventDefault();
                                        event.dataTransfer.dropEffect =
                                            "move";
                                        setDragOverDate(dayKey);
                                    }}
                                    onDragLeave={(event) => {
                                        if (
                                            !event.currentTarget.contains(
                                                event.relatedTarget
                                            )
                                        ) {
                                            setDragOverDate("");
                                        }
                                    }}
                                    onDrop={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();

                                        const id =
                                            event.dataTransfer.getData(
                                                "text/squad-content-id"
                                            ) || draggedContentId;

                                        if (id) {
                                            moverConteudoCalendario(
                                                id,
                                                data
                                            );
                                        }
                                    }}
                                >
                                    <div className="day-header">
                                        <div className="day-date-weather">
                                            <span
                                                className={
                                                    today
                                                        ? "today-number"
                                                        : "day-number"
                                                }
                                            >
                                                {data.getDate()}
                                            </span>

                                            {weatherDay && (
                                                <span
                                                    className="calendar-day-weather-icon"
                                                    title={`${weatherDay.condition} • Máx. ${weatherDay.max}° • Mín. ${weatherDay.min}°`}
                                                    aria-label={weatherDay.condition}
                                                >
                                                    {weatherDay.icon}
                                                </span>
                                            )}
                                        </div>

                                        <button
                                            className="day-add"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                abrirDia(data);
                                            }}
                                        >
                                            +
                                        </button>
                                    </div>

                                    {reminders.length > 0 && (
                                        <div className="calendar-reminders">
                                            {reminders.slice(0, 2).map((reminder) => (
                                                <div
                                                    className="calendar-reminder-chip"
                                                    key={reminder.id}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setAnoLembretes(data.getFullYear());
                                                        setAbaAtiva("lembretes");
                                                    }}
                                                >
                                                    <span>◉</span> {reminder.title}
                                                </div>
                                            ))}
                                            {reminders.length > 2 && <small>+{reminders.length - 2} lembrete(s)</small>}
                                        </div>
                                    )}

                                    <div className="mini-list">
                                        {itens.map((conteudo) => (
                                            <button
                                                type="button"
                                                key={conteudo.id}
                                                draggable={
                                                    !Boolean(
                                                        conteudo.is_live
                                                    )
                                                }
                                                className={`mini-content urgency-${conteudo.urgency} ${
                                                    Number(
                                                        draggedContentId
                                                    ) ===
                                                    Number(conteudo.id)
                                                        ? "calendar-dragging-content"
                                                        : ""
                                                }`}
                                                title={
                                                    conteudo.is_live
                                                        ? conteudo.title
                                                        : `${conteudo.title} • arraste para mudar a data`
                                                }
                                                onDragStart={(event) => {
                                                    if (
                                                        conteudo.is_live
                                                    ) {
                                                        event.preventDefault();
                                                        return;
                                                    }

                                                    event.stopPropagation();
                                                    setDraggedContentId(
                                                        conteudo.id
                                                    );
                                                    event.dataTransfer.effectAllowed =
                                                        "move";
                                                    event.dataTransfer.setData(
                                                        "text/squad-content-id",
                                                        String(
                                                            conteudo.id
                                                        )
                                                    );
                                                }}
                                                onDragEnd={() => {
                                                    setDraggedContentId(
                                                        null
                                                    );
                                                    setDragOverDate("");
                                                }}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    abrirConteudo(conteudo);
                                                }}
                                            >
                                                <div className="mini-top">
                                                    <span className="mini-title">{conteudo.title}</span>
                                                    <span
                                                        className={`approval-mini ${classeAprovacaoConteudo(
                                                            conteudo
                                                        )}`}
                                                        title={labelAprovacaoConteudo(
                                                            conteudo
                                                        )}
                                                    >
                                                        {classeAprovacaoConteudo(
                                                            conteudo
                                                        ) ===
                                                        "approval-pendente" ? (
                                                            <i
                                                                className="approval-waiting-spinner"
                                                                aria-hidden="true"
                                                            />
                                                        ) : conteudo.approval_required ===
                                                          false ? (
                                                            "✓"
                                                        ) : conteudo.approval_status ===
                                                          "aprovado" ? (
                                                            "✓"
                                                        ) : conteudo.approval_status ===
                                                              "alteracao" ||
                                                          conteudo.idea_approval_status ===
                                                              "alteracao" ? (
                                                            "!"
                                                        ) : conteudo.idea_approval_status ===
                                                          "aprovado" ? (
                                                            "✓"
                                                        ) : (
                                                            "•"
                                                        )}
                                                    </span>
                                                </div>

                                                <div className="mini-meta calendar-mini-meta">
                                                    <div className="calendar-brand-group">
                                                        {(conteudo.brands || []).map(
                                                            (brand) => (
                                                                <span
                                                                    key={brand}
                                                                    className={`calendar-brand-logo ${brandClassName(
                                                                        brand
                                                                    )}`}
                                                                    title={brand}
                                                                >
                                                                    {brand}
                                                                </span>
                                                            )
                                                        )}
                                                    </div>

                                                    <span className="calendar-format-chip">
                                                        {conteudo.format}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </>
        );
    }

    function renderConteudos() {
        function renderLinhaConteudo(conteudo, publicado = false) {
            const dataReferencia = publicado ? dataPublicacaoConteudo(conteudo) : conteudo.date;
            const urgencyLabel = nomeUrgencia(conteudo.urgency);

            return (
                <article
                    className={`content-list-row ${classeProcesso(conteudo)}`}
                    key={conteudo.id}
                >
                    <div
                        className={`urgency-signal urgency-signal-${conteudo.urgency}`}
                        title={`Urgência ${urgencyLabel}`}
                    >
                        <span />
                        <small>{urgencyLabel}</small>
                    </div>

                    <div className="content-list-date">
                        <strong>{dataDaChave(dataReferencia).getDate().toString().padStart(2, "0")}</strong>
                        <span>
                            {MESES[dataDaChave(dataReferencia).getMonth()].slice(0, 3)}
                        </span>
                    </div>

                    <div className="content-list-main">
                        <div className="content-list-title-line">
                            <button
                                type="button"
                                className="content-title-button"
                                onClick={() => abrirConteudo(conteudo)}
                            >
                                {conteudo.title}
                            </button>

                            {publicado ? (
                                <span className="live-badge">
                                    <i />
                                    NO AR
                                </span>
                            ) : (
                                <span className="process-badge">
                                    {labelProcesso(conteudo)}
                                </span>
                            )}
                        </div>

                        <div className="content-list-meta">
                            <span>{conteudo.brands.join(" + ")}</span>
                            <span>{conteudo.format}</span>
                            <span>{conteudo.status}</span>

                            {publicado &&
                                !isStoriesFormat(conteudo.format) && (
                                    <>
                                        <span>
                                            {formatNumber(conteudo.metric_views)} views
                                        </span>
                                        <span>
                                            {formatNumber(conteudo.metric_likes)} curtidas
                                        </span>
                                        <span>
                                            {formatNumber(conteudo.metric_shares)} compartilhamentos
                                        </span>
                                        {idsMetricasPendentes.has(conteudo.id) && (
                                            <span className="metric-update-chip">
                                                Atualizar métricas
                                            </span>
                                        )}
                                    </>
                                )}

                            {publicado &&
                                isStoriesFormat(conteudo.format) && (
                                    <span className="story-no-metrics-chip">
                                        Story publicado • sem métricas manuais
                                    </span>
                                )}
                        </div>

                        {conteudo.manager_note && !publicado && (
                            <div className="content-list-note">
                                {conteudo.manager_note}
                            </div>
                        )}
                    </div>

                    {publicado && (
                        <div className="content-list-publisher">
                            <Avatar user={conteudo.publisher} size="small" />
                            <div>
                                <span>Publicado por</span>
                                <strong>
                                    {conteudo.publisher?.nickname ||
                                        conteudo.publisher?.name ||
                                        "Não informado"}
                                </strong>
                            </div>
                        </div>
                    )}

                    <div className="content-list-actions">
                        {publicado && conteudo.published_url && (
                            <a
                                className="list-action open-live"
                                href={conteudo.published_url}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Abrir post
                            </a>
                        )}

                        <button
                            type="button"
                            className="list-action open"
                            onClick={() => abrirConteudo(conteudo)}
                        >
                            Abrir
                        </button>

                        <button
                            type="button"
                            className="list-action trash"
                            onClick={() => removerConteudo(conteudo.id)}
                            title="Mover para a lixeira por 24 horas"
                        >
                            Lixeira
                        </button>
                    </div>
                </article>
            );
        }

        return (
            <>
                <header className="section-header">
                    <div>
                        <p className="eyebrow">PRODUÇÃO</p>
                        <h1>Conteúdos</h1>
                        <p>
                            Acompanhe o processo do mês, conteúdos em análise e o que já está no ar.
                        </p>
                    </div>

                    <button
                        className="primary-button compact"
                        onClick={() => abrirDia(new Date())}
                    >
                        + Novo conteúdo
                    </button>
                </header>

                <section className="content-feedback-compact">
                    <button
                        type="button"
                        className={`content-feedback-toggle ${
                            Number(notificationsData.unread_social || 0) > 0
                                ? "has-unread"
                                : ""
                        }`}
                        onClick={() =>
                            setRetornosSocialAberto(
                                (current) => !current
                            )
                        }
                    >
                        <span className="content-feedback-bell">●</span>
                        <div>
                            <strong>Retornos da gerência</strong>
                            <small>
                                {Number(
                                    notificationsData.unread_social || 0
                                ) > 0
                                    ? `${
                                          notificationsData.unread_social
                                      } ${
                                          Number(
                                              notificationsData.unread_social
                                          ) === 1
                                              ? "retorno não lido"
                                              : "retornos não lidos"
                                      }`
                                    : "Nenhum retorno novo"}
                            </small>
                        </div>

                        {Number(
                            notificationsData.unread_social || 0
                        ) > 0 && (
                            <b>
                                {notificationsData.unread_social}
                            </b>
                        )}

                        <i>
                            {retornosSocialAberto ? "Fechar" : "Abrir"}
                        </i>
                    </button>

                    {retornosSocialAberto &&
                        renderRetornosGerencia("social")}
                </section>

                <section className="content-control-bar">
                    <div className="content-search content-search-list">
                        <input
                            value={buscaConteudo}
                            onChange={(event) => setBuscaConteudo(event.target.value)}
                            placeholder="Buscar por título, marca ou descrição..."
                        />
                    </div>

                    <div className="content-month-selector">
                        <select
                            value={conteudosMes}
                            onChange={(event) => setConteudosMes(Number(event.target.value))}
                        >
                            {MESES.map((mes, index) => (
                                <option value={index + 1} key={mes}>
                                    {mes}
                                </option>
                            ))}
                        </select>

                        <select
                            value={conteudosAno}
                            onChange={(event) => setConteudosAno(Number(event.target.value))}
                        >
                            {ANOS_CALENDARIO.map((ano) => (
                                <option value={ano} key={ano}>
                                    {ano}
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            className={`trash-toggle ${lixeiraAberta ? "active" : ""}`}
                            onClick={async () => {
                                const proximo = !lixeiraAberta;
                                setLixeiraAberta(proximo);
                                if (proximo && usuarioSelecionado) {
                                    await carregarLixeira(usuarioSelecionado.id, true);
                                }
                            }}
                        >
                            Lixeira
                            {lixeiraConteudos.length > 0 && (
                                <b>{lixeiraConteudos.length}</b>
                            )}
                        </button>
                    </div>
                </section>

                <div className="content-workflow-tabs">
                    <button
                        type="button"
                        className={
                            conteudosTab === "andamento"
                                ? "active tab-progress"
                                : ""
                        }
                        onClick={() => setConteudosTab("andamento")}
                    >
                        <span>Em andamento</span>
                        <b>{conteudosEmAndamento.length}</b>
                    </button>

                    <button
                        type="button"
                        className={
                            conteudosTab === "aguardando"
                                ? "active tab-waiting"
                                : ""
                        }
                        onClick={() => setConteudosTab("aguardando")}
                    >
                        <span>Aguardando aprovação</span>
                        <b>{conteudosAguardandoAprovacao.length}</b>
                    </button>

                    <button
                        type="button"
                        className={
                            conteudosTab === "aprovados"
                                ? "active tab-approved"
                                : ""
                        }
                        onClick={() => setConteudosTab("aprovados")}
                    >
                        <span>Aprovados</span>
                        <b>{conteudosAprovadosParaPublicar.length}</b>
                    </button>

                    <button
                        type="button"
                        className={
                            conteudosTab === "noar"
                                ? "active tab-live"
                                : ""
                        }
                        onClick={() => setConteudosTab("noar")}
                    >
                        <span>No Ar</span>
                        <b>{conteudosNoAr.length}</b>
                    </button>
                </div>

                {lixeiraAberta && (
                    <section className="temporary-trash">
                        <div className="content-section-heading">
                            <div>
                                <span>LIXEIRA TEMPORÁRIA</span>
                                <h2>Restaurar conteúdo</h2>
                                <p>
                                    O conteúdo fica disponível por 24 horas. Depois é excluído
                                    definitivamente com seus arquivos.
                                </p>
                            </div>
                            <strong>{lixeiraConteudos.length}</strong>
                        </div>

                        {!lixeiraConteudos.length ? (
                            <div className="empty-state compact">
                                A lixeira está vazia.
                            </div>
                        ) : (
                            <div className="trash-list">
                                {lixeiraConteudos.map((conteudo) => (
                                    <div className="trash-row" key={conteudo.id}>
                                        <div className="trash-icon">♲</div>

                                        <div className="trash-row-main">
                                            <strong>{conteudo.title}</strong>
                                            <span>
                                                {dataDaChave(conteudo.date).toLocaleDateString(
                                                    "pt-BR"
                                                )}{" "}
                                                • {conteudo.brands.join(" + ")}
                                            </span>
                                        </div>

                                        <div className="trash-expiry">
                                            <span>Disponível por</span>
                                            <strong>
                                                {tempoRestanteLixeira(
                                                    conteudo.deleted_at,
                                                    relogioLixeira
                                                )}
                                            </strong>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => restaurarConteudo(conteudo.id)}
                                        >
                                            Restaurar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {conteudosTab === "andamento" && (
                    <section className="content-process-section">
                        <div className="content-section-heading">
                            <div>
                                <span>PRODUÇÃO DO MÊS</span>
                                <h2>Em andamento</h2>
                                <p>
                                    Ideias, planejamentos, produção, edição e
                                    ajustes que ainda dependem do Social Media.
                                </p>
                            </div>
                            <strong>{conteudosEmAndamento.length}</strong>
                        </div>

                        <div className="content-list">
                            {!conteudosEmAndamento.length ? (
                                <div className="empty-state">
                                    Nenhum conteúdo em andamento neste mês.
                                </div>
                            ) : (
                                conteudosEmAndamento.map((conteudo) =>
                                    renderLinhaConteudo(
                                        conteudo,
                                        false
                                    )
                                )
                            )}
                        </div>
                    </section>
                )}

                {conteudosTab === "aguardando" && (
                    <>
                        <section className="content-process-section content-waiting-section">
                            <div className="content-section-heading">
                                <div>
                                    <span>ETAPA 01 • IDEIAS</span>
                                    <h2>Aguardando aprovação da ideia</h2>
                                    <p>
                                        Estes conteúdos estão atualmente com o
                                        gerente para análise da ideia, roteiro
                                        ou conceito.
                                    </p>
                                </div>
                                <strong>
                                    {
                                        conteudosAguardandoAprovacao.filter(
                                            (item) =>
                                                item.approval_stage ===
                                                "idea"
                                        ).length
                                    }
                                </strong>
                            </div>

                            <div className="content-list">
                                {conteudosAguardandoAprovacao.filter(
                                    (item) =>
                                        item.approval_stage === "idea"
                                ).length === 0 ? (
                                    <div className="empty-state">
                                        Nenhuma ideia aguardando aprovação.
                                    </div>
                                ) : (
                                    conteudosAguardandoAprovacao
                                        .filter(
                                            (item) =>
                                                item.approval_stage ===
                                                "idea"
                                        )
                                        .map((conteudo) =>
                                            renderLinhaConteudo(
                                                conteudo,
                                                false
                                            )
                                        )
                                )}
                            </div>
                        </section>

                        <section className="content-process-section content-waiting-section final-waiting-section">
                            <div className="content-section-heading">
                                <div>
                                    <span>ETAPA 02 • CONTEÚDO FINAL</span>
                                    <h2>Aguardando aprovação final</h2>
                                    <p>
                                        Arquivos prontos enviados ao gerente
                                        antes da publicação.
                                    </p>
                                </div>
                                <strong>
                                    {
                                        conteudosAguardandoAprovacao.filter(
                                            (item) =>
                                                item.approval_stage ===
                                                "final"
                                        ).length
                                    }
                                </strong>
                            </div>

                            <div className="content-list">
                                {conteudosAguardandoAprovacao.filter(
                                    (item) =>
                                        item.approval_stage === "final"
                                ).length === 0 ? (
                                    <div className="empty-state">
                                        Nenhum conteúdo final aguardando
                                        aprovação.
                                    </div>
                                ) : (
                                    conteudosAguardandoAprovacao
                                        .filter(
                                            (item) =>
                                                item.approval_stage ===
                                                "final"
                                        )
                                        .map((conteudo) =>
                                            renderLinhaConteudo(
                                                conteudo,
                                                false
                                            )
                                        )
                                )}
                            </div>
                        </section>
                    </>
                )}

                {conteudosTab === "aprovados" && (
                    <section className="content-process-section content-approved-section">
                        <div className="content-section-heading">
                            <div>
                                <span>PRONTOS PARA PUBLICAR</span>
                                <h2>Aprovados</h2>
                                <p>
                                    Conteúdos com aprovação final do gerente,
                                    aguardando agendamento ou publicação.
                                </p>
                            </div>
                            <strong>
                                {conteudosAprovadosParaPublicar.length}
                            </strong>
                        </div>

                        <div className="content-list">
                            {!conteudosAprovadosParaPublicar.length ? (
                                <div className="empty-state">
                                    Nenhum conteúdo aprovado aguardando
                                    publicação.
                                </div>
                            ) : (
                                conteudosAprovadosParaPublicar.map(
                                    (conteudo) =>
                                        renderLinhaConteudo(
                                            conteudo,
                                            false
                                        )
                                )
                            )}
                        </div>
                    </section>
                )}

                {conteudosTab === "noar" && (
                    <section className="content-process-section live-section">
                        <div className="content-section-heading">
                            <div>
                                <span>PUBLICAÇÕES</span>
                                <h2>Já estão no ar</h2>
                                <p>
                                    Conteúdos publicados no mês, com
                                    responsável e métricas quando o formato
                                    exigir.
                                </p>
                            </div>
                            <strong>{conteudosNoAr.length}</strong>
                        </div>

                        <div className="content-list">
                            {!conteudosNoAr.length ? (
                                <div className="empty-state">
                                    Nenhum conteúdo publicado neste mês.
                                </div>
                            ) : (
                                conteudosNoAr.map((conteudo) =>
                                    renderLinhaConteudo(
                                        conteudo,
                                        true
                                    )
                                )
                            )}
                        </div>
                    </section>
                )}
            </>
        );
    }

    function abrirGaleriaCriativa(files, selectedFile) {
        const imagens = (files || []).filter(isCreativeImage);

        if (!imagens.length) return;

        const selectedIndex = Math.max(
            0,
            imagens.findIndex((file) => file.id === selectedFile?.id)
        );

        setCreativeGallery({
            files: imagens,
            index: selectedIndex,
        });
    }

    function navegarGaleriaCriativa(direction) {
        setCreativeGallery((current) => {
            if (!current?.files?.length) return null;

            const total = current.files.length;
            const nextIndex =
                (Number(current.index || 0) + direction + total) % total;

            return {
                ...current,
                index: nextIndex,
            };
        });
    }

    function renderCreativeLibrary(files, options = {}) {
        const {
            allowRemove = false,
            compact = false,
            manager = false,
            selectable = false,
        } = options;

        if (!files?.length) {
            return (
                <div className="empty-state compact-empty">
                    Nenhum arquivo anexado.
                </div>
            );
        }

        const images = files.filter(isCreativeImage);
        const videos = files.filter(isCreativeVideo);
        const otherFiles = files.filter(
            (file) => !isCreativeImage(file) && !isCreativeVideo(file)
        );

        return (
            <div
                className={`creative-library ${compact ? "compact" : ""} ${
                    manager ? "manager" : ""
                } ${selectable ? "selectable" : ""}`}
            >
                {selectable && (
                    <div className="creative-selection-toolbar">
                        <div className="creative-selection-summary">
                            <strong>
                                {creativeSelectedFileIds.length} selecionado(s)
                            </strong>
                            <span>
                                {files.length} arquivo(s) nesta produção
                            </span>
                        </div>

                        <div className="creative-selection-actions">
                            <button
                                type="button"
                                onClick={() =>
                                    selecionarTodosArquivosCriativos(files)
                                }
                                disabled={
                                    creativeSelectedFileIds.length ===
                                    files.length
                                }
                            >
                                Selecionar todas
                            </button>

                            {creativeSelectedFileIds.length > 0 && (
                                <button
                                    type="button"
                                    onClick={
                                        limparSelecaoArquivosCriativos
                                    }
                                >
                                    Limpar seleção
                                </button>
                            )}

                            <button
                                type="button"
                                className="download"
                                disabled={
                                    !creativeSelectedFileIds.length
                                }
                                onClick={() =>
                                    baixarArquivosCriativosSelecionados(
                                        files
                                    )
                                }
                            >
                                ↓ Baixar selecionadas
                            </button>

                            {allowRemove && (
                                <button
                                    type="button"
                                    className="danger"
                                    disabled={
                                        !creativeSelectedFileIds.length
                                    }
                                    onClick={() =>
                                        removerArquivosCriativosSelecionados(
                                            files
                                        )
                                    }
                                >
                                    Remover selecionadas
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {images.length > 0 && (
                    <div className="creative-library-section">
                        <div className="creative-library-title">
                            <div>
                                <strong>Imagens</strong>
                                <span>
                                    {images.length === 1
                                        ? "1 imagem"
                                        : `${images.length} imagens`}
                                </span>
                            </div>

                            <small>
                                Clique em qualquer arte para ampliar
                            </small>
                        </div>

                        <div className="creative-image-grid">
                            {images.map((file, index) => (
                                <div
                                    className={`creative-image-card ${
                                        selectable &&
                                        creativeSelectedFileIds.includes(
                                            Number(file.id)
                                        )
                                            ? "selected"
                                            : ""
                                    }`}
                                    key={file.id}
                                >
                                    {selectable && (
                                        <button
                                            type="button"
                                            className="creative-file-select"
                                            aria-label={`Selecionar ${file.original_name}`}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                alternarSelecaoArquivoCriativo(
                                                    file.id
                                                );
                                            }}
                                        >
                                            <span>
                                                {creativeSelectedFileIds.includes(
                                                    Number(file.id)
                                                )
                                                    ? "✓"
                                                    : ""}
                                            </span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        className="creative-image-preview"
                                        onClick={() =>
                                            abrirGaleriaCriativa(files, file)
                                        }
                                    >
                                        <img
                                            src={file.url}
                                            alt={file.original_name}
                                            loading="lazy"
                                        />

                                        <span className="creative-image-number">
                                            {String(index + 1).padStart(2, "0")}
                                        </span>

                                        <span className="creative-image-zoom">
                                            ⛶ Ver
                                        </span>
                                    </button>

                                    <div className="creative-image-info">
                                        <strong>{file.original_name}</strong>
                                        <span>
                                            {(
                                                Number(file.file_size || 0) /
                                                1024 /
                                                1024
                                            ).toFixed(1)}{" "}
                                            MB
                                        </span>
                                    </div>

                                    {allowRemove && (
                                        <button
                                            type="button"
                                            className="creative-library-remove"
                                            onClick={() =>
                                                removerArquivoCriativo(file.id)
                                            }
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {videos.length > 0 && (
                    <div className="creative-library-section video-library-section">
                        <div className="creative-library-title">
                            <div>
                                <strong>Vídeos</strong>
                                <span>
                                    {videos.length === 1
                                        ? "1 vídeo"
                                        : `${videos.length} vídeos`}
                                </span>
                            </div>

                            <small>
                                Assista sem sair do SQUAD. Use tela cheia se precisar.
                            </small>
                        </div>

                        <div className="creative-video-grid">
                            {videos.map((file) => (
                                <article
                                    className={`creative-video-card ${
                                        selectable &&
                                        creativeSelectedFileIds.includes(
                                            Number(file.id)
                                        )
                                            ? "selected"
                                            : ""
                                    }`}
                                    key={file.id}
                                >
                                    {selectable && (
                                        <button
                                            type="button"
                                            className="creative-file-select"
                                            aria-label={`Selecionar ${file.original_name}`}
                                            onClick={() =>
                                                alternarSelecaoArquivoCriativo(
                                                    file.id
                                                )
                                            }
                                        >
                                            <span>
                                                {creativeSelectedFileIds.includes(
                                                    Number(file.id)
                                                )
                                                    ? "✓"
                                                    : ""}
                                            </span>
                                        </button>
                                    )}

                                    <div className="creative-video-player">
                                        <video
                                            src={file.url}
                                            controls
                                            controlsList="nodownload"
                                            preload="metadata"
                                            playsInline
                                        >
                                            Seu navegador não conseguiu reproduzir este vídeo.
                                        </video>
                                    </div>

                                    <div className="creative-video-info">
                                        <div>
                                            <strong>{file.original_name}</strong>
                                            <span>
                                                {(
                                                    Number(file.file_size || 0) /
                                                    1024 /
                                                    1024
                                                ).toFixed(1)}{" "}
                                                MB
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            className="creative-preserve-download"
                                            onClick={async () => {
                                                try {
                                                    await baixarArquivoComNomeOriginal(
                                                        file,
                                                        "creative"
                                                    );
                                                } catch (error) {
                                                    alert(error.message);
                                                }
                                            }}
                                        >
                                            ↓ Baixar
                                        </button>
                                    </div>

                                    {allowRemove && (
                                        <button
                                            type="button"
                                            className="creative-library-remove creative-video-remove"
                                            onClick={() =>
                                                removerArquivoCriativo(file.id)
                                            }
                                        >
                                            ×
                                        </button>
                                    )}
                                </article>
                            ))}
                        </div>
                    </div>
                )}

                {otherFiles.length > 0 && (
                    <div className="creative-library-section other-files">
                        <div className="creative-library-title">
                            <div>
                                <strong>Outros arquivos</strong>
                                <span>
                                    {otherFiles.length === 1
                                        ? "1 arquivo"
                                        : `${otherFiles.length} arquivos`}
                                </span>
                            </div>
                        </div>

                        <div className="creative-other-files">
                            {otherFiles.map((file) => (
                                <div
                                    className={`creative-other-file ${
                                        selectable &&
                                        creativeSelectedFileIds.includes(
                                            Number(file.id)
                                        )
                                            ? "selected"
                                            : ""
                                    }`}
                                    key={file.id}
                                >
                                    {selectable && (
                                        <button
                                            type="button"
                                            className="creative-other-file-select"
                                            aria-label={`Selecionar ${file.original_name}`}
                                            onClick={() =>
                                                alternarSelecaoArquivoCriativo(
                                                    file.id
                                                )
                                            }
                                        >
                                            <span>
                                                {creativeSelectedFileIds.includes(
                                                    Number(file.id)
                                                )
                                                    ? "✓"
                                                    : ""}
                                            </span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        className="creative-other-download"
                                        onClick={async () => {
                                            try {
                                                await baixarArquivoComNomeOriginal(
                                                    file,
                                                    "creative"
                                                );
                                            } catch (error) {
                                                alert(error.message);
                                            }
                                        }}
                                    >
                                        <span className="creative-file-type">
                                            {isCreativeVideo(file)
                                                ? "▶"
                                                : isCreativePdf(file)
                                                  ? "PDF"
                                                  : "↓"}
                                        </span>

                                        <div>
                                            <strong>
                                                {file.original_name}
                                            </strong>
                                            <small>
                                                {(
                                                    Number(
                                                        file.file_size || 0
                                                    ) /
                                                    1024 /
                                                    1024
                                                ).toFixed(1)}{" "}
                                                MB
                                            </small>
                                        </div>
                                    </button>

                                    {allowRemove && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                removerArquivoCriativo(file.id)
                                            }
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    function renderCentralCriativa() {
        const todasMinhasProducoes = creativeData.created || [];
        const todosRecebidos = creativeData.received || [];
        const temporarios = creativeData.temporary || [];
        const unread = Number(creativeData.unread_count || 0);

        const termoCreative = creativeBusca.trim().toLowerCase();

        function correspondeBuscaCriativa(job) {
            if (!termoCreative) return true;
            return String(job?.title || "")
                .toLowerCase()
                .includes(termoCreative);
        }

        function correspondePeriodoCriativo(value) {
            const raw = String(value || "").trim();
            if (!raw) return false;

            const match = raw.match(/^(\d{4})-(\d{2})/);
            if (!match) return false;

            const year = Number(match[1]);
            const month = Number(match[2]);

            if (year !== Number(creativeAno)) return false;
            if (Number(creativeMes) === 0) return true;

            return month === Number(creativeMes);
        }

        const minhasProducoesOperacionais = todasMinhasProducoes
            .filter(
                (job) =>
                    !["aprovado", "finalizado", "arquivado"].includes(
                        job.status
                    )
            )
            .filter(correspondeBuscaCriativa)
            .filter((job) =>
                correspondePeriodoCriativo(
                    job.deadline || job.created_at
                )
            );

        const aprovadasHistorico = todasMinhasProducoes
            .filter((job) =>
                ["aprovado", "finalizado", "arquivado"].includes(
                    job.status
                )
            )
            .filter(correspondeBuscaCriativa)
            .filter((job) =>
                correspondePeriodoCriativo(
                    job.approved_at ||
                        job.recipient_finished_at ||
                        job.updated_at
                )
            )
            .sort(
                (a, b) =>
                    String(b.approved_at || b.updated_at || "").localeCompare(
                        String(a.approved_at || a.updated_at || "")
                    ) || b.id - a.id
            );

        const recebidos = todosRecebidos
            .filter(correspondeBuscaCriativa)
            .filter((job) =>
                correspondePeriodoCriativo(
                    job.approved_at || job.updated_at
                )
            );

        const emProducao = minhasProducoesOperacionais.filter((item) =>
            ["em_producao", "ajuste"].includes(item.status)
        ).length;

        const aguardando = minhasProducoesOperacionais.filter(
            (item) => item.status === "aguardando_aprovacao"
        ).length;

        const pecasAprovadasPeriodo = aprovadasHistorico.reduce(
            (total, item) => total + Number(item.quantity || 0),
            0
        );

        const periodoCreativeLabel =
            Number(creativeMes) === 0
                ? `Ano de ${creativeAno}`
                : `${MESES[Number(creativeMes) - 1]} de ${creativeAno}`;

        function renderCreativeStatus(job) {
            return (
                <span className={`creative-status ${creativeStatusClass(job.status)}`}>
                    {creativeStatusLabel(job.status)}
                </span>
            );
        }

        return (
            <>
                <header className="section-header creative-header">
                    <div>
                        <p className="eyebrow">PRODUÇÃO • APROVAÇÃO • ENTREGA</p>
                        <h1>Central Criativa</h1>
                        <p>
                            O Design produz, o gerente aprova e os arquivos finais chegam diretamente para quem vai publicar ou utilizar a peça.
                        </p>
                    </div>
                    <button className="primary-button compact" onClick={abrirNovaProducaoCriativa}>
                        + Nova produção
                    </button>
                </header>

                {renderRetornosGerencia("design")}

                <section className="creative-summary-grid creative-summary-upgraded">
                    <div
                        className={
                            unread ? "creative-unread-summary" : ""
                        }
                    >
                        <span>NOVAS PARA MIM</span>
                        <strong>{unread}</strong>
                        <small>entregas ainda não abertas</small>
                    </div>

                    <div>
                        <span>EM PRODUÇÃO</span>
                        <strong>{emProducao}</strong>
                        <small>demandas em trabalho ou ajuste</small>
                    </div>

                    <div>
                        <span>EM APROVAÇÃO</span>
                        <strong>{aguardando}</strong>
                        <small>aguardando decisão do gerente</small>
                    </div>

                    <div className="creative-approved-summary">
                        <span>APROVADAS NO PERÍODO</span>
                        <strong>{aprovadasHistorico.length}</strong>
                        <small>
                            {pecasAprovadasPeriodo} peça(s) •{" "}
                            {periodoCreativeLabel}
                        </small>
                    </div>

                    <div
                        className={
                            temporarios.length
                                ? "creative-temp-summary"
                                : ""
                        }
                    >
                        <span>TEMPORÁRIOS</span>
                        <strong>{temporarios.length}</strong>
                        <small>arquivos aguardando exclusão</small>
                    </div>
                </section>

                <div className="creative-tabs creative-tabs-upgraded">
                    <button
                        className={
                            creativeTab === "recebidos"
                                ? "active creative-tab-new"
                                : ""
                        }
                        onClick={() => {
                            setCreativeTab("recebidos");
                            carregarCreative(
                                usuarioSelecionado.id,
                                true
                            );
                        }}
                    >
                        Novas para mim
                        {unread > 0 && <b>{unread}</b>}
                    </button>

                    <button
                        className={
                            creativeTab === "producoes" ? "active" : ""
                        }
                        onClick={() =>
                            setCreativeTab("producoes")
                        }
                    >
                        Minhas produções
                        {Number(
                            notificationsData.unread_design || 0
                        ) > 0 && (
                            <b>
                                {notificationsData.unread_design}
                            </b>
                        )}
                    </button>

                    <button
                        className={
                            creativeTab === "aprovadas"
                                ? "active creative-tab-approved"
                                : ""
                        }
                        onClick={() =>
                            setCreativeTab("aprovadas")
                        }
                    >
                        Aprovadas
                        {aprovadasHistorico.length > 0 && (
                            <b>{aprovadasHistorico.length}</b>
                        )}
                    </button>

                    <button
                        className={
                            creativeTab === "temporarios"
                                ? "active"
                                : ""
                        }
                        onClick={() =>
                            setCreativeTab("temporarios")
                        }
                    >
                        Temporários
                        {temporarios.length > 0 && (
                            <b className="temp-badge">
                                {temporarios.length}
                            </b>
                        )}
                    </button>
                </div>

                {creativeTab !== "temporarios" && (
                    <section className="creative-history-toolbar">
                        <div className="creative-history-search">
                            <span>⌕</span>
                            <input
                                value={creativeBusca}
                                onChange={(event) =>
                                    setCreativeBusca(
                                        event.target.value
                                    )
                                }
                                placeholder="Buscar por título..."
                            />
                            {creativeBusca && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCreativeBusca("")
                                    }
                                    title="Limpar pesquisa"
                                >
                                    ×
                                </button>
                            )}
                        </div>

                        <div className="creative-history-period">
                            <select
                                value={creativeMes}
                                onChange={(event) =>
                                    setCreativeMes(
                                        Number(event.target.value)
                                    )
                                }
                            >
                                <option value={0}>
                                    Todos os meses
                                </option>
                                {MESES.map((mes, index) => (
                                    <option
                                        value={index + 1}
                                        key={mes}
                                    >
                                        {mes}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={creativeAno}
                                onChange={(event) =>
                                    setCreativeAno(
                                        Number(event.target.value)
                                    )
                                }
                            >
                                {ANOS_CALENDARIO.map((ano) => (
                                    <option value={ano} key={ano}>
                                        {ano}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </section>
                )}

                {creativeTab === "producoes" && (
                    <section className="creative-panel">
                        <div className="content-section-heading">
                            <div>
                                <span>MEU FLUXO DE PRODUÇÃO</span>
                                <h2>Demandas criativas</h2>
                                <p>Anexe as artes finais e envie para aprovação quando concluir.</p>
                            </div>
                            <strong>{minhasProducoesOperacionais.length}</strong>
                        </div>

                        {!minhasProducoesOperacionais.length ? (
                            <div className="empty-state">
                                Nenhuma demanda em andamento encontrada para
                                este período.
                            </div>
                        ) : (
                            <div className="creative-job-list">
                                {minhasProducoesOperacionais.map((job) => (
                                    <article className={`creative-job-row ${creativeStatusClass(job.status)}`} key={job.id}>
                                        <div className={`creative-brand-mark ${brandClassName(job.brand)}`} />
                                        <div className="creative-job-main">
                                            <div className="creative-job-title-line">
                                                <strong>{job.title}</strong>
                                                {renderCreativeStatus(job)}
                                            </div>
                                            <span>
                                                {job.brand} • {job.creative_type} • {job.quantity} peça(s) • prazo {dataDaChave(job.deadline).toLocaleDateString("pt-BR")}
                                            </span>
                                            <small>
                                                Entregar para {job.recipient?.nickname || job.recipient?.name || job.recipient_name || "Não informado"}
                                                {job.files?.length ? ` • ${job.files.length} arquivo(s)` : " • sem arquivos"}
                                            </small>
                                            {job.manager_note && job.status === "ajuste" && (
                                                <p className="creative-manager-note">Gerência: {job.manager_note}</p>
                                            )}
                                        </div>
                                        <div className="creative-job-row-actions">
                                            {podeExcluirDemandaCriativa(job) && (
                                                <button
                                                    type="button"
                                                    className="creative-delete-job-button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        excluirDemandaCriativa(job);
                                                    }}
                                                >
                                                    Excluir
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    abrirProducaoCriativa(job)
                                                }
                                            >
                                                Abrir produção
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {creativeTab === "aprovadas" && (
                    <section className="creative-panel creative-approved-history-panel">
                        <div className="content-section-heading">
                            <div>
                                <span>HISTÓRICO DO DESIGN</span>
                                <h2>Produções aprovadas</h2>
                                <p>
                                    Demandas aprovadas pela gerência em{" "}
                                    {periodoCreativeLabel}. Use a pesquisa para
                                    encontrar uma arte pelo título.
                                </p>
                            </div>

                            <div className="creative-approved-heading-total">
                                <strong>{aprovadasHistorico.length}</strong>
                                <span>
                                    {pecasAprovadasPeriodo} peça(s)
                                </span>
                            </div>
                        </div>

                        {!aprovadasHistorico.length ? (
                            <div className="empty-state">
                                Nenhuma produção aprovada encontrada neste
                                período.
                            </div>
                        ) : (
                            <div className="creative-approved-history-list">
                                {aprovadasHistorico.map((job) => (
                                    <article
                                        className="creative-approved-history-row"
                                        key={job.id}
                                    >
                                        <div
                                            className={`creative-brand-mark ${brandClassName(
                                                job.brand
                                            )}`}
                                        />

                                        <div className="creative-approved-history-main">
                                            <div>
                                                <strong>{job.title}</strong>
                                                {renderCreativeStatus(job)}
                                            </div>

                                            <span>
                                                {job.brand} •{" "}
                                                {job.creative_type} •{" "}
                                                {job.quantity} peça(s)
                                            </span>

                                            <small>
                                                Entregue para{" "}
                                                {job.recipient?.nickname ||
                                                    job.recipient?.name ||
                                                    job.recipient_name ||
                                                    "Não informado"}{" "}
                                                • aprovado em{" "}
                                                {formatDateTime(
                                                    job.approved_at
                                                )}
                                            </small>
                                        </div>

                                        <div className="creative-approved-history-state">
                                            <span>
                                                {job.status === "aprovado"
                                                    ? "APROVADO"
                                                    : job.status ===
                                                        "finalizado"
                                                      ? "FINALIZADO"
                                                      : "ARQUIVADO"}
                                            </span>

                                            <small>
                                                {job.status === "aprovado"
                                                    ? "aguardando destinatário finalizar"
                                                    : job.status ===
                                                        "finalizado"
                                                      ? "entrega concluída"
                                                      : "histórico preservado"}
                                            </small>
                                        </div>

                                        <div className="creative-approved-history-actions">
                                            {podeExcluirDemandaCriativa(job) && (
                                                <button
                                                    type="button"
                                                    className="creative-delete-job-button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        excluirDemandaCriativa(job);
                                                    }}
                                                >
                                                    Excluir
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    abrirProducaoCriativa(
                                                        job
                                                    )
                                                }
                                            >
                                                Abrir produção
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {creativeTab === "recebidos" && (
                    <section className="creative-panel">
                        <div className="content-section-heading">
                            <div>
                                <span>PRIORIDADE DE ENTRADA</span>
                                <h2>Novas para mim</h2>
                                <p>
                                    Entregas aprovadas destinadas a você.
                                    Abra os arquivos e finalize quando concluir
                                    o uso.
                                </p>
                            </div>
                            <strong>{recebidos.length}</strong>
                        </div>

                        {!recebidos.length ? (
                            <div className="empty-state">Nenhuma arte aprovada foi entregue para você ainda.</div>
                        ) : (
                            <div className="creative-delivery-list">
                                {recebidos.map((job) => {
                                    const expanded = creativeExpandedId === job.id;
                                    return (
                                        <article className={`creative-delivery-card ${!job.recipient_read_at ? "unread" : ""}`} key={job.id}>
                                            <div className="creative-delivery-head">
                                                <div className={`creative-delivery-brand ${brandClassName(job.brand)}`}>
                                                    {job.brand}
                                                </div>
                                                <div className="creative-delivery-main">
                                                    <div>
                                                        <strong>{job.title}</strong>
                                                        {!job.recipient_read_at && <span className="new-delivery-chip">NOVA ENTREGA</span>}
                                                    </div>
                                                    <span>
                                                        {job.creative_type} • {job.quantity} peça(s) • produzido por {job.creator?.nickname || job.creator?.name || job.creator_name}
                                                    </span>
                                                    <small>Aprovado em {formatDateTime(job.approved_at)}</small>
                                                </div>
                                                <button type="button" onClick={() => abrirEntregaCriativa(job)}>
                                                    {expanded ? "Fechar" : "Ver arquivos"}
                                                </button>
                                            </div>

                                            {expanded && (
                                                <div className="creative-delivery-body">
                                                    {renderCreativeLibrary(
                                                        job.files,
                                                        {
                                                            compact: false,
                                                        }
                                                    )}

                                                    {job.files?.length > 1 && (
                                                        <button className="secondary-button compact" type="button" onClick={() => baixarTodosCriativos(job.files)}>
                                                            ↓ Baixar todos os arquivos
                                                        </button>
                                                    )}

                                                    <div className="creative-finish-delivery">
                                                        <div>
                                                            <strong>Terminou de usar esta entrega?</strong>
                                                            <span>
                                                                Ao finalizar, ela vai para Temporários por 7 dias.
                                                                Depois desse prazo, os arquivos são apagados do servidor.
                                                            </span>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => finalizarEntregaCriativa(job)}
                                                        >
                                                            ✓ Finalizar entrega
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}

                {creativeTab === "temporarios" && (
                    <section className="creative-panel creative-temporary-panel">
                        <div className="content-section-heading">
                            <div>
                                <span>RETENÇÃO TEMPORÁRIA</span>
                                <h2>Arquivos temporários</h2>
                                <p>
                                    Entregas finalizadas ficam disponíveis por 7 dias.
                                    Depois, os arquivos são apagados automaticamente do servidor.
                                </p>
                            </div>
                            <strong>{temporarios.length}</strong>
                        </div>

                        {!temporarios.length ? (
                            <div className="empty-state">
                                Nenhuma entrega temporária no momento.
                            </div>
                        ) : (
                            <div className="creative-delivery-list">
                                {temporarios.map((job) => {
                                    const expanded = creativeExpandedId === job.id;

                                    return (
                                        <article
                                            className="creative-delivery-card creative-temporary-card"
                                            key={job.id}
                                        >
                                            <div className="creative-delivery-head">
                                                <div
                                                    className={`creative-delivery-brand ${brandClassName(
                                                        job.brand
                                                    )}`}
                                                >
                                                    {job.brand}
                                                </div>

                                                <div className="creative-delivery-main">
                                                    <div>
                                                        <strong>{job.title}</strong>
                                                        <span className="temporary-delivery-chip">
                                                            TEMPORÁRIO
                                                        </span>
                                                    </div>

                                                    <span>
                                                        {job.creative_type} • {job.quantity} peça(s) •
                                                        produzido por{" "}
                                                        {job.creator?.nickname ||
                                                            job.creator?.name ||
                                                            job.creator_name}
                                                    </span>

                                                    <small>
                                                        Finalizado em{" "}
                                                        {formatDateTime(job.recipient_finished_at)}
                                                    </small>
                                                </div>

                                                <div className="creative-temporary-expiry">
                                                    <span>Arquivos serão removidos em</span>
                                                    <strong>
                                                        {tempoRestanteTemporario(
                                                            job.temporary_expires_at,
                                                            relogioLixeira
                                                        )}
                                                    </strong>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setCreativeExpandedId((atual) =>
                                                            atual === job.id ? null : job.id
                                                        )
                                                    }
                                                >
                                                    {expanded ? "Fechar" : "Ver arquivos"}
                                                </button>
                                            </div>

                                            {expanded && (
                                                <div className="creative-delivery-body">
                                                    {renderCreativeLibrary(
                                                        job.files,
                                                        {
                                                            compact: false,
                                                        }
                                                    )}

                                                    {job.files?.length > 1 && (
                                                        <button
                                                            className="secondary-button compact"
                                                            type="button"
                                                            onClick={() =>
                                                                baixarTodosCriativos(job.files)
                                                            }
                                                        >
                                                            ↓ Baixar todos os arquivos
                                                        </button>
                                                    )}

                                                    <div className="creative-temp-warning">
                                                        <strong>Última chance de download</strong>
                                                        <span>
                                                            Depois do prazo acima, os arquivos são
                                                            excluídos definitivamente. O registro da
                                                            produção continua salvo para os relatórios.
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}

                {creativeTab === "gerencia" && (
                    <section className="creative-panel manager-creative-panel">
                        <div className="content-section-heading">
                            <div>
                                <span>GERÊNCIA</span>
                                <h2>Aguardando aprovação</h2>
                                <p>
                                    Acesse diretamente as produções enviadas pelo time.
                                    O destinatário só recebe os arquivos depois da aprovação.
                                </p>
                            </div>
                            <strong>{creativeManagerJobs.length}</strong>
                        </div>

                        {!creativeManagerJobs.length ? (
                            <div className="empty-state">
                                Nenhuma produção aguardando aprovação.
                            </div>
                        ) : (
                            <div className="creative-manager-list">
                                {creativeManagerJobs.map((job) => (
                                    <article className="creative-manager-card" key={job.id}>
                                        <div
                                            className={`creative-manager-brand ${brandClassName(
                                                job.brand
                                            )}`}
                                        >
                                            {job.brand}
                                        </div>

                                        <div className="creative-manager-main">
                                            <strong>{job.title}</strong>

                                            <span>
                                                {job.quantity} peça(s) • {job.creative_type} • por{" "}
                                                {job.creator?.nickname ||
                                                    job.creator?.name ||
                                                    job.creator_name}
                                            </span>

                                            <small>
                                                Entregar para{" "}
                                                {job.recipient?.nickname ||
                                                    job.recipient?.name ||
                                                    job.recipient_name}
                                            </small>

                                            {job.briefing && <p>{job.briefing}</p>}

                                            {renderCreativeLibrary(
                                                job.files,
                                                {
                                                    compact: true,
                                                    manager: true,
                                                }
                                            )}
                                        </div>

                                        <div className="creative-manager-actions">
                                            <button
                                                type="button"
                                                className="creative-adjust-button"
                                                onClick={() =>
                                                    revisarProducaoCriativa(job, "adjust")
                                                }
                                            >
                                                Solicitar ajustes
                                            </button>

                                            <button
                                                type="button"
                                                className="creative-approve-button"
                                                onClick={() =>
                                                    revisarProducaoCriativa(job, "approve")
                                                }
                                            >
                                                Aprovar e entregar
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </>
        );
    }

    function renderLembretes() {
        return (
            <>
                <header className="section-header">
                    <div>
                        <p className="eyebrow">DATAS IMPORTANTES</p>
                        <h1>Lembretes</h1>
                        <p>
                            Datas importantes e lembretes automáticos para manter as métricas das publicações atualizadas.
                        </p>
                    </div>
                    <div className="reminder-header-actions">
                        <select value={anoLembretes} onChange={(event) => setAnoLembretes(Number(event.target.value))}>
                            {ANOS_CALENDARIO.map((ano) => (
                                <option key={ano}>{ano}</option>
                            ))}
                        </select>
                        <button
                            className="primary-button compact"
                            onClick={() => {
                                setLembreteForm({
                                    title: "",
                                    date: `${anoLembretes}-01-01`,
                                    type: "Personalizado",
                                    city: "",
                                    note: "",
                                });
                                setNovoLembreteAberto(true);
                            }}
                        >
                            + Novo lembrete
                        </button>
                    </div>
                </header>

                {lembretesHoje.length > 0 && (
                    <div className="reminders-today-panel">
                        <div className="notification-icon large">!</div>
                        <div>
                            <span>HOJE</span>
                            <h2>
                                {lembretesHoje.length === 1
                                    ? "Há uma data importante hoje"
                                    : `Há ${lembretesHoje.length} datas importantes hoje`}
                            </h2>
                            <div className="today-reminder-list">
                                {lembretesHoje.map((reminder) => (
                                    <strong key={reminder.id}>{reminder.title}</strong>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {lembretesMetricas.length > 0 && (
                    <section
                        className={`metrics-reminders-panel ${
                            lembretesMetricas.some((item) => item.nivel === "fechamento")
                                ? "closing"
                                : ""
                        }`}
                    >
                        <div className="metrics-reminders-head">
                            <div>
                                <span>MÉTRICAS DAS PUBLICAÇÕES</span>
                                <h2>
                                    {lembretesMetricas.some((item) => item.nivel === "fechamento")
                                        ? "Fechamento do mês"
                                        : "Atualizações pendentes"}
                                </h2>
                                <p>
                                    As métricas são manuais. O lembrete desaparece automaticamente
                                    quando você salva uma nova atualização.
                                </p>
                            </div>
                            <strong>{lembretesMetricas.length}</strong>
                        </div>

                        <div className="metrics-reminder-list">
                            {lembretesMetricas.map((item) => (
                                <article
                                    className={`metrics-reminder-row ${item.nivel}`}
                                    key={item.id}
                                >
                                    <div className="metrics-reminder-status">
                                        {item.nivel === "fechamento" ? "!" : "↻"}
                                    </div>

                                    <div className="metrics-reminder-main">
                                        <strong>{item.conteudo.title}</strong>
                                        <span>
                                            {item.conteudo.brands.join(" + ")} •{" "}
                                            {item.conteudo.format} • publicado em{" "}
                                            {dataDaChave(
                                                dataPublicacaoConteudo(item.conteudo)
                                            ).toLocaleDateString("pt-BR")}
                                        </span>
                                        <p>{item.motivo}</p>
                                    </div>

                                    <div className="metrics-reminder-last">
                                        <span>Última atualização</span>
                                        <strong>
                                            {item.last_update
                                                ? formatDateTime(item.last_update)
                                                : "Nunca"}
                                        </strong>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => abrirConteudo(item.conteudo)}
                                    >
                                        Atualizar agora
                                    </button>
                                </article>
                            ))}
                        </div>
                    </section>
                )}

                <div className="reminder-summary">
                    <div>
                        <span>Datas automáticas</span>
                        <strong>{lembretesAno.filter((item) => item.system).length}</strong>
                    </div>
                    <div>
                        <span>Feriados nacionais</span>
                        <strong>{lembretesAno.filter((item) => item.type.includes("Feriado")).length}</strong>
                    </div>
                    <div>
                        <span>Aniversários de cidades</span>
                        <strong>{lembretesAno.filter((item) => item.type === "Aniversário de cidade").length}</strong>
                    </div>
                    <div>
                        <span>Personalizados</span>
                        <strong>{lembretesAno.filter((item) => !item.system).length}</strong>
                    </div>
                    <div className={lembretesMetricas.length ? "summary-alert" : ""}>
                        <span>Métricas pendentes</span>
                        <strong>{lembretesMetricas.length}</strong>
                    </div>
                </div>

                <div className="reminders-months">
                    {lembretesPorMes.map((grupo) => (
                        <section className="reminder-month" key={grupo.mes}>
                            <div className="reminder-month-title">
                                <h2>{grupo.mes}</h2>
                                <span>{grupo.itens.length} data(s)</span>
                            </div>
                            <div className="reminder-grid">
                                {grupo.itens.map((reminder) => (
                                    <article
                                        className={`reminder-card ${
                                            reminder.type === "Aniversário de cidade"
                                                ? "city"
                                                : reminder.type === "Personalizado"
                                                ? "custom"
                                                : "holiday"
                                        }`}
                                        key={reminder.id}
                                    >
                                        <div className="reminder-date-box">
                                            <strong>{reminder.date.slice(8, 10)}</strong>
                                            <span>{MESES[Number(reminder.date.slice(5, 7)) - 1].slice(0, 3)}</span>
                                        </div>
                                        <div className="reminder-content">
                                            <div className="reminder-tags">
                                                <span>{reminder.type}</span>
                                                {reminder.system && <small>Automático</small>}
                                            </div>
                                            <h3>{reminder.title}</h3>
                                            {reminder.city && <p>{reminder.city}</p>}
                                            {reminder.note && <p>{reminder.note}</p>}
                                            {!reminder.system && (
                                                <button
                                                    className="remove-reminder-button"
                                                    onClick={() => removerLembrete(reminder)}
                                                >
                                                    Excluir lembrete
                                                </button>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </>
        );
    }

    function renderAprovacoesGerente() {
        const socialPending = managerApprovals.contents || [];
        const ideaPending = socialPending.filter(
            (content) => content.approval_stage === "idea"
        );
        const finalPending = socialPending.filter(
            (content) => content.approval_stage === "final"
        );
        const creativePending = managerApprovals.creative || [];

        const approvedContents =
            managerApprovals.approved_contents || [];
        const approvedCreative =
            managerApprovals.approved_creative || [];

        const completedContents =
            managerApprovals.completed_contents || [];
        const completedCreative =
            managerApprovals.completed_creative || [];

        const report = managerApprovals.report || {};
        const reportSummary = report.summary || {};
        const reportByBrand = report.by_brand || [];
        const reportByCollaborator = report.by_collaborator || [];

        const pendingTotal = Number(managerApprovals.total || 0);
        const approvedTotal = Number(
            managerApprovals.approved_total || 0
        );
        const completedTotal = Number(
            managerApprovals.completed_total || 0
        );

        const periodLabel =
            Number(managerReportMonth) === 0
                ? `Ano de ${managerReportYear}`
                : `${MESES[Number(managerReportMonth) - 1]} de ${managerReportYear}`;

        const openContentDetails = (content, stage = "final") => {
            setManagerDetailContent({
                ...content,
                manager_view_stage: stage,
            });
        };

        const renderPendingSocialSection = (
            stage,
            items,
            eyebrow,
            title,
            description
        ) => (
            <section
                className={`manager-approval-section ${
                    stage === "final" ? "final-approval-section" : ""
                }`}
            >
                <div className="content-section-heading">
                    <div>
                        <span>{eyebrow}</span>
                        <h2>{title}</h2>
                        <p>{description}</p>
                    </div>
                    <strong>{items.length}</strong>
                </div>

                {!items.length ? (
                    <div className="empty-state manager-empty-state">
                        {stage === "idea"
                            ? "Nenhuma ideia aguardando aprovação."
                            : "Nenhum conteúdo final aguardando aprovação."}
                    </div>
                ) : (
                    <div className="manager-social-approval-list">
                        {items.map((content) => (
                            <article
                                className={`manager-social-card manager-stage-${stage}`}
                                key={`${stage}-${content.id}`}
                            >
                                <div className="manager-social-top">
                                    <Avatar
                                        user={
                                            content.owner || {
                                                name:
                                                    content.responsible ||
                                                    "Equipe",
                                            }
                                        }
                                        size="medium"
                                    />

                                    <div className="manager-social-title">
                                        <span>
                                            {content.owner?.nickname ||
                                                content.owner?.name ||
                                                content.responsible ||
                                                "Equipe"}
                                        </span>
                                        <h3>{content.title}</h3>
                                        <div>
                                            <b
                                                className={`approval-stage-badge stage-${stage}`}
                                            >
                                                {stage === "idea"
                                                    ? "IDEIA PARA APROVAÇÃO"
                                                    : "CONTEÚDO FINAL"}
                                            </b>

                                            {content.brands?.map((brand) => (
                                                <b
                                                    key={brand}
                                                    className={`brand-badge ${brandClassName(
                                                        brand
                                                    )}`}
                                                >
                                                    {brand}
                                                </b>
                                            ))}

                                            <small>{content.format}</small>
                                            <small>
                                                {dataDaChave(
                                                    content.date
                                                ).toLocaleDateString("pt-BR")}
                                            </small>
                                        </div>
                                    </div>

                                    <span
                                        className={`manager-urgency urgency-${content.urgency}`}
                                    >
                                        {nomeUrgencia(content.urgency)}
                                    </span>
                                </div>

                                <div className="manager-social-preview">
                                    <div>
                                        <span>
                                            {stage === "idea"
                                                ? "O QUE ESTÁ SENDO APROVADO"
                                                : "RESUMO DO CONTEÚDO FINAL"}
                                        </span>
                                        <p>
                                            {stage === "idea"
                                                ? content.description ||
                                                  content.copy_text ||
                                                  "Ideia sem briefing preenchido."
                                                : content.copy_text ||
                                                  content.description ||
                                                  "Conteúdo final sem descrição adicional."}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        className="manager-details-button"
                                        onClick={() =>
                                            openContentDetails(
                                                content,
                                                stage
                                            )
                                        }
                                    >
                                        Ver detalhes
                                    </button>
                                </div>

                                {stage === "final" && (
                                    <div className="manager-files-summary">
                                        <span>ARQUIVO FINAL</span>
                                        <strong>
                                            {content.files?.length === 1
                                                ? "1 arquivo anexado"
                                                : `${
                                                      content.files?.length ||
                                                      0
                                                  } arquivos anexados`}
                                        </strong>
                                        <small>
                                            Abra Detalhes para visualizar o
                                            material pronto.
                                        </small>
                                    </div>
                                )}

                                <div className="manager-approval-actions">
                                    <button
                                        type="button"
                                        className="manager-details-button action-details"
                                        onClick={() =>
                                            openContentDetails(
                                                content,
                                                stage
                                            )
                                        }
                                    >
                                        Detalhes
                                    </button>

                                    <button
                                        type="button"
                                        className="approve-button"
                                        onClick={() =>
                                            aprovarConteudo(
                                                content.id,
                                                stage
                                            )
                                        }
                                    >
                                        {stage === "idea"
                                            ? "✓ Aprovar ideia"
                                            : "✓ Aprovar conteúdo final"}
                                    </button>

                                    <button
                                        type="button"
                                        className="reject-button"
                                        onClick={() =>
                                            recusarConteudo(
                                                content.id,
                                                stage
                                            )
                                        }
                                    >
                                        ✕ Recusar
                                    </button>

                                    <button
                                        type="button"
                                        className="review-button"
                                        onClick={() =>
                                            abrirRevisao(
                                                content.id,
                                                stage
                                            )
                                        }
                                    >
                                        ↻ Revisar
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        );

        const renderApprovedContentCard = (content) => (
            <article
                className="manager-approved-card manager-ready-to-publish-card"
                key={`ready-${content.id}`}
            >
                <div className="manager-approved-card-main">
                    <Avatar
                        user={
                            content.owner || {
                                name: content.responsible || "Equipe",
                            }
                        }
                        size="medium"
                    />

                    <div>
                        <span>
                            {content.owner?.nickname ||
                                content.owner?.name ||
                                content.responsible ||
                                "Equipe"}
                        </span>
                        <h3>{content.title}</h3>

                        <div className="manager-approved-meta">
                            <b className="approval-stage-badge stage-final">
                                FINAL APROVADO
                            </b>
                            <b>{content.brands?.join(" + ")}</b>
                            <small>{content.format}</small>
                            <small>
                                {content.status === "Agendado"
                                    ? "AGENDADO"
                                    : "AGUARDANDO PUBLICAÇÃO"}
                            </small>
                            <small>
                                Aprovado em{" "}
                                {formatDateTime(
                                    content.approved_at ||
                                        content.updated_at
                                )}
                            </small>
                        </div>
                    </div>

                    <div className="manager-approved-state ready-state">
                        <strong>✓ LIBERADO</strong>
                        <small>
                            {content.status === "Agendado"
                                ? "Aguardando ir ao ar"
                                : "Social Media precisa publicar"}
                        </small>
                    </div>
                </div>

                <div className="manager-approved-actions">
                    <button
                        type="button"
                        className="manager-details-button"
                        onClick={() =>
                            openContentDetails(content, "final")
                        }
                    >
                        Detalhes
                    </button>

                    <button
                        type="button"
                        className="undo-approval-button"
                        onClick={() =>
                            desfazerAprovacaoConteudo(
                                content,
                                "final"
                            )
                        }
                    >
                        ↶ Desfazer aprovação final
                    </button>
                </div>
            </article>
        );

        const renderCompletedContentCard = (content) => (
            <article
                className="manager-approved-card manager-completed-card"
                key={`completed-${content.id}`}
            >
                <div className="manager-approved-card-main">
                    <Avatar
                        user={
                            content.owner || {
                                name: content.responsible || "Equipe",
                            }
                        }
                        size="medium"
                    />

                    <div>
                        <span>
                            {content.publisher?.nickname ||
                                content.publisher?.name ||
                                content.owner?.nickname ||
                                content.responsible ||
                                "Equipe"}
                        </span>
                        <h3>{content.title}</h3>

                        <div className="manager-approved-meta">
                            <b className="manager-live-chip">
                                ● NO AR
                            </b>
                            <b>{content.brands?.join(" + ")}</b>
                            <small>{content.format}</small>
                            <small>
                                Publicado em{" "}
                                {formatDateTime(
                                    content.published_at
                                )}
                            </small>
                        </div>
                    </div>

                    <div className="manager-approved-state completed-state">
                        <strong>✓ CONCLUÍDO</strong>
                        <small>Fluxo de Social Media encerrado</small>
                    </div>
                </div>

                <div className="manager-approved-actions">
                    <button
                        type="button"
                        className="manager-details-button"
                        onClick={() =>
                            openContentDetails(content, "final")
                        }
                    >
                        Detalhes
                    </button>
                </div>
            </article>
        );

        const renderDesignCard = (job, mode) => {
            const completed = mode === "completed";
            const approved = mode === "approved";

            return (
                <article
                    className={`manager-design-card ${
                        completed
                            ? "manager-completed-design-card"
                            : approved
                              ? "manager-approved-design-card"
                              : ""
                    }`}
                    key={`${mode}-${job.id}`}
                >
                    <div className="manager-design-top">
                        <div
                            className={`creative-manager-brand ${brandClassName(
                                job.brand
                            )}`}
                        >
                            {job.brand}
                        </div>

                        <div>
                            <h3>{job.title}</h3>
                            <span>
                                {job.quantity} peça(s) •{" "}
                                {job.creative_type} • por{" "}
                                {job.creator?.nickname ||
                                    job.creator?.name ||
                                    job.creator_name}
                            </span>
                            <small>
                                Entregar para{" "}
                                {job.recipient?.nickname ||
                                    job.recipient?.name ||
                                    job.recipient_name}
                            </small>

                            {approved && (
                                <small>
                                    Aprovado em{" "}
                                    {formatDateTime(job.approved_at)}
                                </small>
                            )}

                            {completed && (
                                <small>
                                    Finalizado em{" "}
                                    {formatDateTime(
                                        job.recipient_finished_at ||
                                            job.files_purged_at ||
                                            job.approved_at
                                    )}
                                </small>
                            )}
                        </div>

                        {(approved || completed) && (
                            <div
                                className={`manager-approved-state ${
                                    completed
                                        ? "completed-state"
                                        : "ready-state"
                                }`}
                            >
                                <strong>
                                    {completed
                                        ? "✓ CONCLUÍDO"
                                        : "✓ APROVADO"}
                                </strong>
                                <small>
                                    {completed
                                        ? job.status === "arquivado"
                                            ? "Arquivos temporários expirados"
                                            : "Finalizado pelo destinatário"
                                        : "Aguardando conclusão da entrega"}
                                </small>
                            </div>
                        )}
                    </div>

                    {job.briefing && (
                        <div className="manager-design-briefing">
                            <span>BRIEFING / OBSERVAÇÕES</span>
                            <p>{job.briefing}</p>
                        </div>
                    )}

                    {job.files?.length > 0 &&
                        renderCreativeLibrary(job.files, {
                            compact: true,
                            manager: true,
                        })}

                    {!completed && (
                        <div className="manager-approved-actions">
                            {approved ? (
                                <button
                                    type="button"
                                    className="undo-approval-button"
                                    onClick={() =>
                                        desfazerAprovacaoCriativa(job)
                                    }
                                >
                                    ↶ Desfazer aprovação
                                </button>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        className="review-button"
                                        onClick={() =>
                                            revisarProducaoCriativa(
                                                job,
                                                "adjust"
                                            )
                                        }
                                    >
                                        Solicitar ajustes
                                    </button>
                                    <button
                                        type="button"
                                        className="approve-button"
                                        onClick={() =>
                                            revisarProducaoCriativa(
                                                job,
                                                "approve"
                                            )
                                        }
                                    >
                                        ✓ Aprovar e entregar
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </article>
            );
        };

        return (
            <>
                <header className="section-header manager-approval-header">
                    <div>
                        <p className="eyebrow">PAINEL GERENCIAL</p>
                        <h1>Solicitações de aprovação</h1>
                        <p>
                            Acompanhe o que precisa de decisão, o que já foi
                            liberado para a equipe e o que já foi concluído.
                        </p>
                    </div>

                    <div className="manager-approval-header-controls">
                        <div className="manager-period-selectors">
                            <select
                                value={managerReportMonth}
                                onChange={(event) =>
                                    setManagerReportMonth(
                                        Number(event.target.value)
                                    )
                                }
                            >
                                <option value={0}>Ano inteiro</option>
                                {MESES.map((mes, index) => (
                                    <option
                                        key={mes}
                                        value={index + 1}
                                    >
                                        {mes}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={managerReportYear}
                                onChange={(event) =>
                                    setManagerReportYear(
                                        Number(event.target.value)
                                    )
                                }
                            >
                                {ANOS_CALENDARIO.map((ano) => (
                                    <option key={ano} value={ano}>
                                        {ano}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="button"
                            className="secondary-button manager-refresh-button"
                            onClick={() =>
                                carregarAprovacoesGerente(
                                    usuarioSelecionado.id
                                )
                            }
                        >
                            ↻ Atualizar
                        </button>
                    </div>
                </header>

                <div className="manager-approval-tabs three-tabs">
                    <button
                        type="button"
                        className={
                            managerApprovalTab === "pendentes"
                                ? "active"
                                : ""
                        }
                        onClick={() =>
                            setManagerApprovalTab("pendentes")
                        }
                    >
                        <span>Pendentes</span>
                        <b>{pendingTotal}</b>
                    </button>

                    <button
                        type="button"
                        className={
                            managerApprovalTab === "aprovados"
                                ? "active approved"
                                : ""
                        }
                        onClick={() =>
                            setManagerApprovalTab("aprovados")
                        }
                    >
                        <span>Aprovados</span>
                        <b>{approvedTotal}</b>
                    </button>

                    <button
                        type="button"
                        className={
                            managerApprovalTab === "concluidos"
                                ? "active completed"
                                : ""
                        }
                        onClick={() =>
                            setManagerApprovalTab("concluidos")
                        }
                    >
                        <span>Concluídos</span>
                        <b>{completedTotal}</b>
                    </button>
                </div>

                <section className="manager-period-report">
                    <div className="manager-period-report-heading">
                        <div>
                            <span>RESUMO GERENCIAL DO PERÍODO</span>
                            <h2>{periodLabel}</h2>
                            <p>
                                As aprovações são contabilizadas pela data em
                                que o gerente tomou a decisão.
                            </p>
                        </div>
                    </div>

                    <div className="manager-period-kpis">
                        <div className="manager-period-kpi primary">
                            <span>DECISÕES APROVADAS</span>
                            <strong>
                                {formatNumber(
                                    reportSummary.total_approved
                                )}
                            </strong>
                            <small>total no período</small>
                        </div>

                        <div className="manager-period-kpi">
                            <span>IDEIAS APROVADAS</span>
                            <strong>
                                {formatNumber(
                                    reportSummary.idea_approved
                                )}
                            </strong>
                            <small>Social Media • etapa 01</small>
                        </div>

                        <div className="manager-period-kpi">
                            <span>FINAIS APROVADOS</span>
                            <strong>
                                {formatNumber(
                                    reportSummary.final_approved
                                )}
                            </strong>
                            <small>Social Media • etapa 02</small>
                        </div>

                        <div className="manager-period-kpi">
                            <span>DESIGN APROVADO</span>
                            <strong>
                                {formatNumber(
                                    reportSummary.design_approved
                                )}
                            </strong>
                            <small>demandas criativas</small>
                        </div>

                        <div className="manager-period-kpi review">
                            <span>REVISÕES SOLICITADAS</span>
                            <strong>
                                {formatNumber(
                                    reportSummary.revisions_requested
                                )}
                            </strong>
                            <small>ajustes pedidos pela gerência</small>
                        </div>
                    </div>

                    {(reportByBrand.length > 0 ||
                        reportByCollaborator.length > 0) && (
                        <details className="manager-period-breakdown">
                            <summary>
                                Ver detalhamento por marca e colaborador
                            </summary>

                            <div className="manager-period-breakdown-grid">
                                <div>
                                    <span>POR MARCA</span>
                                    <h3>Decisões aprovadas</h3>

                                    <div className="manager-period-ranking">
                                        {reportByBrand.map((item) => (
                                            <div key={item.name}>
                                                <b
                                                    className={`manager-brand-dot ${brandClassName(
                                                        item.name
                                                    )}`}
                                                />
                                                <strong>{item.name}</strong>
                                                <span>
                                                    {item.total} aprovações
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <span>POR COLABORADOR</span>
                                    <h3>Demandas aprovadas</h3>

                                    <div className="manager-period-ranking">
                                        {reportByCollaborator.map(
                                            (item) => (
                                                <div key={item.name}>
                                                    <Avatar
                                                        user={item.user}
                                                        size="small"
                                                    />
                                                    <strong>
                                                        {item.user
                                                            ?.nickname ||
                                                            item.name}
                                                    </strong>
                                                    <span>
                                                        {item.total} aprovações
                                                    </span>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        </details>
                    )}
                </section>

                {managerApprovalsLoading && (
                    <div className="manager-approval-loading-line">
                        Atualizando painel...
                    </div>
                )}

                {managerApprovalTab === "pendentes" && (
                    <>
                        <section className="manager-approval-summary four-cards">
                            <div className="manager-total-card">
                                <span>TOTAL AGUARDANDO</span>
                                <strong>{pendingTotal}</strong>
                                <small>decisões pendentes agora</small>
                            </div>

                            <div>
                                <span>IDEIAS</span>
                                <strong>{ideaPending.length}</strong>
                                <small>roteiros / conceitos</small>
                            </div>

                            <div>
                                <span>CONTEÚDOS FINAIS</span>
                                <strong>{finalPending.length}</strong>
                                <small>arquivos prontos</small>
                            </div>

                            <div>
                                <span>DESIGN</span>
                                <strong>{creativePending.length}</strong>
                                <small>artes para aprovação</small>
                            </div>
                        </section>

                        {pendingTotal > 0 && (
                            <div className="manager-pending-banner">
                                <div className="manager-pending-pulse" />
                                <div>
                                    <strong>
                                        {pendingTotal === 1
                                            ? "Você tem 1 decisão para analisar"
                                            : `Você tem ${pendingTotal} decisões para analisar`}
                                    </strong>
                                    <span>
                                        Esta aba mostra somente itens que ainda
                                        precisam da sua decisão.
                                    </span>
                                </div>
                            </div>
                        )}

                        {renderPendingSocialSection(
                            "idea",
                            ideaPending,
                            "SOCIAL MEDIA • ETAPA 01",
                            "Ideias para aprovação",
                            "Briefing, roteiro, conceito e direção antes da produção."
                        )}

                        {renderPendingSocialSection(
                            "final",
                            finalPending,
                            "SOCIAL MEDIA • ETAPA 02",
                            "Conteúdos finais para aprovação",
                            "Material já gravado/editado e com arquivo final pronto."
                        )}

                        <section className="manager-approval-section manager-design-section">
                            <div className="content-section-heading">
                                <div>
                                    <span>DESIGN</span>
                                    <h2>Artes aguardando aprovação</h2>
                                    <p>
                                        Somente produções que ainda precisam de
                                        decisão.
                                    </p>
                                </div>
                                <strong>{creativePending.length}</strong>
                            </div>

                            {!creativePending.length ? (
                                <div className="empty-state manager-empty-state">
                                    Nenhuma produção do Design aguardando
                                    aprovação.
                                </div>
                            ) : (
                                <div className="manager-design-approval-list">
                                    {creativePending.map((job) =>
                                        renderDesignCard(job, "pending")
                                    )}
                                </div>
                            )}
                        </section>
                    </>
                )}

                {managerApprovalTab === "aprovados" && (
                    <>
                        <section className="manager-approval-summary manager-approved-summary">
                            <div className="manager-approved-total-card">
                                <span>AGUARDANDO A EQUIPE</span>
                                <strong>{approvedTotal}</strong>
                                <small>itens já liberados</small>
                            </div>

                            <div>
                                <span>SOCIAL MEDIA</span>
                                <strong>{approvedContents.length}</strong>
                                <small>aguardando publicação</small>
                            </div>

                            <div>
                                <span>DESIGN</span>
                                <strong>{approvedCreative.length}</strong>
                                <small>aguardando conclusão</small>
                            </div>
                        </section>

                        <div className="manager-approved-banner operational-approved-banner">
                            <div>✓</div>
                            <div>
                                <strong>
                                    Aprovados agora significa: decisão concluída,
                                    ação da equipe pendente
                                </strong>
                                <span>
                                    Quando o Social Media marcar NO AR ou o
                                    destinatário finalizar o Design, o item sai
                                    daqui automaticamente e vai para Concluídos.
                                </span>
                            </div>
                        </div>

                        <section className="manager-approval-section approved-history-section">
                            <div className="content-section-heading">
                                <div>
                                    <span>SOCIAL MEDIA</span>
                                    <h2>Aguardando publicação</h2>
                                    <p>
                                        Conteúdos finais aprovados pelo gerente,
                                        mas que ainda não foram marcados como NO
                                        AR.
                                    </p>
                                </div>
                                <strong>{approvedContents.length}</strong>
                            </div>

                            {!approvedContents.length ? (
                                <div className="empty-state manager-empty-state">
                                    Nenhum conteúdo aguardando publicação.
                                </div>
                            ) : (
                                <div className="manager-approved-list">
                                    {approvedContents.map(
                                        renderApprovedContentCard
                                    )}
                                </div>
                            )}
                        </section>

                        <section className="manager-approval-section manager-design-section approved-history-section">
                            <div className="content-section-heading">
                                <div>
                                    <span>DESIGN</span>
                                    <h2>Aguardando conclusão da entrega</h2>
                                    <p>
                                        Produções aprovadas e entregues, mas que
                                        o destinatário ainda não finalizou.
                                    </p>
                                </div>
                                <strong>{approvedCreative.length}</strong>
                            </div>

                            {!approvedCreative.length ? (
                                <div className="empty-state manager-empty-state">
                                    Nenhuma produção aprovada aguardando
                                    conclusão.
                                </div>
                            ) : (
                                <div className="manager-design-approval-list">
                                    {approvedCreative.map((job) =>
                                        renderDesignCard(job, "approved")
                                    )}
                                </div>
                            )}
                        </section>
                    </>
                )}

                {managerApprovalTab === "concluidos" && (
                    <>
                        <section className="manager-approval-summary manager-completed-summary">
                            <div className="manager-completed-total-card">
                                <span>CONCLUÍDOS NO PERÍODO</span>
                                <strong>{completedTotal}</strong>
                                <small>{periodLabel}</small>
                            </div>

                            <div>
                                <span>SOCIAL MEDIA</span>
                                <strong>{completedContents.length}</strong>
                                <small>conteúdos NO AR</small>
                            </div>

                            <div>
                                <span>DESIGN</span>
                                <strong>{completedCreative.length}</strong>
                                <small>entregas finalizadas</small>
                            </div>
                        </section>

                        <div className="manager-completed-banner">
                            <div>✓</div>
                            <div>
                                <strong>Fluxos encerrados</strong>
                                <span>
                                    Aqui ficam somente itens já publicados ou
                                    entregas de Design já finalizadas, respeitando
                                    o mês/ano selecionado acima.
                                </span>
                            </div>
                        </div>

                        <section className="manager-approval-section completed-history-section">
                            <div className="content-section-heading">
                                <div>
                                    <span>SOCIAL MEDIA</span>
                                    <h2>Já estão no ar</h2>
                                    <p>
                                        Conteúdos cujo fluxo já foi concluído
                                        pela publicação.
                                    </p>
                                </div>
                                <strong>{completedContents.length}</strong>
                            </div>

                            {!completedContents.length ? (
                                <div className="empty-state manager-empty-state">
                                    Nenhum conteúdo foi marcado como NO AR neste
                                    período.
                                </div>
                            ) : (
                                <div className="manager-approved-list">
                                    {completedContents.map(
                                        renderCompletedContentCard
                                    )}
                                </div>
                            )}
                        </section>

                        <section className="manager-approval-section manager-design-section completed-history-section">
                            <div className="content-section-heading">
                                <div>
                                    <span>DESIGN</span>
                                    <h2>Entregas concluídas</h2>
                                    <p>
                                        Produções finalizadas pelo destinatário
                                        ou já arquivadas após o prazo temporário.
                                    </p>
                                </div>
                                <strong>{completedCreative.length}</strong>
                            </div>

                            {!completedCreative.length ? (
                                <div className="empty-state manager-empty-state">
                                    Nenhuma entrega de Design concluída neste
                                    período.
                                </div>
                            ) : (
                                <div className="manager-design-approval-list">
                                    {completedCreative.map((job) =>
                                        renderDesignCard(job, "completed")
                                    )}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </>
        );
    }

    function renderRelatorios() {
        const summary = relatorio?.summary || {};
        const comparison = relatorio?.comparison || {};
        const ranking = relatorio?.ranking || [];
        const creativeReport = relatorio?.creative || {
            summary: { demands: 0, pieces: 0, creators: 0, avg_days: 0 },
            by_brand: [],
            by_creator: [],
            by_type: [],
        };

        const managerRequestsReport = relatorio?.manager_requests || {
            summary: {
                total: 0,
                active: 0,
                approved: 0,
                forwarded: 0,
                completed: 0,
                in_review: 0,
                rejected: 0,
                cancelled: 0,
                completion_rate: 0,
                forward_rate: 0,
                avg_completion_days: 0,
                avg_forward_days: 0,
            },
            comparison: { total: 0 },
            highlights: {
                top_requester: null,
                top_brand: null,
                top_type: null,
            },
            by_requester: [],
            by_brand: [],
            by_type: [],
            by_priority: [],
            by_destination: [],
            by_status: [],
            yearly: [],
        };

        const managerRequestYearly = managerRequestsReport.yearly || [];
        const maxManagerRequests = Math.max(
            1,
            ...managerRequestYearly.map((item) => Number(item.requests || 0))
        );

        const brandPodiums = MARCAS.map((brand) => ({
            brand,
            contents: ranking.filter((item) => item.brands?.includes(brand)).slice(0, 3),
        }));

        const byBrandViews = [...(relatorio?.by_brand || [])]
            .filter((item) => Number(item.views || 0) > 0)
            .sort((a, b) => Number(b.views || 0) - Number(a.views || 0));

        const totalBrandViews = byBrandViews.reduce(
            (total, item) => total + Number(item.views || 0),
            0
        );

        const brandPieColors = {
            Jeep: "#2f6b45",
            RAM: "#7a4f2f",
            Kia: "#7c818a",
            Honda: "#bf2e2e",
            "Premier Seminovos": "#d9d9d9",
            Shineray: "#d84b4b",
            YADEA: "#df8b2d",
            Squad: "#c9a35e",
        };

        let pieCursor = 0;
        const brandPieSegments = byBrandViews.map((item, index) => {
            const percentage = totalBrandViews > 0 ? (Number(item.views || 0) / totalBrandViews) * 100 : 0;
            const start = pieCursor;
            pieCursor += percentage;
            return {
                ...item,
                percentage,
                start,
                end: pieCursor,
                color:
                    brandPieColors[item.name] ||
                    ["#c9a35e", "#6384df", "#4da06b", "#df765d", "#9b73df", "#cf5d80"][index % 6],
            };
        });

        const brandPieBackground = brandPieSegments.length
            ? `conic-gradient(${brandPieSegments
                  .map((item) => `${item.color} ${item.start.toFixed(2)}% ${item.end.toFixed(2)}%`)
                  .join(", ")})`
            : "conic-gradient(#2a323e 0% 100%)";

        const topBrandViews = brandPieSegments[0] || null;

        const yearly = relatorio?.yearly || [];
        const hasYearViews = yearly.some((item) => Number(item.views || 0) > 0);
        const maxYearMetric = Math.max(
            1,
            ...yearly.map((item) => Number(hasYearViews ? item.views || 0 : item.interactions || 0))
        );

        return (
            <>
                <header className="section-header report-main-header">
                    <div>
                        <p className="eyebrow">GESTÃO DE MARKETING</p>
                        <h1>Relatório mensal</h1>
                        <p>O painel está separado em três leituras: Social Media, Design e Pedidos de Gerentes.</p>
                    </div>
                    <div className="report-header-right">
                        <div className="report-selectors">
                            <select value={relatorioMes} onChange={(event) => setRelatorioMes(Number(event.target.value))}>
                                {MESES.map((mes, index) => (
                                    <option key={mes} value={index + 1}>
                                        {mes}
                                    </option>
                                ))}
                            </select>
                            <select value={relatorioAno} onChange={(event) => setRelatorioAno(Number(event.target.value))}>
                                {ANOS_CALENDARIO.map((ano) => (
                                    <option key={ano}>{ano}</option>
                                ))}
                            </select>
                        </div>
                        <div className="report-action-buttons">
                            <button className="secondary-button" onClick={() => carregarRelatorio()}>
                                Atualizar relatório
                            </button>
                        </div>
                    </div>
                </header>

                <div className="report-split-tabs">
                    <button
                        className={relatorioAba === "social" ? "active" : ""}
                        onClick={() => setRelatorioAba("social")}
                    >
                        Social Media
                    </button>
                    <button
                        className={relatorioAba === "design" ? "active" : ""}
                        onClick={() => setRelatorioAba("design")}
                    >
                        Design
                    </button>
                    <button
                        className={relatorioAba === "gerentes" ? "active" : ""}
                        onClick={() => setRelatorioAba("gerentes")}
                    >
                        Pedidos de Gerentes
                    </button>
                </div>

                {relatorioErro && <div className="server-error">{relatorioErro}</div>}
                {relatorioCarregando && !relatorio && <div className="report-loading">Carregando relatório...</div>}

                {relatorio && (
                    <>
                        {relatorioAba === "social" && (
                            <>
                                <div className={`meta-status ${relatorio.meta?.public_mode || relatorio.meta?.configured ? "connected" : "waiting"}`}>
                                    <div className="meta-status-dot" />
                                    <div>
                                        <strong>Métricas manuais do SQUAD</strong>
                                        <span>{relatorio.meta?.message}</span>
                                    </div>
                                    <small>Leitura do painel: {formatDateTime(ultimaLeituraRelatorio)}</small>
                                </div>

                                <section className="executive-kpis">
                                    <div className="executive-kpi main-kpi">
                                        <span>CONTEÚDOS PUBLICADOS</span>
                                        <strong>{formatNumber(summary.published)}</strong>
                                        <small className={Number(comparison.published) >= 0 ? "up" : "down"}>
                                            {comparisonText(comparison.published)} vs. mês anterior
                                        </small>
                                    </div>

                                    <div className="executive-kpi stories-kpi">
                                        <span>STORIES PUBLICADOS</span>
                                        <strong>
                                            {formatNumber(summary.storiesPublished)}
                                        </strong>
                                        <small>apenas quantidade • sem métricas</small>
                                    </div>

                                    <div className="executive-kpi">
                                        <span>VISUALIZAÇÕES</span>
                                        <strong>{formatNumber(summary.views)}</strong>
                                        <small className={Number(comparison.views) >= 0 ? "up" : "down"}>
                                            {comparisonText(comparison.views)} vs. mês anterior
                                        </small>
                                    </div>

                                    <div className="executive-kpi">
                                        <span>CURTIDAS</span>
                                        <strong>{formatNumber(summary.likes)}</strong>
                                        <small className={Number(comparison.likes) >= 0 ? "up" : "down"}>
                                            {comparisonText(comparison.likes)} vs. mês anterior
                                        </small>
                                    </div>

                                    <div className="executive-kpi">
                                        <span>COMPARTILHAMENTOS</span>
                                        <strong>{formatNumber(summary.shares)}</strong>
                                        <small className={Number(comparison.shares) >= 0 ? "up" : "down"}>
                                            {comparisonText(comparison.shares)} vs. mês anterior
                                        </small>
                                    </div>

                                    <div className="executive-kpi">
                                        <span>COBERTURA DE MÉTRICAS</span>
                                        <strong>{formatPercent(summary.metricsCoverage, 1)}</strong>
                                        <small>publicações com dados de performance</small>
                                    </div>
                                </section>

                                <section className="attention-section">
                                    <div className="report-section-title">
                                        <div>
                                            <span>ONDE OLHAR PRIMEIRO</span>
                                            <h2>Pontos de atenção</h2>
                                        </div>
                                    </div>
                                    <div className="attention-grid">
                                        {(relatorio.attention || []).map((item, index) => (
                                            <article className={`attention-card attention-${item.level}`} key={`${item.title}-${index}`}>
                                                <div className="attention-symbol">
                                                    {item.level === "ok" ? "✓" : item.level === "high" ? "!" : "•"}
                                                </div>
                                                <div>
                                                    <strong>{item.title}</strong>
                                                    <p>{item.description}</p>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </section>

                                <section className="report-highlights">
                                    <PerformanceHighlight
                                        label="MAIS VISTO"
                                        content={relatorio.highlights?.top_views}
                                        value={
                                            relatorio.highlights?.top_views
                                                ? `${formatNumber(relatorio.highlights.top_views.metric_views)} visualizações`
                                                : "Sem dados"
                                        }
                                    />

                                    <PerformanceHighlight
                                        label="MAIS CURTIDO"
                                        content={relatorio.highlights?.top_likes}
                                        value={
                                            relatorio.highlights?.top_likes
                                                ? `${formatNumber(relatorio.highlights.top_likes.metric_likes)} curtidas`
                                                : "Sem dados"
                                        }
                                    />

                                    <PerformanceHighlight
                                        label="MAIS COMPARTILHADO"
                                        content={relatorio.highlights?.top_shares}
                                        value={
                                            relatorio.highlights?.top_shares
                                                ? `${formatNumber(relatorio.highlights.top_shares.metric_shares)} compartilhamentos`
                                                : "Sem dados"
                                        }
                                    />
                                </section>

                                <section className="brand-podium-section">
                                    <div className="report-section-title">
                                        <div>
                                            <span>CAMPEÕES DO MÊS</span>
                                            <h2>Top 3 de cada marca</h2>
                                        </div>
                                        <p>
                                            As três melhores publicações de cada marca no período,
                                            ordenadas pelo Índice SQUAD.
                                        </p>
                                    </div>

                                    <div className="brand-podium-grid">
                                        {brandPodiums.map(({ brand, contents }) => (
                                            <article className={`brand-podium-card ${contents.length ? "has-winner" : "no-winner"}`} key={brand}>
                                                <div className="brand-podium-header">
                                                    <div>
                                                        <span>MARCA</span>
                                                        <h3>{brand}</h3>
                                                    </div>
                                                    <div className="brand-podium-crown">★</div>
                                                </div>

                                                {contents.length ? (
                                                    <div className="brand-podium-list">
                                                        {contents.map((content, index) => (
                                                            <div className={`brand-podium-position podium-position-${index + 1}`} key={content.id}>
                                                                <div className="podium-medal">{index + 1}º</div>
                                                                <div className="podium-content">
                                                                    <strong>{content.title}</strong>
                                                                    <span>
                                                                        {content.format} • por {content.publisher?.nickname || content.publisher?.name || "Não informado"}
                                                                    </span>
                                                                </div>
                                                                <div className="podium-result">
                                                                    <span>ÍNDICE</span>
                                                                    <strong>{content.squad_score}</strong>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="brand-podium-empty">
                                                        <span>—</span>
                                                        <p>Sem conteúdo com métricas suficientes.</p>
                                                    </div>
                                                )}
                                            </article>
                                        ))}
                                    </div>
                                </section>

                                <section className="ranking-section">
                                    <div className="report-section-title">
                                        <div>
                                            <span>CONTEÚDO QUE MAIS FUNCIONOU</span>
                                            <h2>Ranking do mês</h2>
                                        </div>
                                        <p>
                                            O Índice SQUAD considera somente visualizações, curtidas e compartilhamentos. Cada indicador tem o mesmo peso quando existe dado no mês.
                                        </p>
                                    </div>

                                    {!ranking.length && (
                                        <div className="empty-state">
                                            Ainda não há métricas suficientes para montar o ranking deste mês.
                                        </div>
                                    )}

                                    <div className="ranking-list">
                                        {ranking.slice(0, 10).map((item) => (
                                            <article className="ranking-row" key={item.id}>
                                                <div className={`rank-position rank-${item.rank}`}>{item.rank}º</div>
                                                <div className="ranking-content-name">
                                                    <strong>{item.title}</strong>
                                                    <span>
                                                        {item.brands.join(" + ")} • {item.format} • por {item.publisher?.nickname || item.publisher?.name || "Não informado"}
                                                    </span>
                                                </div>
                                                <div className="ranking-metric">
                                                    <span>Views</span>
                                                    <strong>{formatNumber(item.metric_views)}</strong>
                                                </div>
                                                <div className="ranking-metric">
                                                    <span>Curtidas</span>
                                                    <strong>{formatNumber(item.metric_likes)}</strong>
                                                </div>
                                                <div className="ranking-metric">
                                                    <span>Compart.</span>
                                                    <strong>{formatNumber(item.metric_shares)}</strong>
                                                </div>
                                                <div className="squad-score" title="Índice SQUAD: média relativa de Views, Curtidas e Compartilhamentos.">
                                                    <span>ÍNDICE SQUAD</span>
                                                    <strong>{item.squad_score}</strong>
                                                    <small>/100</small>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </section>

                                <div className="reports-grid advanced-reports">
                                    <PerformanceTable title="Performance por marca" rows={relatorio.by_brand || []} />
                                    <PerformanceTable title="Performance por formato" rows={relatorio.by_format || []} />
                                </div>

                                <section className="collaborator-report-card">
                                    <div className="report-section-title">
                                        <div>
                                            <span>EQUIPE</span>
                                            <h2>Performance por colaborador</h2>
                                        </div>
                                        <p>Mostra quem publicou cada conteúdo, sem transformar o relatório em competição de volume.</p>
                                    </div>
                                    <div className="collaborator-performance-grid">
                                        {(relatorio.by_collaborator || []).map((item) => (
                                            <article className="collaborator-performance" key={item.name}>
                                                <Avatar user={item.user} size="large" />
                                                <div className="collaborator-performance-name">
                                                    <strong>{item.user?.nickname || item.name}</strong>
                                                    <span>{item.user?.role || "Colaborador"}</span>
                                                </div>
                                                <div className="collaborator-mini-stat">
                                                    <span>Views</span>
                                                    <strong>{formatNumber(item.views)}</strong>
                                                </div>
                                                <div className="collaborator-mini-stat">
                                                    <span>Curtidas</span>
                                                    <strong>{formatNumber(item.likes)}</strong>
                                                </div>
                                                <div className="collaborator-mini-stat">
                                                    <span>Compart.</span>
                                                    <strong>{formatNumber(item.shares)}</strong>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </section>

                                <div className="report-charts-grid">
                                    <section className="year-chart-card">
                                        <div className="report-section-title">
                                            <div>
                                                <span>EVOLUÇÃO MÊS A MÊS</span>
                                                <h2>{hasYearViews ? "Visualizações" : "Interações"} ao longo de {relatorioAno}</h2>
                                            </div>
                                        </div>

                                        <div className="annual-chart">
                                            {yearly.map((item, index) => {
                                                const value = Number(hasYearViews ? item.views : item.interactions);
                                                return (
                                                    <div className="annual-column" key={item.month}>
                                                        <div className="annual-value">{formatNumber(value)}</div>
                                                        <div className="annual-bar-area">
                                                            <div
                                                                className="annual-bar"
                                                                style={{
                                                                    height: `${value === 0 ? 4 : Math.max(14, (value / maxYearMetric) * 180)}px`,
                                                                }}
                                                            />
                                                        </div>
                                                        <span>{MESES[index].slice(0, 3)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>

                                    <section className="brand-pie-card">
                                        <div className="report-section-title">
                                            <div>
                                                <span>DISTRIBUIÇÃO DE VIEWS</span>
                                                <h2>Views por marca</h2>
                                            </div>
                                        </div>

                                        {brandPieSegments.length ? (
                                            <div className="brand-pie-layout">
                                                <div className="brand-pie-visual">
                                                    <div className="brand-pie-chart" style={{ background: brandPieBackground }}>
                                                        <div className="brand-pie-center">
                                                            <span>MAIS VISTA</span>
                                                            <strong>{topBrandViews?.name}</strong>
                                                            <small>{formatNumber(topBrandViews?.views || 0)} views</small>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="brand-pie-legend">
                                                    {brandPieSegments.map((item) => (
                                                        <div className="brand-pie-legend-row" key={item.name}>
                                                            <i style={{ background: item.color }} />
                                                            <div>
                                                                <strong>{item.name}</strong>
                                                                <span>{formatNumber(item.views)} views</span>
                                                            </div>
                                                            <b>{item.percentage.toFixed(1).replace(".", ",")}%</b>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="empty-state">
                                                Ainda não há visualizações suficientes para montar o gráfico por marca.
                                            </div>
                                        )}
                                    </section>
                                </div>
                            </>
                        )}

                        {relatorioAba === "design" && (
                            <>
                                <div className="report-pane-intro design-pane-intro">
                                    <div>
                                        <span>PRODUÇÃO CRIATIVA</span>
                                        <h2>Leitura dedicada ao Design</h2>
                                        <p>Separação visual para facilitar a análise do que foi produzido, finalizado e entregue pela equipe criativa no mês.</p>
                                    </div>
                                </div>

                                <section className="creative-report-section separated-report-pane">
                                    <div className="report-section-title">
                                        <div>
                                            <span>PRODUÇÃO CRIATIVA</span>
                                            <h2>O que o Design entregou no mês</h2>
                                        </div>
                                        <p>Conta demandas aprovadas pela gerência, mesmo quando a peça não é uma publicação de rede social.</p>
                                    </div>

                                    <div className="creative-report-kpis">
                                        <div>
                                            <span>PEÇAS PRODUZIDAS</span>
                                            <strong>{formatNumber(creativeReport.summary?.pieces)}</strong>
                                        </div>
                                        <div>
                                            <span>DEMANDAS FINALIZADAS</span>
                                            <strong>{formatNumber(creativeReport.summary?.demands)}</strong>
                                        </div>
                                        <div>
                                            <span>CRIADORES ATIVOS</span>
                                            <strong>{formatNumber(creativeReport.summary?.creators)}</strong>
                                        </div>
                                        <div>
                                            <span>TEMPO MÉDIO</span>
                                            <strong>{Number(creativeReport.summary?.avg_days || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias</strong>
                                        </div>
                                    </div>

                                    <div className="creative-report-grid">
                                        <div className="creative-report-card">
                                            <span>POR MARCA</span>
                                            <h3>Peças produzidas</h3>
                                            {(creativeReport.by_brand || []).length ? (
                                                <div className="creative-report-list">
                                                    {creativeReport.by_brand.slice(0, 8).map((item) => (
                                                        <div key={item.name}>
                                                            <i className={brandClassName(item.name)} />
                                                            <strong>{item.name}</strong>
                                                            <span>{item.demands} demandas</span>
                                                            <b>{item.pieces} peças</b>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="empty-state compact-empty">Sem produções aprovadas neste mês.</div>
                                            )}
                                        </div>

                                        <div className="creative-report-card">
                                            <span>POR CRIADOR</span>
                                            <h3>Volume de produção</h3>
                                            {(creativeReport.by_creator || []).length ? (
                                                <div className="creative-report-list">
                                                    {creativeReport.by_creator.slice(0, 8).map((item) => (
                                                        <div key={item.name}>
                                                            <Avatar user={item.user} size="small" />
                                                            <strong>{item.name}</strong>
                                                            <span>{item.demands} demandas</span>
                                                            <b>{item.pieces} peças</b>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="empty-state compact-empty">Sem produção criativa no período.</div>
                                            )}
                                        </div>

                                        <div className="creative-report-card">
                                            <span>POR TIPO</span>
                                            <h3>Formato das peças</h3>
                                            {(creativeReport.by_type || []).length ? (
                                                <div className="creative-report-list">
                                                    {creativeReport.by_type.slice(0, 8).map((item) => (
                                                        <div key={item.name}>
                                                            <strong>{item.name}</strong>
                                                            <span>{item.demands} demandas</span>
                                                            <b>{item.pieces} peças</b>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="empty-state compact-empty">Sem dados de formato.</div>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            </>
                        )}

                        {relatorioAba === "gerentes" && (
                            <>
                                <div className="report-pane-intro manager-demands-pane-intro">
                                    <div>
                                        <span>DEMANDA INTERNA DO GRUPO</span>
                                        <h2>Quanto os outros gerentes estão demandando do Marketing</h2>
                                        <p>
                                            Leitura mensal dos pedidos recebidos no Portal de Gestores:
                                            volume, origem, marcas, tipos de solicitação e destino dentro do SQUAD.
                                        </p>
                                    </div>
                                </div>

                                <section className="manager-demand-kpis">
                                    <article className="manager-demand-kpi main">
                                        <span>PEDIDOS RECEBIDOS</span>
                                        <strong>{formatNumber(managerRequestsReport.summary?.total)}</strong>
                                        <small className={Number(managerRequestsReport.comparison?.total) >= 0 ? "up" : "down"}>
                                            {comparisonText(managerRequestsReport.comparison?.total)} vs. mês anterior
                                        </small>
                                    </article>

                                    <article className="manager-demand-kpi">
                                        <span>ENCAMINHADOS AO SQUAD</span>
                                        <strong>{formatNumber(managerRequestsReport.summary?.forwarded)}</strong>
                                        <small>{formatPercent(managerRequestsReport.summary?.forward_rate || 0, 1)} dos pedidos do mês</small>
                                    </article>

                                    <article className="manager-demand-kpi">
                                        <span>EM ACOMPANHAMENTO</span>
                                        <strong>{formatNumber(managerRequestsReport.summary?.active)}</strong>
                                        <small>recebidos, revisão, aprovados ou em andamento</small>
                                    </article>

                                    <article className="manager-demand-kpi">
                                        <span>CONCLUÍDOS</span>
                                        <strong>{formatNumber(managerRequestsReport.summary?.completed)}</strong>
                                        <small>{formatPercent(managerRequestsReport.summary?.completion_rate || 0, 1)} do volume recebido</small>
                                    </article>

                                    <article className="manager-demand-kpi">
                                        <span>EM REVISÃO</span>
                                        <strong>{formatNumber(managerRequestsReport.summary?.in_review)}</strong>
                                        <small>aguardando retorno do gerente solicitante</small>
                                    </article>

                                    <article className="manager-demand-kpi">
                                        <span>TEMPO MÉDIO P/ CONCLUIR</span>
                                        <strong>
                                            {Number(managerRequestsReport.summary?.avg_completion_days || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias
                                        </strong>
                                        <small>
                                            até o pedido ficar concluído
                                        </small>
                                    </article>
                                </section>

                                <section className="manager-demand-highlights">
                                    <article>
                                        <span>QUEM MAIS DEMANDOU</span>
                                        <strong>
                                            {managerRequestsReport.highlights?.top_requester?.name || "Sem dados"}
                                        </strong>
                                        <b>
                                            {managerRequestsReport.highlights?.top_requester
                                                ? `${formatNumber(managerRequestsReport.highlights.top_requester.count)} pedidos`
                                                : "—"}
                                        </b>
                                        <small>
                                            {managerRequestsReport.highlights?.top_requester
                                                ? `${formatPercent(managerRequestsReport.highlights.top_requester.share || 0, 1)} da demanda do mês`
                                                : "Nenhum pedido recebido no período"}
                                        </small>
                                    </article>

                                    <article>
                                        <span>MARCA MAIS DEMANDADA</span>
                                        <strong>
                                            {managerRequestsReport.highlights?.top_brand?.name || "Sem dados"}
                                        </strong>
                                        <b>
                                            {managerRequestsReport.highlights?.top_brand
                                                ? `${formatNumber(managerRequestsReport.highlights.top_brand.count)} pedidos`
                                                : "—"}
                                        </b>
                                        <small>
                                            {managerRequestsReport.highlights?.top_brand
                                                ? `${formatPercent(managerRequestsReport.highlights.top_brand.share || 0, 1)} da demanda do mês`
                                                : "Nenhuma marca com demanda"}
                                        </small>
                                    </article>

                                    <article>
                                        <span>TIPO MAIS SOLICITADO</span>
                                        <strong>
                                            {managerRequestsReport.highlights?.top_type?.name || "Sem dados"}
                                        </strong>
                                        <b>
                                            {managerRequestsReport.highlights?.top_type
                                                ? `${formatNumber(managerRequestsReport.highlights.top_type.count)} pedidos`
                                                : "—"}
                                        </b>
                                        <small>
                                            {managerRequestsReport.highlights?.top_type
                                                ? `${formatPercent(managerRequestsReport.highlights.top_type.share || 0, 1)} da demanda do mês`
                                                : "Nenhum tipo com demanda"}
                                        </small>
                                    </article>
                                </section>

                                <section className="manager-demand-requesters">
                                    <div className="report-section-title">
                                        <div>
                                            <span>ORIGEM DA DEMANDA</span>
                                            <h2>Pedidos por gerente</h2>
                                        </div>
                                        <p>
                                            Mostra quem está acionando mais o Marketing no período selecionado.
                                        </p>
                                    </div>

                                    {(managerRequestsReport.by_requester || []).length ? (
                                        <div className="manager-demand-requester-list">
                                            {managerRequestsReport.by_requester.map((item, index) => (
                                                <article key={item.id || item.name}>
                                                    <div className="manager-demand-rank">
                                                        {index + 1}
                                                    </div>
                                                    <div className="manager-demand-requester-name">
                                                        <strong>{item.name}</strong>
                                                        <span>
                                                            {item.role || "Gerente"}
                                                            {item.department ? ` • ${item.department}` : ""}
                                                        </span>
                                                    </div>
                                                    <div className="manager-demand-requester-bar">
                                                        <div>
                                                            <i style={{ width: `${Math.max(4, Number(item.share || 0))}%` }} />
                                                        </div>
                                                        <small>{formatPercent(item.share || 0, 1)} do total</small>
                                                    </div>
                                                    <div className="manager-demand-requester-stat">
                                                        <span>PEDIDOS</span>
                                                        <strong>{formatNumber(item.count)}</strong>
                                                    </div>
                                                    <div className="manager-demand-requester-stat">
                                                        <span>ATIVOS</span>
                                                        <strong>{formatNumber(item.active)}</strong>
                                                    </div>
                                                    <div className="manager-demand-requester-stat">
                                                        <span>CONCLUÍDOS</span>
                                                        <strong>{formatNumber(item.completed)}</strong>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="empty-state">
                                            Nenhum pedido de gerente recebido neste mês.
                                        </div>
                                    )}
                                </section>

                                <div className="manager-demand-analysis-grid">
                                    <section className="manager-demand-breakdown-card">
                                        <div className="report-card-title">
                                            <span>POR MARCA</span>
                                            <h3>De onde vem a pressão de demanda</h3>
                                        </div>
                                        <div className="manager-demand-breakdown-list">
                                            {(managerRequestsReport.by_brand || []).map((item) => (
                                                <div key={item.name}>
                                                    <i className={brandClassName(item.name)} />
                                                    <strong>{item.name}</strong>
                                                    <span>{formatPercent(item.share || 0, 1)}</span>
                                                    <b>{formatNumber(item.count)} pedidos</b>
                                                </div>
                                            ))}
                                        </div>
                                        {!(managerRequestsReport.by_brand || []).length && (
                                            <div className="empty-state compact-empty">Sem demanda por marca no período.</div>
                                        )}
                                    </section>

                                    <section className="manager-demand-breakdown-card">
                                        <div className="report-card-title">
                                            <span>POR TIPO</span>
                                            <h3>O que estão pedindo</h3>
                                        </div>
                                        <div className="manager-demand-breakdown-list simple">
                                            {(managerRequestsReport.by_type || []).map((item) => (
                                                <div key={item.name}>
                                                    <strong>{item.name}</strong>
                                                    <span>{formatPercent(item.share || 0, 1)}</span>
                                                    <b>{formatNumber(item.count)} pedidos</b>
                                                </div>
                                            ))}
                                        </div>
                                        {!(managerRequestsReport.by_type || []).length && (
                                            <div className="empty-state compact-empty">Sem tipos de pedido no período.</div>
                                        )}
                                    </section>

                                    <section className="manager-demand-breakdown-card">
                                        <div className="report-card-title">
                                            <span>DESTINO INTERNO</span>
                                            <h3>Para onde os pedidos foram</h3>
                                        </div>
                                        <div className="manager-demand-breakdown-list simple">
                                            {(managerRequestsReport.by_destination || []).map((item) => (
                                                <div key={item.name}>
                                                    <strong>{item.name}</strong>
                                                    <span>{formatPercent(item.share || 0, 1)}</span>
                                                    <b>{formatNumber(item.count)} pedidos</b>
                                                </div>
                                            ))}
                                        </div>
                                        {!(managerRequestsReport.by_destination || []).length && (
                                            <div className="empty-state compact-empty">Nenhum pedido encaminhado no período.</div>
                                        )}
                                    </section>
                                </div>

                                <section className="manager-demand-priority-section">
                                    <div className="report-section-title">
                                        <div>
                                            <span>PRESSÃO DE PRAZO</span>
                                            <h2>Prioridade dos pedidos</h2>
                                        </div>
                                    </div>

                                    <div className="manager-demand-priority-grid">
                                        {(managerRequestsReport.by_priority || []).map((item) => (
                                            <article key={item.name} className={`priority-${String(item.name).toLowerCase()}`}>
                                                <span>{item.name}</span>
                                                <strong>{formatNumber(item.count)}</strong>
                                                <small>{formatPercent(item.share || 0, 1)} do total</small>
                                            </article>
                                        ))}
                                    </div>
                                </section>

                                <section className="manager-demand-year-card">
                                    <div className="report-section-title">
                                        <div>
                                            <span>EVOLUÇÃO DA DEMANDA</span>
                                            <h2>Pedidos recebidos ao longo de {relatorioAno}</h2>
                                        </div>
                                        <p>
                                            Ajuda a identificar meses em que as outras áreas mais acionaram o Marketing.
                                        </p>
                                    </div>

                                    <div className="manager-demand-year-chart">
                                        {managerRequestYearly.map((item, index) => {
                                            const value = Number(item.requests || 0);
                                            return (
                                                <div className="manager-demand-year-column" key={item.month}>
                                                    <strong>{formatNumber(value)}</strong>
                                                    <div>
                                                        <i
                                                            style={{
                                                                height: `${value === 0 ? 4 : Math.max(12, (value / maxManagerRequests) * 170)}px`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span>{MESES[index].slice(0, 3)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            </>
                        )}
                    </>
                )}
            </>
        );
    }

    function PerformanceHighlight({ label, content, value }) {
        return (
            <article className="performance-highlight">
                <span>{label}</span>
                {content ? (
                    <>
                        <div className="highlight-person">
                            <Avatar user={content.publisher} size="medium" />
                            <div>
                                <strong>{content.title}</strong>
                                <small>{content.brands.join(" + ")} • {content.format}</small>
                            </div>
                        </div>
                        <h3>{value}</h3>
                    </>
                ) : (
                    <h3>{value}</h3>
                )}
            </article>
        );
    }

    function PerformanceTable({ title, rows }) {
        return (
            <section className="report-table-card">
                <div className="report-card-title">
                    <span>ANÁLISE</span>
                    <h3>{title}</h3>
                </div>
                {!rows.length && <div className="empty-state compact-empty">Sem dados suficientes.</div>}
                <div className="performance-table">
                    {rows.slice(0, 8).map((item) => (
                        <div className="performance-table-row" key={item.name}>
                            <strong>{item.name}</strong>
                            <div>
                                <span>{item.publications} posts</span>
                                <span>{formatNumber(item.views)} views</span>
                                <span>{formatNumber(item.likes)} curtidas</span>
                            </div>
                            <b>{formatNumber(item.shares)} comp.</b>
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    function renderAchievements(view = "achievements") {
        const personalSections = achievementsData.sections || [];
        const nextAchievement =
            achievementsData.summary?.next || null;

        function AchievementCard({
            achievement,
            collective = false,
        }) {
            const unlocked = Boolean(achievement.unlocked);

            return (
                <article
                    className={`achievement-card ${
                        unlocked ? "unlocked" : "locked"
                    } ${collective ? "collective" : ""}`}
                >
                    <div className="achievement-node">
                        <div className="achievement-seal">
                            <span>{achievement.icon}</span>
                        </div>

                        <i>
                            {unlocked
                                ? "DESBLOQUEADA"
                                : `${achievement.percent}%`}
                        </i>
                    </div>

                    <div className="achievement-card-copy">
                        <span>{achievement.eyebrow}</span>
                        <h3>{achievement.title}</h3>
                        <p>{achievement.description}</p>
                    </div>

                    <div className="achievement-card-progress">
                        <div>
                            <i
                                style={{
                                    width: `${Math.max(
                                        0,
                                        Math.min(
                                            100,
                                            Number(
                                                achievement.percent ||
                                                    0
                                            )
                                        )
                                    )}%`,
                                }}
                            />
                        </div>

                        <span>
                            {formatNumber(
                                achievement.current || 0
                            )}{" "}
                            /{" "}
                            {formatNumber(
                                achievement.target || 0
                            )}{" "}
                            {achievement.unit || ""}
                        </span>
                    </div>

                    <footer>
                        {unlocked ? (
                            <>
                                <strong>✓ Conquistada</strong>
                                {achievement.unlocked_at && (
                                    <small>
                                        {formatDateTime(
                                            achievement.unlocked_at
                                        )}
                                    </small>
                                )}
                            </>
                        ) : (
                            <>
                                <strong>
                                    Faltam{" "}
                                    {formatNumber(
                                        achievement.remaining ||
                                            0
                                    )}{" "}
                                    {achievement.unit || ""}
                                </strong>
                                <small>
                                    Continue avançando para
                                    desbloquear
                                </small>
                            </>
                        )}
                    </footer>
                </article>
            );
        }

        function AchievementTimeline({
            section,
            collective = false,
        }) {
            return (
                <section className="achievement-section">
                    <div className="achievement-section-heading">
                        <div>
                            <span>{section.eyebrow}</span>
                            <h2>{section.title}</h2>
                            <p>{section.description}</p>
                        </div>

                        <strong>
                            {
                                section.items.filter(
                                    (item) => item.unlocked
                                ).length
                            }{" "}
                            / {section.items.length}
                        </strong>
                    </div>

                    <div className="achievement-timeline">
                        {section.items.map((achievement) => (
                            <AchievementCard
                                key={achievement.key}
                                achievement={achievement}
                                collective={collective}
                            />
                        ))}
                    </div>
                </section>
            );
        }

        function PerformanceMetrics({
            summary,
        }) {
            const current =
                summary?.payload?.current || {};
            const roleType =
                summary?.role_type ||
                achievementsData.role_type;

            if (roleType === "design") {
                return (
                    <div className="performance-metrics-grid">
                        <div>
                            <span>PEÇAS</span>
                            <strong>
                                {formatNumber(current.pieces || 0)}
                            </strong>
                        </div>
                        <div>
                            <span>DEMANDAS</span>
                            <strong>
                                {formatNumber(current.demands || 0)}
                            </strong>
                        </div>
                        <div>
                            <span>MARCAS</span>
                            <strong>
                                {formatNumber(current.brands || 0)}
                            </strong>
                        </div>
                        <div>
                            <span>MAIOR DEMANDA</span>
                            <strong>
                                {formatNumber(
                                    current.biggest_demand?.pieces ||
                                        0
                                )}
                            </strong>
                        </div>
                    </div>
                );
            }

            return (
                <div className="performance-metrics-grid">
                    <div>
                        <span>NO AR</span>
                        <strong>
                            {formatNumber(current.contents || 0)}
                        </strong>
                    </div>
                    <div>
                        <span>VIEWS</span>
                        <strong>
                            {formatNumber(current.views || 0)}
                        </strong>
                    </div>
                    <div>
                        <span>CURTIDAS</span>
                        <strong>
                            {formatNumber(current.likes || 0)}
                        </strong>
                    </div>
                    <div>
                        <span>COMPART.</span>
                        <strong>
                            {formatNumber(current.shares || 0)}
                        </strong>
                    </div>
                    <div>
                        <span>STORIES</span>
                        <strong>
                            {formatNumber(current.stories || 0)}
                        </strong>
                    </div>
                </div>
            );
        }

        function renderMonthlyOverview() {
            if (monthlyOverviewLoading && !monthlyOverview) {
                return (
                    <section className="performance-pro-dashboard">
                        <div className="collab-month-loading">
                            Carregando seu desempenho...
                        </div>
                    </section>
                );
            }

            if (!monthlyOverview) {
                return (
                    <section className="performance-pro-dashboard">
                        <div className="collab-month-empty">
                            {monthlyOverviewError ||
                                "Ainda não há dados suficientes neste período."}
                        </div>
                    </section>
                );
            }

            const isDesign = monthlyOverview.role_type === "design";
            const summary = monthlyOverview.summary || {};
            const comparison = monthlyOverview.comparison || {};
            const weekly = monthlyOverview.weekly || [];
            const byBrand = monthlyOverview.by_brand || [];
            const byType = isDesign
                ? monthlyOverview.by_type || []
                : monthlyOverview.by_format || [];
            const topResults = monthlyOverview.top_results || [];
            const highlight = monthlyOverview.highlight || null;
            const productivity = monthlyOverview.productivity || {};

            const delta = (value) => {
                const number = Number(value || 0);
                return {
                    text: `${number >= 0 ? "+" : ""}${number.toLocaleString("pt-BR", {
                        maximumFractionDigits: 1,
                    })}%`,
                    positive: number >= 0,
                };
            };

            const maxTrend = Math.max(
                1,
                ...weekly.map((item) =>
                    Number(isDesign ? item.pieces : item.views) || 0
                )
            );

            const maxBrand = Math.max(
                1,
                ...byBrand.map((item) => Number(item.value || 0))
            );

            const donutStops = (() => {
                if (!byType.length) return "conic-gradient(#3a4650 0 100%)";
                const tones = ["#d8ae5a", "#8d6940", "#bd924c", "#6f5b42", "#a98145", "#51483c"];
                let cursor = 0;
                const parts = byType.slice(0, 6).map((item, index) => {
                    const start = cursor;
                    cursor += Number(item.share || 0);
                    return `${tones[index % tones.length]} ${start}% ${cursor}%`;
                });
                if (cursor < 100) parts.push(`#303a43 ${cursor}% 100%`);
                return `conic-gradient(${parts.join(",")})`;
            })();

            const comparisonCards = isDesign
                ? [
                      { icon: "✦", label: "PEÇAS APROVADAS", value: summary.pieces || 0, change: delta(comparison.pieces) },
                      { icon: "▣", label: "DEMANDAS", value: summary.demands || 0, change: delta(comparison.demands) },
                      { icon: "◆", label: "MARCAS ATENDIDAS", value: summary.brands || 0, change: null },
                  ]
                : [
                      { icon: "➤", label: "CONTEÚDOS NO AR", value: summary.contents || 0, change: delta(comparison.contents) },
                      { icon: "◉", label: "VISUALIZAÇÕES", value: summary.views || 0, change: delta(comparison.views) },
                      { icon: "♥", label: "CURTIDAS", value: summary.likes || 0, change: delta(comparison.likes) },
                      { icon: "⌯", label: "COMPARTILHAMENTOS", value: summary.shares || 0, change: delta(comparison.shares) },
                  ];

            return (
                <section className="performance-pro-dashboard">
                    <div className="performance-pro-role-row">
                        <span>{monthlyOverview.role_label || (isDesign ? "Design" : "Social Media")}</span>
                    </div>

                    <div className={`performance-pro-kpis ${isDesign ? "design" : "social"}`}>
                        {comparisonCards.map((item) => (
                            <article key={item.label}>
                                <div className="performance-kpi-icon">{item.icon}</div>
                                <div>
                                    <span>{item.label}</span>
                                    <strong>{formatNumber(item.value)}</strong>
                                    {item.change ? (
                                        <small className={item.change.positive ? "up" : "down"}>
                                            {item.change.text} em relação ao mês anterior
                                        </small>
                                    ) : (
                                        <small>no período selecionado</small>
                                    )}
                                </div>
                            </article>
                        ))}

                        <article className="performance-rhythm-card">
                            <div className="performance-kpi-icon">▥</div>
                            <div>
                                <span>RITMO DO MÊS</span>
                                <strong>
                                    {formatNumber(monthlyOverview.rhythm?.projected || 0)}
                                </strong>
                                <small>
                                    Projeção de {monthlyOverview.rhythm?.projected_label || (isDesign ? "peças" : "conteúdos")} até o fim do mês.
                                </small>
                            </div>
                        </article>
                    </div>

                    <div className="performance-pro-main-grid">
                        <article className="performance-trend-card">
                            <div className="performance-card-head">
                                <div>
                                    <span>EVOLUÇÃO NO MÊS</span>
                                    <h3>{isDesign ? "Peças aprovadas por semana" : "Visualizações por semana"}</h3>
                                </div>
                                <b>{isDesign ? "Peças" : "Visualizações"}</b>
                            </div>

                            <div className="performance-line-chart">
                                <div className="performance-chart-grid">
                                    {[0, 1, 2, 3, 4].map((line) => (
                                        <i key={line} style={{ bottom: `${line * 25}%` }} />
                                    ))}
                                </div>

                                <svg
                                    className="performance-line-svg"
                                    viewBox="0 0 1000 260"
                                    preserveAspectRatio="none"
                                    aria-hidden="true"
                                >
                                    <defs>
                                        <linearGradient id="performanceArea" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#d7ae5b" stopOpacity="0.30" />
                                            <stop offset="100%" stopColor="#d7ae5b" stopOpacity="0.02" />
                                        </linearGradient>
                                    </defs>
                                    {weekly.length > 0 && (
                                        <>
                                            <polygon
                                                fill="url(#performanceArea)"
                                                points={[
                                                    "70,230",
                                                    ...weekly.map((item, index) => {
                                                        const value = Number(isDesign ? item.pieces : item.views) || 0;
                                                        const x = 70 + index * 285;
                                                        const y = 218 - (value / maxTrend) * 165;
                                                        return `${x},${y}`;
                                                    }),
                                                    `${70 + Math.max(0, weekly.length - 1) * 285},230`,
                                                ].join(" ")}
                                            />
                                            <polyline
                                                fill="none"
                                                stroke="#d8ae5a"
                                                strokeWidth="5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                points={weekly.map((item, index) => {
                                                    const value = Number(isDesign ? item.pieces : item.views) || 0;
                                                    const x = 70 + index * 285;
                                                    const y = 218 - (value / maxTrend) * 165;
                                                    return `${x},${y}`;
                                                }).join(" ")}
                                            />
                                            {weekly.map((item, index) => {
                                                const value = Number(isDesign ? item.pieces : item.views) || 0;
                                                const x = 70 + index * 285;
                                                const y = 218 - (value / maxTrend) * 165;
                                                return (
                                                    <g key={`${item.label}-${index}`}>
                                                        <circle cx={x} cy={y} r="8" fill="#e0b966" />
                                                        <text x={x} y={y - 18} textAnchor="middle" className="performance-svg-value">
                                                            {formatNumber(value)}
                                                        </text>
                                                    </g>
                                                );
                                            })}
                                        </>
                                    )}
                                </svg>

                                <div className="performance-line-labels">
                                    {weekly.map((item) => (
                                        <div key={item.label}>
                                            <strong>{item.period} {MESES[monthlyOverview.period.month - 1].slice(0,3).toLowerCase()}.</strong>
                                            <span>{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </article>

                        <article className="performance-highlight-pro">
                            <div className="performance-card-head">
                                <div>
                                    <span>{highlight?.eyebrow || "DESTAQUE DO MÊS"}</span>
                                    <h3>{highlight ? "Melhor resultado do período" : "Seu destaque aparece aqui"}</h3>
                                </div>
                            </div>

                            {highlight ? (
                                <div className="performance-highlight-content">
                                    <div className="performance-highlight-visual">
                                        <span>{isDesign ? "✦" : "★"}</span>
                                    </div>
                                    <div className="performance-highlight-copy">
                                        <small>{highlight.brand || (isDesign ? "Design" : "Conteúdo")}</small>
                                        <h3>{highlight.title}</h3>
                                        <strong>
                                            {formatNumber(highlight.value)}{" "}
                                            <span>{highlight.value_label}</span>
                                        </strong>
                                        {!isDesign && (
                                            <div className="performance-highlight-stats">
                                                <div><b>♥</b><strong>{formatNumber(highlight.likes || 0)}</strong><small>curtidas</small></div>
                                                <div><b>⌯</b><strong>{formatNumber(highlight.shares || 0)}</strong><small>compart.</small></div>
                                                <div><b>●</b><strong>{formatNumber(highlight.comments || 0)}</strong><small>comentários</small></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="performance-empty-pro">
                                    Ainda não há resultado suficiente para destacar.
                                </div>
                            )}
                        </article>
                    </div>

                    <div className="performance-pro-secondary-grid">
                        <article className="performance-brand-pro">
                            <div className="performance-card-head">
                                <div>
                                    <span>DESEMPENHO POR MARCA</span>
                                    <h3>{isDesign ? "Peças aprovadas neste mês" : "Quantidade de conteúdos no ar neste mês"}</h3>
                                </div>
                            </div>

                            <div className="performance-brand-columns">
                                {byBrand.slice(0, 7).map((item) => (
                                    <div key={item.name}>
                                        <strong>{formatNumber(item.value)}</strong>
                                        <div>
                                            <i
                                                className={brandClassName(item.name)}
                                                style={{
                                                    height: `${Math.max(10, (Number(item.value || 0) / maxBrand) * 120)}px`,
                                                }}
                                            />
                                        </div>
                                        <span>{item.name}</span>
                                    </div>
                                ))}
                                {!byBrand.length && (
                                    <div className="performance-empty-pro">
                                        Sem dados por marca neste período.
                                    </div>
                                )}
                            </div>
                        </article>

                        <article className="performance-format-pro">
                            <div className="performance-card-head">
                                <div>
                                    <span>{isDesign ? "TIPOS DE PEÇA" : "TIPOS DE CONTEÚDO"}</span>
                                    <h3>{isDesign ? "Formatos mais produzidos" : "Formatos mais publicados"}</h3>
                                </div>
                            </div>

                            <div className="performance-format-layout">
                                <div
                                    className="performance-donut"
                                    style={{ background: donutStops }}
                                >
                                    <div>
                                        <strong>
                                            {formatNumber(
                                                isDesign
                                                    ? summary.pieces || 0
                                                    : summary.contents || 0
                                            )}
                                        </strong>
                                        <span>{isDesign ? "peças" : "conteúdos"}</span>
                                    </div>
                                </div>

                                <div className="performance-format-legend">
                                    {byType.slice(0, 6).map((item, index) => (
                                        <div key={item.name}>
                                            <i className={`tone-${index + 1}`} />
                                            <strong>{item.name}</strong>
                                            <span>
                                                {formatNumber(item.value)} ({formatPercent(item.share || 0, 0)})
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </article>

                        <article className="performance-top-results">
                            <div className="performance-card-head">
                                <div>
                                    <span>MELHORES RESULTADOS DO MÊS</span>
                                    <h3>
                                        {isDesign
                                            ? "Top 3 demandas por volume"
                                            : "Top 3 publicações por visualizações"}
                                    </h3>
                                </div>
                            </div>

                            <div className="performance-top-list">
                                {topResults.map((item, index) => (
                                    <div key={item.id || `${item.title}-${index}`}>
                                        <b>{index + 1}</b>
                                        <div>
                                            <strong>{item.title}</strong>
                                            <span>
                                                {item.brand || ""}
                                                {item.date ? ` • ${new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}
                                            </span>
                                        </div>
                                        <strong>
                                            {formatNumber(
                                                isDesign
                                                    ? item.value
                                                    : item.views
                                            )}
                                            <small>
                                                {isDesign ? " peças" : " views"}
                                            </small>
                                        </strong>
                                    </div>
                                ))}
                                {!topResults.length && (
                                    <div className="performance-empty-pro">
                                        Ainda não há resultados suficientes.
                                    </div>
                                )}
                            </div>
                        </article>
                    </div>

                    <article className="performance-productivity-pro">
                        <div className="performance-card-head">
                            <div>
                                <span>RESUMO DA PRODUTIVIDADE</span>
                            </div>
                        </div>

                        <div className="performance-productivity-grid">
                            <div>
                                <b>▣</b>
                                <span>Média por semana</span>
                                <strong>
                                    {Number(productivity.average_per_week || 0).toLocaleString("pt-BR", {
                                        maximumFractionDigits: 1,
                                    })}
                                </strong>
                                <small>{isDesign ? "peças" : "conteúdos"}</small>
                            </div>
                            <div>
                                <b>◷</b>
                                <span>Intervalo médio</span>
                                <strong>
                                    {Number(productivity.average_gap_days || 0).toLocaleString("pt-BR", {
                                        maximumFractionDigits: 1,
                                    })}
                                </strong>
                                <small>dias</small>
                            </div>
                            <div>
                                <b>⚡</b>
                                <span>Dia mais produtivo</span>
                                <strong>{productivity.best_day || "—"}</strong>
                                <small>
                                    {formatNumber(productivity.best_day_value || 0)} {isDesign ? "peças" : "conteúdos"}
                                </small>
                            </div>
                            <div>
                                <b>🏆</b>
                                <span>{isDesign ? "Tipo mais produzido" : "Melhor formato"}</span>
                                <strong>
                                    {isDesign
                                        ? productivity.best_type || "—"
                                        : productivity.best_format || "—"}
                                </strong>
                                <small>
                                    {formatPercent(
                                        isDesign
                                            ? productivity.best_type_share || 0
                                            : productivity.best_format_share || 0,
                                        0
                                    )} do total
                                </small>
                            </div>
                        </div>
                    </article>
                </section>
            );
        }

        function renderPerformanceBlock() {
            const list =
                performanceTab === "monthly"
                    ? performanceData.monthly || []
                    : performanceData.weekly || [];

            const latest = list[0] || null;
            const history = list.slice(1, 7);

            return (
                <section className="performance-history-section">
                    <div className="performance-history-heading">
                        <div>
                            <span>MEU DESEMPENHO</span>
                            <h2>Seus resumos no SQUAD</h2>
                            <p>
                                Toda quarta às 10h você recebe um
                                parcial da semana. No último dia do
                                mês, às 17h, entra o fechamento
                                mensal.
                            </p>
                        </div>

                        <div className="performance-tabs">
                            <button
                                type="button"
                                className={
                                    performanceTab === "weekly"
                                        ? "active"
                                        : ""
                                }
                                onClick={() =>
                                    setPerformanceTab("weekly")
                                }
                            >
                                Semanal
                            </button>
                            <button
                                type="button"
                                className={
                                    performanceTab === "monthly"
                                        ? "active"
                                        : ""
                                }
                                onClick={() =>
                                    setPerformanceTab("monthly")
                                }
                            >
                                Mensal
                            </button>
                        </div>
                    </div>

                    {performanceError && (
                        <div className="performance-empty">
                            {performanceError}
                        </div>
                    )}

                    {performanceLoading && !latest ? (
                        <div className="performance-empty">
                            Carregando seu histórico...
                        </div>
                    ) : !latest ? (
                        <div className="performance-empty">
                            <strong>
                                Seu primeiro resumo ainda não foi
                                gerado.
                            </strong>
                            <span>
                                {performanceTab === "weekly"
                                    ? "O resumo semanal aparece toda quarta-feira a partir das 10h."
                                    : "O resumo mensal aparece no último dia do mês a partir das 17h."}
                            </span>
                        </div>
                    ) : (
                        <>
                            <article className="performance-featured-card">
                                <div className="performance-featured-top">
                                    <div>
                                        <span>
                                            {performanceTab === "weekly"
                                                ? "PARCIAL DA SEMANA"
                                                : "FECHAMENTO MENSAL"}
                                        </span>
                                        <h3>{latest.title}</h3>
                                        <small>
                                            {
                                                latest.payload
                                                    ?.period_label
                                            }{" "}
                                            •{" "}
                                            {
                                                latest.payload
                                                    ?.schedule_label
                                            }
                                        </small>
                                    </div>

                                    <div className="performance-generated">
                                        <span>GERADO EM</span>
                                        <strong>
                                            {formatDateTime(
                                                latest.generated_at
                                            )}
                                        </strong>
                                    </div>
                                </div>

                                <p className="performance-message">
                                    {latest.message}
                                </p>

                                <PerformanceMetrics
                                    summary={latest}
                                />

                                <div className="performance-recognition">
                                    <span>✦</span>
                                    <div>
                                        <strong>
                                            Reconhecimento do SQUAD
                                        </strong>
                                        <p>{latest.note}</p>
                                    </div>
                                </div>

                                {latest.payload
                                    ?.next_achievement && (
                                    <div className="performance-next-achievement">
                                        <span>
                                            {
                                                latest.payload
                                                    .next_achievement
                                                    .icon
                                            }
                                        </span>
                                        <div>
                                            <small>
                                                PRÓXIMA CONQUISTA
                                            </small>
                                            <strong>
                                                {
                                                    latest.payload
                                                        .next_achievement
                                                        .title
                                                }
                                            </strong>
                                            <p>
                                                {
                                                    latest.payload
                                                        .next_achievement
                                                        .percent
                                                }
                                                % concluída • faltam{" "}
                                                {formatNumber(
                                                    latest.payload
                                                        .next_achievement
                                                        .remaining || 0
                                                )}{" "}
                                                {
                                                    latest.payload
                                                        .next_achievement
                                                        .unit
                                                }
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </article>

                            {history.length > 0 && (
                                <div className="performance-history-list">
                                    <div className="performance-history-list-heading">
                                        <span>HISTÓRICO</span>
                                        <small>
                                            Últimos resumos salvos
                                        </small>
                                    </div>

                                    {history.map((summary) => {
                                        const current =
                                            summary.payload?.current ||
                                            {};

                                        return (
                                            <article
                                                className="performance-history-item"
                                                key={summary.id}
                                            >
                                                <div>
                                                    <strong>
                                                        {
                                                            summary.payload
                                                                ?.period_label
                                                        }
                                                    </strong>
                                                    <small>
                                                        {summary.role_type ===
                                                        "design"
                                                            ? `${formatNumber(
                                                                  current.pieces ||
                                                                      0
                                                              )} peças • ${formatNumber(
                                                                  current.demands ||
                                                                      0
                                                              )} demandas`
                                                            : `${formatNumber(
                                                                  current.contents ||
                                                                      0
                                                              )} conteúdos • ${formatNumber(
                                                                  current.views ||
                                                                      0
                                                              )} views`}
                                                    </small>
                                                </div>

                                                <span>
                                                    {formatDateTime(
                                                        summary.generated_at
                                                    )}
                                                </span>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </section>
            );
        }

        if (view === "performance") {
            return (
                <>
                    <header className="section-header collaborator-performance-header">
                        <div>
                            <p className="eyebrow">DESEMPENHO INDIVIDUAL</p>
                            <h1>Meu desempenho</h1>
                            <p>
                                Acompanhe seus resultados e a evolução das suas publicações.
                            </p>
                        </div>

                        <div className="collab-performance-filters">
                            <select
                                value={monthlyOverviewMonth}
                                onChange={(event) =>
                                    setMonthlyOverviewMonth(Number(event.target.value))
                                }
                            >
                                {MESES.map((mes, index) => (
                                    <option key={mes} value={index + 1}>
                                        {mes}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={monthlyOverviewYear}
                                onChange={(event) =>
                                    setMonthlyOverviewYear(Number(event.target.value))
                                }
                            >
                                {ANOS_CALENDARIO.map((year) => (
                                    <option key={year} value={year}>
                                        {year}
                                    </option>
                                ))}
                            </select>

                            <button
                                type="button"
                                className="achievement-refresh"
                                onClick={() =>
                                    carregarMonthlyOverview(
                                        false,
                                        monthlyOverviewMonth,
                                        monthlyOverviewYear
                                    )
                                }
                            >
                                ↻ Atualizar
                            </button>
                        </div>
                    </header>

                    {renderMonthlyOverview()}
                </>
            );
        }

        if (achievementsLoading) {
            return (
                <div className="achievement-loading-page">
                    Carregando conquistas do SQUAD...
                </div>
            );
        }

        return (
            <>
                <header className="section-header achievements-header">
                    <div>
                        <p className="eyebrow">
                            EVOLUÇÃO NO SQUAD
                        </p>
                        <h1>Conquistas</h1>
                        <p>
                            Marcos individuais do seu trabalho,
                            evolução e resultados dentro do Social Planner.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="achievement-refresh"
                        onClick={() => {
                            carregarConquistas(false);
                            carregarPerformanceSummaries(false);
                            carregarMonthlyOverview(false);
                        }}
                    >
                        ↻ Atualizar progresso
                    </button>
                </header>

                {achievementsError && (
                    <div className="achievement-error">
                        {achievementsError}
                    </div>
                )}

                <>
                        <section className="achievement-hero">
                            <div className="achievement-profile">
                                <Avatar
                                    user={usuarioSelecionado}
                                    size="large"
                                />

                                <div>
                                    <span>
                                        MINHAS CONQUISTAS
                                    </span>
                                    <h2>
                                        {usuarioSelecionado.nickname ||
                                            usuarioSelecionado.name}
                                    </h2>
                                    <p>
                                        {
                                            achievementsData.role_label
                                        }
                                    </p>
                                </div>
                            </div>

                            <div className="achievement-overall">
                                <div>
                                    <strong>
                                        {
                                            achievementsData.summary
                                                ?.unlocked
                                        }
                                    </strong>
                                    <span>
                                        de{" "}
                                        {
                                            achievementsData.summary
                                                ?.total
                                        }{" "}
                                        desbloqueadas
                                    </span>
                                </div>

                                <div className="achievement-overall-bar">
                                    <i
                                        style={{
                                            width: `${
                                                achievementsData
                                                    .summary
                                                    ?.percent || 0
                                            }%`,
                                        }}
                                    />
                                </div>

                                <small>
                                    {
                                        achievementsData.summary
                                            ?.percent
                                    }
                                    % da jornada concluída
                                </small>
                            </div>

                            <div className="achievement-next">
                                <span>
                                    PRÓXIMA CONQUISTA
                                </span>

                                {nextAchievement ? (
                                    <>
                                        <div>
                                            <strong>
                                                {
                                                    nextAchievement.icon
                                                }
                                            </strong>
                                            <div>
                                                <h3>
                                                    {
                                                        nextAchievement.title
                                                    }
                                                </h3>
                                                <p>
                                                    {
                                                        nextAchievement.description
                                                    }
                                                </p>
                                            </div>
                                        </div>

                                        <div className="achievement-next-progress">
                                            <span>
                                                {
                                                    nextAchievement.percent
                                                }
                                                %
                                            </span>
                                            <div>
                                                <i
                                                    style={{
                                                        width: `${nextAchievement.percent}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <small>
                                            Faltam{" "}
                                            {formatNumber(
                                                nextAchievement.remaining ||
                                                    0
                                            )}{" "}
                                            {nextAchievement.unit ||
                                                ""}
                                        </small>
                                    </>
                                ) : (
                                    <div className="achievement-complete-message">
                                        🏆 Todas as conquistas
                                        pessoais foram
                                        desbloqueadas.
                                    </div>
                                )}
                            </div>
                        </section>

                        {(achievementsData.recent_unlocked ||
                            []).length > 0 && (
                            <section className="achievement-recent">
                                <div>
                                    <span>
                                        SELOS MAIS RECENTES
                                    </span>
                                    <p>
                                        Seus últimos marcos
                                        desbloqueados.
                                    </p>
                                </div>

                                <div>
                                    {achievementsData.recent_unlocked.map(
                                        (achievement) => (
                                            <div
                                                className="achievement-mini-seal"
                                                key={
                                                    achievement.key
                                                }
                                                title={
                                                    achievement.title
                                                }
                                            >
                                                <strong>
                                                    {
                                                        achievement.icon
                                                    }
                                                </strong>
                                                <span>
                                                    {
                                                        achievement.title
                                                    }
                                                </span>
                                            </div>
                                        )
                                    )}
                                </div>
                            </section>
                        )}

                        {renderPerformanceBlock()}

                        {personalSections.map((section) => (
                            <AchievementTimeline
                                section={section}
                                key={section.key}
                            />
                        ))}

                </>

            </>
        );
    }

    function encontrarConquistaParaNotificacao(item) {
        const todas = [
            ...(achievementsData.sections || []).flatMap((section) => section.items || []),
            ...((achievementsData.squad?.sections || []).flatMap((section) => section.items || [])),
            ...(achievementsData.recent_unlocked || []),
        ];
        const texto = `${item?.title || ""} ${item?.message || ""} ${item?.note || ""}`.toLowerCase();
        return todas.find((achievement) => {
            const titulo = String(achievement?.title || "").toLowerCase();
            return titulo && texto.includes(titulo);
        }) || null;
    }

    function AchievementCardChat({ achievement, notification }) {
        const fallbackTitle = String(notification?.message || "")
            .split(":")[0]
            .trim() || "Nova conquista";
        const card = achievement || {
            icon: "🏆",
            eyebrow: "CONQUISTA",
            title: fallbackTitle,
            description: notification?.note || notification?.message || "",
            percent: 100,
            current: 1,
            target: 1,
            unit: "",
            unlocked: true,
            unlocked_at: notification?.created_at || "",
        };

        return (
            <div className="chat-achievement-real-card">
                <div className="chat-achievement-announcement">
                    <strong>Nova conquista desbloqueada!</strong>
                </div>
                <article className="achievement-card unlocked chat-achievement-card">
                    <div className="achievement-node">
                        <div className="achievement-seal">
                            <span>{card.icon}</span>
                        </div>
                        <i>DESBLOQUEADA</i>
                    </div>

                    <div className="achievement-card-copy">
                        <span>{card.eyebrow || "CONQUISTA"}</span>
                        <h3>{card.title}</h3>
                        <p>{card.description}</p>
                    </div>

                    <div className="achievement-card-progress">
                        <div><i style={{ width: "100%" }} /></div>
                        <span>
                            {formatNumber(card.current || card.target || 0)}
                            {card.target ? ` / ${formatNumber(card.target)}` : ""}
                            {card.unit ? ` ${card.unit}` : ""}
                        </span>
                    </div>

                    <footer>
                        <strong>✓ Conquistada</strong>
                        {(card.unlocked_at || notification?.created_at) && (
                            <small>{formatDateTime(card.unlocked_at || notification.created_at)}</small>
                        )}
                    </footer>
                </article>
            </div>
        );
    }

    function renderChatFlutuante() {
        const messages = chatData.messages || [];
        const hojeIso = new Date().toISOString().slice(0, 10);

        const lembretesChat = (lembretes || [])
            .filter((item) => {
                const data = String(item.date || "").slice(0, 10);
                return data === hojeIso;
            });

        const notificacoesChat = isManagerProfile(usuarioSelecionado)
            ? []
            : (notificationsData.items || []).filter(
                  (item) =>
                      item.event_type === "achievement_unlocked" ||
                      item.entity_type === "achievement"
              );

        function lembreteVisual(item) {
            const texto = `${item?.title || ""} ${item?.note || ""}`.toLowerCase();
            if (texto.includes("evento")) return { icon: "📅", eyebrow: "EVENTO HOJE" };
            if (texto.includes("grava") || texto.includes("film") || texto.includes("foto")) return { icon: "🎬", eyebrow: "LEMBRETE DE HOJE" };
            if (texto.includes("anivers")) return { icon: "🎂", eyebrow: "DATA ESPECIAL" };
            if (texto.includes("reuni")) return { icon: "🤝", eyebrow: "COMPROMISSO HOJE" };
            return { icon: "📌", eyebrow: "LEMBRETE DE HOJE" };
        }

        const feed = [
            ...messages.map((message) => ({
                kind: "message",
                sortDate: message.created_at || "",
                data: message,
            })),
            ...notificacoesChat.map((item) => ({
                kind: "notification",
                sortDate: item.created_at || "",
                data: item,
            })),
            ...lembretesChat.map((item) => ({
                kind: "reminder",
                sortDate: `${hojeIso}T09:00:00`,
                data: item,
            })),
        ].sort((x, y) => String(x.sortDate).localeCompare(String(y.sortDate)));

        const extrasNaoLidos = notificacoesChat.filter((item) => !item.read_at).length;
        const badgeTotal =
            Number(chatData.unread_count || 0) +
            Number(extrasNaoLidos || 0) +
            Number(lembretesChat.length || 0);

        return (
            <div className={`squad-floating-chat ${chatAberto ? "open" : ""}`}>
                {chatAberto && (
                    <section className="squad-floating-chat-panel">
                        <header className="squad-floating-chat-header">
                            <div>
                                <strong>Chat do SQUAD</strong>
                                <small>Equipe, lembretes e conquistas</small>
                            </div>
                            <button type="button" onClick={() => setChatAberto(false)}>×</button>
                        </header>

                        <div className="squad-floating-chat-feed">
                            {!feed.length ? (
                                <div className="squad-floating-chat-empty">
                                    <span>◌</span>
                                    <strong>Nenhuma mensagem ainda</strong>
                                    <small>Mensagens, lembretes e novas conquistas aparecem aqui.</small>
                                </div>
                            ) : feed.map((entry, index) => {
                                if (entry.kind === "reminder") {
                                    const item = entry.data;
                                    const visual = lembreteVisual(item);
                                    return (
                                        <article className="squad-chat-event-card reminder" key={`reminder-${item.id}-${index}`}>
                                            <div className="squad-chat-event-icon reminder-icon">{visual.icon}</div>
                                            <div className="squad-chat-event-copy">
                                                <b>{visual.eyebrow}</b>
                                                <strong>{item.title}</strong>
                                                {item.note && <p>{item.note}</p>}
                                                <small>Hoje</small>
                                            </div>
                                        </article>
                                    );
                                }

                                if (entry.kind === "notification") {
                                    const item = entry.data;
                                    const achievement = encontrarConquistaParaNotificacao(item);
                                    return (
                                        <AchievementCardChat
                                            key={`notification-${item.id}`}
                                            achievement={achievement}
                                            notification={item}
                                        />
                                    );
                                }

                                const message = entry.data;
                                const mine = Number(message.sender?.id) === Number(usuarioSelecionado?.id);
                                return (
                                    <article className={`squad-floating-chat-message ${mine ? "mine" : ""}`} key={`message-${message.id}`}>
                                        {!mine && <Avatar user={message.sender} size="small" />}
                                        <div className="squad-floating-chat-bubble">
                                            <strong>{mine ? "Você" : message.sender?.nickname || message.sender?.name || "SQUAD"}</strong>
                                            <p>{message.message}</p>
                                        </div>
                                    </article>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </div>

                        <form className="squad-floating-chat-composer" onSubmit={enviarMensagemChat}>
                            <textarea
                                value={chatText}
                                onChange={(event) => setChatText(event.target.value)}
                                placeholder="Escreva uma mensagem..."
                                rows="1"
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        enviarMensagemChat(event);
                                    }
                                }}
                            />
                            <button type="submit" disabled={chatSending || !chatText.trim()}>➤</button>
                        </form>
                    </section>
                )}

                <button
                    type="button"
                    className="squad-floating-chat-button"
                    onClick={() => {
                        const abrir = !chatAberto;
                        setChatAberto(abrir);
                        if (abrir) carregarChat(true, true);
                    }}
                    aria-label="Chat do SQUAD"
                >
                    <span>◌</span>
                    {!chatAberto && badgeTotal > 0 && <b>{badgeTotal > 99 ? "99+" : badgeTotal}</b>}
                </button>
            </div>
        );
    }

    function renderPerfil() {
        return (
            <>
                <header className="section-header">
                    <div>
                        <p className="eyebrow">MINHA IDENTIDADE NO SQUAD</p>
                        <h1>Perfil</h1>
                        <p>Sua foto, nome, apelido, função e marcas aparecem no Planner e nos relatórios.</p>
                    </div>
                </header>

                <div className="profile-layout">
                    <section className="profile-card-preview">
                        <Avatar user={usuarioSelecionado} size="xlarge" />
                        <h2>{usuarioSelecionado.nickname || usuarioSelecionado.name}</h2>
                        {usuarioSelecionado.nickname && <p>{usuarioSelecionado.name}</p>}
                        <strong>{usuarioSelecionado.role || "Função ainda não definida"}</strong>
                        <div className="profile-brand-list">
                            {(usuarioSelecionado.brands || []).length ? (
                                usuarioSelecionado.brands.map((marca) => (
                                    <span key={marca} className={`brand-badge ${brandClassName(marca)}`}>
                                        {marca}
                                    </span>
                                ))
                            ) : (
                                <small>Nenhuma marca selecionada</small>
                            )}
                        </div>
                    </section>

                    <form className="profile-form-card" onSubmit={salvarPerfil}>
                        <div className="profile-section-title">
                            <span>PERSONALIZAÇÃO</span>
                            <h2>Editar meu perfil</h2>
                        </div>

                        <label>Foto de perfil</label>
                        <div className="profile-photo-row">
                            <Avatar user={usuarioSelecionado} size="large" />
                            <div>
                                <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.webp"
                                    onChange={(event) => setFotoPerfil(event.target.files?.[0] || null)}
                                />
                                <small>JPG, PNG ou WEBP • até 5 MB</small>
                            </div>
                            {usuarioSelecionado.photo_url && (
                                <button type="button" className="text-danger-button" onClick={removerFotoPerfil}>
                                    Remover foto
                                </button>
                            )}
                        </div>

                        <div className="two-fields">
                            <div>
                                <label>Nome</label>
                                <input
                                    value={perfilForm.name}
                                    onChange={(event) => setPerfilForm({ ...perfilForm, name: event.target.value })}
                                    placeholder="Nome completo"
                                />
                            </div>
                            <div>
                                <label>Apelido</label>
                                <input
                                    value={perfilForm.nickname}
                                    onChange={(event) => setPerfilForm({ ...perfilForm, nickname: event.target.value })}
                                    placeholder="Como prefere aparecer"
                                />
                            </div>
                        </div>

                        <label>Função</label>
                        <input
                            value={perfilForm.role}
                            onChange={(event) => setPerfilForm({ ...perfilForm, role: event.target.value })}
                            placeholder="Ex: Social Media, Designer, Audiovisual..."
                        />

                        <label>Marcas que atende</label>
                        <div className="brand-buttons profile-brands">
                            {MARCAS.map((marca) => (
                                <button
                                    type="button"
                                    key={marca}
                                    className={`brand-option ${brandClassName(marca)} ${perfilForm.brands.includes(marca) ? "selected" : ""}`}
                                    onClick={() => alternarMarcaPerfil(marca)}
                                >
                                    {marca}
                                </button>
                            ))}
                        </div>

                        <button className="primary-button profile-save" disabled={salvandoPerfil}>
                            {salvandoPerfil ? "Salvando..." : "Salvar meu perfil"}
                        </button>
                    </form>
                </div>

                <section className="profile-security-card">
                    <div className="profile-section-title">
                        <span>SEGURANÇA</span>
                        <h2>Alterar minha senha</h2>
                        <p>Sua senha é pessoal e não fica visível para o ADM.</p>
                    </div>

                    <form className="profile-password-form" onSubmit={alterarSenhaPerfil}>
                        <div>
                            <label>Senha atual</label>
                            <input
                                type="password"
                                value={senhaAtualPerfil}
                                onChange={(event) => setSenhaAtualPerfil(event.target.value)}
                                placeholder="Digite sua senha atual"
                            />
                        </div>
                        <div>
                            <label>Nova senha</label>
                            <input
                                type="password"
                                minLength={4}
                                value={novaSenhaPerfil}
                                onChange={(event) => setNovaSenhaPerfil(event.target.value)}
                                placeholder="Mínimo de 4 caracteres"
                            />
                        </div>
                        <div>
                            <label>Confirmar nova senha</label>
                            <input
                                type="password"
                                minLength={4}
                                value={confirmarSenhaPerfil}
                                onChange={(event) => setConfirmarSenhaPerfil(event.target.value)}
                                placeholder="Digite novamente"
                            />
                        </div>
                        <button
                            className="primary-button compact"
                            disabled={
                                salvandoSenhaPerfil ||
                                !senhaAtualPerfil ||
                                !novaSenhaPerfil ||
                                !confirmarSenhaPerfil
                            }
                        >
                            {salvandoSenhaPerfil ? "Alterando..." : "Alterar senha"}
                        </button>
                    </form>
                </section>
            </>
        );
    }

    if (usuarioSelecionado && usuarioEhGestorExterno) {
        return renderPortalGestorExterno();
    }

    function renderNovoColaboradorModal() {
        return (
            <div
                className="simple-overlay"
                onMouseDown={() => setNovoColaboradorAberto(false)}
            >
                <div
                    className="small-modal"
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    <div className="modal-top">
                        <div>
                            <span>NOVO COLABORADOR</span>
                            <h2>Adicionar perfil</h2>
                        </div>
                        <button type="button" onClick={() => setNovoColaboradorAberto(false)}>
                            ×
                        </button>
                    </div>
                    <form onSubmit={criarColaborador}>
                        <label>Nome</label>
                        <input
                            autoFocus
                            value={novoColaboradorNome}
                            onChange={(event) => setNovoColaboradorNome(event.target.value)}
                            placeholder="Ex: Ana Luíza ou Gerente"
                        />

                        <label>Tipo de acesso</label>
                        <select
                            value={novoColaboradorTipo}
                            onChange={(event) =>
                                setNovoColaboradorTipo(event.target.value)
                            }
                        >
                            <option value="colaborador">Colaborador SQUAD</option>
                            <option value="gerente_marketing">Gerente de Marketing</option>
                            <option value="outros_gerentes">Outros Gerentes</option>
                        </select>
                        {novoColaboradorTipo === "outros_gerentes" && (
                            <>
                                <label>Cargo / Gerência</label>
                                <input value={novoColaboradorCargo} onChange={(event) => setNovoColaboradorCargo(event.target.value)} placeholder="Ex: Gerente Comercial" />
                                <label>Setor</label>
                                <input value={novoColaboradorSetor} onChange={(event) => setNovoColaboradorSetor(event.target.value)} placeholder="Ex: Vendas Jeep" />
                                <label>Marca do gerente</label>
                                <select
                                    value={novoColaboradorMarca}
                                    onChange={(event) => setNovoColaboradorMarca(event.target.value)}
                                    required
                                >
                                    <option value="">Selecione a marca</option>
                                    {["Jeep","RAM","Kia","Honda","Premier Seminovos","Shineray","YADEA","Grupo / Geral"].map((marca) => (
                                        <option key={marca} value={marca}>{marca}</option>
                                    ))}
                                </select>
                                <small className="manager-brand-help">
                                    Todos os pedidos desta conta serão vinculados automaticamente a esta marca.
                                </small>
                            </>
                        )}
                        {novoColaboradorTipo === "gerente_marketing" && (
                            <small className="manager-create-help">Único Gestor de Marketing. Ele permanece junto da equipe SQUAD Marketing.</small>
                        )}
                        {novoColaboradorTipo === "outros_gerentes" && (
                            <small className="manager-create-help">Aparecerá somente no Portal de Gestores. Você pode cadastrar quantos precisar.</small>
                        )}

                        <button className="primary-button" type="submit">
                            Criar perfil
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="app">
            <aside className="sidebar">
                <div className="logo">
                    <span>SQUAD</span>
                    <strong>Social Planner</strong>
                </div>

                {usuarioEhGerente && (
                    <div className="manager-portal-sidebar-badge">
                        <span>PORTAL DE GESTORES</span>
                        <small>Aprovações e gestão</small>
                    </div>
                )}

                <div className="current-user">
                    <Avatar user={usuarioSelecionado} size="medium" />
                    <div>
                        <span>PERFIL DE</span>
                        <strong>{usuarioSelecionado.nickname || usuarioSelecionado.name}</strong>
                        {usuarioSelecionado.role && <small>{usuarioSelecionado.role}</small>}

                        {!usuarioEhGerente &&
                            (achievementsData.recent_unlocked || [])
                                .length > 0 && (
                                <div className="sidebar-achievement-seals">
                                    {achievementsData.recent_unlocked
                                        .slice(0, 3)
                                        .map((achievement) => (
                                            <span
                                                key={achievement.key}
                                                title={achievement.title}
                                            >
                                                {achievement.icon}
                                            </span>
                                        ))}
                                </div>
                            )}
                    </div>
                </div>

                {adminImpersonando && (
                    <div className="admin-support-mode">
                        <span>MODO DE SUPORTE ADM</span>
                        <strong>Você está dentro desta conta</strong>
                        <small>Alterações feitas aqui afetam o perfil normalmente.</small>
                        <button type="button" onClick={voltarParaAreaAdmin}>
                            ← Voltar à Área ADM
                        </button>
                    </div>
                )}

                {!usuarioEhGerente && (
                    <button className="new-content" onClick={() => abrirDia(new Date())}>
                        <span>+</span> Novo conteúdo
                    </button>
                )}

                <nav>
                    {usuarioEhGerente ? (
                        <>
                            <button
                                className={abaAtiva === "pedidos-gerentes" ? "active" : ""}
                                onClick={() => { setAbaAtiva("pedidos-gerentes"); carregarPedidosGerentes(true); }}
                            >
                                <span>▣</span> Pedidos de Gerentes
                                {pedidosGerentes.filter((item) => item.status === "Recebido").length > 0 && (
                                    <b className="notification-badge manager-notification-badge">{pedidosGerentes.filter((item) => item.status === "Recebido").length}</b>
                                )}
                            </button>
                            <button
                                className={abaAtiva === "aprovacoes" ? "active" : ""}
                                onClick={() => {
                                    setAbaAtiva("aprovacoes");
                                    carregarAprovacoesGerente(
                                        usuarioSelecionado.id,
                                        true
                                    );
                                }}
                            >
                                <span>✓</span> Solicitações de Aprovação
                                {Number(managerApprovals.total || 0) > 0 && (
                                    <b className="notification-badge manager-notification-badge">
                                        {managerApprovals.total}
                                    </b>
                                )}
                            </button>
                            <button
                                className={abaAtiva === "relatorios" ? "active" : ""}
                                onClick={() => setAbaAtiva("relatorios")}
                            >
                                <span>▥</span> Relatórios
                            </button>
                            <button
                                className={abaAtiva === "perfil" ? "active" : ""}
                                onClick={() => setAbaAtiva("perfil")}
                            >
                                <span>●</span> Perfil
                            </button>
                        </>
                    ) : (
                        <>
                            <button className={abaAtiva === "calendario" ? "active" : ""} onClick={() => setAbaAtiva("calendario")}>
                                <span>◫</span> Calendário
                            </button>
                            <button
                                className={abaAtiva === "conteudos" ? "active" : ""}
                                onClick={() => setAbaAtiva("conteudos")}
                            >
                                <span>▤</span> Conteúdos
                                {Number(notificationsData.unread_social || 0) > 0 && (
                                    <b className="notification-badge">
                                        {notificationsData.unread_social}
                                    </b>
                                )}
                            </button>
                            <button
                                className={abaAtiva === "criativa" ? "active" : ""}
                                onClick={() => {
                                    setAbaAtiva("criativa");
                                    setCreativeTab("recebidos");
                                }}
                            >
                                <span>◆</span> Central Criativa
                                {Number(creativeData.unread_count || 0) +
                                    Number(notificationsData.unread_design || 0) >
                                    0 && (
                                    <b className="notification-badge">
                                        {Number(creativeData.unread_count || 0) +
                                            Number(
                                                notificationsData.unread_design ||
                                                    0
                                            )}
                                    </b>
                                )}
                            </button>
                            <button className={abaAtiva === "lembretes" ? "active" : ""} onClick={() => setAbaAtiva("lembretes")}>
                                <span>◉</span> Lembretes
                                {totalLembretesAtivos > 0 && (
                                    <b className="notification-badge">{totalLembretesAtivos}</b>
                                )}
                            </button>
                            <button
                                className={
                                    abaAtiva === "conquistas"
                                        ? "active"
                                        : ""
                                }
                                onClick={() => {
                                    setAbaAtiva("conquistas");
                                    carregarConquistas(true);
                                }}
                            >
                                <span>🏆</span> Conquistas
                            </button>
                            <button
                                className={
                                    abaAtiva === "desempenho"
                                        ? "active"
                                        : ""
                                }
                                onClick={() => {
                                    setAbaAtiva("desempenho");
                                    carregarMonthlyOverview(true);
                                }}
                            >
                                <span>▥</span> Desempenho
                            </button>
                            <button className={abaAtiva === "perfil" ? "active" : ""} onClick={() => setAbaAtiva("perfil")}>
                                <span>●</span> Perfil
                            </button>
                        </>
                    )}
                </nav>

                <button
                    className={`switch-user ${adminImpersonando ? "admin-return" : ""}`}
                    onClick={adminImpersonando ? voltarParaAreaAdmin : sairUsuario}
                >
                    {adminImpersonando ? "← Voltar à Área ADM" : "Sair / trocar usuário"}
                </button>
            </aside>

            <main className="main">
                {abaAtiva === "conquistas" && renderAchievements()}
                {!usuarioEhGerente && abaAtiva === "desempenho" && renderAchievements("performance")}
                {usuarioEhGerente && abaAtiva === "pedidos-gerentes" && renderPedidosGerentesMarketing()}
                {usuarioEhGerente && abaAtiva === "aprovacoes" &&
                    renderAprovacoesGerente()}
                {!usuarioEhGerente && abaAtiva === "calendario" && renderCalendario()}
                {!usuarioEhGerente && abaAtiva === "conteudos" && renderConteudos()}
                {!usuarioEhGerente && abaAtiva === "criativa" && renderCentralCriativa()}
                {!usuarioEhGerente && abaAtiva === "lembretes" && renderLembretes()}
                {usuarioEhGerente &&
                    abaAtiva === "relatorios" &&
                    renderRelatorios()}
                {abaAtiva === "perfil" && renderPerfil()}
            </main>

            {renderChatFlutuante()}

            {toastNotification && !usuarioEhGerente && (
                <button
                    type="button"
                    className={`squad-toast-notification toast-${toastNotification.category} toast-event-${toastNotification.event_type}`}
                    onClick={() =>
                        abrirNotificacao(toastNotification)
                    }
                >
                    <div className="squad-toast-icon">
                        {toastNotification.entity_type ===
                        "achievement"
                            ? "🏆"
                            : toastNotification.entity_type === "summary"
                              ? "★"
                              : toastNotification.event_type.includes(
                                    "approved"
                              )
                              ? "✓"
                              : toastNotification.event_type.includes(
                                      "changes"
                                )
                                ? "!"
                                : "↶"}
                    </div>

                    <div>
                        <span>
                            {toastNotification.entity_type ===
                            "achievement"
                                ? "CONQUISTA DO SQUAD"
                                : toastNotification.entity_type ===
                                    "summary"
                                  ? "RESUMO DO SQUAD"
                                  : "RETORNO DA GERÊNCIA"}
                        </span>
                        <strong>{toastNotification.title}</strong>
                        <p>{toastNotification.message}</p>
                        <small>
                            {toastNotification.entity_type ===
                            "achievement"
                                ? "Clique para ver suas conquistas"
                                : "Clique para abrir"}
                        </small>
                    </div>

                    <i />
                </button>
            )}

            {managerDetailContent && (
                <div
                    className="simple-overlay manager-detail-overlay"
                    onMouseDown={() => setManagerDetailContent(null)}
                >
                    <div
                        className="manager-detail-modal"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="manager-detail-top">
                            <div>
                                <span>
                                    {labelEtapaAprovacao(managerDetailContent).toUpperCase()}
                                </span>
                                <h2>{managerDetailContent.title}</h2>
                                <p>
                                    Enviado por{" "}
                                    <strong>
                                        {managerDetailContent.owner?.nickname ||
                                            managerDetailContent.owner?.name ||
                                            managerDetailContent.responsible ||
                                            "Colaborador"}
                                    </strong>
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setManagerDetailContent(null)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="manager-detail-summary">
                            <div>
                                <span>DATA</span>
                                <strong>
                                    {dataDaChave(
                                        managerDetailContent.date
                                    ).toLocaleDateString("pt-BR")}
                                </strong>
                            </div>
                            <div>
                                <span>MARCA</span>
                                <strong>
                                    {managerDetailContent.brands?.join(" + ") ||
                                        "Não informada"}
                                </strong>
                            </div>
                            <div>
                                <span>FORMATO</span>
                                <strong>
                                    {managerDetailContent.format || "Não informado"}
                                </strong>
                            </div>
                            <div>
                                <span>STATUS</span>
                                <strong>
                                    {managerDetailContent.status || "Não informado"}
                                </strong>
                            </div>
                            <div>
                                <span>URGÊNCIA</span>
                                <strong>
                                    {nomeUrgencia(
                                        managerDetailContent.urgency || "verde"
                                    )}
                                </strong>
                            </div>
                        </div>

                        <div className="manager-detail-content-grid">
                            <section>
                                <span>BRIEFING / DESCRIÇÃO</span>
                                <div className="manager-detail-text">
                                    {managerDetailContent.description ||
                                        "Nenhum briefing foi preenchido."}
                                </div>
                            </section>

                            <section>
                                <span>COPY / LEGENDA</span>
                                <div className="manager-detail-text">
                                    {managerDetailContent.copy_text ||
                                        "Nenhuma copy ou legenda foi preenchida."}
                                </div>
                            </section>
                        </div>

                        <section className="manager-detail-links">
                            <span>LINKS DE REFERÊNCIA</span>
                            {linksValidos(
                                managerDetailContent.reference_link || ""
                            ).length > 0 ? (
                                <div>
                                    {linksValidos(
                                        managerDetailContent.reference_link || ""
                                    ).map((link) => (
                                        <a
                                            href={link}
                                            target="_blank"
                                            rel="noreferrer"
                                            key={link}
                                        >
                                            {link}
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <p>Nenhum link de referência informado.</p>
                            )}
                        </section>

                        <section className="manager-detail-files">
                            <div className="manager-detail-section-title">
                                <div>
                                    <span>ARQUIVOS DO CONTEÚDO</span>
                                    <h3>Materiais para aprovação</h3>
                                </div>
                                <strong>
                                    {managerDetailContent.files?.length || 0}
                                </strong>
                            </div>

                            {(managerDetailContent.video_retention_expires_at ||
                                managerDetailContent.video_files_purged_at) && (
                                <div
                                    className={`manager-video-retention ${
                                        managerDetailContent.video_files_purged_at
                                            ? "expired"
                                            : ""
                                    }`}
                                >
                                    <span>VÍDEOS</span>
                                    <strong>
                                        {managerDetailContent.video_files_purged_at
                                            ? `Arquivos de vídeo removidos automaticamente em ${new Date(
                                                  managerDetailContent.video_files_purged_at
                                              ).toLocaleDateString("pt-BR")}.`
                                            : `Disponíveis no SQUAD até ${new Date(
                                                  managerDetailContent.video_retention_expires_at
                                              ).toLocaleDateString("pt-BR")}.`}
                                    </strong>
                                    <small>
                                        O conteúdo, copy, métricas e histórico permanecem
                                        normalmente no sistema.
                                    </small>
                                </div>
                            )}

                            {renderCreativeLibrary(
                                managerDetailContent.files || [],
                                {
                                    compact: false,
                                    manager: true,
                                }
                            )}
                        </section>

                        {managerDetailContent.manager_note && (
                            <section className="manager-detail-note">
                                <span>OBSERVAÇÃO ANTERIOR</span>
                                <p>{managerDetailContent.manager_note}</p>
                            </section>
                        )}

                        <section className="manager-two-stage-approval">
                            <div className="manager-two-stage-heading">
                                <div>
                                    <span>FLUXO DE APROVAÇÃO</span>
                                    <h3>As 2 decisões ficam disponíveis aqui</h3>
                                    <p>
                                        Se o conteúdo final já estiver anexado, o
                                        gerente pode analisar a segunda etapa no
                                        mesmo lugar.
                                    </p>
                                </div>
                            </div>

                            <div className="manager-two-stage-grid">
                                <article
                                    className={`manager-decision-card ${
                                        managerDetailContent.idea_approval_status ===
                                        "aprovado"
                                            ? "approved"
                                            : managerDetailContent.approval_stage ===
                                                "idea"
                                              ? "waiting"
                                              : managerDetailContent.idea_approval_status ===
                                                  "alteracao"
                                                ? "adjust"
                                                : "ready"
                                    }`}
                                >
                                    <div className="manager-decision-number">
                                        01
                                    </div>

                                    <div className="manager-decision-body">
                                        <span>PRIMEIRA DECISÃO</span>
                                        <h4>Aprovação da ideia</h4>

                                        {managerDetailContent.idea_approval_status ===
                                        "aprovado" ? (
                                            <p>
                                                ✓ Ideia aprovada. O conteúdo está
                                                liberado para produção.
                                            </p>
                                        ) : managerDetailContent.approval_stage ===
                                          "idea" ? (
                                            <p>
                                                A ideia está aguardando sua decisão.
                                            </p>
                                        ) : managerDetailContent.idea_approval_status ===
                                          "alteracao" ? (
                                            <p>
                                                Você solicitou ajustes na ideia.
                                            </p>
                                        ) : (
                                            <p>
                                                Briefing, roteiro, conceito e copy
                                                inicial.
                                            </p>
                                        )}

                                        <div className="manager-decision-actions">
                                            {managerDetailContent.idea_approval_status ===
                                            "aprovado" ? (
                                                <button
                                                    type="button"
                                                    className="undo-approval-button"
                                                    disabled={
                                                        Boolean(
                                                            managerDetailContent.is_live
                                                        ) ||
                                                        managerDetailContent.approval_status ===
                                                            "aprovado"
                                                    }
                                                    onClick={() =>
                                                        desfazerAprovacaoConteudo(
                                                            managerDetailContent,
                                                            "idea"
                                                        )
                                                    }
                                                >
                                                    ↶ Desfazer aprovação da ideia
                                                </button>
                                            ) : managerDetailContent.approval_stage ===
                                                  "idea" &&
                                              managerDetailContent.idea_approval_status ===
                                                  "pendente" ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="approve-button"
                                                        onClick={() =>
                                                            aprovarConteudo(
                                                                managerDetailContent.id,
                                                                "idea"
                                                            )
                                                        }
                                                    >
                                                        ✓ Aprovar ideia
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="reject-button"
                                                        onClick={() =>
                                                            recusarConteudo(
                                                                managerDetailContent.id,
                                                                "idea"
                                                            )
                                                        }
                                                    >
                                                        ✕ Recusar
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="review-button"
                                                        onClick={() => {
                                                            const id =
                                                                managerDetailContent.id;
                                                            setManagerDetailContent(
                                                                null
                                                            );
                                                            abrirRevisao(
                                                                id,
                                                                "idea"
                                                            );
                                                        }}
                                                    >
                                                        ↻ Revisar
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="manager-decision-muted">
                                                    Aguardando envio da ideia
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </article>

                                <article
                                    className={`manager-decision-card ${
                                        managerDetailContent.approval_status ===
                                        "aprovado"
                                            ? "approved"
                                            : managerDetailContent.approval_stage ===
                                                "final"
                                              ? "waiting"
                                              : managerDetailContent.approval_status ===
                                                  "alteracao"
                                                ? "adjust"
                                                : managerDetailContent.idea_approval_status ===
                                                      "aprovado" &&
                                                  (managerDetailContent.files || [])
                                                      .length > 0
                                                  ? "ready-final"
                                                  : "locked"
                                    }`}
                                >
                                    <div className="manager-decision-number">
                                        02
                                    </div>

                                    <div className="manager-decision-body">
                                        <span>SEGUNDA DECISÃO</span>
                                        <h4>Aprovação do conteúdo final</h4>

                                        {managerDetailContent.approval_status ===
                                        "aprovado" ? (
                                            <p>
                                                ✓ Conteúdo final aprovado. Está
                                                liberado para agendamento.
                                            </p>
                                        ) : managerDetailContent.approval_stage ===
                                          "final" ? (
                                            <p>
                                                O arquivo final foi enviado e está
                                                aguardando sua decisão.
                                            </p>
                                        ) : managerDetailContent.idea_approval_status !==
                                          "aprovado" ? (
                                            <p>
                                                Primeiro aprove a ideia para liberar
                                                esta etapa.
                                            </p>
                                        ) : (managerDetailContent.files || [])
                                              .length > 0 ? (
                                            <p>
                                                O arquivo já está anexado. Você pode
                                                aprovar o conteúdo final agora, mesmo
                                                que o colaborador ainda não tenha
                                                enviado formalmente a segunda etapa.
                                            </p>
                                        ) : (
                                            <p>
                                                Aguardando o colaborador anexar o
                                                arquivo final.
                                            </p>
                                        )}

                                        <div className="manager-decision-actions">
                                            {managerDetailContent.approval_status ===
                                            "aprovado" ? (
                                                <button
                                                    type="button"
                                                    className="undo-approval-button"
                                                    disabled={Boolean(
                                                        managerDetailContent.is_live
                                                    )}
                                                    onClick={() =>
                                                        desfazerAprovacaoConteudo(
                                                            managerDetailContent,
                                                            "final"
                                                        )
                                                    }
                                                >
                                                    ↶ Desfazer aprovação final
                                                </button>
                                            ) : managerDetailContent.idea_approval_status ===
                                                  "aprovado" &&
                                              (managerDetailContent.files || [])
                                                  .length > 0 ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="approve-button final-approve-button"
                                                        onClick={() =>
                                                            aprovarConteudo(
                                                                managerDetailContent.id,
                                                                "final"
                                                            )
                                                        }
                                                    >
                                                        ✓ Aprovar conteúdo final
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="reject-button"
                                                        onClick={() =>
                                                            recusarConteudo(
                                                                managerDetailContent.id,
                                                                "final"
                                                            )
                                                        }
                                                    >
                                                        ✕ Recusar
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="review-button"
                                                        onClick={() => {
                                                            const id =
                                                                managerDetailContent.id;
                                                            setManagerDetailContent(
                                                                null
                                                            );
                                                            abrirRevisao(
                                                                id,
                                                                "final"
                                                            );
                                                        }}
                                                    >
                                                        ↻ Revisar
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="manager-decision-muted">
                                                    {managerDetailContent.idea_approval_status !==
                                                    "aprovado"
                                                        ? "Bloqueado até a aprovação da ideia"
                                                        : "Aguardando arquivo final"}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            </div>
                        </section>
                    </div>
                </div>
            )}

            {creativeModalOpen && (
                <div className="simple-overlay" onMouseDown={() => setCreativeModalOpen(false)}>
                    <div className="creative-modal" onMouseDown={(event) => event.stopPropagation()}>
                        <div className="modal-top">
                            <div>
                                <span>CENTRAL CRIATIVA</span>
                                <h2>{creativeActiveJob ? "Produção criativa" : "Nova produção"}</h2>
                            </div>
                            <button type="button" onClick={() => setCreativeModalOpen(false)}>×</button>
                        </div>

                        <div className="creative-modal-grid">
                            <form className="creative-form" onSubmit={salvarProducaoCriativa}>
                                {creativeActiveJob && (
                                    <div className={`creative-modal-status ${creativeStatusClass(creativeActiveJob.status)}`}>
                                        <span>STATUS</span>
                                        <strong>{creativeStatusLabel(creativeActiveJob.status)}</strong>
                                        {creativeActiveJob.manager_note && (
                                            <p>{creativeActiveJob.manager_note}</p>
                                        )}
                                    </div>
                                )}

                                <label>Título da demanda</label>
                                <input
                                    value={creativeForm.title}
                                    disabled={creativeActiveJob?.status === "aguardando_aprovacao" || creativeActiveJob?.status === "aprovado"}
                                    onChange={(event) => setCreativeForm({ ...creativeForm, title: event.target.value })}
                                    placeholder="Ex: Campanha Honda Consórcio Setembro"
                                />

                                <div className="two-fields">
                                    <div>
                                        <label>Marca</label>
                                        <select
                                            value={creativeForm.brand}
                                            disabled={creativeActiveJob?.status === "aguardando_aprovacao" || creativeActiveJob?.status === "aprovado"}
                                            onChange={(event) => setCreativeForm({ ...creativeForm, brand: event.target.value })}
                                        >
                                            {MARCAS.map((brand) => <option key={brand}>{brand}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label>Tipo de peça</label>
                                        <select
                                            value={creativeForm.creative_type}
                                            disabled={creativeActiveJob?.status === "aguardando_aprovacao" || creativeActiveJob?.status === "aprovado"}
                                            onChange={(event) => setCreativeForm({ ...creativeForm, creative_type: event.target.value })}
                                        >
                                            {CREATIVE_TYPES.map((type) => <option key={type}>{type}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="two-fields">
                                    <div>
                                        <label>Quantidade de peças</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={creativeForm.quantity}
                                            disabled={creativeActiveJob?.status === "aguardando_aprovacao" || creativeActiveJob?.status === "aprovado"}
                                            onChange={(event) => setCreativeForm({ ...creativeForm, quantity: Number(event.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label>Prazo</label>
                                        <input
                                            type="date"
                                            value={creativeForm.deadline}
                                            disabled={creativeActiveJob?.status === "aguardando_aprovacao" || creativeActiveJob?.status === "aprovado"}
                                            onChange={(event) => setCreativeForm({ ...creativeForm, deadline: event.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="creative-recipient-label">
                                    <label>Entregar para</label>
                                    <small>
                                        Somente colaboradores. Você decide abaixo se a produção
                                        precisa ou não de aprovação gerencial.
                                    </small>
                                </div>

                                <select
                                    value={
                                        creativeRecipients(usuarios).some(
                                            (user) =>
                                                Number(user.id) ===
                                                Number(creativeForm.recipient_user_id)
                                        )
                                            ? creativeForm.recipient_user_id
                                            : ""
                                    }
                                    disabled={
                                        creativeActiveJob?.status ===
                                            "aguardando_aprovacao" ||
                                        creativeActiveJob?.status === "aprovado"
                                    }
                                    onChange={(event) =>
                                        setCreativeForm({
                                            ...creativeForm,
                                            recipient_user_id: event.target.value,
                                        })
                                    }
                                >
                                    <option value="">Selecione o colaborador</option>
                                    {creativeRecipients(usuarios).map((user) => (
                                        <option key={user.id} value={user.id}>
                                            {user.nickname || user.name}
                                            {user.id === usuarioSelecionado?.id
                                                ? " (eu)"
                                                : ""}
                                        </option>
                                    ))}
                                </select>

                                <label>Aprovação gerencial</label>
                                <div className="approval-requirement-choice creative-approval-choice">
                                    <button
                                        type="button"
                                        disabled={
                                            creativeActiveJob?.status ===
                                                "aguardando_aprovacao" ||
                                            creativeActiveJob?.status === "aprovado"
                                        }
                                        className={
                                            creativeForm.approval_required
                                                ? "selected"
                                                : ""
                                        }
                                        onClick={() =>
                                            setCreativeForm({
                                                ...creativeForm,
                                                approval_required: true,
                                            })
                                        }
                                    >
                                        <strong>Necessária</strong>
                                        <small>
                                            O Gerente de Marketing aprova antes da entrega.
                                        </small>
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            creativeActiveJob?.status ===
                                                "aguardando_aprovacao" ||
                                            creativeActiveJob?.status === "aprovado"
                                        }
                                        className={
                                            !creativeForm.approval_required
                                                ? "selected direct"
                                                : ""
                                        }
                                        onClick={() =>
                                            setCreativeForm({
                                                ...creativeForm,
                                                approval_required: false,
                                            })
                                        }
                                    >
                                        <strong>Não necessária</strong>
                                        <small>
                                            A arte é entregue direto ao colaborador.
                                        </small>
                                    </button>
                                </div>

                                <div className={`creative-approval-explainer ${creativeForm.approval_required ? "required" : "direct"}`}>
                                    <span>{creativeForm.approval_required ? "✓" : "→"}</span>
                                    <div>
                                        <strong>
                                            {creativeForm.approval_required
                                                ? "Fluxo com aprovação"
                                                : "Entrega direta"}
                                        </strong>
                                        <small>
                                            {creativeForm.approval_required
                                                ? "Após enviar os arquivos finais, a produção entra em Solicitações de Aprovação do Gerente de Marketing."
                                                : "Após enviar os arquivos finais e concluir, o material vai direto para o colaborador selecionado e não entra na fila do gerente."}
                                        </small>
                                    </div>
                                </div>

                                <label>Briefing / observações</label>
                                <textarea
                                    value={creativeForm.briefing}
                                    disabled={creativeActiveJob?.status === "aguardando_aprovacao" || creativeActiveJob?.status === "aprovado"}
                                    onChange={(event) => setCreativeForm({ ...creativeForm, briefing: event.target.value })}
                                    placeholder="Descreva o que está sendo produzido, tamanhos, aplicações ou observações importantes..."
                                />

                                {(!creativeActiveJob || ["em_producao", "ajuste"].includes(creativeActiveJob.status)) && (
                                    <button className="primary-button full" disabled={creativeSaving}>
                                        {creativeSaving ? "Salvando..." : creativeActiveJob ? "Salvar dados" : "Criar produção"}
                                    </button>
                                )}

                                {creativeActiveJob &&
                                    podeExcluirDemandaCriativa(
                                        creativeActiveJob
                                    ) && (
                                        <button
                                            type="button"
                                            className="creative-delete-job-modal-button"
                                            onClick={() =>
                                                excluirDemandaCriativa(
                                                    creativeActiveJob
                                                )
                                            }
                                        >
                                            Excluir demanda criativa
                                        </button>
                                    )}
                            </form>

                            <section className="creative-files-panel">
                                <div className="form-section-title">
                                    <span>ARQUIVOS DE PRODUÇÃO</span>
                                    <h3>Artes e materiais finais</h3>
                                    <p>JPG, PNG, WEBP, GIF, MP4, MOV, WebM ou PDF.</p>
                                </div>

                                {!creativeActiveJob ? (
                                    <div className="creative-save-first">Salve a produção para liberar os arquivos.</div>
                                ) : (
                                    <>
                                        {["em_producao", "ajuste"].includes(creativeActiveJob.status) && (
                                            <div className="creative-upload-box">
                                                <input
                                                    ref={creativeFileInputRef}
                                                    type="file"
                                                    multiple
                                                    onChange={(event) =>
                                                        setCreativeFilesSelected(
                                                            Array.from(
                                                                event.target.files ||
                                                                    []
                                                            )
                                                        )
                                                    }
                                                />
                                                <span>
                                                    {creativeFilesSelected.length
                                                        ? `${creativeFilesSelected.length} arquivo(s) selecionado(s)`
                                                        : "Selecione os arquivos finais"}
                                                </span>
                                                <button type="button" onClick={enviarArquivosCriativos} disabled={creativeUploading}>
                                                    {creativeUploading ? "Enviando..." : "Enviar arquivos"}
                                                </button>
                                            </div>
                                        )}

                                        {renderCreativeLibrary(
                                            creativeActiveJob.files,
                                            {
                                                allowRemove: [
                                                    "em_producao",
                                                    "ajuste",
                                                ].includes(
                                                    creativeActiveJob.status
                                                ),
                                                selectable: true,
                                            }
                                        )}

                                        {["em_producao", "ajuste"].includes(creativeActiveJob.status) && (
                                            <button
                                                type="button"
                                                className="creative-submit-button"
                                                onClick={enviarCriativoParaAprovacao}
                                                disabled={!creativeActiveJob.files?.length}
                                            >
                                                {creativeActiveJob.approval_required !== false
                                                    ? "Enviar para aprovação do gerente"
                                                    : "Finalizar e entregar ao colaborador"}
                                            </button>
                                        )}

                                        {creativeActiveJob.status === "aguardando_aprovacao" && (
                                            <div className="creative-awaiting-box">
                                                <span>✓</span>
                                                <div>
                                                    <strong>Enviado para aprovação</strong>
                                                    <p>O destinatário ainda não recebeu os arquivos. A entrega acontece somente após a aprovação gerencial.</p>
                                                </div>
                                            </div>
                                        )}

                                        {creativeActiveJob.status === "aprovado" && (
                                            <div className="creative-approved-box">
                                                <span>✓</span>
                                                <div>
                                                    <strong>
                                                        {creativeActiveJob.approval_required === false
                                                            ? "Entregue sem aprovação gerencial"
                                                            : "Aprovado e entregue"}
                                                    </strong>
                                                    <p>
                                                        {creativeActiveJob.approval_required === false
                                                            ? `Disponível diretamente para ${creativeActiveJob.recipient?.nickname || creativeActiveJob.recipient?.name || creativeActiveJob.recipient_name} desde ${formatDateTime(creativeActiveJob.delivered_at || creativeActiveJob.approved_at)}.`
                                                            : `Disponível para ${creativeActiveJob.recipient?.nickname || creativeActiveJob.recipient?.name || creativeActiveJob.recipient_name} desde ${formatDateTime(creativeActiveJob.approved_at)}.`}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </section>
                        </div>
                    </div>
                </div>
            )}

            {creativeDuplicateDialog && (
                <div
                    className="simple-overlay creative-duplicate-overlay"
                    onMouseDown={() =>
                        setCreativeDuplicateDialog(null)
                    }
                >
                    <section
                        className="creative-duplicate-modal"
                        onMouseDown={(event) =>
                            event.stopPropagation()
                        }
                    >
                        <div className="modal-top">
                            <div>
                                <span>ARQUIVO COM O MESMO NOME</span>
                                <h2>Como deseja continuar?</h2>
                                <p>
                                    Já existe nesta produção pelo menos um
                                    arquivo com o mesmo nome.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setCreativeDuplicateDialog(null)
                                }
                            >
                                ×
                            </button>
                        </div>

                        <div className="creative-duplicate-files">
                            {creativeDuplicateDialog.names.map(
                                (name) => (
                                    <div key={name}>
                                        <span>!</span>
                                        <strong>{name}</strong>
                                    </div>
                                )
                            )}
                        </div>

                        <p className="creative-duplicate-help">
                            Você pode substituir a versão que já está
                            salva ou manter os dois arquivos na
                            produção.
                        </p>

                        <div className="creative-duplicate-actions">
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                    resolverDuplicidadeCriativa(
                                        "cancel"
                                    )
                                }
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                className="keep-both"
                                onClick={() =>
                                    resolverDuplicidadeCriativa(
                                        "keep"
                                    )
                                }
                                disabled={creativeUploading}
                            >
                                Manter os 2
                            </button>

                            <button
                                type="button"
                                className="replace-file"
                                onClick={() =>
                                    resolverDuplicidadeCriativa(
                                        "replace"
                                    )
                                }
                                disabled={creativeUploading}
                            >
                                Substituir
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {creativeGallery?.files?.length > 0 && (
                <div
                    className="creative-gallery-overlay"
                    onMouseDown={() => setCreativeGallery(null)}
                >
                    <div
                        className="creative-gallery-viewer"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="creative-gallery-top">
                            <div>
                                <span>BIBLIOTECA VISUAL</span>
                                <strong>
                                    {
                                        creativeGallery.files[
                                            creativeGallery.index
                                        ]?.original_name
                                    }
                                </strong>
                                <small>
                                    {creativeGallery.index + 1} de{" "}
                                    {creativeGallery.files.length}
                                </small>
                            </div>

                            <div className="creative-gallery-actions">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            await baixarArquivoComNomeOriginal(
                                                creativeGallery.files[
                                                    creativeGallery.index
                                                ],
                                                "creative"
                                            );
                                        } catch (error) {
                                            alert(error.message);
                                        }
                                    }}
                                >
                                    ↓ Baixar
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setCreativeGallery(null)}
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        <div className="creative-gallery-stage">
                            {creativeGallery.files.length > 1 && (
                                <button
                                    type="button"
                                    className="creative-gallery-nav prev"
                                    onClick={() =>
                                        navegarGaleriaCriativa(-1)
                                    }
                                >
                                    ‹
                                </button>
                            )}

                            <img
                                src={
                                    creativeGallery.files[
                                        creativeGallery.index
                                    ]?.url
                                }
                                alt={
                                    creativeGallery.files[
                                        creativeGallery.index
                                    ]?.original_name
                                }
                            />

                            {creativeGallery.files.length > 1 && (
                                <button
                                    type="button"
                                    className="creative-gallery-nav next"
                                    onClick={() =>
                                        navegarGaleriaCriativa(1)
                                    }
                                >
                                    ›
                                </button>
                            )}
                        </div>

                        {creativeGallery.files.length > 1 && (
                            <div className="creative-gallery-thumbs">
                                {creativeGallery.files.map(
                                    (file, index) => (
                                        <button
                                            type="button"
                                            key={file.id}
                                            className={
                                                index ===
                                                creativeGallery.index
                                                    ? "active"
                                                    : ""
                                            }
                                            onClick={() =>
                                                setCreativeGallery(
                                                    (current) => ({
                                                        ...current,
                                                        index,
                                                    })
                                                )
                                            }
                                        >
                                            <img
                                                src={file.url}
                                                alt={file.original_name}
                                                loading="lazy"
                                            />
                                        </button>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {planejamentoAberto && diaSelecionado && (
                <div
                    className="planner-overlay"
                    onMouseDown={() => setPlanejamentoAberto(false)}
                >
                    <div
                        className="day-planner"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="day-planner-header">
                            <div>
                                <span>PLANEJAMENTO DO DIA</span>
                                <h2>
                                    {dataDaChave(diaSelecionado).toLocaleDateString("pt-BR", {
                                        weekday: "long",
                                        day: "2-digit",
                                        month: "long",
                                        year: "numeric",
                                    })}
                                </h2>
                            </div>
                            <button onClick={() => setPlanejamentoAberto(false)}>×</button>
                        </div>

                        <div className="planner-grid">
                            <section className="quick-form">
                                <div className="planner-type-heading">
                                    <span>NOVO PLANEJAMENTO</span>
                                    <h3>O que você vai criar?</h3>
                                    <p>
                                        Escolha o fluxo correto antes de começar.
                                    </p>
                                </div>

                                <div className="planner-type-switch">
                                    <button
                                        type="button"
                                        className={tipoPlanejamento === "social" ? "active social" : "social"}
                                        onClick={() => setTipoPlanejamento("social")}
                                    >
                                        <span className="planner-type-icon">●</span>
                                        <div>
                                            <strong>Social Media</strong>
                                            <small>Planejamento para redes sociais</small>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        className="designer"
                                        onClick={abrirDesignerDoDia}
                                    >
                                        <span className="planner-type-icon">◆</span>
                                        <div>
                                            <strong>Designer</strong>
                                            <small>Produção de arte / demanda criativa</small>
                                        </div>
                                    </button>
                                </div>

                                <div className="planner-flow-note">
                                    <span>SOCIAL MEDIA</span>
                                    <strong>Este conteúdo ficará na sua agenda e na aba Conteúdos.</strong>
                                    <small>
                                        O responsável é automaticamente {usuarioSelecionado?.nickname || usuarioSelecionado?.name}.
                                    </small>
                                </div>

                                <form onSubmit={salvarConteudo}>
                                    <label>Título</label>
                                    <input
                                        value={form.titulo}
                                        onChange={(event) =>
                                            setForm({ ...form, titulo: event.target.value })
                                        }
                                    />

                                    <label>Marca</label>
                                    <div className="brand-buttons">
                                        {MARCAS.map((marca) => (
                                            <button
                                                type="button"
                                                key={marca}
                                                className={`brand-option ${brandClassName(marca)} ${
                                                    form.marcas.includes(marca) ? "selected" : ""
                                                }`}
                                                onClick={() => alternarMarca(marca)}
                                            >
                                                {marca}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="two-fields">
                                        <div>
                                            <label>Formato</label>
                                            <select
                                                value={form.formato}
                                                onChange={(event) =>
                                                    setForm({
                                                        ...form,
                                                        formato: event.target.value,
                                                    })
                                                }
                                            >
                                                {FORMATOS.map((item) => (
                                                    <option key={item}>{item}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label>Etapa inicial</label>
                                            <div className="initial-status-card">
                                                <strong>
                                                    {form.approval_required
                                                        ? "Ideia"
                                                        : "Publicação direta"}
                                                </strong>
                                                <span>
                                                    {form.approval_required
                                                        ? "Depois você envia a ideia para aprovação do gerente."
                                                        : "Não exige aprovação gerencial. O NO AR ficará liberado."}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <label>Aprovação gerencial</label>
                                    <div className="approval-requirement-choice">
                                        <button
                                            type="button"
                                            className={
                                                form.approval_required
                                                    ? "selected"
                                                    : ""
                                            }
                                            onClick={() =>
                                                setForm({
                                                    ...form,
                                                    approval_required: true,
                                                })
                                            }
                                        >
                                            <strong>Necessária</strong>
                                            <small>
                                                Segue o fluxo normal de aprovação.
                                            </small>
                                        </button>

                                        <button
                                            type="button"
                                            className={
                                                !form.approval_required
                                                    ? "selected direct"
                                                    : ""
                                            }
                                            onClick={() =>
                                                setForm({
                                                    ...form,
                                                    approval_required: false,
                                                })
                                            }
                                        >
                                            <strong>Não necessária</strong>
                                            <small>
                                                Libera o conteúdo para NO AR sem gerente.
                                            </small>
                                        </button>
                                    </div>

                                    <label>Urgência</label>
                                    <div className="urgency-buttons">
                                        {URGENCIAS.map((urgency) => (
                                            <button
                                                type="button"
                                                key={urgency.value}
                                                className={`${urgency.value} ${
                                                    form.urgencia === urgency.value
                                                        ? "selected"
                                                        : ""
                                                }`}
                                                onClick={() =>
                                                    setForm({
                                                        ...form,
                                                        urgencia: urgency.value,
                                                    })
                                                }
                                            >
                                                <i /> {urgency.label}
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        className="primary-button full"
                                        disabled={salvando}
                                    >
                                        {salvando
                                            ? "Salvando..."
                                            : "+ Adicionar ao planejamento"}
                                    </button>
                                </form>
                            </section>

                            <section className="day-list">
                                <div className="day-list-header">
                                    <div>
                                        <span>SOCIAL MEDIA DO DIA</span>
                                        <h3>Conteúdos planejados</h3>
                                    </div>
                                    <strong>{todosConteudosDoDia().length}</strong>
                                </div>

                                {todosConteudosDoDia().map((conteudo) => (
                                    <article className={`day-card urgency-${conteudo.urgency}`} key={conteudo.id}>
                                        <div className="day-card-top">
                                            <span
                                                className={`approval-pill ${classeAprovacaoConteudo(
                                                    conteudo
                                                )}`}
                                            >
                                                {labelAprovacaoConteudo(conteudo)}
                                            </span>
                                            <button onClick={() => removerConteudo(conteudo.id)}>×</button>
                                        </div>
                                        <h4>{conteudo.title}</h4>
                                        <div className="day-card-meta calendar-day-meta">
                                            <div className="calendar-brand-group">
                                                {(conteudo.brands || []).map(
                                                    (brand) => (
                                                        <span
                                                            key={brand}
                                                            className={`calendar-brand-logo ${brandClassName(
                                                                brand
                                                            )}`}
                                                        >
                                                            {brand}
                                                        </span>
                                                    )
                                                )}
                                            </div>

                                            <span className="calendar-format-chip">
                                                {conteudo.format}
                                            </span>
                                        </div>
                                        <button className="open-content-button" onClick={() => abrirConteudo(conteudo)}>
                                            Abrir detalhes
                                        </button>
                                    </article>
                                ))}
                            </section>
                        </div>
                    </div>
                </div>
            )}

            {conteudoAberto && detalheForm && (
                <div
                    className="content-overlay"
                    onMouseDown={() => setConteudoAberto(null)}
                >
                    <div
                        className="content-modal"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="content-modal-header">
                            <div>
                                <span>CONTEÚDO</span>
                                <h2>{conteudoAberto.title}</h2>
                                <span
                                    className={`approval-pill ${classeAprovacaoConteudo(
                                        conteudoAberto
                                    )}`}
                                >
                                    {labelAprovacaoConteudo(conteudoAberto)}
                                </span>
                            </div>
                            <div className="content-header-actions">
                                {!usuarioEhGerente && (
                                    <>
                                        {conteudoAberto.approval_required !==
                                            false &&
                                            conteudoAberto.idea_approval_status !==
                                            "aprovado" &&
                                            conteudoAberto.approval_stage !==
                                                "idea" && (
                                                <button
                                                    className="idea-submit-button"
                                                    onClick={() =>
                                                        enviarConteudoParaAprovacao(
                                                            conteudoAberto,
                                                            "idea"
                                                        )
                                                    }
                                                >
                                                    {conteudoAberto.idea_approval_status ===
                                                    "alteracao"
                                                        ? "↻ Reenviar ideia"
                                                        : "Enviar ideia para aprovação"}
                                                </button>
                                            )}

                                        {conteudoAberto.approval_required !==
                                            false &&
                                            conteudoAberto.idea_approval_status ===
                                            "aprovado" &&
                                            conteudoAberto.approval_status !==
                                                "aprovado" &&
                                            conteudoAberto.approval_stage !==
                                                "final" &&
                                            !conteudoAberto.is_live &&
                                            (conteudoAberto.files || []).length >
                                                0 && (
                                                <button
                                                    className="final-submit-button"
                                                    onClick={() =>
                                                        enviarConteudoParaAprovacao(
                                                            conteudoAberto,
                                                            "final"
                                                        )
                                                    }
                                                >
                                                    {conteudoAberto.approval_status ===
                                                    "alteracao"
                                                        ? "↻ Reenviar conteúdo final"
                                                        : "Enviar conteúdo final para aprovação"}
                                                </button>
                                            )}

                                        <button
                                            className="delete-button"
                                            onClick={() =>
                                                removerConteudo(conteudoAberto.id)
                                            }
                                        >
                                            Excluir
                                        </button>
                                    </>
                                )}
                                <button
                                    className="close-button"
                                    onClick={() => setConteudoAberto(null)}
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        {conteudoAberto.idea_manager_note && (
                            <div className="manager-note approval-alteracao">
                                <strong>Retorno do gerente sobre a ideia</strong>
                                <span>{conteudoAberto.idea_manager_note}</span>
                            </div>
                        )}

                        {conteudoAberto.manager_note && (
                            <div className={`manager-note ${classeAprovacaoConteudo(conteudoAberto)}`}>
                                <strong>Retorno do gerente sobre o conteúdo final</strong>
                                <span>{conteudoAberto.manager_note}</span>
                            </div>
                        )}

                        <div className="content-modal-grid">
                            <form className="content-detail-form" onSubmit={salvarDetalhes}>
                                <div className="form-section-title">
                                    <span>PLANEJAMENTO</span>
                                    <h3>Informações do conteúdo</h3>
                                </div>

                                <label>Título</label>
                                <input
                                    value={detalheForm.title}
                                    onChange={(event) => setDetalheForm({ ...detalheForm, title: event.target.value })}
                                />

                                <label>Data</label>
                                <input
                                    type="date"
                                    min="2026-01-01"
                                    max="2028-12-31"
                                    value={detalheForm.date}
                                    onChange={(event) => setDetalheForm({ ...detalheForm, date: event.target.value })}
                                />

                                <label>Marcas</label>
                                <div className="brand-buttons">
                                    {MARCAS.map((marca) => (
                                        <button
                                            type="button"
                                            key={marca}
                                            className={`brand-option ${brandClassName(marca)} ${detalheForm.brands.includes(marca) ? "selected" : ""}`}
                                            onClick={() => alternarMarcaDetalhe(marca)}
                                        >
                                            {marca}
                                        </button>
                                    ))}
                                </div>

                                <div className="two-fields">
                                    <div>
                                        <label>Formato</label>
                                        <select
                                            value={detalheForm.format}
                                            onChange={(event) => setDetalheForm({ ...detalheForm, format: event.target.value })}
                                        >
                                            {FORMATOS.map((item) => (
                                                <option key={item}>{item}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label>Status</label>
                                        <select
                                            value={detalheForm.status}
                                            disabled={Boolean(conteudoAberto?.is_live)}
                                            title={
                                                conteudoAberto?.is_live
                                                    ? "Enquanto estiver NO AR, o status permanece como Publicado."
                                                    : "O status Publicado é definido pelo botão NO AR."
                                            }
                                            onChange={(event) =>
                                                setDetalheForm({
                                                    ...detalheForm,
                                                    status: event.target.value,
                                                })
                                            }
                                        >
                                            {statusDisponiveisConteudo(
                                                conteudoAberto
                                            ).map((item) => (
                                                <option key={item}>{item}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <label>Responsável pelo planejamento</label>
                                <select
                                    value={detalheForm.responsible}
                                    onChange={(event) => setDetalheForm({ ...detalheForm, responsible: event.target.value })}
                                >
                                    {usuarios.map((usuario) => (
                                        <option key={usuario.id} value={usuario.name}>
                                            {usuario.name}
                                        </option>
                                    ))}
                                </select>

                                <label>Urgência</label>
                                <div className="urgency-buttons">
                                    {URGENCIAS.map((urgency) => (
                                        <button
                                            type="button"
                                            key={urgency.value}
                                            className={`${urgency.value} ${detalheForm.urgency === urgency.value ? "selected" : ""}`}
                                            onClick={() => setDetalheForm({ ...detalheForm, urgency: urgency.value })}
                                        >
                                            <i /> {urgency.label}
                                        </button>
                                    ))}
                                </div>

                                {!usuarioEhGerente && (
                                    <>
                                        <label>Aprovação gerencial</label>
                                        <div className="approval-requirement-choice detail-choice">
                                            <button
                                                type="button"
                                                disabled={Boolean(
                                                    conteudoAberto?.is_live
                                                )}
                                                className={
                                                    detalheForm.approval_required
                                                        ? "selected"
                                                        : ""
                                                }
                                                onClick={() =>
                                                    alterarNecessidadeAprovacao(
                                                        true
                                                    )
                                                }
                                            >
                                                <strong>Necessária</strong>
                                                <small>
                                                    Fluxo normal com o gerente.
                                                </small>
                                            </button>

                                            <button
                                                type="button"
                                                disabled={Boolean(
                                                    conteudoAberto?.is_live
                                                )}
                                                className={
                                                    !detalheForm.approval_required
                                                        ? "selected direct"
                                                        : ""
                                                }
                                                onClick={() =>
                                                    alterarNecessidadeAprovacao(
                                                        false
                                                    )
                                                }
                                            >
                                                <strong>Não necessária</strong>
                                                <small>
                                                    Libera o botão NO AR.
                                                </small>
                                            </button>
                                        </div>
                                    </>
                                )}

                                {detalheForm.approval_required ? (
                                <div className="social-approval-workflow">
                                    <div className="form-section-title">
                                        <span>FLUXO DE APROVAÇÃO</span>
                                        <h3>2 decisões do gerente</h3>
                                    </div>

                                    <div className="social-approval-steps">
                                        <div
                                            className={`social-approval-step ${
                                                conteudoAberto.idea_approval_status ===
                                                "aprovado"
                                                    ? "done"
                                                    : conteudoAberto.approval_stage ===
                                                        "idea"
                                                      ? "waiting"
                                                      : conteudoAberto.idea_approval_status ===
                                                          "alteracao"
                                                        ? "adjust"
                                                        : ""
                                            }`}
                                        >
                                            <b>01</b>
                                            <div>
                                                <strong>Aprovação da ideia</strong>
                                                <span>
                                                    {conteudoAberto.idea_approval_status ===
                                                    "aprovado"
                                                        ? "Ideia aprovada. O conteúdo está liberado para produção."
                                                        : conteudoAberto.approval_stage ===
                                                            "idea"
                                                          ? "Aguardando decisão do gerente."
                                                          : conteudoAberto.idea_approval_status ===
                                                              "alteracao"
                                                            ? "O gerente pediu ajustes na ideia."
                                                            : "Briefing, roteiro, conceito e copy inicial."}
                                                </span>
                                            </div>
                                        </div>

                                        <div
                                            className={`social-approval-step ${
                                                conteudoAberto.approval_status ===
                                                "aprovado"
                                                    ? "done"
                                                    : conteudoAberto.approval_stage ===
                                                        "final"
                                                      ? "waiting"
                                                      : conteudoAberto.approval_status ===
                                                          "alteracao"
                                                        ? "adjust"
                                                        : ""
                                            }`}
                                        >
                                            <b>02</b>
                                            <div>
                                                <strong>Aprovação do conteúdo final</strong>
                                                <span>
                                                    {conteudoAberto.approval_status ===
                                                    "aprovado"
                                                        ? "Arquivo final aprovado pelo gerente."
                                                        : conteudoAberto.approval_stage ===
                                                            "final"
                                                          ? "Arquivo pronto aguardando decisão do gerente."
                                                          : conteudoAberto.approval_status ===
                                                              "alteracao"
                                                            ? "O gerente pediu ajustes no conteúdo final."
                                                            : "Depois de gravado/editado, anexe o arquivo pronto e envie para aprovação."}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {conteudoAberto.idea_approval_status ===
                                        "aprovado" &&
                                        conteudoAberto.approval_status !==
                                            "aprovado" &&
                                        conteudoAberto.approval_stage !==
                                            "final" && (
                                            <div
                                                className={`social-final-stage-release ${
                                                    (conteudoAberto.files || [])
                                                        .length
                                                        ? "ready"
                                                        : "waiting-file"
                                                }`}
                                            >
                                                <div>
                                                    <span>2ª ETAPA</span>
                                                    <strong>
                                                        {(conteudoAberto.files ||
                                                            []).length
                                                            ? "Arquivo final pronto para aprovação"
                                                            : "Anexe o arquivo final"}
                                                    </strong>
                                                    <small>
                                                        {(conteudoAberto.files ||
                                                            []).length
                                                            ? "O arquivo já está anexado. Envie agora para o Gerente de Marketing fazer a aprovação final."
                                                            : "Depois que a ideia for aprovada, anexe o vídeo, imagem ou material final na área Arquivos para liberar o envio ao gerente."}
                                                    </small>
                                                </div>

                                                {(conteudoAberto.files || [])
                                                    .length > 0 && (
                                                    <button
                                                        type="button"
                                                        className="final-submit-button social-final-stage-button"
                                                        onClick={() =>
                                                            enviarConteudoParaAprovacao(
                                                                conteudoAberto,
                                                                "final"
                                                            )
                                                        }
                                                    >
                                                        {conteudoAberto.approval_status ===
                                                        "alteracao"
                                                            ? "↻ Reenviar para aprovação final"
                                                            : "Enviar para aprovação final"}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                </div>
                                ) : (
                                    <div className="direct-publish-release">
                                        <span>✓</span>
                                        <div>
                                            <strong>
                                                Publicação liberada
                                            </strong>
                                            <small>
                                                Este conteúdo não precisa de aprovação gerencial e pode ser marcado como NO AR.
                                            </small>
                                        </div>
                                    </div>
                                )}

                                {conteudoAberto.manager_request && (
                                    <section className={`linked-manager-request-box ${
                                        conteudoAberto.manager_request.status === "Concluído"
                                            ? "completed"
                                            : ""
                                    }`}>
                                        <div className="linked-manager-request-copy">
                                            <span>
                                                PEDIDO DE GESTOR #{String(
                                                    conteudoAberto.manager_request.id
                                                ).padStart(4, "0")}
                                            </span>
                                            <strong>
                                                {conteudoAberto.manager_request.status ===
                                                "Concluído"
                                                    ? "✓ Pedido concluído automaticamente"
                                                    : "Demanda vinculada ao Portal de Gestores"}
                                            </strong>
                                            <small>
                                                {conteudoAberto.manager_request.status ===
                                                "Concluído"
                                                    ? "A conclusão já foi refletida automaticamente para o solicitante."
                                                    : "Quando você finalizar esta demanda, o pedido do gestor será concluído automaticamente."}
                                            </small>
                                        </div>
                                    </section>
                                )}

                                <label>Links de referência</label>
                                <textarea
                                    value={detalheForm.reference_link}
                                    onChange={(event) =>
                                        setDetalheForm({ ...detalheForm, reference_link: event.target.value })
                                    }
                                />
                                {linksValidos(detalheForm.reference_link).map((link) => (
                                    <a className="reference-link" key={link} href={link} target="_blank" rel="noreferrer">
                                        Abrir referência ↗
                                    </a>
                                ))}

                                <label>Descrição / Briefing</label>
                                <textarea
                                    value={detalheForm.description}
                                    onChange={(event) => setDetalheForm({ ...detalheForm, description: event.target.value })}
                                />

                                <label>Copy / Legenda</label>
                                <textarea
                                    className="copy-textarea"
                                    value={detalheForm.copy_text}
                                    onChange={(event) => setDetalheForm({ ...detalheForm, copy_text: event.target.value })}
                                />

                                <div className={`publication-section ${conteudoAberto?.is_live ? "active" : ""}`}>
                                    <div className="form-section-title">
                                        <span>PÓS-PUBLICAÇÃO</span>
                                        <h3>Publicação e métricas</h3>
                                        <p>
                                            Salvar métricas não coloca o conteúdo no ar. Só o botão NO AR abaixo confirma que a publicação foi realmente publicada.
                                        </p>
                                    </div>

                                    <div className="live-publish-control">
                                        <div className="live-publish-copy">
                                            <span>STATUS DA PUBLICAÇÃO</span>
                                            <strong>
                                                {conteudoAberto?.is_live
                                                    ? "Esta publicação está no ar"
                                                    : "Ainda não está marcada como publicada"}
                                            </strong>
                                            <small>
                                                {conteudoAberto?.is_live
                                                    ? `No ar desde ${formatDateTime(conteudoAberto.published_at)}`
                                                    : "Clique somente depois que o conteúdo estiver realmente publicado."}
                                            </small>
                                        </div>

                                        <button
                                            type="button"
                                            className={`live-toggle-button ${
                                                conteudoAberto?.is_live ? "is-live" : ""
                                            }`}
                                            onClick={alternarNoAr}
                                            disabled={
                                                !conteudoAberto?.is_live &&
                                                conteudoAberto?.approval_required !==
                                                    false &&
                                                conteudoAberto?.approval_status !==
                                                    "aprovado"
                                            }
                                            title={
                                                !conteudoAberto?.is_live &&
                                                conteudoAberto?.approval_required !==
                                                    false &&
                                                conteudoAberto?.approval_status !==
                                                    "aprovado"
                                                    ? "O conteúdo final precisa ser aprovado pelo gerente antes de ir ao ar."
                                                    : ""
                                            }
                                        >
                                            <span className="live-toggle-circle">
                                                <i />
                                            </span>
                                            <span className="live-toggle-label">
                                                <b>NO AR</b>
                                                <small>
                                                    {conteudoAberto?.is_live
                                                        ? "Publicado"
                                                        : "Marcar publicação"}
                                                </small>
                                            </span>
                                        </button>
                                    </div>

                                    <label>Publicado por</label>
                                    <select
                                        value={detalheForm.published_by_user_id}
                                        onChange={(event) =>
                                            setDetalheForm({
                                                ...detalheForm,
                                                published_by_user_id: Number(event.target.value),
                                            })
                                        }
                                    >
                                        {usuarios.map((usuario) => (
                                            <option key={usuario.id} value={usuario.id}>
                                                {usuario.nickname || usuario.name}
                                            </option>
                                        ))}
                                    </select>

                                    <label>
                                        Link do post ou Reel <small>(opcional)</small>
                                    </label>
                                    <input
                                        value={detalheForm.published_url}
                                        onChange={(event) =>
                                            setDetalheForm({
                                                ...detalheForm,
                                                published_url: event.target.value,
                                            })
                                        }
                                        placeholder="https://www.instagram.com/reel/... (opcional)"
                                    />

                                    {detalheForm.published_url.trim() && (
                                        <a
                                            className="published-link"
                                            href={detalheForm.published_url}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            Abrir publicação ↗
                                        </a>
                                    )}

                                    {isStoriesFormat(
                                        conteudoAberto.format
                                    ) ? (
                                        <div className="stories-no-metrics-box">
                                            <div className="stories-no-metrics-icon">◉</div>
                                            <div>
                                                <span>STORIES</span>
                                                <h4>Não precisa preencher métricas</h4>
                                                <p>
                                                    Stories entram no relatório somente
                                                    pela quantidade publicada. O botão
                                                    NO AR continua funcionando normalmente.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="manual-metrics-inline always-visible">
                                            <div className="manual-metrics-inline-head">
                                                <div>
                                                    <span>MÉTRICAS MANUAIS</span>
                                                    <h4>Atualize os números da publicação</h4>
                                                    <p>
                                                        Para o Índice SQUAD, preencha
                                                        visualizações, curtidas e
                                                        compartilhamentos. Comentários,
                                                        alcance e salvamentos ficam como
                                                        dados complementares.
                                                    </p>
                                                </div>
                                                <div className="manual-metrics-updated">
                                                    <span>Última atualização</span>
                                                    <strong>
                                                        {formatDateTime(
                                                            conteudoAberto.metrics_updated_at
                                                        )}
                                                    </strong>
                                                </div>
                                            </div>

                                            <div className="manual-public-grid">
                                                {[
                                                    ["views", "Visualizações"],
                                                    ["likes", "Curtidas"],
                                                    ["shares", "Compartilhamentos"],
                                                ].map(([key, label]) => (
                                                    <label key={key}>
                                                        <span>{label}</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={metricasForm[key]}
                                                            onChange={(event) =>
                                                                setMetricasForm({
                                                                    ...metricasForm,
                                                                    [key]: Number(
                                                                        event.target.value
                                                                    ),
                                                                })
                                                            }
                                                        />
                                                    </label>
                                                ))}
                                            </div>

                                            <details className="advanced-metrics-details">
                                                <summary>
                                                    Métricas avançadas (opcional)
                                                </summary>

                                                <div className="manual-public-grid advanced">
                                                    {[
                                                        ["comments", "Comentários"],
                                                        ["reach", "Alcance"],
                                                        ["saves", "Salvamentos"],
                                                    ].map(([key, label]) => (
                                                        <label key={key}>
                                                            <span>{label}</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={metricasForm[key]}
                                                                onChange={(event) =>
                                                                    setMetricasForm({
                                                                        ...metricasForm,
                                                                        [key]: Number(
                                                                            event.target.value
                                                                        ),
                                                                    })
                                                                }
                                                            />
                                                        </label>
                                                    ))}
                                                </div>
                                            </details>

                                            <button
                                                type="button"
                                                className="manual-save-button"
                                                onClick={salvarMetricasManuais}
                                            >
                                                Salvar atualização de métricas
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <button className="primary-button full">Salvar alterações</button>
                            </form>

                            <section className="content-files">
                                <div className="content-files-heading">
                                    <div>
                                        <h3>Arquivos</h3>
                                        <p>
                                            Imagens permanecem no histórico. Vídeos são
                                            removidos automaticamente 30 dias depois que
                                            a publicação é marcada como NO AR.
                                        </p>
                                    </div>

                                    {conteudoAberto.video_retention_expires_at && (
                                        <span className="video-retention-badge">
                                            Vídeo disponível até{" "}
                                            {new Date(
                                                conteudoAberto.video_retention_expires_at
                                            ).toLocaleDateString("pt-BR")}
                                        </span>
                                    )}

                                    {conteudoAberto.video_files_purged_at && (
                                        <span className="video-retention-badge expired">
                                            Vídeo removido do servidor em{" "}
                                            {new Date(
                                                conteudoAberto.video_files_purged_at
                                            ).toLocaleDateString("pt-BR")}
                                        </span>
                                    )}
                                </div>
                                <div className="upload-box">
                                    <strong>Adicionar arquivos</strong>
                                    <span>JPG, PNG, WEBP, GIF, MP4, MOV, WebM ou PDF.</span>
                                    <input
                                        type="file"
                                        multiple
                                        accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,.pdf"
                                        onChange={(event) => setArquivosSelecionados(Array.from(event.target.files || []))}
                                    />
                                    <button className="secondary-button" onClick={enviarArquivos} disabled={enviandoArquivo}>
                                        {enviandoArquivo ? "Enviando..." : "Enviar arquivos"}
                                    </button>
                                </div>

                                <div className="files-grid">
                                    {conteudoAberto.files?.map((arquivo) => (
                                        <article className="file-card" key={arquivo.id}>
                                            {arquivo.mime_type.startsWith("image/") && <img src={arquivo.url} alt="" />}
                                            {arquivo.mime_type.startsWith("video/") && (
                                                <video
                                                    src={arquivo.url}
                                                    controls
                                                    preload="metadata"
                                                    playsInline
                                                />
                                            )}
                                            {arquivo.mime_type === "application/pdf" && <div className="pdf-preview">PDF</div>}
                                            <div className="file-card-info">
                                                <strong>{arquivo.original_name}</strong>
                                                <div>
                                                    <a href={arquivo.url} target="_blank" rel="noreferrer">
                                                        Abrir
                                                    </a>
                                                    <button
                                                        type="button"
                                                        className="content-preserve-download"
                                                        onClick={async () => {
                                                            try {
                                                                await baixarArquivoComNomeOriginal(
                                                                    arquivo,
                                                                    "content"
                                                                );
                                                            } catch (error) {
                                                                alert(error.message);
                                                            }
                                                        }}
                                                    >
                                                        Baixar
                                                    </button>
                                                    <button onClick={() => removerArquivo(arquivo)}>Remover</button>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>


                            </section>
                        </div>
                    </div>
                </div>
            )}

            {revisaoAberta && (
                <div
                    className="simple-overlay"
                    onMouseDown={() => setRevisaoAberta(false)}
                >
                    <div
                        className="small-modal"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="modal-top">
                            <div>
                                <span>REVISÃO GERENCIAL</span>
                                <h2>{revisaoTipo === "idea" ? "Revisar ideia" : "Revisar conteúdo final"}</h2>
                            </div>
                            <button onClick={() => setRevisaoAberta(false)}>×</button>
                        </div>
                        <form onSubmit={salvarRevisao}>
                            <label>Etapa</label>
                            <div className="review-stage-readonly">
                                {revisaoTipo === "idea"
                                    ? "Aprovação da ideia"
                                    : "Aprovação do conteúdo final"}
                            </div>
                            <label>O que precisa ser alterado?</label>
                            <textarea
                                autoFocus
                                required
                                placeholder="Escreva exatamente o que o colaborador precisa revisar..."
                                value={revisaoNota}
                                onChange={(event) => setRevisaoNota(event.target.value)}
                            />
                            <small className="review-help-text">
                                Esta orientação será enviada ao colaborador responsável.
                            </small>
                            <button className="primary-button">Enviar revisão</button>
                        </form>
                    </div>
                </div>
            )}

            {novoLembreteAberto && (
                <div
                    className="simple-overlay"
                    onMouseDown={() => setNovoLembreteAberto(false)}
                >
                    <div
                        className="small-modal"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="modal-top">
                            <div>
                                <span>LEMBRETE</span>
                                <h2>Nova data importante</h2>
                            </div>
                            <button onClick={() => setNovoLembreteAberto(false)}>×</button>
                        </div>
                        <form onSubmit={criarLembrete}>
                            <label>Título</label>
                            <input
                                value={lembreteForm.title}
                                onChange={(event) => setLembreteForm({ ...lembreteForm, title: event.target.value })}
                            />
                            <label>Data</label>
                            <input
                                type="date"
                                min="2026-01-01"
                                max="2028-12-31"
                                value={lembreteForm.date}
                                onChange={(event) => setLembreteForm({ ...lembreteForm, date: event.target.value })}
                            />
                            <label>Tipo</label>
                            <select
                                value={lembreteForm.type}
                                onChange={(event) => setLembreteForm({ ...lembreteForm, type: event.target.value })}
                            >
                                <option>Personalizado</option>
                                <option>Evento</option>
                                <option>Campanha</option>
                                <option>Data comercial</option>
                            </select>
                            <label>Cidade</label>
                            <input
                                value={lembreteForm.city}
                                onChange={(event) => setLembreteForm({ ...lembreteForm, city: event.target.value })}
                            />
                            <label>Observação</label>
                            <textarea
                                value={lembreteForm.note}
                                onChange={(event) => setLembreteForm({ ...lembreteForm, note: event.target.value })}
                            />
                            <button className="primary-button">Criar lembrete</button>
                        </form>
                    </div>
                </div>
            )}

            {novoColaboradorAberto && usuarioSelecionado && renderNovoColaboradorModal()}
        </div>
    );
}

export default App;
