export const DEFAULT_SHOP_INFO = {
  shopName: "เป๋าตุง Wash & Dry",
  address: "269/3-4 หมู่ 4 ตำบลในเมือง อำเภอเมือง จังหวัดชัยภูมิ รหัสไปรษณีย์ 36000",
};

export const DEFAULT_INVENTORY = {
  washLiquidPerDay: 20,
  softenerPerDay: 20,
};

export const DEFAULT_PRICING = {
  liquids: [
    { id: "wash-liquid", name: "น้ำยาซักผ้า", unit: "ซอง", price: 5 },
    { id: "softener", name: "น้ำยาปรับผ้านุ่ม", unit: "ซอง", price: 5 },
  ],
  washers: [
    {
      id: "wash-small",
      name: "เครื่องซักผ้า (เล็ก)",
      options: [
        { temp: "cold", label: "น้ำเย็น", normalPrice: 30, promoPrice: 20 },
        { temp: "warm", label: "น้ำอุ่น", normalPrice: 40, promoPrice: null },
        { temp: "hot", label: "น้ำร้อน", normalPrice: 50, promoPrice: null },
      ],
    },
    {
      id: "wash-large",
      name: "เครื่องซักผ้า (ใหญ่)",
      options: [
        { temp: "cold", label: "น้ำเย็น", normalPrice: 50, promoPrice: 40 },
        { temp: "warm", label: "น้ำอุ่น", normalPrice: 60, promoPrice: null },
        { temp: "hot", label: "น้ำร้อน", normalPrice: 70, promoPrice: null },
      ],
    },
  ],
  dryers: [
    { id: "dry-small", name: "เครื่องอบผ้า (เล็ก)", normalPrice: 40, promoPrice: 30 },
    { id: "dry-large", name: "เครื่องอบผ้า (ใหญ่)", normalPrice: 50, promoPrice: null },
  ],
  dryerAddons: [10, 20, 30],
};
