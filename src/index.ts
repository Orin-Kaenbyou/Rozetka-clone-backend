import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { prisma } from "./prisma";
import { requireAuth, AuthRequest } from "./middleware/auth";


  
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Сервер працює!");
});

app.listen(PORT, () => {
  console.log(`Сервер запущено на http://localhost:${PORT}`);
});





app.post("/register", async (req, res) => {

  try {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email і пароль обов'язкові" });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(409).json({ error: "Користувач з таким email вже існує" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, password: hashedPassword },
  });

  res.status(201).json({ id: user.id, email: user.email });
} catch(error) {
  console.error("Помилка реєстрації:", error);
  res.status(500).json({ error: "Внутрішня помилка сервера" })
}
});





app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email і пароль обов'язкові" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Невірний email або пароль" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ error: "Невірний email або пароль" });
  }

  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  );

  res.json({ token, user: { id: user.id, email: user.email } });
});





app.post("/wishlist", requireAuth, async (req: AuthRequest, res) => {
  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({ error: "productId обов'язковий" });
  }

  const existing = await prisma.wishlist.findFirst({
    where: { userId: req.userId, productId },
  });

  if (existing) {
    return res.status(409).json({ error: "Товар вже у вішлісті" });
  }

  const item = await prisma.wishlist.create({
    data: { userId: req.userId as number, productId },
  });

  res.status(201).json(item);
});


app.get("/wishlist", requireAuth, async (req: AuthRequest, res) => {
  const items = await prisma.wishlist.findMany({
    where: { userId: req.userId },
  });

  res.json(items);
});


app.delete("/wishlist/:productId", requireAuth, async (req: AuthRequest, res) => {
  const productId = Number(req.params.productId);

  await prisma.wishlist.deleteMany({
    where: { userId: req.userId, productId },
  });

  res.status(204).send();
});

app.post("/cart", requireAuth, async (req: AuthRequest, res ) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ error:"ProductId обов'язковий" });
    }

    const item = await prisma.cartItem.upsert({
      where: {
        userId_productId: {
          userId: req.userId as number,
          productId,
        },
      },
      update: {
        quantity: { increment: 1 },
      },
       create: {
        userId: req.userId as number,
        productId,
        quantity: 1,
       }
    });

    res.status(201).json(item);
  } catch (error) {
    console.error("Помилка додавання в кошик", error);
    res.status(500).json({ error: "Внутрішня помилка сервера" });
  }
});

app.get("/cart", requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await prisma.cartItem.findMany({
      where: { userId: req.userId },
    });
    res.json(items);
  } catch (error) {
    console.error("Помилка отримання кошика:", error);
    res.status(500).json({ error: "Внутрішня помилка сервера" })
  }
});

app.patch("/cart/:productId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.productId);
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: "Кількість має бути щонайменше 1" });
    }

    const item = await prisma.cartItem.update({
      where: {
        userId_productId: {
          userId: req.userId as number,
          productId,
        },
      },
      data: { quantity },
    });

    res.json(item);
  } catch (error) {
    console.error("Помилка оновлення кошика:", error);
    res.status(500).json({ error: "Внутрішня помилка сервера" });
  }
});

app.delete("/cart/:productId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.productId);

    await prisma.cartItem.deleteMany({
      where: { userId: req.userId, productId },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Помилка видаалення з кошика", error);
    res.status(500).json({ error: "Внутрішня помилка сервера" });
  }
});

