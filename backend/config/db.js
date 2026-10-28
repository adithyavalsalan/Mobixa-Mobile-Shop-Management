const mongoose = require('mongoose');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let isConnected = false;
let mongodProcess = null;

const tryAutoStartMongod = async () => {
    try {
        const cacheDir = path.join(__dirname, '../../node_modules/.cache/mongodb-memory-server');
        if (!fs.existsSync(cacheDir)) return false;

        const files = fs.readdirSync(cacheDir, { recursive: true });
        const mongodFile = files.find(f => typeof f === 'string' && (f.endsWith('mongod.exe') || (f.startsWith('mongod') && f.endsWith('.exe'))));
        if (!mongodFile) return false;

        const mongodPath = path.join(cacheDir, mongodFile);
        const dbPath = path.join(__dirname, '../../data/db');
        if (!fs.existsSync(dbPath)) {
            fs.mkdirSync(dbPath, { recursive: true });
        }

        console.log(`[Database] Local MongoDB service was not detected.`);
        console.log(`[Database] Auto-starting bundled MongoDB engine at: ${mongodPath}`);
        mongodProcess = spawn(mongodPath, ['--dbpath', dbPath, '--port', '27017', '--bind_ip', '127.0.0.1'], {
            detached: true,
            stdio: 'ignore'
        });
        mongodProcess.unref();

        // Wait 2.5 seconds for socket ready
        await new Promise(resolve => setTimeout(resolve, 2500));
        return true;
    } catch (e) {
        console.warn('[Database] Could not auto-start local mongod:', e.message);
        return false;
    }
};

const connectDB = async () => {
    const rawUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mobixa';
    // Prefer 127.0.0.1 on Windows to bypass IPv6 (::1) socket binding issues
    const primaryUri = rawUri;

    try {
        mongoose.set('strictQuery', false);
        const conn = await mongoose.connect(primaryUri, {
            serverSelectionTimeoutMS: 3000,
        });
        isConnected = true;
        console.log(`[Database] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
        return conn;
    } catch (error) {
        // Fallback: If uri used 'localhost', retry with '127.0.0.1' (handles Windows IPv6 ::1 issue)
        if (primaryUri.includes('localhost')) {
            const ipv4Uri = primaryUri.replace('localhost', '127.0.0.1');
            try {
                const conn = await mongoose.connect(ipv4Uri, {
                    serverSelectionTimeoutMS: 3000,
                });
                isConnected = true;
                console.log(`[Database] MongoDB connected via 127.0.0.1: ${conn.connection.host}/${conn.connection.name}`);
                return conn;
            } catch (fallbackErr) {
                // Proceed to auto-start attempt
            }
        }

        // If local connection failed, try auto-starting local mongod if binary is cached
        if (primaryUri.includes('127.0.0.1') || primaryUri.includes('localhost')) {
            const started = await tryAutoStartMongod();
            if (started) {
                try {
                    const fallbackUri = primaryUri.replace('localhost', '127.0.0.1');
                    const conn = await mongoose.connect(fallbackUri, {
                        serverSelectionTimeoutMS: 4000,
                    });
                    isConnected = true;
                    console.log(`[Database] MongoDB connected after auto-start: ${conn.connection.host}/${conn.connection.name}`);
                    return conn;
                } catch (retryErr) {
                    console.error('[Database] MongoDB connection retry failed:', retryErr.message);
                }
            }
        }
        isConnected = false;
        console.error('[Database] MongoDB connection error:', error.message);
        console.error('[Database] Please ensure MongoDB Community Server is running on port 27017 or set MONGO_URI in .env');
    }
};

const getStatus = () => ({
    isConnected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null
});

module.exports = { connectDB, getStatus };
