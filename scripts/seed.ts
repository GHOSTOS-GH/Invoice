import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

const h = (p: string) => bcrypt.hashSync(p, 10);

async function main() {
  const admin = await db.user.upsert({
    where: { phone: "+221770000000" },
    update: {},
    create: {
      phone: "+221770000000",
      passwordHash: h("admin1234"),
      name: "Mohamed Admin",
      role: "admin",
    },
  });

  const emp = await db.user.upsert({
    where: { phone: "+221771111111" },
    update: {},
    create: {
      phone: "+221771111111",
      passwordHash: h("employe1234"),
      name: "Awa Employée",
      role: "employee",
    },
  });

  const prods: [string, string, string | null][] = [
    ["Wax Hollandais", "Tissus", null],
    ["Bazin riche", "Tissus", null],
    ["Pagne Kita", "Pagnes", null],
    ["Foulard soie", "Accessoires", null],
    ["Robe longue", "Vêtements", null],
    ["Boubou homme", "Vêtements", null],
    ["Ceinture dorée", "Accessoires", null],
    ["Wax Vlisco", "Tissus", null],
    ["Tissu Perlé", "Pagnes", null],
    ["Sandales cuir", "Accessoires", null],
  ];
  for (const [name, cat, img] of prods) {
    const ex = await db.product.findFirst({ where: { name, createdBy: admin.id } });
    if (!ex)
      await db.product.create({
        data: { name, category: cat, imageUrl: img, createdBy: admin.id },
      });
  }

  const clients = [
    "Fatou Diop",
    "Aïssatou Sow",
    "Mamadou Ba",
    "Khadija Ndiaye",
    "Ibrahima Fall",
  ];
  for (const name of clients) {
    const ex = await db.client.findFirst({ where: { name, createdBy: admin.id } });
    if (!ex)
      await db.client.create({
        data: {
          name,
          phone: "+22177" + String(Math.floor(10000000 + Math.random() * 89999999)),
          createdBy: admin.id,
        },
      });
  }

  const statuses = ["enCours", "enLivraison", "livree", "archivee"];
  const itemsPool: [string, number, number][] = [
    ["Wax Hollandais", 2, 8000],
    ["Bazin riche", 1, 12000],
    ["Pagne Kita", 3, 15000],
    ["Foulard soie", 2, 5000],
    ["Robe longue", 1, 25000],
    ["Boubou homme", 1, 30000],
    ["Ceinture dorée", 4, 3500],
    ["Wax Vlisco", 2, 18000],
  ];
  const now = Date.now();
  for (let i = 0; i < 24; i++) {
    const clientName = clients[i % clients.length];
    const status = statuses[i % statuses.length];
    const dayOffset = Math.floor(i / 3);
    const createdAt = new Date(now - dayOffset * 86400000 - (i % 24) * 3600000);
    const itemCount = 1 + (i % 3);
    const chosen: { name: string; quantity: number; unitPrice: number }[] = [];
    for (let j = 0; j < itemCount; j++) {
      const base = itemsPool[(i + j) % itemsPool.length];
      chosen.push({ name: base[0], quantity: base[1], unitPrice: base[2] });
    }
    const inv = await db.invoice.create({
      data: {
        clientName,
        status,
        notes: i % 6 === 0 ? "Livraison express" : null,
        createdBy: admin.id,
        createdAt,
        updatedAt: createdAt,
      },
    });
    for (const it of chosen) {
      await db.invoiceItem.create({
        data: {
          invoiceId: inv.id,
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        },
      });
    }
  }

  await db.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      shopName: "Konté Bussness Services",
      shopAddress: "Marché Sandaga, Dakar",
      shopPhone: "+221 77 000 00 00",
      shopNinea: "0056789AB",
      footerMessage: "Merci de votre visite !",
    },
  });

  console.log("Seed complete. Admin:", admin.phone, "| Employee:", emp.phone);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
