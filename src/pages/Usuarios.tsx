import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, UserPlus, Trash2, Edit2, Shield, User, X, Check } from 'lucide-react';
import { API_BASE_URL } from '../config';

import Sidebar from '../components/Sidebar';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

interface Usuario {
    id: number;
    name: string;
    tiempo: number | null;
    typeuser: number | null;
    permisos: number | null;
    autorizado: boolean | null;
    idcliente: number | null;
    photo?: string | null;
}

export default function Usuarios({ userData, onLogout }: { userData: any; onLogout: () => void }) {
    const navigate = useNavigate();
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [error, setError] = useState('');

    // Form states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Usuario | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        pass: '',
        photo: '',
        permisos: 1,
        typeuser: 1,
        autorizado: true,
    });

    const fetchUsuarios = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/usuarios`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) onLogout();
                throw new Error('Error al cargar usuarios');
            }
            const data = await res.json();
            setUsuarios(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsuarios();
    }, []);

    const handleOpenModal = (user?: Usuario) => {
        setError('');
        if (user) {
            setEditingUser(user);
            setFormData({
                name: user.name || '',
                pass: '',
                photo: user.photo || '',
                permisos: user.permisos || 1,
                typeuser: user.typeuser || 1,
                autorizado: user.autorizado || false,
            });
        } else {
            setEditingUser(null);
            setFormData({
                name: '',
                pass: '',
                photo: '',
                permisos: 1,
                typeuser: 1,
                autorizado: true,
            });
        }
        setIsModalOpen(true);
    };

    const handlePhotoChange = async () => {
        try {
            const image = await Camera.getPhoto({
                quality: 80,
                allowEditing: true,
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Prompt,
                promptLabelHeader: 'Foto de Perfil',
                promptLabelCancel: 'Cancelar',
                promptLabelPhoto: 'Elegir de la Galería',
                promptLabelPicture: 'Tomar Foto'
            });

            if (image.dataUrl) {
                if (image.dataUrl.length > 5 * 1024 * 1024 * 1.37) {
                    setError('La imagen es muy pesada. Máximo ~5MB');
                    return;
                }
                setFormData(prev => ({ ...prev, photo: image.dataUrl as string }));
            }
        } catch (error) {
            console.log('User cancelled camera/gallery or error: ', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingUser && !confirm('¿Estás seguro de guardar estas modificaciones?')) return;
        try {
            const token = localStorage.getItem('token');
            const url = editingUser
                ? `${API_BASE_URL}/api/usuarios/${editingUser.id}`
                : `${API_BASE_URL}/api/usuarios`;


            const res = await fetch(url, {
                method: editingUser ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const d = await res.json();
                if (res.status === 401 || res.status === 403) onLogout();
                throw new Error(d.error || 'Error al persistir usuario');
            }

            setIsModalOpen(false);
            fetchUsuarios();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Advertencia: El usuario se borrará permanentemente y se quedará sin acceso al sistema. ¿Seguro quieres eliminar a este usuario?')) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/usuarios/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) onLogout();
                throw new Error('Falló al eliminar');
            }
            fetchUsuarios();
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-[#0A0F14] text-slate-200 font-sans flex flex-col">
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                onLogout={onLogout}
                userData={userData}
            />

            {/* Header */}
            <header className="fixed top-0 z-10 flex w-full items-center gap-4 border-b border-slate-800 bg-[#0A0F14]/80 backdrop-blur-md px-6 py-4">
                <button
                    onClick={() => navigate('/')}
                    className="p-2 text-slate-400 hover:text-white transition-colors hover:bg-slate-800/50 rounded-lg mr-2"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
                        <Shield className="h-5 w-5 text-[#c07204]" />
                        Administración de Usuarios
                    </h1>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Gestiona los accesos a tu organización</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-[#c07204] hover:bg-[#a66203] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-[#c07204]/20 flex items-center gap-2 transition-all active:scale-[0.98]"
                    >
                        <UserPlus className="h-4 w-4" /> <span className="hidden md:inline">Nuevo Usuario</span>
                    </button>
                </div>
            </header>

            <main className="pt-36 md:pt-28 pb-12 px-6 flex-grow container mx-auto max-w-6xl">
                {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg mb-6">{error}</div>}

                {loading ? (
                    <div className="flex justify-center mt-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#004A99]"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {usuarios.map(user => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={user.id}
                                onClick={() => handleOpenModal(user)}
                                className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative group hover:border-slate-700 transition-colors cursor-pointer"
                            >
                                <div className="absolute top-4 right-4 flex gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); handleOpenModal(user); }} className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg">
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(user.id); }} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>

                                <div className="flex items-center gap-4 mb-4">
                                    <div className="h-12 w-12 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 border border-slate-700 shrink-0 overflow-hidden">
                                        {user.photo ? (
                                            <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="h-6 w-6" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-white text-lg truncate">{user.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className={`w-2 h-2 rounded-full ${user.autorizado ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            <p className="text-xs text-slate-400 uppercase">{user.autorizado ? 'Habilitado' : 'Bloqueado'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <p className="text-slate-500 uppercase tracking-widest text-[9px] mb-1">Permisos Nivel</p>
                                        <p className="font-medium text-slate-300">{user.permisos || '0'}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500 uppercase tracking-widest text-[9px] mb-1">Tipo de Usuario</p>
                                        <p className="font-medium text-slate-300">{user.typeuser || 'Regular'}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>

            {/* MODAL */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 overflow-hidden"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-lg font-bold text-white">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="flex justify-center mb-6">
                                    <div
                                        className="h-24 w-24 bg-slate-800 rounded-full flex flex-col items-center justify-center text-slate-400 border border-slate-700 overflow-hidden relative cursor-pointer"
                                        onClick={(e) => { e.stopPropagation(); handlePhotoChange() }}
                                    >
                                        {formData.photo ? (
                                            <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <>
                                                <User className="h-8 w-8 mb-1" />
                                                <span className="text-[9px] uppercase font-semibold">Foto</span>
                                            </>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                            <span className="text-xs text-white font-bold">Cambiar</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Email / Nombre</label>
                                    <input
                                        type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Contraseña {editingUser && '(opcional)'}</label>
                                    <input
                                        type="password" required={!editingUser} value={formData.pass} onChange={e => setFormData({ ...formData, pass: e.target.value })}
                                        placeholder={editingUser ? "Dejar en blanco para no cambiar..." : "Contraseña..."}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Nivel Permiso</label>
                                        <input
                                            type="number" value={formData.permisos} onChange={e => setFormData({ ...formData, permisos: Number(e.target.value) })}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Tipo</label>
                                        <input
                                            type="number" value={formData.typeuser} onChange={e => setFormData({ ...formData, typeuser: Number(e.target.value) })}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-800 mt-2 cursor-pointer">
                                    <div className={`w-5 h-5 rounded flex items-center justify-center ${formData.autorizado ? 'bg-[#c07204]' : 'bg-slate-700'}`}>
                                        {formData.autorizado && <Check className="h-4 w-4 text-white" />}
                                    </div>
                                    <input
                                        type="checkbox" className="hidden"
                                        checked={formData.autorizado} onChange={e => setFormData({ ...formData, autorizado: e.target.checked })}
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-white">Cuenta Activa (Autorizado)</span>
                                        <span className="text-[10px] text-slate-400 uppercase">Habilitar el acceso al sistema</span>
                                    </div>
                                </label>

                                <div className="pt-6">
                                    <button type="submit" className="w-full py-3 bg-[#c07204] hover:bg-[#a66203] text-white rounded-lg font-bold uppercase tracking-widest text-sm transition-all shadow-lg shadow-[#c07204]/20">
                                        {editingUser ? 'Guardar Cambios' : 'Registrar'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
