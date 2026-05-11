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
Eres el Asistente Experto de Quimresa, especializado en colorimetría, medición de color y Laboratorio de Pinturas.
Tu objetivo es ayudar a los operadores de la planta con dudas técnicas, cálculos y mezclas.

REGLAS DE RESPUESTA:
1. Sé extremadamente breve y directo. Máximo 2-3 frases por respuesta.
2. Si el usuario pide cálculos (ej. Delta E, conversiones, mezclas porcentuales), realízalos con precisión matemática.
3. El tono debe ser profesional pero servicial.
4. Habla siempre en español.
5. Si no sabes algo de colorimetría específica, sugiere consultar al jefe de laboratorio.

CONTEXTO TÉCNICO:
- Trabajamos con espacios de color CIELAB (L*, a*, b*).
- Delta E (ΔE) < 1.0 suele ser el estándar de aprobación en Quimresa.
- Ayuda con reglas de mezcla: si falta rojo, añadir pigmento magenta o rojo respectivo; si el color es muy claro, ajustar bases.

OPERACIONES MATEMÁTICAS:
- Eres capaz de resolver ecuaciones de mezclas de pigmentos y cálculos de rendimiento.
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
                model = vertexAI.getGenerativeModel({ model: "gemini-2.5-flash" });
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

        // 1. Intentar en tabla BASES
        try {
            const basesRes: any[] = await prisma.$queryRawUnsafe(
                `SELECT "CODIGO" as "CODIGO", "DENSIDAD" FROM "BASES" WHERE "CODIGO" = ANY($1)`,
                codigos
            );
            if (basesRes && basesRes.length > 0) {
                console.log('[DEBUG] Encontrados en BASES:', basesRes.map(b => b.CODIGO));
                results.push(...basesRes);
            }
        } catch (e: any) {
            console.log('[DEBUG] Falló consulta a tabla BASES:', e.message);
        }

        // 2. Intentar en tabla COLORANTES (Columna PRODUCTO es el código)
        try {
            const colorantesRes: any[] = await prisma.$queryRawUnsafe(
                `SELECT "PRODUCTO" as "CODIGO", "DENSIDAD" FROM "COLORANTES" WHERE "PRODUCTO" = ANY($1)`,
                codigos
            );
            if (colorantesRes && colorantesRes.length > 0) {
                console.log('[DEBUG] Encontrados en COLORANTES (PRODUCTO):', colorantesRes.map(c => c.CODIGO));
                results.push(...colorantesRes);
            }
        } catch (e: any) {
            console.log('[DEBUG] Falló consulta a COLORANTES (PRODUCTO):', e.message);
        }

        // 3. Intentar en tabla COLORANTES (Columna CODIGO)
        try {
            const colorantesRes2: any[] = await prisma.$queryRawUnsafe(
                `SELECT "CODIGO"::text as "CODIGO", "DENSIDAD" FROM "COLORANTES" WHERE "CODIGO"::text = ANY($1)`,
                codigos
            );
            if (colorantesRes2 && colorantesRes2.length > 0) {
                console.log('[DEBUG] Encontrados en COLORANTES (CODIGO):', colorantesRes2.map(c => c.CODIGO));
                results.push(...colorantesRes2);
            }
        } catch (e: any) { }

        // Eliminar duplicados y asegurar que la densidad sea numérica
        const uniqueResults = Array.from(new Map(results.map(item => [
            item.CODIGO,
            { ...item, DENSIDAD: parseFloat(item.DENSIDAD) || 1.0 }
        ])).values());

        res.json(uniqueResults);
    } catch (error: any) {
        console.error('[ERROR] /api/componentes/densidades:', error.message);
        res.status(500).json({ error: 'Error al obtener densidades', details: error.message });
    }
});

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
