import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { VertexAI } from '@google-cloud/vertexai';

import fs from 'fs';

dotenv.config();
console.log(`[DEBUG] JWT_SECRET cargado: ${process.env.JWT_SECRET ? 'SÍ' : 'NO'}`);
console.log(`[DEBUG] GOOGLE_PROJECT_ID: ${process.env.GOOGLE_PROJECT_ID}`);

// Verificación de credenciales ADC
const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (credsPath) {
    if (fs.existsSync(credsPath)) {
        console.log(`[DEBUG] Archivo de credenciales ENCONTRADO en: ${credsPath}`);
    } else {
        console.error(`[ERROR] Archivo de credenciales NO ENCONTRADO en: ${credsPath}`);
    }
} else {
    console.warn("[DEBUG] GOOGLE_APPLICATION_CREDENTIALS no definida. Usando ADC del sistema.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();

// Global Logging Middleware
app.use((req, res, next) => {
    console.log(`[DEBUG LOG] ${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// More robust CORS configuration for Mobile/Capacitor
const allowedOrigins = [
    'https://localhost',
    'capacitor://localhost',
    'http://localhost',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173'
];

const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost') || origin.startsWith('http://192.168.')) {
            callback(null, true);
        } else {
            // For production, maybe restrict more, but for debugging we'll reflect origin
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Manual CORS fallback for certain environments
app.use((req, res, next) => {
    const origin = req.headers.origin as string;
    if (origin && (allowedOrigins.includes(origin) || origin.startsWith('http://localhost'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-quimresa-lab-2026';

// AI ADC/Vertex Initialization (Preparado para VPS con JSON)
const project = process.env.GOOGLE_PROJECT_ID || '438765953304';
const location = process.env.GOOGLE_LOCATION || 'us-east1';
const vertexAI = new VertexAI({ project: project, location: location });

let model: any;
try {
    // IMPORTANTE: gemini-2.5-flash NO EXISTE. Usamos 1.5-flash.
    model = vertexAI.getGenerativeModel({ model: "gemini-2.5-flash" });
} catch (e) {
    console.error("[CRITICAL] Failed to initialize Vertex AI model:", e);
}

// Test route to verify deployment
app.get('/api/test-chat', (req, res) => {
    res.json({ message: 'Servidor actualizado correctamente', model: "gemini-2.5-flash" });
});

const SYSTEM_PROMPT = `
Eres el Asistente Experto en Colorimetría de Quimresa. Tu especialidad es el Laboratorio de Pinturas y la corrección de fórmulas mediante el análisis de desviaciones CIELAB (L*, a*, b*).

OBJETIVO: Ayudar al operario a alcanzar un Delta E (ΔE) < 1.0 sugiriendo adiciones precisas de los pigmentos ya presentes en la fórmula.

PROCEDIMIENTO DE CORRECCIÓN:
1. Analiza los deltas (DL, Da, Db):
   - Si DL > 0 (Muestra clara): Identifica pigmentos oscuros (negros, azules, marrones) en la fórmula para añadir.
   - Si DL < 0 (Muestra oscura): Sugiere añadir Base Blanca si está disponible.
   - Si Da > 0 (Muestra rojiza): Busca pigmentos verdes o azules compensatorios en la fórmula.
   - Si Da < 0 (Muestra verdosa): Busca pigmentos rojos o magentas en la fórmula para añadir.
   - Si Db > 0 (Muestra amarillenta): Busca pigmentos azules o violetas en la fórmula.
   - Si Db < 0 (Muestra azulada): Busca pigmentos amarillos u ocres en la fórmula.

2. Recomendación de Pigmentos:
   - Usa los códigos y colores RGB proporcionados para identificar la función de cada pigmento.
   - Prioriza siempre los pigmentos que ya están en la fórmula actual.

3. Sugerencia de Cantidades:
   - Basándote en que las fórmulas estándar suelen estar expresadas para 1000g (1kg), sugiere adiciones precisas en gramos (ej. "Añadir 5g de pigmento X").
   - Recuerda que es mejor añadir poco a poco que pasarse de color.

REGLAS DE RESPUESTA:
- Sé técnico y preciso pero breve (máximo 3-4 frases).
- Si no hay un pigmento adecuado en la fórmula para corregir un eje específico, indícalo claramente.
- Habla siempre en español.
`;

// --- ROUTES ---

app.post('/api/login', async (req: Request, res: Response): Promise<any> => {
    const { correo, password } = req.body;
    if (!correo || !password) return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
    try {
        const usuario = await prisma.usuario.findFirst({ where: { name: correo }, include: { cliente: true } });
        if (!usuario || !usuario.idcliente || !usuario.cliente) return res.status(401).json({ error: 'Credenciales inválidas' });
        if (usuario.cliente.autorizado !== true || !usuario.autorizado) return res.status(403).json({ error: 'Acceso no autorizado' });
        const passwordMatch = await bcrypt.compare(password, usuario.pass || '');
        if (!passwordMatch) return res.status(401).json({ error: 'Credenciales inválidas' });
        const token = jwt.sign({ id: usuario.id, email: usuario.name, typeuser: usuario.typeuser, permisos: usuario.permisos, idcliente: usuario.idcliente }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: 'Login exitoso', token, user: { id: usuario.id, name: usuario.name, empresa: usuario.cliente?.NOMBRE || 'Desconocida' } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

export const authenticateToken = (req: Request, res: Response, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ error: 'Token requerido' });
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
        (req as any).user = user;
        next();
    });
};

app.get('/api/usuarios', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const usuarios = await prisma.usuario.findMany({ where: { idcliente } });
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

app.post('/api/usuarios', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const { name, pass, photo, tiempo, typeuser, permisos, autorizado } = req.body;
        const passToSave = pass ? await bcrypt.hash(pass, 10) : undefined;
        const nuevoUsuario = await prisma.usuario.create({ data: { name, pass: passToSave, photo, tiempo, typeuser, permisos, autorizado, idcliente } });
        const { pass: _, ...userWithoutPass } = nuevoUsuario;
        res.json(userWithoutPass);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

app.put('/api/usuarios/:id', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const { id } = req.params;
        const { name, pass, photo, tiempo, typeuser, permisos, autorizado } = req.body;
        const existing = await prisma.usuario.findFirst({ where: { id: Number(id), idcliente } });
        if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });
        const dataUpdate: any = { name, photo, tiempo, typeuser, permisos, autorizado };
        if (pass) dataUpdate.pass = await bcrypt.hash(pass, 10);
        const actualizado = await prisma.usuario.update({ where: { id: Number(id) }, data: dataUpdate });
        const { pass: _, ...userWithoutPass } = actualizado;
        res.json(userWithoutPass);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

app.delete('/api/usuarios/:id', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const { id } = req.params;
        const existing = await prisma.usuario.findFirst({ where: { id: Number(id), idcliente } });
        if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });
        await prisma.usuario.delete({ where: { id: Number(id) } });
        res.json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

app.get('/api/cliente', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const cliente = await prisma.cliente.findUnique({ where: { CODIGO: idcliente } });
        if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
        res.json(cliente);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener cliente' });
    }
});

app.put('/api/cliente', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const body = req.body;
        const actualizado = await prisma.cliente.update({ where: { CODIGO: idcliente }, data: body as any });
        res.json(actualizado);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar cliente' });
    }
});

app.post('/api/mediciones', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const { L, A, B, R, G, RB, C, H, FECHA } = req.body;
        const medicion = await prisma.formPersonales.create({
            data: {
                IDCLIENTE: idcliente,
                L: L?.toString(), A: A?.toString(), B: B?.toString(),
                R: R?.toString(), G: G?.toString(), RB: RB?.toString(),
                C: C?.toString(), H: H?.toString(), FECHA: FECHA || new Date().toISOString(),
            }
        });
        res.status(201).json(medicion);
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar medición' });
    }
});

app.all('/api/chat', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    if (req.method === 'GET') {
        console.warn(`[WARNING] Recibida petición GET en /api/chat desde ${req.ip}. Se esperaba POST. Esto sugiere una redirección Nginx/SSL.`);
        return res.status(405).json({ error: 'Se requiere método POST para el chat. Si ves esto, revisa tus redirecciones Nginx/SSL.' });
    }
    try {
        const { message, history } = req.body;
        if (!process.env.GOOGLE_PROJECT_ID) {
            return res.status(500).json({ error: 'AI Error: GOOGLE_PROJECT_ID no configurado' });
        }
        if (!model) {
            try {
                model = vertexAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            } catch (e: any) {
                return res.status(500).json({ error: 'AI Error: Fallo al inicializar el modelo' });
            }
        }

        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
                { role: "model", parts: [{ text: "Entendido. Soy el asistente experto de Quimresa. ¿En qué puedo ayudarte hoy?" }] },
                ...(history || []).map((h: any) => ({
                    role: h.role === 'user' ? 'user' : 'model',
                    parts: [{ text: h.text }]
                }))
            ],
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;

        // Registro de tokens consumidos (Vertex AI)
        const usage = response.usageMetadata;
        if (usage) {
            console.log(`[AI TOKEN USAGE] Prompt: ${usage.promptTokenCount} | Output: ${usage.candidatesTokenCount} | Total: ${usage.totalTokenCount}`);
        }

        const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || "No se recibió respuesta.";
        res.json({ text: responseText, usage: usage });
    } catch (error: any) {
        console.error('--- [AI CHAT ERROR DETAIL] ---');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        if (error.details) console.error('Details:', error.details);
        console.error('------------------------------');
        res.status(500).json({ error: 'Error en la IA', details: error.message });
    }
});

app.get('/api/formulas', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 25;
        const search = (req.query.q as string) || '';
        const skip = (page - 1) * limit;

        const formulas = await prisma.formPersonales.findMany({
            where: { IDCLIENTE: idcliente, OR: search ? [{ NOMBREFORMULA: { contains: search, mode: 'insensitive' } }, { CODIGO: { contains: search, mode: 'insensitive' } }] : undefined },
            orderBy: [{ FECHA: 'desc' }],
            skip, take: limit
        });
        res.json(formulas);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener fórmulas' });
    }
});

// --- LIBRARIES (FORMULAS STANDARD) ---

app.get('/api/marcas', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const marcas = await prisma.marca.findMany({ orderBy: { NOMBRE: 'asc' } });
        res.json(marcas);
    } catch (error: any) {
        console.error('[ERROR] /api/marcas:', error.message);
        res.status(500).json({ error: 'Error al obtener marcas', details: error.message });
    }
});

app.get('/api/cartas', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const cartas = await prisma.carta.findMany({ orderBy: { CARTA: 'asc' } });
        res.json(cartas);
    } catch (error: any) {
        console.error('[ERROR] /api/cartas:', error.message);
        res.status(500).json({ error: 'Error al obtener cartas', details: error.message });
    }
});

app.get('/api/productos-standard', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const productos = await prisma.producto.findMany({ orderBy: { PRODUCTO: 'asc' } });
        res.json(productos);
    } catch (error: any) {
        console.error('[ERROR] /api/productos-standard:', error.message);
        res.status(500).json({ error: 'Error al obtener productos', details: error.message });
    }
});

app.get('/api/formulas-standard', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idmarca, idproducto, idcarta, q } = req.query;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 25;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (idmarca && !isNaN(Number(idmarca))) where.IDMARCA = Number(idmarca);
        if (idproducto && !isNaN(Number(idproducto))) where.IDPRODUCTO = Number(idproducto);
        if (idcarta && !isNaN(Number(idcarta))) where.IDCARTA = Number(idcarta);
        if (q) {
            where.NOMBRE = { contains: String(q), mode: 'insensitive' };
        }

        const formulas = await prisma.formula.findMany({
            where,
            include: { marca: true, producto: true, carta: true },
            skip,
            take: limit,
            orderBy: { NOMBRE: 'asc' }
        });

        res.json(formulas);
    } catch (error: any) {
        console.error('[ERROR] /api/formulas-standard:', error.message);
        res.status(500).json({ error: 'Error al obtener fórmulas standard', details: error.message });
    }
});

app.post('/api/componentes/densidades', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { codigos } = req.body;
        if (!codigos || !Array.isArray(codigos)) return res.status(400).json({ error: 'Codigos requeridos' });

        console.log('[DEBUG] Buscando densidades para:', codigos);
        const results: any[] = [];

        // 1. Intentar en tabla BASES (mayúsculas)
        try {
            const basesRes: any[] = await prisma.$queryRawUnsafe(
                `SELECT "CODIGO" as "CODIGO", "DENSIDAD" FROM "BASES" WHERE "CODIGO" = ANY($1)`,
                codigos
            );
            if (basesRes && basesRes.length > 0) {
                console.log('[DEBUG] Encontrados en BASES (con comillas):', basesRes.map(b => b.CODIGO));
                results.push(...basesRes);
            }
        } catch (e: any) {
            console.log('[DEBUG] Falló consulta a tabla "BASES":', e.message);
        }

        // 1.1 Intentar en tabla BASES (sin comillas)
        try {
            const basesResLow: any[] = await prisma.$queryRawUnsafe(
                `SELECT CODIGO as "CODIGO", DENSIDAD FROM BASES WHERE CODIGO = ANY($1)`,
                codigos
            );
            if (basesResLow && basesResLow.length > 0) {
                console.log('[DEBUG] Encontrados en BASES (sin comillas):', basesResLow.map(b => b.CODIGO));
                results.push(...basesResLow);
            }
        } catch (e: any) {
            console.log('[DEBUG] Falló consulta a tabla BASES (sin comillas):', e.message);
        }

        // 2. Intentar en tabla COLORANTES (Columna PRODUCTO es el código)
        try {
            const colorantesRes: any[] = await prisma.$queryRawUnsafe(
                `SELECT "PRODUCTO" as "CODIGO", "DENSIDAD" FROM "COLORANTES" WHERE "PRODUCTO" = ANY($1)`,
                codigos
            );
            if (colorantesRes && colorantesRes.length > 0) {
                console.log('[DEBUG] Encontrados en COLORANTES ("PRODUCTO"):', colorantesRes.map(c => c.CODIGO));
                results.push(...colorantesRes);
            }
        } catch (e: any) {
            console.log('[DEBUG] Falló consulta a "COLORANTES" ("PRODUCTO"):', e.message);
        }

        // 2.1 Intentar en tabla COLORANTES (sin comillas, columna PRODUCTO)
        try {
            const colorantesResLow: any[] = await prisma.$queryRawUnsafe(
                `SELECT PRODUCTO as "CODIGO", DENSIDAD FROM COLORANTES WHERE PRODUCTO = ANY($1)`,
                codigos
            );
            if (colorantesResLow && colorantesResLow.length > 0) {
                console.log('[DEBUG] Encontrados en COLORANTES (PRODUCTO sin comillas):', colorantesResLow.map(c => c.CODIGO));
                results.push(...colorantesResLow);
            }
        } catch (e: any) {
            console.log('[DEBUG] Falló consulta a COLORANTES (PRODUCTO sin comillas):', e.message);
        }

        // 3. Intentar en tabla COLORANTES (Columna CODIGO)
        try {
            const colorantesRes2: any[] = await prisma.$queryRawUnsafe(
                `SELECT "CODIGO"::text as "CODIGO", "DENSIDAD" FROM "COLORANTES" WHERE "CODIGO"::text = ANY($1)`,
                codigos
            );
            if (colorantesRes2 && colorantesRes2.length > 0) {
                console.log('[DEBUG] Encontrados en "COLORANTES" ("CODIGO"):', colorantesRes2.map(c => c.CODIGO));
                results.push(...colorantesRes2);
            }
        } catch (e: any) { }

        // 3.1 Intentar en tabla COLORANTES (sin comillas, columna CODIGO)
        try {
            const colorantesRes2Low: any[] = await prisma.$queryRawUnsafe(
                `SELECT CODIGO::text as "CODIGO", DENSIDAD FROM COLORANTES WHERE CODIGO::text = ANY($1)`,
                codigos
            );
            if (colorantesRes2Low && colorantesRes2Low.length > 0) {
                console.log('[DEBUG] Encontrados en COLORANTES (CODIGO sin comillas):', colorantesRes2Low.map(c => c.CODIGO));
                results.push(...colorantesRes2Low);
            }
        } catch (e: any) { }

        // Eliminar duplicados y asegurar que la densidad sea numérica
        const uniqueResults = Array.from(new Map(results.map(item => [
            item.CODIGO,
            { ...item, DENSIDAD: parseFloat(item.DENSIDAD) || 1.0 }
        ])).values());
        console.log("RESULTADOSRESULTANTES", uniqueResults);
        res.json(uniqueResults);
    } catch (error: any) {
        console.error('[ERROR] /api/componentes/densidades:', error.message);
        res.status(500).json({ error: 'Error al obtener densidades', details: error.message });
    }
});

// =================================================================
// Delta E 2000 (server-side for color matching)
// =================================================================
function serverDeltaE2000(L1: number, a1: number, b1: number, L2: number, a2: number, b2: number): number {
    const rad = Math.PI / 180;
    const C1 = Math.sqrt(a1 * a1 + b1 * b1);
    const C2 = Math.sqrt(a2 * a2 + b2 * b2);
    const mC = (C1 + C2) / 2;
    const G = 0.5 * (1 - Math.sqrt(Math.pow(mC, 7) / (Math.pow(mC, 7) + Math.pow(25, 7))));
    const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
    const C1p = Math.sqrt(a1p * a1p + b1 * b1);
    const C2p = Math.sqrt(a2p * a2p + b2 * b2);
    let h1p = (Math.atan2(b1, a1p) * 180 / Math.PI + 360) % 360;
    let h2p = (Math.atan2(b2, a2p) * 180 / Math.PI + 360) % 360;
    const dLp = L2 - L1, dCp = C2p - C1p;
    let dhp: number;
    if (C1p * C2p === 0) dhp = 0;
    else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
    else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
    else dhp = h2p - h1p + 360;
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
    const mLp = (L1 + L2) / 2, mCp = (C1p + C2p) / 2;
    let mhp: number;
    if (C1p * C2p === 0) mhp = h1p + h2p;
    else if (Math.abs(h1p - h2p) <= 180) mhp = (h1p + h2p) / 2;
    else if (h1p + h2p < 360) mhp = (h1p + h2p + 360) / 2;
    else mhp = (h1p + h2p - 360) / 2;
    const T = 1 - 0.17 * Math.cos((mhp - 30) * rad) + 0.24 * Math.cos(2 * mhp * rad)
        + 0.32 * Math.cos((3 * mhp + 6) * rad) - 0.2 * Math.cos((4 * mhp - 63) * rad);
    const SL = 1 + (0.015 * Math.pow(mLp - 50, 2)) / Math.sqrt(20 + Math.pow(mLp - 50, 2));
    const SC = 1 + 0.045 * mCp;
    const SH = 1 + 0.015 * mCp * T;
    const RT = -2 * Math.sqrt(Math.pow(mCp, 7) / (Math.pow(mCp, 7) + Math.pow(25, 7)))
        * Math.sin(60 * rad * Math.exp(-Math.pow((mhp - 275) / 25, 2)));
    return Math.sqrt(
        Math.pow(dLp / SL, 2) + Math.pow(dCp / SC, 2) + Math.pow(dHp / SH, 2)
        + RT * (dCp / SC) * (dHp / SH)
    );
}

// =================================================================
// POST /api/color-match  – Find closest formulas by Delta E 2000
// =================================================================
app.post('/api/color-match', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { l, a, b, limit = 10 } = req.body;
        const { idcliente } = (req as any).user;

        if (l == null || a == null || b == null) {
            return res.status(400).json({ error: 'Se requieren valores L, a, b' });
        }

        const targetL = parseFloat(l);
        const targetA = parseFloat(a);
        const targetB = parseFloat(b);

        if (isNaN(targetL) || isNaN(targetA) || isNaN(targetB)) {
            return res.status(400).json({ error: 'Valores L, a, b inválidos' });
        }

        console.log(`[COLOR-MATCH] Buscando color L=${targetL}, a=${targetA}, b=${targetB} con límite=${limit}`);

        // 1. Fetch minimal data for standard formulas (without heavy relations/columns)
        const standardMinData = await prisma.formula.findMany({
            where: {
                L: { not: null, notIn: [''] },
                A: { not: null, notIn: [''] },
                B: { not: null, notIn: [''] },
            },
            select: {
                id: true,
                L: true,
                A: true,
                B: true,
            }
        });

        // 2. Fetch minimal data for personal formulas
        const personalMinData = await prisma.formPersonales.findMany({
            where: {
                IDCLIENTE: idcliente,
                L: { not: null, notIn: [''] },
                A: { not: null, notIn: [''] },
                B: { not: null, notIn: [''] },
            },
            select: {
                ID: true,
                L: true,
                A: true,
                B: true,
            }
        });

        console.log(`[COLOR-MATCH] Candidatos Standard: ${standardMinData.length}, Personal: ${personalMinData.length}`);

        // 3. Compute Delta E 2000 and collect IDs
        const allCandidates: any[] = [];

        for (const f of standardMinData) {
            const fL = parseFloat(f.L || '0');
            const fA = parseFloat(f.A || '0');
            const fB = parseFloat(f.B || '0');
            if (isNaN(fL) || isNaN(fA) || isNaN(fB)) continue;

            const de = serverDeltaE2000(targetL, targetA, targetB, fL, fA, fB);
            allCandidates.push({ id: f.id, source: 'standard', deltaE: de });
        }

        for (const f of personalMinData) {
            const fL = parseFloat(f.L || '0');
            const fA = parseFloat(f.A || '0');
            const fB = parseFloat(f.B || '0');
            if (isNaN(fL) || isNaN(fA) || isNaN(fB)) continue;

            const de = serverDeltaE2000(targetL, targetA, targetB, fL, fA, fB);
            allCandidates.push({ id: f.ID, source: 'personal', deltaE: de });
        }

        // 4. Sort and take top N
        allCandidates.sort((x, y) => x.deltaE - y.deltaE);
        const topCandidates = allCandidates.slice(0, Math.min(limit, allCandidates.length));

        if (topCandidates.length === 0) {
            return res.json([]);
        }

        // 5. Fetch full data for top results ONLY
        const standardIds = topCandidates.filter(c => c.source === 'standard').map(c => c.id);
        const personalIds = topCandidates.filter(c => c.source === 'personal').map(c => c.id);

        const fullStandard = await prisma.formula.findMany({
            where: { id: { in: standardIds } },
            // Relations are small for only a few records
            include: { marca: true, producto: true, carta: true }
        });

        const fullPersonal = await prisma.formPersonales.findMany({
            where: { ID: { in: personalIds } }
        });

        // 6. Final assembly of results
        const finalResults = topCandidates.map(cand => {
            if (cand.source === 'standard') {
                const f = fullStandard.find(x => x.id === cand.id);
                return {
                    formula: f ? { ...f, NOMBREFORMULA: f.NOMBRE } : null,
                    deltaE: parseFloat(cand.deltaE.toFixed(4)),
                    source: 'standard'
                };
            } else {
                const f = fullPersonal.find(x => x.ID === cand.id);
                return {
                    formula: f,
                    deltaE: parseFloat(cand.deltaE.toFixed(4)),
                    source: 'personal'
                };
            }
        }).filter(r => r.formula !== null);

        console.log(`[COLOR-MATCH] Enviando ${finalResults.length} resultados, mejor ΔE = ${finalResults[0]?.deltaE?.toFixed(2)}`);
        res.json(finalResults);
    } catch (error: any) {
        console.error('[ERROR] /api/color-match:', error.message);
        res.status(500).json({ error: 'Error en búsqueda de color', details: error.message });
    }
});

// =================================================================
// POST /api/componentes/colores  – Get RGB colors for components
// =================================================================
// Helper to parse color from string (can be integer BGR, hex, or RGB comma-separated)
function parseComponentColor(colorStr: string | null | undefined): string {
    if (!colorStr) return '#555555';
    const trimmed = colorStr.trim();
    if (!trimmed) return '#555555';

    // 1. If it's already a hex starting with #
    if (trimmed.startsWith('#')) return trimmed;

    // 2. If it's a 6-digit hex string
    if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return '#' + trimmed;

    // 3. If it's RGB comma-separated (e.g. "255,0,0")
    if (trimmed.includes(',')) {
        const parts = trimmed.split(',').map(p => parseInt(p.trim()));
        if (parts.length >= 3 && parts.every(p => !isNaN(p))) {
            return `#${parts[0].toString(16).padStart(2, '0')}${parts[1].toString(16).padStart(2, '0')}${parts[2].toString(16).padStart(2, '0')}`;
        }
    }

    // 4. Try as integer (Delphi/Windows BGR format)
    const colorInt = parseInt(trimmed);
    if (!isNaN(colorInt)) {
        // Delphi BGR: clRed = 255 ($FF), clBlue = 16711680 ($FF0000)
        const b = (colorInt >> 16) & 0xFF;
        const g = (colorInt >> 8) & 0xFF;
        const r = colorInt & 0xFF;
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    return '#555555';
}

app.post('/api/componentes/colores', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { codigos } = req.body;
        if (!codigos || !Array.isArray(codigos)) {
            return res.status(400).json({ error: 'Codigos requeridos' });
        }

        console.log('[COLORES] Buscando colores para componentes:', codigos);
        const componentColors: any[] = [];
        const processed = new Set<string>();

        // 1. Check BASES table
        try {
            // Try multiple table name variations if quoted fail
            const queries = [
                `SELECT "CODIGO", "COLOR" FROM "BASES" WHERE "CODIGO" = ANY($1)`,
                `SELECT CODIGO, COLOR FROM BASES WHERE CODIGO = ANY($1)`
            ];

            let basesRes: any[] = [];
            for (const q of queries) {
                try {
                    basesRes = await prisma.$queryRawUnsafe(q, codigos);
                    if (basesRes.length > 0) break;
                } catch (e) { /* continue */ }
            }

            for (const base of basesRes) {
                const codeStr = String(base.CODIGO);
                if (processed.has(codeStr)) continue;
                processed.add(codeStr);

                const colorVal = parseInt(base.COLOR);
                let rgb = '#888888';
                let baseType: any = 'colored';
                if (colorVal === 1) {
                    rgb = '#FFFFFF';
                    baseType = 'white';
                } else if (colorVal === 2) {
                    rgb = 'transparent';
                    baseType = 'transparent';
                } else {
                    // Try parsing COLOR as a standard color value too if it's not 1 or 2
                    rgb = parseComponentColor(base.COLOR);
                }

                componentColors.push({
                    code: codeStr,
                    rgb,
                    isBase: true,
                    baseType,
                });
            }
        } catch (e: any) {
            console.log('[COLORES] Error en BASES:', e.message);
        }

        // 2. Check COLORANTES table
        try {
            // Try different variations of table names and columns (PRODUCTO vs CODIGO)
            const queries = [
                `SELECT "PRODUCTO" as "CODIGO", "COLOR" FROM "COLORANTES" WHERE "PRODUCTO" = ANY($1)`,
                `SELECT "CODIGO"::text as "CODIGO", "COLOR" FROM "COLORANTES" WHERE "CODIGO"::text = ANY($1)`,
                `SELECT PRODUCTO as "CODIGO", COLOR FROM COLORANTES WHERE PRODUCTO = ANY($1)`,
                `SELECT CODIGO::text as "CODIGO", COLOR FROM COLORANTES WHERE CODIGO::text = ANY($1)`
            ];

            let colorantesRes: any[] = [];
            for (const q of queries) {
                try {
                    const temp = await prisma.$queryRawUnsafe(q, codigos) as any[];
                    if (temp && temp.length > 0) {
                        colorantesRes.push(...temp);
                    }
                } catch (e) { /* ignore error and try next variation */ }
            }

            for (const c of colorantesRes) {
                const codeStr = String(c.CODIGO);
                if (processed.has(codeStr)) continue;
                processed.add(codeStr);

                componentColors.push({
                    code: codeStr,
                    rgb: parseComponentColor(c.COLOR),
                    isBase: false,
                    baseType: 'colorant',
                });
            }
        } catch (e: any) {
            console.log('[COLORES] Error en COLORANTES:', e.message);
        }

        // 3. For any codes not found, add with default
        for (const code of codigos) {
            if (!processed.has(code)) {
                componentColors.push({
                    code,
                    rgb: '#555555', // Grey fallback
                    isBase: false,
                    baseType: undefined,
                });
            }
        }

        console.log('[COLORES] Resultado Final:', componentColors.length, 'componentes');
        res.json(componentColors);
    } catch (error: any) {
        console.error('[ERROR] /api/componentes/colores:', error.message);
        res.status(500).json({ error: 'Error al obtener colores', details: error.message });
    }
});

app.get('/api/componentes/catalogo', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const bases: any[] = await prisma.$queryRawUnsafe(`SELECT "CODIGO", "COLOR" FROM "BASES"`);
        const colorantes: any[] = await prisma.$queryRawUnsafe(`SELECT "PRODUCTO" as "CODIGO", "COLOR" FROM "COLORANTES"`);

        const catalog = [
            ...bases.map(b => ({ code: String(b.CODIGO), color: parseComponentColor(b.COLOR) })),
            ...colorantes.map(c => ({ code: String(c.CODIGO), color: parseComponentColor(c.COLOR) }))
        ];

        // Remove duplicates and filter empty codes
        const unique = Array.from(new Map(catalog.filter(p => p.code).map(p => [p.code, p])).values());
        res.json(unique);
    } catch (error: any) {
        res.status(500).json({ error: 'Error al obtener catálogo', details: error.message });
    }
});

app.post('/api/ajustes/registrar-paso', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const {
            formulaCode,
            formulaName,
            lote,
            tipoPaso, // 'INICIO', 'ADICION', 'MEDICION'
            descripcion,
            datos
        } = req.body;

        if (!lote || !tipoPaso) {
            return res.status(400).json({ error: 'Lote y tipo de paso son obligatorios' });
        }

        const registro = await prisma.ajustesTecnicos.create({
            data: {
                id_cliente: idcliente,
                formula_codigo: formulaCode,
                formula_nombre: formulaName,
                lote: lote,
                tipo_paso: tipoPaso,
                descripcion: descripcion,
                datos: datos,
                fecha: new Date()
            }
        });

        res.json({ message: 'Paso registrado con éxito', id: registro.id });
    } catch (error: any) {
        console.error('[ERROR] /api/ajustes/registrar-paso:', error.message);
        res.status(500).json({ error: 'Error al registrar el paso técnico', details: error.message });
    }
});

app.get('/api/ajustes/historial/:lote', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { lote } = req.params;
        const historial = await prisma.ajustesTecnicos.findMany({
            where: { lote },
            orderBy: { fecha: 'asc' }
        });
        res.json(historial);
    } catch (error: any) {
        console.error('[ERROR] /api/ajustes/historial:', error.message);
        res.status(500).json({ error: 'Error al obtener el historial', details: error.message });
    }
});

app.get('/api/ajustes/todo-historial', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const historial = await prisma.ajustesTecnicos.findMany({
            where: { id_cliente: idcliente },
            orderBy: { fecha: 'desc' }
        });
        res.json(historial);
    } catch (error: any) {
        console.error('[ERROR] /api/ajustes/todo-historial:', error.message);
        res.status(500).json({ error: 'Error al obtener el historial completo', details: error.message });
    }
});

app.post('/api/ajustes/guardar', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const {
            formulaName,
            formulaCode,
            lote,
            history,
            source,
            originalFormulaId,
            currentLab,
            currentDeltaE,
            componentQuantities
        } = req.body;

        if (!formulaName || !lote) {
            return res.status(400).json({ error: 'Faltan datos obligatorios (Nombre, Lote)' });
        }

        const historyJson = JSON.stringify(history);

        const savedAdjustment = await prisma.formPersonales.create({
            data: {
                IDCLIENTE: idcliente,
                NOMBREFORMULA: formulaName,
                CODIGO: formulaCode,
                LOTE: lote,
                HISTORIALDOSIS: historyJson,
                DELTA: currentDeltaE?.toString(),
                L: currentLab?.l?.toString(),
                A: currentLab?.a?.toString(),
                B: currentLab?.b?.toString(),
                FECHACREADA: new Date().toISOString(),
            }
        });

        res.json({ message: 'Ajuste técnico guardado con éxito', id: savedAdjustment.ID });
    } catch (error: any) {
        console.error('[ERROR] /api/ajustes/guardar:', error.message);
        res.status(500).json({ error: 'Error al guardar el ajuste técnico', details: error.message });
    }
});

// =================================================================
// POST /api/upload-pdf  – Save PDF to VPS directory
// =================================================================
app.post('/api/upload-pdf', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        console.log('\n[UPLOAD-PDF] === INICIANDO SOLICITUD DE GUARDADO DE PDF ===');
        const { clientCode, lote, pdfBase64 } = req.body;

        if (!clientCode || !lote || !pdfBase64) {
            console.warn('[UPLOAD-PDF] Error: Faltan parámetros requeridos (clientCode, lote o pdfBase64).');
            return res.status(400).json({ error: 'Faltan parámetros: clientCode, lote, o pdfBase64' });
        }

        console.log(`[UPLOAD-PDF] Recibido - Cliente: "${clientCode}", Lote: "${lote}"`);
        console.log(`[UPLOAD-PDF] Longitud del Base64 recibido: ${pdfBase64.length} caracteres`);

        // Extraer puramente la cadena en Base64, ignorando cualquier prefijo dinámico o "filename" que añada jsPDF
        const parts = pdfBase64.split('base64,');
        const base64Data = parts.length > 1 ? parts[1] : parts[0];

        // Crear directorios
        const baseDir = path.join(__dirname, '../controlcalidad');
        if (!fs.existsSync(baseDir)) {
            console.log(`[UPLOAD-PDF] Directorio base no existe. Creando: ${baseDir}`);
            fs.mkdirSync(baseDir);
        } else {
            console.log(`[UPLOAD-PDF] Directorio base ya existe: ${baseDir}`);
        }

        const clientDir = path.join(baseDir, clientCode);
        if (!fs.existsSync(clientDir)) {
            console.log(`[UPLOAD-PDF] Directorio del cliente no existe. Creando: ${clientDir}`);
            fs.mkdirSync(clientDir);
        } else {
            console.log(`[UPLOAD-PDF] Directorio del cliente ya existe: ${clientDir}`);
        }

        const filePath = path.join(clientDir, `${lote}.pdf`);
        console.log(`[UPLOAD-PDF] Procediendo a guardar físicamente el PDF en la ruta: ${filePath}`);

        fs.writeFileSync(filePath, base64Data, 'base64');
        console.log(`[UPLOAD-PDF] ¡ÉXITO! Archivo ${lote}.pdf almacenado correctamente con un tamaño aproximado de ${(base64Data.length * 0.75 / 1024).toFixed(2)} KB.`);
        console.log('[UPLOAD-PDF] ==================================================\n');

        res.json({ message: 'PDF guardado correctamente', path: filePath });
    } catch (error: any) {
        console.error('[UPLOAD-PDF] [ERROR CRÍTICO]:', error.message);
        res.status(500).json({ error: 'Error al guardar el PDF', details: error.message });
    }
});

// =================================================================
// GET /api/pdfs/:clientCode  – List PDFs
// =================================================================
app.get('/api/pdfs/:clientCode', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        console.log('\n[GET-PDFs] === INICIANDO LECTURA DE DIRECTORIO DE PDFs ===');
        const { clientCode } = req.params;

        // Define la ruta usando __dirname o asumiendo el root de la app (/app)
        const baseDir = path.join(__dirname, '../controlcalidad');
        const clientDir = path.join(baseDir, clientCode);

        console.log(`[GET-PDFs] Buscando reportes para el cliente: "${clientCode}"`);
        console.log(`[GET-PDFs] Directorio Base resuelto: ${baseDir}`);
        console.log(`[GET-PDFs] Directorio Cliente resuelto: ${clientDir}`);

        if (!fs.existsSync(clientDir)) {
            console.warn(`[GET-PDFs] AVISO: El directorio ${clientDir} NO existe aún.`);
            return res.json([]);
        }

        console.log(`[GET-PDFs] ✔️ El directorio existe. Leyendo archivos...`);
        const allFiles = fs.readdirSync(clientDir);
        console.log(`[GET-PDFs] Todos los archivos encontrados:`, allFiles);

        const pdfFiles = allFiles.filter(file => file.toLowerCase().endsWith('.pdf'));
        console.log(`[GET-PDFs] Cantidad de PDFs válidos: ${pdfFiles.length}`);

        const fileData = pdfFiles.map(file => {
            const stat = fs.statSync(path.join(clientDir, file));
            return {
                name: file,
                url: `/controlcalidad/${clientCode}/${file}`,
                date: stat.mtime
            };
        });

        // Sort newest first
        fileData.sort((a, b) => b.date.getTime() - a.date.getTime());

        console.log(`[GET-PDFs] Respondido con éxito. Devolviendo ${fileData.length} reportes.`);
        console.log('[GET-PDFs] ==================================================\n');

        res.json(fileData);
    } catch (error: any) {
        console.error('[GET-PDFs] [ERROR CRÍTICO]:', error.message);
        res.status(500).json({ error: 'Error al listar PDFs', details: error.message });
    }
});

app.use('/controlcalidad', express.static(path.join(__dirname, '../controlcalidad')));

const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        console.log(`[404] API Route not found: ${req.method} ${req.path}`);
        return res.status(404).json({ error: `Ruta de API no encontrada: ${req.method} ${req.path}` });
    }
    if (req.method === 'GET') return res.sendFile(path.join(distPath, 'index.html'));
    next();
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
