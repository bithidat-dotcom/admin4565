import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, doc, deleteDoc, updateDoc } from "firebase/firestore";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable CORS so the pbazar storefront can connect seamlessly from external origins
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json());

  // Load Firebase Config for server-side endpoints
  let firebaseAppletConfig: any = {};
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      firebaseAppletConfig = JSON.parse(fileContent);
    }
  } catch (e) {
    console.error("Failed to load firebase-applet-config.json:", e);
  }

  // Fallback to user-supplied configuration values
  const firebaseConfig = {
    apiKey: firebaseAppletConfig.apiKey || "AIzaSyD9FxCHyk-l8QUQ-2Rzbif-XjYWGC5cRog",
    authDomain: firebaseAppletConfig.authDomain || "genial-inn-2h7sp.firebaseapp.com",
    projectId: firebaseAppletConfig.projectId || "genial-inn-2h7sp",
    storageBucket: firebaseAppletConfig.storageBucket || "genial-inn-2h7sp.firebasestorage.app",
    messagingSenderId: firebaseAppletConfig.messagingSenderId || "295815579779",
    appId: firebaseAppletConfig.appId || "1:295815579779:web:585000cb89c55959cc33b6"
  };

  // Initialize Firebase app for server caching
  const fbApp = initializeApp(firebaseConfig);
  const db = getFirestore(fbApp, firebaseAppletConfig.firestoreDatabaseId || undefined);

  // In-memory caching for lightning-fast speeds
  let productsCache: any[] = [];
  let lastProductsFetch = 0;
  let foodsCache: any[] = [];
  let lastFoodsFetch = 0;
  const CACHE_DURATION = 10000; // 10 seconds cache

  // Server API Connection endpoints (Server 1: Products, Server 2: Foods)
  app.get("/api/products", async (req, res) => {
    try {
      const now = Date.now();
      if (productsCache.length > 0 && now - lastProductsFetch < CACHE_DURATION) {
        return res.json({ products: productsCache, cached: true });
      }
      const querySnapshot = await getDocs(collection(db, "products"));
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      productsCache = items;
      lastProductsFetch = now;
      res.json({ products: items, cached: false });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.get("/api/foods", async (req, res) => {
    try {
      const now = Date.now();
      if (foodsCache.length > 0 && now - lastFoodsFetch < CACHE_DURATION) {
        return res.json({ foods: foodsCache, cached: true });
      }
      const querySnapshot = await getDocs(collection(db, "foods"));
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      foodsCache = items;
      lastFoodsFetch = now;
      res.json({ foods: items, cached: false });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const productData = req.body;
      const docRef = await addDoc(collection(db, "products"), {
        ...productData,
        created_at: new Date().toISOString()
      });
      productsCache = []; // invalidate
      res.json({ success: true, id: docRef.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.post("/api/foods", async (req, res) => {
    try {
      const foodData = req.body;
      const docRef = await addDoc(collection(db, "foods"), {
        ...foodData,
        created_at: new Date().toISOString()
      });
      foodsCache = []; // invalidate
      res.json({ success: true, id: docRef.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await deleteDoc(doc(db, "products", id));
      productsCache = []; // invalidate cache
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.delete("/api/foods/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await deleteDoc(doc(db, "foods", id));
      foodsCache = []; // invalidate cache
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      await updateDoc(doc(db, "products", id), data);
      productsCache = []; // invalidate cache
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.put("/api/foods/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      await updateDoc(doc(db, "foods", id), data);
      foodsCache = []; // invalidate cache
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // --- ORDER GATEWAYS FOR BUYER FRONT END ---

  // Marketplace Product Orders
  app.get("/api/orders", async (req, res) => {
    try {
      const querySnapshot = await getDocs(collection(db, "orders"));
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json({ orders: items });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const orderPayload = req.body;
      const docRef = await addDoc(collection(db, "orders"), {
        ...orderPayload,
        created_at: new Date().toISOString()
      });
      res.json({ success: true, id: docRef.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Food / Restaurant Orders
  app.get("/api/food_orders", async (req, res) => {
    try {
      const querySnapshot = await getDocs(collection(db, "food_orders"));
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json({ food_orders: items });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.post("/api/food_orders", async (req, res) => {
    try {
      const orderPayload = req.body;
      const docRef = await addDoc(collection(db, "food_orders"), {
        ...orderPayload,
        created_at: new Date().toISOString()
      });
      res.json({ success: true, id: docRef.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Cafe Orders
  app.get("/api/cafe_orders", async (req, res) => {
    try {
      const querySnapshot = await getDocs(collection(db, "cafe_orders"));
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json({ cafe_orders: items });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.post("/api/cafe_orders", async (req, res) => {
    try {
      const orderPayload = req.body;
      const docRef = await addDoc(collection(db, "cafe_orders"), {
        ...orderPayload,
        created_at: new Date().toISOString()
      });
      res.json({ success: true, id: docRef.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Health endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", connected: true, service: "pbazar-fullstack" });
  });

  // Serve static frontend files / Vite dev middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Pbazar Full-Stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
