# 🏢 مكتبي العقاري | My Real Estate Office

## هيكل المشروع | Project Structure

```
real-estate/
├── api/
│   ├── properties.js   ← جلب العقارات من Notion
│   └── clients.js      ← حفظ العملاء في Notion
├── public/
│   ├── index.html      ← الصفحة الرئيسية
│   ├── properties.html ← عرض العقارات
│   └── register.html   ← تسجيل العملاء
├── vercel.json         ← إعدادات Vercel
└── README.md
```

## خطوات الرفع على Vercel | Deployment Steps

### 1. ارفع على GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/real-estate.git
git push -u origin main
```

### 2. ارفع على Vercel
1. افتح [vercel.com](https://vercel.com)
2. اضغط **Add New Project**
3. اختر مستودع `real-estate`
4. قبل الضغط على Deploy، أضف **Environment Variable**:
   - Name: `NOTION_TOKEN`
   - Value: `ntn_xxxxxxxxxxxxxx` (التوكن الخاص بك)
5. اضغط **Deploy** ✅

### 3. ربط الـ Integration بـ Notion
1. افتح [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. افتح الـ Integration التي أنشأتها
3. تأكد أنها تملك صلاحية على قاعدتي البيانات:
   - 🏠 العقارات | Properties
   - 👥 العملاء | Clients
4. افتح كل قاعدة بيانات في Notion → **...** → **Connections** → أضف الـ Integration

## Notion Database IDs
- Properties: `d2c50809-3534-4fc5-a7cd-8f1e67b5b25a`
- Clients: `b45f8759-b583-48c7-9372-cc72b88767d6`
