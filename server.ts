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

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Ensure directories exist for hosting records and uploads
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const hostDataDir = path.join(process.cwd(), 'host_data');
  if (!fs.existsSync(hostDataDir)) {
    fs.mkdirSync(hostDataDir, { recursive: true });
  }

  // Serve uploaded images statically
  app.use('/uploads', express.static(uploadsDir));

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

  // --- IMAGE UPLOAD TO HOST SERVER (Instant Image to URL Converter) ---
  app.post("/api/upload", (req, res) => {
    try {
      const { image, filename = "image.png" } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No image payload provided" });
      }

      // Handle data URL (data:image/png;base64,...)
      const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer: Buffer;
      let ext = "png";

      if (matches && matches.length === 3) {
        const mime = matches[1];
        if (mime.includes("jpeg") || mime.includes("jpg")) ext = "jpg";
        else if (mime.includes("webp")) ext = "webp";
        else if (mime.includes("gif")) ext = "gif";
        buffer = Buffer.from(matches[2], "base64");
      } else {
        buffer = Buffer.from(image, "base64");
      }

      const safeName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const filePath = path.join(uploadsDir, safeName);
      fs.writeFileSync(filePath, buffer);

      const host = req.get("host") || "localhost:3000";
      const protocol = req.protocol || "http";
      const publicUrl = `${protocol}://${host}/uploads/${safeName}`;

      res.json({
        success: true,
        url: publicUrl,
        relativePath: `/uploads/${safeName}`,
        filename: safeName,
        size: buffer.length
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ error: err.message || "Failed to save image" });
    }
  });

  // --- HOST SERVER RECORDS STORAGE (Order Records Backup) ---
  const orderRecordsFile = path.join(hostDataDir, "order_records.json");
  const readRecords = (filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
      }
    } catch (e) {
      console.error("Error reading file:", filePath, e);
    }
    return [];
  };

  const writeRecords = (filePath: string, data: any) => {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
      return true;
    } catch (e) {
      console.error("Error writing file:", filePath, e);
      return false;
    }
  };

  app.get("/api/order_records", (req, res) => {
    const records = readRecords(orderRecordsFile);
    res.json({ records });
  });

  app.post("/api/order_records", (req, res) => {
    try {
      const newRecord = req.body;
      const records = readRecords(orderRecordsFile);
      const existingIndex = records.findIndex((r: any) => r.id === newRecord.id);
      if (existingIndex >= 0) {
        records[existingIndex] = { ...records[existingIndex], ...newRecord, updated_at: new Date().toISOString() };
      } else {
        records.unshift({
          ...newRecord,
          id: newRecord.id || `REC-${Date.now()}`,
          recorded_at: new Date().toISOString()
        });
      }
      writeRecords(orderRecordsFile, records.slice(0, 5000));
      res.json({ success: true, count: records.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- CUSTOMER PRODUCT CLICK ACTIVITY (Deduplicated tracking) ---
  const clicksFile = path.join(hostDataDir, "product_clicks.json");
  app.get("/api/product_clicks", (req, res) => {
    const clicks = readRecords(clicksFile);
    res.json({ clicks });
  });

  app.post("/api/product_clicks", (req, res) => {
    try {
      const { customer_id, customer_name, customer_phone, product_id, product_name, product_image, ip_address } = req.body;
      if (!product_id) {
        return res.status(400).json({ error: "Product ID required" });
      }

      const clientIp = ip_address || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
      const clicks = readRecords(clicksFile);

      // Deduplication rule: Same customer/IP + Same product updates last_clicked_at & increments click_count without spamming duplicate rows
      const targetUser = customer_id || customer_phone || clientIp;
      const matchIndex = clicks.findIndex((c: any) => (c.customer_id === targetUser || c.ip_address === clientIp) && c.product_id === product_id);

      if (matchIndex >= 0) {
        clicks[matchIndex].click_count = (clicks[matchIndex].click_count || 1) + 1;
        clicks[matchIndex].last_clicked_at = new Date().toISOString();
        if (customer_name && !clicks[matchIndex].customer_name) clicks[matchIndex].customer_name = customer_name;
      } else {
        clicks.unshift({
          id: `CLK-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          customer_id: targetUser,
          customer_name: customer_name || "Guest Customer",
          customer_phone: customer_phone || "",
          product_id,
          product_name: product_name || "Product",
          product_image: product_image || "",
          ip_address: String(clientIp),
          click_count: 1,
          first_clicked_at: new Date().toISOString(),
          last_clicked_at: new Date().toISOString()
        });
      }

      writeRecords(clicksFile, clicks.slice(0, 10000));
      res.json({ success: true, count: clicks.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- SCAM LOGS & FRAUD PREVENTION AUDIT ---
  const scamLogsFile = path.join(hostDataDir, "scam_logs.json");
  app.get("/api/scam_logs", (req, res) => {
    const logs = readRecords(scamLogsFile);
    res.json({ logs });
  });

  app.post("/api/scam_logs", (req, res) => {
    try {
      const entry = req.body;
      const logs = readRecords(scamLogsFile);
      logs.unshift({
        id: `SCAM-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ...entry,
        logged_at: new Date().toISOString()
      });
      writeRecords(scamLogsFile, logs.slice(0, 2000));
      res.json({ success: true, count: logs.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
