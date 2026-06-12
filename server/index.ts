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

// Robust CORS configuration for Mobile/Capacitor
app.use((req, res, next) => {
    const origin = req.headers.origin;

    // Si hay origen, siempre permitirlo para evitar bloqueos en Capacitor/Desarrollo
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-client-id, X-Client-Id');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    }

    // Responder inmediatamente a Preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

const corsOptions = {
    origin: (origin: any, callback: any) => callback(null, true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'x-client-id', 'X-Client-Id']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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
        res.json({ message: 'Login exitoso', token, user: { id: usuario.id, name: usuario.name, empresa: usuario.cliente?.NOMBRE || 'Desconocido', typeuser: usuario.typeuser, idcliente: usuario.idcliente, permisos: usuario.permisos, issuper: usuario.cliente?.issuper === true } });
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

        // ADMIN OVERRIDE: Si es admin y envía x-client-id, sobreescribir el idcliente del token
        const adminClientId = req.headers['x-client-id'];
        if (user.typeuser == 0 && adminClientId) {
            user.idcliente = Number(adminClientId);
        }

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

app.get('/api/clientes', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const clientes = await prisma.cliente.findMany({
            orderBy: { NOMBRE: 'asc' }
        });
        res.json(clientes);
    } catch (error) {
        console.error('Error al obtener clientes:', error);
        res.status(500).json({ error: 'Error al obtener clientes' });
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
        const { L, A, B, R, G, RB, C, H, X, Y, Z, cmykC, cmykM, cmykY, cmykK, hex, LRV, Density, fecha, nombre, notas, id_libreria, id_coleccion, blanco_referencia, modo_medicion, densidad, promedio } = req.body;

        const libId = id_libreria != null ? Number(id_libreria) : null;
        const colId = id_coleccion != null ? Number(id_coleccion) : null;

        const medicion = await prisma.medicion.create({
            data: {
                cliente:     { connect: { CODIGO: idcliente } },
                nombre:      nombre || 'Escaneo',
                fecha:       fecha ? new Date(fecha) : new Date(),
                notas:       notas || null,
                ...(libId != null ? { libreriaObj:  { connect: { id: libId } } } : {}),
                ...(colId != null ? { coleccionObj: { connect: { id: colId } } } : {}),
                L:       L       != null ? Number(L)              : null,
                A:       A       != null ? Number(A)              : null,
                B:       B       != null ? Number(B)              : null,
                R:       R       != null ? Math.round(Number(R))  : null,
                G:       G       != null ? Math.round(Number(G))  : null,
                RB:      RB      != null ? Math.round(Number(RB)) : null,
                C:       C       != null ? Number(C)              : null,
                H:       H       != null ? Number(H)              : null,
                X:       X       != null ? Number(X)              : null,
                Y:       Y       != null ? Number(Y)              : null,
                Z:       Z       != null ? Number(Z)              : null,
                cmykC:   cmykC   != null ? Number(cmykC)          : null,
                cmykM:   cmykM   != null ? Number(cmykM)          : null,
                cmykY:   cmykY   != null ? Number(cmykY)          : null,
                cmykK:   cmykK   != null ? Number(cmykK)          : null,
                hex:     hex     || null,
                LRV:     LRV     != null ? Number(LRV)            : null,
                Density: Density != null ? Number(Density)        : null,
                blanco_referencia: blanco_referencia || null,
                modo_medicion:     modo_medicion     || null,
                densidad:          densidad          || null,
                promedio:          promedio != null ? Number(promedio) : null,
            }
        });
        res.status(201).json(medicion);
    } catch (error: any) {
        console.error('[ERROR] al guardar medicion:', error);
        res.status(500).json({ error: 'Error al guardar medición', details: error.message });
    }
});

app.get('/api/mediciones', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = (page - 1) * limit;
        const search = req.query.search as string || '';
        const id_libreria = req.query.id_libreria as string || '';
        const id_coleccion = req.query.id_coleccion as string || '';

        const where: any = { id_cliente: idcliente };

        if (search) {
            where.nombre = { contains: search, mode: 'insensitive' };
        }

        if (id_libreria) {
            where.id_libreria = parseInt(id_libreria);
        }

        if (id_coleccion) {
            where.id_coleccion = parseInt(id_coleccion);
        }

        const [mediciones, total] = await Promise.all([
            prisma.medicion.findMany({
                where,
                orderBy: { fecha: 'desc' },
                skip,
                take: limit,
                include: {
                    libreriaObj: { select: { id: true, nombre: true } },
                    coleccionObj: { select: { id: true, nombre: true } },
                },
            }),
            prisma.medicion.count({ where })
        ]);

        res.json({ mediciones, total, page, limit });
    } catch (error: any) {
        console.error('[ERROR] al obtener mediciones:', error);
        res.status(500).json({ error: 'Error al obtener mediciones', details: error.message });
    }
});

// --- ENDPOINTS LIBRERIAS Y COLECCIONES ---
app.get('/api/librerias', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        let librerias = await prisma.libreria.findMany({
            where: { id_cliente: idcliente },
            orderBy: { nombre: 'asc' }
        });

        // Si el cliente no tiene ninguna librería, crear una por defecto con el nombre del cliente
        if (librerias.length === 0) {
            const cliente = await prisma.cliente.findUnique({ where: { CODIGO: idcliente } });
            const nombreDefault = cliente?.NOMBRE?.trim() || `Cliente ${idcliente}`;
            const libreriaDefault = await prisma.libreria.create({
                data: { nombre: nombreDefault, id_cliente: idcliente }
            });
            librerias = [libreriaDefault];
            console.log(`[LIBRERIAS] Librería por defecto creada para cliente ${idcliente}: "${nombreDefault}"`);
        }

        res.json(librerias);
    } catch (error: any) {
        res.status(500).json({ error: 'Error al obtener librerías', details: error.message });
    }
});

app.post('/api/librerias', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const { nombre } = req.body;
        if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' });
        const nuevaLibreria = await prisma.libreria.create({
            data: {
                nombre,
                id_cliente: idcliente
            }
        });
        res.status(201).json(nuevaLibreria);
    } catch (error: any) {
        res.status(500).json({ error: 'Error al crear librería', details: error.message });
    }
});

app.get('/api/librerias/:id/colecciones', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const colecciones = await prisma.coleccion.findMany({
            where: { id_libreria: Number(id) },
            orderBy: { nombre: 'asc' }
        });
        res.json(colecciones);
    } catch (error: any) {
        res.status(500).json({ error: 'Error al obtener colecciones', details: error.message });
    }
});

app.post('/api/librerias/:id/colecciones', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { nombre } = req.body;
        if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' });
        const nuevaColeccion = await prisma.coleccion.create({
            data: {
                nombre,
                id_libreria: Number(id)
            }
        });
        res.status(201).json(nuevaColeccion);
    } catch (error: any) {
        res.status(500).json({ error: 'Error al crear colección', details: error.message });
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
        const { idcliente, typeuser, email } = (req as any).user;
        console.log(`[BACKEND] Solicitud /api/formulas | Usuario: ${email} | Type: ${typeuser} | idcliente: ${idcliente}`);

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 25;
        const search = (req.query.q as string) || '';
        const sortBy = (req.query.sortBy as string) || 'FECHA';
        const skip = (page - 1) * limit;

        const where: any = {
            NOMBREFORMULA: { not: '' },
            FECHA: { not: '' },
            CODIGO: { not: '' },
        };
        if (idcliente) {
            where.IDCLIENTE = idcliente;
        }
        if (search) {
            where.AND = [
                {
                    OR: [
                        { NOMBREFORMULA: { contains: search, mode: 'insensitive' } },
                        { CODIGO: { contains: search, mode: 'insensitive' } }
                    ]
                }
            ];
        }

        let formulas: any[];

        if (sortBy === 'NOMBREFORMULA') {
            formulas = await prisma.formPersonales.findMany({
                where,
                orderBy: [{ NOMBREFORMULA: 'asc' }],
                skip, take: limit
            });
        } else {
            const conds: string[] = [];
            const params: any[] = [];
            let idx = 1;

            conds.push(`"NOMBREFORMULA" != ''`);
            conds.push(`"FECHA" != ''`);
            conds.push(`"CODIGO" != ''`);

            if (idcliente) {
                conds.push(`"IDCLIENTE" = $${idx++}`);
                params.push(idcliente);
            }

            if (search) {
                conds.push(`("NOMBREFORMULA" ILIKE $${idx} OR "CODIGO" ILIKE $${idx})`);
                params.push(`%${search}%`);
                idx++;
            }

            const whereSQL = conds.join(' AND ');
            params.push(skip, limit);
            const sql = `SELECT * FROM "formpersonales" WHERE ${whereSQL} ORDER BY TO_TIMESTAMP("FECHA", 'MM/DD/YYYY HH:MI:SS AM') DESC OFFSET $${idx++} LIMIT $${idx++}`;

            console.log(`[BACKEND] /api/formulas | sortBy=FECHA (TO_TIMESTAMP) | sql=${sql} | params=${JSON.stringify(params)}`);
            formulas = await prisma.$queryRawUnsafe(sql, ...params);
        }

        console.log(`[BACKEND] /api/formulas | sortBy=${sortBy} | registros devueltos=${formulas.length} | page=${page}`, JSON.stringify(formulas, null, 2));
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

app.get('/api/formpersonaleslote/:idformula', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idformula } = req.params;
        console.log(`[BACKEND API] Solicitud recibida en /api/formpersonaleslote/${idformula}`);
        console.log(`[BACKEND API] Ejecutando consulta SQL en tabla "formpersonaleslote" para "IDFORMULA" = ${idformula}`);
        const lotes = await prisma.$queryRawUnsafe(
            `SELECT * FROM "formpersonaleslote" WHERE "IDFORMULA" = $1 ORDER BY "FECHA" DESC`,
            Number(idformula)
        );
        console.log(`[BACKEND API] Consulta completada. Se encontraron ${Array.isArray(lotes) ? lotes.length : 0} registros de lotes para la fórmula ID: ${idformula}`);
        res.json(lotes);
    } catch (error: any) {
        console.error(`[ERROR BACKEND] /api/formpersonaleslote/${req.params?.idformula}:`, error.message);
        res.status(500).json({ error: 'Error al obtener lotes', details: error.message });
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
        const personalWhere: any = {
            L: { not: null, notIn: [''] },
            A: { not: null, notIn: [''] },
            B: { not: null, notIn: [''] },
            FECHA: { not: '' },
            FECHACREADA: { not: '' },
        };
        if (idcliente) {
            personalWhere.IDCLIENTE = idcliente;
        }

        const personalMinData = await prisma.formPersonales.findMany({
            where: personalWhere,
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
        const where: any = {};
        if (idcliente) {
            where.id_cliente = idcliente;
        }

        const historial = await prisma.ajustesTecnicos.findMany({
            where,
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
// QUALITY CONTROL RECORDS
// =================================================================
app.post('/api/qualitycontrol', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const {
            nombre,
            descripcion,
            patron_nombre,
            patron_l,
            patron_a,
            patron_b,
            patron_hex,
            muestra_nombre,
            muestra_l,
            muestra_a,
            muestra_b,
            muestra_hex,
            delta_e,
            delta_l,
            delta_a,
            delta_b,
            blanco_referencia,
            modo_medicion,
            densidad,
            pdf_url,
            fecha_registro
        } = req.body;

        // Usar la fecha/hora local enviada por el cliente; si no viene, usar la hora actual del servidor
        const creadoEn: Date = fecha_registro ? new Date(fecha_registro) : new Date();

        let qcRecord;
        const existing = await prisma.qualityControl.findFirst({
            where: {
                id_cliente: idcliente,
                nombre: nombre
            }
        });

        if (existing) {
            qcRecord = await prisma.qualityControl.update({
                where: { id: existing.id },
                data: {
                    descripcion: descripcion !== undefined ? descripcion : existing.descripcion,
                    patron_nombre: patron_nombre !== undefined ? patron_nombre : existing.patron_nombre,
                    patron_l: patron_l !== undefined ? parseFloat(patron_l) : existing.patron_l,
                    patron_a: patron_a !== undefined ? parseFloat(patron_a) : existing.patron_a,
                    patron_b: patron_b !== undefined ? parseFloat(patron_b) : existing.patron_b,
                    patron_hex: patron_hex !== undefined ? patron_hex : existing.patron_hex,
                    muestra_nombre: muestra_nombre !== undefined ? muestra_nombre : existing.muestra_nombre,
                    muestra_l: muestra_l !== undefined ? parseFloat(muestra_l) : existing.muestra_l,
                    muestra_a: muestra_a !== undefined ? parseFloat(muestra_a) : existing.muestra_a,
                    muestra_b: muestra_b !== undefined ? parseFloat(muestra_b) : existing.muestra_b,
                    muestra_hex: muestra_hex !== undefined ? muestra_hex : existing.muestra_hex,
                    delta_e: delta_e !== undefined ? parseFloat(delta_e) : existing.delta_e,
                    delta_l: delta_l !== undefined ? parseFloat(delta_l) : existing.delta_l,
                    delta_a: delta_a !== undefined ? parseFloat(delta_a) : existing.delta_a,
                    delta_b: delta_b !== undefined ? parseFloat(delta_b) : existing.delta_b,
                    blanco_referencia: blanco_referencia !== undefined ? blanco_referencia : existing.blanco_referencia,
                    modo_medicion: modo_medicion !== undefined ? modo_medicion : existing.modo_medicion,
                    densidad: densidad !== undefined ? densidad : existing.densidad,
                    pdf_url: pdf_url !== undefined ? pdf_url : existing.pdf_url,
                    creado_en: creadoEn
                }
            });
            console.log(`[QUALITY-CONTROL] Registro actualizado ID: ${qcRecord.id}`);
        } else {
            qcRecord = await prisma.qualityControl.create({
                data: {
                    id_cliente: idcliente,
                    nombre,
                    descripcion,
                    patron_nombre,
                    patron_l: patron_l != null ? parseFloat(patron_l) : null,
                    patron_a: patron_a != null ? parseFloat(patron_a) : null,
                    patron_b: patron_b != null ? parseFloat(patron_b) : null,
                    patron_hex,
                    muestra_nombre,
                    muestra_l: muestra_l != null ? parseFloat(muestra_l) : null,
                    muestra_a: muestra_a != null ? parseFloat(muestra_a) : null,
                    muestra_b: muestra_b != null ? parseFloat(muestra_b) : null,
                    muestra_hex,
                    delta_e: delta_e != null ? parseFloat(delta_e) : null,
                    delta_l: delta_l != null ? parseFloat(delta_l) : null,
                    delta_a: delta_a != null ? parseFloat(delta_a) : null,
                    delta_b: delta_b != null ? parseFloat(delta_b) : null,
                    blanco_referencia,
                    modo_medicion,
                    densidad,
                    pdf_url,
                    creado_en: creadoEn
                }
            });
            console.log(`[QUALITY-CONTROL] Registro creado ID: ${qcRecord.id}`);
        }

        res.json({ message: 'Control de calidad guardado con éxito', record: qcRecord });
    } catch (error: any) {
        console.error('[ERROR] /api/qualitycontrol POST:', error.message);
        res.status(500).json({ error: 'Error al guardar el control de calidad', details: error.message });
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

// ─── QualityControl CRUD ──────────────────────────────────────────────────────

// GET /api/qualitycontrol  — lista paginada con búsqueda y filtro de fecha
app.get('/api/qualitycontrol', async (req: Request, res: Response) => {
    console.log('\n[GET /api/qualitycontrol] ---> INICIO PETICIÓN');
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        console.log('[GET /api/qualitycontrol] Token presente:', !!token);
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        
        const decoded: any = jwt.verify(token, JWT_SECRET);
        console.log('[GET /api/qualitycontrol] Usuario decodificado:', { id: decoded.id, typeuser: decoded.typeuser, idcliente: decoded.idcliente });
        
        const clientIdHeader = req.headers['x-client-id'];
        console.log('[GET /api/qualitycontrol] Header x-client-id recibido:', clientIdHeader);
        
        let idcliente: number | undefined;
        if (clientIdHeader !== undefined && clientIdHeader !== null && clientIdHeader !== '') {
            idcliente = Number(clientIdHeader);
        }
        if (isNaN(idcliente as any)) {
            idcliente = decoded.idcliente ? Number(decoded.idcliente) : undefined;
        }
        console.log('[GET /api/qualitycontrol] ID Cliente resuelto a usar:', idcliente);

        const page   = Math.max(1, Number(req.query.page)  || 1);
        const limit  = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
        const search = (req.query.search as string || '').trim();
        const desde  = req.query.desde  as string | undefined;
        const hasta  = req.query.hasta  as string | undefined;

        const where: any = {};
        
        if (idcliente !== undefined && idcliente !== null && idcliente !== 0 && !isNaN(idcliente)) {
            where.id_cliente = idcliente;
            console.log('[GET /api/qualitycontrol] Filtro id_cliente aplicado:', idcliente);
        } else if (decoded.typeuser != 0 && decoded.typeuser != '0') {
            where.id_cliente = decoded.idcliente || -1; 
            console.log('[GET /api/qualitycontrol] Usuario normal sin id_cliente, usando fallback:', where.id_cliente);
        } else {
            console.log('[GET /api/qualitycontrol] Usuario es ADMIN, omitiendo filtro de cliente (viendo todos)');
        }

        if (search) {
            where.OR = [
                { nombre:      { contains: search, mode: 'insensitive' } },
                { descripcion: { contains: search, mode: 'insensitive' } }
            ];
            console.log('[GET /api/qualitycontrol] Búsqueda aplicada:', search);
        }
        if (desde || hasta) {
            where.creado_en = {};
            if (desde) where.creado_en.gte = new Date(desde);
            if (hasta) {
                const h = new Date(hasta);
                h.setHours(23, 59, 59, 999);
                where.creado_en.lte = h;
            }
            console.log('[GET /api/qualitycontrol] Filtro de fecha aplicado:', { desde, hasta });
        }
        
        console.log('[GET /api/qualitycontrol] WHERE clause Prisma:', JSON.stringify(where, null, 2));

        const [total, records] = await Promise.all([
            prisma.qualityControl.count({ where }),
            prisma.qualityControl.findMany({
                where,
                orderBy: { creado_en: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            })
        ]);
        
        console.log(`[GET /api/qualitycontrol] Resultados: total=${total}, registros_devueltos=${records.length}`);

        return res.json({ total, page, limit, records });
    } catch (error: any) {
        console.error('[GET /api/qualitycontrol] ERROR CRÍTICO:', error.message);
        return res.status(500).json({ error: 'Error al listar registros' });
    }
});

// POST /api/qualitycontrol — crear registro
app.post('/api/qualitycontrol', async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        const decoded: any = jwt.verify(token, JWT_SECRET);
        
        const clientIdHeader = req.headers['x-client-id'];
        let idcliente: number | null = null;
        if (clientIdHeader !== undefined && clientIdHeader !== null && clientIdHeader !== '') {
            idcliente = Number(clientIdHeader);
        }
        if (idcliente === null || isNaN(idcliente) || idcliente === 0) {
            idcliente = decoded.idcliente ? Number(decoded.idcliente) : null;
            if (idcliente === 0) idcliente = null;
        }

        const {
            nombre, descripcion,
            patron_nombre, patron_l, patron_a, patron_b, patron_hex,
            muestra_nombre, muestra_l, muestra_a, muestra_b, muestra_hex,
            delta_e, delta_l, delta_a, delta_b,
            blanco_referencia, modo_medicion, densidad,
            pdf_url,
            fecha_registro
        } = req.body;

        // Usar la fecha/hora local enviada por el cliente; si no viene, usar la hora actual del servidor
        const creadoEn: Date = fecha_registro ? new Date(fecha_registro) : new Date();

        const record = await prisma.qualityControl.create({
            data: {
                nombre, descripcion,
                patron_nombre, patron_l, patron_a, patron_b, patron_hex,
                muestra_nombre, muestra_l, muestra_a, muestra_b, muestra_hex,
                delta_e, delta_l, delta_a, delta_b,
                blanco_referencia, modo_medicion, densidad,
                pdf_url,
                id_cliente: idcliente,
                creado_en: creadoEn
            }
        });

        return res.status(201).json(record);
    } catch (error: any) {
        console.error('[POST qualitycontrol]', error.message);
        return res.status(500).json({ error: 'Error al guardar registro' });
    }
});

// ─── END QualityControl ────────────────────────────────────────────────────────

// =================================================================
// ─── DeltaRango CRUD ──────────────────────────────────────────────
// =================================================================

// GET /api/deltarango — all rows ordered by VALOR
app.get('/api/deltarango', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const rows = await prisma.deltaRango.findMany({ orderBy: { VALOR: 'asc' } });
        res.json(rows);
    } catch (error: any) {
        console.error('[ERROR] GET /api/deltarango:', error.message);
        res.status(500).json({ error: 'Error al obtener rangos de delta', details: error.message });
    }
});

// PUT /api/deltarango/:id — update NOMBRE, VALOR, COLOR, COLORTEXTO
app.put('/api/deltarango/:id', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { NOMBRE, VALOR, COLOR, COLORTEXTO } = req.body;

        const existing = await prisma.deltaRango.findUnique({ where: { id: Number(id) } });
        if (!existing) return res.status(404).json({ error: 'Rango no encontrado' });

        const updated = await prisma.deltaRango.update({
            where: { id: Number(id) },
            data: {
                ...(NOMBRE !== undefined ? { NOMBRE } : {}),
                ...(VALOR !== undefined ? { VALOR: Number(VALOR) } : {}),
                ...(COLOR !== undefined ? { COLOR: Number(COLOR) } : {}),
                ...(COLORTEXTO !== undefined ? { COLORTEXTO: Number(COLORTEXTO) } : {}),
            }
        });
        res.json(updated);
    } catch (error: any) {
        console.error('[ERROR] PUT /api/deltarango:', error.message);
        res.status(500).json({ error: 'Error al actualizar rango', details: error.message });
    }
});

// POST /api/deltarango/reset — restore default values
app.post('/api/deltarango/reset', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        // Auto-compute text color from background luminance
        function autoTextColor(bgrColor: number): number {
            const r = bgrColor & 0xFF;
            const g = (bgrColor >> 8) & 0xFF;
            const b = (bgrColor >> 16) & 0xFF;
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            return luminance > 128 ? 0 : 16777215;
        }

        const defaults = [
            { VALOR: 0.3,         NOMBRE: 'EXCELENTE',  COLOR: 8454016 },
            { VALOR: 0.6,         NOMBRE: 'APROBADO',   COLOR: 65535 },
            { VALOR: 0.9,         NOMBRE: 'ACEPTABLE',  COLOR: 33023 },
            { VALOR: 1.2,         NOMBRE: 'REGULAR',    COLOR: 8388736 },
            { VALOR: 999999999.0, NOMBRE: 'NO PASA',    COLOR: 255 },
        ];

        await prisma.$queryRawUnsafe(`DELETE FROM "deltarango"`);

        for (const d of defaults) {
            await prisma.$queryRawUnsafe(
                `INSERT INTO "deltarango" ("VALOR", "NOMBRE", "COLOR", "COLORTEXTO") VALUES ($1, $2, $3, $4)`,
                d.VALOR, d.NOMBRE, d.COLOR, autoTextColor(d.COLOR)
            );
        }

        const rows = await prisma.deltaRango.findMany({ orderBy: { VALOR: 'asc' } });
        console.log('[DELTARANGO] Reset to defaults, rows:', rows.length);
        res.json(rows);
    } catch (error: any) {
        console.error('[ERROR] POST /api/deltarango/reset:', error.message);
        res.status(500).json({ error: 'Error al restaurar rangos', details: error.message });
    }
});

// ─── END DeltaRango ────────────────────────────────────────────────────────────

// ─── BASES (Fichas Técnicas / Seguridad) ─────────────────────────────────────

app.get('/api/bases', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { search, grupo, producto, exactCode } = req.query;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
        const offset = (page - 1) * limit;

        let whereClause = ` WHERE 1=1`;
        const params: any[] = [];
        let paramIndex = 1;

        if (exactCode) {
            whereClause += ` AND "CODIGO" ILIKE $${paramIndex}`;
            params.push(exactCode);
            paramIndex++;
        }
        if (search) {
            whereClause += ` AND ("CODIGO" ILIKE $${paramIndex} OR "DESCRIPCIO" ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        if (grupo) {
            whereClause += ` AND "GRUPO" = $${paramIndex}`;
            params.push(grupo);
            paramIndex++;
        }
        if (producto) {
            whereClause += ` AND "PRODUCTO" = $${paramIndex}`;
            params.push(producto);
            paramIndex++;
        }

        const countResult: any[] = await prisma.$queryRawUnsafe(
            `SELECT COUNT(*) as total FROM "BASES"${whereClause}`, ...params
        );
        const total = Number(countResult[0]?.total) || 0;

        // Cuando se busca por exactCode (metadatos para fichas), usar SELECT liviano
        // que sólo trae presencia de PDF (no el contenido base64 completo)
        const selectClause = exactCode
            ? `"ID", "CODIGO", "DESCRIPCIO", "PRODUCTO", "GRUPO",
               ("FICHATECNICA" IS NOT NULL AND "FICHATECNICA" != '') AS "FICHATECNICA",
               ("FICHASEGURIDAD" IS NOT NULL AND "FICHASEGURIDAD" != '') AS "FICHASEGURIDAD"`
            : `*`;

        const bases = await prisma.$queryRawUnsafe(
            `SELECT ${selectClause} FROM "BASES"${whereClause} ORDER BY "CODIGO" ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            ...params, limit, offset
        );

        res.json({ records: bases, total, page, limit, hasMore: offset + limit < total });
    } catch (error: any) {
        console.error('[ERROR] GET /api/bases:', error.message);
        res.status(500).json({ error: 'Error al obtener bases', details: error.message });
    }
});

app.get('/api/bases/productos', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const rows: any[] = await prisma.$queryRawUnsafe(
            `SELECT DISTINCT "PRODUCTO" FROM "BASES" WHERE "PRODUCTO" IS NOT NULL ORDER BY "PRODUCTO"`
        );
        res.json(rows.map(r => r.PRODUCTO));
    } catch (error: any) {
        console.error('[ERROR] GET /api/bases/productos:', error.message);
        res.status(500).json({ error: 'Error al obtener productos', details: error.message });
    }
});

app.get('/api/bases/grupos', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { producto } = req.query;
        let sql = `SELECT DISTINCT "GRUPO" FROM "BASES" WHERE "GRUPO" IS NOT NULL`;
        const params: any[] = [];
        if (producto) {
            sql += ` AND "PRODUCTO" = $1`;
            params.push(producto);
        }
        sql += ` ORDER BY "GRUPO"`;
        const rows: any[] = await prisma.$queryRawUnsafe(sql, ...params);
        res.json(rows.map(r => r.GRUPO));
    } catch (error: any) {
        console.error('[ERROR] GET /api/bases/grupos:', error.message);
        res.status(500).json({ error: 'Error al obtener grupos', details: error.message });
    }
});

app.put('/api/bases/:id', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { FICHATECNICA, FICHASEGURIDAD } = req.body;

        if (FICHATECNICA !== undefined) {
            await prisma.$executeRawUnsafe(
                `UPDATE "BASES" SET "FICHATECNICA" = $1 WHERE "ID" = $2`,
                FICHATECNICA, Number(id)
            );
        } else if (FICHASEGURIDAD !== undefined) {
            await prisma.$executeRawUnsafe(
                `UPDATE "BASES" SET "FICHASEGURIDAD" = $1 WHERE "ID" = $2`,
                FICHASEGURIDAD, Number(id)
            );
        } else {
            return res.status(400).json({ error: 'Debe enviar FICHATECNICA o FICHASEGURIDAD' });
        }

        const updated: any[] = await prisma.$queryRawUnsafe(
            `SELECT * FROM "BASES" WHERE "ID" = $1`, Number(id)
        );
        res.json(updated[0] || {});
    } catch (error: any) {
        console.error('[ERROR] PUT /api/bases/:id:', error.message);
        res.status(500).json({ error: 'Error al actualizar base', details: error.message });
    }
});

app.get('/api/bases/:id/pdf/:field', async (req: Request, res: Response): Promise<any> => {
    try {
        const token = req.headers['authorization']?.split(' ')[1] || req.query.token as string;
        if (!token) return res.status(401).json({ error: 'Token requerido' });
        jwt.verify(token, JWT_SECRET, async (err: any) => {
            if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
            try {
                const { id, field } = req.params;
                if (!['FICHATECNICA', 'FICHASEGURIDAD'].includes(field)) {
                    return res.status(400).json({ error: 'Campo inválido' });
                }
                const rows: any[] = await prisma.$queryRawUnsafe(
                    `SELECT "${field}" FROM "BASES" WHERE "ID" = $1`, Number(id)
                );
                const base64 = rows[0]?.[field];
                if (!base64) return res.status(404).json({ error: 'PDF no encontrado' });
                
                const parts = base64.split('base64,');
                const base64Data = parts.length > 1 ? parts[1] : parts[0];
                const buffer = Buffer.from(base64Data, 'base64');
                
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'inline');
                res.send(buffer);
            } catch (innerError: any) {
                console.error('[ERROR] GET /api/bases/:id/pdf/:field:', innerError.message);
                res.status(500).json({ error: 'Error al obtener PDF', details: innerError.message });
            }
        });
    } catch (error: any) {
        console.error('[ERROR] GET /api/bases/:id/pdf/:field:', error.message);
        res.status(500).json({ error: 'Error al obtener PDF', details: error.message });
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
