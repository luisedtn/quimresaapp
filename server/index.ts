import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased to upload LOGO
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-quimresa-lab-2026';

app.post('/api/login', async (req: Request, res: Response): Promise<any> => {
    const { correo, password } = req.body;

    if (!correo || !password) {
        return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
    }

    try {
        // 1. Check if user exists by name (assuming name is the email/login)
        const usuario = await prisma.usuario.findFirst({
            where: {
                name: correo,
            },
            include: {
                cliente: true // Include client info
            }
        });

        if (!usuario) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // 2. Verificar que el usuario tenga un idcliente asigando y que el cliente exista
        if (!usuario.idcliente || !usuario.cliente) {
            return res.status(403).json({ error: 'El usuario no tiene un cliente válido asignado' });
        }

        // 3. Verificar que el cliente esté autorizado
        if (usuario.cliente.autorizado !== true) {
            return res.status(403).json({ error: 'El cliente asignado a su cuenta no está autorizado' });
        }

        // 4. Check if user itself is authorized
        if (!usuario.autorizado) {
            return res.status(403).json({ error: 'Usuario no autorizado' });
        }

        // 3. Verify password usando bcrypt.
        const passwordMatch = await bcrypt.compare(password, usuario.pass || '');

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // 4. Create JWT Token
        const token = jwt.sign(
            {
                id: usuario.id,
                email: usuario.name,
                typeuser: usuario.typeuser,
                permisos: usuario.permisos,
                idcliente: usuario.idcliente
            },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        // 5. Send successful response
        res.json({
            message: 'Login exitoso',
            token,
            user: {
                id: usuario.id,
                name: usuario.name,
                empresa: usuario.cliente?.NOMBRE || 'Desconocida'
            }
        });

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

// Obtener usuarios del cliente actual
app.get('/api/usuarios', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const usuarios = await prisma.usuario.findMany({
            where: { idcliente },
            select: { id: true, name: true, tiempo: true, typeuser: true, permisos: true, autorizado: true, idcliente: true }
        });
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// Crear usuario (usará la misma idcliente del admin que lo crea)
app.post('/api/usuarios', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const { name, pass, tiempo, typeuser, permisos, autorizado } = req.body;

        let passToSave = pass;
        if (pass && pass.trim() !== '') {
            passToSave = await bcrypt.hash(pass, 10);
        }

        const nuevoUsuario = await prisma.usuario.create({
            data: {
                name,
                pass: passToSave,
                tiempo,
                typeuser,
                permisos,
                autorizado,
                idcliente
            }
        });
        // Remove password before sending
        const { pass: _, ...userWithoutPass } = nuevoUsuario;
        res.json(userWithoutPass);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

// Actualizar usuario
app.put('/api/usuarios/:id', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const { id } = req.params;
        const { name, pass, tiempo, typeuser, permisos, autorizado } = req.body;

        // Comprobar que pertenece al mismo cliente
        const existing = await prisma.usuario.findFirst({ where: { id: Number(id), idcliente } });
        if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });

        const dataUpdate: any = { name, tiempo, typeuser, permisos, autorizado };
        if (pass && pass.trim() !== '') {
            dataUpdate.pass = await bcrypt.hash(pass, 10);
        }

        const actualizado = await prisma.usuario.update({
            where: { id: Number(id) },
            data: dataUpdate
        });

        const { pass: _, ...userWithoutPass } = actualizado;
        res.json(userWithoutPass);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

// Eliminar usuario
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

// Obtener datos del cliente del usuario logueado
app.get('/api/cliente', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const cliente = await prisma.cliente.findUnique({
            where: { CODIGO: idcliente }
        });
        if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
        res.json(cliente);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener cliente' });
    }
});

// Actualizar datos del cliente
app.put('/api/cliente', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const { NOMBRE, NIF, PAIS, PROVINCIA, POBLACION, DIRECCION, TELEFONO, MOVIL, CONTACTO, LOGO } = req.body;

        const actualizado = await prisma.cliente.update({
            where: { CODIGO: idcliente },
            data: {
                NOMBRE, NIF, PAIS, PROVINCIA, POBLACION, DIRECCION, TELEFONO, MOVIL, CONTACTO, LOGO
            }
        });
        res.json(actualizado);
    } catch (error) {
        console.error('API PUT CLIENTE ERROR:', error);
        res.status(500).json({ error: 'Error al actualizar cliente' });
    }
});

// Guardar medición del colorímetro
app.post('/api/mediciones', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { idcliente } = (req as any).user;
        const { L, A, B, R, G, RB, C, H, FECHA } = req.body;

        const medicion = await prisma.formPersonales.create({
            data: {
                IDCLIENTE: idcliente,
                L: L?.toString(),
                A: A?.toString(),
                B: B?.toString(),
                R: R?.toString(),
                G: G?.toString(),
                RB: RB?.toString(),
                C: C?.toString(),
                H: H?.toString(),
                FECHA: FECHA || new Date().toISOString(),
            }
        });

        res.status(201).json(medicion);
    } catch (error) {
        console.error('API POST MEDICION ERROR:', error);
        res.status(500).json({ error: 'Error al guardar medición' });
    }
});

// Serve static files from the React app in production
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// For any request that doesn't match an API route, send index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Restart tsx

